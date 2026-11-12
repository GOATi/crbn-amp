// CRBN Rig's page in the desktop app: see RigWebView.h.
#include "RigWebView.h"

#include <cwchar>
#include <utility>

#include <commctrl.h>
#include <shellapi.h>
#include <shlobj.h>
#include <wrl.h>

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;

namespace rig
{
namespace
{
using CreateEnvironmentFn = HRESULT(STDAPICALLTYPE*)(PCWSTR, PCWSTR, ICoreWebView2EnvironmentOptions*,
                                                     ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler*);
using RuntimeVersionFn = HRESULT(STDAPICALLTYPE*)(PCWSTR, LPWSTR*);
constexpr UINT_PTR kSubclassId = 0x52494721; // 'RIG!'
constexpr UINT kDeferMessage = WM_APP + 0x52; // Defer's: the parent window runs what was deferred

// WebView2Loader.dll beside the exe (WebView2/, vendored, D-RIG-017), loaded once and kept for the process's life:
// the runtime's objects live in it.
HMODULE Loader()
{
  static const HMODULE module = [] {
    std::wstring path(MAX_PATH, L'\0');
    for (;;)
    {
      const DWORD n = GetModuleFileNameW(nullptr, path.data(), static_cast<DWORD>(path.size()));
      if (n == 0)
        return static_cast<HMODULE>(nullptr);
      if (n < path.size())
      {
        path.resize(n);
        break;
      }
      path.resize(path.size() * 2);
    }
    path = path.substr(0, path.find_last_of(L"\\/") + 1) + L"WebView2Loader.dll";
    return LoadLibraryExW(path.c_str(), nullptr, LOAD_WITH_ALTERED_SEARCH_PATH);
  }();
  return module;
}

std::wstring Hex(HRESULT hr)
{
  wchar_t b[16];
  swprintf(b, 16, L"0x%08X", static_cast<unsigned>(hr));
  return b;
}

bool StartsWithNoCase(const std::wstring& s, const std::wstring& prefix)
{
  return s.size() >= prefix.size() && _wcsnicmp(s.c_str(), prefix.c_str(), prefix.size()) == 0;
}

// Takes a string the runtime allocated.
std::wstring Take(LPWSTR s)
{
  std::wstring w = s ? s : L"";
  CoTaskMemFree(s);
  return w;
}
} // namespace

std::wstring Widen(const std::string& s)
{
  if (s.empty())
    return {};
  const int n = MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), nullptr, 0);
  std::wstring w(static_cast<size_t>(n), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), w.data(), n);
  return w;
}

std::string Narrow(const std::wstring& w)
{
  if (w.empty())
    return {};
  const int n = WideCharToMultiByte(CP_UTF8, 0, w.data(), static_cast<int>(w.size()), nullptr, 0, nullptr, nullptr);
  std::string s(static_cast<size_t>(n), '\0');
  WideCharToMultiByte(CP_UTF8, 0, w.data(), static_cast<int>(w.size()), s.data(), n, nullptr, nullptr);
  return s;
}

