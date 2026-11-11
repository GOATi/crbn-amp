// CRBN Rig's web engine (crbn-launcher D-CRBN-021 (d)): the desktop standalone's mono signal chain,
// NeuralAmpModeler::ProcessBlock, without iPlug2, behind a small C API that the AudioWorklet in
// web/src/rig-processor.js drives. Compiled to standalone WebAssembly by web/engine/build.mjs.
//
// The chain, as the desktop runs it:
//   input gain (+ input calibration) -> noise gate trigger -> the capture (resampled to its own rate, as the desktop
//   does) -> noise gate gain -> tone stack (bass, middle, treble) -> DC blocker (5 Hz high-pass) -> output gain
//   (raw, normalized to -18 dB, or calibrated).
// Then the output's fade (build plan R3): Standby, the squeal guard and auto-off (rig_guard.h) fade it out over 20 ms,
// and back in. The cabinet IR is applied after this, by the page's ConvolverNode in a browser and by AudioDSPTools'
// ImpulseResponse in the desktop app, scaled and truncated as the desktop always did; it is linear, so it commutes with
// the DC blocker, the output gain and the fade (its tail rings out after a fade, as a cabinet's would). The final clamp
// to [-1, 1] is the audio device's.
//
// Threading: everything here runs on the audio rendering thread, one block at a time. A capture is parsed on that
// thread when the page sends it (a few milliseconds of silence while it loads, as on the desktop).
// The desktop app (build plan R2, D-RIG-017) also compiles this file, natively, and its page talks to it from the UI
// thread while the driver's thread plays: for that, a native build adds rig_stage_model and its kin (the end of this
// file), which build a capture on the calling thread and hand it to rig_process to swap in. The wasm leaves them out.

#include <algorithm>
#if !defined(__EMSCRIPTEN__)
  #include <atomic>
#endif
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <string>
#include <vector>

#include "../../NeuralAmpModelerCore/NAM/activations.h"
#include "../../NeuralAmpModelerCore/NAM/get_dsp.h"
#include "../../NeuralAmpModeler/ResamplingNAM.h"
#include "../../NeuralAmpModeler/ToneStack.h"
#include "../../AudioDSPTools/dsp/NoiseGate.h"
#include "../../AudioDSPTools/dsp/RecursiveLinearFilter.h"
#include "rig_guard.h"

// Exported from the wasm; plain C linkage when web/engine/test.mjs builds this file natively for the parity check.
#if defined(__clang__) || defined(__GNUC__)
  #define RIG_EXPORT extern "C" __attribute__((used, visibility("default")))
#else
  #define RIG_EXPORT extern "C"
#endif

namespace
{
// The worklet's render quantum is 128 frames; the engine accepts up to this many per call.
constexpr int kMaxBlock = 1024;
constexpr double kDCBlockerFrequency = 5.0;
constexpr double kFadeSeconds = 0.02; // Standby's and the guard's fade (D-RIG-016 (c))

// Parameter ids, shared with rig-processor.js.
enum Param : int
{
  kInputDB = 0,
  kGateOn,
  kGateThresholdDB,
  kEQOn,
  kBass,
  kMiddle,
  kTreble,
  kOutputDB,
  kOutputMode, // 0 raw, 1 normalized, 2 calibrated
  kCalibrateInput,
  kInputCalibrationDBu,
  kSlim,
  kStandby, // 1: the output fades out; the input stays open (build plan R3)
  kGuardOn, // the squeal guard, on by default (D-RIG-008 (e))
  kAutoOff, // muted on the signature of a pulled jack
  kClearTrip, // any write: the person turned the output back on, so the guard's or auto-off's mute lifts
  kNumParams
};

// What rig_info reports about the loaded capture.
enum Info : int
{
  kInfoLoaded = 0,
  kInfoHasLoudness,
  kInfoLoudness,
  kInfoHasInputLevel,
  kInfoInputLevel,
  kInfoHasOutputLevel,
  kInfoOutputLevel,
  kInfoModelSampleRate,
  kInfoSlimmable,
  kInfoLatencyFrames,
};

// What rig_status reports about the output's fade.
enum Status : int
{
  kStatusMuted = 0, // rig_guard::Why: 0 none, 1 the squeal guard, 2 auto-off on silence, 3 auto-off on hum
  kStatusHz, // the squeal's frequency, or the mains frequency
  kStatusTrips, // how many times the guard or auto-off has muted the output since rig_init
  kStatusSeconds, // how long the squeal held, or how long after the spike auto-off tripped
  kStatusTripAt, // when it last tripped, in seconds of audio since rig_init
  kStatusGain, // the fade's gain now, 0 to 1
};

double DBToAmp(const double db) { return std::pow(10.0, db / 20.0); }

struct Engine
{
  double sampleRate = 48000.0;
  double params[kNumParams] = {0.0, 1.0, -80.0, 1.0, 5.0, 5.0, 5.0, 0.0, 1.0, 0.0, 12.0, 0.0, 0.0, 1.0, 1.0, 0.0};

