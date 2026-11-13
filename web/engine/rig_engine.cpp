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
// Slots (build plan R5, favourites on standby): the engine holds up to kSlots captures, built and warmed ahead of
// time, and plays one. A switch fades from one to the other over kSwitchMs: a crossfade, both captures playing (the
// desktop), or a dip, one at a time (out, then in: a browser, where two standard captures do not fit the audio thread).
// A capture is built without NAM Core's prewarm (which ran twice per load), then warmed: a little silence per block on
// the audio thread (kWarmRate frames per frame heard), so a load never stops the sound; or, off the audio thread, all at
// once (rig_stage_slot). A slot left behind by a switch is warmed again before it can be heard, so nothing of what it
// played last comes back. Held captures cost memory, not time: only the one heard (two during a crossfade) plays.
//
// Pedals (build plan R6, P3-UX U5): up to kPedals captures in series before the amp, each a stage that hears one slot or
// none (the signal passes through), switched as the amp is: a pedal stomped on or off, or swapped for another, fades over
// kSwitchMs. A dip happens only where two captures would otherwise play at once in a browser; a pedal turned on or off
// fades against the dry signal, which costs nothing. Each pedal has its own Drive (the level into its capture) and Level
// (out of it), in dB; its capture plays raw (no normalizing: what a pedal puts out is what the amp hears). The amp's
// input calibration stays at the input, before the pedals.
//
// Threading: everything here runs on the audio rendering thread, one block at a time; in a browser a capture is built
// on that thread too (rig_slot_load), as the page sends it. The desktop app (build plan R2, D-RIG-017) also compiles
// this file, natively, and its page talks to it from the UI thread while the driver's thread plays: for that, a native
// build adds rig_stage_slot and its kin (the end of this file), which build and warm a capture on the calling thread
// and hand it to rig_process to take. The wasm leaves them out.

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
// A capture plays at most this many frames per call (the worklet's quantum); a larger block is played in pieces. Its
// buffers are sized by it, so a capture held costs about an eighth of what 1024 frames would (R5).
constexpr int kModelBlock = 128;
constexpr double kDCBlockerFrequency = 5.0;
constexpr double kFadeSeconds = 0.02; // Standby's and the guard's fade (D-RIG-016 (c))
// Ten pads and two for whatever plays off them (the page's choice; R5), then two for each pedal (R6): the page keeps
// slots 0 to 11 for the amp and the rest for the pedals, though the engine lets any stage hear any slot not in another.
constexpr int kSlots = 20;
constexpr int kPedals = 4;
constexpr int kAmp = kPedals; // the stages: the pedals in the order the signal meets them, then the amp
constexpr int kNone = -1; // no capture: the dry signal, as the desktop always played it
constexpr int kNoRequest = -2;
constexpr double kHalfPi = 1.5707963267948966;

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
  kPlay, // any write asks to hear this slot (0 to kSlots - 1), or none (-1), as soon as it is warm (R5)
  kSwitchMode, // 0: a crossfade, both captures playing; 1: a dip, out and then in, one at a time
  kSwitchMs, // how long a switch takes, all of it (a dip spends half going out and half coming in)
  kWarmRate, // frames of silence warmed per frame heard (twice that while a switch waits; four times, and at least 1,
             // while nothing is heard)
  kPedal1, // any write asks pedal 1 to hear this slot, or none (-1: it passes the signal through); pedals 2 to 4 follow
  kPedalDrive1 = kPedal1 + kPedals, // each pedal's level into its capture, in dB
  kPedalLevel1 = kPedalDrive1 + kPedals, // and out of it
  kNumParams = kPedalLevel1 + kPedals
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
  kInfoReady, // rig_slot_info: warm, so a switch to it can start
  kInfoCount
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
  kStatusPlaying, // the slot heard (a switch's target from its first frame), or -1 for none
  kStatusHeld, // a bit per slot holding a capture
  kStatusReady, // a bit per slot holding a warm capture
  kStatusWanted, // a slot asked for and not yet warm (-2: none)
  kStatusSwitchAt, // when the amp's last switch began, in frames since rig_init
  kStatusSwitching, // 1 while the amp's switch fades
  kStatusPedals, // six bits a pedal, pedal 1 lowest: the slot it hears plus one (0: none) in five, and 1 while it fades
  kStatusPedalSwitchAt, // when a pedal's last switch began, in frames since rig_init
};

double DBToAmp(const double db) { return std::pow(10.0, db / 20.0); }

