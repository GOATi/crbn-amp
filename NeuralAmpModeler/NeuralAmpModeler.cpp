// CRBN Rig's desktop app: Rig's page over Rig's engine (crbn-launcher D-RIG-017, build plan R2). See NeuralAmpModeler.h.
//
// The page and this host talk in JSON (web/src/audio-desktop.js is the page's side):
//   page -> app  {type:'hello'}  {type:'param', id, value}  {type:'capture', id, text}  {type:'clearCapture', id}
//                {type:'ir', id, rate, samples}  {type:'clearIR'}  {type:'irOn', on}  {type:'standby', on}
//                {type:'source', source: 'live' | 'demo' | 'none'}  {type:'demo', id, rate, samples}
//                {type:'audioSettings'}  {type:'chrome', dark, caption}
//                the library (build plan R4, RigLibrary.h): {type:'libPick', id, start}  {type:'libList', id, folder}
//                {type:'libMeta', id, folder, paths}  {type:'libRead', id, folder, path}  {type:'libWatch', folder}
//   app -> page  {type:'ready' | 'status', sampleRate, running, driver, input, output, buffer, latencyMs, ...}
//                {type:'meter', input, raw, output, muted, hz, trips, seconds}  {type:'capture', id, ok, info | error}
//                {type:'ir', id, ok, ...}
//                {type:'demo', id, ok, error}
//                {type:'libPick', id, ok, path}  {type:'libList', id, ok, files: [{p, s, m}], truncated, error}
//                {type:'libMeta', id, items: [{p, metadata, rate} | {p, wav} | {p, error}]}  {type:'libRead', id, ok, b64}
//                {type:'libChanged'}
// `muted` is what muted the output, if anything (the squeal guard or auto-off, rig_engine.cpp's Status), with its
// frequency; `trips` counts them, so the page sees each one. Standby, the guard and auto-off are engine parameters.
// `samples` are float32 little-endian in base64: an IR's first channel, or the riff, at its own rate, decoded by the
// page as the web version decodes them.
#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <vector>

#include "NeuralAmpModeler.h"
#include "IPlug_include_in_plug_src.h"
#include "json.hpp"

#include <dwmapi.h>
#include <shellapi.h>
#include <shlobj.h>
#if defined(APP_API)
  #include "resource.h" // ID_PREFERENCES: the standalone's Audio settings dialog (iPlug2's)
#endif
#pragma comment(lib, "dwmapi.lib")

using namespace iplug;

// web/engine/rig_engine.cpp's C API, for --render.
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

namespace
{
// The page's files are served under this private name (RigWebView.h): never a real host.
const wchar_t* const kPageHost = L"crbn-rig.example";

std::wstring ExeFolder()
{
  std::wstring path(MAX_PATH, L'\0');
  for (;;)
  {
    const DWORD n = GetModuleFileNameW(nullptr, path.data(), static_cast<DWORD>(path.size()));
    if (n == 0)
      return L"";
    if (n < path.size())
    {
      path.resize(n);
      break;
    }
    path.resize(path.size() * 2);
  }
  return path.substr(0, path.find_last_of(L"\\/") + 1);
}

// %LOCALAPPDATA%\CRBNAmp: the standalone's settings folder (BUNDLE_NAME), where iPlug2 keeps settings.ini.
std::wstring SettingsFolder()
{
  PWSTR local = nullptr;
  std::wstring folder;
  if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &local)))
    folder = std::wstring(local) + L"\\" + rig::Widen(BUNDLE_NAME);
  CoTaskMemFree(local);
  return folder;
}

