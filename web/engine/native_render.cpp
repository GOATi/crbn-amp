// The parity harness for CRBN Rig's web engine: rig_engine.cpp built natively (MSVC, as the desktop app is built),
// rendering a raw float32 mono file through a capture with the engine's default chain. web/engine/test.mjs runs the
// same input through the WebAssembly build and compares the two outputs sample by sample.
//
//   rig-native-render <capture.nam> <input.f32> <output.f32> <sample rate> [block size]
#include <algorithm>
#include <cstdio>
#include <cstdlib>
#include <vector>

extern "C"
{
  int rig_init(double sampleRate);
  float* rig_input();
  float* rig_output();
  void rig_process(int nFrames);
  char* rig_text_buffer(int bytes);
  int rig_load_model(int bytes);
  const char* rig_error();
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
    std::fprintf(stderr, "usage: rig-native-render <capture.nam> <input.f32> <output.f32> <sample rate> [block]\n");
    return 2;
  }
  const double sampleRate = std::atof(argv[4]);
  const int block = argc > 5 ? std::atoi(argv[5]) : 128;
  const int maxBlock = rig_init(sampleRate);
  if (block <= 0 || block > maxBlock)
    return 2;

  const std::vector<char> capture = ReadAll(argv[1]);
  char* text = rig_text_buffer(static_cast<int>(capture.size()));
  std::copy(capture.begin(), capture.end(), text);
  if (rig_load_model(static_cast<int>(capture.size())) != 0)
  {
    std::fprintf(stderr, "load failed: %s\n", rig_error());
    return 1;
  }

  const std::vector<char> raw = ReadAll(argv[2]);
  const size_t frames = raw.size() / sizeof(float);
  const float* input = reinterpret_cast<const float*>(raw.data());
  std::vector<float> output(frames);
  for (size_t at = 0; at < frames; at += block)
  {
    const int n = static_cast<int>(std::min<size_t>(block, frames - at));
    std::copy(input + at, input + at + n, rig_input());
    rig_process(n);
    std::copy(rig_output(), rig_output() + n, output.begin() + at);
  }
  FILE* out = std::fopen(argv[3], "wb");
  if (out == nullptr)
    return 1;
  std::fwrite(output.data(), sizeof(float), frames, out);
  std::fclose(out);
  return 0;
}