// A capture held in a slot, and how much silence it must still play. A capture built cold may not be heard until it is
// warm: its histories hold nothing any signal could have left, and it would thump. One warmed before, and warming again
// after a switch left it, may be heard at once: its histories are a real signal's (what it last played, then silence).
// `offset` is what it puts out for silence once warm (its biases'), taken off what it plays: two captures' offsets
// differ (NAM Core's standard WaveNet sits at -1.0e-3, A2 at -2.6e-3), and a switch would step from one to the other in
// front of the DC blocker, which makes a step a thump. The DC blocker took it off in steady playing anyway.
struct Slot
{
  std::unique_ptr<ResamplingNAM> model;
  int warmLeft = 0;
  bool warmedOnce = false;
  double offset = 0.0;
  bool Ready() const { return model && (warmLeft <= 0 || warmedOnce); }
  void Warmed()
  {
    warmLeft = 0;
    warmedOnce = true;
    offset = model->SilenceLevel();
  }
};

// A place in the chain that hears one slot or none: a pedal, or the amp (R6). A switch fades from the slot it heard to
// the one asked for, as the amp's always did (R5).
struct Stage
{
  int playing = kNone; // the slot heard; during a switch, the one coming in
  int from = kNone; // during a switch, the one going out (kNone: the dry signal)
  bool switching = false;
  bool dip = false; // this switch is a dip
  int switchAt = 0; // frames into this switch
  int switchLen = 0; // its length, in frames
  int want = kNoRequest; // a slot asked for, waiting until it is warm
  uint64_t switchStarted = 0;
  bool Has(const int s) const { return s >= 0 && (s == playing || (switching && s == from)); }
};

struct Engine
{
  double sampleRate = 48000.0;
  // The pedals' parameters start at 0: a request reads nothing stored, and 0 dB is each pedal's Drive and Level.
  double params[kNumParams] = {0.0, 1.0, -80.0, 1.0, 5.0, 5.0, 5.0, 0.0, 1.0, 0.0, 12.0, 0.0, 0.0, 1.0, 1.0, 0.0,
                               -1.0, 0.0, 30.0, 0.25};

  Slot slots[kSlots];
  Stage stages[kPedals + 1];
  Stage& amp = stages[kAmp];

  dsp::noise_gate::Trigger gateTrigger;
  dsp::noise_gate::Gain gateGain;
  dsp::tone_stack::BasicNamToneStack toneStack;
  recursive_linear_filter::HighPass highPass;

