// Headless Edge for the repo's scripts (the icon render, the web check), started with a profile of its own and stopped
// by that profile. On Windows Edge's launcher hands off to a browser process outside its own tree, so killing the
// process we spawned (or its tree) leaves dozens of processes holding the profile; they are found by the profile path
// on their command line instead. Node built-ins only.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

export const DEFAULT_EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

/**
 * A screenshot of `url` at `width` x `height` pixels into `file`. The page is laid out at `scale` times smaller and
 * drawn at `scale`, so text reads as on a laptop screen; `transparent` keeps the page's transparent background.
 * Edge's --screenshot returns before the file is written, so this waits until it exists and stops growing.
 */
export async function screenshot(url, file, { width = 1920, height = 1080, scale = 1, transparent = false, edge = DEFAULT_EDGE } = {}) {
  rmSync(file, { force: true })
  const browser = startHeadlessEdge(url, {
    edge,
    args: ['--hide-scrollbars', `--window-size=${Math.round(width / scale)},${Math.round(height / scale)}`, `--force-device-scale-factor=${scale}`,
      '--virtual-time-budget=6000', `--screenshot=${file}`, ...(transparent ? ['--default-background-color=00000000'] : [])],
  })
  let last = -1
  try {
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 250))
      if (existsSync(file)) { const s = statSync(file).size; if (s > 0 && s === last) break; last = s }
    }
  } finally { await browser.stop() }
  if (!existsSync(file)) throw new Error(`no screenshot of ${url}`)
}

/** Opens `url` in a headless Edge with a fresh profile. Returns { stop }, which ends every process of that profile. */
export function startHeadlessEdge(url, { edge = DEFAULT_EDGE, args = [] } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'crbn-rig-edge-'))
  const child = spawn(edge, ['--headless', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, ...args, url], { stdio: 'ignore' })
  child.on('error', () => {})
  return {
    profile,
    async stop() {
      if (process.platform === 'win32') {
        const tag = basename(profile).replace(/'/g, '')
        spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
          `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${tag}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`],
          { stdio: 'ignore' })
      } else {
        child.kill()
      }
      await new Promise((ok) => setTimeout(ok, 500))
      try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }) } catch { console.warn(`left ${profile}`) }
    },
  }
}
