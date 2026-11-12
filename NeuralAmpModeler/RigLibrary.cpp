// CRBN Rig's library in the desktop app: see RigLibrary.h. The reading rules mirror web/src/library.js line for line
// (namInfo, wavInfo); packaging/windows/check.mjs compares the two on NAM Core's example captures.
#include "RigLibrary.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <cwctype>

#include <shobjidl.h>
#include <wrl/client.h>

#include "RigWebView.h" // Widen, Narrow
#include "json.hpp"

namespace rig
{
namespace
{
using nlohmann::json;
constexpr size_t kHeadBytes = 16384; // library.js HEAD_BYTES
constexpr size_t kTailBytes = 8192; // TAIL_BYTES
constexpr size_t kWavHeadBytes = 65536; // WAV_HEAD_BYTES
constexpr size_t kMaxFiles = 50000;
constexpr int kMaxDepth = 12;
constexpr uint64_t kMaxRead = 64ull * 1024 * 1024;

std::string Dump(const json& j) { return j.dump(-1, ' ', false, json::error_handler_t::replace); }

// ---- reading a capture (library.js namInfo) ---------------------------------------------------------------------
bool IsWs(char c) { return c == ' ' || c == '\t' || c == '\n' || c == '\r'; }

// The index of the quote closing the string opened at i, or npos.
size_t StringEnd(const std::string& s, size_t i)
{
  for (size_t j = i + 1; j < s.size(); j++)
  {
    if (s[j] == '\\')
      j++;
    else if (s[j] == '"')
      return j;
  }
  return std::string::npos;
}

// The index of the brace closing the object opened at k, or npos.
size_t ObjectEnd(const std::string& s, size_t k)
{
  int depth = 0;
  for (size_t j = k; j < s.size(); j++)
  {
    const char c = s[j];
    if (c == '"')
    {
      j = StringEnd(s, j);
      if (j == std::string::npos)
        return std::string::npos;
    }
    else if (c == '{')
      depth++;
    else if (c == '}' && --depth == 0)
      return j;
  }
  return std::string::npos;
}

// After a key's closing quote: the index of its value's '{', or npos.
size_t ObjectAfterKey(const std::string& s, size_t end)
{
  size_t j = end + 1;
  while (j < s.size() && IsWs(s[j]))
    j++;
  if (j >= s.size() || s[j] != ':')
    return std::string::npos;
  j++;
  while (j < s.size() && IsWs(s[j]))
    j++;
  return j < s.size() && s[j] == '{' ? j : std::string::npos;
}

// The head's top-level "metadata" object, else the first nested one.
void HeadMetadata(const std::string& s, std::string& top, bool& hasTop, std::string& nested, bool& hasNested)
{
  int depth = 0;
  for (size_t i = 0; i < s.size(); i++)
  {
    const char c = s[i];
    if (c == '"')
    {
      const size_t end = StringEnd(s, i);
      if (end == std::string::npos)
        break;
      if (end - i == 9 && s.compare(i + 1, 8, "metadata") == 0)
      {
        const size_t k = ObjectAfterKey(s, end);
        const size_t e = k == std::string::npos ? std::string::npos : ObjectEnd(s, k);
        if (e != std::string::npos)
        {
          if (depth == 1)
          {
            top = s.substr(k, e - k + 1);
            hasTop = true;
            return;
          }
          if (!hasNested)
          {
            nested = s.substr(k, e - k + 1);
            hasNested = true;
          }
        }
      }
      i = end;
    }
    else if (c == '{' || c == '[')
      depth++;
    else if (c == '}' || c == ']')
      depth--;
  }
}

// The tail's last "metadata" object that closes in it.
bool TailMetadata(const std::string& t, std::string& out)
{
  static const std::string key = "\"metadata\"";
  for (size_t at = t.rfind(key); at != std::string::npos; at = at > 0 ? t.rfind(key, at - 1) : std::string::npos)
  {
    const size_t k = ObjectAfterKey(t, at + 9);
    const size_t e = k == std::string::npos ? std::string::npos : ObjectEnd(t, k);
    if (e != std::string::npos)
    {
      out = t.substr(k, e - k + 1);
      return true;
    }
  }
  return false;
}

// The last "sample_rate": <number> in t, or 0 (library.js lastSampleRate's /"sample_rate"\s*:\s*(\d+(?:\.\d+)?)/).
double LastSampleRate(const std::string& t)
{
  static const std::string key = "\"sample_rate\"";
  for (size_t at = t.rfind(key); at != std::string::npos; at = at > 0 ? t.rfind(key, at - 1) : std::string::npos)
  {
    size_t j = at + key.size();
    while (j < t.size() && IsWs(t[j]))
      j++;
    if (j >= t.size() || t[j] != ':')
      continue;
    j++;
    while (j < t.size() && IsWs(t[j]))
      j++;
    const size_t start = j;
    while (j < t.size() && t[j] >= '0' && t[j] <= '9')
      j++;
    if (j == start)
      continue;
    if (j + 1 < t.size() && t[j] == '.' && t[j + 1] >= '0' && t[j + 1] <= '9')
    {
      j++;
      while (j < t.size() && t[j] >= '0' && t[j] <= '9')
        j++;
    }
    const double rate = std::strtod(t.substr(start, j - start).c_str(), nullptr);
    return rate > 0 ? rate : 0.0;
  }
  return 0.0;
}

uint32_t U32(const std::string& b, size_t at)
{
  return static_cast<uint32_t>(static_cast<unsigned char>(b[at])) | static_cast<uint32_t>(static_cast<unsigned char>(b[at + 1])) << 8
         | static_cast<uint32_t>(static_cast<unsigned char>(b[at + 2])) << 16
         | static_cast<uint32_t>(static_cast<unsigned char>(b[at + 3])) << 24;
}
uint16_t U16(const std::string& b, size_t at)
{
  return static_cast<uint16_t>(static_cast<unsigned char>(b[at]) | static_cast<unsigned char>(b[at + 1]) << 8);
}

// ---- paths ------------------------------------------------------------------------------------------------------
// The folder as a long path (\\?\D:\Tones, \\?\UNC\server\share\Tones), without a trailing separator; empty when it is
// not an absolute path.
std::wstring LongFolder(const std::string& folder)
{
  std::wstring f = Widen(folder);
  for (wchar_t& c : f)
    if (c == L'/')
      c = L'\\';
  while (!f.empty() && f.back() == L'\\')
    f.pop_back();
  if (f.rfind(L"\\\\?\\", 0) == 0)
    return f;
  if (f.size() >= 2 && std::iswalpha(f[0]) && f[1] == L':' && (f.size() == 2 || f[2] == L'\\'))
    return L"\\\\?\\" + f;
  if (f.rfind(L"\\\\", 0) == 0 && f.size() > 2)
    return L"\\\\?\\UNC\\" + f.substr(2);
  return L"";
}

bool EndsWithNoCase(const std::wstring& s, const wchar_t* tail)
{
  const size_t n = std::wcslen(tail);
  return s.size() >= n && _wcsicmp(s.c_str() + s.size() - n, tail) == 0;
}

// A .nam or a .wav, not hidden by a leading dot (library.js wanted).
bool Wanted(const std::wstring& name, bool* wav = nullptr)
{
  const size_t slash = name.find_last_of(L'\\');
  const std::wstring base = slash == std::wstring::npos ? name : name.substr(slash + 1);
  if (base.empty() || base[0] == L'.')
    return false;
  const bool isWav = EndsWithNoCase(base, L".wav");
  if (wav != nullptr)
    *wav = isWav;
  return isWav || EndsWithNoCase(base, L".nam");
}

// A page's relative path (parts joined by '/') as "\part\part"; false for "", ".", "..", or a part holding '\', ':'
// or a control character.
bool RelativePath(const std::string& rel, std::wstring& out)
{
  const std::wstring w = Widen(rel);
  if (w.empty() || w.size() > 4000)
    return false;
  out.clear();
  std::wstring part;
  const auto flush = [&] {
    if (part.empty() || part == L"." || part == L"..")
      return false;
    out += L'\\';
    out += part;
    part.clear();
    return true;
  };
  for (const wchar_t c : w)
  {
    if (c == L'/')
    {
      if (!flush())
        return false;
    }
    else if (c == L'\\' || c == L':' || c < 32)
      return false;
    else
      part += c;
  }
  return flush();
}

int64_t FileTimeMs(const FILETIME& t)
{
  const uint64_t v = (static_cast<uint64_t>(t.dwHighDateTime) << 32) | t.dwLowDateTime;
  return static_cast<int64_t>(v / 10000) - 11644473600000LL; // since 1601, in 100 ns, to since 1970, in ms
}

void Walk(const std::wstring& base, const std::wstring& rel, int depth, json& files, bool& truncated)
{
  WIN32_FIND_DATAW fd;
  const HANDLE h = FindFirstFileExW((base + rel + L"\\*").c_str(), FindExInfoBasic, &fd, FindExSearchNameMatch, nullptr,
                                    FIND_FIRST_EX_LARGE_FETCH);
  if (h == INVALID_HANDLE_VALUE)
    return;
  std::vector<std::wstring> subs;
  do
  {
    const std::wstring name = fd.cFileName;
    if (name.empty() || name[0] == L'.')
      continue;
    const std::wstring path = rel + L"\\" + name;
    if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY)
    {
      // Not through links (a loop), nor into the system's own hidden folders ($RECYCLE.BIN and the like).
      const DWORD skip = FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM;
      if (depth < kMaxDepth && !(fd.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) && (fd.dwFileAttributes & skip) != skip)
        subs.push_back(path);
      continue;
    }
    if (!Wanted(name))
      continue;
    if (files.size() >= kMaxFiles)
    {
      truncated = true;
      break;
    }
    std::string p = Narrow(path.substr(1));
    std::replace(p.begin(), p.end(), '\\', '/');
    files.push_back({{"p", p},
                     {"s", (static_cast<uint64_t>(fd.nFileSizeHigh) << 32) | fd.nFileSizeLow},
                     {"m", FileTimeMs(fd.ftLastWriteTime)}});
  } while (FindNextFileW(h, &fd));
  FindClose(h);
  for (const std::wstring& sub : subs)
  {
    if (truncated)
      break;
    Walk(base, sub, depth + 1, files, truncated);
  }
}

// An open file, closed when it goes.
struct File
{
  HANDLE h = INVALID_HANDLE_VALUE;
  uint64_t size = 0;
  explicit File(const std::wstring& path)
  {
    h = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr,
                    OPEN_EXISTING, FILE_FLAG_SEQUENTIAL_SCAN, nullptr);
    LARGE_INTEGER s{};
    if (h != INVALID_HANDLE_VALUE && GetFileSizeEx(h, &s))
      size = static_cast<uint64_t>(s.QuadPart);
  }
  ~File()
  {
    if (h != INVALID_HANDLE_VALUE)
      CloseHandle(h);
  }
  bool Ok() const { return h != INVALID_HANDLE_VALUE; }
  std::string ReadAt(uint64_t at, uint64_t n) const
  {
    std::string b(static_cast<size_t>(n), '\0');
    LARGE_INTEGER pos;
    pos.QuadPart = static_cast<LONGLONG>(at);
    size_t got = 0;
    if (SetFilePointerEx(h, pos, nullptr, FILE_BEGIN))
    {
      while (got < b.size())
      {
        DWORD chunk = 0;
        const DWORD want = static_cast<DWORD>(std::min<size_t>(b.size() - got, 1u << 24));
        if (!ReadFile(h, b.data() + got, want, &chunk, nullptr) || chunk == 0)
          break;
        got += chunk;
      }
    }
    b.resize(got);
    return b;
  }
};

