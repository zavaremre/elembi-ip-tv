#!/usr/bin/env node
/*
 * Puts ffmpeg and ffprobe where the packager can find them, for one target.
 *
 * The player needs ffmpeg for three things Chromium cannot do: read a file's
 * track list, decode AC-3 and its relatives, and seek inside Matroska. Asking
 * every viewer to install it first was the old answer, and it failed quietly —
 * the tracks menu reported one audio track for a file nothing had opened.
 *
 * Each platform gets the answer that suits it:
 *
 *   macOS   builds from source. Every prebuilt worth downloading is configured
 *           --enable-nonfree, which FFmpeg's own terms forbid redistributing,
 *           and the one project that publishes clean LGPL builds does not do
 *           macOS. Ours comes to 42 MB because it carries no library we never
 *           call; see build-ffmpeg-macos.sh.
 *
 *   Windows takes BtbN's LGPL build. Compiling there means MSYS2, and this is
 *           the platform whose viewers are least likely to have ffmpeg already
 *           or a package manager to get it with.
 *
 *   Linux   gets nothing from us. Bundling libraries is the wrong move on a
 *           platform built around shared ones, and every distribution ships
 *           ffmpeg a command away, built against its own codecs. The .deb
 *           declares the dependency and the AppImage falls back to the system
 *           binary, the way the app already did everywhere.
 *
 * Usage: prepare-ffmpeg.mjs --platform=darwin --arch=arm64 [--out=DIR]
 */

import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/* Pinned, because a release should be able to say which ffmpeg it shipped. */
const BTBN_TAG = 'latest'
const BTBN_BUILD = 'ffmpeg-n8.1-latest-win64-lgpl-shared-8.1'
const BTBN_BASE = `https://github.com/BtbN/FFmpeg-Builds/releases/download/${BTBN_TAG}`

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)
const platform = args.platform ?? process.platform

/*
 * Which architectures the packager builds for each platform, so one call before
 * `electron-builder` covers the run. macOS produces a dmg per architecture from
 * the same machine, and missing one leaves an app whose ffmpeg cannot run.
 */
const TARGET_ARCHES = { darwin: ['arm64', 'x64'], win32: ['x64'], linux: [] }
const arches = args.arch ? [args.arch] : (TARGET_ARCHES[platform] ?? [process.arch])

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} ${result.status} ile çıktı`)
}

async function download(url, to) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`)
  writeFileSync(to, Buffer.from(await response.arrayBuffer()))
}

/* BtbN publishes one checksum file for the whole release, not one per asset. */
async function expectedSha(name) {
  const response = await fetch(`${BTBN_BASE}/checksums.sha256`, { redirect: 'follow' })
  if (!response.ok) throw new Error(`checksums.sha256 → HTTP ${response.status}`)
  const line = (await response.text()).split('\n').find((l) => l.trim().endsWith(name))
  if (!line) throw new Error(`${name} checksums.sha256 içinde yok`)
  return line.trim().split(/\s+/)[0]
}

async function windows(out) {
  const archive = `${BTBN_BUILD}.zip`
  const work = mkdtempSync(join(tmpdir(), 'ffmpeg-'))
  try {
    const zip = join(work, archive)
    console.log(`==> ${archive} indiriliyor`)
    await download(`${BTBN_BASE}/${archive}`, zip)

    const want = await expectedSha(archive)
    const got = createHash('sha256').update(readFileSync(zip)).digest('hex')
    if (got !== want) throw new Error(`sha256 tutmadı: ${got} ≠ ${want}`)
    console.log('==> sha256 doğrulandı')

    /* bsdtar reads zip as well as tar, and ships with Windows and the runners. */
    run('tar', ['-xf', zip, '-C', work])

    const bin = join(work, BTBN_BUILD, 'bin')
    mkdirSync(out, { recursive: true })
    for (const file of readdirSync(bin)) {
      /* The DLLs are what ffmpeg.exe imports, so they travel with it. ffplay
         is a player we never launch, and 18 MB of one. */
      if (file === 'ffplay.exe') continue
      if (file.endsWith('.dll') || file === 'ffmpeg.exe' || file === 'ffprobe.exe') {
        cpSync(join(bin, file), join(out, file))
      }
    }
    cpSync(join(work, BTBN_BUILD, 'LICENSE.txt'), join(out, 'LICENSE'))
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

function macos(arch, out) {
  const script = join(ROOT, 'scripts', 'build-ffmpeg-macos.sh')
  run('bash', [script, arch === 'arm64' ? 'arm64' : 'x86_64', out])
}

function report(out) {
  const files = readdirSync(out)
  const total = files.reduce((sum, f) => sum + readFileSync(join(out, f)).length, 0)
  console.log(`==> ${out}: ${files.length} dosya, ${(total / 1048576).toFixed(1)} MB`)
}

if (platform === 'linux') {
  console.log('==> linux: ffmpeg sistemden gelir, paketlenmiyor')
}

for (const arch of arches) {
  const out = args.out ?? join(ROOT, 'resources', 'ffmpeg', `${platform}-${arch}`)
  if (existsSync(join(out, platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'))) {
    console.log(`==> ${out} zaten hazır`)
  } else if (platform === 'darwin') {
    macos(arch, out)
  } else if (platform === 'win32') {
    await windows(out)
  } else {
    throw new Error(`desteklenmeyen platform: ${platform}`)
  }
  report(out)
}
