// CRBN Rig's hardware (crbn-launcher D-RIG-009..015, docs/BUILD_PLAN.md R1): the kits' knobs, switches, lights,
// faceplates and cabinets, drawn into the page's amp and cabinet. Ported from the Hardware Lab
// (docs/design/2026-11-11-hardware-lab/lab.html), which stays the reference for every kit, control and choice: its
// code is kept nearly verbatim below, each part marked with the lab lines it came from, and the page's side follows at
// the end. The energy kits draw Pavillion Hub's logo-window layers (pavillion_client
// hub/apps/web/src/shell/logo-window) behind a cut faceplate. Pedals (pedalHTML) wait for R6, the pedals in the chain.
// ---- kits (lab 984-1114)
// ---------------------------------------------------------------- the kits
// own: the kit's own colour (its metal, paint or energy) when the finish is "Kit's own"; lamp: its own light colour.
// Classic kits are after the gear named, never copies: no maker's name, logo, script or panel layout.
const KITS = [
  { id: 'brit', fam: 'classic', name: 'Brit Gold', after: 'Marshall’s plexi and JCM heads', own: '#c9a24e', lamp: '#e5312f',
    knob: 'cap', scale: '', pwr: 'rocker', tg: 'rocker', lampT: 'jewel', foot: '3pdt', led: 'led', logo: 'Rig',
    capture: 'Plexi crunch', pedal: 'Overdrive', pedal2: 'Boost',
    pitch: 'A brushed gold panel along the bottom, a black basketweave grille above it and a white script name: the British stack.',
    parts: [['Faceplate', 'Brushed gold with a black keyline; black condensed capitals.'], ['Knobs', 'Black knurled top hats with spun-metal caps and a white line.'], ['Switches', 'Black rockers for Power, Standby, Gate and EQ.'], ['Light', 'A big faceted jewel, red.'], ['Cabinet', 'Black levant tolex, white piping, a gold-flecked basketweave grille.'], ['Pedal', 'Black, its knobs on a strip of the gold panel; a chrome stomp switch.']],
    reach: 'The panel, the knob caps and the jewel.' },
  { id: 'black', fam: 'classic', name: 'Black Panel', after: 'Fender’s blackface amps of the mid-1960s', own: '#c9ced4', lamp: '#e3342f',
    knob: 'skirt', scale: 'mark', pwr: 'bat', tg: 'bat', lampT: 'jewel', foot: '3pdt', led: 'jewel-sm', logo: 'Rig',
    capture: 'Blackface clean', pedal: 'Boost', pedal2: 'Reverb',
    pitch: 'A black panel with white legends, numbered skirt knobs and a silver grille with a chrome script name: the American clean.',
    parts: [['Faceplate', 'Gloss black, a chrome strip along the top, white legends.'], ['Knobs', 'Black skirted knobs numbered 1 to 10, read at the mark above each.'], ['Switches', 'Chrome bat-handle toggles.'], ['Light', 'A red jewel.'], ['Cabinet', 'Black tolex and silver sparkle grille cloth.'], ['Pedal', 'Black and chrome to match, with a small jewel.']],
    reach: 'The strip along the top and the jewel.' },
  { id: 'tweed', fam: 'classic', name: 'Tweed', after: 'Fender’s tweed amps of the 1950s', own: '#be9851', lamp: '#f0a33a',
    knob: 'chicken', ck: '#5b3a20', ckLine: '#f1e6cf', scale: 'tweed12', pwr: 'bat', tg: 'bat', lampT: 'jewel', foot: '3pdt', led: 'jewel-sm', logo: 'Rig',
    capture: 'Tweed breakup', pedal: 'Fuzz', pedal2: 'Tremolo',
    pitch: 'Lacquered tweed, a chrome panel scaled 1 to 12, brown pointer knobs and an oxblood grille: the 1950s.',
    parts: [['Faceplate', 'Chrome with black legends; every knob is scaled 1 to 12.'], ['Knobs', 'Brown pointer knobs with a cream line.'], ['Switches', 'Chrome bat-handle toggles.'], ['Light', 'An amber jewel.'], ['Cabinet', 'Lacquered tweed with an oxblood grille.'], ['Pedal', 'Covered in the same tweed, with the chrome panel.']],
    reach: 'The jewel and the script name.' },
  { id: 'boost', fam: 'classic', name: 'Top Boost', after: 'Vox’s AC30', own: '#b8703f', lamp: '#e3342f',
    knob: 'chicken', ck: '#efe4cb', ckLine: '#2a1a0c', scale: 'ticks', pwr: 'bat black', tg: 'bat black', lampT: 'jewel', foot: '3pdt', led: 'jewel-sm', logo: 'Rig',
    capture: 'Chime and jangle', pedal: 'Treble boost', pedal2: 'Echo',
    pitch: 'A copper panel with cream chicken-head knobs over a diamond-pattern grille: the British chime.',
    parts: [['Faceplate', 'Brushed copper, black condensed legends, ticks round each knob.'], ['Knobs', 'Cream chicken heads with a dark line.'], ['Switches', 'Black-tipped toggles.'], ['Light', 'A red jewel.'], ['Cabinet', 'Black tolex, fawn piping, a diamond-pattern grille and a trapezoid badge.'], ['Pedal', 'Copper all over, like a treble booster.']],
    reach: 'The copper panel and the jewel.' },
  { id: 'plate', fam: 'classic', name: 'Diamond Plate', after: 'Mesa/Boogie’s Rectifier heads', own: '#c3c8ce', lamp: '#e3342f',
    knob: 'insert', scale: '', pwr: 'rocker', tg: 'bat mini', lampT: 'led', foot: '3pdt', led: 'led', logo: 'RIG',
    capture: 'Modern high gain', pedal: 'Noise gate', pedal2: 'Boost',
    pitch: 'Chrome diamond plate with the controls on a recessed black strip, under a black steel grille: the modern metal head.',
    parts: [['Faceplate', 'Chrome tread plate round a recessed black control strip; white legends.'], ['Knobs', 'Black knurled knobs with metal inserts.'], ['Switches', 'Black rockers for power, small chrome toggles for Gate and EQ.'], ['Light', 'A red LED in a chrome bezel.'], ['Cabinet', 'Black tolex and a perforated black steel grille, the name in chrome.'], ['Pedal', 'Diamond plate, its knobs on a black strip.']],
    reach: 'The knob inserts and the LED.' },
  { id: 'wood', fam: 'classic', name: 'Hardwood', after: 'Mesa/Boogie’s Mark combos and boutique hardwood cabinets', own: '#d6b46c', lamp: '#e3342f',
    knob: 'insert', scale: '', eq: 'faders', pwr: 'bat mini', tg: 'bat mini', lampT: 'jewel-sm', foot: '3pdt', led: 'led', logo: 'RIG',
    capture: 'Boutique lead', pedal: 'Compressor', pedal2: 'Chorus',
    pitch: 'A hardwood cabinet with a cane grille, a black panel, and the EQ on faders: the boutique combo.',
    parts: [['Faceplate', 'Black with cream legends; Bass, Middle and Treble are faders.'], ['Knobs', 'Small black knobs with metal inserts.'], ['Switches', 'Small chrome toggles.'], ['Light', 'A small red jewel.'], ['Cabinet', 'Oiled hardwood, a cane wicker grille and an oval brass badge.'], ['Pedal', 'A black panel between hardwood cheeks.']],
    reach: 'The fader caps, the knob inserts and the badge.' },
  { id: 'gain', fam: 'classic', name: 'High Gain', after: 'Peavey’s 5150 and the 1990s high-gain heads', own: '#d8262e', lamp: '#ff3b30',
    knob: 'knurl', scale: '', pwr: 'rocker', tg: 'push', lampT: 'led', foot: '3pdt', led: 'led', logo: 'RIG',
    capture: '90s metal rhythm', pedal: 'Tight drive', pedal2: 'Gate',
    pitch: 'Black anodised metal with a red stripe, knurled knobs and lit push buttons: the 1990s metal head.',
    parts: [['Faceplate', 'Black anodised, a red stripe along the top, silver condensed legends.'], ['Knobs', 'Black knurled knobs with a red line and a silver ring.'], ['Switches', 'Push buttons with a lamp above for Gate and EQ; black rockers for power.'], ['Light', 'A red LED.'], ['Cabinet', 'Black tolex, black cloth and a big italic name with a red shadow.'], ['Pedal', 'Black with the red stripe.']],
    reach: 'The stripe, the knob lines, the button lamps and the LED.' },
  { id: 'compact', fam: 'classic', name: 'Compact', after: 'Boss compact pedals', own: '#2f6fd1', lamp: '#ff3b2f',
    knob: 'compact', scale: '', pwr: 'pad', tg: 'pad', lampT: 'led', foot: 'pad', led: 'led', logo: 'RG-1 Combo',
    capture: 'Practice combo', pedal: 'Overdrive', pedal2: 'Chorus',
    pitch: 'Painted metal and a rubber pad you can stomp anywhere: the compact pedal, and an amp built in its language.',
    parts: [['Faceplate', 'Enamel paint in the finish, printed legends, a black name strip.'], ['Knobs', 'Small black knurled knobs with a silver ring and a white line.'], ['Switches', 'Ribbed rubber pads with a lamp above.'], ['Light', 'A red check LED.'], ['Cabinet', 'The same painted case round a square black mesh.'], ['Pedal', 'The rubber pad covers the lower half, with the name strip on it.']],
    reach: 'The paint. The legends turn white on a dark paint.' },
  { id: 'hammer', fam: 'classic', name: 'Salvage', after: 'your notes on Hammertone: real salvaged sheet metal from photographs, a different crop on every piece', own: '#2f7d8c', lamp: '#ff3b2f',
    knob: 'dome', scale: '', pwr: 'bat', tg: 'bat', lampT: 'jewel', foot: '3pdt', led: 'led', logo: 'CRBN RIG',
    capture: 'Garage fuzz', pedal: 'Scrap fuzz', pedal2: 'Boost',
    pitch: 'Real salvaged sheet metal, from photographs: coats of old paint worn through to bare steel, rust that blooms and runs, scratches and stains. Each amp and pedal takes its own crop of the sheet, turned and flipped, so no two pieces match.',
    parts: [['Faceplate', 'A photographed sheet of painted scrap metal, cropped fresh for each piece; words stamped into it, dark on light metal and bright bare steel on dark; two rivets.'], ['Knobs', 'Big black domes on chrome skirts.'], ['Switches', 'Worn bat-handle toggles: blackened, rusted and scratched.'], ['Light', 'A faceted jewel, red.'], ['Cabinet', 'A grille of the player’s choice (expanded metal, chicken wire, woven wire or perforated sheet) in the same scrap or old bare metal, set back behind the faceplate and bolted in at its corners, over a glow of their choice; the name stamped into a plate cut from another sheet and bolted on.'], ['Pedal', 'Its own crop of the same sheet, or another sheet when Mixed.']],
    reach: 'A finish tints the sheet. In the kit’s own colours the metal is as photographed.' },
  { id: 'rack', fam: 'classic', name: 'Rack', after: 'studio and rack gear: brushed aluminium, ears and handles, a VU meter', own: '#c6cbd0', lamp: '#ffb340',
    knob: 'alu', scale: 'ticks', pwr: 'bat mini', tg: 'lit', lampT: 'vu', foot: '3pdt', led: 'led', logo: 'CRBN Rig',
    capture: 'Studio direct', pedal: 'Controller', pedal2: 'Expression',
    pitch: 'A 2U rack unit in brushed aluminium, with handles, lit buttons and a VU meter that moves with your playing.',
    parts: [['Faceplate', 'Brushed aluminium, anodised in the finish, with ears, handles and vents.'], ['Knobs', 'Knurled aluminium with a dot.'], ['Switches', 'Square buttons lit from inside; a small toggle for power.'], ['Light', 'A backlit VU meter, beside the pilot.'], ['Cabinet', 'None: it is a rack unit. Its IR sits in a matching unit.'], ['Pedal', 'A brushed aluminium floor unit.']],
    reach: 'The anodising, silver by default.' },

  { id: 'crbn', fam: 'new', mine: true, name: 'CRBN', after: 'Your kit from the builder: the default', own: '#d92b52',
    fx: 'circuit', cut: 'honeycomb', mesh: 'perf', mat: 'carbon', knob: 'obsidian', pwr: 'glow', tg: 'glow', lampT: 'bead', foot: 'ring',
    capture: 'High-gain lead', pedal: 'Boost', pedal2: 'Drive',
    pitch: 'The kit you built: carbon fibre cut with a honeycomb, a perforated cage behind it, and current running in along hidden traces to a cherry core. Rig opens in it.',
    parts: [['Energy', 'Circuit, from the Hub: a pulse runs in for each pick and lights the honeycomb as it passes; a hard pick fires them all back out.'], ['Cutouts', 'Hex windows, large near the core and smaller away from it; a ring round each knob.'], ['Mesh', 'Perforated sheet.'], ['Faceplate', '2×2 twill carbon fibre under clear lacquer.'], ['Knobs', 'Obsidian: gloss black glass over a dark chrome skirt, with a lit slit inside the glass.'], ['Switches', 'Lit capsules.'], ['Light', 'A frosted lens in black anodising.'], ['Pedal', 'Carbon with a hex window.']],
    reach: 'The current, the slots of light and the lamps. Cherry is its own colour.' },
  { id: 'reactor', fam: 'new', name: 'Reactor', after: 'Energy: the Hub’s Reactor', own: '#d92b52',
    fx: 'reactor', cut: 'mark', mesh: 'hex', mat: 'gunmetal', knob: 'halo', pwr: 'guard', tg: 'glow', lampT: 'bead', foot: 'ring',
    capture: 'High-gain lead', pedal: 'Plasma drive', pedal2: 'Boost',
    pitch: 'The Hub’s plasma core, seen through Rig’s own mark cut out of a gunmetal plate: the stompbox’s eyes and footswitch glow with it.',
    parts: [['Energy', 'Reactor, the Hub’s plasma. It surges with your level, burns hotter as Input goes up, and flares on a hard pick.'], ['Cutouts', 'Rig’s mark (the hex, the eyes, the footswitch) with three slots streaming into it; a ring round each knob.'], ['Mesh', 'Fine hex wire.'], ['Faceplate', 'Brushed gunmetal.'], ['Knobs', 'Dark glass with a lit line.'], ['Switches', 'Power under a flip-up guard; Gate and EQ as lit capsules.'], ['Light', 'A glass bead lit from inside.'], ['Pedal', 'The mark again, small, over the same plasma.']],
    reach: 'The energy, the slots of light and the lamps. The mark’s body stays cherry.' },
  { id: 'pulse', fam: 'new', name: 'Pulse', after: 'Energy: the Hub’s Heartbeat', own: '#f29077',
    fx: 'pulse', cut: 'rings', mesh: 'perf', mat: 'satin', knob: 'halo', pwr: 'glow', tg: 'glow', lampT: 'ring', foot: 'ring',
    capture: 'Edge-of-breakup', pedal: 'Heartbeat', pedal2: 'Boost',
    pitch: 'Rings cut round a centre port, and a heartbeat behind them: every note you pick sends a shockwave out through the rings.',
    parts: [['Energy', 'Heartbeat, from the Hub. At rest, a slow double pulse; while you play, every pick is a beat.'], ['Cutouts', 'Rings of slots round a centre port, broken by bridges; a ring round each knob.'], ['Mesh', 'Perforated sheet.'], ['Faceplate', 'Satin black, bead-blasted.'], ['Knobs', 'Dark glass with a lit line.'], ['Switches', 'Lit capsules for everything.'], ['Light', 'A ring that lights.'], ['Pedal', 'A small ring port.']],
    reach: 'The energy, the slots of light and the lamps. Its own colour is Rig’s rose gold.' },
  { id: 'tesla', fam: 'new', name: 'Tesla', after: 'Energy: the Hub’s Storm', own: '#6aa8ff',
    fx: 'storm', cut: 'louvre', mesh: 'expanded', mat: 'graphite', knob: 'machined', pwr: 'guard', tg: 'tip', lampT: 'bead', foot: 'ring',
    capture: 'Fuzz lead', pedal: 'Arc fuzz', pedal2: 'Boost',
    pitch: 'Louvred vents round a spark gap: arcs of current crack across behind the slots, one for every pick.',
    parts: [['Energy', 'Storm, from the Hub: arcs from the core to the far ends of the slots. Each pick strikes; a chord strikes several.'], ['Cutouts', 'Louvre slots round a round spark port.'], ['Mesh', 'Expanded metal.'], ['Faceplate', 'Graphite with a fine knurl.'], ['Knobs', 'Machined dark titanium with a glowing slot.'], ['Switches', 'Power under a guard; toggles with lit tips.'], ['Light', 'A lit bead.'], ['Pedal', 'Louvres and a small spark port.']],
    reach: 'The arcs, the slots of light and the lamps.' },
  { id: 'warp', fam: 'new', name: 'Warp', after: 'Energy: the Hub’s Warp', own: '#9a7dff',
    fx: 'warp', cut: 'tunnel', mesh: 'none', mat: 'piano', knob: 'obsidian', pwr: 'glow', tg: 'glow', lampT: 'slit', foot: 'ring',
    capture: 'Ambient swell', pedal: 'Shimmer', pedal2: 'Delay',
    pitch: 'A stepped tunnel into piano black, with light streaking out of it towards you. The harder you play, the faster it goes.',
    parts: [['Energy', 'Warp, from the Hub: streaks out of the core. Their speed follows your level; a big chord surges.'], ['Cutouts', 'One window stepped three times into a tunnel, under smoked glass.'], ['Mesh', 'None.'], ['Faceplate', 'Piano black with a chrome edge.'], ['Knobs', 'Obsidian: gloss black glass over a dark chrome skirt, with a lit slit inside the glass.'], ['Switches', 'Lit capsules.'], ['Light', 'A slit of light.'], ['Pedal', 'A small tunnel.']],
    reach: 'The streaks, the slots of light and the lamps.' },
  { id: 'circuit', fam: 'new', name: 'Circuit', after: 'Energy: the Hub’s Circuit', own: '#3fd9e8',
    fx: 'circuit', cut: 'glass', mesh: 'none', mat: 'glass', knob: 'machined', pwr: 'glow', tg: 'glow', lampT: 'ring', foot: 'ring',
    capture: 'Clean DI', pedal: 'Bit drive', pedal2: 'Boost',
    pitch: 'Black glass with its circuit etched right through: current runs in along the traces to the core, and the core fires it all back out.',
    parts: [['Energy', 'Circuit, from the Hub: a pulse runs in along a trace for each pick; a hard pick fires them all back out.'], ['Cutouts', 'Hairline traces etched through the glass, a pad at each end and a window over the core.'], ['Mesh', 'None.'], ['Faceplate', 'Black glass.'], ['Knobs', 'Machined dark titanium with a glowing slot.'], ['Switches', 'Lit capsules.'], ['Light', 'A lit ring.'], ['Pedal', 'Traces into a small core.']],
    reach: 'The current, the slots of light and the lamps.' },
  { id: 'jet', fam: 'new', name: 'Jet', after: 'Energy: the Hub’s Turbine', own: '#ff9a3c',
    fx: 'turbine', cut: 'intake', mesh: 'weave', mat: 'titanium', knob: 'spinner', pwr: 'guard', tg: 'tip', lampT: 'ring', foot: 'ring',
    capture: 'Big rock rhythm', pedal: 'Afterburner', pedal2: 'Boost',
    pitch: 'A jet intake in heat-tinted titanium: the fan spins up as you play and glows from behind.',
    parts: [['Energy', 'Turbine, from the Hub: two backlit compressor stages turning against each other, the speed following your level.'], ['Cutouts', 'A round intake with stator spokes and a machined spinner cone, rivets round it.'], ['Mesh', 'Woven wire, like an intake screen.'], ['Faceplate', 'Titanium, brushed and heat-tinted.'], ['Knobs', 'Spinners: a machined cone over a ring of shaded fins, with a notch that marks the setting.'], ['Switches', 'Power under a guard; toggles with lit tips.'], ['Light', 'A lit ring.'], ['Pedal', 'A small intake.']],
    reach: 'The glow, the slots of light and the lamps.' },
  { id: 'carbon', fam: 'new', name: 'Carbon', after: 'Energy: the Hub’s Lattice', own: '#be9851',
    fx: 'lattice', cut: 'honeycomb', mesh: 'none', mat: 'carbon', knob: 'gem', pwr: 'glow', tg: 'glow', lampT: 'hex', foot: 'ring',
    capture: 'Studio crunch', pedal: 'Crystal', pedal2: 'Boost',
    pitch: 'Carbon fibre, as in CRBN, cut with a honeycomb of hex windows that grow towards a turning lattice: the suite’s hex, made of light.',
    parts: [['Energy', 'Lattice, from the Hub: a turning geodesic lattice with sparks running its struts, more of them while you play.'], ['Cutouts', 'Hex windows, large near the core and smaller away from it.'], ['Mesh', 'None.'], ['Faceplate', '2×2 twill carbon fibre under clear lacquer.'], ['Knobs', 'Faceted hex crystals.'], ['Switches', 'Lit capsules.'], ['Light', 'A hex lamp.'], ['Pedal', 'Carbon with a hex window.']],
    reach: 'The lattice, the crystals, the slots of light and the lamps. Its own colour is Rig’s tweed gold.' },
  { id: 'valve', fam: 'new', name: 'Valve', after: 'Energy: new, the amp’s own valves', own: '#ff9447', lamp: '#55f0a0',
    fx: 'valve', cut: 'window', mesh: 'perf', mat: 'crinkle', knob: 'insert', pwr: 'bat', tg: 'bat', lampT: 'eye', foot: '3pdt',
    capture: 'Class A chime', pedal: 'Valve drive', pedal2: 'Boost',
    pitch: 'A window onto the amp’s own valves behind a perforated cage: the heaters glow, the plates warm as you play, and a magic eye closes on every note.',
    parts: [['Energy', 'Valve, new here: three preamp valves and four power valves. They brighten with your level and flash blue on a hard pick.'], ['Cutouts', 'One wide window with a chrome trim.'], ['Mesh', 'A perforated valve cage.'], ['Faceplate', 'Black crinkle paint.'], ['Knobs', 'Black with metal inserts.'], ['Switches', 'Chrome bat-handle toggles.'], ['Light', 'A magic-eye tuning valve: its shadow closes as you play.'], ['Pedal', 'One valve in a small window.']],
    reach: 'The valves’ glow, the knob inserts and the magic eye.' },
  { id: 'ferro', fam: 'new', name: 'Ferro', after: 'Energy: new, ferrofluid', own: '#9fd8ff',
    fx: 'ferro', cut: 'porthole', mesh: 'none', mat: 'blackchrome', knob: 'obsidian', pwr: 'glow', tg: 'glow', lampT: 'slit', foot: 'ring',
    capture: 'Low-tuned riff', pedal: 'Magnet', pedal2: 'Boost',
    pitch: 'A porthole onto a pool of ferrofluid lit from behind: its spikes rise as you play and leap on every pick.',
    parts: [['Energy', 'Ferro, new here: black liquid in a magnetic field. The spikes follow your level and jump on a pick.'], ['Cutouts', 'A porthole with a chrome bezel, bolts and a glass glare.'], ['Mesh', 'None: glass.'], ['Faceplate', 'Black chrome.'], ['Knobs', 'Obsidian: gloss black glass over a dark chrome skirt, with a lit slit inside the glass.'], ['Switches', 'Lit capsules.'], ['Light', 'A slit of light.'], ['Pedal', 'A small porthole.']],
    reach: 'The backlight, the slots of light and the lamps.' }
]
// "CRBN Rig" on every head (D-RIG-009 (d)): CRBN in small capitals beside a script "Rig", or in capitals.
const CR = '<b class="cr">CRBN</b>Rig'
const LOGOS = { brit: CR, black: CR, tweed: CR, boost: 'CRBN RIG', plate: 'CRBN RIG', wood: 'CRBN RIG', gain: 'CRBN RIG', compact: 'CRBN RIG · RG-1', hammer: 'CRBN RIG', rack: 'CRBN Rig' }
for (const k of KITS) if (LOGOS[k.id]) k.logo = LOGOS[k.id]
const KIT = Object.fromEntries(KITS.map(k => [k.id, k]))
// ---- the builder (lab 1121-1131), for R1b
// ---------------------------------------------------------------- the builder's parts
const B_OPTS = {
  fx: ['Energy', [['reactor', 'Reactor (the Hub)'], ['pulse', 'Heartbeat (the Hub)'], ['storm', 'Storm (the Hub)'], ['warp', 'Warp (the Hub)'], ['circuit', 'Circuit (the Hub)'], ['turbine', 'Turbine (the Hub)'], ['lattice', 'Lattice (the Hub)'], ['valve', 'Valve (new)'], ['ferro', 'Ferro (new)']]],
  cut: ['Cutouts', [['mark', 'Rig’s mark'], ['rings', 'Rings'], ['louvre', 'Louvres'], ['tunnel', 'Tunnel'], ['glass', 'Etched traces'], ['intake', 'Intake'], ['honeycomb', 'Honeycomb'], ['window', 'Window'], ['porthole', 'Porthole']]],
  mesh: ['Mesh', [['hex', 'Hex wire'], ['perf', 'Perforated'], ['weave', 'Woven wire'], ['expanded', 'Expanded metal'], ['none', 'None (glass)']]],
  mat: ['Faceplate', [['gunmetal', 'Gunmetal'], ['satin', 'Satin black'], ['graphite', 'Graphite'], ['piano', 'Piano black'], ['glass', 'Black glass'], ['titanium', 'Titanium'], ['carbon', 'Carbon fibre'], ['crinkle', 'Crinkle black'], ['blackchrome', 'Black chrome']]],
  knob: ['Knobs', [['halo', 'Dark glass'], ['machined', 'Machined'], ['obsidian', 'Obsidian'], ['gem', 'Hex crystal'], ['spinner', 'Spinner']]],
  own: ['Colour (with Kit’s own)', [['#d92b52', 'Cherry'], ['#be9851', 'Tweed gold'], ['#f29077', 'Rose gold'], ['#6aa8ff', 'Electric blue'], ['#9a7dff', 'Violet'], ['#3fd9e8', 'Cyan'], ['#ff9a3c', 'Afterburner'], ['#9fd8ff', 'Ice']]]
}
const BUILDER = { id: 'builder', fam: 'new', name: 'Your kit', kitName: '', after: 'Built here', fx: 'reactor', cut: 'honeycomb', mesh: 'hex', mat: 'carbon', knob: 'halo', own: '#d92b52',
  pwr: 'glow', tg: 'glow', lampT: 'bead', foot: 'ring', capture: 'Your capture', pedal: 'Your pedal', pedal2: 'Boost', art: {} }
