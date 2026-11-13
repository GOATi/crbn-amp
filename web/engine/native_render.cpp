// The parity harness for CRBN Rig's web engine: rig_engine.cpp built natively (MSVC, as the desktop app is built),
// rendering a raw float32 mono file through a capture with the engine's default chain. web/engine/test.mjs runs the
// same input through the WebAssembly build and compares the two outputs sample by sample.
//
//   rig-native-render <capture.nam> <input.f32> <output.f32> <sample rate> [block]
//                     [--param <id>=<value>]... [--loop b0,b1,b2,a1,a2,gain,delay] [--status <file.json>]
//                     [--slot <n>=<capture.nam>]... [--at <block>:<id>=<value>]...
//
// The first capture plays at once (rig_load_model), unless it is "-": then nothing plays until a slot is asked for.
// --slot builds a capture into a slot before the input plays (rig_slot_load, as the web version's page does; build plan
// R5), and --at sets a parameter before that block (counting from 0): `--at 300:16=2` asks for slot 2 at block 300.
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
  int rig_slot_load(int slot, int bytes);
  const char* rig_error();
  double rig_status(int which);
}

struct At
{
  long long block;
  int id;
  double value;
};

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
  std::vector<std::pair<int, std::string>> slotFiles;
  std::vector<At> timeline;
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
    else if (std::strcmp(argv[at], "--slot") == 0 && at + 1 < argc)
    {
      const char* kv = argv[++at];
      const char* eq = std::strchr(kv, '=');
      if (eq == nullptr)
        return 2;
      slotFiles.emplace_back(std::atoi(kv), std::string(eq + 1));
    }
    else if (std::strcmp(argv[at], "--at") == 0 && at + 1 < argc)
    {
      At a{};
      if (std::sscanf(argv[++at], "%lld:%d=%lf", &a.block, &a.id, &a.value) != 3)
        return 2;
      timeline.push_back(a);
    }
    else
      return 2;
  }

  const auto load = [](const char* path, int slot) {
    const std::vector<char> capture = ReadAll(path);
    char* text = rig_text_buffer(static_cast<int>(capture.size()));
    std::copy(capture.begin(), capture.end(), text);
    const int bytes = static_cast<int>(capture.size());
    if ((slot < 0 ? rig_load_model(bytes) : rig_slot_load(slot, bytes)) != 0)
    {
      std::fprintf(stderr, "load failed (%s): %s\n", path, rig_error());
      return false;
    }
    return true;
  };
  if (std::strcmp(argv[1], "-") != 0 && !load(argv[1], -1))
    return 1;
  for (const auto& [slot, path] : slotFiles)
    if (!load(path.c_str(), slot))
      return 1;
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
    for (const At& a : timeline)
      if (static_cast<size_t>(a.block) * static_cast<size_t>(block) == at)
        rig_set_param(a.id, a.value);
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
    std::fprintf(s, "{\"muted\":%.17g,\"hz\":%.17g,\"trips\":%.17g,\"seconds\":%.17g,\"at\":%.17g,\"gain\":%.17g,\"playing\":%.17g,\"switchAt\":%.17g,\"pedals\":%.17g,\"pedalSwitchAt\":%.17g}\n",
                 rig_status(0), rig_status(1), rig_status(2), rig_status(3), rig_status(4), rig_status(5), rig_status(6),
                 rig_status(10), rig_status(12), rig_status(13));
    std::fclose(s);
  }
  return 0;
}