  std::unique_ptr<ResamplingNAM> model;
  dsp::noise_gate::Trigger gateTrigger;
  dsp::noise_gate::Gain gateGain;
  dsp::tone_stack::BasicNamToneStack toneStack;
  recursive_linear_filter::HighPass highPass;

  // The worklet writes mono input here and reads mono output from here (float, as Web Audio's buffers are).
  float inBlock[kMaxBlock] = {};
  float outBlock[kMaxBlock] = {};
  // The DSP runs in NAM_SAMPLE / DSP_SAMPLE (double, as on the desktop).
  std::vector<NAM_SAMPLE> in, out;
  NAM_SAMPLE* inPtr[1] = {nullptr};
  NAM_SAMPLE* outPtr[1] = {nullptr};

  float inputPeak = 0.0f; // after the input gain, since the last read
  std::string lastError;

  // The output's fade, and what muted it (rig_guard.h).
  rig_guard::SquealGuard squeal;
  rig_guard::UnplugWatch unplug;
  rig_guard::Trip muted;
  double fade = 1.0;
  int trips = 0;
  double tripAt = 0.0;
  uint64_t frames = 0; // audio since rig_init

  Engine()
  {
    in.assign(kMaxBlock, 0.0);
    out.assign(kMaxBlock, 0.0);
    inPtr[0] = in.data();
    outPtr[0] = out.data();
    gateTrigger.AddListener(&gateGain);
  }

  void Reset(const double sr)
  {
    sampleRate = sr;
    squeal.Reset(sampleRate);
    unplug.Reset(sampleRate);
    muted = rig_guard::Trip{};
    fade = params[kStandby] > 0.5 ? 0.0 : 1.0;
    frames = 0;
    toneStack.Reset(sampleRate, kMaxBlock);
    ApplyToneStack();
    if (model)
      model->Reset(sampleRate, kMaxBlock);
  }

  void ApplyToneStack()
  {
    toneStack.SetParam("bass", params[kBass]);
    toneStack.SetParam("middle", params[kMiddle]);
    toneStack.SetParam("treble", params[kTreble]);
  }

  double InputGain() const
  {
    double db = params[kInputDB];
    if (model && model->HasInputLevel() && params[kCalibrateInput] > 0.5)
      db += params[kInputCalibrationDBu] - model->GetInputLevel();
    return DBToAmp(db);
  }

  double OutputGain() const
  {
    double db = params[kOutputDB];
    if (model)
    {
      const int mode = static_cast<int>(params[kOutputMode]);
      if (mode == 1 && model->HasLoudness())
        db += -18.0 - model->GetLoudness();
      else if (mode == 2 && model->HasOutputLevel())
        db += model->GetOutputLevel() - params[kInputCalibrationDBu];
    }
    return DBToAmp(db);
  }

  void ApplySlim()
  {
    if (model)
      if (nam::SlimmableModel* s = model->GetSlimmableModel())
        s->SetSlimmableSize(params[kSlim]);
  }