std::vector<float> DecodeFloats(const std::string& b64)
{
  static const auto value = [](char c) -> int {
    if (c >= 'A' && c <= 'Z')
      return c - 'A';
    if (c >= 'a' && c <= 'z')
      return c - 'a' + 26;
    if (c >= '0' && c <= '9')
      return c - '0' + 52;
    if (c == '+' || c == '-')
      return 62;
    if (c == '/' || c == '_')
      return 63;
    return -1;
  };
  std::vector<unsigned char> bytes;
  bytes.reserve(b64.size() / 4 * 3);
  unsigned acc = 0;
  int bits = 0;
  for (const char c : b64)
  {
    const int v = value(c);
    if (v < 0)
      continue; // padding and line breaks
    acc = (acc << 6) | static_cast<unsigned>(v);
    bits += 6;
    if (bits >= 8)
    {
      bits -= 8;
      bytes.push_back(static_cast<unsigned char>((acc >> bits) & 0xff));
    }
  }
  std::vector<float> out(bytes.size() / sizeof(float));
  std::memcpy(out.data(), bytes.data(), out.size() * sizeof(float));
  for (float& f : out)
    if (!std::isfinite(f))
      f = 0.0f;
  return out;
}

std::string Dump(const nlohmann::json& j) { return j.dump(-1, ' ', false, nlohmann::json::error_handler_t::replace); }

// DWMWA_USE_IMMERSIVE_DARK_MODE: 20 since Windows 10 20H1, 19 before it.
void SetDarkTitle(HWND window, bool dark)
{
  const BOOL on = dark ? TRUE : FALSE;
  if (FAILED(DwmSetWindowAttribute(window, 20, &on, sizeof on)))
    DwmSetWindowAttribute(window, 19, &on, sizeof on);
}

#if defined(APP_API) && defined(OS_WIN)
bool AskedToRender()
{
  int argc = 0;
  LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);
  bool asked = false;
  for (int i = 1; argv != nullptr && i < argc; i++)
    asked = asked || wcscmp(argv[i], L"--render") == 0;
  LocalFree(argv);
  return asked;
}

// One copy of the standalone at a time, and a second start brings the first to the front. iPlug2's WinMain looks for
// the running window by the title BUNDLE_NAME, which for CRBN Rig is the identity "CRBNAmp", not the title "CRBN Rig"
// (config.h), so its lookup would find nothing. This runs before WinMain: if the first copy's mutex exists, it raises
// that copy's window by its real title and leaves; otherwise WinMain goes on and makes the mutex itself. A --render
// beside a running copy leaves with exit code 3 and raises nothing.
struct CRBNSingleInstance
{
  CRBNSingleInstance()
  {
    HANDLE running = OpenMutexA(SYNCHRONIZE, FALSE, BUNDLE_NAME);
    if (running == nullptr)
      return;
    CloseHandle(running);
    if (AskedToRender())
      ExitProcess(3);
    if (HWND window = FindWindowA(nullptr, PLUG_NAME))
    {
      if (IsIconic(window))
        ShowWindow(window, SW_RESTORE);
      SetForegroundWindow(window);
    }
    ExitProcess(0);
  }
} gCRBNSingleInstance;

std::vector<char> ReadAll(const wchar_t* path)
{
  std::vector<char> bytes;
  if (FILE* f = _wfopen(path, L"rb"))
  {
    char buf[1 << 16];
    size_t n;
    while ((n = std::fread(buf, 1, sizeof buf, f)) > 0)
      bytes.insert(bytes.end(), buf, buf + n);
    std::fclose(f);
  }
  return bytes;
}