// ---- textures (lab 1161-1188)
// ---------------------------------------------------------------- textures (SVG, set as CSS variables on <html>)
const NS = 'xmlns="http://www.w3.org/2000/svg"'
const TEX = {
  grain: `<svg ${NS} width="140" height="140"><filter id="f"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .7 -.32"/></filter><rect width="100%" height="100%" filter="url(#f)" opacity=".28"/></svg>`,
  'grain-d': `<svg ${NS} width="140" height="140"><filter id="f"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="5" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .8 -.35"/></filter><rect width="100%" height="100%" filter="url(#f)" opacity=".3"/></svg>`,
  brushed: `<svg ${NS} width="600" height="160"><filter id="f"><feTurbulence type="fractalNoise" baseFrequency=".003 .6" numOctaves="2" seed="4" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.2 -.55"/></filter><rect width="100%" height="100%" filter="url(#f)" opacity=".24"/></svg>`,
  'brushed-d': `<svg ${NS} width="600" height="160"><filter id="f"><feTurbulence type="fractalNoise" baseFrequency=".004 .7" numOctaves="2" seed="9" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.2 -.55"/></filter><rect width="100%" height="100%" filter="url(#f)" opacity=".28"/></svg>`,
  basket: `<svg ${NS} width="12" height="12"><rect width="12" height="12" fill="#15120f"/><path d="M0 1.5H6M0 4.5H6M6 7.5H12M6 10.5H12M7.5 0V6M10.5 0V6M1.5 6V12M4.5 6V12" stroke="#312a23" stroke-width="2.3"/><path d="M0 .8H6M0 3.8H6M6 6.8H12M6 9.8H12M6.8 0V6M9.8 0V6M.8 6V12M3.8 6V12" stroke="#4d4236" stroke-width=".6"/><path d="M0 4.5H6M10.5 0V6M6 10.5H12M1.5 6V12" stroke="#8f7642" stroke-width=".55" opacity=".6"/></svg>`,
  silver: `<svg ${NS} width="6" height="6"><rect width="6" height="6" fill="#5f656c"/><path d="M0 1.5H6M0 4.5H6" stroke="#d6dade" stroke-width="1.3"/><path d="M1.5 0V6M4.5 0V6" stroke="#8e959c" stroke-width="1.1"/><path d="M1.5 1.5h.01M4.5 4.5h.01" stroke="#f4f6f8" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  sparkle: `<svg ${NS} width="140" height="140"><filter id="f"><feTurbulence type="fractalNoise" baseFrequency=".75" seed="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 8 -6.7"/></filter><rect width="100%" height="100%" filter="url(#f)"/></svg>`,
  tweed: `<svg ${NS} width="14" height="14"><rect width="14" height="14" fill="#d8bf8a"/><path d="M-3.5 3.5L3.5 -3.5M0 14L14 0M10.5 17.5L17.5 10.5" stroke="#8f6e3d" stroke-width="2.4"/><path d="M-3.5 10.5L10.5 -3.5M3.5 17.5L17.5 3.5" stroke="#b9995f" stroke-width="1.3"/></svg>`,
  oxblood: `<svg ${NS} width="6" height="10"><rect width="6" height="10" fill="#4a1714"/><path d="M0 2H6M0 5H6M0 8H6" stroke="#5f241e" stroke-width="1.4"/><path d="M0 9.5H6" stroke="#a07a3a" stroke-width=".7" opacity=".8"/></svg>`,
  diamond: `<svg ${NS} width="18" height="18"><rect width="18" height="18" fill="#2e2319"/><path d="M9 0L18 9L9 18L0 9Z" fill="#5a4630"/><path d="M9 2.4L15.6 9L9 15.6L2.4 9Z" fill="#3b2d20"/><path d="M9 0L18 9L9 18L0 9Z" fill="none" stroke="#a88b5f" stroke-width=".9"/></svg>`,
  perf: `<svg ${NS} width="8" height="8"><rect width="8" height="8" fill="#131315"/><circle cx="4" cy="4" r="2.5" fill="#000"/><path d="M1.8 5.1a2.5 2.5 0 0 0 4.4 0" stroke="rgba(255,255,255,.13)" stroke-width=".6" fill="none"/></svg>`,
  tread: `<svg ${NS} width="22" height="22"><g transform="rotate(45 5.5 5.5)"><ellipse cx="6.1" cy="6" rx="4.8" ry="1.5" fill="#4a5056"/><ellipse cx="5.5" cy="5.2" rx="4.8" ry="1.3" fill="#f6f8fa"/></g><g transform="rotate(-45 16.5 16.5)"><ellipse cx="16.5" cy="17.2" rx="4.8" ry="1.5" fill="#4a5056"/><ellipse cx="16.5" cy="16.4" rx="4.8" ry="1.3" fill="#eef1f3"/></g></svg>`,
  wood: `<svg ${NS} width="480" height="220"><rect width="100%" height="100%" fill="#7c4b27"/><filter id="f"><feTurbulence type="fractalNoise" baseFrequency=".004 .09" numOctaves="3" seed="11" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .09  0 0 0 0 .03  0 0 0 1.4 -.5"/></filter><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".006 .14" numOctaves="2" seed="5" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .95  0 0 0 0 .7  0 0 0 0 .42  0 0 0 1 -.55"/></filter><rect width="100%" height="100%" filter="url(#f)"/><rect width="100%" height="100%" filter="url(#g)" opacity=".55"/></svg>`,
  wicker: `<svg ${NS} width="14" height="14"><rect width="14" height="14" fill="#1b120a"/><path d="M0 7H14M7 0V14" stroke="#caa66c" stroke-width="2.6"/><path d="M0 0L14 14M14 0L0 14" stroke="#ad8650" stroke-width="1.8"/><path d="M0 6.2H14M6.2 0V14" stroke="#e7cc98" stroke-width=".5" opacity=".7"/></svg>`,
  cloth: `<svg ${NS} width="3" height="3"><rect width="3" height="3" fill="#141416"/><path d="M0 .75H3M0 2.25H3" stroke="#212124" stroke-width=".9"/><path d="M.75 0V3M2.25 0V3" stroke="#0a0a0b" stroke-width=".7"/></svg>`,
  square: `<svg ${NS} width="6" height="6"><rect width="6" height="6" fill="#0b0b0c"/><rect x="1.2" y="1.2" width="3.6" height="3.6" fill="#000"/><path d="M0 .6H6M.6 0V6" stroke="rgba(255,255,255,.12)" stroke-width=".6"/></svg>`,
  hammer: `<svg ${NS} width="200" height="200"><filter id="f" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="7" stitchTiles="stitch" result="t"/><feDiffuseLighting in="t" surfaceScale="3.2" lighting-color="#fff"><feDistantLight azimuth="225" elevation="40"/></feDiffuseLighting></filter><rect width="100%" height="100%" filter="url(#f)"/></svg>`,
  crinkle: `<svg ${NS} width="140" height="140"><filter id="f" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".22" numOctaves="2" seed="3" stitchTiles="stitch" result="t"/><feDiffuseLighting in="t" surfaceScale="2.2" lighting-color="#fff"><feDistantLight azimuth="225" elevation="48"/></feDiffuseLighting></filter><rect width="100%" height="100%" filter="url(#f)"/></svg>`,
  carbon: (() => {
    let cells = ''
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) cells += `<rect x="${c * 3}" y="${r * 3}" width="3" height="3" fill="url(#${((c - r) & 3) < 2 ? 'h' : 'v'})"/>`
    return `<svg ${NS} width="12" height="12"><defs><linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e2e33"/><stop offset=".5" stop-color="#111114"/><stop offset="1" stop-color="#242428"/></linearGradient><linearGradient id="v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1b1b1f"/><stop offset=".5" stop-color="#09090b"/><stop offset="1" stop-color="#19191c"/></linearGradient></defs>${cells}</svg>`
  })()
}
for (const [k, s] of Object.entries(TEX)) document.documentElement.style.setProperty('--tx-' + k, `url("data:image/svg+xml,${encodeURIComponent(s)}")`)
// ---- drawing (lab 1193-1582)
const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]
const TAU = Math.PI * 2
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x
const ang = v => -135 + 270 * v
const f1 = n => Math.round(n * 10) / 10
const kitOf = hw => hw.dataset.kit === 'builder' ? BUILDER : KIT[hw.dataset.kit]
const SIZES = { '': 40, tw: 36, md: 32, sm: 26 }
const AMP_KNOBS = [['Input', .5], ['Gate', .3], ['Bass', .55], ['Middle', .62], ['Treble', .6], ['Output', .5]]
const PED_KNOBS = [['Level', .6], ['Drive', .55], ['Tone', .5]]
// Pedals show only their end numbers: 0 where all the way down is a real setting, 1 elsewhere (D-RIG-010).
const PED_MIN = { Level: 0, Drive: 1, Tone: 1 }, PED_SCALE = { tweed12: 'ends' }

