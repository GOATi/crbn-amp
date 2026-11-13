// CRBN Rig's half of "Use this look in every CRBN app" on the desktop (crbn-launcher D-CRBN-023..025; build plan R6,
// step 1). One small file per person, %APPDATA%\CRBN\suite-look.json, shared by every CRBN desktop app:
//
//   { "version": 1, "every": true, "from": "console", "prefs": { "look": "holo", "accent": "look", ... } }
//
// `prefs` is the look menu's own JSON (web/src/look.js sanitize). The look only: never a layout or a drawing. This
// keeps the file as crbn-launcher looks/egui src/suite.rs does, the reference: read at start, its modified time looked
// at about once a second (Poll, from NeuralAmpModeler's OnIdle), written whole through a temporary file and a rename
// when the page turns the switch on or off or changes its look while it is on. A file over 16 KB, or one that is not
// version 1 with a true or false `every` and a `prefs` object, is no file. The page decides what it means
// (look.js); this only reads and writes it.
//
// CRBN_SUITE_LOOK names another file (packaging/windows/check.mjs points it at a throwaway one); CRBN_SUITE_LOOK=off
// turns the file off, and the switch then holds in Rig alone.
#pragma once

#include <cstdint>
#include <string>

#include "json.hpp"

namespace rig
{
class SuiteLook
{
public:
  // The file at its place, read once now.
  SuiteLook();

  // What the file says: {version, every, from, prefs}, or null when there is no such file.
  const nlohmann::json& Current() const { return mLast; }
  // The file's path, or empty when it is turned off.
  const std::wstring& Path() const { return mPath; }

  // Looks at the file's modified time, at most about once a second (`nowMs`, GetTickCount64). True when what it says
  // changed since it was last read or written; Current() has the new state.
  bool Poll(uint64_t nowMs);

  // Writes the file whole, from this app: the switch and the look. False, with the reason, when it cannot be written;
  // Current() holds the new state either way, so the switch holds in Rig at least.
  bool Set(bool every, const nlohmann::json& prefs, std::string& error);

private:
  // What the file says now, and its stamp (modified time and size); null when there is none or it is not one.
  nlohmann::json Read();

  std::wstring mPath;
  nlohmann::json mLast; // null, or the file's object
  uint64_t mStamp = 0; // the last write time seen (FILETIME as 100 ns ticks), 0: no file
  uint64_t mSize = 0;
  uint64_t mCheckedAt = 0;
};
} // namespace rig