// crbn-rig.exe --render <capture.nam> <input.f32> <output.f32> <sample rate> [block]
// Plays a raw float32 mono file through the capture with the engine's default chain, exactly as the parity harness
// web/engine/native_render.cpp does, so packaging/windows/check.mjs can compare the shipped exe's engine with it.
// Returns the exit code (0 written; 1 failed, the reason on stderr; 2 bad arguments), or -1 when not asked.
int RenderIfAsked()
{
  int argc = 0;
  LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);
  int at = -1;
  for (int i = 1; argv != nullptr && i < argc; i++)
    if (wcscmp(argv[i], L"--render") == 0)
      at = i;
  if (at < 0)
  {
    LocalFree(argv);
    return -1;
  }
  const int n = argc - at - 1;
  int code = 2;
  if (n >= 4)
  {
    const double sampleRate = _wtof(argv[at + 4]);
    const int block = n >= 5 ? _wtoi(argv[at + 5]) : 128;
    const int maxBlock = rig_init(sampleRate);
    const std::vector<char> capture = ReadAll(argv[at + 1]);
    const std::vector<char> raw = ReadAll(argv[at + 2]);
    if (block <= 0 || block > maxBlock || capture.empty())
      code = 2;
    else
    {
      char* text = rig_text_buffer(static_cast<int>(capture.size()));
      std::copy(capture.begin(), capture.end(), text);
      if (rig_load_model(static_cast<int>(capture.size())) != 0)
      {
        std::fprintf(stderr, "load failed: %s\n", rig_error());
        code = 1;
      }
      else
      {
        const size_t frames = raw.size() / sizeof(float);
        const float* input = reinterpret_cast<const float*>(raw.data());
        std::vector<float> output(frames);
        for (size_t i = 0; i < frames; i += static_cast<size_t>(block))
        {
          const int k = static_cast<int>(std::min<size_t>(static_cast<size_t>(block), frames - i));
          std::copy(input + i, input + i + k, rig_input());
          rig_process(k);
          std::copy(rig_output(), rig_output() + k, output.begin() + static_cast<ptrdiff_t>(i));
        }
        code = 1;
        if (FILE* out = _wfopen(argv[at + 3], L"wb"))
        {
          if (std::fwrite(output.data(), sizeof(float), frames, out) == frames)
            code = 0;
          std::fclose(out);
        }
      }
    }
  }
  LocalFree(argv);
  return code;
}
#endif
} // namespace

NeuralAmpModeler::NeuralAmpModeler(const InstanceInfo& info)
: Plugin(info, MakeConfig(0, kNumPresets))
{
#if defined(APP_API) && defined(OS_WIN)
  // A render runs here, before the window or the audio driver opens, and the process ends with its result.
  if (const int code = RenderIfAsked(); code >= 0)
    ExitProcess(static_cast<UINT>(code));
#endif
  // The window can shrink to a phone's width (the page lays itself out down to 400 px) and grow to any size.
  SetSizeConstraints(480, 100000, 400, 100000);
}

NeuralAmpModeler::~NeuralAmpModeler() { mView.Close(); }

void NeuralAmpModeler::ProcessBlock(sample** inputs, sample** outputs, int nFrames)
{
  mEngine.Process(inputs, NInChansConnected(), outputs, NOutChansConnected(), nFrames);
  mBlocks.fetch_add(1, std::memory_order_relaxed);
}

void NeuralAmpModeler::OnReset()
{
  // The standalone resets with its audio stopped (iPlug2's InitAudio), on the UI thread.
  mEngine.Reset(GetSampleRate());
  mStatusDirty = true;
}

void NeuralAmpModeler::OnIdle()
{
  // Every 20 ms on the UI thread (iPlug2's idle timer).
  mEngine.Collect();
  for (const std::string& reply : mLibrary.TakeReplies())
    Post(reply);
  const uint64_t now = GetTickCount64();
  const uint32_t blocks = mBlocks.load(std::memory_order_relaxed);
  if (blocks != mBlocksSeen)
  {
    mBlocksSeen = blocks;
    mBlocksMovedAt = now;
  }
  const bool running = mBlocksMovedAt != 0 && now - mBlocksMovedAt < 500;
  if (running != mAudioRunning)
  {
    mAudioRunning = running;
    mStatusDirty = true;
  }
  if (!mPageUp)
    return;
  // The driver's choices change in the Audio settings dialog, whose OK writes settings.ini after the reset: look
  // again now and then, and tell the page when anything changed.
  static uint64_t lookedAt = 0;
  if (mStatusDirty || now - lookedAt >= 1000)
  {
    lookedAt = now;
    mStatusDirty = false;
    PostStatus("status");
  }
  if (now - mMetersAt >= 33) // about 30 a second, as the web version's worklet sends them
  {
    mMetersAt = now;
    const rig::Meters m = mEngine.TakeMeters();
    char json[256];
    std::snprintf(json, sizeof json,
                  "{\"type\":\"meter\",\"input\":%.6g,\"raw\":%.6g,\"output\":%.6g,\"muted\":%d,\"hz\":%.6g,\"trips\":%d,"
                  "\"seconds\":%.6g}",
                  m.input, m.raw, m.output, m.muted, m.hz, m.trips, m.seconds);
    Post(json);
  }
}

