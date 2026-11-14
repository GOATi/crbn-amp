// CRBN Rig's MC8 bank (build plan R7, the owner's review of 2026-11-14): Rig writes a Morningstar MC8 bank from its
// MIDI mappings, so the controller's switches send what Rig has learned and its screen names them as Rig does.
//
// The file is the MC8 Editor's own "Current Bank" backup, which its Controller Backup tab restores into the bank being
// edited. Morningstar does not document it; this follows the owner's own backups of his original MC8 (firmware 3.13's
// editor): `{ schemaVersion: 1, dumpType: 'singleBank', deviceModel: 4, downloadDate, hash, data: { bank }, description }`,
// where `hash` is Java's String.hashCode of JSON.stringify(data), reproduced on both of his files. A bank holds 16
// bank messages, 22 presets (A to P are the eight switches on two pages) and 4 expression presets, each with 16
// messages; a message is { d1, d2, d3, d4, m (its place), c (channel 1 to 16), t (type), a (action), tg (toggle
// position), mi }, and keys keep this order. On a switch, t 1 is a Program Change (d1 its number) and t 2 a CC (d1 its
// number, d2 its value); a 1 is a press and a 2 a release; tg 2 is both toggle positions. On an expression preset, t 1 is
// a CC from d2 (heel) to d3 (toe). Only Program Changes and CCs are written: that is what his banks use.
import { isKnob, isSwitch, describeMsg } from './midi.js'

export const MC8 = { model: 4, banks: 30, switches: 16, presets: 22, exps: 4, msgs: 16, short: 8, long: 20, bankName: 16 }
export const LETTERS = 'ABCDEFGHIJKLMNOP'

/** Java's String.hashCode, as the MC8 Editor checks a backup with. */
export function mc8Hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return h
}
/** Words the MC8 can show: plain ASCII (the editor mangles the rest), at most `n` characters. */
export function ascii(s, n) {
  return String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[♯]/g, '#').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim().slice(0, n).trim()
}

const msg = (m, { d1 = 0, d2 = 0, d3 = 0, c = 1, t = 0, a = 0, tg = 2 } = {}) => ({ d1, d2, d3, d4: 0, m, c, t, a, tg, mi: '' })
const sixteen = (list, tg) => Array.from({ length: MC8.msgs }, (_, m) => (list[m] ? msg(m, { ...list[m], tg: list[m].tg ?? tg }) : msg(m, { tg })))
const preset = (presetNum, bankNum, { short = 'EMPTY', toggle = short, long = '', msgs = [] } = {}) => ({
  presetNum, bankNum, isExp: false, shortName: short, toggleName: toggle, longName: long, toToggle: false, toBlink: false, toMsgScroll: false, toggleGroup: 0, msgArray: sixteen(msgs, 2),
})
const exp = (presetNum, bankNum, { long = '', msgs = [] } = {}) => ({
  presetNum, bankNum, isExp: true, shortName: 'EXPRN', toggleName: 'EXPRN', longName: long, toToggle: false, toBlink: false, toMsgScroll: false, toggleGroup: 0, msgArray: sixteen(msgs, 0),
})

/** The MC8 Editor's Current Bank file for `bank` (as `planBank` makes it). */
export function bankFile(bank, now = new Date()) {
  const data = { bank }
  return JSON.stringify({ schemaVersion: 1, dumpType: 'singleBank', deviceModel: MC8.model, downloadDate: now.toISOString(), hash: mc8Hash(JSON.stringify(data)), data, description: 'Made by CRBN Rig' })
}

/** Reads an MC8 Editor backup (Current Bank or All Banks): { kind, banks }, or throws with words for the person. */
export function readBackup(text) {
  let j
  try { j = JSON.parse(text) } catch { throw new Error('That is not an MC8 Editor backup (it is not JSON).') }
  if (j?.schemaVersion !== 1 || !j.data) throw new Error('That is not an MC8 Editor backup.')
  if (j.deviceModel !== MC8.model) throw new Error(`That backup is from another Morningstar model (${j.deviceModel}), not the MC8.`)
  const banks = j.dumpType === 'singleBank' ? [j.data.bank] : j.dumpType === 'allBanks' ? j.data.bankArray : null
  if (!Array.isArray(banks) || !banks.every((b) => Array.isArray(b?.presetArray))) throw new Error('That MC8 backup holds no banks.')
  return { kind: j.dumpType, banks, hashOk: mc8Hash(JSON.stringify(j.data)) === j.hash }
}