  // The worklet writes mono input here and reads mono output from here (float, as Web Audio's buffers are).
  float inBlock[kMaxBlock] = {};
  float outBlock[kMaxBlock] = {};
  // The DSP runs in NAM_SAMPLE / DSP_SAMPLE (double, as on the desktop). `aside` holds the outgoing capture's sound
  // during a crossfade; `scaled` a capture's input when it is scaled (an input calibration that differs from the one
  // coming in, or a pedal's Drive); `pedalA` and `pedalB` the pedals' sound, one stage after another.
  std::vector<NAM_SAMPLE> in, out, aside, scaled, pedalA, pedalB;
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
    aside.assign(kMaxBlock, 0.0);
    scaled.assign(kMaxBlock, 0.0);
    pedalA.assign(kMaxBlock, 0.0);
    pedalB.assign(kMaxBlock, 0.0);
    inPtr[0] = in.data();
    outPtr[0] = out.data();
    gateTrigger.AddListener(&gateGain);
  }

  // A host resets with its audio stopped: every capture held is reset at the new rate and warmed there and then, and a
  // switch under way ends where it was going.
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
    for (Slot& s : slots)
      if (s.model)
      {
        s.model->SetPrewarmOnReset(false);
        s.model->Reset(sampleRate, kModelBlock);
        s.model->SetPrewarmOnReset(true);
        s.model->PlaySilence(s.model->WarmFrames());
        s.Warmed();
      }
    for (Stage& st : stages)
    {
      st.switching = false;
      st.from = kNone;
    }
  }

  void ApplyToneStack()
  {
    toneStack.SetParam("bass", params[kBass]);
    toneStack.SetParam("middle", params[kMiddle]);
    toneStack.SetParam("treble", params[kTreble]);
  }

  bool HasCapture(const int s) const { return s >= 0 && slots[s].model != nullptr; }
  // A slot heard, or fading, in any stage: it may not be loaded, cleared or warmed.
  bool Busy(const int s) const
  {
    for (const Stage& st : stages)
      if (st.Has(s))
        return true;
    return false;
  }
  // A capture plays in one place at a time: its histories are one signal's.
  bool HeldElsewhere(const int s, const Stage& here) const
  {
    for (const Stage& st : stages)
      if (&st != &here && st.Has(s))
        return true;
    return false;
  }
  bool AnySwitching() const
  {
    for (const Stage& st : stages)
      if (st.switching)
        return true;
    return false;
  }

  // The input calibration a capture asks for, as a gain: 1 unless calibrating and it knows its input level.
  double InputCal(const int s) const
  {
    if (s < 0 || !slots[s].model || params[kCalibrateInput] <= 0.5 || !slots[s].model->HasInputLevel())
      return 1.0;
    return DBToAmp(params[kInputCalibrationDBu] - slots[s].model->GetInputLevel());
  }

  // A capture's own part of the output gain: normalized to -18 dB, or calibrated (the desktop's output modes). Applied
  // to its own sound, before the gate's gain, the EQ and the DC blocker, which are linear: the same as after them, and
  // two captures in a crossfade each keep their own.
  double OutputNorm(const int s) const
  {
    if (s < 0 || !slots[s].model)
      return 1.0;
    ResamplingNAM* m = slots[s].model.get();
    const int mode = static_cast<int>(params[kOutputMode]);
    if (mode == 1 && m->HasLoudness())
      return DBToAmp(-18.0 - m->GetLoudness());
    if (mode == 2 && m->HasOutputLevel())
      return DBToAmp(m->GetOutputLevel() - params[kInputCalibrationDBu]);
    return 1.0;
  }

  void ApplySlim(const int s)
  {
    if (s >= 0 && slots[s].model)
      if (nam::SlimmableModel* sm = slots[s].model->GetSlimmableModel())
        sm->SetSlimmableSize(params[kSlim]);
  }

  // Plays n frames of src through slot s (the dry signal for none) into dst, its input scaled by inScale and its sound
  // by outScale (the amp's own output gain, or a pedal's Level); the dry signal is neither.
  void Run(const int s, NAM_SAMPLE* src, NAM_SAMPLE* dst, const double inScale, const double outScale, const int n)
  {
    if (!HasCapture(s))
    {
      std::copy(src, src + n, dst);
      return;
    }
    NAM_SAMPLE* x = src;
    if (inScale != 1.0)
    {
      for (int i = 0; i < n; i++)
        scaled[i] = inScale * src[i];
      x = scaled.data();
    }
    for (int at = 0; at < n; at += kModelBlock)
    {
      NAM_SAMPLE* ip[1] = {x + at};
      NAM_SAMPLE* op[1] = {dst + at};
      slots[s].model->process(ip, op, std::min(kModelBlock, n - at));
    }
    const double offset = slots[s].offset;
    for (int i = 0; i < n; i++)
      dst[i] = outScale * (dst[i] - offset);
  }

  // A switch asked for starts at the start of a block, once its capture is warm. It is a dip only where two captures
  // would play at once (a browser's switch mode, and a capture on both sides); against the dry signal it is a crossfade.
  void TakeRequest(Stage& st, const bool isAmp)
  {
    if (st.switching || st.want == kNoRequest)
      return;
    const int to = st.want;
    if (to == st.playing || (to != kNone && HeldElsewhere(to, st)))
    {
      st.want = kNoRequest;
      return;
    }
    if (to != kNone && !slots[to].Ready())
      return;
    st.want = kNoRequest;
    st.from = st.playing;
    st.playing = to;
    if (isAmp)
      ApplySlim(to);
    st.switching = true;
    st.dip = params[kSwitchMode] > 0.5 && HasCapture(st.from) && HasCapture(to);
    st.switchAt = 0;
    st.switchLen = std::max(2, static_cast<int>(std::lround(std::clamp(params[kSwitchMs], 1.0, 500.0) / 1000.0 * sampleRate)));
    st.switchStarted = frames;
  }

  // The capture left behind is warmed again before it can be heard, so nothing of what it played last comes back.
  void EndSwitch(Stage& st)
  {
    if (HasCapture(st.from))
      slots[st.from].warmLeft = slots[st.from].model->WarmFrames();
    st.from = kNone;
    st.switching = false;
  }

  // Plays a stage: the slot it hears, or a switch's fade from one to the other. `inOf(s)` and `outOf(s)` scale a slot's
  // input and sound (Run).
  template <typename In, typename Out>
  void RunStage(Stage& st, NAM_SAMPLE* x, NAM_SAMPLE* dst, const int nFrames, In inOf, Out outOf)
  {
    if (!st.switching)
      Run(st.playing, x, dst, inOf(st.playing), outOf(st.playing), nFrames);
    else if (!st.dip)
    {
      // A crossfade: both play, the one going out on a cosine and the one coming in on a sine (equal power: two
      // different captures of one guitar are only partly alike, so neither dips in the middle).
      Run(st.from, x, aside.data(), inOf(st.from), outOf(st.from), nFrames);
      Run(st.playing, x, dst, inOf(st.playing), outOf(st.playing), nFrames);
      for (int i = 0; i < nFrames; i++)
      {
        const int at = st.switchAt + i;
        if (at >= st.switchLen)
          break;
        const double t = static_cast<double>(at) / st.switchLen;
        dst[i] = std::cos(t * kHalfPi) * aside[i] + std::sin(t * kHalfPi) * dst[i];
      }
      st.switchAt += nFrames;
      if (st.switchAt >= st.switchLen)
        EndSwitch(st);
    }
    else
    {
      // A dip: the one going out fades alone, then the one coming in fades in alone, from silence (it heard none of the
      // first half), each on a raised cosine; one capture plays at a time.
      const int half = st.switchLen / 2, rest = st.switchLen - half;
      int i = 0;
      while (i < nFrames)
      {
        if (st.switchAt < half)
        {
          const int k = std::min(nFrames - i, half - st.switchAt);
          Run(st.from, x + i, dst + i, inOf(st.from), outOf(st.from), k);
          for (int j = 0; j < k; j++)
            dst[i + j] *= 0.5 * (1.0 + std::cos(2.0 * kHalfPi * (st.switchAt + j) / half));
          st.switchAt += k;
          i += k;
        }
        else
        {
          const int k = nFrames - i;
          Run(st.playing, x + i, dst + i, inOf(st.playing), outOf(st.playing), k);
          for (int j = 0; j < k; j++)
          {
            const int at = st.switchAt - half + j;
            if (at < rest)
              dst[i + j] *= 0.5 * (1.0 - std::cos(2.0 * kHalfPi * at / rest));
          }
          st.switchAt += k;
          i += k;
        }
      }
      if (st.switchAt >= st.switchLen)
        EndSwitch(st);
    }
  }

  // Captures not heard play silence until they are warm: the one asked for first, then the rest in slot order. Each
  // frame heard earns kWarmRate frames of warming (more as below; none during a switch), spent in pieces of kModelBlock:
  // a capture's cost per call hardly depends on its length, so 32 frames a block cost nearly what 128 every fourth block
  // do, for a quarter of the warming.
  double warmCredit = 0.0;
  void Warm(const int n)
  {
    if (AnySwitching())
      return;
    bool cold = false;
    for (const Slot& s : slots)
      cold = cold || (s.model && s.warmLeft > 0);
    if (!cold)
    {
      warmCredit = 0.0;
      return;
    }
    // Faster while nothing can be heard to stumble (no capture in any stage, or the output faded out: standby, or
    // muted), and twice as fast while a switch waits for this warm (a click in the library, a pad not yet ready, a pedal).
    bool heard = false, waiting = false;
    for (const Stage& st : stages)
    {
      heard = heard || st.playing != kNone;
      waiting = waiting || (HasCapture(st.want) && !slots[st.want].Ready());
    }
    double rate = std::clamp(params[kWarmRate], 0.0, 64.0);
    if (!heard || fade <= 0.0)
      rate = std::max(4.0 * rate, 1.0);
    else if (waiting)
      rate *= 2.0;
    warmCredit = std::min(warmCredit + rate * n, 64.0 * kMaxBlock);
    const auto warmOne = [&](const int s) {
      Slot& sl = slots[s];
      while (warmCredit >= kModelBlock && sl.model && sl.warmLeft > 0 && !Busy(s))
      {
        const int k = std::min(kModelBlock, sl.warmLeft);
        sl.model->PlaySilence(k);
        sl.warmLeft -= k;
        warmCredit -= kModelBlock;
        if (sl.warmLeft <= 0)
          sl.Warmed();
      }
    };
    // the amp's request first, then the pedals' in chain order, then the rest in slot order
    if (amp.want >= 0)
      warmOne(amp.want);
    for (int k = 0; k < kPedals; k++)
      if (stages[k].want >= 0)
        warmOne(stages[k].want);
    for (int s = 0; s < kSlots && warmCredit >= kModelBlock; s++)
      warmOne(s);
  }

  void Process(const int nFrames)
  {
    for (int k = 0; k <= kAmp; k++)
      TakeRequest(stages[k], k == kAmp);
    const double calIn = InputCal(amp.playing);
    const double inGain = DBToAmp(params[kInputDB]) * calIn;
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

    NAM_SAMPLE* x = trigger[0];
    // The pedals, in series (R6): a pedal hearing nothing and not fading passes the signal on untouched.
    NAM_SAMPLE* bufs[2] = {pedalA.data(), pedalB.data()};
    int next = 0;
    for (int k = 0; k < kPedals; k++)
    {
      Stage& st = stages[k];
      if (!st.switching && !HasCapture(st.playing))
        continue;
      const double drive = DBToAmp(params[kPedalDrive1 + k]), level = DBToAmp(params[kPedalLevel1 + k]);
      RunStage(st, x, bufs[next], nFrames, [&](int) { return drive; }, [&](int) { return level; });
      x = bufs[next];
      next ^= 1;
    }
    // The amp: a capture's input calibration was applied at the input for the one heard; one going out keeps its own.
    RunStage(amp, x, out.data(), nFrames, [&](const int s) { return s == amp.playing ? 1.0 : InputCal(s) / calIn; },
             [&](const int s) { return OutputNorm(s); });

    NAM_SAMPLE** stage = gateOn ? gateGain.Process(outPtr, 1, nFrames) : outPtr;
    if (params[kEQOn] > 0.5)
      stage = toneStack.Process(stage, 1, nFrames);
    highPass.SetParams(recursive_linear_filter::HighPassParams(sampleRate, kDCBlockerFrequency));
    stage = highPass.Process(stage, 1, nFrames);

    const double outGain = DBToAmp(params[kOutputDB]);
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
    Warm(nFrames);
  }

  // The person turned the output back on: the mute lifts, and the guard and auto-off start listening afresh.
  void ClearTrip()
  {
    muted = rig_guard::Trip{};
    squeal.Clear();
    unplug.Clear();
  }

  // Puts a capture in a slot, replacing what was there (the slot must not be fading).
  void Place(const int s, std::unique_ptr<ResamplingNAM> m, const int warmLeft)
  {
    slots[s].model = std::move(m);
    slots[s].warmLeft = warmLeft;
    slots[s].warmedOnce = false;
    slots[s].offset = 0.0;
    if (warmLeft <= 0)
      slots[s].Warmed(); // the caller warmed it
    if (s == amp.playing)
      ApplySlim(s);
  }

  // Six bits a pedal (kStatusPedals).
  double PedalBits() const
  {
    int bits = 0;
    for (int k = 0; k < kPedals; k++)
      bits |= (((stages[k].playing + 1) & 31) | (stages[k].switching ? 32 : 0)) << (6 * k);
    return static_cast<double>(bits);
  }
};