void* NeuralAmpModeler::OpenWindow(void* pParent)
{
  mWindow = static_cast<HWND>(pParent);
  // A dark title bar from the start, before the window first shows (Rig's looks are dark but Daylight; the page says
  // which once it loads).
  SetDarkTitle(mWindow, true);
  mDarkTitle = true;
  // The window: the page at PLUG_WIDTH x PLUG_HEIGHT, or nine tenths of the monitor's work area where that is smaller.
  // iPlug2 sizes the window's client area to the editor's size, in pixels, and centres it.
  const float scale = GetScaleForHWND(mWindow);
  MONITORINFO mi{};
  mi.cbSize = sizeof mi;
  GetMonitorInfoW(MonitorFromWindow(mWindow, MONITOR_DEFAULTTONEAREST), &mi);
  const int fitW = (mi.rcWork.right - mi.rcWork.left) * 9 / 10;
  const int fitH = (mi.rcWork.bottom - mi.rcWork.top) * 9 / 10 - GetSystemMetrics(SM_CYCAPTION);
  SetEditorSize(std::min(static_cast<int>(PLUG_WIDTH * scale), fitW), std::min(static_cast<int>(PLUG_HEIGHT * scale), fitH));

  rig::WebViewHost::Options options;
  options.folder = ExeFolder() + L"web";
  options.dataFolder = SettingsFolder() + L"\\WebView2";
  options.host = kPageHost;
  options.page = L"index.html";
#ifdef _DEBUG
  options.devTools = true;
#else
  wchar_t dev[4] = {};
  options.devTools = GetEnvironmentVariableW(L"CRBN_RIG_DEVTOOLS", dev, 4) == 1 && dev[0] == L'1';
#endif
  if (GetFileAttributesW((options.folder + L"\\index.html").c_str()) == INVALID_FILE_ATTRIBUTES)
  {
    ShowFailure(L"CRBN Rig's page is missing from its folder (web\\index.html). Reinstall CRBN Rig from Pavillion Hub.");
    return mWindow;
  }
  std::wstring why;
  if (!mView.Open(
        mWindow, options, [this](const std::string& json) { OnPageMessage(json); }, [this] { OnPageLoaded(); },
        [this](const std::wstring& w) { ShowFailure(w); }, why))
    ShowFailure(why);
  return mWindow;
}

void NeuralAmpModeler::CloseWindow()
{
  mView.Close();
  mPageUp = false;
  if (mFailure != nullptr)
    DestroyWindow(mFailure);
  mFailure = nullptr;
  mWindow = nullptr;
}

void NeuralAmpModeler::OnParentWindowResize(int, int)
{
  if (mFailure == nullptr || mWindow == nullptr)
    return;
  RECT r;
  GetClientRect(mWindow, &r);
  MoveWindow(mFailure, 32, 32, std::max(0L, r.right - 64), std::max(0L, r.bottom - 64), TRUE);
}

bool NeuralAmpModeler::OnHostRequestingProductHelp()
{
  // Help goes to Pavillion Hub (D-CRBN-002).
  ShellExecuteA(nullptr, "open", CRBN_HELP_URL, nullptr, nullptr, SW_SHOWNORMAL);
  return true;
}

void NeuralAmpModeler::OnPageLoaded()
{
  // The page is the app from here: it has Audio settings, About and Help, so the old menu bar goes.
  if (mWindow != nullptr && GetMenu(mWindow) != nullptr)
    SetMenu(mWindow, nullptr);
}

