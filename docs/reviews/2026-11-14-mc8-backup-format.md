# The Morningstar MC8's backup format, for build plan R7 (U6)

**2026-11-14, SYNC:RIG-030 addendum.** R7 says: first find out the MC8 editor's backup format and whether a bank can be
imported; if it can, Rig exports one from its mappings so the controller needs no separate editing. Bring the findings
to the owner before building the export. This reads public pages only; an agent gathered it, and the field names are
the community's, not Morningstar's. Check against one of the owner's own backups before building anything.

## Findings

- **A backup is plain JSON, and a single bank can be imported.** The Morningstar Editor's Controller Backup tab saves
  **Current Bank** (one bank) or **All Banks** (every bank and the controller's settings) as `.json`, and restores
  either through **Choose File**: a bank file replaces only the current bank. Single presets save and load as `.json`
  too, and since Editor v1.3.0 a preset can be picked out of a bank file. (Documented:
  https://help.morningstar.io/en/article/morningstar-editor-user-manual-81kpjn/)
- **The format is not documented by Morningstar.** A Morningstar staff member wrote in 2021 that the dumps are close to
  stored data "without any schema" (https://forum.morningstar.io/t/is-there-a-json-schema-available-for-the-editors-import-export-format/1641).
  Two community projects agree on its fields: benemon/morningstar-sdk (Go, Apache-2.0, MC8 Pro, firmware 3.13.6; says
  its bank JSON imports into the official editor) and TheCoolHippo/mc8-tools (`FORMAT.md`, from the editor's code, MC8
  Pro, no licence).
- **Its shape, as the community reads it:** a wrapper (`schemaVersion` 1, `dumpType` `singleBank` or `allBanks`,
  `deviceModel` 4 for the MC8 and 8 for the MC8 Pro, `hash`, `data`); a bank (`bankName`, `presetArray` of switches,
  `expPresetArray`, bank messages); a preset (short, toggle and long names, toggle mode, `msgArray`); a message
  (`t` type: 1 Program Change, 2 Control Change...; `a` action: 1 press, 2 release, 3 long press, 5 double tap...;
  `c` channel; `tg` which toggle position; `data` the bytes). The `hash` is a Java-style string hash of the data's JSON,
  reproduced by both projects; a wrong one only warns on a normal restore.
- **MC8 and MC8 Pro differ.** The original MC8: 30 banks, 16 switches over two pages, 16 messages a preset. The Pro: 128
  banks a profile, 24 switches, 32 messages a preset, colours. `deviceModel` must match or the editor warns, and the
  community's tables are for the **Pro** only. (Documented: https://help.morningstar.io/en/article/mc8-user-manual-1fzlzjx/,
  https://help.morningstar.io/en/article/transferring-backup-file-from-a-different-model-1x6vatl/)
- **Risk:** the editor checks little on restore: messages out of range are dropped, names outside ASCII are mangled, and
  a bad bank file overwrites one bank. No report was found of a backup file harming a unit. A backup taken first
  undoes it.
- **A sanctioned alternative:** Morningstar documents (as a work in progress) a SysEx API for external apps that reads
  and writes preset names and PC/CC messages live, MC8 and MC8 Pro included
  (https://help.morningstar.io/en/article/sysex-documentation-for-external-applications-1n7gb7c/).
- **USB:** "All Morningstar MIDI controllers are USB class compliant" (no drivers on Windows). The editor itself is a
  Web MIDI app in Chromium browsers, so Web MIDI reaches the MC8 in Edge and Chrome. Only one program can hold its
  first port for editing; plain PC/CC from a footswitch is unaffected.

## Recommendation, for the owner's word

1. **Build R7's learning first, with no file at all:** Rig listens for whatever the MC8 sends (PC, CC, toggles, the
   expression pedal) and maps it by drag and drop. That works with any controller and needs nothing from Morningstar.
2. **The bank export is feasible, as a later extra:** a `singleBank` file of simple PC/CC press and release messages,
   names and toggles, with the reproduced hash. It rests on an undocumented format, read on the MC8 Pro only.
3. **Before building the export, from the owner:** which MC8 he has (the original or the Pro) and its firmware, and one
   of his own Current Bank backups to build and test against. Morningstar's SysEx API is the documented route if the
   file format proves fragile.

## Confirmed on his own MC8 (2026-11-15, SYNC:RIG-032)

His **original** MC8's All Banks and Current Bank backups (Editor v3.13) agree with the community's reading where it
matters, with the original's sizes: 30 banks; a bank of 16 bank messages, 22 presets and 4 expression presets, each of
16 messages. The Current Bank file holds `data: { bank }`. `hash` is Java's String.hashCode of `JSON.stringify(data)`
on both files. On a switch `t` 1 is a Program Change and 2 a CC; on an expression preset `t` 1 is a CC from `d2` to
`d3`. The All Banks file trims empty expression messages to `[]` where the Current Bank file keeps all 16. The
expression calibration is not in either. Rig's writer is crbn-amp `web/src/mc8.js`, checked key for key against his
Gojira bank (`web/test/mc8-bank-gojira1.json`); restoring one into his MC8 is still to try, with him.
