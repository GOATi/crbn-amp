// CRBN Rig's page in the desktop app (crbn-launcher D-RIG-017, build plan R2): one WebView2 filling the standalone's
// window, showing the page's files from the folder beside crbn-rig.exe under a private https host name, with JSON
// messages both ways. Rig's own host rather than iPlug2's IPlug/Extras/WebView, which loads pages from file:// (where
// the page's modules and fetches are refused), cuts messages to the page at 1,024 characters, and needs the Windows
// Implementation Library. Everything here runs on the UI thread.
#pragma once

#include <deque>
#include <functional>
#include <memory>
#include <string>

#include <windows.h>
#include <wrl/client.h>

#include "WebView2.h"

namespace rig
{
class WebViewHost
{
public:
  struct Options
  {
    std::wstring folder; // the page's files
    std::wstring dataFolder; // the WebView's profile: the page's storage and cache
    std::wstring host; // the private host name the folder is served under
    std::wstring page; // the path to open under it
    bool devTools = false; // the developer tools, context menus and browser keys (a debug build, or CRBN_RIG_DEVTOOLS=1)
  };
  using OnMessage = std::function<void(const std::string& json)>;
  using OnLoaded = std::function<void()>;
  using OnFailure = std::function<void(const std::wstring& why)>;

  WebViewHost() = default;
  WebViewHost(const WebViewHost&) = delete;
  WebViewHost& operator=(const WebViewHost&) = delete;
  ~WebViewHost() { Close(); }

  // Starts making the WebView inside `parent`; it is ready a moment later, on the UI thread's message loop. Returns
  // false, with `why` set, when it cannot start at all: no WebView2Loader.dll, or no WebView2 runtime on this PC.
  bool Open(HWND parent, const Options& options, OnMessage onMessage, OnLoaded onLoaded, OnFailure onFailure,
            std::wstring& why);
  void Close();
  // Sends one JSON value to the page (its window.chrome.webview 'message' listeners). False before the page is up.
  bool Post(const std::string& json);
  bool IsOpen() const { return mView != nullptr; }
  // The runtime's version, once Open has found it.
  const std::wstring& RuntimeVersion() const { return mRuntimeVersion; }
  // Runs `fn` on the UI thread once the message being handled is done, outside any WebView2 callback: a modal dialog
  // (the library's folder dialog) must not open inside one. UI thread only; dropped if the view closes first.
  void Defer(std::function<void()> fn);

private:
  void OnControllerCreated(ICoreWebView2Controller* controller);
  // TONE3000's sign-in and picker (build plan R8, docs/R8-TONE3000.md): the page's window.open of TONE3000's authorize
  // page gets its own WebView2 window, owned by Rig's, on the same profile. Its redirect to http://127.0.0.1/callback
  // is caught before it is made and handed to the page as {type:'t3kCallback', url}; then the window closes. Closed by
  // the person first, the page hears canceled=true.
  void OpenT3k(ICoreWebView2NewWindowRequestedEventArgs* args);
  void CloseT3k(bool tellPage);
  void AnswerT3k(const std::wstring& url);
  static LRESULT CALLBACK T3kProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam);
  bool AllowedUri(const std::wstring& uri) const;
  static void OpenOutside(const std::wstring& uri);
  void OpenOwnFile(const std::wstring& uri) const;
  static LRESULT CALLBACK ParentProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam, UINT_PTR id, DWORD_PTR self);
  void Fit();

  HWND mParent = nullptr;
  Options mOptions;
  OnMessage mOnMessage;
  OnLoaded mOnLoaded;
  OnFailure mOnFailure;
  std::wstring mRuntimeVersion;
  // Callbacks from the runtime can arrive after Close: they hold this weakly and do nothing once it is gone.
  std::shared_ptr<WebViewHost*> mAlive;
  Microsoft::WRL::ComPtr<ICoreWebView2Environment> mEnv;
  Microsoft::WRL::ComPtr<ICoreWebView2Controller> mController;
  Microsoft::WRL::ComPtr<ICoreWebView2> mView;
  bool mSubclassed = false;
  std::deque<std::function<void()>> mDeferred;
  // TONE3000's window, while it is open.
  HWND mT3kWindow = nullptr;
  Microsoft::WRL::ComPtr<ICoreWebView2Controller> mT3kController;
  Microsoft::WRL::ComPtr<ICoreWebView2> mT3kView;
  bool mT3kAnswered = false;
};

// UTF-8 and UTF-16, for the messages and paths.
std::wstring Widen(const std::string& utf8);
std::string Narrow(const std::wstring& utf16);
} // namespace rig