Engine* gEngine = nullptr;
std::vector<char> gText; // a capture's JSON, written by the page before rig_slot_load or rig_load_model
std::vector<float> gWeights; // its weights, when the page took them out of the JSON (rig_weights_buffer)

// A capture's weights, taken out of its JSON by the page (engine.js's packCapture), go back in as numbers: every
// {"rig.f32": [at, count]} becomes the array of those floats. In WebAssembly, reading a decimal number runs in software
// 128-bit floats: 85% of a standard capture's 40 ms build was its 13,802 weights, which a browser's own JSON.parse reads,
// with everything else in the file, in 2.5 ms. The floats are the ones NAM Core would have read (decimal to double to
// float, both ways).
void PutWeightsBack(nlohmann::json& j)
{
  if (j.is_object())
  {
    const auto it = j.find("rig.f32");
    if (it != j.end() && j.size() == 1 && it->is_array() && it->size() == 2)
    {
      const size_t at = (*it)[0].get<size_t>(), n = (*it)[1].get<size_t>();
      if (at > gWeights.size() || n > gWeights.size() - at)
        throw std::runtime_error("The capture's weights are missing.");
      nlohmann::json numbers = nlohmann::json::array();
      auto& a = numbers.get_ref<nlohmann::json::array_t&>();
      a.reserve(n);
      for (size_t i = 0; i < n; i++)
        a.emplace_back(static_cast<double>(gWeights[at + i]));
      j = std::move(numbers);
      return;
    }
    for (auto& v : j)
      PutWeightsBack(v);
  }
  else if (j.is_array() && !j.empty() && !j.front().is_number())
    for (auto& v : j)
      PutWeightsBack(v);
}