// ---------------------------------------------------------------- knobs
const CK = 'M-6,-45 C-2,-47.5 2,-47.5 6,-45 L22.2,-17 A28,28 0 1,1 -22.2,-17 Z'
const GEM = (() => {
  const P = (r, k) => { const a = (-90 + 60 * k) * Math.PI / 180; return `${f1(r * Math.cos(a))},${f1(r * Math.sin(a))}` }
  let s = ''
  for (let k = 0; k < 6; k++) s += `<path class="f${k}" d="M${P(46, k)} L${P(46, k + 1)} L${P(23, k + 1)} L${P(23, k)} Z"/>`
  return s + `<path class="tb" d="M${[0, 1, 2, 3, 4, 5].map(k => P(23, k)).join(' L')} Z"/><circle class="pt" cx="0" cy="-35" r="3.4"/>`
})()
const OB_TICKS = (() => { let d = ''; for (let i = 0; i < 72; i++) { const a = i * 5 * Math.PI / 180, s = Math.sin(a), c = -Math.cos(a); d += `M${f1(s * 44.5)},${f1(c * 44.5)}L${f1(s * 48.6)},${f1(c * 48.6)}` } return d })()
const OB_BASE = `<circle r="49" fill="url(#ob-skirt)"/><path d="${OB_TICKS}" stroke="rgba(0,0,0,.55)" stroke-width="1.3"/><circle r="49" fill="none" stroke="rgba(0,0,0,.8)" stroke-width="1"/><circle r="42.2" fill="#000"/><circle r="40.5" fill="url(#ob-dome)"/><circle r="33" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="1"/>`
const OB_GLASS = '<path d="M-26,-27 C-14,-38.5 14,-38.5 26,-27 C20,-22.5 11,-25 0,-25 C-11,-25 -20,-22.5 -26,-27 Z" fill="url(#ob-soft)"/><ellipse cx="-19" cy="-12" rx="4.6" ry="1.9" transform="rotate(-50 -19 -12)" fill="rgba(255,255,255,.32)"/><path d="M-30,20 A37,37 0 0,0 30,20" fill="none" stroke="url(#ob-floor)" stroke-width="3.5" stroke-linecap="round"/><circle r="40" fill="none" stroke="url(#ob-fres)" stroke-width="1.5"/>'
const SPIN_FINS = (() => {
  let s = '<circle r="48.5" fill="#15161a"/>'
  for (let k = 0; k < 20; k++) s += `<path transform="rotate(${k * 18})" d="M2,-25 C6,-33 9,-40 8,-46.5 L1.5,-46.5 C2,-40 -1,-33 -3.5,-25 Z" fill="url(#sp-blade)"/>`
  return s + '<circle r="47.5" fill="none" stroke="#3a3d44" stroke-width="2.2"/><circle r="47.5" fill="none" stroke="rgba(255,255,255,.14)" stroke-width=".6"/><path d="M-2.4,-49 L2.4,-49 L1.4,-37.5 L-1.4,-37.5 Z" style="fill:color-mix(in oklab, var(--fin) 70%, white)"/>'
})()
const SPIN_CONE = '<circle r="25" fill="#0b0c0e"/><circle r="23.5" fill="url(#spin-g2)"/>' + [6, 10, 14, 18, 22].map((r, i) => `<circle r="${r}" fill="none" stroke="${i % 2 ? 'rgba(0,0,0,.2)' : 'rgba(255,255,255,.1)'}" stroke-width=".8"/>`).join('') + '<path d="M0,-5 L4.3,-2.5 L4.3,2.5 L0,5 L-4.3,2.5 L-4.3,-2.5 Z" fill="url(#bolt-g)" stroke="rgba(0,0,0,.5)" stroke-width=".6"/><ellipse cx="-8" cy="-11" rx="7" ry="2.6" transform="rotate(-36 -8 -11)" fill="rgba(255,255,255,.5)"/>'
const FS_NUT = (() => {
  const P = (r, k) => { const a = 60 * k * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a)] }
  const hex = r => 'M' + [0, 1, 2, 3, 4, 5].map(k => P(r, k).map(f1).join(',')).join('L') + 'Z'
  let s = ''
  for (let k = 0; k < 6; k++) {
    const na = (60 * k + 30) * Math.PI / 180, b = Math.cos(na) * -.45 + Math.sin(na) * -.89, v = Math.round(136 + 104 * b)
    const q = [P(47, k), P(47, k + 1), P(40, k + 1), P(40, k)]
    s += `<path d="M${q.map(p => p.map(f1).join(',')).join('L')}Z" fill="rgb(${v - 5},${v},${v + 6})"/>`
  }
  s += `<path d="${hex(47)}" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="1"/><path d="${hex(40)}" fill="url(#fs-nut)"/><path d="${hex(40)}" fill="none" stroke="rgba(255,255,255,.4)" stroke-width=".7"/>`
  s += '<circle r="35.5" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".9"/><circle r="34.4" fill="none" stroke="rgba(0,0,0,.3)" stroke-width=".9"/><circle r="31.6" fill="#16181c"/>'
  for (let r = 31, i = 0; r > 26.6; r -= 1.1, i++) s += `<circle r="${f1(r)}" fill="none" stroke="${i % 2 ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.17)'}" stroke-width=".6"/>`
  return `<svg viewBox="-50 -50 100 100">${s}<circle r="26.4" fill="#08090b"/></svg>`
})()
// The bat-handle toggle, drawn (D-RIG-014): a washer, a faceted nut on a threaded bushing, and a turned handle with
// a bulb tip. 'w' is Salvage's worn one: blackened, rusted and scratched.
const SB = (() => {
  const P = (r, k) => { const a = 60 * k * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a)] }
  const hex = r => 'M' + [0, 1, 2, 3, 4, 5].map(k => P(r, k).map(f1).join(',')).join('L') + 'Z'
  const base = worn => {
    let s = `<circle cy="1.2" r="11" fill="rgba(0,0,0,.45)" filter="url(#fs-blur)"/><circle r="10.6" fill="url(#${worn ? 'sbw-w' : 'sbw-c'})" stroke="rgba(0,0,0,.6)" stroke-width=".5"/><circle r="9.3" fill="none" stroke="rgba(255,255,255,${worn ? .12 : .3})" stroke-width=".4"/>`
    for (let k = 0; k < 6; k++) {
      const na = (60 * k + 30) * Math.PI / 180, b = Math.cos(na) * -.45 + Math.sin(na) * -.89, v = Math.round(worn ? 86 + 50 * b : 136 + 104 * b)
      const q = [P(8.4, k), P(8.4, k + 1), P(6.9, k + 1), P(6.9, k)]
      s += `<path d="M${q.map(p => p.map(f1).join(',')).join('L')}Z" fill="rgb(${worn ? (v + 8) + ',' + v + ',' + (v - 7) : (v - 5) + ',' + v + ',' + (v + 6)})"/>`
    }
    s += `<path d="${hex(8.4)}" fill="none" stroke="rgba(0,0,0,.55)" stroke-width=".4"/><path d="${hex(6.9)}" fill="url(#${worn ? 'sbn-w' : 'fs-nut'})"/><circle r="4.8" fill="${worn ? '#1b1612' : '#15171a'}"/>`
    for (let r = 4.5, i = 0; r > 2.9; r -= .5, i++) s += `<circle r="${f1(r)}" fill="none" stroke="${i % 2 ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,' + (worn ? .1 : .2) + ')'}" stroke-width=".25"/>`
    if (worn) s += '<circle cx="-6.5" cy="5.5" r="3.2" fill="url(#sb-rust)"/><circle cx="7" cy="-3" r="2.4" fill="url(#sb-rust)"/><circle cx="2" cy="8.4" r="2.6" fill="url(#sb-rust)"/><circle cx="-3.5" cy="-7.6" r="1.8" fill="url(#sb-rust)"/><path d="M-9,-2 L-5.5,-4.2 M5.2,6.4 L8.4,4.2" stroke="rgba(255,236,214,.18)" stroke-width=".3"/>'
    return `<svg viewBox="-12 -12 24 24">${s}<circle r="2.5" fill="#040404"/></svg>`
  }
  const handle = v => {
    let s = `<path d="M3.6,0 L6.4,0 L7.2,12.2 C8.9,13.4 9.2,18.7 5,19.6 C.8,18.7 1.1,13.4 2.8,12.2 Z" fill="url(#sbh-${v})"/><ellipse cx="5" cy="16.3" rx="3.3" ry="2.7" fill="url(#sb-cap)" opacity="${v === 'w' ? .25 : .5}"/><path d="M4.1,1 L4.3,11.8" stroke="rgba(255,255,255,${v === 'c' ? .55 : .2})" stroke-width=".5" stroke-linecap="round"/>`
    if (v === 'w') s += '<rect x="2.8" y="0" width="4.4" height="2.2" fill="rgba(70,32,10,.55)"/><path d="M3.8,4 L4.6,8.5 M6,9.5 L5.5,13.8 M3,15 L4.5,17.8" stroke="rgba(255,236,214,.22)" stroke-width=".3"/>'
    return `<svg viewBox="0 0 10 20" preserveAspectRatio="none">${s}</svg>`
  }
  return { base: { c: base(false), w: base(true) }, handle: { c: handle('c'), k: handle('k'), w: handle('w') } }
})()
const FS_CAP = (() => {
  let s = '<circle cy="2.6" r="26.4" fill="rgba(0,0,0,.6)" filter="url(#fs-blur)"/><circle r="25" fill="url(#fs-wall)"/>'
  const dd = ['', '']
  for (let i = 0; i < 90; i++) { const a = i * 4 * Math.PI / 180, x = Math.sin(a), y = -Math.cos(a); dd[i % 2] += `M${f1(x * 22.3)},${f1(y * 22.3)}L${f1(x * 24.8)},${f1(y * 24.8)}` }
  s += `<path d="${dd[0]}" stroke="rgba(0,0,0,.34)" stroke-width=".9"/><path d="${dd[1]}" stroke="rgba(255,255,255,.3)" stroke-width=".6"/>`
  s += '<circle r="25" fill="none" stroke="rgba(0,0,0,.5)" stroke-width=".8"/><circle r="21.8" fill="url(#fs-top)"/>'
  for (let r = 2, i = 0; r < 21.5; r += 1.25, i++) s += `<circle r="${f1(r)}" fill="none" stroke="${i % 2 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.14)'}" stroke-width=".55"/>`
  const wedge = (c, w, fill) => { const p = a => `${f1(21.6 * Math.cos(a * Math.PI / 180))},${f1(21.6 * Math.sin(a * Math.PI / 180))}`; return `<path d="M0,0L${p(c - w)}A21.6,21.6 0 0,1 ${p(c + w)}Z" fill="${fill}"/>` }
  s += wedge(-125, 13, 'rgba(255,255,255,.26)') + wedge(55, 13, 'rgba(255,255,255,.18)') + wedge(-35, 11, 'rgba(0,0,0,.12)') + wedge(145, 11, 'rgba(0,0,0,.15)')
  s += '<path d="M-15,-13.5 C-8,-19.5 8,-19.5 15,-13.5 C10,-11 5,-12 0,-12 C-5,-12 -10,-11 -15,-13.5 Z" fill="url(#ob-soft)" opacity=".85"/>'
  s += '<path d="M-14,13 A19.5,19.5 0 0,0 14,13" fill="none" stroke="url(#ob-floor)" stroke-width="2.2" stroke-linecap="round"/><circle r="21.8" fill="none" stroke="url(#ob-fres)" stroke-width="1"/><ellipse cx="-8.5" cy="-9.5" rx="3.4" ry="1.4" transform="rotate(-40 -8.5 -9.5)" fill="rgba(255,255,255,.75)"/>'
  return `<svg viewBox="-50 -50 100 100">${s}</svg>`
})()
const LP_IN = '<i class="lp-bz"></i><i class="lp-ln"></i><i class="lp-hc"></i><i class="lp-sp"></i><i class="lp-bl"></i>'
function knobInner (t, kit) {
  switch (t) {
    case 'cap': return '<i class="sh"></i><i class="body r"></i><i class="top"></i><i class="cap"></i><i class="ln r"></i>'
    case 'skirt': { let n = ''; for (let i = 1; i <= 10; i++) n += `<b style="--t:${135 - 30 * (i - 1)}deg">${i}</b>`; return `<i class="sh"></i><i class="skirt r">${n}</i><i class="top"></i><i class="gl"></i><i class="ln r"></i>` }
    case 'chicken': return `<i class="sh"></i><i class="r"><svg viewBox="-50 -50 100 100"><circle r="33" fill="rgba(0,0,0,.4)"/><path d="${CK}" style="fill:${kit.ck}"/><path d="${CK}" fill="url(#ck-shade)"/><path d="M0,-41 L0,-15" style="stroke:${kit.ckLine}" stroke-width="3.6" stroke-linecap="round"/></svg></i><i class="gl"></i>`
    case 'insert': return '<i class="sh"></i><i class="body r"></i><i class="top"></i><i class="ins"></i><i class="ln r"></i>'
    case 'dome': return '<i class="sh"></i><i class="base"></i><i class="dome"></i><i class="ln r"></i><i class="gl"></i>'
    case 'halo': return '<i class="sh"></i><i class="body"></i><i class="kf"></i><i class="ln r"></i>'
    case 'obsidian': return `<i class="sh"></i><i><svg viewBox="-50 -50 100 100">${OB_BASE}</svg></i><i class="ln r"></i><i><svg viewBox="-50 -50 100 100">${OB_GLASS}</svg></i>`
    case 'gem': return `<i class="sh"></i><i class="r"><svg viewBox="-50 -50 100 100">${GEM}</svg></i>`
    case 'spinner': return `<i class="sh"></i><i class="r sp-f"><svg viewBox="-50 -50 100 100">${SPIN_FINS}</svg></i><i><svg viewBox="-50 -50 100 100">${SPIN_CONE}</svg></i>`
    default: return '<i class="sh"></i><i class="body r"></i><i class="top"></i><i class="ln r"></i>' // knurl, compact, alu, machined
  }
}
function scaleSVG (kind, s, min = 0) {
  if (!kind) return ''
  const R = s / 2 + 3.5, h = s / 2 + 6, vb = `${-h} ${-h} ${2 * h} ${2 * h}`
  if (kind === 'mark') return `<svg class="sc" viewBox="${vb}" aria-hidden="true"><path d="M-2.6,${f1(-R - 2.5)} L2.6,${f1(-R - 2.5)} L0,${f1(-R + 1.5)} Z" fill="currentColor"/></svg>`
  if (kind === 'ends') {
    const r = R + 4.6, pt = v => { const q = ang(v) * Math.PI / 180; return [Math.sin(q), -Math.cos(q)] }
    let d = '', tx = ''
    for (const [v, t] of [[0, min], [1, 10]]) { const [x, y] = pt(v); d += `M${f1(x * (R - 1.5))},${f1(y * (R - 1.5))}L${f1(x * (R + 1.5))},${f1(y * (R + 1.5))}`; tx += `<text x="${f1(x * r)}" y="${f1(y * r + 2.3)}" text-anchor="middle" font-size="6.4" font-weight="700" fill="currentColor" font-family="Barlow Semi Condensed, sans-serif">${t}</text>` }
    return `<svg class="sc" viewBox="${vb}" aria-hidden="true"><path d="${d}" stroke="currentColor" stroke-width="1.2"/>${tx}</svg>`
  }
  const n = kind === 'tweed12' ? 12 : 11
  let p = ''
  for (let i = 0; i < n; i++) {
    const a = (ang(i / (n - 1))) * Math.PI / 180, sx = Math.sin(a), cy = -Math.cos(a)
    if (kind === 'tweed12') p += `<text x="${f1(sx * (R + 2.5))}" y="${f1(cy * (R + 2.5) + 2)}" text-anchor="middle" font-size="5.6" font-weight="700" fill="currentColor" font-family="Barlow Semi Condensed, sans-serif">${i + 1}</text>`
    else p += `<path d="M${f1(sx * R)},${f1(cy * R)} L${f1(sx * (R + 3.5))},${f1(cy * (R + 3.5))}" stroke="currentColor" stroke-width="${i % 5 === 0 ? 1.4 : .9}"/>`
  }
  return `<svg class="sc" viewBox="${vb}" aria-hidden="true">${p}</svg>`
}
function arcPath (s) {
  const R = s / 2 + 5, p = a => { const r = a * Math.PI / 180; return `${f1(R * Math.sin(r))},${f1(-R * Math.cos(r))}` }
  return `M${p(-135)} A${f1(R)},${f1(R)} 0 1,1 ${p(135)}`
}
function arcSVG (s, v) {
  const h = s / 2 + 6, d = arcPath(s)
  return `<svg class="arc" viewBox="${-h} ${-h} ${2 * h} ${2 * h}" aria-hidden="true"><path class="trk" d="${d}"/><path class="val" d="${d}" pathLength="100" stroke-dasharray="${f1(v * 100)} 200"/></svg>`
}
function knobCell (kit, label, v, size, opt = {}) {
  const s = SIZES[size], isNew = kit.fam === 'new', sc = opt.scale ?? kit.scale, min = opt.min ?? 0, art = kit.art && kit.art.knob
  const inner = art ? `<i class="sh"></i><i class="r art" style="background-image:url('${art}')"></i>` : knobInner(kit.knob, kit)
  return `<div class="cc${sc === 'tweed12' ? ' num' : ''}"><span class="lb">${label}</span><div class="kw ${size}">${isNew ? arcSVG(s, v) : scaleSVG(sc, s, min)}<div class="kn kn-${kit.knob}" role="slider" tabindex="0" aria-label="${label}" aria-valuemin="${min}" aria-valuemax="10" aria-valuenow="${(min + v * (10 - min)).toFixed(1)}" data-v="${v}" data-min="${min}" data-label="${label}" style="--a:${ang(v)}deg">${inner}<i class="env"></i><i class="rim"></i></div></div></div>`
}
function faderCell (label, v) {
  return `<div class="cc"><span class="lb">${label}</span><div class="fd" role="slider" tabindex="0" aria-label="${label}" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${(v * 10).toFixed(1)}" data-v="${v}" data-label="${label}" style="--v:${v}"><i class="tk"></i><i class="cap"></i></div></div>`
}

// ---------------------------------------------------------------- switches and lights
const STATE_WORD = { power: ['Off', 'On'], standby: ['Standby', 'Play'], gate: ['Off', 'On'], eq: ['Off', 'On'], ir: ['Off', 'On'] }
function swHTML (type, role, label, on, kit) {
  const art = kit && kit.art && kit.art.sw
  if (art) return `<div class="cc"><span class="lb">${label}</span><button class="sw sw-art" type="button" data-role="${role}" aria-pressed="${on}" aria-label="${label}"><i style="background-image:url('${art}')"></i></button><span class="st">${STATE_WORD[role][on ? 1 : 0]}</span></div>`
  let [t, ...mods] = type.split(' ')
  if (t === 'tip') { t = 'bat'; mods.push('tip') }
  let inner = { rocker: '<i class="a"></i><i class="b"></i>', bat: '<i class="nut"></i><i class="bat"></i>', push: '<i class="led"></i>', lit: '<i class="cap"></i>', pad: '<i class="led"></i>', guard: '<i class="base"></i><i class="tgl"></i><i class="lid"></i>', glow: '<i class="bar"></i>' }[t] || ''
  if (t === 'bat') { const v = kit && kit.id === 'hammer' ? 'w' : mods.includes('black') || mods.includes('tip') ? 'k' : 'c'; inner = `<i class="nut">${SB.base[v === 'w' ? 'w' : 'c']}</i><i class="bat">${SB.handle[v]}</i>` }
  const w = STATE_WORD[role]
  return `<div class="cc"><span class="lb">${label}</span><button class="sw sw-${t} ${mods.join(' ')}" type="button" data-role="${role}" aria-pressed="${on}" aria-label="${label}">${inner}</button><span class="st">${w[on ? 1 : 0]}</span></div>`
}
const VU = (() => {
  const cx = 37, cy = 52, R = 36, pt = (a, r) => `${f1(cx + r * Math.sin(a * Math.PI / 180))},${f1(cy - r * Math.cos(a * Math.PI / 180))}`
  let ticks = ''
  for (let i = 0; i <= 10; i++) { const a = -48 + 9.6 * i; ticks += `<path class="${i >= 8 ? 'scr' : 'sc'}" d="M${pt(a, R)} L${pt(a, R - (i % 5 === 0 ? 6 : 4))}"/>` }
  return `<svg viewBox="0 0 74 44" aria-hidden="true"><rect class="vf" width="74" height="44"/><path class="sc" d="M${pt(-48, R)} A${R},${R} 0 0,1 ${pt(28.8, R)}"/><path class="scr" d="M${pt(28.8, R)} A${R},${R} 0 0,1 ${pt(48, R)}"/>${ticks}<text x="37" y="36" text-anchor="middle">VU</text><line class="nd" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - R - 2}" transform="rotate(-46 ${cx} ${cy})"/></svg>`
})()
const LAMP = { jewel: 'lp-jewel', 'jewel-sm': 'lp-jewel sm', led: 'lp-led', eye: 'lp-eye', ring: 'lp-ring', bead: 'lp-bead', slit: 'lp-slit', hex: 'lp-hex' }
function lampHTML (kit) {
  if (kit.lampT === 'vu') return `<div class="cc"><span class="lb">Level</span><span class="lp lp-vu">${VU}</span><span class="st"></span></div><div class="cc"><span class="lb">Pilot</span><span class="lp lp-led" aria-hidden="true">${LP_IN}</span><span class="st" data-pilot>On</span></div>`
  return `<div class="cc"><span class="lb">Pilot</span><span class="lp ${LAMP[kit.lampT]}" aria-hidden="true">${kit.lampT === 'eye' ? '' : LP_IN}</span><span class="st" data-pilot>On</span></div>`
}

// ---------------------------------------------------------------- an amp, a pedal, a cabinet
function layersHTML (kit) {
  return `<canvas class="en" aria-hidden="true"></canvas><svg class="mesh" aria-hidden="true">${kit.mesh !== 'none' ? `<rect width="100%" height="100%" fill="url(#mesh-${kit.mesh})"/>` : ''}</svg><div class="plw"><div class="pl mat-${kit.mat}"></div></div><svg class="dec" aria-hidden="true"></svg>`
}
// a switch's drawn height, for where its state word sits (D-RIG-011)
function swH (type) { const [t, ...m] = type.split(' '); if (t === 'bat' || t === 'tip') return m.includes('mini') ? 32 : 40; return { rocker: 30, push: 30, lit: 22, pad: 32, guard: 40, glow: 19 }[t] || 40 }
function ampHTML (kit) {
  const isNew = kit.fam === 'new'
  let knobs = ''
  for (const [lb, v] of AMP_KNOBS) {
    if (kit.eq === 'faders' && (lb === 'Bass' || lb === 'Middle' || lb === 'Treble')) { if (lb === 'Bass') knobs += `<div class="eq">${faderCell('Bass', .55)}${faderCell('Middle', .62)}${faderCell('Treble', .6)}</div>`; continue }
    knobs += knobCell(kit, lb, v, kit.scale === 'tweed12' ? 'tw' : '')
  }
  const sb = kit.pwr === 'guard' ? kit.tg : kit.pwr
  const tgs = swHTML(kit.tg, 'gate', 'Gate', true, kit) + swHTML(kit.tg, 'eq', 'EQ', true, kit)
  const pwr = lampHTML(kit) + swHTML(kit.pwr, 'power', 'Power', true, kit) + swHTML(sb, 'standby', 'Standby', true, kit)
  const gz = kit.id === 'rack'
    ? `<div class="logo-box"><span class="logo">${kit.logo}</span><span class="sub">RG-2 · ${kit.capture}</span></div><span class="vents" aria-hidden="true"></span>`
    : kit.id === 'hammer' ? salvGZ(kit)
    : `<div class="logo-box"><span class="logo">${isNew ? 'CRBN RIG' : kit.logo}</span><span class="sub">${kit.capture}</span></div>`
  return `<div class="hw amp ${isNew ? 'new' : 'classic'} k-${kit.id} on" data-kit="${kit.id}" data-kind="amp" data-standby="false" style="--ch:${kit.art && kit.art.sw ? 40 : Math.max(swH(kit.tg), swH(kit.pwr), swH(sb))}px"><div class="cabinet"><div class="face">${isNew ? layersHTML(kit) : ''}${kit.id === 'rack' ? '<i class="ear l"><i class="hd-sh"></i><i class="hd-ft t"></i><i class="hd-ft b"></i><i class="hd-bar"></i></i><i class="ear r"><i class="hd-sh"></i><i class="hd-ft t"></i><i class="hd-ft b"></i><i class="hd-bar"></i></i>' : ''}<div class="ui"><div class="knobs">${knobs}</div><div class="tgs">${tgs}</div><div class="pwr">${pwr}</div></div><div class="gz">${gz}</div></div></div></div>`
}
function pedalHTML (kit, name) {
  const isNew = kit.fam === 'new', size = kit.id === 'hammer' || kit.id === 'tweed' ? 'md' : 'sm'
  const knobs = PED_KNOBS.map(([lb, v]) => knobCell(kit, lb, v, size, PED_SCALE[kit.scale] ? { scale: PED_SCALE[kit.scale], min: PED_MIN[lb] } : {})).join('')
  const led = `<span class="lp ${kit.led === 'jewel-sm' ? 'lp-jewel sm' : isNew ? 'lp-ring' : 'lp-led'}" aria-hidden="true">${LP_IN}</span>`
  const aria = `aria-pressed="true" aria-label="${name}: engaged"`
  if (kit.foot === 'pad') return `<div class="hw pedal classic k-${kit.id} on" data-kit="${kit.id}" data-kind="pedal"><div class="pface"><div class="pled">${led}<span class="lb">Check</span></div><div class="pknobs">${knobs}</div><button class="fs fs-pad" type="button" data-role="foot" ${aria}><span class="strip">${name}<small>RG-1</small></span></button></div></div>`
  const foot = kit.foot === 'ring' ? `<button class="fs fs-ring" type="button" data-role="foot" ${aria}></button>` : `<button class="fs fs-3pdt" type="button" data-role="foot" ${aria}><i class="nut">${FS_NUT}</i><i class="cap">${FS_CAP}</i></button>`
  return `<div class="hw pedal ${isNew ? 'new' : 'classic'} k-${kit.id} on" data-kit="${kit.id}" data-kind="pedal"><div class="pface">${isNew ? layersHTML(kit) : ''}<div class="pled">${led}</div><div class="pplate"><div class="pknobs">${knobs}</div></div><div class="pname">${name}</div>${isNew ? '<div class="gz"></div>' : ''}${foot}</div></div>`
}
function cabHTML (kit) {
  const isNew = kit.fam === 'new'
  const inner = isNew ? '' : kit.id === 'rack' ? '<span class="vents" aria-hidden="true"></span>' : kit.id === 'hammer' ? '<i class="spk"></i><i class="spk"></i><canvas class="salv-mesh" aria-hidden="true"></canvas>' + SALV_BOLTS : '<i class="spk"></i><i class="spk"></i>'
  return `<div class="hw cab ${isNew ? 'new' : 'classic'} k-${kit.id} on" data-kit="${kit.id}" data-kind="cab"><div class="cabinet"><div class="face">${isNew ? layersHTML(kit) : ''}<div class="gz">${inner}</div><div class="cplate"><span class="lb">Cabinet IR</span><b>2×12 open back</b><small>Dynamic mic, on axis</small>${swHTML(kit.tg, 'ir', 'IR', true, kit)}</div></div></div></div>`
}
function meterHTML (label, id) {
  let leds = ''
  for (let i = 0; i < 14; i++) leds += `<i class="${i < 9 ? 'g' : i < 12 ? 'y' : 'r'}"></i>`
  return `<div class="meter" id="${id}" aria-label="${label} level"><span class="clip">CLIP</span><div class="ladder">${leds}</div><span class="m-l">${label}</span></div>`
}

// ---------------------------------------------------------------- the cutouts (paths in the face's pixels)
const C = (x, y, r) => `M${f1(x - r)} ${f1(y)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0Z`
const RR = (x, y, w, h, r) => { r = Math.max(0, Math.min(r, w / 2, h / 2)); return `M${f1(x + r)} ${f1(y)}H${f1(x + w - r)}A${f1(r)} ${f1(r)} 0 0 1 ${f1(x + w)} ${f1(y + r)}V${f1(y + h - r)}A${f1(r)} ${f1(r)} 0 0 1 ${f1(x + w - r)} ${f1(y + h)}H${f1(x + r)}A${f1(r)} ${f1(r)} 0 0 1 ${f1(x)} ${f1(y + h - r)}V${f1(y + r)}A${f1(r)} ${f1(r)} 0 0 1 ${f1(x + r)} ${f1(y)}Z` }
const POLY = pts => 'M' + pts.map(p => `${f1(p[0])} ${f1(p[1])}`).join('L') + 'Z'
const HEXP = (x, y, r) => POLY([0, 1, 2, 3, 4, 5].map(k => { const a = (-90 + 60 * k) * Math.PI / 180; return [x + r * Math.cos(a), y + r * Math.sin(a)] }))
const annSector = (cx, cy, ra, rb, a0, a1) => { const p = (r, a) => `${f1(cx + r * Math.cos(a))} ${f1(cy + r * Math.sin(a))}`; const lg = a1 - a0 > Math.PI ? 1 : 0; return `M${p(ra, a0)}A${f1(ra)} ${f1(ra)} 0 ${lg} 1 ${p(ra, a1)}L${p(rb, a1)}A${f1(rb)} ${f1(rb)} 0 ${lg} 0 ${p(rb, a0)}Z` }
function mulberry (seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }

