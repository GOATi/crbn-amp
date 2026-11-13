// CRBN Rig's half of "Use this look in every CRBN app" on the desktop: %APPDATA%\CRBN\suite-look.json (RigSuiteLook.h).
#include "RigSuiteLook.h"

#include <vector>

#include <windows.h>
#include <shlobj.h>

#include "RigWebView.h" // Narrow

namespace rig
{
namespace
{
constexpr uint64_t kMaxBytes = 16 * 1024; // as suite.rs: a hostile or broken file is small or ignored
constexpr uint64_t kPollMs = 900;

std::wstring DefaultPath()
{
  wchar_t env[1024];
  const DWORD n = GetEnvironmentVariableW(L"CRBN_SUITE_LOOK", env, 1024);
  if (n > 0 && n < 1024)
  {
    const std::wstring v(env, n);
    return v == L"off" ? std::wstring() : v;
  }
  PWSTR roaming = nullptr;
  std::wstring path;
  if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_RoamingAppData, 0, nullptr, &roaming)))
    path = std::wstring(roaming) + L"\\CRBN\\suite-look.json";
  CoTaskMemFree(roaming);
  return path;
}

// The file's object as suite.rs's Shared::parse takes it: version 1, `every` true or false, `prefs` an object; `from`
// kept to 32 characters. Anything else is no file.
nlohmann::json Valid(const nlohmann::json& v)
{
  if (!v.is_object())
    return nullptr;
  const auto version = v.find("version"), every = v.find("every"), prefs = v.find("prefs"), from = v.find("from");
  if (version == v.end() || !version->is_number_integer() || version->get<int64_t>() != 1)
    return nullptr;
  if (every == v.end() || !every->is_boolean() || prefs == v.end() || !prefs->is_object())
    return nullptr;
  std::string by = from != v.end() && from->is_string() ? from->get<std::string>() : std::string();
  if (by.size() > 32)
    by.resize(32);
  return {{"version", 1}, {"every", every->get<bool>()}, {"from", by}, {"prefs", *prefs}};
}
} // namespace

SuiteLook::SuiteLook()
  : mPath(DefaultPath())
{
  mLast = Read();
}

nlohmann::json SuiteLook::Read()
{
  mStamp = 0;
  mSize = 0;
  WIN32_FILE_ATTRIBUTE_DATA a{};
  if (mPath.empty() || !GetFileAttributesExW(mPath.c_str(), GetFileExInfoStandard, &a))
    return nullptr;
  mStamp = (static_cast<uint64_t>(a.ftLastWriteTime.dwHighDateTime) << 32) | a.ftLastWriteTime.dwLowDateTime;
  mSize = (static_cast<uint64_t>(a.nFileSizeHigh) << 32) | a.nFileSizeLow;
  if (mSize > kMaxBytes || (a.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0)
    return nullptr;
  // Another app may be renaming its new copy into place: share everything, and take what is there now.
  const HANDLE f = CreateFileW(mPath.c_str(), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                               nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (f == INVALID_HANDLE_VALUE)
    return nullptr;
  std::string text(static_cast<size_t>(kMaxBytes) + 1, '\0');
  DWORD got = 0;
  const BOOL ok = ReadFile(f, text.data(), static_cast<DWORD>(text.size()), &got, nullptr);
  CloseHandle(f);
  if (!ok || got > kMaxBytes)
    return nullptr;
  text.resize(got);
  return Valid(nlohmann::json::parse(text, nullptr, false));
}

bool SuiteLook::Poll(uint64_t nowMs)
{
  if (mPath.empty() || (mCheckedAt != 0 && nowMs - mCheckedAt < kPollMs))
    return false;
  mCheckedAt = nowMs;
  WIN32_FILE_ATTRIBUTE_DATA a{};
  uint64_t stamp = 0, size = 0;
  if (GetFileAttributesExW(mPath.c_str(), GetFileExInfoStandard, &a))
  {
    stamp = (static_cast<uint64_t>(a.ftLastWriteTime.dwHighDateTime) << 32) | a.ftLastWriteTime.dwLowDateTime;
    size = (static_cast<uint64_t>(a.nFileSizeHigh) << 32) | a.nFileSizeLow;
  }
  if (stamp == mStamp && size == mSize)
    return false;
  nlohmann::json now = Read();
  if (now == mLast)
    return false;
  mLast = std::move(now);
  return true;
}

bool SuiteLook::Set(bool every, const nlohmann::json& prefs, std::string& error)
{
  mLast = {{"version", 1}, {"every", every}, {"from", "rig"}, {"prefs", prefs.is_object() ? prefs : nlohmann::json::object()}};
  if (mPath.empty())
    return true; // turned off: the switch holds in Rig alone
  const std::string text =
    mLast.dump(2, ' ', false, nlohmann::json::error_handler_t::replace) + "\n";
  if (text.size() > kMaxBytes)
  {
    error = "the look is too large to share";
    return false;
  }
  const size_t slash = mPath.find_last_of(L"\\/");
  if (slash != std::wstring::npos)
  {
    const std::wstring dir = mPath.substr(0, slash);
    if (!CreateDirectoryW(dir.c_str(), nullptr) && GetLastError() != ERROR_ALREADY_EXISTS)
    {
      error = Narrow(dir) + ": cannot make the folder (" + std::to_string(GetLastError()) + ")";
      return false;
    }
  }
  // Whole, through a temporary file and a rename, as suite.rs writes it, so a reader never sees half a file.
  const std::wstring tmp = mPath + L"." + std::to_wstring(GetCurrentProcessId()) + L".tmp";
  const HANDLE f = CreateFileW(tmp.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (f == INVALID_HANDLE_VALUE)
  {
    error = Narrow(tmp) + ": cannot write (" + std::to_string(GetLastError()) + ")";
    return false;
  }
  DWORD put = 0;
  const BOOL wrote = WriteFile(f, text.data(), static_cast<DWORD>(text.size()), &put, nullptr);
  CloseHandle(f);
  if (!wrote || put != text.size() || !MoveFileExW(tmp.c_str(), mPath.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH))
  {
    error = Narrow(mPath) + ": cannot write (" + std::to_string(GetLastError()) + ")";
    DeleteFileW(tmp.c_str());
    return false;
  }
  // What was written is what the file says: the next Poll sees no change from this app's own write.
  Read();
  return true;
}
} // namespace rig
