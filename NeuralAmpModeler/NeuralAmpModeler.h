// CRBN Rig's plug-in class, under upstream's name (D-CRBN-002 (e)). Since build plan R2 (crbn-launcher D-RIG-017) it
// is a thin host for Rig's own page and engine: its DSP is web/engine/rig_engine.cpp, the engine the web version runs
// (rig::Desktop, RigDesktop.h), and its UI is Rig's page in WebView2 (rig::WebViewHost, RigWebView.h). Upstream's
// IGraphics drawing and its own DSP chain are gone (D-RIG-007 (a)). The Windows standalone is the format built; the
// plug-in formats come back with P4 (docs/PLAN.md).
#pragma once

#include <atomic>
#include <cstdint>
#include <string>

#include "IPlug_include_in_plug_hdr.h"
#include "RigDesktop.h"
#include "RigLibrary.h"
#include "RigSuiteLook.h"
#include "RigWebView.h"

const int kNumPresets = 1;

class NeuralAmpModeler final : public iplug::Plugin
{
public:
  NeuralAmpModeler(const iplug::InstanceInfo& info);
  ~NeuralAmpModeler() override;

  void ProcessBlock(iplug::sample** inputs, iplug::sample** outputs, int nFrames) override;
  void OnReset() override;
  void OnIdle() override;
  void* OpenWindow(void* pParent) override;
  void CloseWindow() override;
  void OnParentWindowResize(int width, int height) override;
  bool OnHostRequestingSupportedViewConfiguration(int width, int height) override { return true; }
  bool OnHostRequestingProductHelp() override;

private:
  void OnPageMessage(const std::string& json);
  void OnPageLoaded();
  void ShowFailure(const std::wstring& why);
  // The engine's and the driver's state, for the page's status line: {type, sampleRate, buffer, driver, ...}.
  void PostStatus(const char* type);
  void Post(const std::string& json);

  rig::Desktop mEngine;
  rig::WebViewHost mView;
  rig::Library mLibrary; // the library's folder, read for the page (build plan R4)
  rig::SuiteLook mSuite; // "Use this look in every CRBN app": %APPDATA%\CRBN\suite-look.json (D-CRBN-025, R6)
  HWND mWindow = nullptr;
  HWND mFailure = nullptr; // the words shown when the page cannot be (no WebView2 runtime, missing files)
  bool mPageUp = false; // the page has said hello since it last loaded
  bool mStatusDirty = false;
  bool mAudioRunning = false;
  bool mDarkTitle = false;
  std::atomic<uint32_t> mBlocks{0}; // blocks the driver has asked for, to tell the page whether audio runs
  uint32_t mBlocksSeen = 0;
  uint64_t mBlocksMovedAt = 0;
  uint64_t mMetersAt = 0;
};