void NeuralAmpModeler::ShowFailure(const std::wstring& why)
{
  OutputDebugStringW((L"CRBN Rig: " + why + L"\n").c_str());
  mView.Close();
  mPageUp = false;
  if (mWindow == nullptr)
    return;
  if (mFailure == nullptr)
  {
    mFailure = CreateWindowExW(0, L"STATIC", L"", WS_CHILD | WS_VISIBLE | SS_LEFT, 0, 0, 0, 0, mWindow, nullptr,
                               GetModuleHandleW(nullptr), nullptr);
    SendMessageW(mFailure, WM_SETFONT, reinterpret_cast<WPARAM>(GetStockObject(DEFAULT_GUI_FONT)), TRUE);
  }
  SetWindowTextW(mFailure, (L"CRBN Rig cannot show its window.\r\n\r\n" + why
                            + L"\r\n\r\nAudio settings and Quit are in the File menu above.")
                             .c_str());
  OnParentWindowResize(0, 0);
}

void NeuralAmpModeler::Post(const std::string& json)
{
  if (mPageUp)
    mView.Post(json);
}

void NeuralAmpModeler::PostStatus(const char* type)
{
  const std::wstring ini = SettingsFolder() + L"\\settings.ini";
  wchar_t buf[256];
  nlohmann::json s = {{"type", type}, {"version", PLUG_VERSION_STR}, {"sampleRate", mEngine.SampleRate()},
                      {"running", mAudioRunning}, {"runtime", rig::Narrow(mView.RuntimeVersion())}};
  // The driver's choices as the Audio settings dialog saved them (iPlug2's host keeps its live copy private).
  s["driver"] = GetPrivateProfileIntW(L"audio", L"driver", 0, ini.c_str()) == 1 ? "ASIO" : "DirectSound";
  GetPrivateProfileStringW(L"audio", L"indev", L"", buf, 256, ini.c_str());
  s["input"] = rig::Narrow(buf);
  GetPrivateProfileStringW(L"audio", L"outdev", L"", buf, 256, ini.c_str());
  s["output"] = rig::Narrow(buf);
  const int buffer = static_cast<int>(GetPrivateProfileIntW(L"audio", L"buffer", 0, ini.c_str()));
  s["buffer"] = buffer;
  s["latencyMs"] = buffer > 0 ? std::round(1000.0 * buffer / mEngine.SampleRate() * 10.0) / 10.0 : 0.0;
  const std::string text = Dump(s);
  static std::string last;
  if (std::string(type) == "status" && text == last)
    return;
  last = text;
  Post(text);
}

