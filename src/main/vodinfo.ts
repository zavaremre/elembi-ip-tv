import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { config } from './config'
import type { AudioVariant } from '../shared/types'

/*
 * Deliberately gentle: this endpoint answers one id per request, and asking for
 * a whole page at once looks like scraping to the panel, which can get the
 * address blocked. The burst only happens the first time a title is seen — the
 * answer is kept on disk — so a slow pass costs nothing afterwards.
 *
 * Every pending id is looked up, never a slice of them: the renderer marks them
 * all as asked before the call and never retries, so anything dropped here would
 * sit unresolved on screen for good.
 */
const CONCURRENCY = 2
const GAP_MS = 150
const TIMEOUT_MS = 10_000
/** A file's audio track does not change, so hits are kept for a long time. */
const HIT_TTL_MS = 60 * 24 * 3600_000
const MISS_TTL_MS = 7 * 24 * 3600_000

const TURKISH = new Set(['tur', 'tr', 'turkish', 'tur-tr'])
const UNKNOWN = new Set(['und', 'unknown', 'mis', 'zxx', ''])

export interface AudioInfo {
  language: string | null
  variant: AudioVariant
}

interface CacheRow extends AudioInfo {
  at: number
}

let cache: Record<string, CacheRow> | null = null
const file = (): string => join(app.getPath('userData'), 'vod-audio.json')

function read(): Record<string, CacheRow> {
  if (cache) return cache
  try {
    cache = existsSync(file()) ? (JSON.parse(readFileSync(file(), 'utf8')) as Record<string, CacheRow>) : {}
  } catch {
    cache = {}
  }
  return cache
}

function persist(): void {
  try {
    writeFileSync(file(), JSON.stringify(read()))
  } catch {
    /* a failed cache write must not break the listing */
  }
}

/**
 * The panel exposes only the primary audio stream, so a Turkish track means the
 * release is dubbed, and any other known language means original audio with
 * subtitles. Unknown or untagged files get no badge rather than a guess.
 */
function toVariant(language: string | null): AudioVariant {
  if (!language) return null
  const code = language.toLowerCase().trim()
  if (UNKNOWN.has(code)) return null
  if (TURKISH.has(code)) return 'dub'
  return 'sub'
}

async function lookup(id: number): Promise<AudioInfo> {
  const { XTREAM_HOST, XTREAM_USER, XTREAM_PASS } = config()
  const url = new URL('/player_api.php', XTREAM_HOST)
  url.searchParams.set('username', XTREAM_USER)
  url.searchParams.set('password', XTREAM_PASS)
  url.searchParams.set('action', 'get_vod_info')
  url.searchParams.set('vod_id', String(id))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return { language: null, variant: null }
    const body = (await res.json()) as { info?: { audio?: { tags?: { language?: string } } } }
    const language = body.info?.audio?.tags?.language ?? null
    return { language, variant: toVariant(language) }
  } catch {
    return { language: null, variant: null }
  } finally {
    clearTimeout(timer)
  }
}

/** Audio language per VOD id, filled in progressively and cached on disk. */
export async function audioInfo(ids: number[]): Promise<Record<number, AudioInfo>> {
  const store = read()
  const now = Date.now()
  const out: Record<number, AudioInfo> = {}
  const pending: number[] = []

  for (const id of [...new Set(ids)]) {
    const row = store[id]
    const ttl = row?.variant ? HIT_TTL_MS : MISS_TTL_MS
    if (row && now - row.at < ttl) out[id] = { language: row.language, variant: row.variant }
    else pending.push(id)
  }

  let index = 0
  let changed = false
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, pending.length) }, async () => {
      while (index < pending.length) {
        const id = pending[index++]
        const info = await lookup(id)
        store[id] = { ...info, at: Date.now() }
        out[id] = info
        changed = true
        await new Promise((resolve) => setTimeout(resolve, GAP_MS))
      }
    })
  )

  if (changed) persist()
  return out
}