// Circuit's traces: from the zone's top and bottom edges, down to a lane, along it, and into the core. A trace farther
// from the core takes a lane nearer the middle, so no two cross.
function genTraces (R, P, kind) {
  const rnd = mulberry(kind === 'amp' ? 2257 : 991), lane = kind === 'amp' ? 5 : 4, out = []
  const fit = Math.max(1, Math.floor((R.h / 2 - 5) / lane))
  for (const side of [-1, 1]) {
    for (const dir of [1, -1]) {
      const a = dir > 0 ? R.x + 4 : P.x + P.r + 12, b = dir > 0 ? P.x - P.r - 12 : R.x + R.w - 4
      const span = b - a
      if (span < 10) continue
      const n = Math.min(fit, Math.max(1, Math.floor(span / (kind === 'amp' ? 15 : 11))))
      const xs = []
      for (let i = 0; i < n; i++) xs.push(a + span * (i + .5 + (rnd() - .5) * .5) / n)
      if (dir < 0) xs.reverse() // far first
      xs.forEach((x, i) => {
        const dy = 3 + i * lane, ly = P.y + side * dy, edge = side < 0 ? R.y - 2 : R.y + R.h + 2
        const x2 = P.x - dir * (P.r + 6 + dy * .5)
        const th = Math.atan2(ly - P.y, x2 - P.x), ex = P.x + Math.cos(th) * (P.r + 1), ey = P.y + Math.sin(th) * (P.r + 1)
        const pts = [[x, edge], [x, ly], [x2, ly], [ex, ey]]
        const seg = []; let len = 0
        for (let k = 1; k < pts.length; k++) { const d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); seg.push(d); len += d }
        out.push({ pts, seg, len, flash: 0 })
      })
    }
  }
  return out
}
function genTubes (R, kind) {
  if (kind !== 'amp') { const h = R.h * .9, w = Math.min(R.w * .4, h * .42); return [{ x: R.x + R.w / 2 - w / 2, y: R.y + R.h - h, w, h }] }
  const ph = R.h * .9, sh = ph * .64
  let pw = Math.min(ph * .4, 30), sw = pw * .64, gp = pw * .5, gs = sw * .65, mid = 22
  const k = Math.min(1, (R.w - 16) / (3 * sw + 2 * gs + mid + 4 * pw + 3 * gp))
  pw *= k; sw *= k; gp *= k; gs *= k; mid *= k
  const total = 3 * sw + 2 * gs + mid + 4 * pw + 3 * gp, base = R.y + R.h * .96, tubes = []
  let x = R.x + (R.w - total) / 2
  for (let i = 0; i < 3; i++) { tubes.push({ x, y: base - sh, w: sw, h: sh }); x += sw + (i < 2 ? gs : mid) }
  for (let i = 0; i < 4; i++) { tubes.push({ x, y: base - ph, w: pw, h: ph }); x += pw + gp }
  return tubes
}
const CUTS = {
  mark (R, kind) {
    const rh = Math.min(R.h * .5, kind === 'amp' ? R.w * .3 : R.w * .5), s = rh / 48.5
    const cx = kind === 'amp' ? R.x + R.w - rh * .9 - 2 : R.x + R.w / 2, cy = R.y + R.h / 2
    let d = HEXP(cx, cy, 48.5 * s) + HEXP(cx, cy, 43.5 * s)
    const eyes = C(cx - 8.5 * s, cy - 15.5 * s, 6.2 * s) + C(cx + 8.5 * s, cy - 15.5 * s, 6.2 * s) + C(cx, cy - 2.5 * s, 2.4 * s)
    d += eyes + C(cx, cy + 14 * s, 9.7 * s) + C(cx, cy + 14 * s, 7.1 * s) + C(cx, cy + 14 * s, 4.4 * s)
    const body = RR(cx - 19 * s, cy - 29 * s, 38 * s, 58 * s, 6 * s)
    const decor = `<path fill-rule="evenodd" d="${body}${eyes}${C(cx, cy + 14 * s, 9.7 * s)}" style="fill:rgba(217,43,82,.3)"/><path d="${body}" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="1"/>`
    if (kind === 'amp') {
      const x1 = cx - 43.5 * s * .87 - 12, x0 = R.x
      if (x1 - x0 > 40) for (const [dy, f] of [[-13, .55], [0, 1], [13, .78]]) { const len = (x1 - x0) * f; d += RR(x1 - len, cy + dy - 3, len, 6, 3) }
    }
    return { d, decor, port: { x: cx, y: cy, r: rh * 1.25 } }
  },
  rings (R, kind) {
    const r0 = Math.min(R.h, R.w) * (kind === 'amp' ? .17 : .2)
    const cx = kind === 'amp' ? Math.min(R.x + R.w * .7, R.x + R.w - R.h * .5) : R.x + R.w / 2, cy = R.y + R.h / 2
    let d = C(cx, cy, r0)
    const inR = (x, y) => x >= R.x - .5 && x <= R.x + R.w + .5 && y >= R.y - .5 && y <= R.y + R.h + .5
    const maxR = Math.max(Math.hypot(cx - R.x, R.h / 2), Math.hypot(R.x + R.w - cx, R.h / 2))
    const sw = kind === 'amp' ? 5 : 3.5, gap = kind === 'amp' ? 6 : 4.5
    for (let ra = r0 + gap, k = 0; ra + sw < maxR; ra += sw + gap, k++) {
      const rb = ra + sw, nseg = Math.max(6, Math.round(TAU * ra / 34)), step = TAU / nseg, off = (k % 2) * step / 2
      for (let i = 0; i < nseg; i++) {
        const a0 = i * step + off + 2.2 / ra, a1 = (i + 1) * step + off - 2.2 / ra, am = (a0 + a1) / 2
        if ([a0, am, a1].every(a => inR(cx + rb * Math.cos(a), cy + rb * Math.sin(a)) && inR(cx + ra * Math.cos(a), cy + ra * Math.sin(a)))) d += annSector(cx, cy, ra, rb, a0, a1)
      }
    }
    return { d, port: { x: cx, y: cy, r: r0 * 1.6 } }
  },
  louvre (R, kind) {
    const pr = kind === 'amp' ? R.h * .36 : Math.min(R.w, R.h) * .3
    const cx = kind === 'amp' ? R.x + R.w - pr - 10 : R.x + R.w / 2, cy = R.y + R.h / 2
    let d = C(cx, cy, pr)
    const sh = kind === 'amp' ? 6 : 4, gap = kind === 'amp' ? 6 : 5, n = Math.floor((R.h + gap) / (sh + gap)), y0 = cy - (n * (sh + gap) - gap) / 2, clear = pr + 7
    for (let i = 0; i < n; i++) {
      const y = y0 + i * (sh + gap), dy = Math.abs(y + sh / 2 - cy)
      const segs = dy < clear ? (() => { const hw = Math.sqrt(clear * clear - dy * dy); return [[R.x, cx - hw], [cx + hw, R.x + R.w]] })() : [[R.x, R.x + R.w]]
      for (const [a, b] of segs) if (b - a > 10) d += RR(a, y, b - a, sh, sh / 2)
    }
    return { d, port: { x: cx, y: cy, r: pr }, decor: `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(pr + 2.5)}" fill="none" stroke="url(#chr-v)" stroke-width="2.5" opacity=".75"/>` }
  },
  tunnel (R, kind) {
    const r = kind === 'amp' ? 12 : 8, d = RR(R.x, R.y, R.w, R.h, r)
    const steps = kind === 'amp' ? [8, 16, 24] : [5, 10, 15], fills = ['rgba(28,29,35,.66)', 'rgba(18,19,24,.52)', 'rgba(12,12,16,.4)']
    let decor = '', prev = [R.x, R.y, R.w, R.h, r]
    steps.forEach((ins, i) => {
      const nx = R.x + ins, ny = R.y + ins * .7, nw = R.w - 2 * ins, nh = R.h - 1.4 * ins, nr = Math.max(3, r - ins * .3)
      decor += `<path fill-rule="evenodd" d="${RR(...prev)}${RR(nx, ny, nw, nh, nr)}" fill="${fills[i]}"/><path d="${RR(nx, ny, nw, nh, nr)}" fill="none" stroke="url(#chr-v)" stroke-width="1" opacity="${(.55 - i * .14).toFixed(2)}"/>`
      prev = [nx, ny, nw, nh, nr]
    })
    decor += `<path d="${d}" fill="none" stroke="url(#chr-v)" stroke-width="2" opacity=".9"/>`
    const [ix, iy, iw, ih] = prev
    return { d, decor, port: { x: ix + iw / 2, y: iy + ih / 2, r: Math.min(iw, ih) / 2 } }
  },
  glass (R, kind) {
    const pr = kind === 'amp' ? R.h * .3 : Math.min(R.w, R.h) * .26
    const cx = kind === 'amp' ? R.x + R.w - R.h * .55 : R.x + R.w / 2, cy = R.y + R.h / 2, port = { x: cx, y: cy, r: pr }
    const traces = genTraces(R, port, kind)
    let d = C(cx, cy, pr * .7)
    let decor = `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(pr)}" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="1.2"/>`
    for (const t of traces) { const e = t.pts[3]; d += C(e[0], e[1], kind === 'amp' ? 2 : 1.5); decor += `<circle cx="${f1(t.pts[1][0])}" cy="${f1(t.pts[1][1])}" r="1.6" fill="rgba(255,255,255,.12)"/>` }
    const slits = traces.map(t => 'M' + t.pts.map(p => `${f1(p[0])} ${f1(p[1])}`).join('L')).join('')
    return { d, slits, slitW: kind === 'amp' ? 1.8 : 1.4, decor, port, traces }
  },
  intake (R, kind) {
    const r = kind === 'amp' ? R.h * .48 : Math.min(R.w, R.h) * .44
    const cx = kind === 'amp' ? R.x + R.w - r - 10 : R.x + R.w / 2, cy = R.y + R.h / 2
    const rh = r * .26, N = 7, w = kind === 'amp' ? 2.2 : 1.6, rs = rh + .6, re = Math.sqrt((r - .7) ** 2 - w * w)
    let d = C(cx, cy, r) + C(cx, cy, rh)
    for (let k = 0; k < N; k++) {
      const a = k / N * TAU - Math.PI / 2, ux = Math.cos(a), uy = Math.sin(a), nx = -uy * w, ny = ux * w
      d += POLY([[cx + ux * rs + nx, cy + uy * rs + ny], [cx + ux * re + nx, cy + uy * re + ny], [cx + ux * re - nx, cy + uy * re - ny], [cx + ux * rs - nx, cy + uy * rs - ny]])
    }
    const sc = rh / 24
    let decor = `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r + 2)}" fill="none" stroke="url(#chr-v)" stroke-width="${kind === 'amp' ? 4 : 3}"/><g transform="translate(${f1(cx)} ${f1(cy)}) scale(${(rh / 23.5).toFixed(3)})">${SPIN_CONE}</g>`
    if (kind === 'amp') {
      for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, bx = cx + Math.cos(a) * (r + 8.5), by = cy + Math.sin(a) * (r + 8.5); if (by > R.y - 6 && by < R.y + R.h + 6) decor += `<circle cx="${f1(bx)}" cy="${f1(by)}" r="1.7" fill="url(#bolt-g)"/>` }
      const x1 = cx - r - 16
      if (x1 - R.x > 40) for (const [dy, f] of [[-8, .7], [8, 1]]) { const len = (x1 - R.x) * f; d += RR(x1 - len, cy + dy - 3, len, 6, 3) }
    }
    return { d, decor, port: { x: cx, y: cy, r } }
  },
  honeycomb (R, kind) {
    const cr = kind === 'amp' ? 11 : 8, dx = Math.sqrt(3) * cr, dy = 1.5 * cr
    const P = kind === 'amp' ? { x: Math.min(R.x + R.w * .72, R.x + R.w - R.h * .5), y: R.y + R.h / 2 } : { x: R.x + R.w / 2, y: R.y + R.h / 2 }
    let d = ''
    for (let j = 0, y = R.y + cr; y + cr <= R.y + R.h + .5; j++, y += dy) {
      for (let x = R.x + dx / 2 + (j % 2 ? dx / 2 : 0); x + dx / 2 <= R.x + R.w + .5; x += dx) {
        const sc = Math.max(.3, Math.min(1, 1.12 - Math.hypot(x - P.x, y - P.y) / (kind === 'amp' ? R.w * .62 : R.w * .9)))
        d += HEXP(x, y, (cr - 1.8) * sc)
      }
    }
    return { d, port: { x: P.x, y: P.y, r: R.h * .5 } }
  },
  window (R, kind) {
    const d = RR(R.x, R.y, R.w, R.h, kind === 'amp' ? 10 : 7)
    return { d, decor: `<path d="${d}" fill="none" stroke="url(#chr-v)" stroke-width="${kind === 'amp' ? 3 : 2}"/>`, port: { x: R.x + R.w / 2, y: R.y + R.h / 2, r: R.h / 2 }, tubes: genTubes(R, kind) }
  },
  porthole (R, kind) {
    const r = kind === 'amp' ? R.h * .44 : Math.min(R.w, R.h) * .4
    const cx = kind === 'amp' ? R.x + R.w - r - 14 : R.x + R.w / 2, cy = R.y + R.h / 2
    let d = C(cx, cy, r)
    const p = (rr, a) => `${f1(cx + rr * Math.cos(a))} ${f1(cy + rr * Math.sin(a))}`
    let decor = `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r + 4)}" fill="none" stroke="url(#chr-d)" stroke-width="${kind === 'amp' ? 8 : 5}"/><circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r + .5)}" fill="none" stroke="rgba(0,0,0,.7)" stroke-width="1.2"/>`
    const nb = kind === 'amp' ? 8 : 6
    for (let k = 0; k < nb; k++) { const a = k / nb * TAU + TAU / 16; decor += `<circle cx="${f1(cx + (r + 4) * Math.cos(a))}" cy="${f1(cy + (r + 4) * Math.sin(a))}" r="${kind === 'amp' ? 2.2 : 1.5}" fill="url(#bolt-g)"/>` }
    decor += `<path d="M${p(r - 5, 3.5)} A${f1(r - 5)} ${f1(r - 5)} 0 0 1 ${p(r - 5, 4.6)}" fill="none" stroke="rgba(255,255,255,.24)" stroke-width="3" stroke-linecap="round"/>`
    if (kind === 'amp') { const x1 = cx - r - 22; if (x1 - R.x > 40) d += RR(R.x, cy - 3, x1 - R.x, 6, 3) }
    return { d, decor, port: { x: cx, y: cy, r } }
  }
}