bool WebViewHost::Open(HWND parent, const Options& options, OnMessage onMessage, OnLoaded onLoaded,
                       OnFailure onFailure, std::wstring& why)
{
  Close();
  const HMODULE loader = Loader();
  if (loader == nullptr)
  {
    why = L"WebView2Loader.dll is missing from CRBN Rig's folder. Reinstall CRBN Rig from Pavillion Hub.";
    return false;
  }
  const auto version = reinterpret_cast<RuntimeVersionFn>(GetProcAddress(loader, "GetAvailableCoreWebView2BrowserVersionString"));
  const auto create = reinterpret_cast<CreateEnvironmentFn>(GetProcAddress(loader, "CreateCoreWebView2EnvironmentWithOptions"));
  if (version == nullptr || create == nullptr)
  {
    why = L"CRBN Rig's WebView2Loader.dll is damaged. Reinstall CRBN Rig from Pavillion Hub.";
    return false;
  }
  LPWSTR found = nullptr;
  if (FAILED(version(nullptr, &found)) || found == nullptr)
  {
    why = L"CRBN Rig draws its window with Microsoft Edge WebView2, and this PC does not have it. Install the "
          L"WebView2 Runtime from Microsoft (https://go.microsoft.com/fwlink/p/?LinkId=2124703), then open CRBN Rig "
          L"again.";
    return false;
  }
  mRuntimeVersion = Take(found);
  // WebView2 lives in a single-threaded apartment. S_FALSE: this thread already is one.
  if (CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED) == RPC_E_CHANGED_MODE)
  {
    why = L"CRBN Rig's window could not start WebView2 on this thread.";
    return false;
  }
  SHCreateDirectoryExW(nullptr, options.dataFolder.c_str(), nullptr); // the profile's folder, made if it is not there

  mParent = parent;
  mOptions = options;
  mOnMessage = std::move(onMessage);
  mOnLoaded = std::move(onLoaded);
  mOnFailure = std::move(onFailure);
  mAlive = std::make_shared<WebViewHost*>(this);
  const std::weak_ptr<WebViewHost*> alive = mAlive;

  const HRESULT hr = create(
    nullptr, mOptions.dataFolder.c_str(), nullptr,
    Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
      [alive](HRESULT result, ICoreWebView2Environment* env) -> HRESULT {
        const auto self = alive.lock();
        if (!self)
          return S_OK;
        WebViewHost* host = *self;
        if (FAILED(result) || env == nullptr)
        {
          host->mOnFailure(L"WebView2 could not start (" + Hex(result) + L").");
          return S_OK;
        }
        host->mEnv = env;
        const HRESULT made = env->CreateCoreWebView2Controller(
          host->mParent, Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                           [alive](HRESULT result, ICoreWebView2Controller* controller) -> HRESULT {
                             const auto self = alive.lock();
                             if (!self)
                             {
                               if (controller != nullptr)
                                 controller->Close();
                               return S_OK;
                             }
                             if (FAILED(result) || controller == nullptr)
                             {
                               (*self)->mOnFailure(L"WebView2 could not make Rig's view (" + Hex(result) + L").");
                               return S_OK;
                             }
                             (*self)->OnControllerCreated(controller);
                             return S_OK;
                           })
                           .Get());
        if (FAILED(made))
          host->mOnFailure(L"WebView2 could not make Rig's view (" + Hex(made) + L").");
        return S_OK;
      })
      .Get());
  if (FAILED(hr))
  {
    mAlive.reset();
    why = L"WebView2 could not start (" + Hex(hr) + L").";
    return false;
  }
  mSubclassed = SetWindowSubclass(parent, ParentProc, kSubclassId, reinterpret_cast<DWORD_PTR>(this)) != FALSE;
  return true;
}

