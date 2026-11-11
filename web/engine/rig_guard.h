// CRBN Rig's squeal guard and auto-off (build plan R3, docs/P3-UX.md U1; crbn-launcher D-RIG-008 (e)): part of the
// engine both builds run. rig_engine.cpp includes this header, so the web version's WebAssembly, the desktop app and the
// parity harness all compile it with the engine and nothing else, and web/engine/test.mjs holds both builds to it.
//
// The squeal guard listens to the engine's output and its input together, about every 11 ms over the last 43 ms.
// Feedback is a loop: the output comes back through the input. It suspects a squeal when all of these hold for a while:
//   - the output is one narrow, loud peak: most of its energy in a few bins at one frequency, between 200 Hz and 16 kHz;
//   - that peak holds its frequency (within 0.6%) and does not fade;
//   - the input carries the same tone and does not fade either (a held note decays in the input, however long a
//     high-gain amp sustains it in the output);
//   - and the input follows the output at a steady ratio, as a loop through a speaker and a pickup or microphone does
//     (a beating or decaying string does not keep a steady ratio to a compressed output).
// Above 1.5 kHz, where no guitar's fundamental lives, it suspects after 70 ms; below, it asks for a narrower peak and
// waits 120 ms. Listening cannot tell a squeal from a steady tone someone plays in (a test tone, a synth, the example
// clip NAM Core ships, which is a sine), so then it asks: it dips its own output 4 dB for 50 ms and listens for the dip
// to come back through the input, as only a loop's would. It trips when the dip returns (within about 450 ms, so a slow
// loop through Bluetooth is heard too). A tone the dip does not come back in is not a squeal; it is asked again a second
// later, three times at most while it holds.
//
// Auto-off watches the input for the signature of a pulled jack: a spike near full scale, then within 30 ms dead silence
// that lasts 300 ms (a muted string cannot fall that fast), or mains hum at exactly 50 or 60 Hz (two windows of 200 ms in
// which that comb of harmonics carries 80% of the energy).
//
// Everything here runs on the audio thread, one sample at a time, so its decisions do not depend on the block size.
// Reset allocates; call it with the audio stopped (rig_init).
#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>

namespace rig_guard
{
// Why the engine muted its output. The page says it in words (web/src/app.js).
enum Why : int
{
  kNone = 0,
  kSqueal = 1, // the squeal guard
  kSilence = 2, // auto-off: a spike, then dead silence
  kHum = 3, // auto-off: a spike, then mains hum
};

struct Trip
{
  int why = kNone;
  double hz = 0.0; // the squeal's frequency, or the mains frequency
  double seconds = 0.0; // how long the squeal held, or how long after the spike auto-off tripped
};

constexpr double kPi = 3.14159265358979323846;

inline double PowerDB(const double p) { return 10.0 * std::log10(std::max(p, 1e-30)); }

// ---- the squeal guard -----------------------------------------------------------------------------------------------
class SquealGuard
{
public:
  void Reset(const double sampleRate)
  {
    mRate = sampleRate;
    mN = sampleRate < 66000.0 ? 2048 : sampleRate < 132000.0 ? 4096 : 8192; // about 43 ms
    mHop = mN / 4;
    mRingIn.assign(static_cast<size_t>(mN), 0.0);
    mRingOut.assign(static_cast<size_t>(mN), 0.0);
    mWindow.resize(static_cast<size_t>(mN));
    for (int i = 0; i < mN; i++)
      mWindow[static_cast<size_t>(i)] = 0.5 - 0.5 * std::cos(2.0 * kPi * i / mN);
    mRe.assign(static_cast<size_t>(mN), 0.0);
    mIm.assign(static_cast<size_t>(mN), 0.0);
    mPowOut.assign(static_cast<size_t>(mN / 2), 0.0);
    mPowIn.assign(static_cast<size_t>(mN / 2), 0.0);
    mCos.resize(static_cast<size_t>(mN / 2));
    mSin.resize(static_cast<size_t>(mN / 2));
    for (int i = 0; i < mN / 2; i++)
    {
      mCos[static_cast<size_t>(i)] = std::cos(2.0 * kPi * i / mN);
      mSin[static_cast<size_t>(i)] = -std::sin(2.0 * kPi * i / mN);
    }
    mRev.resize(static_cast<size_t>(mN));
    int bits = 0;
    while ((1 << bits) < mN)
      bits++;
    for (int i = 0; i < mN; i++)
    {
      int r = 0;
      for (int b = 0; b < bits; b++)
        if (i & (1 << b))
          r |= 1 << (bits - 1 - b);
      mRev[static_cast<size_t>(i)] = r;
    }
    const double binHz = mRate / mN;
    mLo = std::max(3, static_cast<int>(std::ceil(kLowestHz / binHz)));
    mHi = std::min(mN / 2 - 3, static_cast<int>(std::floor(std::min(kHighestHz, 0.45 * mRate) / binHz)));
    mMaxFrames = static_cast<int>(std::ceil(kHoldLow * mRate / mHop)) + 1;
    mHold.assign(static_cast<size_t>(mMaxFrames), Frame{});
    mRamp = static_cast<int64_t>(std::lround(kDipRamp * mRate));
    mDip = static_cast<int64_t>(std::lround(kDipFor * mRate));
    mListenFor = static_cast<int64_t>(std::lround(kListenFor * mRate));
    mAgainAfter = static_cast<int64_t>(std::lround(kAskAgain * mRate));
    mLevels.assign(kLevels, 0.0);
    Clear();
  }