// ---------------------------------------------------------------- laying out a new kit's face: the mask, the bevels, the energy's geometry
const bevel = d => `<path d="${d}" fill="none" stroke="rgba(0,0,0,.8)" stroke-width="1.6" transform="translate(0,-.7)"/><path d="${d}" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="1" transform="translate(0,.9)"/>`
function layoutHW (hw) {
  const face = hw.__face, kit = kitOf(hw), kind = hw.dataset.kind
  if (!face || !kit) return
  const W = face.clientWidth, H = face.clientHeight
  if (W < 20 || H < 20) return
  const fr = face.getBoundingClientRect(), sx = fr.width / W || 1
  const rel = el => { const r = el.getBoundingClientRect(); return { x: (r.left - fr.left) / sx, y: (r.top - fr.top) / sx, w: r.width / sx, h: r.height / sx } }
  let R = rel($('.gz', face))
  if (kind === 'amp') { const lb = $('.logo-box', face); if (lb) { const L = rel(lb); const x0 = L.x + L.w + 18; R = { x: x0, y: R.y, w: R.x + R.w - x0, h: R.h } } }
  const pad = kind === 'amp' ? 8 : kind === 'cab' ? 10 : 4
  R = { x: R.x + pad, y: R.y + pad, w: Math.max(24, R.w - 2 * pad), h: Math.max(24, R.h - 2 * pad) }
  const geo = CUTS[kit.cut](R, kind)
  if (kit.fx === 'circuit' && !geo.traces) geo.traces = genTraces(R, geo.port, kind)
  if (kit.fx === 'valve' && !geo.tubes) geo.tubes = genTubes(R, kind)
  let rings = ''
  for (const kn of $$('.kn', face)) { if (kn.closest('.cplate')) continue; const k = rel(kn), cx = k.x + k.w / 2, cy = k.y + k.h / 2, r = k.w / 2; rings += C(cx, cy, r + 7) + C(cx, cy, r + 3) }
  const holes = geo.d + rings
  const mask = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><mask id="m"><rect width="${W}" height="${H}" fill="#fff"/><path d="${holes}" fill="#000" fill-rule="evenodd"/>${geo.slits ? `<path d="${geo.slits}" fill="none" stroke="#000" stroke-width="${geo.slitW}" stroke-linecap="round" stroke-linejoin="round"/>` : ''}</mask><rect width="${W}" height="${H}" fill="#fff" mask="url(#m)"/></svg>`
  const pl = $('.pl', face), u = `url("data:image/svg+xml,${encodeURIComponent(mask)}")`
  pl.style.webkitMaskImage = u; pl.style.maskImage = u
  const dec = $('.dec', face)
  dec.setAttribute('viewBox', `0 0 ${W} ${H}`)
  dec.innerHTML = bevel(holes) + (geo.slits ? `<path d="${geo.slits}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1" transform="translate(0,1.1)"/>` : '') + (kit.mesh === 'none' ? `<path d="${geo.d}" fill="url(#glass-g)" fill-rule="evenodd"/>` : '') + (geo.decor || '')
  const s = hw.__surf
  const P = geo.port, ext = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.hypot(x - P.x, y - P.y))) / P.r
  s.geo = { W, H, P, R, traces: geo.traces, tubes: geo.tubes, ext }
  sizeSurface(s)
}

// ---- colour (lab 1620-1621)
const hex2rgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec((h || '').trim()); if (!m) return { r: 217, g: 43, b: 82 }; const n = parseInt(m[1], 16); return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 } }
const lum = h => { const c = hex2rgb(h), f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4) }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b) }
// ---- Salvage (lab 1634-1894)
// ---------------------------------------------------------------- Salvage: a sheet of painted scrap steel, made new for each piece (D-RIG-009 (a))
const SALV = new ResizeObserver(es => { for (const e of es) scheduleSalvage(e.target) })
function scheduleSalvage (el) { clearTimeout(el.__st); el.__st = setTimeout(() => paintSalvage(el), 90) }
const SALV_SEL = '.k-hammer .cabinet, .k-hammer .pface, .k-hammer .salv-plate, .k-hammer .salv-mesh'
// Salvage's grille: a warm glow, expanded metal from the scrap, and the name on a plate riveted over it (D-RIG-011)
function salvGZ (kit) {
  const stamp = [...'SALVAGE'].map((c, i) => `<b style="--r:${[-2, 1.5, -1, 2, -1.5, 1, -2][i]}deg;--y:${[1, -.5, 0, 1, -1, .5, -.5][i]}px">${c}</b>`).join('')
  return `<i class="salv-glow" data-glow="${SALV_GLOW}" aria-hidden="true"></i><canvas class="salv-mesh" aria-hidden="true"></canvas>${SALV_BOLTS}<div class="logo-box"><span class="salv-plate"><span class="logo">CRBN RIG</span><span class="salv-name"><span class="vh">Salvage</span><span aria-hidden="true" style="display:contents">${stamp}</span></span><i class="rv"></i><i class="rv"></i><i class="rv"></i><i class="rv"></i></span><span class="sub">${kit.capture}</span></div>`
}
// A sheet's crop, as on the faceplates: its own scale, offset, quarter turn and flips.
function sheetCrop (g, w, h, img, R) {
  const iw = img.naturalWidth, ih = img.naturalHeight, quarter = R() < .35, cw = quarter ? ih : iw, ch = quarter ? iw : ih
  const sc = Math.max(w / cw, h / ch) * (1.05 + R() * .85), ox = (w - cw * sc) * R(), oy = (h - ch * sc) * R()
  const fx = R() < .5 ? -1 : 1, fy = R() < .5 ? -1 : 1, turn = (quarter ? Math.PI / 2 : 0) + (R() < .5 ? Math.PI : 0)
  g.save(); g.translate(ox + cw * sc / 2, oy + ch * sc / 2); g.rotate(turn); g.scale(fx * sc, fy * sc); g.drawImage(img, -iw / 2, -ih / 2); g.restore()
}
// Expanded metal, drawn straight into its canvas: the strands carry the scrap's paint and rust, cast a shadow on the
// glow behind, and catch its light on their lower edges. A torn spot or two.
const SALV_BOLTS = [1, 2, 3, 4].map(n => '<i class="salv-bolt b' + n + '" aria-hidden="true"></i>').join('')
const MESH_TYPES = [['expanded', 'Expanded metal'], ['chicken', 'Chicken wire'], ['woven', 'Woven wire'], ['perf', 'Perforated sheet']]
const MESH_METALS = [['scrap', 'The same scrap'], ['steel', 'Old steel'], ['galv', 'Galvanised'], ['rust', 'Rusted iron'], ['copper', 'Aged copper']]
const GLOWS = [['embers', 'Embers'], ['valves', 'Valves'], ['furnace', 'Furnace'], ['neon', 'Neon'], ['none', 'None']]
let SALV_MESH = 'perf', SALV_METAL = 'copper', SALV_GLOW = 'valves', SALV_WORDS = 'tags'
// players' word styles (D-RIG-015): polished metal is gone; On tags is the default
const WORD_STYLES = [['tags', 'On tags'], ['stamped', 'Stamped'], ['paint', 'Paint-filled'], ['raised', 'Raised']]
document.documentElement.dataset.salvWords = SALV_WORDS
const GLOW_EDGE = { embers: 'rgba(255,130,50,.26)', valves: 'rgba(255,150,60,.24)', furnace: 'rgba(255,170,80,.32)', neon: 'rgba(120,190,255,.28)', none: '' }
// Each grille: a mask of its metal, and its shading (light above, shadow below, the glow on its lower edges).
const jit = (x, y) => { const s = Math.sin(Math.round(x * 10) * 1.29898 + Math.round(y * 10) * 7.8233) * 43758.5453; return s - Math.floor(s) - .5 }
const MESH_GEO = {
  expanded (w, h, R) {
    const DW = 26, DH = 13, ox = R() * DW, oy = R() * DH
    const p = (c, dx = 0, dy = 0) => { c.beginPath(); for (let j = -2; j * DH / 2 < h + DH; j++) for (let i = -2; i * DW < w + DW; i++) { const cx = i * DW + (j & 1 ? DW / 2 : 0) + ox + dx, cy = j * DH / 2 + oy + dy; c.moveTo(cx - DW / 2, cy); c.lineTo(cx, cy - DH / 2); c.lineTo(cx + DW / 2, cy); c.lineTo(cx, cy + DH / 2); c.closePath() } }
    return {
      mask: m => { m.lineJoin = 'round'; m.lineWidth = 3.6; m.strokeStyle = '#000'; p(m); m.stroke() },
      shade: (s, edge) => { s.lineWidth = 1; s.strokeStyle = 'rgba(255,255,255,.3)'; p(s, 0, -1.1); s.stroke(); s.lineWidth = 1.3; s.strokeStyle = 'rgba(0,0,0,.55)'; p(s, 0, 1.3); s.stroke(); if (edge) { s.lineWidth = 1.2; s.strokeStyle = edge; p(s, 0, 1.7); s.stroke() } }
    }
  },
  chicken (w, h, R) {
    // hexagonal netting: each cell's two upright sides are a pair of wires twisted together
    const W = 21, H = 25, t = 5, ox = R() * W, oy = R() * H, J = 1.5
    const V = (x, y) => [x + jit(x, y) * J, y + jit(y, x) * J]
    const cells = []
    for (let j = -2; j * (H / 2 + t) < h + H; j++) for (let i = -2; i * W < w + W; i++) cells.push([i * W + (j & 1 ? W / 2 : 0) + ox, j * (H / 2 + t) + oy])
    const hex = (c, dx = 0, dy = 0) => { c.beginPath(); for (const [x, y] of cells) { const q = [V(x, y - H / 2), V(x + W / 2, y - t), V(x + W / 2, y + t), V(x, y + H / 2), V(x - W / 2, y + t), V(x - W / 2, y - t)]; c.moveTo(q[0][0] + dx, q[0][1] + dy); for (let k = 1; k <= 6; k++) c.lineTo(q[k % 6][0] + dx, q[k % 6][1] + dy) } }
    const twists = (c, dx = 0, dy = 0) => { c.beginPath(); for (const [x, y] of cells) { const a = V(x + W / 2, y - t), b = V(x + W / 2, y + t); c.moveTo(a[0] + dx, a[1] + dy); c.lineTo(b[0] + dx, b[1] + dy) } }
    return {
      mask: m => { m.lineJoin = 'round'; m.lineCap = 'round'; m.strokeStyle = '#000'; m.lineWidth = 1.4; hex(m); m.stroke(); m.lineWidth = 2.8; twists(m); m.stroke() },
      shade: (s, edge) => {
        s.lineWidth = .7; s.strokeStyle = 'rgba(255,255,255,.4)'; hex(s, 0, -.6); s.stroke()
        s.lineWidth = .8; s.strokeStyle = 'rgba(0,0,0,.5)'; hex(s, 0, .7); s.stroke()
        s.beginPath(); for (const [x, y] of cells) { const [ax, ay] = V(x + W / 2, y - t), [, by] = V(x + W / 2, y + t); for (let yy = ay + 1.2; yy < by; yy += 2.2) { s.moveTo(ax - 1.4, yy - .9); s.lineTo(ax + 1.4, yy + .9) } }
        s.lineWidth = .7; s.strokeStyle = 'rgba(0,0,0,.6)'; s.stroke()
        if (edge) { s.lineWidth = .8; s.strokeStyle = edge; hex(s, 0, 1.1); s.stroke() }
      }
    }
  },
  woven (w, h, R) {
    const P = 7, ox = R() * P, oy = R() * P, nx = Math.ceil(w / P) + 2, ny = Math.ceil(h / P) + 2
    return {
      mask: m => { m.strokeStyle = '#000'; m.lineWidth = 1.8; m.beginPath(); for (let i = -1; i < ny; i++) { m.moveTo(0, oy + i * P); m.lineTo(w, oy + i * P) } for (let j = -1; j < nx; j++) { m.moveTo(ox + j * P, 0); m.lineTo(ox + j * P, h) } m.stroke() },
      shade: (s, edge) => {
        // over and under: at each crossing one wire lies on top, lit, with the other in its shadow
        const hi = new Path2D(), lo = new Path2D()
        for (let i = -1; i < ny; i++) for (let j = -1; j < nx; j++) {
          const x = ox + j * P, y = oy + i * P
          if ((i + j) & 1) { hi.moveTo(x - 2.6, y - .45); hi.lineTo(x + 2.6, y - .45); lo.moveTo(x - .9, y - 2.4); lo.lineTo(x - .9, y + 2.4); lo.moveTo(x + .9, y - 2.4); lo.lineTo(x + .9, y + 2.4) }
          else { hi.moveTo(x - .45, y - 2.6); hi.lineTo(x - .45, y + 2.6); lo.moveTo(x - 2.4, y - .9); lo.lineTo(x + 2.4, y - .9); lo.moveTo(x - 2.4, y + .9); lo.lineTo(x + 2.4, y + .9) }
        }
        s.lineWidth = .7; s.strokeStyle = 'rgba(0,0,0,.5)'; s.stroke(lo); s.lineWidth = .7; s.strokeStyle = 'rgba(255,255,255,.4)'; s.stroke(hi)
        if (edge) { s.fillStyle = edge; s.globalAlpha = .5; s.fillRect(0, 0, w, h); s.globalAlpha = 1 }
      }
    }
  },
  perf (w, h, R) {
    const P = 10, r = 3.5, ox = R() * P, oy = R() * P, holes = []
    for (let i = -1; i * P * .866 < h + P; i++) for (let j = -1; j * P < w + P; j++) holes.push([ox + j * P + (i & 1 ? P / 2 : 0), oy + i * P * .866])
    const ring = (c, dy, rr) => { c.beginPath(); for (const [x, y] of holes) { c.moveTo(x + rr, y + dy); c.arc(x, y + dy, rr, 0, TAU) } }
    return {
      mask: m => { m.fillStyle = '#000'; m.fillRect(0, 0, w, h); m.globalCompositeOperation = 'destination-out'; ring(m, 0, r); m.fill(); m.globalCompositeOperation = 'source-over' },
      shade: (s, edge) => { s.lineWidth = .9; s.strokeStyle = 'rgba(0,0,0,.55)'; ring(s, -.9, r + .2); s.stroke(); s.strokeStyle = 'rgba(255,255,255,.3)'; ring(s, .9, r + .2); s.stroke(); if (edge) { s.strokeStyle = edge; s.lineWidth = 1; ring(s, .5, r + .4); s.stroke() } }
    }
  }
}
// Old bare metal, drawn: no paint, or very little.
const METAL = {
  steel: { base: '#5b6065', blot: ['#3e4348', '#777d83', '#4a5664', '#685a4c', '#2f3236'], rust: .35, streak: 1 },
  galv: { base: '#9aa0a4', blot: ['#bcc1c4', '#80878c', '#a9afa9', '#d6d9d4', '#6f767b'], rust: .08, spangle: 1 },
  rust: { base: '#6b381b', blot: ['#8c4a21', '#4a2411', '#a65b2a', '#3b2b22', '#7d4a2c', '#b8692f'], rust: 1.2 },
  copper: { base: '#87522f', blot: ['#a8683f', '#6b3d22', '#c4825a', '#5a3a2a', '#9a5e3a'], rust: 0, verdigris: 1 }
}
function metalPaint (g, w, h, kind, R) {
  const M = METAL[kind], rgb = hx => { const c = hex2rgb(hx); return c.r + ',' + c.g + ',' + c.b }
  const blob = (x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb(col)},${a})`); gr.addColorStop(1, `rgba(${rgb(col)},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r) }
  g.fillStyle = M.base; g.fillRect(0, 0, w, h)
  for (let i = 0, n = 30 + w * h / 700; i < n; i++) blob(R() * w, R() * h, 5 + R() * 38, M.blot[(R() * M.blot.length) | 0], .25 + R() * .45)
  if (M.spangle) for (let i = 0, n = w * h / 160; i < n; i++) { const x = R() * w, y = R() * h, r = 4 + R() * 11, v = 150 + ((R() * 70) | 0); g.fillStyle = `rgba(${v},${v + 3},${v + 5},.22)`; g.beginPath(); for (let a = 0; a < TAU; a += TAU / 6) g.lineTo(x + Math.cos(a + R()) * r, y + Math.sin(a + R()) * r); g.fill() }
  if (M.streak) for (let i = 0, n = w * h / 90; i < n; i++) { const x = R() * w, y = R() * h; g.strokeStyle = R() < .5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.09)'; g.lineWidth = .5 + R(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10 + R() * 60, y + (R() - .5)); g.stroke() }
  for (let i = 0, n = (w * h / 1500) * M.rust; i < n; i++) blob(R() * w, R() * h, 2 + R() * 14, R() < .6 ? '#7a3a14' : '#a0521f', .35 + R() * .4)
  if (M.verdigris) for (let i = 0, n = w * h / 1100; i < n; i++) { const x = R() * w, y = R() * h; for (let k = 0; k < 5; k++) blob(x + (R() - .5) * 14, y + (R() - .5) * 8, 2 + R() * 9, R() < .5 ? '#5fa58c' : '#86c4aa', .45 + R() * .3) }
  for (let i = 0, n = w * h / 25; i < n; i++) { g.fillStyle = R() < .5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.1)'; g.fillRect(R() * w, R() * h, 1, 1) }
}
// The grille, drawn straight into its canvas: its metal, its shadow cast on the glow behind, its edges lit by the glow.
function meshTex (cv, w, h, img, seed, tint, glow) {
  const R = mulberry(seed ^ 0x3e11), k = Math.min(2, window.devicePixelRatio || 1)
  cv.width = Math.round(w * k); cv.height = Math.round(h * k)
  const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height)
  const layer = () => { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const x = c.getContext('2d'); x.setTransform(k, 0, 0, k, 0, 0); return [c, x] }
  const T = (MESH_GEO[SALV_MESH] || MESH_GEO.expanded)(w, h, R)
  const [mk, m] = layer(); T.mask(m)
  m.globalCompositeOperation = 'destination-out'
  for (let i = 0, n = 1 + ((R() * 2.6) | 0); i < n; i++) { const x = R() * w, y = R() * h, r = 6 + R() * 10; m.beginPath(); for (let a = 0; a < TAU; a += TAU / 10) { const rr = r * (.55 + R() * .7); m.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * .7) } m.fill() }
  m.globalCompositeOperation = 'source-over'
  const [sk, s] = layer()
  if (SALV_METAL !== 'scrap' && METAL[SALV_METAL]) metalPaint(s, w, h, SALV_METAL, R)
  else if (img) sheetCrop(s, w, h, img, R)
  else { s.fillStyle = '#6d6a64'; s.fillRect(0, 0, w, h) }
  if (tint && SALV_METAL === 'scrap') { s.globalCompositeOperation = 'color'; s.globalAlpha = .55; s.fillStyle = tint; s.fillRect(0, 0, w, h); s.globalAlpha = 1 }
  s.setTransform(1, 0, 0, 1, 0, 0); s.globalCompositeOperation = 'destination-in'; s.drawImage(mk, 0, 0)
  s.setTransform(k, 0, 0, k, 0, 0); s.globalCompositeOperation = 'source-atop'
  // set back behind the faceplate: the metal sits in shade, its highlights softer
  s.fillStyle = 'rgba(0,0,0,.44)'; s.fillRect(0, 0, w, h)
  s.globalAlpha = .72; T.shade(s, glow ? GLOW_EDGE[SALV_GLOW] : ''); s.globalAlpha = 1
  const vg = s.createRadialGradient(w * .6, h * .7, Math.min(w, h) * .2, w / 2, h / 2, Math.hypot(w, h) * .6); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); s.fillStyle = vg; s.fillRect(0, 0, w, h)
  g.save(); g.filter = 'blur(' + (2 * k) + 'px)'; g.globalAlpha = .8; g.drawImage(mk, 2.5 * k, 3 * k); g.restore()
  g.drawImage(sk, 0, 0)
}
// Salvage's sheets, from GOATi's texture library (\\GOATi-SV22\Art_Resources\Textures_Sets, Total Textures volume 2,
// Aged & Stressed: metal/met007, metal/met009, metal/met011, misc/mis008), each scaled to 1024x768 (D-RIG-010 (a),
// D-RIG-016). The grille's bare metals stay drawn (metalPaint), as the owner picked them in the lab.
const tex = name => new URL('tex/salvage-' + name + '.jpg', import.meta.url).href
const SALV_TEX = [['orange', 'Rust and orange', tex('orange')], ['red', 'Worn red', tex('red')], ['pale', 'Pale blue, rust runs', tex('pale')], ['blue', 'Blue over red', tex('blue')]]
let SALV_SHEET = 'orange'
function salvCur () { return { sheet: SALV_SHEET, mesh: SALV_MESH, metal: SALV_METAL, glow: SALV_GLOW, words: SALV_WORDS } }
function syncSheets () {
  const cur = salvCur()
  for (const b of $$('[data-salv]')) b.setAttribute('aria-pressed', String(b.dataset.val === cur[b.dataset.salv]))
  for (const g of $$('.salv-glow')) g.dataset.glow = SALV_GLOW
  document.documentElement.dataset.salvWords = SALV_WORDS
}
function setSalv (key, val) {
  const list = { sheet: [...SALV_TEX, ['mixed']], mesh: MESH_TYPES, metal: MESH_METALS, glow: GLOWS, words: WORD_STYLES }[key]
  if (!list || typeof val !== 'string' || !list.some(x => x[0] === val)) return false
  if (salvCur()[key] === val) return false
  if (key === 'sheet') SALV_SHEET = val; else if (key === 'mesh') SALV_MESH = val; else if (key === 'metal') SALV_METAL = val; else if (key === 'words') SALV_WORDS = val; else SALV_GLOW = val
  return true
}
function resalvage (reseed) { for (const el of $$(SALV_SEL)) { if (reseed) el.__seed = (Math.random() * 1e9) | 0; el.__sk = ''; scheduleSalvage(el) } }
function paintSalvage (el) {
  if (!el.isConnected) return
  const w = Math.round(el.clientWidth), h = Math.round(el.clientHeight), hw = el.closest('.hw')
  if (w < 20 || h < 20 || !hw) return
  if (!el.__seed) el.__seed = (Math.random() * 1e9) | 0
  const isMesh = el.tagName === 'CANVAS', base = SALV_SHEET === 'mixed' ? SALV_TEX[el.__seed % SALV_TEX.length][0] : SALV_SHEET
  // the name plate is cut from another scrap than the amp
  const sheet = el.classList.contains('salv-plate') && SALV_SHEET !== 'mixed' ? SALV_TEX[(SALV_TEX.findIndex(x => x[0] === base) + 1) % SALV_TEX.length][0] : base
  const img = SALV_IMG[sheet], tint = FINISH === 'own' ? '' : finFor(kitOf(hw))
  const key = `${w}x${h}:${tint}:${img ? sheet : 'drawn:' + finFor(kitOf(hw))}:${el.__seed}` + (isMesh ? `:${SALV_MESH}:${SALV_METAL}:${SALV_GLOW}` : '')
  if (el.__sk === key) return
  el.__sk = key
  if (isMesh) { meshTex(el, w, h, img, el.__seed, tint, !hw.classList.contains('cab')); return }
  let r = null
  // the words' colour comes from the metal behind the controls, not the whole sheet
  const ui = el.querySelector('.ui, .cplate'), er = el.getBoundingClientRect(), ur = ui && ui.getBoundingClientRect()
  const reg = ur && er.width ? [(ur.left - er.left) / er.width, (ur.top - er.top) / er.height, ur.width / er.width, ur.height / er.height] : null
  if (img) r = photoTex(w, h, img, el.__seed, tint, reg)
  if (r) {
    el.style.backgroundImage = r.url; el.style.backgroundSize = r.size || '100% 100%'; el.style.backgroundPosition = r.pos || '0 0'
    el.style.setProperty('--ink', r.light ? '#17130e' : '#f5f0e6')
    el.style.setProperty('--halo', r.light ? INK_HALO[1] : INK_HALO[0])
    if (r.canvas) inkEach(el, r.canvas)
    if (el.classList.contains('salv-plate')) el.dataset.ink = r.light ? 'dark' : 'light'
  } else {
    el.style.backgroundImage = `url(${salvageTex(w, h, finFor(kitOf(hw)), el.__seed)})`; el.style.backgroundSize = '100% 100%'; el.style.backgroundPosition = '0 0'
    el.style.removeProperty('--ink'); el.style.removeProperty('--halo')
  }
}
// One piece's crop of a photographed sheet: its own scale, offset, quarter turn and flips, then light and wear on top.
// Dark or light words by contrast with the metal behind them: relative luminance (linear), split where a dark word
// (#1a1009) and a light one (#d6cfc3) read equally well. (D-RIG-014: mid-tones such as the orange paint get dark words.)
const LIN = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4) }
const RL = (r, g, b) => .2126 * LIN(r) + .7152 * LIN(g) + .0722 * LIN(b), INK_SPLIT = .145
const INK_HALO = ['0 1px 1px rgba(0,0,0,.95), 0 0 4px rgba(0,0,0,.8), 0 0 8px rgba(0,0,0,.35)', '0 0 3px rgba(255,255,255,.9), 0 1px 0 rgba(255,255,255,.6), 0 0 8px rgba(255,255,255,.35)']
function inkEach (el, c) {
  try {
    const er = el.getBoundingClientRect(), sx = c.width / er.width, sy = c.height / er.height
    const s = document.createElement('canvas'); s.width = 8; s.height = 4; const sg = s.getContext('2d')
    for (const t of el.querySelectorAll('.lb, .st, .pname')) {
      if (t.closest('.salv-plate')) continue
      const r = t.getBoundingClientRect(); if (!r.width) continue
      sg.clearRect(0, 0, 8, 4); sg.drawImage(c, (r.left - er.left - 2) * sx, (r.top - er.top - 1) * sy, (r.width + 4) * sx, (r.height + 2) * sy, 0, 0, 8, 4)
      const d = sg.getImageData(0, 0, 8, 4).data; let L = 0
      for (let i = 0; i < d.length; i += 4) L += RL(d[i], d[i + 1], d[i + 2])
      const light = L / 32 > INK_SPLIT
      t.dataset.ink = light ? 'dark' : 'light'
    }
  } catch (err) {}
}
function photoTex (w, h, img, seed, tint, reg) {
  const R = mulberry(seed ^ 0x5a17), iw = img.naturalWidth, ih = img.naturalHeight
  const quarter = R() < .35, cw = quarter ? ih : iw, ch = quarter ? iw : ih
  const sc = Math.max(w / cw, h / ch) * (1.05 + R() * .85), ox = (w - cw * sc) * R(), oy = (h - ch * sc) * R()
  const fx = R() < .5 ? -1 : 1, fy = R() < .5 ? -1 : 1, turn = (quarter ? Math.PI / 2 : 0) + (R() < .5 ? Math.PI : 0)
  const k = Math.min(2, window.devicePixelRatio || 1), c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k)
  const g = c.getContext('2d'); g.scale(k, k)
  g.save(); g.translate(ox + cw * sc / 2, oy + ch * sc / 2); g.rotate(turn); g.scale(fx * sc, fy * sc); g.drawImage(img, -iw / 2, -ih / 2); g.restore()
  if (tint) { g.globalCompositeOperation = 'color'; g.globalAlpha = .55; g.fillStyle = tint; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1 }
  let gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,.08)'); gr.addColorStop(.45, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.24)'); g.fillStyle = gr; g.fillRect(0, 0, w, h)
  gr = g.createLinearGradient(0, 0, w, h * .4); gr.addColorStop(.3, 'rgba(255,255,255,0)'); gr.addColorStop(.46, 'rgba(255,255,255,.07)'); gr.addColorStop(.62, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h)
  const vg = g.createRadialGradient(w / 2, h * .45, Math.min(w, h) * .3, w / 2, h / 2, Math.hypot(w, h) * .62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.34)'); g.fillStyle = vg; g.fillRect(0, 0, w, h)
  g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2); g.strokeStyle = 'rgba(255,255,255,.13)'; g.lineWidth = 1; g.strokeRect(2.5, 2.5, w - 5, h - 5)
  try {
    const s = document.createElement('canvas'); s.width = 24; s.height = 24
    const sg = s.getContext('2d'), q = reg || [0, 0, 1, 1]; sg.drawImage(c, q[0] * c.width, q[1] * c.height, Math.max(1, q[2] * c.width), Math.max(1, q[3] * c.height), 0, 0, 24, 24)
    const d = sg.getImageData(0, 0, 24, 24).data; let L = 0
    for (let i = 0; i < d.length; i += 4) L += RL(d[i], d[i + 1], d[i + 2])
    return { url: `url(${c.toDataURL('image/jpeg', .86)})`, light: L / (d.length / 4) > INK_SPLIT, canvas: c }
  } catch (err) {
    // the photo can't be read back here (a file opened from disk): show it straight, cropped by CSS
    return { url: `linear-gradient(180deg, rgba(255,255,255,.08), rgba(0,0,0,0) 45%, rgba(0,0,0,.24)), url(${img.src})`, size: `auto, ${Math.round(sc * iw / w * 100)}% auto`, pos: `0 0, ${Math.round(R() * 100)}% ${Math.round(R() * 100)}%`, light: false }
  }
}
function salvageTex (w, h, finHex, seed) {
  const R = mulberry(seed), k = Math.min(2, window.devicePixelRatio || 1), W = Math.round(w * k), H = Math.round(h * k), rnd = (a, b) => a + R() * (b - a)
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d'); g.scale(k, k)
  // bare steel with mill streaks
  g.fillStyle = '#7b8086'; g.fillRect(0, 0, w, h)
  for (let i = 0; i < w * h / 60; i++) { const y = R() * h, x = R() * w, l = rnd(8, 70); g.strokeStyle = R() < .5 ? `rgba(255,255,255,${rnd(.03, .09).toFixed(3)})` : `rgba(0,0,0,${rnd(.03, .1).toFixed(3)})`; g.lineWidth = rnd(.4, 1.2); g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + rnd(-.6, .6)); g.stroke() }
  const rust = (x, y, r, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(122,58,18,${a})`); gr.addColorStop(.5, `rgba(150,78,28,${a * .6})`); gr.addColorStop(1, 'rgba(150,78,28,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill() }
  for (let i = 0; i < 6 + R() * 8; i++) rust(R() * w, R() * h, rnd(10, 60), rnd(.35, .7))
  for (let i = 0; i < w * h / 120; i++) { g.fillStyle = `rgba(${rnd(90, 140) | 0},${rnd(40, 70) | 0},${rnd(15, 30) | 0},${rnd(.1, .4).toFixed(2)})`; g.fillRect(R() * w, R() * h, rnd(.5, 1.6), rnd(.5, 1.6)) }
  // the paint on its own layer, so chips and scratches cut through to the steel
  const p = document.createElement('canvas'); p.width = W; p.height = H
  const q = p.getContext('2d'); q.scale(k, k)
  q.fillStyle = finHex; q.fillRect(0, 0, w, h)
  for (let i = 0; i < 14; i++) { const x = R() * w, y = R() * h, r = rnd(30, 140), lite = R() < .5, gr = q.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, lite ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = gr; q.fillRect(x - r, y - r, 2 * r, 2 * r) }
  const fade = q.createLinearGradient(0, 0, 0, h); fade.addColorStop(0, 'rgba(255,255,255,.1)'); fade.addColorStop(1, 'rgba(0,0,0,.08)'); q.fillStyle = fade; q.fillRect(0, 0, w, h)
  q.globalCompositeOperation = 'destination-out'
  const chip = (x, y, r) => { q.beginPath(); const n = 7 + (R() * 5 | 0); for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = r * rnd(.45, 1.15), px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; if (i) q.lineTo(px, py); else q.moveTo(px, py) } q.closePath(); q.fill() }
  const per = 2 * (w + h)
  for (let i = 0; i < per / 7; i++) { const s = R() * per; let x, y; if (s < w) { x = s; y = rnd(0, 4) } else if (s < w + h) { x = w - rnd(0, 4); y = s - w } else if (s < 2 * w + h) { x = s - w - h; y = h - rnd(0, 4) } else { x = rnd(0, 4); y = s - 2 * w - h } chip(x, y, rnd(1.5, 7)) }
  for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) for (let i = 0; i < 6; i++) chip(cx + rnd(-14, 14), cy + rnd(-14, 14), rnd(4, 12))
  for (let i = 0; i < w * h / 9000 + 6; i++) chip(R() * w, R() * h, rnd(1.2, 6))
  q.lineCap = 'round'
  for (let i = 0; i < w * h / 2500 + 12; i++) { let x = R() * w, y = R() * h; const a = rnd(-.5, .5) + (R() < .3 ? Math.PI / 2 : 0), l = rnd(10, 110); q.lineWidth = rnd(.35, 1.4); q.beginPath(); q.moveTo(x, y); for (let j = 0; j < 6; j++) { x += Math.cos(a) * l / 6 + rnd(-1, 1); y += Math.sin(a) * l / 6 + rnd(-1, 1); q.lineTo(x, y) } q.stroke() }
  for (let i = 0; i < 5; i++) { const x0 = R() * w, y0 = R() * h, a = rnd(0, TAU); for (let j = 0; j < 12; j++) { const x = x0 + rnd(-10, 10), y = y0 + rnd(-6, 6), l = rnd(3, 12); q.lineWidth = rnd(.3, .8); q.beginPath(); q.moveTo(x, y); q.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); q.stroke() } }
  q.globalCompositeOperation = 'source-over'
  // the paint over the steel, with a dark lip where it chipped
  g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 1.6 * k; g.shadowOffsetY = .5 * k; g.drawImage(p, 0, 0, w, h); g.restore()
  // rust bleeding through, and its runs
  for (let i = 0; i < 5 + R() * 5; i++) { const x = R() * w, y = R() * h, l = rnd(20, 70); rust(x, y, rnd(4, 16), rnd(.25, .5)); const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, 'rgba(110,52,16,.32)'); gr.addColorStop(1, 'rgba(110,52,16,0)'); g.fillStyle = gr; g.fillRect(x - rnd(.8, 2), y, rnd(1.5, 4), l) }
  // water stains
  for (let i = 0; i < 3 + R() * 3; i++) { const x = R() * w, y = R() * h, r = rnd(12, 46); g.strokeStyle = `rgba(40,30,18,${rnd(.12, .22).toFixed(2)})`; g.lineWidth = rnd(1.5, 3.5); g.filter = 'blur(1.2px)'; g.beginPath(); g.ellipse(x, y, r, r * rnd(.6, 1), rnd(0, 3), 0, TAU); g.stroke(); g.filter = 'none'; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(60,45,25,.06)'); gr.addColorStop(1, 'rgba(60,45,25,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill() }
  // grime towards the edges, and grain
  for (const [x0, y0, x1, y1] of [[0, 0, 0, 22], [0, h, 0, h - 22], [0, 0, 22, 0], [w, 0, w - 22, 0]]) { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(20,14,8,.38)'); gr.addColorStop(1, 'rgba(20,14,8,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h) }
  for (let i = 0; i < w * h / 40; i++) { g.fillStyle = R() < .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)'; g.fillRect(R() * w, R() * h, 1, 1) }
  return c.toDataURL('image/jpeg', .86)
}
// ---- the energy (lab 1937-2361)
// ---------------------------------------------------------------- the energy
// Pavillion Hub's logo-window layers (pavillion_client hub/apps/web/src/shell/logo-window/effects.ts and reactor.ts),
// the same maths, drawn behind a faceplate instead of inside the ring: a layer's disc (radius 1) sits on the kit's port,
// and the far edges of the face are `ext` discs out. Valve and Ferro are new here. Colours come from the finish.
const rgba = (c, a) => `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${clamp01(a).toFixed(3)})`
const hot = (c, k) => ({ r: c.r + (255 - c.r) * k, g: c.g + (255 - c.g) * k, b: c.b + (255 - c.b) * k })
const mix = (a, b, k) => ({ r: a.r + (b.r - a.r) * k, g: a.g + (b.g - a.g) * k, b: a.b + (b.b - a.b) * k })
const pol = (r, a) => [Math.cos(a) * r, Math.sin(a) * r]
const WHITE = { r: 255, g: 255, b: 255 }, DEEP = { r: 4, g: 3, b: 7 }
function glowDisc (g, x, y, r, col, a) {
  if (a <= .003 || r <= 0) return
  const gr = g.createRadialGradient(x, y, 0, x, y, r)
  gr.addColorStop(0, rgba(col, a)); gr.addColorStop(.35, rgba(col, a * .45)); gr.addColorStop(1, rgba(col, 0))
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill()
}
function band (g, r, w, col, a) {
  if (a <= .003) return
  const r0 = Math.max(0, r - w), r1 = r + w, gr = g.createRadialGradient(0, 0, r0, 0, 0, r1)
  gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(.5, rgba(col, a)); gr.addColorStop(1, rgba(col, 0))
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r1, 0, TAU); g.fill()
}
function line (g, pts, w, style) { g.lineWidth = w; g.strokeStyle = style; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke() }
function inDisc (g, P, fn) { g.save(); g.translate(P.x, P.y); g.scale(P.r, P.r); fn(1 / P.r); g.restore() }