// Builds a capture from its JSON at the engine's rate, cold: NAM Core's prewarm on construction and reset is held off
// (it ran twice), so a caller warms it once, by playing it WarmFrames() of silence. Prewarm on reset is turned back on
// for the model afterwards, so a later reset (the host's rate changing, a slimmable capture's size) warms as before.
std::unique_ptr<ResamplingNAM> BuildModel(const char* text, const size_t bytes)
{
  nlohmann::json config = nlohmann::json::parse(text, text + bytes);
  if (!gWeights.empty())
    PutWeightsBack(config);
  std::unique_ptr<ResamplingNAM> wrapped;
  {
    nam::ScopedPrewarmOnResetDefault cold(false);
    std::unique_ptr<nam::DSP> dsp = nam::get_dsp(config, nam::DspLoadOptions{false});
    dsp->SetPrewarmOnReset(false);
    if (dsp->NumInputChannels() != 1 || dsp->NumOutputChannels() != 1)
      throw std::runtime_error("A capture must have one input and one output channel; this one has "
                               + std::to_string(dsp->NumInputChannels()) + " in and "
                               + std::to_string(dsp->NumOutputChannels()) + " out.");
    wrapped = std::make_unique<ResamplingNAM>(std::move(dsp), gEngine->sampleRate, kModelBlock);
  }
  wrapped->SetPrewarmOnReset(true);
  return wrapped;
}

