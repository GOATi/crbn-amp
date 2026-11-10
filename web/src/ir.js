// The cabinet IR as the desktop applies it (AudioDSPTools dsp::ImpulseResponse): at most 8192 samples at the playing
// rate, scaled by -18 dB and by 48 kHz over that rate. The browser has already resampled the file to the context's rate
// as it decoded it; the first channel is used, as the desktop's WAV loader does.
export const IR_MAX_SAMPLES = 8192

export const irGain = (sampleRate) => Math.pow(10, -18 / 20) * (48000 / sampleRate)

/** The ConvolverNode buffer for a decoded IR (an AudioBuffer at the context's rate). */
export function scaledIR(decoded, sampleRate) {
  const n = Math.min(IR_MAX_SAMPLES, decoded.length)
  const buf = new AudioBuffer({ length: n, numberOfChannels: 1, sampleRate })
  const src = decoded.getChannelData(0), dst = buf.getChannelData(0), g = irGain(sampleRate)
  for (let i = 0; i < n; i++) dst[i] = g * src[i]
  return buf
}