// Heartbeat: a double pulse at rest; while playing, every pick is a beat. Each beat's shockwave runs out across the face.
const beat = x => x < 0 ? 0 : (1 - Math.exp(-x / .018)) * Math.exp(-x / .17)
const pulse = {
  init: () => ({ beats: [], next: 0 }),
  draw (g, st, t, dt, E) {
    if (E.playing) { if (E.atk > .05) st.beats.push({ t0: t, s: Math.min(1.2, .4 + E.atk) }) } else if (t >= st.next) { st.beats.push({ t0: t, s: 1 }, { t0: t + .19, s: .62 }); st.next = t + 1.45 }
    if (st.next > t + 3) st.next = t
    st.beats = st.beats.filter(b => t - b.t0 < 1.3 && t - b.t0 > -1)
    let env = 0
    for (const b of st.beats) env += beat(t - b.t0) * b.s
    const A = E.amp, col = E.col, ext = E.geo.ext
    inDisc(g, E.geo.P, () => {
      glowDisc(g, 0, 0, .9 + .3 * env, col, (.3 + .55 * env) * A)
      glowDisc(g, 0, 0, .45, hot(col, .55), .65 * env * A)
      for (const b of st.beats) {
        const k = (t - b.t0) / 1.15
        if (k < 0 || k > 1) continue
        const r = .45 + (ext - .45) * (1 - Math.pow(1 - k, 2.2))
        band(g, r, (.08 + .1 * (1 - k)) * (1 + r * .12), col, Math.pow(1 - k, 1.3) * .9 * b.s * A)
      }
      glowDisc(g, 0, 0, ext * .9, col, .07 * A)
    })
  }
}

// Storm: arcs of current crack from the core across the face; each pick strikes, a chord strikes several.
function bolt (a, b, rough, levels) {
  let pts = [a, b]
  for (let l = 0; l < levels; l++) {
    const out = [pts[0]]
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i], dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1, off = (Math.random() - .5) * len * rough
      out.push([(p[0] + q[0]) / 2 - dy / len * off, (p[1] + q[1]) / 2 + dx / len * off], q)
    }
    pts = out
  }
  return pts
}
function newArc (t, ext) {
  const th = Math.random() * TAU, r0 = .42 + Math.random() * .12, th1 = th + (Math.random() - .5), reach = 1 + Math.random() * Math.max(0, ext * .85 - 1)
  return { from: pol(r0, th), to: pol(reach, th1), born: t, life: .1 + Math.random() * .26, jit: -1, pts: null, fk: null, fork: Math.random() < .55, forkTo: pol(reach * (.6 + Math.random() * .3), th1 + (Math.random() - .5) * .9) }
}
const storm = {
  init: () => ({ arcs: [], next: .2, flash: 0 }),
  draw (g, st, t, dt, E) {
    const col = E.col, A = E.amp, ext = E.geo.ext
    let n = 0
    if (E.playing) { if (E.atk > .08) n = 1 + Math.round(E.atk * 2.4); if (t >= st.next) { n = Math.max(n, Math.random() < .5 ? 1 : 0); st.next = t + .25 + Math.random() * .6 } } else if (t >= st.next) { n = Math.random() < .3 ? 2 + ((Math.random() * 2) | 0) : 1; st.next = t + .06 + Math.random() * Math.random() * .7 }
    if (st.next > t + 3) st.next = t
    if (A > .05) for (let i = 0; i < n; i++) st.arcs.push(newArc(t, ext))
    st.flash = Math.min(1.5, st.flash + .55 * n) * Math.exp(-dt * 7)
    inDisc(g, E.geo.P, u => {
      glowDisc(g, 0, 0, E.geo.ext * .85, col, .1 * A); glowDisc(g, 0, 0, 1.3, col, (.32 + .4 * st.flash) * A)
      glowDisc(g, 0, 0, .5, hot(col, .5), .3 * st.flash * A)
      g.lineCap = 'round'; g.lineJoin = 'round'
      st.arcs = st.arcs.filter(a => t - a.born < a.life && t >= a.born)
      for (const a of st.arcs) {
        if (!a.pts || t - a.jit > .045) { a.pts = bolt(a.from, a.to, .3, 6); a.fk = a.fork ? bolt(a.pts[(a.pts.length * .45) | 0], a.forkTo, .34, 5) : null; a.jit = t }
        const k = (t - a.born) / a.life, al = (k < .15 ? 1 : 1 - (k - .15) / .85) * A
        for (const pts of a.fk ? [a.pts, a.fk] : [a.pts]) { line(g, pts, 7 * u, rgba(col, .14 * al)); line(g, pts, 3 * u, rgba(col, .5 * al)); line(g, pts, 1.4 * u, rgba(hot(col, .85), .95 * al)) }
        glowDisc(g, a.to[0], a.to[1], .25, hot(col, .4), .7 * al)
      }
    })
  }
}

// Warp: light streaks out of the core towards you; its speed follows your level, and a big chord surges.
function star (initial) { const a = Math.random() * TAU, d = .03 + Math.random() * .4; return { x: Math.cos(a) * d, y: Math.sin(a) * d, z: initial ? .06 + Math.random() * .94 : 1, sp: .75 + Math.random() * .5 } }
const warp = {
  init: () => ({ s: Array.from({ length: 300 }, () => star(true)), kick: 0 }),
  draw (g, st, t, dt, E) {
    const col = E.col, A = E.amp, ext = E.geo.ext
    st.kick = Math.max(st.kick * Math.exp(-dt * 2.5), E.atk > .7 ? E.atk : 0)
    const cyc = t % 7, surge = E.playing ? Math.min(1, st.kick) : (cyc > 5 ? Math.sin((cyc - 5) / 2 * Math.PI) : 0)
    const v = (.42 + 1.9 * surge * surge + (E.playing ? E.lvl * 1.2 : 0)) * (.25 + .75 * A), f = .2 * ext / 1.9
    inDisc(g, E.geo.P, u => {
      glowDisc(g, 0, 0, 1.1, col, (.4 + .35 * surge) * A)
      glowDisc(g, 0, 0, .45, hot(col, .6), (.35 + .4 * surge) * A)
      g.lineCap = 'round'
      for (const s of st.s) {
        const z0 = s.z
        s.z -= v * dt * s.sp
        if (s.z <= .045) { Object.assign(s, star(false)); continue }
        const x0 = s.x / z0 * f, y0 = s.y / z0 * f, x1 = s.x / s.z * f, y1 = s.y / s.z * f
        if (x1 * x1 + y1 * y1 > ext * ext) { Object.assign(s, star(false)); continue }
        const tail = 3 + surge * 7, near = 1 - s.z
        g.strokeStyle = rgba(near > .75 ? hot(col, .75) : col, (.32 + .68 * near) * A)
        g.lineWidth = (.6 + 2.2 * near * near) * u
        g.beginPath(); g.moveTo(x1 - (x1 - x0) * tail, y1 - (y1 - y0) * tail); g.lineTo(x1, y1); g.stroke()
      }
    })
  }
}

// Circuit: a pulse runs in along a trace for each pick; a hard pick fires them all back out (in the face's pixels).
function along (tr, s) {
  s = Math.max(0, Math.min(tr.len, s))
  for (let k = 0; k < tr.seg.length; k++) { if (s <= tr.seg[k]) { const a = tr.pts[k], b = tr.pts[k + 1], w = s / tr.seg[k]; return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w] } s -= tr.seg[k] }
  return tr.pts[tr.pts.length - 1]
}
function comet (g, tr, s, dir, tail, col, amp) {
  const K = 9
  for (let k = 0; k < K; k++) {
    const s0 = s - dir * tail * (1 - k / K), s1 = s - dir * tail * (1 - (k + 1) / K)
    if (s1 < 0 || s1 > tr.len) continue
    const a = along(tr, s0), b = along(tr, s1), w = (k + 1) / K
    g.strokeStyle = rgba(w > .8 ? hot(col, .6) : col, w * w * .95 * amp); g.lineWidth = 1 + 1.8 * w
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke()
  }
  const h = along(tr, s); glowDisc(g, h[0], h[1], 8, hot(col, .7), .9 * amp)
}
const circuit = {
  init: () => ({ p: [], next: 0, surge: 3.5, charge: 0 }),
  draw (g, st, t, dt, E) {
    const col = E.col, A = E.amp, tr = E.geo.traces || [], P = E.geo.P
    if (!tr.length) return
    glowDisc(g, P.x, P.y, Math.max(E.geo.W, E.geo.H) * .7, col, .08 * A)
    glowDisc(g, P.x, P.y, P.r * 2.4, col, (.34 + .55 * st.charge) * A)
    g.lineCap = 'round'; g.lineJoin = 'round'
    for (const x of tr) line(g, x.pts, 1.8, rgba(col, (.26 + .6 * x.flash) * A))
    const pick = () => tr[(Math.random() * tr.length) | 0]
    if (E.playing) {
      if (E.atk > .05) for (let i = 0, n = 1 + Math.round(E.atk * 4); i < n; i++) st.p.push({ tr: pick(), s: 0, v: 140 + Math.random() * 120, dir: 1 })
      if (E.atk > .9) { for (const x of tr) st.p.push({ tr: x, s: x.len, v: 220, dir: -1 }); st.charge = 1.3 }
    } else {
      if (t >= st.next) { st.p.push({ tr: pick(), s: 0, v: 110 + Math.random() * 90, dir: 1 }); st.next = t + .04 + Math.random() * .16 }
      if (t >= st.surge) { for (const x of tr) st.p.push({ tr: x, s: x.len, v: 200, dir: -1 }); st.surge = t + 6; st.charge = 1.3 }
    }
    if (st.next > t + 3) st.next = t
    if (st.surge > t + 12) st.surge = t + 3
    st.charge *= Math.exp(-dt * 1.3)
    for (const p of st.p) {
      p.s += p.dir * p.v * dt
      comet(g, p.tr, p.s, p.dir, 26, col, A)
      if (p.dir > 0 && p.s >= p.tr.len) { p.dead = true; p.tr.flash = 1; st.charge = Math.min(1.3, st.charge + .06) }
      if (p.dir < 0 && p.s <= 0) p.dead = true
    }
    st.p = st.p.filter(p => !p.dead)
    if (st.p.length > 400) st.p.splice(0, st.p.length - 400)
    for (const x of tr) x.flash *= Math.exp(-dt * 4)
  }
}

// Turbine: two backlit compressor stages turning against each other; the front blades shaded across their chord and
// rim-lit by the glow behind them, a bolted hub under the spinner. The speed follows your level.
function blade (g, a) { g.save(); g.rotate(a); g.beginPath(); g.moveTo(.16, -.015); g.quadraticCurveTo(.62, 0, 1.06, .13); g.lineTo(1.06, .27); g.quadraticCurveTo(.6, .12, .16, .035); g.closePath(); g.fill(); g.restore() }
function bladeEdge (g, a) { g.save(); g.rotate(a); g.beginPath(); g.moveTo(.3, -.008); g.quadraticCurveTo(.62, 0, 1.06, .13); g.stroke(); g.restore() }
function rearBlade (g, a) { g.save(); g.rotate(a); g.beginPath(); g.moveTo(.2, -.01); g.quadraticCurveTo(.6, -.05, 1.02, -.1); g.lineTo(1.02, -.035); g.quadraticCurveTo(.6, 0, .2, .02); g.closePath(); g.fill(); g.restore() }
const turbine = {
  init: () => ({ a: Math.random() * TAU, b: Math.random() * TAU, w: 2.3 }),
  draw (g, st, t, dt, E) {
    const col = E.col, A = E.amp, N = 18
    const target = (E.playing ? 1.4 + 11 * Math.min(1, E.lvl) : 2.3 * (1 + .5 * Math.sin(t * .5))) * (.15 + .85 * A)
    st.w += (target - st.w) * Math.min(1, dt * 2.5); st.a += st.w * dt; st.b -= st.w * .7 * dt
    inDisc(g, E.geo.P, u => {
      glowDisc(g, 0, 0, E.geo.ext * .8, col, .08 * A)
      glowDisc(g, 0, 0, 1.3, col, .72 * A); glowDisc(g, 0, 0, .58, hot(col, .6), .62 * A)
      g.globalCompositeOperation = 'source-over'
      g.fillStyle = rgba(DEEP, .7)
      for (let i = 0; i < 33; i++) rearBlade(g, st.b + i * TAU / 33)
      for (let pass = 2; pass >= 1; pass--) { g.fillStyle = rgba(DEEP, [0, .34, .18][pass]); for (let i = 0; i < N; i++) blade(g, st.a - pass * st.w * .016 + i * TAU / N) }
      const gr = g.createLinearGradient(0, -.02, 0, .27); gr.addColorStop(0, '#50545e'); gr.addColorStop(.16, '#1b1c22'); gr.addColorStop(1, '#060608')
      g.fillStyle = gr
      for (let i = 0; i < N; i++) blade(g, st.a + i * TAU / N)
      const hub = g.createRadialGradient(-.04, -.05, .01, 0, 0, .24); hub.addColorStop(0, '#3c3f47'); hub.addColorStop(1, '#0b0c0f')
      g.fillStyle = hub; g.beginPath(); g.arc(0, 0, .24, 0, TAU); g.fill()
      g.fillStyle = '#62676f'
      for (let i = 0; i < 10; i++) { const p = pol(.19, st.a + i * TAU / 10); g.beginPath(); g.arc(p[0], p[1], .014, 0, TAU); g.fill() }
      g.globalCompositeOperation = 'lighter'
      g.strokeStyle = rgba(hot(col, .45), .55 * A); g.lineWidth = 1.1 * u
      for (let i = 0; i < N; i++) bladeEdge(g, st.a + i * TAU / N)
      g.strokeStyle = rgba(WHITE, .07); g.lineWidth = 2 * u; g.beginPath(); g.arc(0, 0, 1.04, 0, TAU); g.stroke()
      band(g, 1, .05, col, .35 * A)
    })
  }
}

// Lattice: a turning geodesic lattice (a once-subdivided icosahedron) with sparks running its struts; picks add sparks.
const GEO = (() => {
  const p = (1 + Math.sqrt(5)) / 2, nrm = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l] }
  const v = [[-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0], [0, -1, p], [0, 1, p], [0, -1, -p], [0, 1, -p], [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1]].map(nrm)
  const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]]
  const key = (a, b) => (a < b ? a * 1000 + b : b * 1000 + a), mids = new Map()
  const mid = (a, b) => { const k = key(a, b); if (!mids.has(k)) { v.push(nrm([(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2])); mids.set(k, v.length - 1) } return mids.get(k) }
  const faces = []
  for (const [a, b, c] of f) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); faces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]) }
  const idx = new Map(), e = [], adj = v.map(() => [])
  for (const [a, b, c] of faces) for (const [x, y] of [[a, b], [b, c], [c, a]]) { const k = key(x, y); if (!idx.has(k)) { idx.set(k, e.length); e.push([x, y]); adj[x].push(y); adj[y].push(x) } }
  return { v, e, adj, idx, key }
})()
function proj (pt, ax, ay) {
  let [x, y, z] = pt
  const cy = Math.cos(ay), sy = Math.sin(ay); [x, z] = [x * cy + z * sy, -x * sy + z * cy]
  const cx = Math.cos(ax), sx = Math.sin(ax); [y, z] = [y * cx - z * sx, y * sx + z * cx]
  const k = .72 / (1 - z * .3)
  return [x * k, y * k, z]
}
const lattice = {
  init: () => ({ lit: new Float32Array(GEO.e.length), w: Array.from({ length: 5 }, () => ({ at: (Math.random() * GEO.v.length) | 0, to: -1, k: 0 })), extra: [] }),
  draw (g, st, t, dt, E) {
    const col = E.col, A = E.amp, ay = t * .32, ax = .45 + .18 * Math.sin(t * .23), P = GEO.v.map(p => proj(p, ax, ay))
    if (E.playing && E.atk > .1) for (let i = 0, n = 1 + Math.round(E.atk * 2); i < n; i++) st.extra.push({ at: (Math.random() * GEO.v.length) | 0, to: -1, k: 0, life: 1.2 })
    if (st.extra.length > 24) st.extra.splice(0, st.extra.length - 24)
    const speed = 2.6 * (1 + (E.playing ? 1.5 * Math.min(1, E.lvl) : 0))
    inDisc(g, E.geo.P, u => {
      glowDisc(g, 0, 0, 1.1, col, .3 * A); glowDisc(g, 0, 0, E.geo.ext * .7, col, .06 * A)
      g.lineCap = 'round'
      for (let i = 0; i < GEO.e.length; i++) {
        const [a, b] = GEO.e[i], pa = P[a], pb = P[b], d = (pa[2] + pb[2] + 2) / 4, lit = st.lit[i]
        g.strokeStyle = rgba(lit > .1 ? hot(col, .5 * lit) : col, (.1 + .32 * d + .9 * lit) * A)
        g.lineWidth = (.8 + 1 * d + 2.4 * lit) * u
        g.beginPath(); g.moveTo(pa[0], pa[1]); g.lineTo(pb[0], pb[1]); g.stroke()
        st.lit[i] = lit * Math.exp(-dt * 1.7)
      }
      for (const p of P) { const d = (p[2] + 1) / 2; g.fillStyle = rgba(col, (.2 + .6 * d) * A); g.beginPath(); g.arc(p[0], p[1], (1.2 + 1.6 * d) * u, 0, TAU); g.fill() }
      for (const w of st.w.concat(st.extra)) {
        if (w.to < 0) { const nb = GEO.adj[w.at]; w.to = nb[(Math.random() * nb.length) | 0]; w.k = 0 }
        w.k = Math.min(1, w.k + dt * speed)
        if (w.life !== undefined) w.life -= dt
        const ei = GEO.idx.get(GEO.key(w.at, w.to))
        st.lit[ei] = Math.max(st.lit[ei], w.k)
        const pa = P[w.at], pb = P[w.to]
        glowDisc(g, pa[0] + (pb[0] - pa[0]) * w.k, pa[1] + (pb[1] - pa[1]) * w.k, .14, hot(col, .65), .95 * A)
        if (w.k >= 1) { w.at = w.to; w.to = -1 }
      }
      st.extra = st.extra.filter(w => w.life > 0)
    })
  }
}

