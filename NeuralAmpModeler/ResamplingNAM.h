#pragma once

#include <algorithm>
#include <cmath>
#include <functional>
#include <memory>
#include <stdexcept>
#include <utility>
#include <vector>

#include "../iPlug2/IPlug/IPlugConstants.h"

// AudioDSPTools uses iPlug's constants without including their declarations.
#ifndef DEFAULT_BLOCK_SIZE
namespace dsp
{
using iplug::DEFAULT_BLOCK_SIZE;
}
#endif
#include "../AudioDSPTools/dsp/ResamplingContainer/ResamplingContainer.h"
#include "../NeuralAmpModelerCore/NAM/dsp.h"
#include "../NeuralAmpModelerCore/NAM/slimmable.h"

// Get the sample rate of a NAM model.
// Sometimes, the model doesn't know its own sample rate; this wrapper guesses 48k based on the way that most
// people have used NAM in the past.
inline double GetNAMSampleRate(const std::unique_ptr<nam::DSP>& model)
{
  // Some models are from when we didn't have sample rate in the model.
  // For those, this wraps with the assumption that they're 48k models, which is probably true.
  const double assumedSampleRate = 48000.0;
  const double reportedEncapsulatedSampleRate = model->GetExpectedSampleRate();
  const double encapsulatedSampleRate =
    reportedEncapsulatedSampleRate <= 0.0 ? assumedSampleRate : reportedEncapsulatedSampleRate;
  return encapsulatedSampleRate;
};

class ResamplingNAM : public nam::DSP
{
public:
  // Resampling wrapper around the NAM models
  // CRBN Rig passes maxBlockSize: the block it will never exceed (its engine plays 128 frames at a time), since sizing
  // the model for 2048 first costs a capture's build time and memory for nothing.
  ResamplingNAM(std::unique_ptr<nam::DSP> encapsulated, const double expected_sample_rate, const int maxBlockSize = 2048)
  : nam::DSP(encapsulated->NumInputChannels(), encapsulated->NumOutputChannels(), expected_sample_rate)
  , mEncapsulated(std::move(encapsulated))
  , mSupportsArbitrarySampleRate(mEncapsulated->SupportsArbitrarySampleRate())
  , mResampler(GetNAMSampleRate(mEncapsulated))
  {
    // Assign the encapsulated object's processing function  to this object's member so that the resampler can use it:
    auto ProcessBlockFunc = [&](NAM_SAMPLE** input, NAM_SAMPLE** output, int numFrames) {
      mEncapsulated->process(input, output, numFrames);
    };
    mBlockProcessFunc = ProcessBlockFunc;

    // Get the other information from the encapsulated NAM so that we can tell the outside world about what we're
    // holding.
    if (mEncapsulated->HasLoudness())
    {
      SetLoudness(mEncapsulated->GetLoudness());
    }
    if (mEncapsulated->HasInputLevel())
    {
      SetInputLevel(mEncapsulated->GetInputLevel());
    }
    if (mEncapsulated->HasOutputLevel())
    {
      SetOutputLevel(mEncapsulated->GetOutputLevel());
    }

    // NOTE: prewarm samples doesn't mean anything--we can prewarm the encapsulated model as it likes and be good to
    // go.
    // _prewarm_samples = 0;

    // And be ready
    Reset(expected_sample_rate, maxBlockSize);
  };

  ~ResamplingNAM() = default;

  void prewarm() override { mEncapsulated->prewarm(); };

  // CRBN Rig (build plan R5): the engine builds a capture without NAM Core's prewarm on reset (it ran twice per load),
  // then warms it once, all at once off the audio thread or a little per block on it (rig_engine.cpp's slots).
  void SetPrewarmOnReset(const bool prewarmOnReset) override
  {
    nam::DSP::SetPrewarmOnReset(prewarmOnReset);
    mEncapsulated->SetPrewarmOnReset(prewarmOnReset);
  }