void WebViewHost::OnControllerCreated(ICoreWebView2Controller* controller)
{
  mController = controller;
  mController->get_CoreWebView2(&mView);
  if (!mView)
  {
    mOnFailure(L"WebView2 made Rig's view without a page.");
    return;
  }
  const BOOL dev = mOptions.devTools ? TRUE : FALSE;
  ComPtr<ICoreWebView2Settings> settings;
  if (SUCCEEDED(mView->get_Settings(&settings)))
  {
    settings->put_IsScriptEnabled(TRUE);
    settings->put_IsWebMessageEnabled(TRUE);
    settings->put_AreDefaultScriptDialogsEnabled(TRUE);
    settings->put_IsStatusBarEnabled(FALSE);
    settings->put_IsZoomControlEnabled(FALSE);
    settings->put_AreDevToolsEnabled(dev);
    settings->put_AreDefaultContextMenusEnabled(dev);
    ComPtr<ICoreWebView2Settings3> settings3;
    if (SUCCEEDED(settings.As(&settings3)))
      settings3->put_AreBrowserAcceleratorKeysEnabled(dev); // no reload, print or find: the page is the app
  }
  // A dark ground until the page paints, never a white flash.
  ComPtr<ICoreWebView2Controller2> controller2;
  if (SUCCEEDED(mController.As(&controller2)))
    controller2->put_DefaultBackgroundColor(COREWEBVIEW2_COLOR{255, 0x0e, 0x0f, 0x12});

  // The page's folder under a private https name: a secure origin, so its modules, fetches and storage work.
  ComPtr<ICoreWebView2_3> view3;
  if (FAILED(mView.As(&view3))
      || FAILED(view3->SetVirtualHostNameToFolderMapping(mOptions.host.c_str(), mOptions.folder.c_str(),
                                                         COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_DENY)))
  {
    mOnFailure(L"This PC's WebView2 is too old for CRBN Rig. Update Microsoft Edge, then open CRBN Rig again.");
    return;
  }

  const std::weak_ptr<WebViewHost*> alive = mAlive;
  EventRegistrationToken token;
  mView->add_WebMessageReceived(
    Callback<ICoreWebView2WebMessageReceivedEventHandler>(
      [alive](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT {
        const auto self = alive.lock();
        if (!self)
          return S_OK;
        WebViewHost* host = *self;
        LPWSTR source = nullptr;
        if (FAILED(args->get_Source(&source)) || !host->AllowedUri(Take(source)))
          return S_OK; // only Rig's own page talks to the engine
        LPWSTR json = nullptr;
        if (SUCCEEDED(args->get_WebMessageAsJson(&json)) && json != nullptr && host->mOnMessage)
          host->mOnMessage(Narrow(Take(json)));
        return S_OK;
      })
      .Get(),
    &token);
  // Links out of the page go to the person's browser; the view only ever shows Rig's page.
  mView->add_NavigationStarting(Callback<ICoreWebView2NavigationStartingEventHandler>(
                                  [alive](ICoreWebView2*, ICoreWebView2NavigationStartingEventArgs* args) -> HRESULT {
                                    const auto self = alive.lock();
                                    LPWSTR uri = nullptr;
                                    if (!self || FAILED(args->get_Uri(&uri)))
                                      return S_OK;
                                    const std::wstring u = Take(uri);
                                    if (!(*self)->AllowedUri(u))
                                    {
                                      args->put_Cancel(TRUE);
                                      OpenOutside(u);
                                    }
                                    return S_OK;
                                  })
                                  .Get(),
                                &token);
  mView->add_NewWindowRequested(Callback<ICoreWebView2NewWindowRequestedEventHandler>(
                                  [alive](ICoreWebView2*, ICoreWebView2NewWindowRequestedEventArgs* args) -> HRESULT {
                                    const auto self = alive.lock();
                                    LPWSTR uri = nullptr;
                                    args->put_Handled(TRUE);
                                    if (!self || FAILED(args->get_Uri(&uri)))
                                      return S_OK;
                                    const std::wstring u = Take(uri);
                                    if ((*self)->AllowedUri(u))
                                      (*self)->OpenOwnFile(u); // the About's notices, from the app's folder
                                    else
                                      OpenOutside(u);
                                    return S_OK;
                                  })
                                  .Get(),
                                &token);
  mView->add_NavigationCompleted(
    Callback<ICoreWebView2NavigationCompletedEventHandler>(
      [alive](ICoreWebView2*, ICoreWebView2NavigationCompletedEventArgs* args) -> HRESULT {
        const auto self = alive.lock();
        if (!self)
          return S_OK;
        BOOL ok = FALSE;
        args->get_IsSuccess(&ok);
        COREWEBVIEW2_WEB_ERROR_STATUS status = COREWEBVIEW2_WEB_ERROR_STATUS_UNKNOWN;
        args->get_WebErrorStatus(&status);
        if (ok)
          (*self)->mOnLoaded();
        else if (status != COREWEBVIEW2_WEB_ERROR_STATUS_OPERATION_CANCELED)
          (*self)->mOnFailure(L"CRBN Rig's page did not load (WebView2 status " + std::to_wstring(status)
                              + L"). Reinstall CRBN Rig from Pavillion Hub.");
        return S_OK;
      })
      .Get(),
    &token);
  // A crashed or hung page reloads; the engine keeps playing underneath and the page picks its state back up.
  mView->add_ProcessFailed(Callback<ICoreWebView2ProcessFailedEventHandler>(
                             [alive](ICoreWebView2* sender, ICoreWebView2ProcessFailedEventArgs* args) -> HRESULT {
                               const auto self = alive.lock();
                               if (!self)
                                 return S_OK;
                               COREWEBVIEW2_PROCESS_FAILED_KIND kind;
                               args->get_ProcessFailedKind(&kind);
                               if (kind == COREWEBVIEW2_PROCESS_FAILED_KIND_BROWSER_PROCESS_EXITED)
                                 (*self)->mOnFailure(L"WebView2 stopped. Close CRBN Rig and open it again.");
                               else if (kind == COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED
                                        || kind == COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_UNRESPONSIVE)
                                 sender->Reload();
                               return S_OK;
                             })
                             .Get(),
                           &token);

  Fit();
  mController->put_IsVisible(TRUE);
  mController->MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);
  mView->Navigate((L"https://" + mOptions.host + L"/" + mOptions.page).c_str());
}

void WebViewHost::Close()
{
  mAlive.reset();
  if (mSubclassed && mParent != nullptr)
    RemoveWindowSubclass(mParent, ParentProc, kSubclassId);
  mSubclassed = false;
  if (mController)
    mController->Close();
  mView.Reset();
  mController.Reset();
  mEnv.Reset();
  mParent = nullptr;
}

