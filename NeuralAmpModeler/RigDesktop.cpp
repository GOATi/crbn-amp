// CRBN Rig's engine in the desktop app: see RigDesktop.h.
#include "RigDesktop.h"

#include <algorithm>
#include <cfenv>
#include <cmath>
#include <cstdint>

#include "../AudioDSPTools/dsp/ImpulseResponse.h"
#include "../AudioDSPTools/dsp/Resample.h"
#include "architecture.hpp"

// web/engine/rig_engine.cpp, compiled into the app.
extern "C"
{
  int rig_init(double sampleRate);
  float* rig_input();
  float* rig_output();
  void rig_process(int nFrames);
  void rig_set_param(int id, double value);
  int rig_stage_model(const char* text, int bytes, double* info, char* error, int errorBytes);
  void rig_stage_clear_model();
  void rig_collect();
  float rig_take_input_peak();
}

namespace rig
{
namespace
{
constexpr double kStandbySeconds = 0.02; // Standby's fade (D-RIG-016 (c)), as the web version's GainNode ramps
constexpr int kInfoCount = 10; // rig_engine.cpp's Info

template <typename T>
T* ClearMark()
{
  return reinterpret_cast<T*>(static_cast<uintptr_t>(1));
}

// Swaps in what the UI staged (or a clear), retiring what it replaces for Collect.
template <typename T>
void Take(std::atomic<T*>& pending, std::unique_ptr<T>& current, std::atomic<T*>& retired)
{
  T* next = pending.exchange(nullptr, std::memory_order_acq_rel);
  if (next == nullptr)
    return;
  T* old = current.release();
  if (next != ClearMark<T>())
    current.reset(next);
  if (old != nullptr)
    delete retired.exchange(old, std::memory_order_acq_rel); // nullptr unless Collect fell behind
}

// Stages `next` (or a clear) for the audio thread, freeing a staged one it never took.
template <typename T>
void Stage(std::atomic<T*>& pending, T* next)
{
  T* was = pending.exchange(next, std::memory_order_acq_rel);
  if (was != nullptr && was != ClearMark<T>())
    delete was;
}

void PeakInto(std::atomic<float>& peak, float v)
{
  float cur = peak.load(std::memory_order_relaxed);
  while (v > cur && !peak.compare_exchange_weak(cur, v, std::memory_order_relaxed))
  {
  }
}
} // namespace

Desktop::Desktop()
{
  mChanges.reserve(256);
  mApplying.reserve(256);
  mMono.assign(static_cast<size_t>(mMaxBlock), 0.0);
  mWet.assign(static_cast<size_t>(mMaxBlock), 0.0);
  mMonoPtr[0] = mMono.data();
  mMaxBlock = rig_init(mSampleRate); // the page may send a capture before the driver starts
}

Desktop::~Desktop()
{
  // The audio has stopped by now.
  Stage<dsp::ImpulseResponse>(mPendingIR, nullptr);
  Stage<std::vector<float>>(mPendingDemo, nullptr);
  Collect();
}

void Desktop::Reset(double sampleRate)
{
  mSampleRate = sampleRate > 0.0 ? sampleRate : 48000.0;
  mMaxBlock = rig_init(mSampleRate);
  // The audio thread is stopped: rebuild what depends on the rate in place, from what the UI last asked for.
  Stage<dsp::ImpulseResponse>(mPendingIR, nullptr);
  mIR.reset();
  if (!mIRRaw.empty())
    mIR = std::make_unique<dsp::ImpulseResponse>(dsp::ImpulseResponse::IRData{mIRRaw, mIRRawRate}, mSampleRate);
  Stage<std::vector<float>>(mPendingDemo, nullptr);
  mDemo.reset();
  mDemoAt = 0;
  BuildDemo();
  Take<std::vector<float>>(mPendingDemo, mDemo, mRetiredDemo);
  mStandbyGain = mStandby.load() ? 0.0 : 1.0;
  Collect();
}

void Desktop::SetParam(int id, double value)
{
  std::lock_guard<std::mutex> lock(mChangesLock);
  // A knob dragged faster than the audio takes it keeps only its latest value.
  for (Change& c : mChanges)
    if (c.id == id)
    {
      c.value = value;
      return;
    }
  mChanges.push_back({id, value});
}

bool Desktop::StageCapture(const std::string& json, CaptureInfo& info, std::string& error)
{
  double v[kInfoCount] = {};
  char why[512] = {};
  if (rig_stage_model(json.data(), static_cast<int>(json.size()), v, why, sizeof why) != 0)
  {
    error = why;
    return false;
  }
  info.hasLoudness = v[1] > 0.5;
  info.loudness = v[2];
  info.hasInputLevel = v[3] > 0.5;
  info.inputLevel = v[4];
  info.hasOutputLevel = v[5] > 0.5;
  info.outputLevel = v[6];
  info.sampleRate = v[7];
  info.slimmable = v[8] > 0.5;
  info.latencyFrames = v[9];
  return true;
}

void Desktop::ClearCapture() { rig_stage_clear_model(); }

bool Desktop::StageIR(const std::vector<float>& samples, double sampleRate, double& seconds, std::string& error)
{
  if (samples.empty() || !(sampleRate > 0.0))
  {
    error = "This WAV has no sound in it.";
    return false;
  }
  try
  {
    auto ir = std::make_unique<dsp::ImpulseResponse>(dsp::ImpulseResponse::IRData{samples, sampleRate}, mSampleRate);
    mIRRaw = samples;
    mIRRawRate = sampleRate;
    seconds = static_cast<double>(samples.size()) / sampleRate;
    Stage<dsp::ImpulseResponse>(mPendingIR, ir.release());
    return true;
  }
  catch (const std::exception& e)
  {
    error = e.what();
  }
  return false;
}

void Desktop::ClearIR()
{
  mIRRaw.clear();
  mIRRawRate = 0.0;
  Stage<dsp::ImpulseResponse>(mPendingIR, ClearMark<dsp::ImpulseResponse>());
}

void Desktop::SetSource(Source s)
{
  if (s == Source::kDemo)
    mDemoRestart.store(true); // the riff starts from its top, as the web version's does
  mSource.store(static_cast<int>(s));
}

bool Desktop::SetDemo(const std::vector<float>& samples, double sampleRate, std::string& error)
{
  if (samples.empty() || !(sampleRate > 0.0))
  {
    error = "The demo riff has no sound in it.";
    return false;
  }
  mDemoRaw = samples;
  mDemoRawRate = sampleRate;
  BuildDemo();
  return true;
}

void Desktop::BuildDemo()
{
  if (mDemoRaw.empty())
    return;
  auto riff = std::make_unique<std::vector<float>>();
  if (mDemoRawRate == mSampleRate)
    *riff = mDemoRaw;
  else
    dsp::ResampleCubic<float>(mDemoRaw, mDemoRawRate, mSampleRate, 0.0, *riff);
  Stage<std::vector<float>>(mPendingDemo, riff.release());
}

void Desktop::Collect()
{
  rig_collect();
  delete mRetiredIR.exchange(nullptr, std::memory_order_acq_rel);
  delete mRetiredDemo.exchange(nullptr, std::memory_order_acq_rel);
}

Meters Desktop::TakeMeters()
{
  Meters m;
  m.input = mPeakIn.exchange(0.0f, std::memory_order_relaxed);
  m.raw = mPeakRaw.exchange(0.0f, std::memory_order_relaxed);
  m.output = mPeakOut.exchange(0.0f, std::memory_order_relaxed);
  return m;
}

void Desktop::ApplyChanges()
{
  // Never waits: if the UI holds the queue this instant, the changes go in at the next block.
  std::unique_lock<std::mutex> lock(mChangesLock, std::try_to_lock);
  if (!lock.owns_lock())
    return;
  mApplying.swap(mChanges);
  lock.unlock();
  for (const Change& c : mApplying)
    rig_set_param(c.id, c.value);
  mApplying.clear();
}

void Desktop::Process(double** inputs, int nInputs, double** outputs, int nOutputs, int nFrames)
{
  std::fenv_t fe;
  std::feholdexcept(&fe);
  disable_denormals();

  ApplyChanges();
  Take<dsp::ImpulseResponse>(mPendingIR, mIR, mRetiredIR);
  Take<std::vector<float>>(mPendingDemo, mDemo, mRetiredDemo);
  if (mDemoRestart.exchange(false))
    mDemoAt = 0;

  const Source source = static_cast<Source>(mSource.load(std::memory_order_relaxed));
  const bool standby = mStandby.load(std::memory_order_relaxed);
  const bool irOn = mIROn.load(std::memory_order_relaxed);
  const double step = 1.0 / std::max(1.0, kStandbySeconds * mSampleRate);
  float rawPeak = 0.0f, outPeak = 0.0f;

  for (int at = 0; at < nFrames;)
  {
    const int n = std::min(nFrames - at, mMaxBlock);
    float* in = rig_input();
    // The input: the driver's channels summed to mono (as the desktop always took them: one guitar in one input),
    // or the riff, or silence.
    for (int i = 0; i < n; i++)
    {
      double v = 0.0;
      if (source == Source::kLive)
        for (int c = 0; c < nInputs; c++)
          v += inputs[c][at + i];
      else if (source == Source::kDemo && mDemo && !mDemo->empty())
      {
        v = (*mDemo)[mDemoAt];
        if (++mDemoAt >= mDemo->size())
          mDemoAt = 0;
      }
      in[i] = static_cast<float>(v);
      rawPeak = std::max(rawPeak, static_cast<float>(std::fabs(v)));
    }

    rig_process(n);

    const float* out = rig_output();
    for (int i = 0; i < n; i++)
      mMono[static_cast<size_t>(i)] = out[i];
    double* wet = mMono.data();
    if (irOn && mIR)
      wet = mIR->Process(mMonoPtr.data(), 1, static_cast<size_t>(n))[0];
    for (int i = 0; i < n; i++)
    {
      // Standby: a straight 20 ms fade to silence and back.
      const double target = standby ? 0.0 : 1.0;
      if (mStandbyGain < target)
        mStandbyGain = std::min(target, mStandbyGain + step);
      else if (mStandbyGain > target)
        mStandbyGain = std::max(target, mStandbyGain - step);
      const double v = wet[i] * mStandbyGain;
      mWet[static_cast<size_t>(i)] = std::isfinite(v) ? v : 0.0;
      outPeak = std::max(outPeak, static_cast<float>(std::fabs(mWet[static_cast<size_t>(i)])));
    }
    for (int c = 0; c < nOutputs; c++)
      std::copy(mWet.begin(), mWet.begin() + n, outputs[c] + at);
    at += n;
  }

  PeakInto(mPeakIn, rig_take_input_peak());
  PeakInto(mPeakRaw, rawPeak);
  PeakInto(mPeakOut, outPeak);
  std::feupdateenv(&fe);
}
} // namespace rig
