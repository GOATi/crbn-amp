# CRBN Rig: the build plan to finish the Rig push

**Written 2026-11-11 (SYNC:RIG-006), at the owner's ask:** "write a build plan for the following suite of sessions to
follow in order, to finish off the rig push". Each session below is one RIG session on GOATi-Box-C. Sessions take
them **in order**: a session starts from the `NEXT KICKOFF` of the last `SYNC:RIG-` entry, which names its step here,
and ends by naming the next one. Where a step will not fit one session, it says how to split.

`docs/P3-UX.md` is the brief for what each feature does. This plan is the order, the owner's inputs each step needs,
and when a step is done. The owner's decisions so far are D-CRBN-021 and D-RIG-001..008 (crbn-launcher
`docs/DECISIONS.md`); a new one is the next `D-RIG-NNN`.

## Where the push stands (2026-11-11)

- **Desktop app** on the dev Hub: signed, reviewed, public. It still draws upstream's IGraphics UI, which the owner
  dropped from Rig (D-RIG-007 (a)); its new stompbox icon ships with its next build. (Later the same day, R2a built
  the app on Rig's page, D-RIG-017, and R2b shipped it as 0.9.0, signed, D-RIG-018.)
- **Web version** at `https://rig.carbonlinear.com`: the owner's lab picks are live (D-RIG-008): the stompbox mark;
  the Amp front layout, faceplate and LED meters by default, with the other drawings as player's choices; the finishes
  (the look's own, cherry, gold, rose gold `#f29077`, Custom with a colour wheel); Livewire's look menu with the suite
  switch.
- **Store page:** the new pictures are uploaded (record version 10). The desktop screenshot still shows upstream's
  drawing. (Since RIG-017 and RIG-018, every picture shows Rig's page and kits; record version 24.)
- **Not built:** everything in P3 except the look. That is the power switch, squeal guard, library, favourites, rigs
  and pedals, MIDI and TONE3000 (U1 and U3 to U7), and the desktop on the page (U2).

## What "finished" means for this push

1. Every P3 feature (U1 to U7) works in **both** builds, the desktop app and the web version, from one page and one
   engine, each drawn as the owner picked (D-RIG-008 (d)), with the other drawings in the look menu.
2. A **signed desktop build** is published to the dev Hub and confirmed byte for byte. The **web version** is
   promoted. The **store page** shows the new UI in every picture.
3. `docs/PLAN.md`, `docs/P3-UX.md`, `packaging/hub/README.md` and the SYNC log say so.

**Not in this push** unless the owner adds them: P4 (VST3/AU plug-in formats and their installer), the production Hub
(Rig is on dev), a tuner, recording and shared presets (P3-UX's "next steps").

## The sessions, in order

| # | Session | Needs from the owner first | Done when |
|---|---|---|---|
| R1 | Rig's hardware: the kits (built, SYNC:RIG-015) | Done: the Hardware Lab (D-RIG-009..015), the texture library (D-RIG-016) | The 20 kits on the page, CRBN the default, published |
| R1b | The Rig builder, RIG1 codes, players' own art (built, SYNC:RIG-019) | Nothing new (D-RIG-009 (c), D-RIG-010 (f)) | Players build, keep and share an energy kit, and bring their own knob and switch art |
| R1c | The store's skins: Salvage second and cycling, a skins section (D-RIG-018 (e); done, SYNC:RIG-019) | Done: his look at the pictures and words before upload | The store shows CRBN, then Salvage cycling through its shuffles, and a section on choosing and customising skins |
| R2 | The desktop on the page (U2): built and shipped (SYNC:RIG-016, RIG-017; D-RIG-017, D-RIG-018) | Done: the WebView2 SDK alone (D-RIG-017); his SimplySign session (R2b) | `crbn-rig.exe` shows the page over the native engine; signed, published, confirmed |
| R3 | Power, auto-off, squeal guard (U1): built and shipped (SYNC:RIG-020, D-RIG-021) | Done: auto-play (resume if playing at close), the web publish, his SimplySign session | Both builds; no false trips on real playing (the synthetic set passes; his real playing is still to try) |
| R4 | The library (U3): built and shipped (SYNC:RIG-021, RIG-022) | Done: his word to release, his SimplySign session | Both builds; a 5,000-file folder stays fast |
| R5 | Favourites on standby (U4) | Nothing new (ten, keys 1 to 0) | Switching is gapless and click-free in both builds |
| R6 | Rigs, variants and pedals (U5): built; web live (SYNC:RIG-029, RIG-030; D-RIG-025, D-RIG-026) | Done: rigs beside the pads, variants, the Tone | Pedals in series, hot-swapped while playing |
| R7 | MIDI (U6): learning built in both builds, shipped in desktop 0.9.6 and the web (SYNC:RIG-031, D-RIG-027); reviewed with his MC8, the pedal's sweep and the MC8 bank built (SYNC:RIG-032, D-RIG-028) | Done: both builds; his MC8's traffic and backups. Still: a Rig bank restored into his MC8, and Rig picking the MC8 up after its editor lets go, tried with him | His MC8 drives Rig by drag and drop |
| R8 | TONE3000 in the library (U7) | His word on TONE3000's API terms, which the session brings him | Browse, favourite and play TONE3000 captures in the library |
| R9 | Release and store | A SimplySign session; his look at the new pictures | Signed release, web promoted, store refreshed |

R1 can be skipped or moved if the owner prefers to go straight to R2. It is first because he asked for it
("then I follow up on these details with the following session"). After R1 he took R2 before R1b (D-RIG-017 (a)):
R1b only adds to the page, so it lands in both builds whenever it comes, and can fill a gap while R2b waits for a
SimplySign session.

### R1. The look's details (the owner's follow-up)

His note in the Rig Lab (D-RIG-008 (f)): "I'm not happy with the stripe detail overlay/finish on the plate on the amp,
and the gradients and treatments on the buttons and knobs."

**Widened by the owner when R1 started (2026-11-11, SYNC:RIG-007):** not a small Detail Lab but a full range of
hardware kits for the amp's and the pedals' knobs, switches, lights and faceplates, so that he can pick the default and
offer the rest as players' choices. There are two families. **Classic** kits follow the gear players know (his
examples: Marshall, Fender, Peavey, Mesa/Boogie, Boss), never copying a maker's name, logo or panel. **New** kits put
the energy of the Hub's logo window inside the amp, behind faceplates with cutouts and meshes between. He reviews them
before anything is built. The lab is the **Hardware Lab**: https://claude.ai/artifact/WdqG3GWav3qnqffCQeVe4m (source
`docs/design/2026-11-11-hardware-lab/lab.html`). It holds 10 classic and 9 new kits, each an amp and a pedal with the
real controls. It also has a builder for the energy kits, Rig's page as a stage, and six questions. His picks go to its
db: `picks/<kit>` (keep, maybe or cut, and a note), `picks/default`, `picks/q-<id>`, `picks/builder` and
`picks/general`. The steps below still hold, scaled to the kits he keeps. Many kept kits may need R1 and an R1b; the
energy kits share one engine, a port of the Hub's `shell/logo-window` layers.

**His picks and notes so far (D-RIG-009, D-RIG-010):** 18 kits are kept, and his own builder kit CRBN is the default.
Players get the Rig builder with share codes. Players can also bring their own art for knobs and switches: templates go
out, art comes in, and it is kept and shared with the kit. For that, every knob and switch is built as layered SVG.
Salvage is drawn from the texture library's photographs, with a crop for each piece. Pedal knobs show only their end
numbers. "CRBN Rig" stands straight on every head.
Salvage (D-RIG-011..015) is kept, with players' choices for the sheet, the grille (expanded metal, chicken wire,
woven wire, perforated sheet), the grille's metal, the glow and the words, plus Shuffle. His own setup is the Rust
and orange sheet, a perforated sheet in aged copper, valves behind it and the words on tags. He wants this Salvage
setup in the app's screenshots on Pavillion (R9).

- **Lab first, as before:** a small **Detail Lab** artifact (the Rig Lab's pattern: three options per area, live on a
  mock of the real page in all four looks and three finishes, Pick and a note saved to its db). Areas: the faceplate's
  finish (today's brushed stripes; a smooth satin gradient; a fine grain, or anodised flat), the knobs (today's shine;
  matte; flat with a ring), the buttons (today's gradient primary; flat; outlined), the toggles. Read the picks with
  ArtifactData, ask anything unpicked in the picker, record them as a D-RIG row.
- **Build:** they are tokens already, `--plate-texture` and `--knob-shine` in `web/src/style.css`, plus `.btn.primary`
  and the toggle rules. The faceplate also draws the cab plate and the stripe drawing, so change all three together.
- **Check and ship:** `node web/check.mjs` (17 checks), headless shots of each look and finish, `node
  hosting/kit/publish.mjs --promote` (allowed on this PC), `node web/check.mjs --url=https://rig.carbonlinear.com`. Re-render
  the store pictures only if the faceplate changes how they look, and upload them with new names (the CDN keeps a name
  for a day).

### R1, as built (2026-11-11, SYNC:RIG-015, D-RIG-016)

- **The page:** the amp's drawing **b** is "Hardware": the kit picked under "Rig's hardware" in the look menu draws the
  amp and the cabinet. Islands and stripe stay as choices; the old CSS faceplate is gone. "Kit's own" is the default
  finish.
- **The code:** `web/src/hw/hw.js` holds the lab's kits, drawing, cutouts, Salvage and energy engine nearly
  verbatim (each part marked with its lab lines), then the page's side. That side binds every knob, fader and
  switch to Rig's settings, feeds the energy from the input level, and wires Power and Standby (page-level until
  R3). `hw.css` is the lab's CSS scoped under `.rig-hw`. The energy rests on a still frame after 30 s with
  nothing playing and nobody using the page (D-RIG-016 (e)).
- **Salvage:** its sheets come from the texture library (`web/src/hw/tex/`, D-RIG-016 (a)), with his setup the
  default and players' choices in the menu.
- **The checks:** `node web/check.mjs` has 30 checks, 13 of them for the hardware.
- **Not in R1:** pedals (R6) and the builder (R1b, below).

### R1b. The Rig builder, share codes and players' own art

The lab's builder (`lab.html`: `B_OPTS`, `BUILDER`, the builder's controls, RIG1 codes, "Your own art") for players,
in the look menu or a panel beside it. `hw.js` already carries `B_OPTS` and `BUILDER`, and `kitOf` reads a `builder`
kit.

- **Build:** name and keep a kit locally, beside the twenty; copy and open RIG1 codes; templates of any knob or
  switch saved as SVG (every control is already drawn as layered SVG); art imported as SVG, PNG, WebP or JPEG up to
  2 MB, kept in IndexedDB, with a knob turning as one picture and a switch as two frames (D-RIG-010 (f)).
- **Sharing art** beyond the codes goes through the Hub, a store for the Hub lane to host: write it as a proposal in
  goati-sync `proposals/`.
- **Checks:** a code round-trips a kit; imported art draws and turns; the builder's kit survives a reload.

### R1b, as built (2026-11-11, SYNC:RIG-019)

- **Where:** the look menu, under Rig's hardware. "Yours" holds the player's kits beside the twenty, with Build a kit
  and Open a share code. The builder opens below them whenever one of the player's kits is on the amp, and the page's
  own amp is its preview.