// Reactor: the Hub's plasma (a domain-warped noise field on the GPU), its core on the kit's port. Its drifts come home
// every minute and its stream is one field drawn at two phases, as in the Hub, so time never reaches the GPU as a growing number.
const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform vec3 uP; uniform vec3 uC; uniform vec4 uQ; uniform vec4 uS; uniform float uPh; uniform float uSurge; uniform float uAmp; uniform float uHeat;
float h(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1.0,0.0)), u.x), mix(h(i+vec2(0.0,1.0)), h(i+vec2(1.0,1.0)), u.x), u.y); }
float fbm(vec2 p){ float v=0.0; float a=0.5; for(int i=0;i<5;i++){ v+=a*n(p); p=mat2(1.6,1.2,-1.2,1.6)*p; a*=0.5; } return v; }
void main(){
  vec2 uv = (gl_FragCoord.xy - uP.xy) / uP.z;
  float r = length(uv);
  vec2 dir = uv / max(r, 0.001);
  vec2 p = uv * 1.8;
  vec2 q = vec2(fbm(p + uQ.xy), fbm(p + vec2(5.2, 1.3) + uQ.zw));
  vec2 s = vec2(fbm(p + 3.0*q + vec2(1.7, 9.2) + uS.xy), fbm(p + 3.0*q + vec2(8.3, 2.8) + uS.zw));
  vec2 b = p + 3.5*s;
  float wa = 1.0 - abs(2.0*uPh - 1.0); float wb = 1.0 - wa;
  float fa = fbm(b - dir*(uPh*1.75));
  float fb = fbm(b - dir*(fract(uPh + 0.5)*1.75));
  float f = 0.484 + (fa*wa + fb*wb - 0.484) / sqrt(wa*wa + wb*wb);
  float core = exp(-r*r*(2.6/uHeat)) * uSurge * uHeat;
  float fil = smoothstep(0.45, 0.95, f + 0.25*core) * max(0.42, 1.15 - 0.32*r);
  float heat = core*0.95 + fil*1.25 + 0.12*f;
  vec3 col = mix(uC*0.22, uC, smoothstep(0.1, 0.65, heat));
  col = mix(col, vec3(1.0), smoothstep(0.95, 1.7, heat));
  float a = clamp(heat*1.15, 0.0, 1.0) * uAmp;
  gl_FragColor = vec4(col*a, a);
}`
const GL = { ok: undefined, W: 512, H: 256 }
function glGet () {
  if (GL.ok !== undefined) return GL.ok
  try {
    const c = document.createElement('canvas'); c.width = GL.W; c.height = GL.H
    const g = c.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true })
    if (!g) return (GL.ok = false)
    const sh = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); return g.getShaderParameter(s, g.COMPILE_STATUS) ? s : null }
    const vs = sh(g.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }'), fs = sh(g.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return (GL.ok = false)
    const pr = g.createProgram(); g.attachShader(pr, vs); g.attachShader(pr, fs); g.linkProgram(pr)
    if (!g.getProgramParameter(pr, g.LINK_STATUS)) return (GL.ok = false)
    g.useProgram(pr); g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer()); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW)
    const loc = g.getAttribLocation(pr, 'p'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0)
    const u = n => g.getUniformLocation(pr, n)
    Object.assign(GL, { c, g, u: { res: u('uRes'), P: u('uP'), C: u('uC'), Q: u('uQ'), S: u('uS'), ph: u('uPh'), surge: u('uSurge'), amp: u('uAmp'), heat: u('uHeat') } })
    c.addEventListener('webglcontextlost', e => { e.preventDefault(); GL.ok = false })
    return (GL.ok = true)
  } catch (e) { return (GL.ok = false) }
}
const within = (t, period) => ((t % period) + period) % period / period
function reactorUniforms (t) {
  const loop = within(t, 60), orbit = (k, r, ph) => { const a = TAU * (k * loop + ph); return [r * Math.cos(a), r * Math.sin(a)] }
  return { q: [...orbit(2, 1, 0), ...orbit(-2, .8, .25)], s: [...orbit(3, .55, .5), ...orbit(-3, .45, .75)], ph: within(t, 5), surge: .6 + .4 * Math.pow(.5 + .5 * Math.sin(t * .9), 3) + .25 * Math.pow(.5 + .5 * Math.sin(t * 2.3 + 1.7), 8) }
}
const reactor = {
  init: () => ({ kick: 0 }),
  draw (g, st, t, dt, E) {
    const { W, H, P } = E.geo, col = E.col, A = E.amp
    st.kick = Math.max(st.kick * Math.exp(-dt * 5), E.atk)
    if (!glGet()) { inDisc(g, P, () => { glowDisc(g, 0, 0, 1.4, col, .8 * A); glowDisc(g, 0, 0, .6, hot(col, .6), .6 * A) }); return }
    const gl = GL.g, k = Math.min(GL.W / W, GL.H / H), vw = Math.max(1, Math.round(W * k)), vh = Math.max(1, Math.round(H * k)), U = reactorUniforms(t)
    gl.viewport(0, 0, vw, vh); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform2f(GL.u.res, vw, vh); gl.uniform3f(GL.u.P, P.x * k, vh - P.y * k, P.r * k); gl.uniform3f(GL.u.C, col.r / 255, col.g / 255, col.b / 255)
    gl.uniform4f(GL.u.Q, ...U.q); gl.uniform4f(GL.u.S, ...U.s); gl.uniform1f(GL.u.ph, U.ph)
    gl.uniform1f(GL.u.surge, U.surge * (E.playing ? .7 + .6 * Math.min(1, E.lvl) : 1) + .6 * st.kick); gl.uniform1f(GL.u.amp, A); gl.uniform1f(GL.u.heat, Math.max(1, E.heat))
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    g.drawImage(GL.c, 0, GL.H - vh, vw, vh, 0, 0, W, H)
  }
}

// Valve (new): the amp's own valves, three preamp and four power, behind the cage. They brighten with your level and
// flash blue (the glass's fluorescence) on a hard pick.
const HEATER = { r: 255, g: 122, b: 44 }, BLUE = { r: 110, g: 125, b: 255 }
function envPath (g, x, y, w, h) { const r = w / 2; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + r); g.arc(x + r, y + r, r, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath() }
const valve = {
  init: () => ({ blue: 0, lv: .3 }),
  draw (g, st, t, dt, E) {
    const tubes = E.geo.tubes || [], A = E.amp, glow = mix(HEATER, E.col, .4), R = E.geo.R
    st.blue = Math.max(st.blue * Math.exp(-dt * 6), E.atk > .75 ? E.atk : 0)
    st.lv += ((E.playing ? Math.min(1.1, E.lvl) : .25) - st.lv) * Math.min(1, dt * 10)
    glowDisc(g, R.x + R.w / 2, R.y + R.h * .7, R.w * .6, glow, .24 * A)
    for (const tb of tubes) {
      const { x, y, w, h } = tb, cx = x + w / 2
      const lv = A * (.5 + .5 * st.lv) * (.93 + .07 * Math.sin(t * 23 + x) * Math.sin(t * 7.1 + x * .3))
      glowDisc(g, cx, y + h * .6, w * 1.9, glow, .48 * lv)
      g.globalCompositeOperation = 'source-over'
      envPath(g, x, y, w, h); g.fillStyle = 'rgba(190,200,220,.1)'; g.fill()
      g.save(); envPath(g, x, y, w, h); g.clip()
      const gt = g.createRadialGradient(cx, y + w * .3, 0, cx, y + w * .3, w * .62)
      gt.addColorStop(0, 'rgba(225,228,236,.6)'); gt.addColorStop(.6, 'rgba(150,155,170,.25)'); gt.addColorStop(1, 'rgba(150,155,170,0)')
      g.fillStyle = gt; g.fillRect(x, y, w, w * .9)
      const px = cx - w * .3, py = y + h * .32, pw = w * .6, ph = h * .44
      const pg = g.createLinearGradient(px, 0, px + pw, 0); pg.addColorStop(0, '#16171a'); pg.addColorStop(.5, '#3a3c42'); pg.addColorStop(1, '#141518')
      g.fillStyle = pg; g.fillRect(px, py, pw, ph)
      g.fillStyle = '#0b0b0d'; g.fillRect(px + pw * .2, py + ph, pw * .6, h * .14)
      g.restore()
      g.globalCompositeOperation = 'lighter'
      g.fillStyle = rgba(hot(HEATER, .45), .85 * lv); g.fillRect(cx - .8, py + 2, 1.6, ph - 4)
      glowDisc(g, cx, py - 1, w * .42, HEATER, .95 * lv); glowDisc(g, cx, py + ph + 1, w * .32, HEATER, .7 * lv)
      if (st.blue > .02) { envPath(g, x + 1, y + 1, w - 2, h - 2); g.strokeStyle = rgba(BLUE, .65 * st.blue * A); g.lineWidth = 2.2; g.stroke(); glowDisc(g, cx, py + ph * .5, w * .9, BLUE, .4 * st.blue * A) }
      g.globalCompositeOperation = 'source-over'
      envPath(g, x, y, w, h); g.strokeStyle = 'rgba(255,255,255,.34)'; g.lineWidth = 1.2; g.stroke()
      g.fillStyle = '#121214'; g.fillRect(x - 2, y + h - 3, w + 4, 4)
      g.globalCompositeOperation = 'lighter'
    }
  }
}

// Ferro (new): ferrofluid in a magnetic field, lit from behind. The spikes follow your level and jump on a pick.
const ferro = {
  init: () => ({ kick: 0, lv: .3, sp: Array.from({ length: 24 }, () => ({ ph: Math.random() * TAU, f: .7 + Math.random() * .8 })) }),
  draw (g, st, t, dt, E) {
    const A = E.amp, col = E.col
    st.kick = Math.max(st.kick * Math.exp(-dt * 5), E.atk)
    st.lv += ((E.playing ? Math.min(1.1, E.lvl) : .22 + .08 * Math.sin(t * .8)) - st.lv) * Math.min(1, dt * 8)
    inDisc(g, E.geo.P, u => {
      glowDisc(g, 0, 0, 1.35, col, .85 * A); band(g, .72, .28, hot(col, .25), .5 * A); glowDisc(g, 0, 0, E.geo.ext * .6, col, .06 * A)
      g.globalCompositeOperation = 'source-over'
      const N = st.sp.length, b = .42, H = .1 + .62 * Math.min(1.1, st.lv) + .3 * st.kick
      g.beginPath()
      for (let i = 0; i < N; i++) {
        const sp = st.sp[i], a = i / N * TAU, da = TAU / N
        const h = H * (.55 + .45 * Math.sin(t * sp.f * 2 + sp.ph)) * (.72 + .28 * Math.sin(a * 3 + t * .7))
        const v0 = pol(b, a - da / 2), tip = pol(b + h, a), v1 = pol(b, a + da / 2), c0 = pol(b + h * .16, a - da * .1), c1 = pol(b + h * .16, a + da * .1)
        if (i === 0) g.moveTo(v0[0], v0[1])
        g.quadraticCurveTo(c0[0], c0[1], tip[0], tip[1]); g.quadraticCurveTo(c1[0], c1[1], v1[0], v1[1])
      }
      g.closePath()
      const gr = g.createRadialGradient(-.12, -.15, .04, 0, 0, b + H)
      gr.addColorStop(0, '#2b2b31'); gr.addColorStop(.45, '#0a0a0d'); gr.addColorStop(1, '#000')
      g.fillStyle = gr; g.fill()
      g.globalCompositeOperation = 'lighter'
      g.strokeStyle = rgba(hot(col, .4), .55 * A); g.lineWidth = 1.3 * u; g.stroke()
      glowDisc(g, -.13, -.15, .12, WHITE, .3)
    })
  }
}
const FX = { reactor, pulse, storm, warp, circuit, turbine, lattice, valve, ferro }

// ---------------------------------------------------------------- surfaces: one canvas per new amp, pedal and cabinet
const SURFACES = new Set()
function makeSurface (hw, face) { const canvas = $('canvas.en', face); const s = { hw, face, canvas, g: canvas.getContext('2d'), st: null, geo: null, vis: false, amp: 1, dpr: 1, col: hex2rgb(finFor(kitOf(hw))), t0: Math.random() * 20 }; SURFACES.add(s); return s }
function sizeSurface (s) {
  s.dpr = Math.min(1.75, window.devicePixelRatio || 1)
  s.canvas.width = Math.max(1, Math.round(s.geo.W * s.dpr)); s.canvas.height = Math.max(1, Math.round(s.geo.H * s.dpr))
  s.st = FX[kitOf(s.hw).fx].init()
  if (!moving()) stillSoon()
}
const stageAmp = () => AMP_HW
const ampLevel = hw => hw.classList.contains('on') ? (hw.dataset.standby === 'true' ? .22 : 1) : 0
function drawSurface (s, t, dt) {
  const hw = s.hw, kind = hw.dataset.kind, kit = kitOf(hw)
  const target = kind === 'amp' ? ampLevel(hw) : kind === 'pedal' ? (hw.classList.contains('on') ? 1 : .14) : (stageAmp() ? ampLevel(stageAmp()) : 1)
  s.amp += (target - s.amp) * Math.min(1, dt * 6)
  const inV = hw.__vals.Input ?? hw.__vals.Drive ?? .5, playing = SIG.on && target > .5
  const E = { geo: s.geo, col: s.col, amp: s.amp, playing, lvl: playing ? SIG.level * (.35 + 1.3 * inV) : 0, atk: playing ? SIG.atk * (.5 + inV) : 0, heat: .9 + inV }
  const g = s.g
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, s.canvas.width, s.canvas.height)
  g.setTransform(s.dpr, 0, 0, s.dpr, 0, 0)
  g.globalCompositeOperation = 'lighter'
  FX[kit.fx].draw(g, s.st, t, dt, E)
  g.globalCompositeOperation = 'source-over'
  // the energy's light on the knobs and switches (D-RIG-009 (f))
  s.kick = Math.max((s.kick || 0) * Math.exp(-dt * 6), E.atk)
  const gv = Math.min(1, s.amp * (.3 + .55 * Math.min(1, E.lvl)) + .3 * s.kick)
  if (Math.abs(gv - (s.gv ?? -1)) > .03) { s.gv = gv; hw.style.setProperty('--glow', gv.toFixed(2)) }
}

// ---- the SVG gradients, meshes and filters the controls use by id (lab 807-838)
const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
  <pattern id="mesh-hex" width="12" height="20.785" patternUnits="userSpaceOnUse"><path d="M6 0L12 3.464V10.392L6 13.856L0 10.392V3.464Z M6 13.856V20.785" fill="none" stroke="#0a0a0d" stroke-width="1.1"/><path d="M6 .6L11.4 3.7" fill="none" stroke="rgba(255,255,255,.09)" stroke-width=".5"/></pattern>
  <pattern id="mesh-perf" width="7" height="12.124" patternUnits="userSpaceOnUse"><path fill-rule="evenodd" fill="#0c0c0f" d="M0 0H7V12.124H0Z M-2.75 0a2.75 2.75 0 1 0 5.5 0a2.75 2.75 0 1 0 -5.5 0Z M4.25 0a2.75 2.75 0 1 0 5.5 0a2.75 2.75 0 1 0 -5.5 0Z M0.75 6.062a2.75 2.75 0 1 0 5.5 0a2.75 2.75 0 1 0 -5.5 0Z M-2.75 12.124a2.75 2.75 0 1 0 5.5 0a2.75 2.75 0 1 0 -5.5 0Z M4.25 12.124a2.75 2.75 0 1 0 5.5 0a2.75 2.75 0 1 0 -5.5 0Z"/></pattern>
  <pattern id="mesh-weave" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 1.5H6M0 4.5H6M1.5 0V6M4.5 0V6" stroke="#0b0b0e" stroke-width="1.1"/><path d="M0 1H6M1 0V6" stroke="rgba(255,255,255,.07)" stroke-width=".5"/></pattern>
  <pattern id="mesh-expanded" width="18" height="10" patternUnits="userSpaceOnUse"><path d="M0 5L9 0L18 5L9 10Z" fill="none" stroke="#0c0c0f" stroke-width="1.6"/><path d="M0.8 4.4L9 -.2" fill="none" stroke="rgba(255,255,255,.08)" stroke-width=".6"/></pattern>
  <linearGradient id="chr-v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f8fa"/><stop offset=".45" stop-color="#9aa0a7"/><stop offset=".55" stop-color="#4c5259"/><stop offset="1" stop-color="#d9dde1"/></linearGradient>
  <linearGradient id="chr-d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#8e949b"/><stop offset=".6" stop-color="#3e434a"/><stop offset="1" stop-color="#c9ced3"/></linearGradient>
  <radialGradient id="spin-g" cx=".42" cy=".36" r=".7"><stop offset="0" stop-color="#f5f7fa"/><stop offset=".3" stop-color="#b6bcc4"/><stop offset=".7" stop-color="#5b6169"/><stop offset="1" stop-color="#25282d"/></radialGradient>
  <radialGradient id="bolt-g" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#9aa0a6"/><stop offset="1" stop-color="#3b4046"/></radialGradient>
  <linearGradient id="ck-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient>
  <linearGradient id="glass-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".38" stop-color="#fff" stop-opacity=".03"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="ob-skirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a1a6ad"/><stop offset=".3" stop-color="#454950"/><stop offset=".62" stop-color="#15161a"/><stop offset="1" stop-color="#4d5158"/></linearGradient>
  <radialGradient id="ob-dome" cx=".5" cy=".68" r=".72"><stop offset="0" stop-color="#262830"/><stop offset=".5" stop-color="#0c0d11"/><stop offset="1" stop-color="#010102"/></radialGradient>
  <linearGradient id="ob-soft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".78"/><stop offset="1" stop-color="#fff" stop-opacity=".04"/></linearGradient>
  <linearGradient id="ob-floor" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffd9b0" stop-opacity="0"/><stop offset=".5" stop-color="#ffd9b0" stop-opacity=".24"/><stop offset="1" stop-color="#ffd9b0" stop-opacity="0"/></linearGradient>
  <linearGradient id="ob-fres" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".45" stop-color="#fff" stop-opacity=".02"/><stop offset="1" stop-color="#fff" stop-opacity=".17"/></linearGradient>
  <linearGradient id="sp-blade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#dde1e6"/><stop offset=".42" stop-color="#7f858e"/><stop offset="1" stop-color="#25282d"/></linearGradient>
  <radialGradient id="spin-g2" cx=".38" cy=".32" r=".78"><stop offset="0" stop-color="#ffffff"/><stop offset=".22" stop-color="#c6cbd2"/><stop offset=".58" stop-color="#7a8089"/><stop offset=".88" stop-color="#3a3e45"/><stop offset="1" stop-color="#1e2024"/></radialGradient>
  <radialGradient id="vu-lit" cx=".5" cy=".9" r=".9"><stop offset="0" stop-color="#ffe7a8"/><stop offset=".6" stop-color="#f2c56a"/><stop offset="1" stop-color="#b98a35"/></radialGradient>
  <linearGradient id="fs-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3f5f7"/><stop offset=".3" stop-color="#a7adb4"/><stop offset=".62" stop-color="#454a51"/><stop offset="1" stop-color="#b4bac0"/></linearGradient>
  <radialGradient id="fs-top" cx=".4" cy=".34" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".28" stop-color="#e1e5e9"/><stop offset=".62" stop-color="#a5acb3"/><stop offset=".9" stop-color="#6b7279"/><stop offset="1" stop-color="#555b62"/></radialGradient>
  <linearGradient id="fs-nut" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset=".32" stop-color="#b3b9c0"/><stop offset=".5" stop-color="#e2e5e9"/><stop offset=".72" stop-color="#868c93"/><stop offset="1" stop-color="#c3c8cd"/></linearGradient>
  <filter id="fs-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.8"/></filter>
  <radialGradient id="sbw-c" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#f3f5f7"/><stop offset=".45" stop-color="#b8bec4"/><stop offset=".85" stop-color="#6b7178"/><stop offset="1" stop-color="#4a4f55"/></radialGradient>
  <radialGradient id="sbw-w" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#8e857a"/><stop offset=".45" stop-color="#5d564e"/><stop offset=".85" stop-color="#3a342e"/><stop offset="1" stop-color="#2a2521"/></radialGradient>
  <linearGradient id="sbn-w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a8178"/><stop offset=".32" stop-color="#5a534b"/><stop offset=".5" stop-color="#7d756b"/><stop offset=".72" stop-color="#3f3933"/><stop offset="1" stop-color="#6a6259"/></linearGradient>
  <linearGradient id="sbh-c" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4f555c"/><stop offset=".14" stop-color="#9aa0a7"/><stop offset=".3" stop-color="#f8fafb"/><stop offset=".44" stop-color="#d3d7db"/><stop offset=".7" stop-color="#8a9097"/><stop offset="1" stop-color="#3d4248"/></linearGradient>
  <linearGradient id="sbh-k" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#050506"/><stop offset=".2" stop-color="#2a2c31"/><stop offset=".32" stop-color="#6b6f78"/><stop offset=".55" stop-color="#1f2125"/><stop offset="1" stop-color="#0b0b0d"/></linearGradient>
  <linearGradient id="sbh-w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#262320"/><stop offset=".16" stop-color="#4d4842"/><stop offset=".32" stop-color="#8f887d"/><stop offset=".5" stop-color="#5a544c"/><stop offset=".75" stop-color="#34302b"/><stop offset="1" stop-color="#1c1916"/></linearGradient>
  <radialGradient id="sb-rust"><stop offset="0" stop-color="#8c3e14" stop-opacity=".8"/><stop offset="1" stop-color="#6e2d0c" stop-opacity="0"/></radialGradient>
  <radialGradient id="sb-cap" cx=".35" cy=".3" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs></svg>`