void NeuralAmpModeler::OnPageMessage(const std::string& text)
{
  const nlohmann::json m = nlohmann::json::parse(text, nullptr, false);
  if (!m.is_object())
    return;
  const auto num = [&](const char* k, double d = 0.0) {
    const auto it = m.find(k);
    return it != m.end() && it->is_number() ? it->get<double>() : d;
  };
  const auto flag = [&](const char* k) {
    const auto it = m.find(k);
    return it != m.end() && it->is_boolean() && it->get<bool>();
  };
  const auto str = [&](const char* k) {
    const auto it = m.find(k);
    return it != m.end() && it->is_string() ? it->get<std::string>() : std::string();
  };
  const std::string type = str("type");

  if (type == "hello")
  {
    mPageUp = true;
    PostStatus("ready");
  }
  else if (type == "param")
    mEngine.SetParam(static_cast<int>(num("id", -1)), num("value"));
  else if (type == "capture")
  {
    rig::CaptureInfo info;
    std::string error;
    nlohmann::json reply = {{"type", "capture"}, {"id", num("id")}};
    if (mEngine.StageCapture(str("text"), info, error))
    {
      reply["ok"] = true;
      reply["info"] = {{"loudness", info.hasLoudness ? nlohmann::json(info.loudness) : nlohmann::json()},
                       {"inputLevel", info.hasInputLevel ? nlohmann::json(info.inputLevel) : nlohmann::json()},
                       {"outputLevel", info.hasOutputLevel ? nlohmann::json(info.outputLevel) : nlohmann::json()},
                       {"sampleRate", info.sampleRate},
                       {"slimmable", info.slimmable},
                       {"latencyFrames", info.latencyFrames}};
    }
    else
    {
      reply["ok"] = false;
      reply["error"] = error;
    }
    Post(Dump(reply));
  }
  else if (type == "clearCapture")
  {
    mEngine.ClearCapture();
    Post(Dump({{"type", "capture"}, {"id", num("id")}, {"ok", true}, {"info", nullptr}}));
  }
  else if (type == "ir")
  {
    double seconds = 0.0;
    std::string error;
    nlohmann::json reply = {{"type", "ir"}, {"id", num("id")}};
    if (mEngine.StageIR(DecodeFloats(str("samples")), num("rate"), seconds, error))
    {
      reply["ok"] = true;
      reply["seconds"] = seconds;
    }
    else
    {
      reply["ok"] = false;
      reply["error"] = error;
    }
    Post(Dump(reply));
  }
  else if (type == "clearIR")
    mEngine.ClearIR();
  else if (type == "irOn")
    mEngine.SetIROn(flag("on"));
  else if (type == "standby")
    mEngine.SetStandby(flag("on"));
  else if (type == "source")
  {
    const std::string s = str("source");
    mEngine.SetSource(s == "live" ? rig::Source::kLive : s == "demo" ? rig::Source::kDemo : rig::Source::kNone);
  }
  else if (type == "demo")
  {
    std::string error;
    const bool ok = mEngine.SetDemo(DecodeFloats(str("samples")), num("rate"), error);
    Post(Dump({{"type", "demo"}, {"id", num("id")}, {"ok", ok}, {"error", error}}));
  }
  else if (type == "libPick")
  {
    // The folder dialog opens after this message returns, outside WebView2's callback.
    const double id = num("id");
    const std::wstring start = rig::Widen(str("start"));
    mView.Defer([this, id, start] {
      std::wstring picked;
      const bool ok = mWindow != nullptr && rig::Library::PickFolder(mWindow, start, picked);
      nlohmann::json reply = {{"type", "libPick"}, {"id", id}, {"ok", ok}};
      if (ok)
        reply["path"] = rig::Narrow(picked);
      Post(Dump(reply));
    });
  }
  else if (type == "libList")
    mLibrary.List(num("id"), str("folder"));
  else if (type == "libMeta")
  {
    std::vector<std::string> paths;
    if (const auto it = m.find("paths"); it != m.end() && it->is_array())
      for (const auto& p : *it)
        if (p.is_string())
          paths.push_back(p.get<std::string>());
    mLibrary.Meta(num("id"), str("folder"), std::move(paths));
  }
  else if (type == "libRead")
    mLibrary.Read(num("id"), str("folder"), str("path"));
  else if (type == "libWatch")
    mLibrary.Watch(str("folder"));
#if defined(APP_API)
  else if (type == "audioSettings" && mWindow != nullptr)
    PostMessageW(mWindow, WM_COMMAND, MAKEWPARAM(ID_PREFERENCES, 0), 0); // after this message returns, not inside it
#endif
  else if (type == "chrome" && mWindow != nullptr)
  {
    // The title bar follows the page's look: dark or light, and its ground on Windows 11.
    const bool dark = flag("dark");
    if (dark != mDarkTitle)
    {
      mDarkTitle = dark;
      SetDarkTitle(mWindow, dark);
      // Windows 10 draws the new frame only when the frame repaints.
      SetWindowPos(mWindow, nullptr, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED);
    }
    const std::string c = str("caption");
    if (c.size() == 7 && c[0] == '#' && std::all_of(c.begin() + 1, c.end(), [](char x) { return std::isxdigit(static_cast<unsigned char>(x)) != 0; }))
    {
      const unsigned long v = std::stoul(c.substr(1), nullptr, 16);
      const COLORREF ref = RGB((v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff);
      DwmSetWindowAttribute(mWindow, 35 /* DWMWA_CAPTION_COLOR, Windows 11 */, &ref, sizeof ref);
    }
  }
}