// Builds from gText, or says why not.
std::unique_ptr<ResamplingNAM> BuildFromText(const int bytes)
{
  std::unique_ptr<ResamplingNAM> m;
  try
  {
    m = BuildModel(gText.data(), static_cast<size_t>(bytes));
    gEngine->lastError.clear();
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
  std::vector<float>().swap(gWeights);
  return m;
}

double InfoOf(const Slot& slot, const int which)
{
  ResamplingNAM* m = slot.model.get();
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
    case kInfoReady: return slot.Ready() ? 1.0 : 0.0;
    default: return 0.0;
  }
}

bool ValidSlot(const int s) { return gEngine != nullptr && s >= 0 && s < kSlots; }

#if !defined(__EMSCRIPTEN__)
// The hand-over between a native host's UI thread and its audio thread, a pair of mailboxes per slot. gPending[s]
// holds a capture built and warmed by rig_stage_slot, or kClearModel, until rig_process takes it at the start of a
// block (once the slot is not fading). The capture it replaces goes to gRetired[s], which rig_collect frees on the UI
// thread, so the audio thread never frees a model unless two hand-overs to one slot land between collections.
ResamplingNAM* const kClearModel = reinterpret_cast<ResamplingNAM*>(static_cast<uintptr_t>(1));
std::atomic<ResamplingNAM*> gPending[kSlots] = {};
std::atomic<ResamplingNAM*> gRetired[kSlots] = {};

void TakePending()
{
  Engine& e = *gEngine;
  for (int s = 0; s < kSlots; s++)
  {
    if (gPending[s].load(std::memory_order_acquire) == nullptr)
      continue;
    // A slot heard and not fading is replaced at once, as one capture always was; one fading waits for its fade.
    bool fading = false;
    for (const Stage& st : e.stages)
      fading = fading || (st.switching && (s == st.from || s == st.playing));
    if (fading)
      continue;
    ResamplingNAM* next = gPending[s].exchange(nullptr, std::memory_order_acq_rel);
    ResamplingNAM* old = e.slots[s].model.release();
    if (next != kClearModel)
      e.Place(s, std::unique_ptr<ResamplingNAM>(next), 0);
    else
    {
      e.slots[s].warmLeft = 0;
      for (Stage& st : e.stages)
        if (s == st.playing)
          st.playing = kNone;
    }
    if (old != nullptr)
      delete gRetired[s].exchange(old, std::memory_order_acq_rel); // nullptr unless rig_collect fell behind
  }
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
  Engine& e = *gEngine;
  e.params[id] = value;
  if (id == kBass || id == kMiddle || id == kTreble)
    e.ApplyToneStack();
  if (id == kSlim)
    e.ApplySlim(e.amp.playing);
  if (id == kClearTrip)
    e.ClearTrip();
  if (id == kPlay || (id >= kPedal1 && id < kPedal1 + kPedals))
  {
    const int s = static_cast<int>(std::lround(value));
    e.stages[id == kPlay ? kAmp : id - kPedal1].want = s >= 0 && s < kSlots ? s : kNone;
  }
  // Turned off, or in standby: they forget what they were hearing, and start afresh when they listen again.
  if ((id == kGuardOn && value < 0.5) || (id == kStandby && value > 0.5))
    e.squeal.Clear();
  if ((id == kAutoOff && value < 0.5) || (id == kStandby && value > 0.5))
    e.unplug.Clear();
}