std::string Base64(const std::string& in)
{
  static const char* const t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string out;
  out.reserve((in.size() + 2) / 3 * 4);
  size_t i = 0;
  for (; i + 2 < in.size(); i += 3)
  {
    const uint32_t v = static_cast<unsigned char>(in[i]) << 16 | static_cast<unsigned char>(in[i + 1]) << 8 | static_cast<unsigned char>(in[i + 2]);
    out += t[v >> 18];
    out += t[(v >> 12) & 63];
    out += t[(v >> 6) & 63];
    out += t[v & 63];
  }
  if (i < in.size())
  {
    const uint32_t v = static_cast<unsigned char>(in[i]) << 16 | (i + 1 < in.size() ? static_cast<unsigned char>(in[i + 1]) << 8 : 0);
    out += t[v >> 18];
    out += t[(v >> 12) & 63];
    out += i + 1 < in.size() ? t[(v >> 6) & 63] : '=';
    out += '=';
  }
  return out;
}

json MetaOf(const std::wstring& base, const std::string& rel)
{
  json item = {{"p", rel}};
  std::wstring r;
  bool wav = false;
  if (!RelativePath(rel, r) || !Wanted(r, &wav))
  {
    item["error"] = "not a capture or an IR";
    return item;
  }
  const File f(base + r);
  if (!f.Ok())
  {
    item["error"] = "could not be opened";
    return item;
  }
  if (wav)
  {
    const WavInfo w = ReadWavInfo(f.ReadAt(0, std::min<uint64_t>(f.size, kWavHeadBytes)), f.size);
    item["wav"] = w.ok ? json{{"rate", w.rate}, {"channels", w.channels}, {"bits", w.bits}, {"seconds", w.seconds}} : json();
    return item;
  }
  const std::string head = f.ReadAt(0, std::min<uint64_t>(f.size, kHeadBytes));
  const std::string tail = f.size <= kHeadBytes ? head : f.ReadAt(f.size - kTailBytes, kTailBytes);
  const NamInfo n = ReadNamInfo(head, tail);
  item["metadata"] = n.hasMetadata ? json(n.metadata) : json();
  item["rate"] = n.rate > 0 ? json(n.rate) : json();
  return item;
}
} // namespace