  void Process(const int nFrames)
  {
    const double inGain = InputGain();
    float peak = inputPeak;
    for (int i = 0; i < nFrames; i++)
    {
      in[i] = inGain * static_cast<double>(inBlock[i]);
      peak = std::max(peak, static_cast<float>(std::fabs(in[i])));
    }
    inputPeak = peak;

    const bool gateOn = params[kGateOn] > 0.5;
    NAM_SAMPLE** trigger = inPtr;
    if (gateOn)
    {
      // The desktop's gate settings (NeuralAmpModeler::ProcessBlock).
      const dsp::noise_gate::TriggerParams tp(0.01, params[kGateThresholdDB], 0.1, 0.005, 0.01, 0.05);
      gateTrigger.SetParams(tp);
      gateTrigger.SetSampleRate(sampleRate);
      trigger = gateTrigger.Process(inPtr, 1, nFrames);
    }

    if (model)
      model->process(trigger, outPtr, nFrames);
    else
      std::copy(trigger[0], trigger[0] + nFrames, out.begin()); // no capture: the dry signal, as the desktop does

    NAM_SAMPLE** stage = gateOn ? gateGain.Process(outPtr, 1, nFrames) : outPtr;
    if (params[kEQOn] > 0.5)
      stage = toneStack.Process(stage, 1, nFrames);
    highPass.SetParams(recursive_linear_filter::HighPassParams(sampleRate, kDCBlockerFrequency));
    stage = highPass.Process(stage, 1, nFrames);

    const double outGain = OutputGain();
    const bool standby = params[kStandby] > 0.5;
    const bool guardOn = params[kGuardOn] > 0.5, autoOff = params[kAutoOff] > 0.5;
    const double step = 1.0 / std::max(1.0, kFadeSeconds * sampleRate);
    for (int i = 0; i < nFrames; i++)
    {
      // A straight 20 ms fade to silence while in standby or muted, and back.
      const double target = standby || muted.why != rig_guard::kNone ? 0.0 : 1.0;
      fade = fade < target ? std::min(target, fade + step) : std::max(target, fade - step);
      // The guard hears what leaves (so a muted output cannot keep it tripping) beside what arrived. Neither it nor
      // auto-off listens in standby, when the output is quiet by choice and cables may be changing, nor once muted, until
      // the person says. While it asks whether a tone is a loop, it dips the output 4 dB for 50 ms (rig_guard.h).
      const bool listening = !standby && muted.why == rig_guard::kNone;
      double v = outGain * stage[0][i] * fade * (listening && guardOn ? squeal.Dip() : 1.0);
      if (!std::isfinite(v))
        v = 0.0;
      outBlock[i] = static_cast<float>(v);
      if (listening)
      {
        rig_guard::Trip t;
        if ((guardOn && squeal.Push(static_cast<double>(inBlock[i]), static_cast<double>(outBlock[i]), t))
            || (autoOff && unplug.Push(static_cast<double>(inBlock[i]), t)))
        {
          muted = t;
          trips++;
          tripAt = static_cast<double>(frames + static_cast<uint64_t>(i) + 1) / sampleRate;
        }
      }
    }
    frames += static_cast<uint64_t>(nFrames);
  }

  // The person turned the output back on: the mute lifts, and the guard and auto-off start listening afresh.
  void ClearTrip()
  {
    muted = rig_guard::Trip{};
    squeal.Clear();
    unplug.Clear();
  }
};

Engine* gEngine = nullptr;
std::vector<char> gText; // the capture's JSON, written by the page before rig_load_model

// Builds a capture from its JSON at the engine's rate: the one path rig_load_model and rig_stage_model share.
std::unique_ptr<ResamplingNAM> BuildModel(const char* text, const size_t bytes)
{
  const nlohmann::json config = nlohmann::json::parse(text, text + bytes);
  std::unique_ptr<nam::DSP> dsp = nam::get_dsp(config);
  if (dsp->NumInputChannels() != 1 || dsp->NumOutputChannels() != 1)
    throw std::runtime_error("A capture must have one input and one output channel; this one has "
                             + std::to_string(dsp->NumInputChannels()) + " in and "
                             + std::to_string(dsp->NumOutputChannels()) + " out.");
  auto wrapped = std::make_unique<ResamplingNAM>(std::move(dsp), gEngine->sampleRate);
  wrapped->Reset(gEngine->sampleRate, kMaxBlock);
  return wrapped;
}

#if !defined(__EMSCRIPTEN__)
// The hand-over between a native host's UI thread and its audio thread. gPending holds a capture built by
// rig_stage_model, or kClearModel, until rig_process takes it at the start of a block. The capture it replaces goes to
// gRetired, which rig_collect frees on the UI thread, so the audio thread never frees a model unless two swaps land
// between collections.
ResamplingNAM* const kClearModel = reinterpret_cast<ResamplingNAM*>(static_cast<uintptr_t>(1));
std::atomic<ResamplingNAM*> gPending{nullptr};
std::atomic<ResamplingNAM*> gRetired{nullptr};

void TakePending()
{
  ResamplingNAM* next = gPending.exchange(nullptr, std::memory_order_acq_rel);
  if (next == nullptr)
    return;
  ResamplingNAM* old = gEngine->model.release();
  if (next != kClearModel)
  {
    gEngine->model.reset(next);
    gEngine->ApplySlim();
  }
  if (old != nullptr)
    delete gRetired.exchange(old, std::memory_order_acq_rel); // nullptr unless rig_collect fell behind
}
#endif
} // namespace