// A buffer the page writes a capture's text into, then calls rig_slot_load (or rig_load_model) with its length.
RIG_EXPORT char* rig_text_buffer(int bytes)
{
  if (bytes < 0)
    return nullptr;
  gText.assign(static_cast<size_t>(bytes) + 1, '\0');
  return gText.data();
}

// A buffer for a capture's weights, when the page took them out of its JSON (engine.js's packCapture): write them here
// and the JSON (with {"rig.f32": [at, count]} where each array was) into rig_text_buffer, then call rig_slot_load.
RIG_EXPORT float* rig_weights_buffer(int count)
{
  if (count < 0)
    return nullptr;
  gWeights.assign(static_cast<size_t>(count), 0.0f);
  return gWeights.data();
}

// Builds the capture in the text buffer into a slot, cold; the audio thread warms it a little per block (kWarmRate),
// and a switch to it (kPlay) starts once it is warm. 0: built. 1: not a capture this engine can play (rig_error says
// why). 2: the slot is heard or fading (switch away first).
RIG_EXPORT int rig_slot_load(int slot, int bytes)
{
  const bool bad = !ValidSlot(slot) || bytes <= 0 || static_cast<size_t>(bytes) >= gText.size();
  if (bad || gEngine->Busy(slot))
  {
    std::vector<char>().swap(gText);
    std::vector<float>().swap(gWeights);
    return bad ? 1 : 2;
  }
  std::unique_ptr<ResamplingNAM> m = BuildFromText(bytes);
  if (!m)
    return 1;
  const int warm = m->WarmFrames();
  gEngine->Place(slot, std::move(m), warm);
  return 0;
}

// Empties a slot. 0: done. 2: it is heard or fading.
RIG_EXPORT int rig_slot_clear(int slot)
{
  if (!ValidSlot(slot))
    return 1;
  if (gEngine->Busy(slot))
    return 2;
  gEngine->slots[slot] = Slot{};
  return 0;
}

// What a slot holds (the Info values, kInfoReady among them).
RIG_EXPORT double rig_slot_info(int slot, int which) { return ValidSlot(slot) ? InfoOf(gEngine->slots[slot], which) : 0.0; }

// The harness's load (web/engine/test.mjs, native_render.cpp, crbn-rig.exe --render): builds the capture into slot 0,
// warms it there and then, and plays it at once, with no fade. 0: loaded. 1: not a capture this engine can play.
RIG_EXPORT int rig_load_model(int bytes)
{
  if (gEngine == nullptr || bytes <= 0 || static_cast<size_t>(bytes) >= gText.size())
    return 1;
  std::unique_ptr<ResamplingNAM> m = BuildFromText(bytes);
  if (!m)
    return 1;
  m->PlaySilence(m->WarmFrames());
  Engine& e = *gEngine;
  if (e.amp.switching)
    e.EndSwitch(e.amp);
  if (e.amp.playing >= 0 && e.amp.playing != 0 && e.slots[e.amp.playing].model)
    e.slots[e.amp.playing].warmLeft = e.slots[e.amp.playing].model->WarmFrames();
  e.amp.playing = 0;
  e.amp.want = kNoRequest;
  e.Place(0, std::move(m), 0);
  return 0;
}

// The harness's look at one capture alone (web/engine/test.mjs's pedal cases, R6): plays rig_input through a slot, raw
// (no gain, gate, EQ, DC blocker or fade), into rig_output, so a chain can be built stage by stage for a reference.
// 0: played. 1: no warm capture there. 2: the slot is heard or fading.
RIG_EXPORT int rig_slot_render(int slot, int nFrames)
{
  if (!ValidSlot(slot) || nFrames <= 0 || nFrames > kMaxBlock)
    return 1;
  Engine& e = *gEngine;
  if (e.Busy(slot))
    return 2;
  if (!e.slots[slot].Ready())
    return 1;
  for (int i = 0; i < nFrames; i++)
    e.in[i] = static_cast<double>(e.inBlock[i]);
  e.Run(slot, e.in.data(), e.out.data(), 1.0, 1.0, nFrames);
  for (int i = 0; i < nFrames; i++)
    e.outBlock[i] = static_cast<float>(e.out[i]);
  return 0;
}