NamInfo ReadNamInfo(const std::string& head, const std::string& tail)
{
  NamInfo info;
  std::string top, nested;
  bool hasTop = false, hasNested = false;
  HeadMetadata(head, top, hasTop, nested, hasNested);
  if (hasTop)
  {
    info.metadata = top;
    info.hasMetadata = true;
  }
  else if (TailMetadata(tail, info.metadata))
    info.hasMetadata = true;
  else if (hasNested)
  {
    info.metadata = nested;
    info.hasMetadata = true;
  }
  info.rate = LastSampleRate(tail);
  return info;
}

WavInfo ReadWavInfo(const std::string& b, uint64_t size)
{
  WavInfo w;
  if (b.size() < 12 || b.compare(0, 4, "RIFF") != 0 || b.compare(8, 4, "WAVE") != 0)
    return w;
  size_t p = 12;
  bool fmt = false, hasData = false;
  uint32_t rate = 0;
  uint16_t channels = 0, align = 0, bits = 0;
  uint64_t data = 0;
  while (p + 8 <= b.size())
  {
    const uint32_t len = U32(b, p + 4);
    if (b.compare(p, 4, "fmt ") == 0 && p + 24 <= b.size())
    {
      fmt = true;
      channels = U16(b, p + 10);
      rate = U32(b, p + 12);
      align = U16(b, p + 20);
      bits = U16(b, p + 22);
    }
    else if (b.compare(p, 4, "data") == 0)
    {
      const uint64_t avail = size > p + 8 ? size - (p + 8) : 0;
      data = len == 0 || len == 0xffffffffu || len > avail ? avail : len;
      hasData = true;
      break;
    }
    p += 8 + static_cast<size_t>(len) + (len & 1);
  }
  if (!fmt || rate == 0 || align == 0)
    return w;
  if (!hasData)
    data = size > p + 8 ? size - p - 8 : 0;
  w.ok = true;
  w.rate = rate;
  w.channels = channels;
  w.bits = bits;
  w.seconds = std::round(static_cast<double>(data) / align / rate * 1e6) / 1e6;
  return w;
}