- **Kits** (`web/src/kits.js`):
  - Build a kit starts from the energy kit on the amp, or the player's kit, or CRBN. A part the builder does not
    offer (Valve's knobs) takes CRBN's.
  - Each kit is named "My kit", "My kit 2" and so on, kept in `localStorage['crbn-rig/kits']`, up to 50. Every
    change is kept as it is made, with no Keep button.
  - The builder has name, energy, cutouts, mesh, faceplate, knobs and colour (`hw.js` `KIT_PARTS`, the lab's
    `B_OPTS`), Make a copy, and Delete (two clicks).
  - A note says when Rig's finish, not the kit's colour, is colouring it.
- **RIG1 codes:** the lab's own format, so a code made in the Hardware Lab opens in Rig. A code is found anywhere in
  the pasted text, and opening one adds the kit under Yours.
- **Players' own art:**
  - Templates (`hw.js` `artTemplate`, the lab's): the kit's knob or switch with guides, or a blank. They are saved
    through the system's Save dialog where there is one (Edge and the desktop app's WebView2 both have it), else
    downloaded, or copied as SVG text.
  - Import: SVG, PNG, WebP or JPEG up to 2 MB, which must decode as a picture. It is kept in IndexedDB (`store.js`,
    database version 2, an `art` store) under the first 32 hex digits of its SHA-256, and drawn from a blob URL.
  - A knob turns as one picture under Rig's light; a switch shows its Off, then its On frame.
  - The share code carries the art's ids. Someone opening a code without the pictures sees the kit's own knobs and
    switches, with a note.
  - Art no kit wears is forgotten when Rig next starts, so a kit deleted and reopened from its code in the same
    visit keeps its art.
- **Shipped (2026-11-12, the owner's go-ahead in-session):**
  - The web version is build `20261111-1249-fa1a2f5-1832688c`, and all 63 files match on the host. Roll back with
    `--promote-only=20261111-0839-fff8c4a-f802d8f4`.
  - Desktop 0.9.1 is signed and on the dev Hub (`packaging/hub/README.md`, Record).
  - This session's harness refused `publish.mjs --promote` as a production deploy until the owner said yes in the
    session, despite D-RIG-018 (a). Ask him first.
- **Checks:** `web/check.mjs` 38 (8 new: build, parts, knob art turns, switch frames, the template, a code round
  trip, a lab code and a refused one, a reload). `packaging/windows/check.mjs` 22 (new: a kit of your own wears
  knob art set from a file, in the app).
- **Sharing art through the Hub:** the proposal for the Hub lane is goati-sync
  `proposals/2026-11-11-crbn-rig-kit-art-store.md`.

### R1c. The store's skins (D-RIG-018 (e))

The owner, at R2b: "Salvage looks really awesome, and so I want it to be prominant both in screenshots, and on the app
store page itself in a section about "Choosing and customing your own skins" section. I want the CRBN skin to be the
first one players see, and Salvage to be the second - And ideally the salvage one cycles, and is a bit random, to
really highlight how organic and customisable that skin is." It comes after R1b, because R1b's builder and players' own
art are the customising this section shows. It can be the end of R1b's session if there is room.

- **Already done (R2b):** CRBN is the store's first picture (`crbn-rig-shot-2-desktop-2.png`, the desktop app).
- **Already done (SYNC:RIG-018, D-RIG-019):** the hero, card and cover show the kits.
  - The hero (`crbn-rig-hero-3.png`) and card (`-card-3`) show the CRBN amp and cabinet.
  - The cover (`-cover-4`) is his pick: four amps stacked, CRBN, Salvage, Compact and Rack.
  - The web shot (`-shot-1-web-3`) and the four looks (`-looks-4`) are retaken on R1's page.
  - The gear comes from `packaging/hub/gear-shots.mjs`, the composition from `art/art.html`.
- **His verdicts on eight Salvage amps (SYNC:RIG-018).** Use them for the cycling picture. Each is `sheet, mesh,
  metal, glow, words, seed`, reproduced by `gear-shots.mjs --kits=hammer --salvage=...`. Shots 1 to 5 are his setup
  (`orange, perf, copper, valves, tags`):
  - The best:
    - #2, seed `258637` (the cover's, and `gear-shots.mjs`'s default);
    - #6, `pale, perf, copper, valves, paint, 651644`.
  - Good:
    - #1, seed `591410`;
    - #4, seed `17617`;
    - #8, `red, chicken, rust, neon, stamped, 439322`.
  - Never use #3 (seed `131233`) or #5 (seed `802023`): "They look blurry and stretched." Any shuffle can draw a
    crop like these, which is the fix below.
  - #7, `blue, woven, steel, embers, paint, 88649`: "the paint flakes are too big". He would use it only scaled down
    3x. Its sheet (Total Textures `mis008`) is 1200x900 at its largest, so it cannot be: it waits for a better sheet.
- **Salvage's soft crops: fixed at R1b (SYNC:RIG-019).** The cause was two things, both now handled in `hw.js`
  `cropOf`:
  - The quarter turn: #3 and #5 were the only two of the eight whose amp turned its sheet. That left 768 pixels
    across an 814-pixel face, magnified 1.31 and 1.33 page pixels per sheet pixel; the six kept magnify 0.84 to
    1.15.
  - The orange sheet itself: rows 296 to 440 of its 768 are smeared, stretched to make it tile. Detail runs twice as
    strongly down those rows as across them; nothing else on the four sheets passes 1.2. Turned, that band ran down
    #3's and #5's faces.

  The rules now:
  - A sheet turns only where, turned, it still spans the piece without magnifying.
  - No crop magnifies past 1.2 page pixels per sheet pixel (1.5 screen pixels at 125%).
  - A crop moves off a sheet's smeared rows (`SHEET_SOFT`) to the nearest clean ones.

  The random draws keep R1's order, so #2's and #4's amps (the cover's among them), #6 and #8 are unchanged. #1, #3
  and #5 moved onto clean rows, and the orange cabinets now magnify about as their amps do. Replayed over 90,000
  random crops, none shows the band or passes the cap.
- **Salvage's sheets: new ones when he has them.**
  - The four sheets are 1024x768, from 1200x900 originals: `\\GOATi-SV22\Art_Resources\Textures_Sets\Total Textures
    Volumes\Disk2_Aged_Stressed\maps_hi`.
  - `photoTex` (`web/src/hw/hw.js`) magnifies each crop a random 1.05 to 1.9 times beyond covering the piece.
  - 35% of crops are also turned a quarter. A turned sheet has only 768 pixels across the amp, so those crops are
    magnified the most. At a device pixel ratio of 1.25 a sheet pixel can span about 4 screen pixels: the blur of #3
    and #5.
  - The fix: cap the magnification at about 1.5 screen pixels per sheet pixel, keeping the crop's aspect. Keep the
    quarter turn only where the turned sheet still covers the piece within that cap.
  - The canvas is drawn at no more than 2x (`k`), so shots at 3x soften Salvage a little. The cover is small enough
    not to show it.
  - **His reference textures**, better than the sheets in use, for sourcing new ones (his words, at RIG-018). Look
    for these qualities at about 3600 pixels wide or more, with a licence that lets a web page serve the crops:
    1. His favourite: https://www.pixcrafter.com/grunge-metal-with-peeling-paint-texture-background/
    2. Second: https://texturelabs.org/textures/metal_294/
    3. Good: https://www.textures4photoshop.com/tex/grunge-and-rust/old-rusty-painted-metal-texture-with-green-paint.aspx
  - **The first two are in, 2026-11-13 (D-RIG-022, SYNC:RIG-025).** The owner asked for them by link, with the
    Hardware Lab's mock as the look to reach. They turned out to be the very photographs the lab wore as Rust and orange and Worn red
    (the lab's own `tex/salvage-*.jpg`, 1400 pixels wide: same shapes, same pictures), which the build had stood in
    for with Total Textures sheets of the same names.
    - **The sheets:** Peeling orange (`salvage-peel.jpg`, PixCrafter, 5000x3750 original) and Scuffed red
      (`salvage-scuff.jpg`, Texturelabs Metal 294, its 4240x2715 file), each 3200 pixels wide, progressive JPEG at
      quality 82: 1.9 and 1.3 MB, loaded only when Salvage is drawn. First in the Sheet row, so a name plate cut from
      the next sheet pairs them as the lab did; the Total Textures four follow, and Mixed draws from all six.
    - **The default is Peeling orange** (the owner's word through the picker): the owner's setup was picked on that
      photograph.
      Saved rigs keep their sheet, and the store's pictures (Total Textures' orange) are unchanged.
    - **Why 3200:** `cropOf` sizes a crop by the sheet as a whole, so the paint shows at the lab's scale on any sheet,
      and the pixels only buy sharpness. On an amp 1,000 page pixels wide, drawn at 2x, the worst crop (1.9 times
      beyond covering) is 1.19 device pixels per sheet pixel and an average one 0.92. `SHEET_ZOOM_MAX` no longer
      binds on them. `drawCrop` now asks for high-quality smoothing, since a sheet is drawn smaller than it is.
    - **Neither smears:** detail down the rows against across them peaks at 1.01 and 1.15 per sixteenth of the
      height, under the 1.2 that found Total Textures' orange (2.53), so `SHEET_SOFT` names neither.
    - **Credits and terms** (`web/src/hw/tex/CREDITS.md`, linked from About, and both `NOTICE.txt`s): PixCrafter
      asks for a link back to the resource's page, which About gives; Texturelabs asks none. Both allow commercial
      use within a product and forbid passing the files on; the page serves its reduced copies as files it draws
      from, as it does Total Textures'. The owner was told so in the question that approved publishing.
    - **Still open:** the third reference (textures4photoshop, green paint), and #7's blue, which waits for a larger
      sheet.
  - **The third reference, asked for at RIG-026:** its download sits behind a reCAPTCHA, so it needs the owner's
    click. Its terms (textures4photoshop.com/tex/about.aspx): free for commercial use with a credit linking to
    www.textures4photoshop.com, no redistribution, games and websites allowed. Neither Box-C nor the texture library
    has it. Once the full-size file is on Box-C: a third sheet as Peeling orange and Scuffed red were made (3200 px,
    q82, CREDITS.md, About's credit with the link, both NOTICE.txt files, the self-test's sheet count).
  - **In, 2026-11-13 (D-RIG-023, SYNC:RIG-027): Rusted green.** The owner downloaded it (2570x3504, portrait, no colour
    profile) and asked for it on the server. The photograph is a door panel: a letterbox and two bolts near the top and
    the panel's raised frame round the edge, any of which a crop would put on an amp. The sheet is the clean interior at
    full size (x 105 to 2495, y 475 to 3405: 2390x2930, q82, 1.4 MB), no smear (1.0). It is last in the Sheet row, so
    the sheets before it pair with the same plates as before (the draft store picture's included); its own plate is
    cut from Peeling orange. The original is in the texture library, `Textures\Metal2`. Credits as the other two, with
    the link Textures4Photoshop's licence asks for.
- **The second picture: Salvage, cycling.**
  - Capture several Salvage shuffles. Use `node packaging/hub/desktop-shot.mjs --kit=hammer` for the desktop. For
    the web, the page's own Shuffle, or a `seed`, gives a new crop on every piece. Include his setup (D-RIG-015 (b)).
  - Join the captures into one animated PNG that holds each look for a moment. The listing tool takes it as a
    `.png`, and the Hub's store shows uploaded pictures as plain images from the CDN (pavillion_client `hub/packages/
    blocks/src/legacy/storeToPage.ts`, `Picture.tsx`), so it should play there.
  - **Tested at R2b's end (SYNC:RIG-017 ADDENDUM): the store plays an animated PNG.** The test was a
    `crbn-rig-test-salvage-cycle-1.png`: six web-page frames at 1920x1080, 1800 ms each, looping, 3.4 MB. It went
    second in `storeMedia` for a few minutes (record version 18), then the record went back to the three pictures
    (version 20).
    - The CDN serves the bytes unchanged (sha1 `27baea9d…`, `image/png`, all six frames).
    - Edge animates the CDN's `<img>`: about 66,000 and 118,000 pixels change between screenshots 1.8 s apart.
    - In his Hub, the owner: "Yes, it works, and looks great."
    - Not yet looked at: whether the small thumbnail under the strip animates as well. Check that when R1c applies.
    - How the frames were made: `web/probe.mjs` steps. Each one sets `localStorage['crbn-rig/rig']`, with `kit:
      'hammer'`, a `salv` of sheet, mesh, metal, glow and words, and a `seed`. Then it goes to
      `/?example&look=capsule` at 1536x864, device pixel ratio 1.25, and takes a shot.
    - Pillow joined the frames: `frames[0].save(out, save_all=True, append_images=frames[1:], duration=1800,
      loop=0)`.
    - The test file stays on the CDN, unreferenced. R1c's real picture needs a new name anyway, framed like the other
      store pictures.
    - Keep an eye on the size: the store loads the file on its page.
  - Its place in `pictures.json` `storeMedia` is second. Use new file names, since the CDN keeps a name for a day.
  - **In the store since 2026-11-12 (SYNC:RIG-019, his OK as shown; record version 26).** Still to look at in his
    Hub: whether the small thumbnail under the strip animates too.
  - **Made at R1b's end (SYNC:RIG-019):** `node packaging/hub/salvage-frames.mjs` makes
    `crbn-rig-shot-2b-salvage-1.png`: five frames of 1920x1080, 2 s each, 3.1 MB. The frames are his good amps in
    the order #2, #6, #1, #8, #4, each amp and its cabinet shot at 3x as his eight were. `art.html?piece=salvage`
    frames them with the words "No two alike.", the amp's choices as pills, and Shuffle lit on the two new cuts of
    his setup. `words.json` has the skins section, second on the page; it also fixes "File > Preferences" (gone
    since R2a) to "Audio settings".
- **A draft on D-RIG-022's photographs (SYNC:RIG-026), for the owner's verdicts; nothing uploaded.** The owner said
  yes to redoing the cycling picture on Peeling orange. Eight cuts were shot as the first eight were, each `sheet, mesh,
  metal, glow, words, seed` ("setup" is `perf, copper, valves, tags`):
  - #1 `peel`, setup, `314159`: mostly the grey steel;
  - #2 `peel`, setup, `271828`: orange over the grey with the panel seam, closest to the lab;
  - #3 `peel`, setup, `161803`: the grey side again;
  - #4 `peel`, setup, `141421`: orange both sides of the seam;
  - #5 `scuff, perf, copper, valves, paint, 173205`;
  - #6 `scuff, chicken, rust, neon, stamped, 223606`;
  - #7 `peel, expanded, scrap, embers, stamped, 244949`;
  - #8 `mixed, woven, steel, furnace, raised, 264575`: Mixed drew Pale blue for the amp.

  `node packaging/hub/salvage-frames.mjs --set=peel` makes the draft, `crbn-rig-shot-2b-salvage-2.png` (frames #2, #6,
  #4 with Shuffle lit, #5, #7; 3.3 MB); `--set=r1c` still makes today's picture. The owner reviews both on a private
  page, https://claude.ai/artifact/VVaB1RuCneT84pvj9cDkfq, and answers in chat. Then: `PEEL` in salvage-frames.mjs as
  the owner orders it, rebuilt and shown again if it changed, the new name second in `pictures.json` `storeMedia`,
  `hub-listing plan`, `upload`, `apply`, and a look at the store.
- **The owner's verdicts on the draft (SYNC:RIG-028):** #4, #5, #7 and #8 the best, #4 and #5 the best of those; "all
  of these are pretty good. There aren't any bad ones." The owner asked for a way to flick through seeds and lock one
  hero cut per design, and named what made the lab's Salvage good: "the scratches on the pedals lined up with where a
  human foot would be pressing", and on the amp "a line between the six knobs and where the power section is, and the
  paint is more worn out around where humans would be flicking the switches". Asked through the picker: make that
  deliberate first, then pick (the recommendation), since it changes what every seed draws.
- **Wear where hands go, as built (D-RIG-024, `web/src/hw/hw.js` `cropOf`):**
  - Each sheet gets a wear map when it loads (`wearMap`, 96 cells across): each spot's OKLab distance from the sheet's
    paint (the median of its most chromatic 40%), scaled by the 95th percentile. Checked on all seven: the bare steel
    on Peeling orange, the scuffs on Scuffed red, the rust and peeled patch on Rusted green, the rust runs on the rest.
  - A piece with controls (`zonesOf`: the amp's `.knobs` against its `.tgs` and `.pwr`, a pedal's `.pknobs` against
    its footswitch `.fs`, the cabinet's IR switch) draws 16 cuts from its seed and takes one of the best four by the
    mean wear under its switches less the mean under its knobs. The name plate and the grille keep the plain cut.
  - A sheet with a seam (`SHEET_SEAM`, Peeling orange at 0.594) puts it exactly between the knobs and the switches
    where they share a row, unturned, flipped so the worn side faces the switches; scale, height and the vertical flip
    are the seed's.
  - Every seed draws differently from before, so `salvage-frames.mjs` no longer redraws the store's picture of R1c or
    RIG-026's draft: the store keeps its uploaded picture until the heroes replace it.
  - Pedals reach the page in R6 and get this with no more work.
  - Checked: `web/check.mjs` reads the painted faceplate back and finds the seam's dark line where the cut put it, between
    the knobs' end and the switches' start, with wear under the amp's and the cabinet's switches.
- **The owner's heroes (SYNC:RIG-029, D-RIG-025):** from the picker (https://claude.ai/artifact/VSjYf4yb5AzErxKCYi13sw,
  its `heroes` store), in his order: #4 seed 957038, #5 930097, #7 375725, #8 461939, and his setup on Rusted green
  577215 last. He then asked why the pedal on the right had become an IR box: it never was a pedal in Rig (the cabinet's
  IR panel has always been there; the pedal was the Hardware Lab's). He chose to build R6's pedals first, so each frame
  now shows the amp with a Salvage pedal beside it in place of the cabinet. `node packaging/hub/salvage-frames.mjs
  --set=heroes` makes `crbn-rig-shot-2b-salvage-3.png` (5 frames, 3.3 MB): the amps are his cuts unchanged (compared
  against the picker's renders), and the pedal is the example capture under the kit's own pedal name, Scrap fuzz. The
  owner reviewed it on https://claude.ai/artifact/3GmgppTvACKEty82urTmqc and said publish. **In the store** since
  2026-11-14: second in `pictures.json` `storeMedia` in place of `-1`, uploaded (200/200), `apply` 19 of 19 (record
  version 26 -> 28), the CDN's bytes the listing folder's (`packaging/hub/README.md` has the row).
- **The section:** a `## Choosing and customising your own skins` section (or the owner's wording) in
  `packaging/hub/words.json` `page`. It covers:
  - the twenty kits, CRBN the default;
  - Salvage's choices and Shuffle;
  - the Rig builder, RIG1 share codes and players' own knob and switch art.

  Show the owner the words with the pictures before `hub-listing apply`.
- **Checks:** `hub-listing plan` shows the new names unserved, then `upload` and `apply` read back. The store shows
  CRBN first and Salvage second.

### R2. The desktop on the page (U2): may take two sessions

The page becomes the desktop app's UI through iPlug2's WebView2 editor, over `web/engine/rig_engine.cpp` compiled into
the plug-in, so every later feature is built once (D-RIG-008 (e)). Upstream's IGraphics UI is not kept as a choice
(D-RIG-007 (a)).

- **Ask first: vendoring two Microsoft dependencies.** iPlug2's `IPlug/Extras/WebView` is vendored but includes
  `WebView2.h` (the Microsoft.Web.WebView2 SDK, BSD-style licence) and `wil/com.h` (Windows Implementation Library,
  MIT), which are not. Builds fetch nothing (D-CRBN-003), so both must be vendored as D-RIG-001 vendored iPlug2: at a
  pinned version, trimmed to the headers and the loader, licences kept, recorded in `vendor.json` and `UPSTREAM.md`.
  That needs the owner's word (a one-time download). The WebView2 **runtime** is part of Windows 10 and 11 (Box-C has
  157). The app says what to do if the runtime is missing.
- **R2a, the app on the page:**
  - The standalone's editor becomes `WebViewEditorDelegate`, loading the page's files from the app's folder. The Hub
    package carries them, from `web/src` plus the wasm-free engine glue.
  - The page's engine becomes two backends behind one interface in `web/src/engine.js`: today's AudioWorklet, and a
    native one through WebView messages (`window.chrome.webview`). The messages carry parameter changes, a capture's
    or IR's bytes or path, meters and clip at about 30 Hz, and status: device, sample rate, buffer, latency.
  - `rig_engine.cpp` replaces the plug-in's own DSP chain in `ProcessBlock`. The parity test (`node
    web/engine/test.mjs`) keeps the web and native engines equal sample for sample.
  - The standalone's audio and MIDI settings dialog opens from the page ("Audio settings…").
  - Settings live in the app's state, and the WebView's data folder sits under `%LOCALAPPDATA%\CRBNAmp`.
  - Desktop-only words follow the host: no "Play my guitar" permission flow, the device list from the driver, and
    "Desktop app" swaps for "Open the web version".
- **R2a's checks:**
  - A scripted run of `crbn-rig.exe` shows the page; take a screenshot (crbn-launcher `scripts/desktop-host/shot.ps1`).
  - A headless render switch, for example `--render in.wav out.wav --capture x.nam`, plays the example capture equal
    to `web/engine/test.mjs`'s reference.
  - Parameters round-trip, and the meters move.
- **R2b, ship it:**
  - Package with `pwsh packaging/windows/package.ps1`, signed in the owner's SimplySign session (`-Sign`).
  - Publish to dev and confirm (`packaging/hub/confirm.ps1`).
  - Retake the store's desktop screenshot and upload it under a new name.
  - Update `packaging/hub/README.md`.

### R2a, as built (2026-11-11, SYNC:RIG-016, D-RIG-017)

- **The owner's word** (D-RIG-017 (b)): the WebView2 SDK alone, with Rig's own host instead of iPlug2's
  `IPlug/Extras/WebView`. That version loads from `file://` (the page's modules and fetches are refused there), cuts
  messages to the page at 1,024 characters, and needs WIL. `WebView2/` holds version 1.0.4314.35, four files byte for
  byte (`vendor.json`, `UPSTREAM.md`). Nothing in `iPlug2/` changed.
- **The app** (`NeuralAmpModeler/`):
  - `NeuralAmpModeler.cpp` is a thin host now. Its DSP is `rig_engine.cpp` through `RigDesktop.cpp`, and its window
    is the page through `RigWebView.cpp`. The message list heads `NeuralAmpModeler.cpp`.
  - Upstream's IGraphics UI and DSP chain are gone, with `NeuralAmpModelerControls.h`, `Colors.h`,
    `Unserialization.cpp` and the fonts and pictures in `main.rc`. The app builds with `NO_IGRAPHICS`.
  - The window is resizable and opens at 1280 x 800 (or nine tenths of the screen). The page is served from `web\`
    beside the exe as `https://crbn-rig.example/`, and its storage lives in `%LOCALAPPDATA%\CRBNAmp\WebView2`. With no
    WebView2 runtime, or no `web\` folder, the window says what to do and keeps the File menu.
  - `crbn-rig.exe --render <capture> <in.f32> <out.f32> <rate> [block]` renders as `web/engine/native_render.cpp` does,
    and exits with code 3 beside a running copy.
- **The engine:** a native build of `rig_engine.cpp` adds `rig_stage_model`, `rig_stage_clear_model` and
  `rig_collect`. The UI thread builds a capture, `rig_process` swaps it in, and the UI thread frees what it replaced.
  The wasm build leaves them out.
- **The page:**
  - `web/src/audio-web.js` (the web graph, moved out of `app.js` unchanged) and `audio-desktop.js` (messages) answer the
    same calls.
  - `index.html` marks the desktop app (`data-host="desktop"`) before the first paint. `[data-web]` and
    `[data-desktop]` words and buttons show by host: "Web version" for "Desktop app", and "Audio settings…" (iPlug2's
    driver dialog) for the input list. The status line and the "Audio device" field come from the driver.
  - Captures go as their JSON text. An IR and the demo riff are decoded by the page at their own rate, and the
    engine resamples and scales them as the desktop always did.
  - **Nothing plays until "Play my guitar"** (no permission to ask): until R3's squeal guard, a laptop's microphone
    and speakers must not feed back when the app opens.
- **R1's slip fixed:** `hw.js` called `$` for `$$` when fonts loaded late, which the desktop's first start showed.
- **The checks:**
  - `node packaging/windows/check.mjs`, 21 checks:
    - `--render` equals the parity harness, bit for bit (four cases);
    - the page from its folder in Rig's look, with the desktop's words;
    - the driver's status reaches the page;
    - the demo riff through the native engine, with both meters moving;
    - Output -40 to -30 dB measures +10.00 dB;
    - Standby silences the output while the input is still heard;
    - a unit-impulse IR measures -17.27 dB (-17.26 expected at 44.1 kHz);
    - real arrow keys and typing reach the page;
    - Audio settings opens the driver's dialog;
    - no page errors;
    - a clean exit.
  - It plays the riff quietly through the default device for about ten seconds, with a throwaway WebView2 profile in
    `dist/desktop-check`.
  - `node web/check.mjs` 30/30, and `node web/engine/test.mjs` all cases (most bit-identical).
- **Not yet:** R2b (signing, publishing, the store's desktop screenshot). The VST3, AAX and macOS projects still name
  the removed files (P4). The desktop page doesn't read the suite look file (D-CRBN-024's desktop half) yet.

### R2b, as built (2026-11-11, SYNC:RIG-017, D-RIG-018)

- **The version:** 0.9.0, in `config.h` and `main.rc` (the owner's word), for the first build on Rig's page.
- **Signed** in the owner's SimplySign session (`package.ps1 -Sign`): GOATi's Certum certificate, Certum's timestamp,
  `signtool verify` clean. `packaging/windows/check.mjs` 21/21 on the signed folder; `web/check.mjs` 30/30;
  `web/engine/test.mjs` all cases.
- **Published to dev:** manifest `e043f4dd9e25048f31838edfdcd08c041261b4f2`, 63 chunks, 2.0 MB sent. `confirm.ps1`:
  the CDN serves it, and PatcherCli installs 67 of 67 files byte-identical. The owner's Hub sees it after a restart.
- **The web version** published on his word: build `20261111-0839-fff8c4a-f802d8f4`, all 62 files live.
- **The store's desktop picture:** `packaging/hub/desktop-shot.mjs` (new) captures the real app from the Hub folder:
  - a throwaway profile, and Output at -12 dB;
  - the demo riff, captured at a loud moment;
  - the window's visible bounds only.

  `art.html` frames that capture. `pictures.mjs --only=desktop` renders the piece alone; `--desk=` and `--out=` are
  for previews. The owner picked CRBN over Salvage. The picture went up as `crbn-rig-shot-2-desktop-2.png`, first in
  `storeMedia`, and the record reads back at version 16. Since RIG-018, the hero, card and cover show the kits, and the web
  pictures are retaken on R1's page.
- **A pitfall on this box:** a fresh WebView2 profile on D: (a 2 TB hard disk, 5% free) kept the page from getting
  ready for 13 to over 30 seconds; on C: (an NVMe SSD) it takes about two. `desktop-shot.mjs` keeps its profile in
  the temp folder. `check.mjs` still keeps its profile in `dist/desktop-check` on D:; if it times out waiting for
  the page, move that profile too. The app's own profile is under `%LOCALAPPDATA%` (C:).

### R3. Power, auto-off and the squeal guard (U1)

As P3-UX's U1, drawn as picked: power B (a pilot lamp and Power / Standby toggles on the faceplate) by default, with
the header pill (A) and the big button (C) in the look menu; Space as the key.

- **Engine (`rig_engine.cpp`, both builds):**
  - **Standby:** the output fades out in about 20 ms; the input stays open.
  - **Auto-off:** standby when the input device disappears (the browser's `devicechange` or the track's `ended`; the
    driver's device-removed on the desktop), and on the signature of a pulled jack (a full-scale spike, then mains hum
    at 50 or 60 Hz, or dead silence).
  - **The squeal guard,** on by default (D-RIG-008 (e)): it mutes when a narrow peak holds well above the rest of the
    spectrum for a few hundred milliseconds **and grows or sustains in the input too** (feedback loops back through
    the input; a held note does not keep rising). It says why, with the frequency, in words, never colour alone.
    Space, or one click, brings the output back.
- **Tests, the part that matters:**
  - Synthetic feedback (a growing sine fed back into the input) trips the guard within 300 ms.
  - A pulled-jack recording, or its synthetic spike and hum, trips auto-off.
  - **No false trips:** NAM Core's demo riff, long sustained notes with and without high gain, and a sine sweep never
    trip it.
  - Add these to `web/engine/test.mjs` so both builds run them.
  - `web/check.mjs` gains checks for the controls and the banner.

### R3, as built (2026-11-12, SYNC:RIG-020, D-RIG-021)

Web build `20261111-1620-1e45d76-b2af5c94`, live. Desktop **0.9.2**, signed, on the dev Hub.

- **The engine** (`web/engine/rig_guard.h`, which `rig_engine.cpp` includes, so both builds compile it):
  - **Standby** is an engine parameter. The output fades out over 20 ms and back, and the input stays open. The web
    version's GainNode fade and the desktop host's own fade are gone.
  - **The squeal guard** listens to the output and the input together: a 43 ms frame about every 11 ms, between
    200 Hz and 16 kHz. It suspects a squeal when all of these hold:
    - a narrow, loud peak (half the output's energy in five bins above 1.5 kHz, 70% below; louder than -40 dBFS);
    - the peak keeps its frequency within 0.6% and does not fade;
    - the input carries the same tone and does not fade either;
    - the input follows the output at a steady ratio.
    It waits 70 ms above 1.5 kHz and 120 ms below. Then it asks: it dips its own output 4 dB for 50 ms. It trips only
    when the dip comes back through the input, against the input's own trend: a fall of 2 dB or more, then a turn
    upward of 2 dB or more about 50 ms later. A loop answers so whether it is saturated or still growing (a growing
    loop collapses under the dip, then regrows). It confirms over one more frame unless that frame holds a tone at
    another frequency (a new note's attack can look like an answer). A tone that does not answer is asked again a
    second later, three times at most while it holds.
    - **Why it asks:** listening alone cannot tell a squeal from a steady tone someone plays in. NAM Core's example
      clip, which the page plays as its "demo riff", is a second of silence and a second of a 220 Hz sine, and the
      first build tripped on it. The guard and auto-off also rest while the riff plays, since nothing can feed back
      then.
  - **Auto-off** watches the input for a pulled jack: a spike at -1 dBFS or more, then either of these.
    - Within 30 ms, dead silence for 300 ms: below -60 dBFS peak and -75 dBFS RMS. A palm mute cannot fall that fast.
    - Mains hum: two 200 ms windows where the comb of twelve 50 Hz or 60 Hz harmonics carries 80% of the energy. A
      seven-string's low B at 61.7 Hz does not count.
  - Neither listens in standby or once muted. A write of `clearTrip` (Turn back on, or Space) lifts the mute.
  - `rig_status` reports what muted the output, the frequency, a trip count, how long the tone held, when, and the
    fade's gain. New params: `standby`, `guardOn`, `autoOff`, `clearTrip`.
- **The input device:** a browser's track `ended`, or the device leaving the list, puts the amp in standby with
  "Auto-off: your input device went away". On the desktop the same happens when the driver stops delivering audio
  while the guitar plays, except within 30 s of opening Audio settings, which restarts the driver.
- **The page:**
  - Power B is the default: the kit's own pilot and switches on the hardware, and the page's own lamp and toggles
    (`.pw-lamp`, `.pw-bat`) on the islands and the stripe. A (a header pill beside the guard's state) and C (a big
    button before the chain) are in the look menu under Power.
  - Space is the key everywhere but text fields, dialogs and the look menu, matched by key as well as code (keys
    without a scan code carry no code).
  - The banner says why, in words, with "Turn back on (Space)": Standby; the squeal guard, with the frequency and how
    long it held; auto-off on silence, on hum (with its frequency), or on the device.
  - The pilot reads On, Standby, Muted or Off.
  - Protection in the setup holds the Squeal guard and Auto-off switches, both on (D-RIG-008 (e)).
- **The desktop app plays the guitar at open** if it was playing (not in standby, not muted) when it last closed. That
  was his pick of three. A first run still waits for Play my guitar.
- **Tests:**
  - `web/engine/test.mjs`: 25 cases from `web/engine/scenarios.mjs` through the wasm and MSVC builds, the same sample
    for sample and on every trip.
    - Seven real feedback loops trip within 300 ms of turning loud, the slowest 289 ms: 800 Hz to 5 kHz, a fuzz,
      over the riff, at 44.1 kHz.
    - Four pulled jacks trip auto-off: hum at 50 and 60 Hz, dead silence, and 44.1 kHz.
    - Fourteen cases trip nothing: the riff (clean, at +20 dB, through a fuzz), long notes (clean, at +20 dB,
      through a fuzz, beating, slowly decaying), chords hit to clip and muted, a low B struck hard, and three sweeps.
    - It also checks Standby's fade and Turn back on.
    - The fuzz is an LSTM of one cell, `fuzzCapture()`: NAM Core's examples are mostly clean.
  - `web/check.mjs`: 44 checks (6 new). They cover the power drawings, Space, the Protection switches, and the guard in
    a real Web Audio loop through the worklet (2409 Hz). Auto-off trips through the page's own input, with Edge's fake
    microphone playing a pulled jack, and a lost device comes back on Turn back on.
  - `packaging/windows/check.mjs`: 26 checks (4 new): Space through the engine, a real Space from Windows, auto-off in
    the native engine with the page's banner, and a second opening that plays the guitar at once.
- **What it does not prove:** every case is synthetic. "No false trips on real playing" is his to try: real playing,
  a real laptop's microphone and speakers, a real pulled cable. The dip is 4 dB for 50 ms, heard only on a steady tone
  that passes every other test first (a synth pad, a sine). A held note that blooms into real feedback is muted, as
  the guard on by default means; Protection turns it off for anyone who wants that feedback.

### R4. The library (U3)

As P3-UX's U3, drawn as picked: the list (A) by default, cards (B) and shelves (C) in the look menu. It replaces the
"Your captures" panel.

- **The folder:** the desktop reads it directly (a native folder dialog through the bridge). The browser asks once
  through `showDirectoryPicker` and keeps the handle in IndexedDB, or takes dropped files where that API is missing.
- **The index:**
  - Each `.nam` file's `metadata`: name, gear type, make and model, tone type, who captured it, sample rate.
  - Each `.wav` file's length and rate.
  - Kept in IndexedDB on the web and in the settings folder on the desktop; refreshed when the folder changes.
- **What a person does:** search as they type, filter chips (gear, tone, favourites), sort, a star on every row, and
  click to hear it.
- **Tests:** an index of NAM Core's examples; a generated 5,000-file folder indexes in under 10 s and searches in
  under 50 ms; favourites survive a reload.

### R4, as built (2026-11-12, SYNC:RIG-021)

Web build `20261112-0709-b07901a-0bb8a2c1`, live. Desktop **0.9.3**, signed, on the dev Hub (manifest `67e64025…`, 70 of
70 files install byte-identical). Shipped on the owner's word in the session (SYNC:RIG-022). No engine change.

- **The panel** replaces "Your captures" (`web/src/index.html`, `library-view.js`). On top, what the rig plays now: the
  capture and the cabinet IR, each with its star (when it came from the folder open now), Open (a file from anywhere)
  and Remove. Under it, the library: the folder's name and counts, Look again, Change; search, chips and sort; then the
  folder's files, drawn as D-RIG-008 (d) picked: **A, the list**, by default, with B (cards) and C (shelves by gear)
  under "Library" in the look menu. In the Amp front layout the panel is 280 to 340 px wide and keeps to the window's
  height, the list scrolling inside it.
- **What a person does:**
  - Search as they type: every word must appear in the name, the file's path, the make, model, who captured it, the
    gear or the tone, accents folded ("uber" finds Überschall).
  - Chips for the gear (All, Amps, Pedals, Full rigs, Cabinets, Other), Favourites, and the tones (Clean, Overdrive,
    Crunch, High gain, Fuzz); only chips the folder has are drawn.
  - Sort by name, gear, maker, who captured it, or newest.
  - A star on every row and card, and on the rig's own capture and IR.
  - A click plays it: a capture into the amp, an IR into the cabinet, through the same path a dropped file takes. Its
    row says Playing, in words. Up and down move through the list; Enter in the search plays the first match.
  - Dropping a folder anywhere makes it the library; a file still plays.
- **The index** (`web/src/library.js`, one module for both builds):
  - Per file: its relative path, size and modified time, and what it says. For a capture: the metadata's name, gear
    type, make, model, tone type and who captured it, and its sample rate. For an IR: its rate, channels and length.
  - What a file says is read from its first 16 KB and last 8 KB, never the whole file. The metadata is the top level's
    if it is in the head (as NAM's trainer and TONE3000 write it); else the last one in the tail (a SlimmableContainer's
    own, after its submodels); else the first nested one (a container's submodel's). The sample rate is the last one in
    the tail. A capture without metadata is named after its file. A WAV is read from its first 64 KB.
  - Kept in IndexedDB (the `lib` store, version 3 of `crbn-rig`; in the desktop app, under the app's WebView2 profile in
    `%LOCALAPPDATA%\CRBNAmp`). A fresh look reads only the files whose size or time changed.
  - Favourites are relative paths, kept per folder in `localStorage` (`crbn-rig/favourites`); a browser folder is known
    by its name, so two folders of one name share them. A dropped file outside the folder has no star yet: R5 decides
    whether a pad can hold one.
  - At most 50,000 files, 12 folders deep; names starting with a dot are skipped.
- **Where the files come from:**
  - **A browser:** `showDirectoryPicker`, its handle kept in IndexedDB. Next visit the folder opens itself if the
    browser still grants it, or offers "Open Tones" (one click) if it asks again. Without that API (or where a view
    refuses it): `<input webkitdirectory>` or a dropped folder, kept for the visit. A browser charges a few milliseconds
    to open each file, so opening the page or coming back to it is a **quick look** (the names; new files read), and
    **Look again** opens every file, to find files changed in place.
  - **The desktop app** (`NeuralAmpModeler/RigLibrary.cpp`): Windows' folder dialog ("Choose the folder with your
    captures and IRs", "Use this folder"), opened after the page's message returns (`WebViewHost::Defer`), never inside
    WebView2's callback. A worker thread lists the folder, reads what each file says by the same rules, and reads a file
    to play; its replies reach the page through `OnIdle`. A watch (`FindFirstChangeNotification`, quiet for 0.8 s) says
    when the folder changes, and the page looks again. Only `.nam` and `.wav` files under the folder are read, at most
    64 MB; a path part of `..`, or one holding `:` or `\`, is refused. The messages are `libPick`, `libList`, `libMeta`,
    `libRead`, `libWatch` and `libChanged` (NeuralAmpModeler.cpp's list).
- **Speed** (Box-C):
  - **Desktop:** 5,009 files (the generated 5,000 and NAM Core's 9) indexed natively in **1.6 s** (listing 0.18 s,
    reading 1.4 s); a look with nothing changed takes 0.1 s.
  - **Web, the page's own work:** 5,000 files from a dropped folder (real files, in memory) indexed in **2.5 to 4.3 s**.
  - **Web, a browser's private folder:** about 3 ms a file in headless Edge (1.3 ms to open one, 1.6 ms to read its
    head): 1,000 files in 2.9 s, 5,000 in 15 to 18 s on a first visit. That is the browser's cost per file, and why the
    quick look exists. A real folder through the picker cannot be driven headless, so its speed is the owner's to see.
  - **Search:** a few milliseconds over 5,000 entries; the slowest search to the next frame **18 to 39 ms**, in both
    builds (59 ms once on the desktop, with 60 rows drawn, before it drew 40). Only the first 40 rows are drawn (more as the list scrolls), rows out of view are not laid out
    (`content-visibility`), and the list goes back to its top before its rows change, not after: after, it forced the
    page's layout there and then (108 ms before, 10 ms after).
- **Tests:**
  - `web/check.mjs`: 58 checks (14 new). NAM Core's 9 examples and a generated 300-file folder in the browser's private
    folder, given as the person's pick. The index reads every file as the fixture says it should (top, container, tail,
    no metadata; IRs mono and stereo, 44.1 and 48 kHz), and hidden files and other kinds are not listed. Search, the
    chips, the sort, a click to play a capture and an IR, a star and Favourites, the three drawings, the page opened
    again (the folder back by itself, a quick look reading nothing, the favourite and the Playing mark), and Look again
    finding a file added. Then 5,000 files through a dropped folder's files: under 10 s, searches under 50 ms.
  - `packaging/windows/check.mjs`: 33 checks (7 new). The real folder dialog (its Folder box typed into, "Use this
    folder" clicked); 5,009 files natively in under 10 s; every entry the app read equal to `library.js`'s reading of
    the same file, all 5,009; a search under 50 ms; a click playing a capture in the native engine, and a star; a file
    copied in appearing by itself; and on the second opening, the folder back with its favourite.
  - The fixture is `web/test/library-fixture.mjs`, for both checks; `web/probe.mjs` serves it under `/__selftest/`.
- **Found:**
  - NAM Core's `my_model.nam` and `wavenet_a1_standard.nam` carry no metadata, and `A2.nam` keeps its own after 680 KB
    of weights: hence the head-and-tail rule.
  - A search input's own width (twenty characters and its cancel button) widened the panel's grid column past its
    island: `width: 0` with `flex: 1`, and the panel's column `minmax(0, 1fr)`.
  - Headless Edge processes left by a stopped probe can hold the default audio device, and the desktop check's riff then
    hears nothing. Stop them first (their profiles start `crbn-rig-edge-`).
  - **An R3 race, fixed:** Turn back on could fail now and then. Both backends' `resume()` marked the engine's last
    report unmuted at once, so the page forgot the trip it had just lifted. A report the engine had already sent, still
    muted, then read as a new trip and muted the page again, and the desktop app did not play at its next opening. Now
    only the engine's own next report says it is unmuted (`audio-web.js`, `audio-desktop.js`). The desktop check caught
    it twice in five runs before the fix, and none in four after.
  - The desktop check's real keys (an arrow, typing, Space) failed once in eight runs, before the library's part, as if
    another window had taken the focus: worth watching, not changed.
  - In the web version a click on a capture while the guitar plays drops the sound for about 0.1 s: the engine loads a
    capture on the audio thread, and a standard WaveNet takes 90 ms (measured under R5 below). The desktop builds a
    capture on its UI thread and swaps it in at once. R5's slots are where this goes away.

### R5. Favourites on standby (U4)

As P3-UX's U4: ten pads on keys 1 to 0, footswitches (A) by default, keycaps (B) and setlist (C) in the look menu.
Arrows give next and previous.

- **Engine:** hold up to ten models loaded, play one, and crossfade over 20 to 50 ms on a switch. Measure memory and
  CPU in the browser with ten standard captures; if the browser cannot hold ten, say so and load ahead of time on hover
  or key-down instead.
- **Tests:** a switch has no gap, and no click above the crossfade (an offline render compared against a reference
  crossfade); keys work with the look menu shut and are ignored while typing in a field.
- **Measured before R5** (2026-11-12, SYNC:RIG-021, the shipped `rig-engine.wasm` in Node's V8; headless Edge runs it about
  a quarter slower):
  - A **standard WaveNet** capture (NAM Core's `wavenet_a1_standard.nam`, 411 KB, the common TONE3000 kind) takes
    **90 ms** to load (median of ten; 153 ms at worst) and plays at **2.1x real time** (1 s of audio in 482 ms). `A2.nam`
    (664 KB) loads in 146 ms and plays at 6.6x; the small test models load in 2 to 18 ms.
  - A load runs on the audio thread: **every switch in the web version today drops out for about 0.1 s**, R4's
    click-to-play included. Ten pads cannot be loaded there while the guitar plays.
  - Most of a load is warming the model, twice: `ResamplingNAM`'s constructor resets (and so prewarms) it, and
    `BuildModel` resets it again. A prewarm runs the receptive field (about 4,096 samples for a standard WaveNet), about
    40 ms each at 2.1x. Building with `get_dsp`'s `DspLoadOptions{prewarm = false}` and warming once, or warming on live
    input under the crossfade, is the first thing to try; then measure again in both builds.
  - **Two standard captures at once need about 96% of the audio thread in Node, more in a browser**, so a crossfade that
    runs both models may underrun in the web version on a machine like Box-C. Options to weigh: a short dip (fade out,
    swap, fade in, one model at a time) in the browser with the true crossfade on the desktop; or a crossfade only
    where the page measures the headroom. R6's pedals in series meet the same limit.
  - Memory is not the limit: the engine's linear memory is 32 MB with or without a standard capture (its weights are
    about 100 KB of floats). Ten held captures cost about ten times one model's buffers; measure in R5.

### R5, as built (2026-11-13, SYNC:RIG-024)

Web build `20261113-0409-12f896b-6798a825`, live (roll back with `--promote-only=20261112-0709-b07901a-0bb8a2c1`).
Desktop **0.9.4**, signed, on the dev Hub (manifest `89634c92…`, 71 of 71 files install byte-identical). Shipped on the
owner's word in the session, for his live test.

- **The engine's slots** (`web/engine/rig_engine.cpp`, both builds): twelve, ten for the pads and two for whatever plays
  off them, so a switch from a library click to the next still fades. One is heard; `play` (a parameter) asks for a
  slot, and the switch starts at the next block once that slot is warm. A switch is 30 ms: a **crossfade** on the
  desktop (both captures play, equal power), a **dip** in a browser (the one going out fades alone, then the one
  coming in fades in alone from silence, on raised cosines: under -20 dB for 5 ms).
- **Loads off the playing path:**
  - A capture is built **cold**: NAM Core's prewarm on construction and reset held off (it ran twice), then warmed once
    by playing it silence (`ResamplingNAM::PlaySilence`, `WarmFrames`). The desktop builds and warms on its UI thread
    (`rig_stage_slot`) and hands the capture over per slot. A browser builds on the audio thread and warms there a little
    per block: 128 frames each time the credit allows, a quarter of a frame per frame heard (`warmRate` 0.25), twice
    that while a switch waits for it, four times while nothing is heard. Nothing heard changes while another slot loads
    and warms: the engine test checks it sample for sample.
  - **The browser's page reads the capture's JSON** (`engine.js`'s `packCapture`) and hands the engine its weights as
    floats beside the rest. In WebAssembly a decimal number is read in software 128-bit floats (`__floatscan`,
    `fmodl`, `__multf3`): 85% of a standard capture's 40 ms build was its 13,802 weights; Edge's own `JSON.parse` reads
    the whole file in 2.5 ms. The engine puts them back as numbers (`PutWeightsBack`), the same floats NAM Core reads.
    A standard capture now builds on the audio thread in **2.1 ms** in headless Edge (A2 in 6.4 ms). R4's 0.1 s dropout
    on a click in the library is gone: the old capture plays on until the new one is warm (about 0.27 s for A2 while a
    standard capture plays), then the dip.
  - Captures are built for 128-frame blocks (`kModelBlock`; the engine plays a larger host block in pieces): at 1024
    frames each standard capture held about 6 MB of per-block buffers, twelve 102 MB. Twelve now fit in the engine's
    first 32 MB.
  - A slot left behind by a switch is warmed again in the background, but may be heard at once meanwhile (its
    histories are a real signal's, so no cold thump): going back to the pad just left is one fade.
  - Each capture's **offset for silence** (its biases', measured at the end of its warm) is taken off what it plays:
    NAM Core's standard WaveNet sits at -1.0e-3, A2 at -2.6e-3, and a switch stepped from one to the other in front of
    the DC blocker, which makes a step a slow bump. The DC blocker took it off in steady playing anyway.
- **The pads** (`web/src/pads.js`, `index.html`, `style.css`): the library's first ten favourite **captures**, in the
  order starred, drawn as D-RIG-008 (d) picked: **footswitches** (A) by default, keycaps (B) and a setlist (C) under
  "Favourites" in the look menu, from the Rig Lab's drawings. Under the rig in Amp front and Signal chain, a rail on the
  right in Captures first, five across on a narrow screen. Each pad says what it is doing in words: Playing,
  Switching, Loading, Cannot play. A pad's capture is loaded when it is starred (once the audio has started), held
  warm, and switched to without being read again.
  - **Keys:** 1 to 0 for the pads, the left and right arrows for the previous and next pad, and the key left of 1
    (Backquote) for the capture before this one (also the "Last two" button). Not while typing in a field, a dialog or
    the look menu; arrows are left to a knob, a choice of buttons or the library's list.
  - **Pads hold library favourites only** (the kickoff's default, for the owner to change): a dropped file plays, but
    has no star until it is in the library's folder.
- **Protocol:** the worklet's `capture` and `clearCapture` became `slot` (text and weights) and `clearSlot`; the
  desktop's became `slot` (text) and `clearSlot`; the meters carry `playing`, `ready` and `switching`.
  `rig_load_model` stays as the harness's load (slot 0, warmed and heard at once).
- **Measured** (Box-C; headless Edge on the main thread, the worklet's engine; the audio thread's share per 128-frame
  block):
  - One standard capture: 22% (p90 34%). A crossfade of two: 45% (p90 **90%**). The dip: 22% (p90 34%). Warming at
    0.25 while one plays: 36% on average, 71% p90 (one block in four carries 128 frames of warming).
  - So the browser keeps the dip: a crossfade fits a fast desktop's median but not its slow blocks, nor a laptop.
  - Desktop: a real 2 from Windows heard (pad 2 Playing) 31 ms after the key, the meter report's lag included.
- **Tests:**
  - `web/engine/test.mjs`: 40 cases (5 new), wasm and MSVC. A crossfade and a dip while a note rings, against a
    reference made from each capture alone and faded by hand: above 100 Hz -60 dB and -51 dB from it (a click would be
    tens of dB above; what the reference cannot hold is the note's own DC moving in front of the DC blocker, a bump
    under 20 Hz), the crossfade never below the quieter capture, the dip under -20 dB for 5 ms, both builds the same
    (1.8e-5). A capture loaded and warmed while another plays: not one sample heard changes. Back to the pad just left:
    one fade later. Weights as floats against the same captures as text: identical, five kinds.
  - `web/check.mjs`: 63 checks (5 new). The pads from the favourites in the order starred; keys 2, the left arrow
    and the key left of 1 switching while the riff plays; a digit typed in the search left to it; the three drawings;
    a dip between two slots through the real AudioWorklet equal to the engine run directly (0 difference).
  - `packaging/windows/check.mjs`: 35 checks (2 new). A real 2 from Windows switching pads while the riff plays in the
    native engine, and the arrow back; on the second opening, the pads back, loaded and warm. Standby's check now
    measures 1.5 s (the riff is a second of silence first; one second caught the sine only by timer slop).
- **Found:**
  - A JavaScript `String.replace` reads `$$` in its replacement as one `$`: a scripted edit turned the self-test's
    `$$l(…)` into `$l(…)`. Edit with split and join, or a function.
  - Six headless Edge browsers from the Hardware Lab session (11 November, `hwlab\edgeprof1..6`) had used about 125
    CPU-hours and kept Box-C at 64%: R4's timing checks failed (5,000 files natively in 11.5 s). Stopped on the owner's
    word; then 2.2 s.
  - `NeuralAmpModeler/ResamplingNAM.h` is the fork's own file, not a vendored library: it gained `SetPrewarmOnReset`
    forwarding, `WarmFrames`, `PlaySilence` and `SilenceLevel`, and a block size for its constructor (upstream's 2048
    stays the default). No vendored library changed.

### R6. Rigs, variants and pedals (U5)

As P3-UX's U5. Stompboxes (B) by default, rows (A) and chain chips (C) in the look menu. Variants sit on Q, W and E.

- **Engine:** captures in series (pedal slots, then the amp, then the cabinet), hot-swapped with the same crossfade.
  The page shows the CPU load and refuses a chain the device cannot run in real time, with the reason.
- **Rigs:** saved locally, and exported or imported as a small JSON file (names and file references, never the
  captures themselves).
- **Tests:** a two-pedal chain renders equal to its stages run one after another; a swap while playing is click-free.

### R6, step 1 as built: the suite look on the desktop (2026-11-13, SYNC:RIG-025, D-CRBN-025)

R5 added a row to the look menu, and D-CRBN-025 binds an app's look menu to the suite's file when its lane next
changes it. Rig's desktop now shares "Use this look in every CRBN app" with every CRBN desktop app; before, the switch
lived in the page's own cookie inside the app's WebView2 profile and reached nothing.

- **The host** (`NeuralAmpModeler/RigSuiteLook.cpp`, after crbn-launcher `looks/egui/src/suite.rs`): reads
  `%APPDATA%\CRBN\suite-look.json` at start, looks at its modified time and size about once a second from OnIdle, and
  writes it whole through a temporary file and a rename. A file over 16 KB, or one that is not version 1 with a true or
  false `every` and a `prefs` object, is no file. `CRBN_SUITE_LOOK` names another file (the desktop check's
  throwaway one); `off` turns it off, and the switch then holds in Rig alone.
- **The messages:** `suiteGet` (the page asks before it first draws, answered even before the audio's hello),
  `suiteSet` (the switch and the look), and `suiteLook` pushed when another app changed the file. The ids are look.js's
  own strings, echoed as sent.
- **The page** (`web/src/look.js`): in the app the shared state is the file, in a browser the cookie, behind the same
  calls. The menu's note says "every CRBN app on this computer" on the desktop. A look Rig lacks is written back by its
  own name, as suite.rs does. The file's last state is kept in the profile (`crbn-rig/suite`) for index.html's first
  paint, which cannot wait for the app. A switch turned on in the old cookie is carried into the file once, when there
  is no file yet.
- **Checks:** desktop 39 (4 new: the switch writes the file, the look only; another app's look arrives, 542 ms; another
  app turning it off brings Rig's own look back and leaves the file alone; opened again, Rig draws the look another
  app turned on). Web 65 (1 new: in a browser the cookie, the look only). The desktop check also now says when the
  app's DevTools connection closes, rather than Node leaving with the wait unsettled, which one run this session did
  at the library's folder dialog (no crash recorded; the rerun passed).
- **Not done:** steps 2 and 3 (captures in series, then rigs and variants).

### R6, step 2 as built: pedals in series (2026-11-14, SYNC:RIG-029)

Taken before step 3 on the owner's word (SYNC:RIG-029): the store's Salvage picture should show a pedal beside the amp,
as the Hardware Lab drew it, and a picture shows only what the app does, so the pedals came first. **Shipped** on the
owner's word the same night (SYNC:RIG-029 ADDENDUM): web build `20261113-1444-22ba710-d452aea2` live (roll back with
`--promote-only=20261113-0539-4a72586-093c12a5`), desktop **0.9.5** signed on the dev Hub (manifest `8cab0957…`, 76 of
76 files install byte-identical), and the store's Salvage picture (R1c, below).

- **The engine** (`web/engine/rig_engine.cpp`, both builds): up to four **pedal stages** in series before the amp, each a
  `Stage` that hears one slot or none, switched exactly as the amp is (R5's switch, now one per stage). `pedal1` to
  `pedal4` ask a pedal for a slot (-1: it passes the signal through); `pedalDrive1..4` scale its capture's input and
  `pedalLevel1..4` its sound, in dB. A pedal's capture plays raw: no normalizing, since what a pedal puts out is what
  the amp hears. The amp's input calibration stays at the input, before the pedals.
  - **Slots:** twenty. The amp keeps 0 to 11 (pads.js), and pedal p keeps 12 + 2p and the one after: a new capture loads
    into the one not heard, and the pedal fades into it once it is warm. A capture plays in one place at a time: a
    stage asked for a slot another stage hears stays as it was.
  - **A dip only between two captures.** A pedal stomped on or off fades against the dry signal, which costs nothing,
    so a browser crossfades it too; a pedal swapped for another (two captures in one stage) dips in a browser, as the
    amp does. The amp's own switch from no capture now crossfades in a browser as well.
  - Status: `kStatusPedals` packs six bits a pedal (the slot it hears plus one, and whether it fades);
    `kStatusPedalSwitchAt` when a pedal's last switch began. `rig_slot_render` (harness only) plays one slot alone and
    raw, for the test's references.
- **The desktop** (`RigDesktop.cpp`, `NeuralAmpModeler.cpp`): the meters carry `pedals` and `load`, the audio thread's
  time over the audio it made (std::chrono around Process, smoothed over about a tenth of a second).
- **The page:**
  - `web/src/pedals.js`: the board (up to four places, in chain order), its loads, stomps and removals, and the
    board's drawing. Drive and Level are ordinary settings (`DEFAULTS` in engine.js), kept and sent like the amp's
    knobs; a new pedal starts at 0 dB on both. The board is remembered: each pedal's file in IndexedDB (`pedal0` to
    `pedal3`, as the last capture is) and whether it is on (`crbn-rig/pedals`).
  - **Drawn** as D-RIG-008 (d) picked, stompboxes on a board above the amp: on the Hardware drawing each kit's own pedal
    (`hw.js pedalHTML`, its knobs now **Drive and Level**, the two that do something: a capture has no knobs of its own,
    so the lab's Level, Drive and Tone would have been two dead knobs), on the islands and the stripe the Rig Lab's
    stompbox. Each says what it is doing in words under its footswitch: On, Off, Loading, Cannot play. Rows (A) and chain
    chips (C) are not built yet: step 3 adds them to the look menu.
  - **In:** a capture dragged from the library onto a place on the board (library rows and cards are draggable now), a
    `.nam` file dropped there, or "Add a pedal" (a file). A place with a pedal is swapped, fading from one to the
    other. A library capture dropped on the amp plays there. A click in the library still plays the amp, as before.
  - **Salvage:** the pedals' holders come after the amp's and the cabinet's in hw.js's order of pieces, so a pedal
    coming or going never moves the amp's or the cabinet's cut (a web check). Each pedal wears round its footswitch
    (D-RIG-024's `.fs` zone, as planned).
  - **The load:** "CPU n%" beside the board while audio plays. If it stays above 98% for 1.5 s within 8 s of a pedal
    going on, that pedal goes off again and the page says why, in words (not exercised by a check: a browser cannot be
    made slow to order).
- **Measured** (Box-C, headless Edge, the real AudioWorklet, the riff): NAM Core's standard WaveNet as the amp, 27%;
  with a standard WaveNet pedal, 41%; with an A2 pedal after it, 72% (averages over about a second; R5 measured two
  standard captures at 45% on average, 90% at the 90th percentile, so a slower machine may meet the limit with two
  standard pedals). The desktop: 3% with a small pedal.
- **Tests:**
  - `web/engine/test.mjs`: 49 cases (9 new), both builds. Two pedals in series, then the amp, bit-identical from the
    note on to the chain built stage by stage by hand (`rig_slot_render`); a pedal's Drive (+6 dB) and Level (-4 dB),
    -94 dB from the same; a pedal stomped on and off while a note rings, in both switch modes, -107 and -99 dB from a
    crossfade made by hand, the amp alone untouched before it; a pedal swapped for another, crossfade and dip, -95 and
    -89 dB; a pedal asked for the amp's slot, refused. Native against wasm: within 1.4e-5 to 1.1e-4.
  - Found: three gain stages magnify small differences a great deal. Driving two pedals and a high-gain amp magnified
    the references' 32-bit rounding about 85 dB, and a standard WaveNet as the second pedal magnified the 7e-7 by
    which MSVC's and the wasm's standard WaveNet differ to 3.6e-3 at the amp. So the series case uses captures both
    builds play identically, and each property is checked where differences stay small. A capture also gives a first
    breath of about 3e-6 (-110 dBFS) right after its warm, which the reference and the chain hear at different moments:
    the series case is judged from the note on, and before it held under -60 dBFS.
  - `web/check.mjs`: 74 checks (8 new). A library capture dragged onto the board is a pedal, heard while the riff
    plays; with Salvage it never moves the amp's cut; the kit's footswitch stomps it off and on, its light and word
    with it; its Drive is a kept setting; the load shows; the board is back after a reload; taken off, it is gone and
    forgotten; a pedal stomped on through the real AudioWorklet equals the engine run directly (0 difference).
  - `packaging/windows/check.mjs`: 41 checks (2 new). A library capture onto the board, heard in the native engine's
    first pedal stage while the riff plays, stomped off and on; on the second opening, the board is back, its pedal
    heard.
- **Not done (step 3):** rigs (saved, exported and imported as a small JSON file of names and file references) and
  variants on Q, W and E; moving a pedal along the board; the rows and chain-chip drawings in the look menu.

### R6, step 3 as built: rigs, variants, moving pedals, a pedal's Tone (2026-11-14, SYNC:RIG-030, D-RIG-026)

A night session, the owner away; his four picks at the kickoff are D-RIG-026: rigs beside the pads, a variant keeps its
pedals on or off and their knobs, a Tone knob on each pedal with a switch that bypasses it ("so that players can choose
to activate our tone and tweak, or just bypass it completely"), and the web version promoted once every check passed.
**Shipped (web):** build `20261113-1546-7c4360d-081f912e`, then `20261113-1554-2dd431b-92673fa7` (the kit pedal's Tone
label readable on every kit) live (roll back with `--promote-only=20261113-1546-7c4360d-081f912e`, or R6 step 2's
`20261113-1444-22ba710-d452aea2`); `check.mjs --url`: all 72 files match. **Desktop:** built and checked
unsigned (0.9.5's folder, 45/45); a signed release waits for a SimplySign session.

- **The engine** (`web/engine/rig_engine.cpp`, both builds):
  - `pedalTone1..4` (ids 32 to 35) tilt a pedal's sound about 800 Hz: a one-pole low-pass splits it, the rest goes up
    by the Tone's dB and what is below down by as much (-6 to +6 on the knob, the engine allows ±12).
    `pedalToneOn1..4` (36 to 39) switch it in; 0, the default, is bypassed, the capture as captured, and every earlier
    case stays bit-identical.
  - A pedal's Drive, Level and Tone **glide** (a 5 ms one-pole, a frame at a time) when they change while the pedal is
    heard, and jump while it is not; a variant moves several at once (45 ms to settle within a thousandth of a dB).
  - `RunStage` takes one play callback: `Run` for the amp, `RunPedal` (Drive in, the tilt, Level out) for the pedals.
- **The page:**
  - `web/src/rigs.js`: the rig book in localStorage (`crbn-rig/rigs`), up to 200 rigs; the rig file, `crbn-rig`
    version 1, a small JSON file of names and references (a library file by its path, name and size; the example by
    name), never a capture; everything read is tidied and clamped; a reference is found in the library open now by
    the same path, else the same name and size, else the only file with that name. A file from outside the library
    is kept beside the rig in IndexedDB (`rf:<name>\n<size>`), so the rig opens again in this browser; an exported
    rig names it, and whoever opens it needs it in their own library.
  - **The rig bar** above the board: the rig's name (Enter saves), Save (a dot while the rig playing differs from the
    one saved), the saved rigs to open, the variants, New, Export, Import, Delete (pressed twice). Opening a rig sets
    the amp, the cabinet, the gate, the EQ, the output level, the cabinet switch and the board, then its variant, and
    names in words any file the library does not have. A `.json` dropped on the page imports too.
  - **Variants** on Q, W and E (Clean, Push, Lead; double-click to rename): the one picked follows the player's stomps
    and pedal knobs. Picking one sets each pedal's knobs and stomps it on or off: the engine glides the knobs of a
    pedal that plays, and a pedal stomped fades as always.
  - **Moving a pedal:** each pedal has a grip (dragged onto another place, the two swap) and arrows (swap with the
    neighbour). Each place keeps its two engine slots, so a place loads the capture coming to it and fades into it from
    what it played; the settings and the variants' parts move with the pedal.
  - **The board's three drawings** (D-RIG-008 (d), the look menu's new "Pedals" row): stompboxes (b, the default),
    rows (a, the Rig Lab's: a grip, a switch, the name and state, the knobs, the Tone, the arrows) and chain chips (c:
    Input, each pedal, the amp's capture, the cabinet, Output; a pedal's chip opens its controls underneath). The kit's
    own pedal shows only with stompboxes on the Hardware drawing.
  - **The Tone** on every drawing: a third knob between Drive and Level, and a Tone switch, dimming the knob while
    bypassed. On the kit's pedal the switch is the kit's own toggle, small, beside the lamp (`hw.js` `.ptone`).
  - **Found and fixed:** the web backend said it had started when its AudioContext existed, before the worklet's node
    did; a pedal or capture loaded in between (a drop just after Play) asked a node that was not there and failed with
    "Cannot play". `started` now means the node exists.
- **The session's picks, for the owner's review** (each a line to change):
  - A pedal new to the board joins every variant as it is set now (on, as it came), as all three variants start as
    the board was; the player stomps it out where it does not belong. (First built the other way, off in the other
    variants; a pedal then went silent on W for no reason the player could see.)
  - A pedal dragged onto another place **swaps** with it, rather than pushing the rest along: four places, and a swap
    moves two pedals, not up to four.
  - The Tone is a tilt about 800 Hz, -6 to +6 dB, bypassed by default. A rig keeps the gate, the EQ, the output level
    and the cabinet switch; the input level and its calibration stay the player's interface's.
  - Variants are named Clean, Push and Lead until renamed; Delete asks by changing its word to "Sure? Delete" for
    three seconds rather than a dialog.
- **Tests:**
  - `web/engine/test.mjs`: 53 cases (4 new), both builds: the Tone in at +6 dB, and at -6 with Drive +3 and Level -2,
    -91 and -89 dB from a tilt made by hand; bypassed, identical to the pedal with no Tone; Drive, Level and Tone moved
    together while the pedal plays, -95 dB from the glide made by hand (45 ms). Native against wasm within 2e-5.
  - `web/check.mjs`: 85 checks (11 new): the Tone bypassed out of the box, its switch and knob; a pedal moved by its
    arrows and back by its grip, settings and all, both heard while the riff plays; Q, W and E by key; a rig saved,
    the board changed, opened again; exported (1.8 KB, no weights), a non-rig refused, imported as "Test rig 2" and
    opened; rows and chips, a chip's panel; the rigs and the variant after a reload; a pedal with its Tone in through
    the real worklet equal to the engine run directly (0 difference).
  - **A check that passed by accident, made real:** R6 step 2's "the board is there again after a reload" reloaded the
    self-test's `?example` page (which skips the board by design) and waited on the old document, which was still
    ready, so it passed before the reload landed. It now opens `/` and waits on the new document, and passes.
  - `packaging/windows/check.mjs`: 45 checks (4 new): the Tone at +6 dB changes the native engine's sound 4.66 dB and
    bypassed is 0.01 dB from the plain pedal; real Q and W from Windows switch the pedals while the riff plays; a rig
    file through the app's file box finds both pedals in the library, its Drive set; opened again, the rig is open in
    its variant with both pedals heard. Export is not exercised on the desktop: WebView2 offers the system's Save
    dialog (`showSaveFilePicker`), which a check would leave open.
- **Not done:** pads that hold rigs (the owner kept them beside); MIDI for rigs and variants (R7).

### R7. MIDI (U6)

As P3-UX's U6. **Ask first:** MIDI in the browser (a second Hub permission ask for Web MIDI in the tool view, as
D-RIG-003 did for the microphone; that change is the Hub lane's, briefed in goati-sync `proposals/`), or MIDI on the
desktop only. The desktop takes MIDI through iPlug2: `PLUG_DOES_MIDI_IN` goes to 1 in `config.h`.

- **Drag and drop:** drag any control (a knob, switch, pad, variant or the power switch) onto the MIDI dock, press the
  footswitch or move the pedal, and it is mapped. Program Change maps rigs and variants; CC maps switches (toggle or
  momentary) and knobs; an expression pedal maps to any knob, with its range drawn on the knob. A live monitor shows
  what arrives.
- **The MC8:** first find out the Morningstar MC8 editor's backup format and whether a bank can be imported. If it
  can, Rig exports one from its mappings so the controller needs no separate editing. Bring the findings to the owner
  before building the export. His own backup file is the best test.
- **Tests:** synthetic MIDI in both builds (a virtual port on the desktop); learn, map, round-trip, and the
  mappings saved.
- **Found (2026-11-14, SYNC:RIG-030 addendum):** `docs/reviews/2026-11-14-mc8-backup-format.md`. A bank backup is plain
  JSON and imports one bank; the format is undocumented (the community's reading, MC8 Pro only); Morningstar documents a
  SysEx API instead. The recommendation: learning first, the bank export later, after the owner says which MC8 he has
  and gives one of his own bank backups.

### R7, as built (2026-11-14, SYNC:RIG-031, D-RIG-027)

Asked at the kickoff, the owner away from his gear for the day and reviewing by screenshots: **MIDI in both builds**
(the recommendation, over the desktop only). **His MC8 is the original model**, not the Pro the community has decoded,
so the bank export waits for one of his own bank backups; learning by drag and drop came first, as recommended.

- **One way in, in both builds: Web MIDI in the page** (`web/src/midi.js`), not iPlug2's MIDI input (`PLUG_DOES_MIDI_IN`
  stays 0). The desktop app grants its own page MIDI (`RigWebView.cpp`, `PermissionRequested`: MIDI only, Rig's page
  only; every other permission keeps WebView2's default). One code path for both builds, one hop from a footswitch to
  the engine (the page sends the parameter, as for a click), and no fight over the port: on Windows a USB MIDI port has
  one user at a time. **Found:** WebView2 raises a plain `requestMIDIAccess()` as `MIDI_SYSTEM_EXCLUSIVE_MESSAGES`, and
  Edge 157 checks every Web MIDI request against the SysEx permission (DevTools had to grant `midiSysex` too). Before the
  grant, the app's page waited forever on a prompt nobody could see.
- **The MIDI dock**, from the header's MIDI button (its lamp lit when a controller is connected, blinking as messages
  arrive): a MIDI switch (ports opened only while it is on, and let go when it is off, so the MC8's editor can have
  them), the place to drop a control, an "Or choose" list of every control (the keyboard's and a touch screen's way),
  the mappings, and a monitor of the last eight messages (the port, the message, what it did).
- **Map mode** while the dock is open: every control that can be mapped is outlined, the mapped ones tagged with their
  message. Dragging a control onto the dock, clicking it, or Enter on it starts learning it, and never uses it; the
  first message that fits maps it.
- **What maps:** knobs (the amp's six and Size, the calibration level, each pedal's Drive, Level and Tone, on the page
  and on the kits) from a CC, heel (CC 0) to toe (CC 127), over any part of the sweep (inverted when the toe is below
  the heel), drawn dotted outside the knob; switches (Gate, EQ, Cabinet IR, Squeal guard, Auto-off, Calibrate, each
  pedal's Tone switch and footswitch, Standby, Power) from a CC, a note or a Program Change, toggled or momentary; picks
  (favourites 1 to 0, next, previous, Last two, variants Q, W and E, each saved rig) from a Program Change or a press.
  One message drives one control and a control takes one message: learning again moves either.
- **Kept** in this browser (`crbn-rig/midi`), apart from rigs: the mappings are the player's controller, not a sound. A
  rig deleted takes its mapping with it.
- **At start**, MIDI comes back on if it was on: in the desktop app at once; in a browser only if the person allowed it
  before (`permissions.query` says granted), so the page never asks without a click; in Pavillion Hub's tool view never,
  and the dock says why (goati-sync `proposals/2026-11-14-hub-tool-view-web-midi.md`, for the Hub lane).

**Found and fixed while building:** a click within 400 ms of a mapping drag was swallowed wherever it landed (the riff's
button among them); only the drag's own click is now.

**The session's picks, for the owner's review** (each a line to change):
- A CC learned at a value under 64 starts as momentary: a controller that toggles its own switch sends 0 on every other
  press, and momentary follows it. Otherwise toggle.
- Standby momentary is Standby while held (a kill switch).
- Footswitches map to the board's places (pedal 1 to 4), not to the pedal: a pedal moved to another place answers to
  that place's footswitch.
- A message matches by its kind, channel and number, from any port.
- While the dock is open the page's controls are chosen, not used (the wheel still turns a knob).

**Tests:** `web/engine/test.mjs` 53/53 (the engine is unchanged). `web/check.mjs` 94/94 (9 new: Web MIDI answers in
Edge once allowed, the real X-TOUCH MINI on Box-C listed; map mode; a switch learned by a drag, toggling and never on
the press that taught it; momentary; an expression pedal heel to toe and over half a sweep, drawn on the knob; a note
stomping a pedal while the riff plays; Program Changes picking a variant and opening a rig, and the monitor; the dock
closed and MIDI off letting the port go; after a reload, the mappings back and MIDI on again). Edge refuses Web MIDI to
a frame whatever DevTools grants (with `allow="midi"` and from the frame's own script), so the real Web MIDI check asks
from the self-test's own page. `packaging/windows/check.mjs` 49/49 (4 new: the app gives its page Web MIDI without a prompt, naming the X-TOUCH MINI; an expression pedal learned by dragging Output onto the dock moves the native engine's sound, -10.08 dB from CC 16 to its heel against -10.1 expected; a footswitch learned from the list stomps the second pedal off and on in the native engine; at the second opening MIDI is on again through the app's own Web MIDI, its mappings back and Output's range drawn)..

**Not built:** the MC8 bank export (his original MC8's backup format is undocumented; his own backup is the test),
MIDI out (lights on the controller), 14-bit CCs, and a knob that waits for its pedal to pass its value before it moves
(pickup).

### R7, the review with his MC8 (2026-11-14/15, SYNC:RIG-032, D-RIG-028)

He plugged in his MC8 (the original model, firmware 3.13's editor) for a short while at the console; the session logged
what it sends with a winmm listener of its own (`dist/mc8/mc8-log.txt`, kept out of git), and a session beside it
took his All Banks backup through Claude in Chrome; this session took a Current Bank one the same way.

**What his MC8 sends:** each footswitch one CC on channel 3 (CC 1 to 8 on bank 1's page 1), value 127, on the press
only: nothing on release, and a hold sends the same. Bank up and down send nothing. His expression pedal sends CC 13
(bank 1) but **only 50 to 88 from full heel to full toe**: the MC8's own expression calibration has never been run, and
it is not in the backup. Bank 1 is "DSP Gojira 1" (CCs for Neural DSP's Gojira plug-in, Program Changes 5 to 8 on M to
P), bank 3 "DSP Petrucci", the rest empty.

**Built:**
- **A pedal's sweep** (his ask, D-RIG-028 (a)): under a knob's Heel and Toe, "Pedal sweep" says what the pedal sends
  (as it comes, 0 to 127, or measured). **Measure sweep** shows a 0 to 127 bar with what has been seen and where the
  pedal is; five sweeps heel to toe set it by themselves, a step inside each end so both are reached; **Set heel** and
  **Set toe** take where the pedal is now (both set, done); **Done**, **Cancel**, **Reset**. Kept by the CC
  (`crbn-rig/midi` `sweeps`), so a pedal measured once stays measured whatever it is mapped to. The count starts over
  when the sweep grows by more than a tenth: rocked half way five times, a plain count sets half a sweep (simulated on
  his log before building).
- **Devices, not ports** (D-RIG-028 (b)): Windows names the MC8's ports "Morningstar MC8", "MIDIIN2 (Morningstar MC8)"
  and so on; the dock shows one "Morningstar MC8", each device with a light that blinks as it sends, and the monitor
  names the device. Rig still listens on every port, so nobody picks one.
- **No controller found** says why: **found with his MC8**, while the MC8 Editor has it open in Chrome, Windows lets
  nothing else open *any* MIDI input (winmm `midiInOpen` error 7 on all five, the X-TOUCH MINI too) and a fresh Edge's
  Web MIDI lists no devices at all. Chrome's Web MIDI opens every input on the machine. The dock now says a controller's
  editor may be holding it, and to turn MIDI off and on once it is closed.
- **The MC8 bank** (`web/src/mc8.js`): the dock's **MC8 bank…** writes the mappings as the MC8 Editor's own Current
  Bank file. The format, from his two backups: `{ schemaVersion: 1, dumpType: 'singleBank', deviceModel: 4,
  downloadDate, hash, data: { bank }, description }`; `hash` is Java's String.hashCode of `JSON.stringify(data)`,
  reproduced on both files; a bank is 16 bank messages, 22 presets (A to P are the eight switches on two pages) and 4
  expression presets, each of 16 messages `{ d1, d2, d3, d4, m, c, t, a, tg, mi }` in that key order; on a switch t 1 is
  a Program Change and t 2 a CC, a 1 a press and a 2 a release; on an expression preset t 1 is a CC from d2 to d3. Only
  CCs and Program Changes are written (a note is left out and the dialog says so).

**The session's picks, for his review** (each a line to change):
- The bank's layout, as the MC8 sits on the floor: the pedals' footswitches on the bottom row A to D, variants Q, W, E
  on E, F, G and Standby on H above them, favourites 1 to 8 on page 2 (I to P); anything else where there is room.
- The MC8's screen names: PEDAL 1, VAR W, STANDBY, FAV 3, LAST 2, GATE, EQ, CAB IR, P1 TONE, a rig's name in capitals
  (eight characters, plain ASCII); the long name is Rig's own ("Pedal 1 footswitch: Example drive").
- A switch is written as his banks are: 127 on a press, toggle mode off on the MC8 (Rig keeps the state); a momentary
  switch sends 127 held and 0 let go.
- The bank it is for is chosen every time, never guessed (the file replaces that bank); the last one chosen is kept.
- Five sweeps to measure a pedal, and a step inside each end.

**Tests:** `web/check.mjs` 102/102 (8 new, his MC8's own traffic and files: its four ports one device; its footswitch
learned as Toggle and flipping on each press; its pedal measured from his log, 51 to 87, reaching Bass's ends; Reset,
Set heel and Set toe; the sweep back after a reload; his bank read and its check number reproduced; the dialog; the file
his format key for key; each switch's bytes). His Gojira bank is the fixture, `web/test/mc8-bank-gojira1.json`.
`packaging/windows/check.mjs` 50/50 (1 new: a pedal that sends only 50 to 88, its sweep set by Set heel and Set toe,
moves Output from its heel in the native engine, 4.21 dB at CC 52 as expected). Screenshots of the dock and the dialog
in Capsule, Daylight, Holo and Redline (`dist/probe/mc8-*.png`).

**Not tried yet, with him:** a Rig bank restored into his MC8 (into a bank he does not use, after a backup); Rig picking
the MC8 up once its editor lets it go (what turning MIDI off and on does there); presets sending several messages at once
(his banks have none yet); the feel of Program Changes between variants while playing.

### R8. TONE3000 in the library (U7)

As P3-UX's U7. **Ask first:** read TONE3000's API and its terms for API clients, and bring them to the owner with a
recommendation. Build only within those terms, crediting authors as the terms ask (D-CRBN-021 (e)).

- Sign in to TONE3000, browse and search inside Rig's library, favourite, and play, with captures cached locally
  without a person handling files.
- **Tests:** against TONE3000's sandbox or a recorded fixture, never hammering the live service from a test.
- **Found (2026-11-14, SYNC:RIG-030 addendum):** `docs/reviews/2026-11-14-tone3000-api-terms.md`. A public OAuth API
  (PKCE, a device flow), self-serve keys, no sandbox; a free tier for non-commercial products limited to its prompt
  flows (and perhaps its lists), the full API (search, favourites, downloads) under a commercial agreement and
  sign-off; TONE3000's branding, creator credit, no catalogue caching. The recommendation: their Select flow first;
  ask TONE3000 before the browser inside Rig's library.
- **The note to TONE3000 (2026-11-14, SYNC:RIG-031):** drafted for the owner to send, `docs/reviews/2026-11-14-tone3000-note-draft.md`. **Never ask him whether he sent it** (his word, 2026-11-14): he tells a session once it has gone, and R8 waits until then and for TONE3000's answer.

### R9. Release and store

- Run every check in both builds: `web/engine/test.mjs`, `web/check.mjs`, the desktop smoke, and the parity render.
- Make a signed desktop build in a SimplySign session, publish it to dev and confirm it.
- Run `publish.mjs --promote` for the web version, then check it live with `check.mjs --url`.
- **Store:** new screenshots of the new UI on the desktop and the web, new words where the features changed
  (`packaging/hub/words.json`), all uploaded under new names after the owner sees them. At least one screenshot shows
  Salvage in his setup (D-RIG-015). Keep R1c's order: CRBN first, Salvage cycling second, and the skins section
  (D-RIG-018 (e)).
- **Docs:** `docs/PLAN.md` (P3 done), `docs/P3-UX.md` (status), `packaging/hub/README.md`, a SYNC entry that names
  what is left (P4, production) for the owner.

## Rules every session keeps

- **Start** from crbn-launcher `CLAUDE.md`, goati-sync `SYNC.md` (Rig's last entry and its `NEXT KICKOFF`) and
  `docs/DECISIONS.md`. **End** with a `SYNC:RIG-NNN` entry whose `NEXT KICKOFF` names the next step here, and push
  every repo touched (D-CRBN-006).
- **Both builds from R2 on.** A feature is built once, in the engine and the page, and checked in both.
- **Tests:**
  - Engine changes keep `node web/engine/test.mjs` (wasm against MSVC, sample for sample) green.
  - Page changes keep `node web/check.mjs` green and add checks for what they add.
  - Headless screenshots in each look before anything ships.
- **Publishing:**
  - **Web:** this PC's Claude settings allow `node hosting/kit/publish.mjs` (the owner's word, 2026-11-11). Promote
    after a green check, then verify with `check.mjs --url` and record the rollback build.
  - **Desktop:** needs the owner's SimplySign session for signing. Batch it to the end of a session.
  - **Store pictures:** the owner sees them first. Upload changed ones under new names.
- **Decisions:** a choice that is the owner's goes to him in the picker, or in a lab where it is visual, and is
  recorded as the next `D-RIG-NNN`.
- **Upstream:** `iPlug2/`, `NeuralAmpModelerCore/`, `AudioDSPTools/` and `eigen/` are ours to fix, carefully: a fix is
  a reviewed commit named as such. Never re-vendor from upstream without the owner (CLAUDE.md).

## Open outside the sessions

- **The Hub lane:** the desktop Hub's tool view grants a web tool no microphone yet (D-RIG-003, goati-sync
  `proposals/2026-11-10-hub-tool-view-audio-input.md`), so Rig's web version in the desktop Hub cannot hear a guitar
  until that lands. R7 added the Web MIDI ask: goati-sync `proposals/2026-11-14-hub-tool-view-web-midi.md` (Chromium asks
  `midiSysex` even for plain MIDI).
- **The mark:** Audeze's US registration of CRBN for headphones (`docs/reviews/2026-11-10-mark-knockout-crbn-rig.md`)
  is with the owner's adviser, across the suite.
- **The Console lane:** Rig's web version is the first to write the `crbn-look` cookie (D-CRBN-024's web half).
  Livewire and Mixtape read it when they take D-CRBN-023.