// What each control is called on the MC8's screen (eight characters) and in its long name.
function names(t, label) {
  const { name, sub } = label(t)
  const keys = { variant: ['Q', 'W', 'E'], pad: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] }
  const short = {
    stomp: () => `PEDAL ${t.p + 1}`, standby: () => 'STANDBY', power: () => 'POWER', variant: () => `VAR ${keys.variant[t.i]}`,
    pad: () => `FAV ${keys.pad[t.i]}`, next: () => 'FAV >', prev: () => '< FAV', last: () => 'LAST 2', rig: () => ascii(name.replace(/^Rig: /, ''), MC8.short).toUpperCase(),
    switch: () => ({ gateOn: 'GATE', eqOn: 'EQ', irOn: 'CAB IR', guardOn: 'GUARD', autoOff: 'AUTO OFF', calibrateInput: 'CALIB' })[t.param] ?? (/^pedalToneOn(\d)$/.exec(t.param) ? `P${t.param.slice(-1)} TONE` : ascii(name, MC8.short).toUpperCase()),
  }[t.kind]?.() ?? ascii(name, MC8.short).toUpperCase()
  const long = ascii(sub && t.kind !== 'standby' ? `${name}: ${sub}` : name, MC8.long)
  return { short: ascii(short, MC8.short) || 'RIG', long }
}
// Where a control goes on the MC8, as it sits on the floor: the pedals' footswitches on the bottom row (A to D) like a
// pedalboard, the variants and Standby above them (E to H), the favourites on page 2 (I to P); the rest where there is room.
function wants(t) {
  if (t.kind === 'stomp') return t.p
  if (t.kind === 'variant') return 4 + t.i
  if (t.kind === 'standby') return 7
  if (t.kind === 'pad' && t.i < 8) return 8 + t.i
  return -1
}

/**
 * The bank Rig writes for `maps` (midi.js's mappings): { bank, switches, exps, skipped }.
 * @param label (target) => { name, sub }, as the dock names a control
 * @param bankIndex the MC8 bank it is for, 0 to 29 (the editor shows 1 to 30)
 */
export function planBank(maps, { label, bankIndex = 0, name = 'CRBN Rig' } = {}) {
  const switches = Array(MC8.switches).fill(null), exps = [], skipped = []
  const wantsMsg = (m) => m.msg.type === 'cc' || m.msg.type === 'pc'
  const order = [...maps].sort((a, b) => (wants(b.target) >= 0) - (wants(a.target) >= 0))
  for (const m of order) {
    const nm = names(m.target, label)
    if (!wantsMsg(m)) { skipped.push({ name: label(m.target).name, why: `${describeMsg(m.msg)}: the bank is written with CCs and Program Changes only` }); continue }
    if (isKnob(m.target)) {
      if (m.msg.type !== 'cc') continue
      if (exps.length >= MC8.exps) { skipped.push({ name: label(m.target).name, why: 'the MC8 has four expression inputs' }); continue }
      exps.push({ map: m, long: nm.long, msgs: [{ t: 1, d1: m.msg.num, d2: 0, d3: 127, c: m.msg.ch }] })
      continue
    }
    const msgs = m.msg.type === 'pc' ? [{ t: 1, a: 1, d1: m.msg.num, c: m.msg.ch }]
      : isSwitch(m.target) && m.mode === 'momentary' ? [{ t: 2, a: 1, d1: m.msg.num, d2: 127, c: m.msg.ch }, { t: 2, a: 2, d1: m.msg.num, d2: 0, c: m.msg.ch }]
        : [{ t: 2, a: 1, d1: m.msg.num, d2: 127, c: m.msg.ch }]
    let at = wants(m.target)
    if (at < 0 || switches[at]) at = switches.indexOf(null)
    if (at < 0) { skipped.push({ name: label(m.target).name, why: 'the MC8’s sixteen switches are all taken' }); continue }
    switches[at] = { map: m, ...nm, msgs }
  }
  const b = Math.max(0, Math.min(MC8.banks - 1, Math.trunc(bankIndex) || 0))
  const bank = {
    bankNumber: b, bankName: ascii(name, MC8.bankName) || 'CRBN Rig', bankClearToggle: false,
    bankMsgArray: sixteen([], 0),
    presetArray: Array.from({ length: MC8.presets }, (_, i) => preset(i, b, switches[i] ? { short: switches[i].short, long: switches[i].long, msgs: switches[i].msgs } : {})),
    expPresetArray: Array.from({ length: MC8.exps }, (_, i) => exp(i, b, exps[i] ?? {})),
  }
  return {
    bank,
    switches: switches.map((s, i) => (s ? { letter: LETTERS[i], short: s.short, long: s.long, msg: describeMsg(s.map.msg), mode: s.map.mode, kind: s.map.msg.type } : { letter: LETTERS[i] })),
    exps: exps.map((e, i) => ({ n: i + 1, long: e.long, msg: describeMsg(e.map.msg) })),
    skipped,
  }
}