RIG_EXPORT int rig_init(double sampleRate)
{
  nam::activations::Activation::enable_fast_tanh();
  if (gEngine == nullptr)
    gEngine = new Engine();
#if !defined(__EMSCRIPTEN__)
  TakePending(); // a capture staged at the old rate is reset with the rest (a host resets with its audio stopped)
#endif
  gEngine->Reset(sampleRate);
  return kMaxBlock;
}

RIG_EXPORT float* rig_input() { return gEngine->inBlock; }
RIG_EXPORT float* rig_output() { return gEngine->outBlock; }

RIG_EXPORT void rig_process(int nFrames)
{
  if (gEngine == nullptr || nFrames <= 0)
    return;
#if !defined(__EMSCRIPTEN__)
  TakePending();
#endif
  gEngine->Process(std::min(nFrames, kMaxBlock));
}

RIG_EXPORT void rig_set_param(int id, double value)
{
  if (gEngine == nullptr || id < 0 || id >= kNumParams || !std::isfinite(value))
    return;
  gEngine->params[id] = value;
  if (id == kBass || id == kMiddle || id == kTreble)
    gEngine->ApplyToneStack();
  if (id == kSlim)
    gEngine->ApplySlim();
  if (id == kClearTrip)
    gEngine->ClearTrip();
  // Turned off, or in standby: they forget what they were hearing, and start afresh when they listen again.
  if ((id == kGuardOn && value < 0.5) || (id == kStandby && value > 0.5))
    gEngine->squeal.Clear();
  if ((id == kAutoOff && value < 0.5) || (id == kStandby && value > 0.5))
    gEngine->unplug.Clear();
}

// A buffer the page writes the capture's text into, then calls rig_load_model with its length.
RIG_EXPORT char* rig_text_buffer(int bytes)
{
  if (bytes < 0)
    return nullptr;
  gText.assign(static_cast<size_t>(bytes) + 1, '\0');
  return gText.data();
}

// 0: loaded. 1: not a capture this engine can play (rig_error says why).
RIG_EXPORT int rig_load_model(int bytes)
{
  if (gEngine == nullptr || bytes <= 0 || static_cast<size_t>(bytes) >= gText.size())
    return 1;
  try
  {
    gEngine->model = BuildModel(gText.data(), static_cast<size_t>(bytes));
    gEngine->ApplySlim();
    gEngine->lastError.clear();
    std::vector<char>().swap(gText);
    return 0;
  }
  catch (const std::exception& e)
  {
    gEngine->lastError = e.what();
  }
  catch (...)
  {
    gEngine->lastError = "The capture could not be read.";
  }
  std::vector<char>().swap(gText);
  return 1;
}

RIG_EXPORT const char* rig_error() { return gEngine ? gEngine->lastError.c_str() : ""; }

RIG_EXPORT void rig_clear_model()
{
  if (gEngine)
    gEngine->model.reset();
}

RIG_EXPORT double rig_info(int which)
{
  if (gEngine == nullptr)
    return 0.0;
  const auto& m = gEngine->model;
  switch (which)
  {
    case kInfoLoaded: return m ? 1.0 : 0.0;
    case kInfoHasLoudness: return m && m->HasLoudness() ? 1.0 : 0.0;
    case kInfoLoudness: return m && m->HasLoudness() ? m->GetLoudness() : 0.0;
    case kInfoHasInputLevel: return m && m->HasInputLevel() ? 1.0 : 0.0;
    case kInfoInputLevel: return m && m->HasInputLevel() ? m->GetInputLevel() : 0.0;
    case kInfoHasOutputLevel: return m && m->HasOutputLevel() ? 1.0 : 0.0;
    case kInfoOutputLevel: return m && m->HasOutputLevel() ? m->GetOutputLevel() : 0.0;
    case kInfoModelSampleRate: return m ? m->GetEncapsulatedSampleRate() : 0.0;
    case kInfoSlimmable: return m && m->GetSlimmableModel() ? 1.0 : 0.0;
    case kInfoLatencyFrames: return m ? static_cast<double>(m->GetLatency()) : 0.0;
    default: return 0.0;
  }
}