RIG_EXPORT const char* rig_error() { return gEngine ? gEngine->lastError.c_str() : ""; }

// The harness's clear: no capture at once, and slot 0 emptied.
RIG_EXPORT void rig_clear_model()
{
  if (gEngine == nullptr)
    return;
  Engine& e = *gEngine;
  if (e.amp.switching)
    e.EndSwitch(e.amp);
  e.amp.playing = kNone;
  e.amp.want = kNoRequest;
  e.slots[0] = Slot{};
}

// What the capture heard holds (the Info values).
RIG_EXPORT double rig_info(int which)
{
  if (gEngine == nullptr)
    return 0.0;
  static const Slot kEmpty{};
  return InfoOf(gEngine->amp.playing >= 0 ? gEngine->slots[gEngine->amp.playing] : kEmpty, which);
}

// The output's fade and what muted it, and the slots (the Status values).
RIG_EXPORT double rig_status(int which)
{
  if (gEngine == nullptr)
    return 0.0;
  const Engine& e = *gEngine;
  const auto mask = [&](const bool ready) {
    int bits = 0;
    for (int s = 0; s < kSlots; s++)
      if (ready ? e.slots[s].Ready() : static_cast<bool>(e.slots[s].model))
        bits |= 1 << s;
    return static_cast<double>(bits);
  };
  switch (which)
  {
    case kStatusMuted: return static_cast<double>(e.muted.why);
    case kStatusHz: return e.muted.hz;
    case kStatusTrips: return static_cast<double>(e.trips);
    case kStatusSeconds: return e.muted.seconds;
    case kStatusTripAt: return e.tripAt;
    case kStatusGain: return e.fade;
    case kStatusPlaying: return static_cast<double>(e.amp.playing);
    case kStatusHeld: return mask(false);
    case kStatusReady: return mask(true);
    case kStatusWanted: return static_cast<double>(e.amp.want);
    case kStatusSwitchAt: return static_cast<double>(e.amp.switchStarted);
    case kStatusSwitching: return e.amp.switching ? 1.0 : 0.0;
    case kStatusPedals: return e.PedalBits();
    case kStatusPedalSwitchAt:
    {
      uint64_t at = 0;
      for (int k = 0; k < kPedals; k++)
        at = std::max(at, e.stages[k].switchStarted);
      return static_cast<double>(at);
    }
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
// ---- a native host's capture hand-over (the desktop app, R2; slots since R5) ---------------------------------------
// Builds a capture from its JSON on the calling thread, at the engine's rate, warms it there, and leaves it in the
// slot's mailbox for rig_process to take at the start of a block (once the slot is not fading). Returns 0 with `info`
// filled (the Info values, kInfoCount of them), or 1 with `error` filled (NUL-terminated, at most errorBytes). A capture
// staged and not yet taken is replaced. Call it from one thread, never while rig_init runs (a host resets with its audio
// stopped).
RIG_EXPORT int rig_stage_slot(int slot, const char* text, int bytes, double* info, char* error, int errorBytes)
{
  std::string why;
  if (!ValidSlot(slot) || text == nullptr || bytes <= 0)
    why = "The engine is not running.";
  else
  {
    try
    {
      Slot built;
      built.model = BuildModel(text, static_cast<size_t>(bytes));
      built.model->PlaySilence(built.model->WarmFrames());
      if (info != nullptr)
        for (int k = 0; k < kInfoCount; k++)
          info[k] = InfoOf(built, k);
      ResamplingNAM* was = gPending[slot].exchange(built.model.release(), std::memory_order_acq_rel);
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

// Empties a slot at the start of rig_process's next block (once it is not fading); a capture staged there and not yet
// taken is dropped. A slot heard is emptied at once, and the dry signal plays: switch away first (kPlay) for a fade.
RIG_EXPORT void rig_stage_clear_slot(int slot)
{
  if (!ValidSlot(slot))
    return;
  ResamplingNAM* was = gPending[slot].exchange(kClearModel, std::memory_order_acq_rel);
  if (was != kClearModel)
    delete was;
}

// Frees the captures rig_process last replaced; call it from the thread that stages (the desktop's UI, about 50 times
// a second).
RIG_EXPORT void rig_collect()
{
  for (std::atomic<ResamplingNAM*>& r : gRetired)
    delete r.exchange(nullptr, std::memory_order_acq_rel);
}
#endif