  // Forgets what it has heard: after the person turns the output back on, or turns the guard off.
  void Clear()
  {
    std::fill(mRingIn.begin(), mRingIn.end(), 0.0);
    std::fill(mRingOut.begin(), mRingOut.end(), 0.0);
    mAt = 0;
    mFilled = 0;
    mSinceHop = 0;
    Forget();
  }

  // What the output is multiplied by now: 1, or less while the guard dips it to ask whether a tone is a loop.
  double Dip() const
  {
    if (!mAsking)
      return 1.0;
    const int64_t t = mAskedFor;
    const double low = kDipGain;
    if (t < mRamp)
      return 1.0 - (1.0 - low) * static_cast<double>(t) / static_cast<double>(mRamp);
    if (t < mRamp + mDip)
      return low;
    if (t < 2 * mRamp + mDip)
      return low + (1.0 - low) * static_cast<double>(t - mRamp - mDip) / static_cast<double>(mRamp);
    return 1.0;
  }

  // One sample of the engine's input (as it arrived) and its output (as it leaves, dip and all). True when it trips.
  bool Push(const double in, const double out, Trip& trip)
  {
    mRingIn[static_cast<size_t>(mAt)] = in;
    mRingOut[static_cast<size_t>(mAt)] = out;
    if (++mAt == mN)
      mAt = 0;
    if (mFilled < mN)
      mFilled++;
    if (mHeld > 0)
      Listen(in);
    if (++mSinceHop < mHop)
      return false;
    mSinceHop = 0;
    return mFilled == mN && Analyse(trip);
  }

private:
  struct Frame
  {
    double out = 0.0; // the peak's level in the output, dB
    double in = 0.0; // the same band's level in the input, dB
  };

