// CRBN Rig's engine in the desktop app (crbn-launcher D-RIG-017, build plan R2): web/engine/rig_engine.cpp, the same
// engine the web version runs as WebAssembly, compiled into the standalone, with what the web version's audio graph
// does around it: the input (the driver's, or the demo riff), the cabinet IR, Standby's fade and the meters.
//
//   the driver's inputs, summed to mono, or the demo riff -> rig_engine (input gain, gate, capture, EQ, DC blocker,
//   output gain) -> the cabinet IR (AudioDSPTools' ImpulseResponse, as the desktop always applied it) -> Standby's
//   20 ms fade -> every output.
//
// Threads: the page's messages arrive on the UI thread, the audio on the driver's. The UI thread queues settings and
// builds captures, IRs and the riff; the audio thread takes them at the start of a block, never waiting (a try-lock
// and atomic hand-overs), and what it replaces is freed back on the UI thread by Collect.
#pragma once

#include <array>
#include <atomic>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

namespace dsp
{
class ImpulseResponse;
}

namespace rig
{
// What the page's capture panel shows of a capture (rig_engine.cpp's Info, as engine.js's captureInfo reads it).
struct CaptureInfo
{
  bool hasLoudness = false;
  double loudness = 0.0;
  bool hasInputLevel = false;
  double inputLevel = 0.0;
  bool hasOutputLevel = false;
  double outputLevel = 0.0;
  double sampleRate = 0.0;
  bool slimmable = false;
  double latencyFrames = 0.0;
};

struct Meters
{
  float input = 0.0f; // the input after the input gain (the page's input meter and the hardware's energy)
  float raw = 0.0f; // the input before it (a clip at the interface)
  float output = 0.0f; // what goes to the outputs
};

enum class Source : int
{
  kNone = 0, // silence in (stopped, or the power off)
  kLive = 1, // the driver's inputs
  kDemo = 2, // the demo riff, looped
};

class Desktop
{
public:
  Desktop();
  ~Desktop();
  Desktop(const Desktop&) = delete;
  Desktop& operator=(const Desktop&) = delete;

  // ---- UI thread
  // With the audio stopped (iPlug2's OnReset): the engine at this rate, and the IR and riff rebuilt for it.
  void Reset(double sampleRate);
  double SampleRate() const { return mSampleRate; }
  // A setting by the engine's parameter id (engine.js's PARAM), applied at the next block.
  void SetParam(int id, double value);
  bool StageCapture(const std::string& json, CaptureInfo& info, std::string& error);
  void ClearCapture();
  // A cabinet IR: its first channel at its own rate, as the page decoded the WAV (resampled, scaled and cut to 8192
  // samples here, as the desktop always did); `seconds` is its length.
  bool StageIR(const std::vector<float>& samples, double sampleRate, double& seconds, std::string& error);
  void ClearIR();
  void SetIROn(bool on) { mIROn.store(on); }
  void SetStandby(bool on) { mStandby.store(on); }
  void SetSource(Source s);
  Source GetSource() const { return static_cast<Source>(mSource.load()); }
  // The demo riff (the page's demo/di.wav, decoded by the page), resampled to the engine's rate.
  bool SetDemo(const std::vector<float>& samples, double sampleRate, std::string& error);
  bool HasDemo() const { return !mDemoRaw.empty(); }
  // Frees what the audio thread replaced; call it often (the idle timer).
  void Collect();
  // The peaks since the last call.
  Meters TakeMeters();

  // ---- audio thread
  void Process(double** inputs, int nInputs, double** outputs, int nOutputs, int nFrames);

private:
  struct Change
  {
    int id;
    double value;
  };
  void ApplyChanges();
  void BuildDemo();

  double mSampleRate = 48000.0;
  int mMaxBlock = 1024;

  // Settings, UI to audio.
  std::mutex mChangesLock;
  std::vector<Change> mChanges; // the UI's queue, under mChangesLock
  std::vector<Change> mApplying; // the audio thread's, swapped with mChanges (no allocation on the audio thread)

  // The cabinet IR: the UI keeps its samples to rebuild it at a new rate; the audio thread owns the one playing.
  std::vector<float> mIRRaw;
  double mIRRawRate = 0.0;
  std::atomic<dsp::ImpulseResponse*> mPendingIR{nullptr};
  std::atomic<dsp::ImpulseResponse*> mRetiredIR{nullptr};
  std::unique_ptr<dsp::ImpulseResponse> mIR;
  std::atomic<bool> mIROn{true};

  // The demo riff: its file's samples (UI), and the riff at the engine's rate (audio).
  std::vector<float> mDemoRaw;
  double mDemoRawRate = 0.0;
  std::atomic<std::vector<float>*> mPendingDemo{nullptr};
  std::atomic<std::vector<float>*> mRetiredDemo{nullptr};
  std::unique_ptr<std::vector<float>> mDemo;
  size_t mDemoAt = 0;
  std::atomic<bool> mDemoRestart{false};

  std::atomic<int> mSource{static_cast<int>(Source::kNone)};
  std::atomic<bool> mStandby{false};
  double mStandbyGain = 1.0;

  std::atomic<float> mPeakIn{0.0f}, mPeakRaw{0.0f}, mPeakOut{0.0f};

  std::vector<double> mMono, mWet;
  std::array<double*, 1> mMonoPtr{};
};
} // namespace rig
