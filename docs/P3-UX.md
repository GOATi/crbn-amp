# P3: CRBN Rig's own UX (the first pass)

**Status:** the brief, from the owner's picks of 2026-11-10 (crbn-launcher D-RIG-006). Built so far, in both builds:
U2, the desktop on the page (R2, D-RIG-017 and D-RIG-018), U1, power, auto-off and the squeal guard (R3,
D-RIG-021; `docs/BUILD_PLAN.md` "R3, as built"), and U3, the library (R4, "R4, as built": built and checked, not yet
published). U4 to U7 follow, in the order below.

**How it looks** is decided in the Rig Lab (D-RIG-007, `docs/design/2026-11-10-rig-lab/lab.html`): the mark, the
finishes, the layout and each feature below drawn three ways, with the owner's picks in its db. Upstream's IGraphics
drawing is dropped from the pass entirely (no Old Skool look, unlike Console's), so the desktop gets this page through U2.

## What the owner asked for, in his words

> Finding and switching captures.
>
> And also, little things like there being no easy on/off switch on the app/amp, so that you can turn amps off while
> switching inputs etc, and possibly we could have an "auto off" feature if we detect that an input is unplugged, as
> this can lead to squealing through the speakers.
>
> - An easy access to saving your favourites, and having them all on standby in the app to quickly switch between.
>   *And we could use all of the keyboards shortcuts for these, so that players could switch between them by using
>   qwerty keys.
> - Having variants of the same rig setup, but with different pedal options that you can hot swap in/out.
> - I'd want us to have REALLY good midi support, so that players could use their own gear to drive it.
>   *I have a morningstar MC8 midi controller and a number of Neural DSP plugins, and the UI for setting that up is SOOO
>   painful, that you just can't even be bothered. This stuff needs to be as drag and drop as possible.

He also said TONE3000's UX is "quite confusing, and far from ideal" (D-CRBN-021): the library is where ours starts.

## One engine, one page, both builds

The web engine (`web/engine/rig_engine.cpp`) is the desktop standalone's chain without iPlug2, and it already builds
natively with MSVC (the parity test, `web/engine/test.mjs`). So the features below are built once: in the engine (the
chain, the slots, standby, the guards) and in the page (everything a person touches). The desktop then runs the same
page in iPlug2's WebView2 editor over the same engine compiled natively, with ASIO and MIDI from the host. Building the
features in the web page first and moving the desktop later would build them twice, so the desktop move is early (U2).

## The order

| Step | What | Notes |
|---|---|---|
| **U1 Power and the squeal guard** | A **power switch** on the amp (standby: the output fades out in about 20 ms, no click; the input stays open, so a cable can be changed safely) and a key for it. **Auto-off**: the output goes to standby the moment the input device disappears (the browser's `devicechange` and the track's `ended`; on the desktop, the driver's device-removed) and when the input turns into the signature of an unplugged jack (a full-scale spike, then hum at 50 or 60 Hz or dead silence). A **squeal guard** on the output: a narrow peak that holds well above the rest of the spectrum for a few hundred milliseconds (feedback) mutes the output and says why, with one click to come back | Small, and it protects ears and speakers before anything else is built |
| **U2 The page on the desktop** | iPlug2's WebView2 editor in the standalone, showing the web page, with `rig_engine.cpp` compiled into the plug-in as its DSP. The page talks to the native engine through iPlug2's WebView messages instead of an AudioWorklet | After this, every feature lands in both builds at once. Built as R2a (D-RIG-017): Rig’s own WebView2 host rather than iPlug2’s editor, and upstream’s IGraphics UI removed, not kept as a fallback (D-RIG-007 (a)) |
| **U3 The library** | Point Rig at a folder (the desktop reads it directly; the browser asks once through the folder picker, or takes a drag of files). Every `.nam` and `.wav` in it is listed with what its file says: gear type (pedal, amp, full rig), make and model, tone (clean, crunch, high gain), who captured it. Search as you type, filters as chips, sort; **favourite** with a star from anywhere. Click to hear it; nothing to "load" | Replaces the file pickers. TONE3000 joins the library in U7 |
| **U4 Standby and switching** | The favourites sit in a row of **pads**, each loaded in the engine ahead of time ("on standby"), so a switch is instant: a short crossfade, no gap, no click. **QWERTY keys**: 1 to 0 for the first ten pads, shown on the pads; arrows for next and previous; a key for A/B between the last two | The engine holds several models at once; a standard WaveNet capture is small, the CPU cost is only for the one playing (and both during the crossfade) |
| **U5 Rigs and variants** | A **rig** is a chain: pedal slots, an amp, a cabinet IR, with the gate and EQ. A **variant** is the same rig with different pedals in or out ("Clean", "Push", "Lead"), switched like pads and keyed too. Pedals are dragged in and out of the slots and **hot-swapped** while playing, with the same crossfade. Captures of pedals run in series before the amp | The engine runs two or more captures in series: CPU is the limit, highest in the browser; the page shows the load |
| **U6 MIDI** | **Drag and drop**: drag any control (a knob, a switch, a pad, a variant, the power switch) onto the MIDI dock, then press the footswitch or move the pedal you want: it is mapped. Program Change for rigs and variants, CC for switches (toggle or momentary) and knobs, an expression pedal to any knob with its range drawn on the knob. A live monitor of what arrives. **Devices by name**: a Morningstar MC8 set-up from Rig's mappings, so the controller needs no separate editing (to find out: the MC8 editor's backup format, and whether it can be imported) | The browser needs Web MIDI (Chrome and Edge; and the desktop Hub's tool view grants no MIDI either: a second Hub ask, like the microphone's). The desktop takes MIDI through iPlug2 (`PLUG_DOES_MIDI_IN` on) |
| U7 TONE3000 in the library | Sign in to TONE3000 and browse, favourite and play its captures in Rig's own library, without downloading files by hand | Only within TONE3000's API terms, which the session reads first and brings to the owner |

A tuner, recording a take, and presets shared between people are good next steps, not in this pass.

## The owner's choices (D-RIG-008 (e), 2026-11-11)

1. **The desktop moves early:** U2 comes right after the look, before U1's power switch and guard, so each feature is
   built once for both.
2. **The squeal guard is on out of the box,** with one click (or Space) to come back.
3. **Ten favourites on keys 1 to 0;** Q, W and E for a rig's variants; arrows for next and previous.
4. **Still open: MIDI in the browser** (a second Hub permission ask for Web MIDI), decided with U6.

Each feature is drawn as the owner picked in the Rig Lab (D-RIG-008 (d)), with the other two drawings a player's
choice: power B (pilot lamp and toggles), pedals B (stompboxes), library A (list), favourites A (footswitches).