  static constexpr double kLowestHz = 200.0;
  static constexpr double kHighestHz = 16000.0;
  static constexpr double kSplitHz = 1500.0; // below: where guitar fundamentals live, so more is asked
  static constexpr double kHoldHigh = 0.07; // seconds the peak must hold above the split
  static constexpr double kHoldLow = 0.12; // and below it
  static constexpr double kShareHigh = 0.5; // of the output's energy in the peak, above the split
  static constexpr double kShareLow = 0.7; // and below it
  static constexpr double kShareIn = 0.2; // of the input's energy in the same band
  static constexpr double kLoudest = -40.0; // dBFS: a quieter peak is never a squeal worth stopping
  static constexpr double kInputFloor = -90.0; // dBFS: the input must carry the tone at all
  static constexpr double kDrift = 0.006; // of the frequency, or a third of a bin, whichever is wider
  static constexpr double kFade = -2.0; // dB/s: the output and the input may not fade faster than this
  static constexpr double kRatioSlope = 4.0; // dB/s: the input's level against the output's stays this steady
  static constexpr double kRatioWobble = 1.5; // dB: around that line, at most this much
  static constexpr int kMissesAllowed = 2; // frames that may break the hold (a pick attack) before it starts over
  // The question: the output dips 4 dB for 50 ms, with 5 ms ramps, and the input is listened to in windows of 5 ms (or
  // two cycles) for the dip's two edges, the fall and then the rise 50 ms later, each at least 60% of the dip, against
  // the input's own trend.
  static constexpr double kDipGain = 0.630957344480193; // -4 dB
  static constexpr double kEdgeDB = 2.0; // the fall, and the turn upward after it
  static constexpr double kDipRamp = 0.005;
  static constexpr double kDipFor = 0.050;
  static constexpr double kDipSlack = 0.025; // the turn may come this much sooner or later than the dip's length
  static constexpr double kAbruptDB = 10.0; // a fall this big from one window to the next is a tone stopping
  static constexpr double kDeepestDB = 30.0; // and a fall this far below the tone, or below kSilentDB, is silence
  static constexpr double kSilentDB = -80.0; // dBFS
  static constexpr double kListenFor = 0.45; // seconds after the dip begins that its return is listened for
  static constexpr double kAskAgain = 1.0; // seconds before a tone that did not answer is asked again
  static constexpr int kAsksPerHold = 3;
  static constexpr int kConfirmFrames = 1; // frames after the answer in which no other tone may appear
  static constexpr int kLevels = 160; // window levels kept: 800 ms of 5 ms windows

  // A new tone: nothing held, nothing asked.
  void Forget()
  {
    mHeld = 0;
    mMisses = 0;
    mHeldSamples = 0;
    mAnchor = 0.0;
    mAsking = false;
    mAsks = 0;
    mSinceAsked = 0;
    mAskedFor = 0;
    mAnswered = 0;
    mWindows = 0;
    mS1 = mS2 = 0.0;
    mInWin = 0;
  }