// ------------------------------------------------------------------------------------------------- the dialog
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c])
const BANK_KEY = 'crbn-rig/mc8-bank'

/**
 * The MC8 bank dialog: which bank it is for (chosen, never guessed, since the file replaces that bank), its name, the
 * switches as they will read on the floor, and the file saved.
 * @param maps  () => midi.js's mappings
 * @param label (target) => { name, sub }
 * @param rigName () => the rig's name, the bank's name to begin with
 * @param save  (fileName, text) => a Promise of 'saved' | 'downloaded' | 'cancelled' | 'failed'
 */
export function createMc8Dialog({ dialog, maps, label, rigName, save, onSaved = () => {} }) {
  const $ = (s) => dialog.querySelector(s)
  const pick = $('#mc8-bank'), nameIn = $('#mc8-name')
  pick.insertAdjacentHTML('beforeend', Array.from({ length: MC8.banks }, (_, i) => `<option value="${i}">Bank ${i + 1}</option>`).join(''))
  let plan = null
  const cell = (s) => `<div class="mc8-sw${s.short ? '' : ' empty'}"><i>${s.letter}</i><b>${esc(s.short ?? 'EMPTY')}</b>` +
    (s.short ? `<small title="${esc(s.long)}">${esc(s.msg)}${s.mode === 'momentary' && s.kind === 'cc' ? ' · held' : ''}</small>` : '') + '</div>'
  function render() {
    const bankIndex = pick.value === '' ? 0 : Number(pick.value)
    plan = planBank(maps(), { label, bankIndex, name: nameIn.value || rigName() })
    const sw = plan.switches
    // as the MC8 sits on the floor: E to H above A to D; page 2 is I to P
    const page = (n, top, bottom) => `<section class="mc8-page"><h3>Page ${n}</h3><div class="mc8-grid">${[...top, ...bottom].map((i) => cell(sw[i])).join('')}</div></section>`
    $('#mc8-pages').innerHTML = page(1, [4, 5, 6, 7], [0, 1, 2, 3]) + page(2, [12, 13, 14, 15], [8, 9, 10, 11])
    $('#mc8-exp').textContent = plan.exps.length ? plan.exps.map((e) => `Expression ${e.n}: ${e.long} (${e.msg})`).join('; ') : 'No knob is mapped to a pedal, so the bank’s expression inputs send nothing.'
    $('#mc8-skip').innerHTML = plan.skipped.map((s) => `<li>Not in the bank: <b>${esc(s.name)}</b>, ${esc(s.why)}.</li>`).join('')
    $('.mc8-n').textContent = pick.value === '' ? '…' : String(bankIndex + 1)
    $('#mc8-save').disabled = pick.value === '' || !maps().length
  }
  pick.addEventListener('change', () => { try { localStorage.setItem(BANK_KEY, pick.value) } catch { /* none */ } render() })
  nameIn.addEventListener('input', render)
  $('#mc8-save').addEventListener('click', async () => {
    if (!plan || pick.value === '') return
    const n = Number(pick.value) + 1, file = `CRBN Rig MC8 bank ${n} - ${ascii(plan.bank.bankName, 40).replace(/[\/:*?"<>|]/g, '')}.json`
    const how = await save(file, bankFile(plan.bank))
    if (how === 'saved' || how === 'downloaded') { dialog.close(); onSaved(file, how, n) }
  })
  return {
    open() {
      let last = ''
      try { last = localStorage.getItem(BANK_KEY) ?? '' } catch { /* none */ }
      pick.value = /^\d+$/.test(last) && Number(last) < MC8.banks ? last : ''
      nameIn.value = ascii(rigName(), MC8.bankName)
      render()
      dialog.showModal()
    },
    get plan() { return plan },
  }
}