void WebViewHost::Defer(std::function<void()> fn)
{
  if (!mSubclassed || mParent == nullptr)
    return;
  mDeferred.push_back(std::move(fn));
  PostMessageW(mParent, kDeferMessage, 0, 0);
}

bool WebViewHost::Post(const std::string& json)
{
  return mView && SUCCEEDED(mView->PostWebMessageAsJson(Widen(json).c_str()));
}

bool WebViewHost::AllowedUri(const std::wstring& uri) const
{
  const std::wstring origin = L"https://" + mOptions.host + L"/";
  return StartsWithNoCase(uri, origin) || StartsWithNoCase(uri, L"blob:" + origin) || uri == L"about:blank";
}

void WebViewHost::OpenOutside(const std::wstring& uri)
{
  // Only web, mail and Pavillion Hub links; never a file or a program.
  for (const wchar_t* scheme : {L"https://", L"http://", L"mailto:", L"pavillion://"})
    if (StartsWithNoCase(uri, scheme))
    {
      ShellExecuteW(nullptr, L"open", uri.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
      return;
    }
}

void WebViewHost::OpenOwnFile(const std::wstring& uri) const
{
  // Only a text file of the page's own folder (its notices and font licences), opened by the person's text viewer.
  std::wstring rel = uri.substr((L"https://" + mOptions.host + L"/").size());
  rel = rel.substr(0, rel.find_first_of(L"?#"));
  if (rel.empty() || rel.find(L"..") != std::wstring::npos || rel.find(L'%') != std::wstring::npos || rel.find(L':') != std::wstring::npos)
    return;
  const size_t dot = rel.find_last_of(L'.');
  const std::wstring ext = dot == std::wstring::npos ? L"" : rel.substr(dot);
  if (_wcsicmp(ext.c_str(), L".txt") != 0 && _wcsicmp(ext.c_str(), L".md") != 0)
    return;
  for (wchar_t& c : rel)
    if (c == L'/')
      c = L'\\';
  const std::wstring path = mOptions.folder + L"\\" + rel;
  if (GetFileAttributesW(path.c_str()) != INVALID_FILE_ATTRIBUTES)
    ShellExecuteW(nullptr, L"open", path.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
}

void WebViewHost::Fit()
{
  if (!mController || mParent == nullptr)
    return;
  RECT r;
  GetClientRect(mParent, &r);
  mController->put_Bounds(r);
}

// The standalone's window (iPlug2's dialog) tells the view when it moves, sizes, takes focus or changes monitor.
LRESULT CALLBACK WebViewHost::ParentProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam, UINT_PTR, DWORD_PTR ref)
{
  auto* host = reinterpret_cast<WebViewHost*>(ref);
  switch (msg)
  {
    case WM_SIZE:
    {
      const LRESULT r = DefSubclassProc(hwnd, msg, wParam, lParam);
      if (host->mController)
      {
        host->mController->put_IsVisible(wParam != SIZE_MINIMIZED);
        if (wParam != SIZE_MINIMIZED)
          host->Fit();
      }
      return r;
    }
    case WM_MOVE:
    case WM_MOVING:
      if (host->mController)
        host->mController->NotifyParentWindowPositionChanged();
      break;
    case WM_SETFOCUS:
      if (host->mController)
      {
        host->mController->MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);
        return 0;
      }
      break;
    case WM_DPICHANGED:
    {
      // Per-monitor: take the size Windows suggests for the new monitor (iPlug2's dialog would keep the old one).
      const RECT* r = reinterpret_cast<const RECT*>(lParam);
      SetWindowPos(hwnd, nullptr, r->left, r->top, r->right - r->left, r->bottom - r->top,
                   SWP_NOZORDER | SWP_NOACTIVATE);
      return 0;
    }
    case kDeferMessage:
    {
      // Taken off the queue first: a deferred dialog runs a message loop of its own, which may run what is deferred
      // after it.
      std::deque<std::function<void()>> jobs;
      jobs.swap(host->mDeferred);
      for (auto& job : jobs)
        job();
      return 0;
    }
    case WM_NCDESTROY:
      RemoveWindowSubclass(hwnd, ParentProc, kSubclassId);
      host->mSubclassed = false;
      break;
    default: break;
  }
  return DefSubclassProc(hwnd, msg, wParam, lParam);
}
} // namespace rig
