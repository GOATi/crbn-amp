// The parity harness for CRBN Rig's web engine: rig_engine.cpp built natively (MSVC, as the desktop app is built),
// rendering a raw float32 mono file through a capture with the engine's default chain. web/engine/test.mjs runs the
// same input through the WebAssembly build and compares the two outputs sample by sample.
//
//   rig-native-render <capture.nam> <input.f32> <output.f32> <sample rate> [block]
//                     [--param <id>=<value>]... [--loop b0,b1,b2,a1,a2,gain,delay] [--status <file.json>]
//
// --param sets an engine parameter (rig_engine.cpp's Param) before the input plays. --loop feeds the output back into
// the input, as a speaker heard by a pickup does (the squeal guard's cases, build plan R3): each input sample is the
// file's sample plus gain times a resonance (a biquad with those coefficients) of the output `delay` samples earlier,
// with the same arithmetic in the same order as web/engine/scenarios.mjs's runLoop. --status writes the engine's
// status at the end (rig_status: what muted the output, at what frequency, and when).
#include <algorithm>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

extern "C"
{
  int rig_init(double sampleRate);
  float* rig_input();
  float* rig_output();
  void rig_process(int nFrames);
  void rig_set_param(int id, double value);
  char* rig_text_buffer(int bytes);
  int rig_load_model(int bytes);
  const char* rig_error();
  double rig_status(int which);
}

static std::vector<char> ReadAll(const char* path)
{
  std::vector<char> bytes;
  if (FILE* f = std::fopen(path, "rb"))
  {
    char buf[1 << 16];
    size_t n;
    while ((n = std::fread(buf, 1, sizeof buf, f)) > 0)
      bytes.insert(bytes.end(), buf, buf + n);
    std::fclose(f);
  }
  return bytes;
}

int main(int argc, char** argv)
{
  if (argc < 5)
  {
    std::fprintf(stderr, "usage: rig-native-render <capture.nam> <input.f32> <output.f32> <sample rate> [block] [--param id=value]... [--loop b0,b1,b2,a1,a2,gain,delay] [--status file]\n");
    return 2;
  }
  const double sampleRate = std::atof(argv[4]);
  int at = 5;
  const int block = argc > 5 && argv[5][0] != '-' ? std::atoi(argv[at++]) : 128;
  const int maxBlock = rig_init(sampleRate);
  if (block <= 0 || block > maxBlock)
    return 2;

  std::vector<std::pair<int, double>> params;
  bool loop = false;
  double b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0, gain = 0;
  int delay = 0;
  const char* statusPath = nullptr;
  for (; at < argc; at++)
  {
    if (std::strcmp(argv[at], "--param") == 0 && at + 1 < argc)
    {
      const char* kv = argv[++at];
      const char* eq = std::strchr(kv, '=');
      if (eq == nullptr)
        return 2;
      params.emplace_back(std::atoi(kv), std::strtod(eq + 1, nullptr));
    }
    else if (std::strcmp(argv[at], "--loop") == 0 && at + 1 < argc)
    {
      if (std::sscanf(argv[++at], "%lf,%lf,%lf,%lf,%lf,%lf,%d", &b0, &b1, &b2, &a1, &a2, &gain, &delay) != 7 || delay < block)
        return 2;
      loop = true;
    }
    else if (std::strcmp(argv[at], "--status") == 0 && at + 1 < argc)
      statusPath = argv[++at];
    else
      return 2;
  }

  const std::vector<char> capture = ReadAll(argv[1]);
  char* text = rig_text_buffer(static_cast<int>(capture.size()));
  std::copy(capture.begin(), capture.end(), text);
  if (rig_load_model(static_cast<int>(capture.size())) != 0)
  {
    std::fprintf(stderr, "load failed: %s\n", rig_error());
    return 1;
  }
  for (const auto& [id, value] : params)
    rig_set_param(id, value);

  const std::vector<char> raw = ReadAll(argv[2]);
  const size_t frames = raw.size() / sizeof(float);
  const float* input = reinterpret_cast<const float*>(raw.data());
  std::vector<float> output(frames);
  double x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (size_t at = 0; at < frames; at += block)
  {
    const int n = static_cast<int>(std::min<size_t>(block, frames - at));
    float* in = rig_input();
    if (!loop)
      std::copy(input + at, input + at + n, in);
    else
      for (int i = 0; i < n; i++)
      {
        const long long j = static_cast<long long>(at) + i - delay;
        const double x = j >= 0 ? static_cast<double>(output[static_cast<size_t>(j)]) : 0.0;
        const double y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
        in[i] = static_cast<float>(static_cast<double>(input[at + i]) + gain * y);
      }
    rig_process(n);
    std::copy(rig_output(), rig_output() + n, output.begin() + at);
  }
  FILE* out = std::fopen(argv[3], "wb");
  if (out == nullptr)
    return 1;
  std::fwrite(output.data(), sizeof(float), frames, out);
  std::fclose(out);
  if (statusPath != nullptr)
  {
    FILE* s = std::fopen(statusPath, "wb");
    if (s == nullptr)
      return 1;
    std::fprintf(s, "{\"muted\":%.17g,\"hz\":%.17g,\"trips\":%.17g,\"seconds\":%.17g,\"at\":%.17g,\"gain\":%.17g}\n", rig_status(0),
                 rig_status(1), rig_status(2), rig_status(3), rig_status(4), rig_status(5));
    std::fclose(s);
  }
  return 0;
}
