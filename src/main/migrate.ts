import { app } from 'electron'
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Carries the app's own files over from the folder the previous name used.
 *
 * Electron derives userData from the product name, so renaming the app points
 * it at an empty directory: the subscription, the catalogue and the viewer's
 * favourites would all appear to have vanished. Only this app's files are
 * moved — Chromium's caches live in the same folder, run to hundreds of
 * megabytes, and rebuild themselves.
 */

const LEGACY_NAMES = ['akis', 'Akış']

/** Written by this app, as opposed to by Chromium. */
const OWN_FILES = [
  'config.json',
  'state.json',
  'artwork.json',
  'catalog-channels.json',
  'catalog-vod.json',
  'catalog-series.json',
  'vod-audio.json',
  'xmltv-cache.json',
  'team-badges.json'
]
const OWN_DIRS = ['subtitles']

export function migrateUserData(): void {
  const dir = app.getPath('userData')
  /* A config already here means this folder has been used; leave it alone. */
  if (existsSync(join(dir, 'config.json'))) return

  const parent = dirname(dir)
  const legacy = LEGACY_NAMES.map((name) => join(parent, name)).find(
    (path) => path !== dir && existsSync(join(path, 'config.json'))
  )
  if (!legacy) return

  mkdirSync(dir, { recursive: true })
  let moved = 0
  for (const name of OWN_FILES) {
    const from = join(legacy, name)
    if (!existsSync(from)) continue
    copyFileSync(from, join(dir, name))
    moved++
  }
  for (const name of OWN_DIRS) {
    const from = join(legacy, name)
    if (!existsSync(from) || readdirSync(from).length === 0) continue
    cpSync(from, join(dir, name), { recursive: true })
    moved++
  }
  /* Copied rather than moved: if anything here is wrong the old folder is
     still whole, and it costs a few megabytes to keep that option. */
  process.stdout.write(`  taşındı: ${moved} öğe, ${legacy} → ${dir}\n`)
}