  void FFT()
  {
    double* re = mRe.data();
    double* im = mIm.data();
    for (int i = 0; i < mN; i++)
    {
      const int j = mRev[static_cast<size_t>(i)];
      if (j > i)
      {
        std::swap(re[i], re[j]);
        std::swap(im[i], im[j]);
      }
    }
    for (int len = 2; len <= mN; len <<= 1)
    {
      const int half = len >> 1, step = mN / len;
      for (int i = 0; i < mN; i += len)
        for (int k = 0; k < half; k++)
        {
          const double wr = mCos[static_cast<size_t>(k * step)], wi = mSin[static_cast<size_t>(k * step)];
          const int a = i + k, b = a + half;
          const double tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
    }
  }

  // The level, in dBFS of a sine, of the power in five bins of a Hann-windowed frame (a sine of amplitude A puts
  // 3 A^2 N^2 / 32 there).
  double LevelDB(const double p) const { return PowerDB(p * 32.0 / (3.0 * static_cast<double>(mN) * mN)); }

  // Least squares over the hold: the slope (dB/s) of `get`, and how far it wanders from that line (dB).
  template <typename Get>
  void Line(const int n, Get get, double& slope, double& wobble) const
  {
    const double dt = static_cast<double>(mHop) / mRate;
    double mt = 0.0, my = 0.0;
    for (int j = 0; j < n; j++)
    {
      mt += j * dt;
      my += get(j);
    }
    mt /= n;
    my /= n;
    double stt = 0.0, sty = 0.0;
    for (int j = 0; j < n; j++)
    {
      stt += (j * dt - mt) * (j * dt - mt);
      sty += (j * dt - mt) * (get(j) - my);
    }
    slope = stt > 0.0 ? sty / stt : 0.0;
    double e = 0.0;
    for (int j = 0; j < n; j++)
    {
      const double d = get(j) - (my + slope * (j * dt - mt));
      e += d * d;
    }
    wobble = std::sqrt(e / n);
  }

  double LevelAt(const int k) const { return mLevels[static_cast<size_t>(((k % kLevels) + kLevels) % kLevels)]; }

  // While a tone holds: the input's level at its frequency, one short window at a time (Goertzel). While the guard asks,
  // the dip coming back in it: against the input's own trend before the dip, a fall of 2 dB or more, then a turn upward
  // of 2 dB or more about as long after as the dip lasted. A loop answers so whether it is saturated (the input steps
  // down 4 dB and back) or still growing (the dip pulls the loop's gain under 1, so the input keeps falling until the dip
  // ends, then grows again). A tone played in does not answer, and a tone that stops only falls.
  bool Listen(const double x)
  {
    const double s = x + mCoef * mS1 - mS2;
    mS2 = mS1;
    mS1 = s;
    if (mAsking)
      mAskedFor++;
    else if (mAsks > 0)
      mSinceAsked++;
    if (++mInWin < mWinLen)
      return false;
    const double p = mS1 * mS1 + mS2 * mS2 - mCoef * mS1 * mS2;
    mLevels[static_cast<size_t>(mWindows % kLevels)] = PowerDB(p * 4.0 / (static_cast<double>(mWinLen) * mWinLen)); // dBFS of a sine
    mWindows++;
    mS1 = mS2 = 0.0;
    mInWin = 0;
    if (!mAsking)
      return false;
    const int k = mWindows - 1;
    // A tone that stops is no answer: a loop's level never drops 10 dB from one window to the next (the dip's ramp takes
    // 5 ms, and a dipped loop decays at a few hundred dB/s at most), nor into silence.
    if (k > mAskedAt
        && (LevelAt(k - 1) - LevelAt(k) > kAbruptDB || LevelAt(k) < std::max(kSilentDB, mBefore - kDeepestDB)))
    {
      mAsking = false;
      mSinceAsked = 0;
      return false;
    }
    if (k > mAskedAt)
    {
      const double gap = static_cast<double>(mWinLen) / mRate; // seconds per window
      const double off = LevelAt(k) - (mBefore + mTrend * (k - mAskedAt + 1.5)); // against the trend
      if (mFellAt >= 0 && static_cast<double>(k - mFellAt) * gap > kDipFor + kDipSlack)
        mFellAt = -1; // that fall was not the dip's
      if (mFellAt < 0)
      {
        if (off <= -kEdgeDB)
        {
          mFellAt = k;
          mLowest = off;
        }
      }
      else
      {
        mLowest = std::min(mLowest, off);
        if (off >= mLowest + kEdgeDB && std::fabs(static_cast<double>(k - mFellAt) * gap - kDipFor) <= kDipSlack)
        {
          // The dip came back. It trips once two more frames still hear the same tone (a new note starting while the
          // guard listened would have moved the peak, and its attack can look like an answer).
          mAsking = false;
          mAnswered = 1;
          return false;
        }
      }
    }
    if (mAskedFor >= mListenFor)
    {
      // The dip did not come back: not a loop, for now.
      mAsking = false;
      mSinceAsked = 0;
    }
    return false;
  }

  // One frame of both spectra: the hold goes on, starts over, or ends; and when it sounds like a squeal, the guard asks.
  bool Analyse(Trip& trip)
  {
    // Both signals in one complex FFT: the output as the real part, the input as the imaginary, oldest sample first.
    for (int j = 0; j < mN; j++)
    {
      const size_t at = static_cast<size_t>((mAt + j) % mN);
      mRe[static_cast<size_t>(j)] = mWindow[static_cast<size_t>(j)] * mRingOut[at];
      mIm[static_cast<size_t>(j)] = mWindow[static_cast<size_t>(j)] * mRingIn[at];
    }
    FFT();
    double totalOut = 0.0, totalIn = 0.0;
    for (int k = 1; k < mN / 2; k++)
    {
      const double ar = mRe[static_cast<size_t>(k)], ai = mIm[static_cast<size_t>(k)];
      const double br = mRe[static_cast<size_t>(mN - k)], bi = mIm[static_cast<size_t>(mN - k)];
      // out[k] = (Z[k] + conj Z[N-k]) / 2, in[k] = (Z[k] - conj Z[N-k]) / 2i
      const double orr = 0.5 * (ar + br), oi = 0.5 * (ai - bi);
      const double ir = 0.5 * (ai + bi), ii = -0.5 * (ar - br);
      mPowOut[static_cast<size_t>(k)] = orr * orr + oi * oi;
      mPowIn[static_cast<size_t>(k)] = ir * ir + ii * ii;
      totalOut += mPowOut[static_cast<size_t>(k)];
      totalIn += mPowIn[static_cast<size_t>(k)];
    }

    int peak = mLo;
    for (int k = mLo + 1; k <= mHi; k++)
      if (mPowOut[static_cast<size_t>(k)] > mPowOut[static_cast<size_t>(peak)])
        peak = k;
    // A peak at the edge of the range that is only the skirt of one beyond it is no peak.
    const bool local = mPowOut[static_cast<size_t>(peak)] >= mPowOut[static_cast<size_t>(peak - 1)]
                       && mPowOut[static_cast<size_t>(peak)] >= mPowOut[static_cast<size_t>(peak + 1)];
    double bandOut = 0.0, bandIn = 0.0;
    for (int k = peak - 2; k <= peak + 2; k++)
    {
      bandOut += mPowOut[static_cast<size_t>(k)];
      bandIn += mPowIn[static_cast<size_t>(k)];
    }
    // The frequency between bins, from the parabola through the log powers.
    const double l0 = std::log(std::max(mPowOut[static_cast<size_t>(peak - 1)], 1e-300));
    const double l1 = std::log(std::max(mPowOut[static_cast<size_t>(peak)], 1e-300));
    const double l2 = std::log(std::max(mPowOut[static_cast<size_t>(peak + 1)], 1e-300));
    const double curve = l0 - 2.0 * l1 + l2;
    const double offset = curve < 0.0 ? std::clamp(0.5 * (l0 - l2) / curve, -0.5, 0.5) : 0.0;
    const double hz = (peak + offset) * mRate / mN;

    const bool high = hz >= kSplitHz;
    const double outDB = LevelDB(bandOut), inDB = LevelDB(bandIn);
    const bool narrow = local && totalOut > 0.0 && totalIn > 0.0 && bandOut >= (high ? kShareHigh : kShareLow) * totalOut
                        && bandIn >= kShareIn * totalIn && outDB >= kLoudest && inDB >= kInputFloor;
    const double drift = std::max(kDrift * mAnchor, mRate / mN / 3.0);
    if (mAnswered > 0)
    {
      // The dip came back. A loop answers so, and often collapses under the dip (its gain dropped below 1), so its next
      // frames may be quiet; a note starting while the guard listened can look like an answer too, but its frames hold a
      // narrow peak somewhere else. So it trips after one more frame unless that frame is a tone at another frequency.
      if (narrow && std::fabs(hz - mAnchor) > drift)
      {
        Forget();
        return false;
      }
      if (++mAnswered <= kConfirmFrames + 1)
        return false;
      trip.why = kSqueal;
      trip.hz = mAnchor;
      trip.seconds = static_cast<double>(mHeldSamples) / mRate;
      return true;
    }
    if (!narrow || (mHeld > 0 && std::fabs(hz - mAnchor) > drift))
    {
      // A frame that breaks the hold for a moment is passed over: a pick attack (two frames at most), and anything while
      // the guard asks (the dip itself blurs the peak). A narrow frame at another frequency otherwise starts a new hold.
      if (mHeld > 0 && (mAsking || (!narrow && ++mMisses <= kMissesAllowed)))
        return false;
      Forget();
      if (!narrow)
        return false;
    }
    if (mHeld == 0)
    {
      // A new tone: listen to the input at its frequency from now on.
      mAnchor = hz;
      mWinLen = std::max(static_cast<int>(std::lround(0.005 * mRate)), static_cast<int>(std::lround(2.0 * mRate / hz)));
      mCoef = 2.0 * std::cos(2.0 * kPi * hz / mRate);
    }
    mMisses = 0;
    // The hold keeps its newest frames, up to the longest hold asked for.
    if (mHeld == mMaxFrames)
      std::rotate(mHold.begin(), mHold.begin() + 1, mHold.end());
    else
      mHeld++;
    mHold[static_cast<size_t>(mHeld - 1)] = Frame{outDB, inDB};
    mHeldSamples += mHop;

    const int need = static_cast<int>(std::ceil((high ? kHoldHigh : kHoldLow) * mRate / mHop));
    if (mHeld < need || mAsking || mAnswered > 0 || mAsks >= kAsksPerHold || (mAsks > 0 && mSinceAsked < mAgainAfter) || mWindows < 8)
      return false;
    const int first = mHeld - need;
    double outSlope, outWobble, inSlope, inWobble, ratioSlope, ratioWobble;
    Line(need, [&](int j) { return mHold[static_cast<size_t>(first + j)].out; }, outSlope, outWobble);
    Line(need, [&](int j) { return mHold[static_cast<size_t>(first + j)].in; }, inSlope, inWobble);
    Line(need, [&](int j) { return mHold[static_cast<size_t>(first + j)].in - mHold[static_cast<size_t>(first + j)].out; },
         ratioSlope, ratioWobble);
    if (outSlope < kFade || inSlope < kFade || std::fabs(ratioSlope) > kRatioSlope || ratioWobble > kRatioWobble)
      return false;
    // It sounds like a squeal: ask. The input's level and trend per window, from its last eight windows, are what the
    // dip's return is measured against.
    const int k = mWindows - 1;
    const double recent = (LevelAt(k) + LevelAt(k - 1) + LevelAt(k - 2) + LevelAt(k - 3)) / 4.0;
    const double earlier = (LevelAt(k - 4) + LevelAt(k - 5) + LevelAt(k - 6) + LevelAt(k - 7)) / 4.0;
    mBefore = recent;
    mTrend = (recent - earlier) / 4.0;
    mAsking = true;
    mAsks++;
    mAskedFor = 0;
    mAskedAt = mWindows;
    mFellAt = -1;
    return false;
  }

  double mRate = 48000.0;
  int mN = 2048, mHop = 512, mLo = 3, mHi = 0, mMaxFrames = 1;
  std::vector<double> mRingIn, mRingOut, mWindow, mRe, mIm, mPowOut, mPowIn, mCos, mSin;
  std::vector<int> mRev;
  int mAt = 0, mFilled = 0, mSinceHop = 0;
  // the tone held
  std::vector<Frame> mHold;
  int mHeld = 0, mMisses = 0;
  int64_t mHeldSamples = 0;
  double mAnchor = 0.0;
  // the input at its frequency, in short windows
  double mCoef = 0.0, mS1 = 0.0, mS2 = 0.0;
  int mWinLen = 240, mInWin = 0, mWindows = 0;
  std::vector<double> mLevels;
  // the question
  int64_t mRamp = 240, mDip = 2880, mListenFor = 0, mAgainAfter = 0;
  bool mAsking = false;
  int mAsks = 0, mAskedAt = 0, mFellAt = -1, mAnswered = 0;
  int64_t mAskedFor = 0, mSinceAsked = 0;
  double mBefore = 0.0, mTrend = 0.0, mLowest = 0.0;
};

// ---- auto-off: the signature of a pulled jack ----------------------------------------------------------------------
class UnplugWatch
{
public:
  void Reset(const double sampleRate)
  {
    mRate = sampleRate;
    mQuickly = static_cast<int64_t>(std::lround(0.030 * sampleRate));
    mQuietFor = static_cast<int64_t>(std::lround(0.300 * sampleRate));
    mHumFrom = static_cast<int64_t>(std::lround(0.020 * sampleRate));
    mWindow = static_cast<int>(std::lround(0.200 * sampleRate)); // a whole number of cycles of 50 Hz and of 60 Hz
    mWatchFor = static_cast<int64_t>(std::lround(1.2 * sampleRate));
    for (int m = 0; m < 2; m++)
      for (int k = 0; k < kHarmonics; k++)
        mCoef[m][k] = 2.0 * std::cos(2.0 * kPi * (m == 0 ? 50.0 : 60.0) * (k + 1) / sampleRate);
    Clear();
  }

