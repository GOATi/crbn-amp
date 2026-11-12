// CRBN Rig's library in the desktop app (build plan R4, P3-UX U3): the folder of captures and IRs the person points
// Rig at, read for the page (web/src/library.js, its desktop source). The page asks; this answers on a worker thread:
//   - the app's own folder dialog (PickFolder, on the UI thread);
//   - every .nam and .wav under the folder, with its size and modified time (List);
//   - what each file says about itself, read from its head and tail by library.js's rules (Meta, ReadNamInfo,
//     ReadWavInfo), so both builds index a folder the same way;
//   - one file's bytes, to play (Read);
//   - a watch that says when the folder's files change (Watch).
// Replies are JSON messages for the page, collected by TakeReplies on the UI thread (NeuralAmpModeler's OnIdle).
// Only .nam and .wav files under the folder are ever read, never more than 64 MB, and paths with "..", ":" or "\" in
// a part are refused.
#pragma once

#include <condition_variable>
#include <cstdint>
#include <deque>
#include <functional>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include <windows.h>

namespace rig
{
// What a capture says about itself: its metadata object's text and its sample rate (library.js namInfo).
struct NamInfo
{
  bool hasMetadata = false;
  std::string metadata;
  double rate = 0.0; // 0: not stated
};
NamInfo ReadNamInfo(const std::string& head, const std::string& tail);

// A WAV's format and length (library.js wavInfo).
struct WavInfo
{
  bool ok = false;
  double rate = 0.0;
  int channels = 0;
  int bits = 0;
  double seconds = 0.0;
};
WavInfo ReadWavInfo(const std::string& head, uint64_t size);

class Library
{
public:
  Library();
  ~Library();
  Library(const Library&) = delete;
  Library& operator=(const Library&) = delete;

  // Each answers later with {type, id, ...} through TakeReplies.
  void List(double id, const std::string& folder);
  void Meta(double id, const std::string& folder, std::vector<std::string> paths);
  void Read(double id, const std::string& folder, const std::string& path);
  // Watches one folder (an empty one stops); a change, once the folder has been quiet for 0.8 s, replies
  // {type:'libChanged'}. UI thread.
  void Watch(const std::string& folder);
  std::vector<std::string> TakeReplies();

  // The system's folder dialog, starting at `start` if it exists. False when the person cancels. UI thread.
  static bool PickFolder(HWND owner, const std::wstring& start, std::wstring& picked);

private:
  void Run(std::function<void()> job);
  void Reply(std::string json);
  void StopWatch();

  std::mutex mMutex;
  std::condition_variable mWake;
  std::deque<std::function<void()>> mJobs;
  bool mStop = false;
  std::thread mWorker;

  std::mutex mOutMutex;
  std::vector<std::string> mOut;

  std::thread mWatcher;
  HANDLE mWatchStop = nullptr;
  std::string mWatching;
};
} // namespace rig