Library::Library()
{
  mWorker = std::thread([this] {
    for (;;)
    {
      std::function<void()> job;
      {
        std::unique_lock<std::mutex> lock(mMutex);
        mWake.wait(lock, [this] { return mStop || !mJobs.empty(); });
        if (mStop)
          return;
        job = std::move(mJobs.front());
        mJobs.pop_front();
      }
      job();
    }
  });
}

Library::~Library()
{
  StopWatch();
  {
    std::lock_guard<std::mutex> lock(mMutex);
    mStop = true;
  }
  mWake.notify_all();
  if (mWorker.joinable())
    mWorker.join();
}

void Library::Run(std::function<void()> job)
{
  {
    std::lock_guard<std::mutex> lock(mMutex);
    mJobs.push_back(std::move(job));
  }
  mWake.notify_one();
}

void Library::Reply(std::string json)
{
  std::lock_guard<std::mutex> lock(mOutMutex);
  mOut.push_back(std::move(json));
}

std::vector<std::string> Library::TakeReplies()
{
  std::lock_guard<std::mutex> lock(mOutMutex);
  std::vector<std::string> out;
  out.swap(mOut);
  return out;
}

void Library::List(double id, const std::string& folder)
{
  Run([this, id, folder] {
    json reply = {{"type", "libList"}, {"id", id}};
    const std::wstring base = LongFolder(folder);
    const DWORD attr = base.empty() ? INVALID_FILE_ATTRIBUTES : GetFileAttributesW((base + L"\\").c_str());
    if (attr == INVALID_FILE_ATTRIBUTES || !(attr & FILE_ATTRIBUTE_DIRECTORY))
    {
      reply["ok"] = false;
      reply["error"] = "That folder is not there any more.";
    }
    else
    {
      json files = json::array();
      bool truncated = false;
      Walk(base, L"", 0, files, truncated);
      reply["ok"] = true;
      reply["files"] = std::move(files);
      reply["truncated"] = truncated;
    }
    Reply(Dump(reply));
  });
}