// The output's fade and what muted it (the Status values).
RIG_EXPORT double rig_status(int which)
{
  if (gEngine == nullptr)
    return 0.0;
  const Engine& e = *gEngine;
  switch (which)
  {
    case kStatusMuted: return static_cast<double>(e.muted.why);
    case kStatusHz: return e.muted.hz;
    case kStatusTrips: return static_cast<double>(e.trips);
    case kStatusSeconds: return e.muted.seconds;
    case kStatusTripAt: return e.tripAt;
    case kStatusGain: return e.fade;
    default: return 0.0;
  }
}

// The input peak (after the input gain) since the last call; reading resets it.
RIG_EXPORT float rig_take_input_peak()
{
  if (gEngine == nullptr)
    return 0.0f;
  const float p = gEngine->inputPeak;
  gEngine->inputPeak = 0.0f;
  return p;
}

#if !defined(__EMSCRIPTEN__)
// ---- a native host's capture hand-over (the desktop app, R2) -------------------------------------------------------
// Builds a capture from its JSON on the calling thread, at the engine's rate, and leaves it for rig_process to swap in
// at the start of its next block. Returns 0 with `info` filled (the Info values, kInfoLatencyFrames + 1 of them), or 1
// with `error` filled (NUL-terminated, at most errorBytes). A capture staged and not yet taken is replaced. Call it
// from one thread, never while rig_init runs (a host resets with its audio stopped).
RIG_EXPORT int rig_stage_model(const char* text, int bytes, double* info, char* error, int errorBytes)
{
  std::string why;
  if (gEngine == nullptr || text == nullptr || bytes <= 0)
    why = "The engine is not running.";
  else
  {
    try
    {
      std::unique_ptr<ResamplingNAM> m = BuildModel(text, static_cast<size_t>(bytes));
      if (info != nullptr)
      {
        info[kInfoLoaded] = 1.0;
        info[kInfoHasLoudness] = m->HasLoudness() ? 1.0 : 0.0;
        info[kInfoLoudness] = m->HasLoudness() ? m->GetLoudness() : 0.0;
        info[kInfoHasInputLevel] = m->HasInputLevel() ? 1.0 : 0.0;
        info[kInfoInputLevel] = m->HasInputLevel() ? m->GetInputLevel() : 0.0;
        info[kInfoHasOutputLevel] = m->HasOutputLevel() ? 1.0 : 0.0;
        info[kInfoOutputLevel] = m->HasOutputLevel() ? m->GetOutputLevel() : 0.0;
        info[kInfoModelSampleRate] = m->GetEncapsulatedSampleRate();
        info[kInfoSlimmable] = m->GetSlimmableModel() ? 1.0 : 0.0;
        info[kInfoLatencyFrames] = static_cast<double>(m->GetLatency());
      }
      ResamplingNAM* was = gPending.exchange(m.release(), std::memory_order_acq_rel);
      if (was != kClearModel)
        delete was; // staged and never taken
      return 0;
    }
    catch (const std::exception& e)
    {
      why = e.what();
    }
    catch (...)
    {
      why = "The capture could not be read.";
    }
  }
  if (error != nullptr && errorBytes > 0)
  {
    const size_t n = std::min(why.size(), static_cast<size_t>(errorBytes - 1));
    std::memcpy(error, why.data(), n);
    error[n] = '\0';
  }
  return 1;
}

// Clears the capture at the start of rig_process's next block (a capture staged and not yet taken is dropped).
RIG_EXPORT void rig_stage_clear_model()
{
  ResamplingNAM* was = gPending.exchange(kClearModel, std::memory_order_acq_rel);
  if (was != kClearModel)
    delete was;
}

// Frees the capture rig_process last replaced; call it from the thread that stages (the desktop's UI, about 50 times
// a second).
RIG_EXPORT void rig_collect() { delete gRetired.exchange(nullptr, std::memory_order_acq_rel); }
#endif