// ================================================================================================= the page's side
// Everything above is the lab's, nearly verbatim. Below: the kit drawn into the page's amp and cabinet, its controls
// bound to Rig's settings, the energy fed from the real input level, power and standby, the finish, and Salvage's
// choices (D-RIG-012..015).

// the finish: a kit's own colours, or the finish the person picked (D-RIG-009 (e): own colours, a finish recolours)
let FINISH = 'own', FIN_COLOR = '#d92b52'
function finFor (kit) { return FINISH === 'own' ? kit.own : FIN_COLOR }

// the observers the lab's hydrate() kept
const ro = new ResizeObserver(es => { for (const e of es) if (e.target.__hw) layoutHW(e.target.__hw) })
const io = new IntersectionObserver(es => { for (const e of es) { const s = e.target.__hw && e.target.__hw.__surf; if (s) s.vis = e.isIntersecting } }, { rootMargin: '120px' })

// The label on each amp control, and the setting it drives.
const PARAM = { Input: 'inputDB', Gate: 'gateThresholdDB', Bass: 'bass', Middle: 'middle', Treble: 'treble', Output: 'outputDB', Size: 'slim' }
const LABEL = Object.fromEntries(Object.entries(PARAM).map(([l, p]) => [p, l]))
const SWITCH = { gate: 'gateOn', eq: 'eqOn', ir: 'irOn' }
const DIMS = { gateOn: ['gateThresholdDB'], eqOn: ['bass', 'middle', 'treble'] }

// The real input's level, standing in for the lab's recorded riff: an envelope in the riff's units (0 to about 1.25,
// 1 near full scale) and a pick's attack, the jump of the fast envelope over a slow one.
const SIG = { on: false, level: 0, atk: 0, slow: 0, lastPick: 0, peak: 0 }
function sigStep (dt, now) {
  const db = SIG.peak > 0 ? 20 * Math.log10(SIG.peak) : -120
  SIG.peak = 0
  const fast = SIG.on ? clamp01((db + 54) / 48) * 1.25 : 0
  SIG.level = Math.max(fast, SIG.level * Math.exp(-dt * 7))
  SIG.atk = 0
  if (SIG.on && fast - SIG.slow > .16 && now - SIG.lastPick > 70) { SIG.atk = Math.min(1.2, fast); SIG.lastPick = now }
  SIG.slow += (fast - SIG.slow) * Math.min(1, dt * 9)
}

let LIVE = []
function collectLive () { LIVE = [...$$('.lp-eye'), ...$$('.lp-vu'), ...$$('.salv-glow'), ...$$('.k-rack .vents')].filter(el => el.closest('.rig-hw')).map(el => ({ el, hw: el.closest('.hw'), nd: el.querySelector('.nd'), v: 0 })) }
function liveStep (dt) {
  for (const L of LIVE) {
    if (!L.el.isConnected || !L.hw.__vals) continue
    const amp = L.hw.dataset.kind === 'amp' ? L.hw : AMP_HW
    const live = amp && ampLevel(amp) > .5 && SIG.on, lv = live ? clamp01(SIG.level * (.35 + 1.3 * (L.hw.__vals.Input ?? .5))) : 0
    L.v += (lv - L.v) * Math.min(1, dt * (lv > L.v ? 18 : 4))
    if (L.nd) L.nd.setAttribute('transform', `rotate(${f1(-46 + 92 * L.v)} 37 52)`)
    else if (L.el.classList.contains('lp-eye')) L.el.style.setProperty('--eye', f1(84 - 76 * L.v) + 'deg')
    else L.el.style.setProperty('--heat', (.5 + .5 * L.v).toFixed(2))
  }
}

// The loop. A still frame when the system asks for less motion (D-RIG-009 (e)), and when nobody is using Rig
// (D-RIG-016 (e)): with nothing playing and no pointer, key, wheel or touch for IDLE_MS, the energy rests on that frame
// and the kits' CSS animations pause, until the next touch or note. The desktop Hub keeps a covered window's pages
// running (SYNC:CLIENT-091), so without this an open Rig would keep a tenth of a core busy all day.
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)')
const IDLE_MS = 30000
let MOTION = !motionQuery.matches, raf = 0, last = 0, T = 0, lastUse = performance.now(), resting = false
const HOLDERS = new Set()
const moving = () => MOTION && !resting
function frame (now) {
  const dt = Math.min(.05, last ? (now - last) / 1000 : .016); last = now; T += dt
  sigStep(dt, now); liveStep(dt)
  for (const s of SURFACES) { if (!s.canvas.isConnected) { SURFACES.delete(s); continue } if (s.vis && s.geo && s.st) drawSurface(s, T + s.t0, dt) }
  if (!SIG.on && now - lastUse > IDLE_MS) { raf = 0; rest(); return }
  raf = MOTION && SURFACES.size + LIVE.length ? requestAnimationFrame(frame) : 0
}
function startLoop () { if (moving() && !raf) { last = 0; raf = requestAnimationFrame(frame) } else if (!moving()) stillSoon() }
function rest () { resting = true; for (const h of HOLDERS) h.classList.add('rest'); still() }
function wake () {
  lastUse = performance.now()
  if (!resting) return
  resting = false
  for (const h of HOLDERS) h.classList.remove('rest')
  startLoop()
}
for (const t of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(t, wake, { capture: true, passive: true })
let stillTimer = 0
function stillSoon () { clearTimeout(stillTimer); stillTimer = setTimeout(still, 60) }
function still () {
  if (moving()) return
  const keep = { ...SIG }
  for (const s of SURFACES) {
    if (!s.geo || !s.canvas.isConnected) continue
    s.st = FX[kitOf(s.hw).fx].init()
    for (let i = 0; i < 48; i++) { SIG.level = SIG.on ? .8 : 0; SIG.atk = SIG.on && i === 40 ? .95 : 0; drawSurface(s, 3 + s.t0 + i / 30, 1 / 30) }
  }
  SIG.level = SIG.on ? .8 : 0; liveStep(1); Object.assign(SIG, keep)
}
motionQuery.addEventListener('change', () => { MOTION = !motionQuery.matches; startLoop() })

// Salvage's sheets: the texture library's photographs (D-RIG-010 (a)), loaded when Salvage is first drawn.
const SALV_IMG = {}, SALV_LOADING = new Set()
function loadSheets () {
  const want = SALV_SHEET === 'mixed' ? SALV_TEX.map(x => x[0]) : [SALV_SHEET, SALV_TEX[(SALV_TEX.findIndex(x => x[0] === SALV_SHEET) + 1) % SALV_TEX.length][0]]
  for (const id of want) {
    if (SALV_IMG[id] || SALV_LOADING.has(id)) continue
    SALV_LOADING.add(id)
    const im = new Image(); im.decoding = 'async'
    im.onload = () => { SALV_IMG[id] = im; resalvage(false) }
    im.src = SALV_TEX.find(x => x[0] === id)[2]
  }
}

let AMP_HW = null, SALV_SEED = 1

/** Salvage's choices for players (D-RIG-012 (b), D-RIG-015): the sheet, the grille, its metal, the glow and the words. */
export const SALVAGE_CHOICES = {
  sheet: [...SALV_TEX.map(x => [x[0], x[1]]), ['mixed', 'Mixed']], mesh: MESH_TYPES, metal: MESH_METALS, glow: GLOWS, words: WORD_STYLES,
}
/** His Salvage setup (D-RIG-015 (b)), the default. */
export const SALVAGE_DEFAULTS = { sheet: 'orange', mesh: 'perf', metal: 'copper', glow: 'valves', words: 'tags' }
/** The kits a player picks from: the classic ones, then the energy kits; CRBN, the owner's, is the default (D-RIG-009 (b)).
 *  `swatch` is the colour a menu shows for the kit: its own, except Salvage, whose own colours are its photographs. */
export const KIT_LIST = KITS.map(k => ({ id: k.id, name: k.name, fam: k.fam, own: k.own, swatch: k.id === 'hammer' ? '#a4562a' : k.own }))
export const DEFAULT_KIT = 'crbn'

/**
 * Draws a kit into the page's amp and cabinet. `spec(param)` gives a setting's {min, max, step, unit, def, text};
 * `change(param, value)` sets one; `toggle(role, on)` turns power or standby.
 */
export function createHardware ({ ampHolder, cabHolder, spec, change, toggle }) {
  if (!document.getElementById('hw-defs')) document.body.insertAdjacentHTML('afterbegin', DEFS.replace('<svg ', '<svg id="hw-defs" '))
  const state = { kit: null, power: true, standby: false, values: {}, capture: ['', ''], ir: ['', ''], slim: false }
  const holders = [ampHolder, cabHolder]
  for (const h of holders) HOLDERS.add(h)
  const both = sel => [...$$(sel, ampHolder), ...$$(sel, cabHolder)]

  function forget () {
    for (const h of holders) {
      for (const el of $$(SALV_SEL, h)) SALV.unobserve(el)
      for (const hw of $$('.hw.new', h)) { if (hw.__face) { ro.unobserve(hw.__face); io.unobserve(hw.__face) } if (hw.__surf) SURFACES.delete(hw.__surf) }
      h.innerHTML = ''
    }
  }
  function hydrate () {
    for (const h of holders) for (const hw of $$('.hw', h)) {
      hw.__vals = {}
      for (const el of $$('[data-label]', hw)) hw.__vals[el.dataset.label] = +el.dataset.v
      if (hw.classList.contains('new')) {
        const face = $('.face, .pface', hw)
        face.__hw = hw; hw.__face = face
        hw.__surf = makeSurface(hw, face)
        ro.observe(face); io.observe(face)
      }
    }
    let i = 0
    for (const h of holders) for (const el of $$(SALV_SEL, h)) { el.__seed = (Math.imul(SALV_SEED, 2654435761) + Math.imul(++i, 40503)) >>> 0 || 1; SALV.observe(el) }
    collectLive()
  }

  function show (id) {
    const kit = KIT[id] || KIT[DEFAULT_KIT]
    if (state.kit === kit.id && ampHolder.firstElementChild) return
    forget()
    state.kit = kit.id
    ampHolder.innerHTML = ampHTML(kit)
    cabHolder.innerHTML = cabHTML(kit)
    AMP_HW = ampHolder.firstElementChild
    // knob cells: the setting each drives, and a readout in the state words' row while it is touched
    for (const kn of $$('.kn, .fd', ampHolder)) {
      const p = PARAM[kn.dataset.label]; if (!p) continue
      kn.dataset.param = p
      const cc = kn.closest('.cc')
      cc.dataset.param = p
      cc.insertAdjacentHTML('beforeend', '<span class="st kv" aria-hidden="true"></span>')
    }
    // the capture's size, shown only for a capture that has one
    const knobs = $('.knobs', ampHolder)
    if (knobs) {
      knobs.insertAdjacentHTML('beforeend', knobCell(kit, 'Size', .5, kit.scale === 'tweed12' ? 'tw' : ''))
      const kn = knobs.lastElementChild.querySelector('.kn')
      kn.dataset.param = 'slim'; knobs.lastElementChild.dataset.param = 'slim'
      knobs.lastElementChild.insertAdjacentHTML('beforeend', '<span class="st kv" aria-hidden="true"></span>')
    }
    for (const sw of both('.sw')) if (SWITCH[sw.dataset.role]) sw.dataset.param = SWITCH[sw.dataset.role]
    if (kit.id === 'hammer') loadSheets()
    hydrate()
    applyFinish()
    for (const [p, v] of Object.entries(state.values)) reflect(p, v)
    setPower(state.power); setStandby(state.standby)
    setCapture(...state.capture); setIR(...state.ir); setSlim(state.slim)
    if (document.fonts?.status !== 'loaded') document.fonts?.ready.then(() => { for (const s of SURFACES) layoutHW(s.hw); for (const el of $$(SALV_SEL)) scheduleSalvage(el) })
    wake(); startLoop()
  }

  function applyFinish () {
    for (const h of holders) for (const hw of $$('.hw', h)) {
      const kit = kitOf(hw); if (!kit) continue
      const fin = finFor(kit), lamp = FINISH === 'own' ? (kit.lamp || kit.own) : fin
      hw.style.setProperty('--fin', fin); hw.style.setProperty('--lampc', lamp)
      hw.style.setProperty('--fin-ink', (1.05) / (lum(fin) + .05) > (lum(fin) + .05) / .05 ? '#ffffff' : '#141414')
      if (hw.__surf) hw.__surf.col = hex2rgb(fin)
    }
    for (const h of holders) for (const el of $$(SALV_SEL, h)) scheduleSalvage(el)
    if (!moving()) stillSoon()
  }
  function setFinish (own, hex) { FINISH = own ? 'own' : 'set'; FIN_COLOR = hex; applyFinish() }

  // a setting's value onto its knob, fader or switch
  function reflect (p, v) {
    state.values[p] = v
    const sp = spec(p)
    if (sp) {
      const t = clamp01((v - sp.min) / (sp.max - sp.min))
      for (const el of $$(`.kn[data-param="${p}"], .fd[data-param="${p}"]`, ampHolder)) {
        el.dataset.v = t
        el.setAttribute('aria-valuemin', sp.min); el.setAttribute('aria-valuemax', sp.max)
        el.setAttribute('aria-valuenow', v); el.setAttribute('aria-valuetext', sp.text(v))
        if (el.classList.contains('fd')) el.style.setProperty('--v', t)
        else {
          el.style.setProperty('--a', ang(t) + 'deg')
          const val = el.parentElement.querySelector('.arc .val'); if (val) val.setAttribute('stroke-dasharray', `${f1(t * 100)} 200`)
        }
        const kv = el.closest('.cc')?.querySelector('.kv'); if (kv) kv.textContent = sp.text(v)
        const hw = el.closest('.hw'); if (hw && hw.__vals) hw.__vals[el.dataset.label] = t
      }
    }
    for (const sw of both(`.sw[data-param="${p}"]`)) {
      const on = v > .5
      sw.setAttribute('aria-pressed', String(on))
      const st = sw.parentElement.querySelector('.st'); if (st && STATE_WORD[sw.dataset.role]) st.textContent = STATE_WORD[sw.dataset.role][on ? 1 : 0]
    }
    for (const q of DIMS[p] ?? []) for (const cc of $$(`.cc[data-param="${q}"]`, ampHolder)) cc.classList.toggle('off', v < .5)
    if (p === 'irOn') cabHolder.firstElementChild?.classList.toggle('ir-off', v < .5)
    if (!moving()) stillSoon()
  }

  function setPower (on) {
    state.power = on
    for (const h of holders) for (const hw of $$('.hw', h)) hw.classList.toggle('on', on)
    for (const sw of $$('.sw[data-role="power"]', ampHolder)) { sw.setAttribute('aria-pressed', String(on)); const st = sw.parentElement.querySelector('.st'); if (st) st.textContent = STATE_WORD.power[on ? 1 : 0] }
    for (const p of $$('[data-pilot]', ampHolder)) p.textContent = on ? 'On' : 'Off'
    if (!moving()) stillSoon()
  }
  function setStandby (standby) {
    state.standby = standby
    if (AMP_HW) AMP_HW.dataset.standby = String(standby)
    for (const sw of $$('.sw[data-role="standby"]', ampHolder)) { sw.setAttribute('aria-pressed', String(!standby)); const st = sw.parentElement.querySelector('.st'); if (st) st.textContent = STATE_WORD.standby[standby ? 0 : 1] }
    if (!moving()) stillSoon()
  }
  function setCapture (name, sub) {
    state.capture = [name, sub]
    const s = $('.gz .sub', ampHolder); if (!s) return
    s.textContent = (state.kit === 'rack' ? 'RG-2 · ' : '') + (name || 'No capture')
    s.title = sub || ''
  }
  function setIR (name, meta) {
    state.ir = [name, meta]
    const b = $('.cplate b', cabHolder), sm = $('.cplate small', cabHolder)
    if (b) b.textContent = name || 'No IR'
    if (sm) sm.textContent = meta || 'Drop a .wav here'
  }
  function setSlim (on) { state.slim = on; for (const cc of $$('.cc[data-param="slim"]', ampHolder)) cc.hidden = !on }

  /** The input's peak since the last frame (after the input gain), and whether anything is playing. */
  function level (peak, playing) { SIG.on = playing; SIG.peak = Math.max(SIG.peak, peak); if (playing) wake() }

  let salvKey = ''
  function setSalvage (c, seed) {
    for (const k of Object.keys(SALVAGE_DEFAULTS)) setSalv(k, c[k])
    if (seed) SALV_SEED = seed
    document.documentElement.dataset.salvWords = SALV_WORDS
    for (const g of $$('.salv-glow')) g.dataset.glow = SALV_GLOW
    // the words' style needs no repaint; anything else draws new pieces
    const key = JSON.stringify([SALV_SHEET, SALV_MESH, SALV_METAL, SALV_GLOW, SALV_SEED, state.kit])
    if (key === salvKey) return
    salvKey = key
    if (state.kit === 'hammer') {
      loadSheets()
      let i = 0
      for (const h of holders) for (const el of $$(SALV_SEL, h)) el.__seed = (Math.imul(SALV_SEED, 2654435761) + Math.imul(++i, 40503)) >>> 0 || 1
      resalvage(false)
    }
  }

  // ---- the controls: drag, wheel and keys on a knob or fader; a click on a switch
  let drag = null
  const valueOf = (el, t) => { const sp = spec(el.dataset.param); return sp.min + clamp01(t) * (sp.max - sp.min) }
  function onDown (e) {
    const el = e.target.closest('.kn[data-param], .fd[data-param]'); if (!el || e.button !== 0) return
    e.preventDefault(); el.focus({ preventScroll: true })
    drag = { el, y: e.clientY, v: +el.dataset.v, span: el.classList.contains('fd') ? el.clientHeight - 21 : 150 }
    el.setPointerCapture(e.pointerId); el.closest('.cc')?.classList.add('drag')
  }
  function onMove (e) { if (drag) change(drag.el.dataset.param, valueOf(drag.el, drag.v + (drag.y - e.clientY) / drag.span * (e.shiftKey ? .1 : 1))) }
  function onUp () { if (drag) drag.el.closest('.cc')?.classList.remove('drag'); drag = null }
  function onKey (e) {
    const el = e.target.closest?.('.kn[data-param], .fd[data-param]'); if (!el) return
    const sp = spec(el.dataset.param), v = state.values[el.dataset.param] ?? sp.def, big = (sp.max - sp.min) / 10
    const d = { ArrowUp: sp.step * 10, ArrowRight: sp.step * 10, ArrowDown: -sp.step * 10, ArrowLeft: -sp.step * 10, PageUp: big, PageDown: -big }[e.key]
    if (d !== undefined) change(el.dataset.param, v + (e.shiftKey ? d / 10 : d))
    else if (e.key === 'Home') change(el.dataset.param, sp.min)
    else if (e.key === 'End') change(el.dataset.param, sp.max)
    else return
    e.preventDefault()
  }
  function onWheel (e) {
    const el = e.target.closest('.kn[data-param], .fd[data-param]'); if (!el) return
    e.preventDefault()
    const sp = spec(el.dataset.param)
    change(el.dataset.param, (state.values[el.dataset.param] ?? sp.def) + Math.sign(-e.deltaY) * sp.step * (e.shiftKey ? 1 : 10))
  }
  function onDbl (e) { const el = e.target.closest('.kn[data-param], .fd[data-param]'); if (el) change(el.dataset.param, spec(el.dataset.param).def) }
  function onClick (e) {
    const sw = e.target.closest('.sw'); if (!sw) return
    const role = sw.dataset.role, on = sw.getAttribute('aria-pressed') !== 'true'
    if (sw.dataset.param) change(sw.dataset.param, on ? 1 : 0)
    else if (role === 'power' || role === 'standby') toggle(role, on)
  }
  for (const h of holders) {
    h.addEventListener('pointerdown', onDown); h.addEventListener('pointermove', onMove)
    h.addEventListener('pointerup', onUp); h.addEventListener('pointercancel', onUp)
    h.addEventListener('keydown', onKey); h.addEventListener('wheel', onWheel, { passive: false })
    h.addEventListener('dblclick', onDbl); h.addEventListener('click', onClick)
  }

  return {
    show, reflect, setFinish, setPower, setStandby, setCapture, setIR, setSlim, level, setSalvage,
    get kit () { return state.kit },
    /** New crops for every Salvage piece; returns the new seed to keep. */
    shuffle () { SALV_SEED = (Math.random() * 1e9) | 0 || 1; setSalvage(salvCur(), SALV_SEED); return SALV_SEED },
    /** How many energy surfaces are drawing (for the checks). */
    surfaces () { return [...SURFACES].filter(s => s.geo && s.st).length },
  }
}