  // Frames of silence, at the host's rate, that leave the model and the resampler as a prewarm leaves them: every
  // history holds what silence makes of it, so an earlier signal can no longer be heard.
  int WarmFrames()
  {
    const double modelRate = mSupportsArbitrarySampleRate ? GetExpectedSampleRate() : GetEncapsulatedSampleRate();
    const double ratio = modelRate > 0.0 ? GetExpectedSampleRate() / modelRate : 1.0;
    return static_cast<int>(std::ceil(mEncapsulated->GetPrewarmSamples() * ratio)) + GetLatency() + 1;
  }

  // Plays `frames` of silence through the model (and the resampler), in blocks no larger than Reset allowed.
  // Allocates nothing: the buffers are Reset's.
  void PlaySilence(int frames)
  {
    NAM_SAMPLE* in[1] = {mSilence.data()};
    NAM_SAMPLE* out[1] = {mSink.data()};
    while (frames > 0)
    {
      const int n = std::min(frames, mMaxExternalBlockSize);
      process(in, out, n);
      mSilenceLevel = mSink[static_cast<size_t>(n - 1)];
      frames -= n;
    }
  }

  // What the model last put out for silence: once warm, its constant answer to silence (its biases' offset).
  NAM_SAMPLE SilenceLevel() const { return mSilenceLevel; }

  void process(NAM_SAMPLE** input, NAM_SAMPLE** output, const int num_frames) override
  {
    if (num_frames > mMaxExternalBlockSize)
      // We can afford to be careful
      throw std::runtime_error("More frames were provided than the max expected!");

    if (!NeedToResample())
    {
      mEncapsulated->process(input, output, num_frames);
    }
    else
    {
      mResampler.ProcessBlock(input, output, num_frames, mBlockProcessFunc);
    }
  };

  int GetLatency() const { return NeedToResample() ? mResampler.GetLatency() : 0; };

  void Reset(const double sampleRate, const int maxBlockSize) override
  {
    mExpectedSampleRate = sampleRate;
    mMaxExternalBlockSize = maxBlockSize;
    mSilence.assign(static_cast<size_t>(std::max(1, maxBlockSize)), 0.0);
    mSink.assign(mSilence.size(), 0.0);
    // Adaptive models convert their own coefficients to the host rate. Fixed-rate models must be reset at the
    // rate of the audio they will actually receive, including Linear children inside a Sequential model.
    const double modelSampleRate = mSupportsArbitrarySampleRate ? sampleRate : GetEncapsulatedSampleRate();
    int maxEncapsulatedBlockSize = maxBlockSize;
    if (NeedToResample())
    {
      mResampler.Reset(sampleRate, maxBlockSize);
      maxEncapsulatedBlockSize =
        static_cast<int>(std::ceil(static_cast<double>(maxBlockSize) * modelSampleRate / sampleRate));
    }
    mEncapsulated->Reset(modelSampleRate, maxEncapsulatedBlockSize);
  };

  // So that we can let the world know if we're resampling (useful for debugging)
  double GetEncapsulatedSampleRate() const { return GetNAMSampleRate(mEncapsulated); };

  nam::SlimmableModel* GetSlimmableModel() { return dynamic_cast<nam::SlimmableModel*>(mEncapsulated.get()); }
  const nam::SlimmableModel* GetSlimmableModel() const
  {
    return dynamic_cast<const nam::SlimmableModel*>(mEncapsulated.get());
  }

private:
  bool NeedToResample() const
  {
    return !mSupportsArbitrarySampleRate && GetExpectedSampleRate() != GetEncapsulatedSampleRate();
  };
  // The encapsulated NAM
  std::unique_ptr<nam::DSP> mEncapsulated;
  const bool mSupportsArbitrarySampleRate;

  // The resampling wrapper
  dsp::ResamplingContainer<NAM_SAMPLE, 1, 12> mResampler;

  // Used to check that we don't get too large a block to process.
  int mMaxExternalBlockSize = 0;

  // This function is defined to conform to the interface expected by the iPlug2 resampler.
  std::function<void(NAM_SAMPLE**, NAM_SAMPLE**, int)> mBlockProcessFunc;

  // PlaySilence's buffers, and its last output (CRBN Rig).
  std::vector<NAM_SAMPLE> mSilence, mSink;
  NAM_SAMPLE mSilenceLevel = 0.0;
};
