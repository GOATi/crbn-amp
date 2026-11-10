// Headless Edge for the repo's scripts (the icon render, the web check), started with a profile of its own and stopped
// by that profile. On Windows Edge's launcher hands off to a browser process outside its own tree, so killing the
// process we spawned (or its tree) leaves dozens of processes holding the profile; they are found by the profile path
// on their command line instead. Node built-ins only.
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

export const DEFAULT_EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

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
