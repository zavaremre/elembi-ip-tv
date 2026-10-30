import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { config } from './config'
import { getJson } from './http'
import { parseTitle, sameTitle } from '../shared/title'
import type { ArtworkRequest } from '../shared/types'

const BASE = 'https://api.themoviedb.org/3'
const CONCURRENCY = 6
const HIT_TTL_MS = 30 * 24 * 3600_000
const MISS_TTL_MS = 7 * 24 * 3600_000
const YEAR_TOLERANCE = 1

interface CacheRow {
  poster: string | null
  at: number
}

let cache: Record<string, CacheRow> | null = null
const file = (): string => join(app.getPath('userData'), 'artwork.json')

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

interface RawResult {
  poster_path?: string | null
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  release_date?: string
  first_air_date?: string
}

/**
 * Looks the title up on TMDB and keeps the poster only on a confident match, so
 * a near miss never replaces the provider's own artwork with the wrong film.
 */
async function lookup(request: ArtworkRequest): Promise<string | null> {
  const { TMDB_TOKEN, TMDB_KEY, TMDB_LANG } = config()
  const wanted = parseTitle(request.name)
  if (wanted.tokens.length === 0) return null

  const url = new URL(`${BASE}/search/${request.kind === 'series' ? 'tv' : 'movie'}`)
  url.searchParams.set('query', wanted.title)
  url.searchParams.set('language', TMDB_LANG)
  url.searchParams.set('include_adult', 'false')
  if (!TMDB_TOKEN && TMDB_KEY) url.searchParams.set('api_key', TMDB_KEY)

  const year = request.year ?? wanted.year
  const body = await getJson<{ results?: RawResult[] }>(url.toString(), {
    headers: TMDB_TOKEN ? { Authorization: `Bearer ${TMDB_TOKEN}`, accept: 'application/json' } : { accept: 'application/json' },
    ttl: 6 * 3600_000,
    timeout: 12_000
  }).catch(() => null)

  for (const result of body?.results ?? []) {
    if (!result.poster_path) continue
    const candidates = [result.title, result.name, result.original_title, result.original_name].filter(Boolean) as string[]
    if (!candidates.some((candidate) => sameTitle(parseTitle(candidate), wanted))) continue

    const date = result.release_date || result.first_air_date || ''
    const resultYear = date ? Number(date.slice(0, 4)) : null
    if (year && resultYear && Math.abs(resultYear - year) > YEAR_TOLERANCE) continue
    return result.poster_path
  }
  return null
}

/**
 * Poster paths for provider entries. The catalogue's own covers are uneven —
 * measured, some are 600x900 and others 320x240 thumbnails that look terrible in
 * a 2:3 frame — so a matched TMDB poster is preferred when one exists.
 */
export async function posters(requests: ArtworkRequest[]): Promise<Record<string, string | null>> {
  const store = read()
  /*
   * The language belongs in the key. TMDB returns the poster for the language
   * asked for, so the same title has different key art in Turkish and English —
   * cached under one key, switching the interface left the old posters on
   * screen. Keeping both means switching back costs nothing.
   */
  const lang = config().TMDB_LANG.slice(0, 2)
  const keyOf = (request: ArtworkRequest): string => `${request.key}@${lang}`
  const now = Date.now()
  const out: Record<string, string | null> = {}
  const pending: ArtworkRequest[] = []

  for (const request of requests) {
    const row = store[keyOf(request)]
    const ttl = row?.poster ? HIT_TTL_MS : MISS_TTL_MS
    if (row && now - row.at < ttl) out[request.key] = row.poster
    else pending.push(request)
  }

  let index = 0
  let changed = false
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, pending.length) }, async () => {
      while (index < pending.length) {
        const request = pending[index++]
        const poster = await lookup(request).catch(() => null)
        store[keyOf(request)] = { poster, at: Date.now() }
        out[request.key] = poster
        changed = true
      }
    })
  )

  if (changed) persist()
  return out
}