void Library::Meta(double id, const std::string& folder, std::vector<std::string> paths)
{
  Run([this, id, folder, paths = std::move(paths)] {
    const std::wstring base = LongFolder(folder);
    json items = json::array();
    for (const std::string& p : paths)
    {
      if (base.empty())
        items.push_back({{"p", p}, {"error", "not a folder"}});
      else
        items.push_back(MetaOf(base, p));
    }
    Reply(Dump({{"type", "libMeta"}, {"id", id}, {"items", std::move(items)}}));
  });
}

void Library::Read(double id, const std::string& folder, const std::string& path)
{
  Run([this, id, folder, path] {
    json reply = {{"type", "libRead"}, {"id", id}, {"ok", false}};
    const std::wstring base = LongFolder(folder);
    std::wstring r;
    if (base.empty() || !RelativePath(path, r) || !Wanted(r))
      reply["error"] = "CRBN Rig reads only .nam captures and .wav IRs in your library folder.";
    else
    {
      const File f(base + r);
      if (!f.Ok())
        reply["error"] = "That file is not there any more.";
      else if (f.size > kMaxRead)
        reply["error"] = "That file is larger than a capture or an IR should be.";
      else
      {
        const std::string bytes = f.ReadAt(0, f.size);
        if (bytes.size() != f.size)
          reply["error"] = "That file could not be read.";
        else
        {
          reply["ok"] = true;
          reply["b64"] = Base64(bytes);
        }
      }
    }
    Reply(Dump(reply));
  });
}

void Library::StopWatch()
{
  if (mWatchStop != nullptr)
    SetEvent(mWatchStop);
  if (mWatcher.joinable())
    mWatcher.join();
  if (mWatchStop != nullptr)
    CloseHandle(mWatchStop);
  mWatchStop = nullptr;
  mWatching.clear();
}

void Library::Watch(const std::string& folder)
{
  if (folder == mWatching && (folder.empty() || mWatcher.joinable()))
    return;
  StopWatch();
  const std::wstring base = LongFolder(folder);
  if (base.empty())
    return;
  // A drive's root needs its separator (\\?\D:\); a folder does not.
  const std::wstring at = base.size() == 6 && base[5] == L':' ? base + L"\\" : base;
  const HANDLE change = FindFirstChangeNotificationW(at.c_str(), TRUE,
                                                     FILE_NOTIFY_CHANGE_FILE_NAME | FILE_NOTIFY_CHANGE_DIR_NAME
                                                       | FILE_NOTIFY_CHANGE_SIZE | FILE_NOTIFY_CHANGE_LAST_WRITE);
  if (change == INVALID_HANDLE_VALUE)
    return;
  mWatching = folder;
  mWatchStop = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  const HANDLE stop = mWatchStop;
  mWatcher = std::thread([this, change, stop] {
    const HANDLE both[2] = {stop, change};
    for (;;)
    {
      if (WaitForMultipleObjects(2, both, FALSE, INFINITE) != WAIT_OBJECT_0 + 1)
        break;
      // Quiet for 0.8 s before saying so: copying a hundred captures in is one change.
      bool stopped = false;
      for (;;)
      {
        if (!FindNextChangeNotification(change))
        {
          stopped = true;
          break;
        }
        const DWORD w = WaitForMultipleObjects(2, both, FALSE, 800);
        if (w == WAIT_TIMEOUT)
          break;
        if (w != WAIT_OBJECT_0 + 1)
        {
          stopped = true;
          break;
        }
      }
      if (stopped)
        break;
      Reply("{\"type\":\"libChanged\"}");
    }
    FindCloseChangeNotification(change);
  });
}

bool Library::PickFolder(HWND owner, const std::wstring& start, std::wstring& picked)
{
  Microsoft::WRL::ComPtr<IFileOpenDialog> dialog;
  if (FAILED(CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dialog))))
    return false;
  DWORD options = 0;
  dialog->GetOptions(&options);
  dialog->SetOptions(options | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST);
  dialog->SetTitle(L"Choose the folder with your captures and IRs");
  dialog->SetOkButtonLabel(L"Use this folder");
  if (!start.empty())
  {
    Microsoft::WRL::ComPtr<IShellItem> folder;
    if (SUCCEEDED(SHCreateItemFromParsingName(start.c_str(), nullptr, IID_PPV_ARGS(&folder))))
      dialog->SetFolder(folder.Get());
  }
  if (dialog->Show(owner) != S_OK)
    return false;
  Microsoft::WRL::ComPtr<IShellItem> item;
  PWSTR path = nullptr;
  if (FAILED(dialog->GetResult(&item)) || FAILED(item->GetDisplayName(SIGDN_FILESYSPATH, &path)) || path == nullptr)
    return false;
  picked = path;
  CoTaskMemFree(path);
  return true;
}
} // namespace rig
