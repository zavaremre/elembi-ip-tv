import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export interface Config {
  TMDB_TOKEN: string
  TMDB_KEY: string
  TMDB_LANG: string
  TMDB_REGION: string
  XTREAM_HOST: string
  XTREAM_USER: string
  XTREAM_PASS: string
  XTREAM_OUTPUT: string
  OPENSUBTITLES_KEY: string
  OPENSUBTITLES_USER: string
  OPENSUBTITLES_PASS: string
  EXTERNAL_PLAYER: string
}

const DEFAULTS: Config = {
  TMDB_TOKEN: '',
  TMDB_KEY: '',
  TMDB_LANG: 'tr-TR',
  TMDB_REGION: 'TR',
  XTREAM_HOST: '',
  XTREAM_USER: '',
  XTREAM_PASS: '',
  XTREAM_OUTPUT: 'hls',
  OPENSUBTITLES_KEY: '',
  OPENSUBTITLES_USER: '',
  OPENSUBTITLES_PASS: '',
  /** Chromium cannot switch audio tracks in progressive files; this player can. */
  EXTERNAL_PLAYER: 'VLC'
}

function parseEnv(text: string): Partial<Config> {
  const out: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
  return out as Partial<Config>
}

/** Precedence: userData/config.json > project .env > process.env > defaults. */
function load(): Config {
  const fromEnvFile = (() => {
    for (const p of [resolve(process.cwd(), '.env'), join(app.getAppPath(), '.env')]) {
      if (existsSync(p)) return parseEnv(readFileSync(p, 'utf8'))
    }
    return {}
  })()

  const userFile = join(app.getPath('userData'), 'config.json')
  const fromUser = existsSync(userFile)
    ? (JSON.parse(readFileSync(userFile, 'utf8')) as Partial<Config>)
    : {}

  const fromProcess: Partial<Config> = {}
  for (const k of Object.keys(DEFAULTS) as (keyof Config)[]) {
    const v = process.env[k]
    if (v) fromProcess[k] = v
  }

  return { ...DEFAULTS, ...fromEnvFile, ...fromProcess, ...fromUser }
}

let cache: Config | null = null

export function config(): Config {
  if (!cache) cache = load()
  return cache
}

export function patchConfig(patch: Partial<Config>): Config {
  const next = { ...config(), ...patch }
  cache = next
  const userFile = join(app.getPath('userData'), 'config.json')
  const { TMDB_TOKEN: _t, TMDB_KEY: _k, ...persist } = next
  writeFileSync(userFile, JSON.stringify({ ...persist, TMDB_TOKEN: _t, TMDB_KEY: _k }, null, 2))
  return next
}