  void Clear()
  {
    mSince = -1;
    ClearAfterSpike();
  }

  // One sample of the input as it arrived (before the input gain). True when it trips.
  bool Push(const double x, Trip& trip)
  {
    const double a = std::fabs(x);
    if (a >= kSpike)
    {
      mSince = 0;
      ClearAfterSpike();
      return false;
    }
    if (mSince < 0)
      return false;
    if (++mSince > mWatchFor)
    {
      mSince = -1;
      return false;
    }

    // Dead silence: below -60 dBFS within 30 ms of the spike, and kept there, at -75 dBFS RMS or less, for 300 ms.
    if (!mNotSilent)
    {
      if (a >= kQuiet)
      {
        mQuietRun = 0;
        mQuietSum = 0.0;
        if (mSince > mQuickly)
          mNotSilent = true;
      }
      else
      {
        mQuietSum += x * x;
        if (++mQuietRun >= mQuietFor && mQuietSum / static_cast<double>(mQuietRun) < kQuietPower)
        {
          trip.why = kSilence;
          trip.hz = 0.0;
          trip.seconds = static_cast<double>(mSince) / mRate;
          mSince = -1;
          return true;
        }
      }
    }

    // Mains hum: windows of 200 ms from 20 ms after the spike, the comb of 50 or 60 Hz harmonics measured by Goertzel.
    if (mSince <= mHumFrom)
      return false;
    for (int m = 0; m < 2; m++)
      for (int k = 0; k < kHarmonics; k++)
      {
        const double s = x + mCoef[m][k] * mS1[m][k] - mS2[m][k];
        mS2[m][k] = mS1[m][k];
        mS1[m][k] = s;
      }
    mSum += x;
    mSum2 += x * x;
    if (++mInWindow < mWindow)
      return false;
    const double w = static_cast<double>(mWindow);
    const double energy = mSum2 - mSum * mSum / w; // the window's energy, its DC removed
    int mains = 0;
    if (energy > 0.0 && mSum2 / w >= kHumPower)
      for (int m = 0; m < 2 && mains == 0; m++)
      {
        double comb = 0.0;
        for (int k = 0; k < kHarmonics; k++)
        {
          const double s1 = mS1[m][k], s2 = mS2[m][k];
          comb += 2.0 * (s1 * s1 + s2 * s2 - mCoef[m][k] * s1 * s2) / w;
        }
        if (comb >= kHumShare * energy)
          mains = m == 0 ? 50 : 60;
      }
    mHumRun = mains != 0 && mains == mLastMains ? mHumRun + 1 : mains != 0 ? 1 : 0;
    mLastMains = mains;
    ClearWindow();
    if (mHumRun < 2)
      return false;
    trip.why = kHum;
    trip.hz = mains;
    trip.seconds = static_cast<double>(mSince) / mRate;
    mSince = -1;
    return true;
  }

private:
  static constexpr int kHarmonics = 12;
  static constexpr double kSpike = 0.89; // -1 dBFS
  static constexpr double kQuiet = 0.001; // -60 dBFS
  static constexpr double kQuietPower = 3.1622776601683794e-08; // -75 dBFS RMS
  static constexpr double kHumPower = 1e-05; // -50 dBFS RMS
  static constexpr double kHumShare = 0.8;

  void ClearWindow()
  {
    for (int m = 0; m < 2; m++)
      for (int k = 0; k < kHarmonics; k++)
        mS1[m][k] = mS2[m][k] = 0.0;
    mSum = mSum2 = 0.0;
    mInWindow = 0;
  }
  void ClearAfterSpike()
  {
    mNotSilent = false;
    mQuietRun = 0;
    mQuietSum = 0.0;
    mHumRun = 0;
    mLastMains = 0;
    ClearWindow();
  }

  double mRate = 48000.0;
  int64_t mQuickly = 0, mQuietFor = 0, mHumFrom = 0, mWatchFor = 0;
  int mWindow = 1;
  int64_t mSince = -1; // samples since the last spike, or -1
  bool mNotSilent = false;
  int64_t mQuietRun = 0;
  double mQuietSum = 0.0;
  double mCoef[2][kHarmonics] = {}, mS1[2][kHarmonics] = {}, mS2[2][kHarmonics] = {};
  double mSum = 0.0, mSum2 = 0.0;
  int mInWindow = 0, mHumRun = 0, mLastMains = 0;
};
} // namespace rig_guard
