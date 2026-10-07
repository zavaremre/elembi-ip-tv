import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const API = 'https://www.thesportsdb.com/api/v1/json/3/searchteams.php'
const HIT_TTL_MS = 30 * 24 * 3600_000
const MISS_TTL_MS = 3 * 24 * 3600_000
const TIMEOUT_MS = 10_000
const CONCURRENCY = 4

/** TheSportsDB sometimes leaves raw control characters inside description fields. */
const CONTROL = new RegExp('[\\u0000-\\u001f]', 'g')

/** Turkish EPGs name national teams in Turkish; the database indexes them in English. */
const COUNTRY_ALIASES: Record<string, string> = {
  türkiye: 'Turkey', turkiye: 'Turkey', almanya: 'Germany', yunanistan: 'Greece',
  ispanya: 'Spain', 'i̇spanya': 'Spain', ingiltere: 'England', 'i̇ngiltere': 'England',
  fransa: 'France', italya: 'Italy', 'i̇talya': 'Italy', hollanda: 'Netherlands',
  portekiz: 'Portugal', belçika: 'Belgium', belcika: 'Belgium', hırvatistan: 'Croatia',
  hirvatistan: 'Croatia', avusturya: 'Austria', norveç: 'Norway', norvec: 'Norway',
  isveç: 'Sweden', 'i̇sveç': 'Sweden', isvec: 'Sweden', danimarka: 'Denmark',
  polonya: 'Poland', çekya: 'Czech Republic', cekya: 'Czech Republic', sırbistan: 'Serbia',
  sirbistan: 'Serbia', ukrayna: 'Ukraine', rusya: 'Russia', brezilya: 'Brazil',
  arjantin: 'Argentina', meksika: 'Mexico', japonya: 'Japan', 'güney kore': 'South Korea',
  'guney kore': 'South Korea', 'suudi arabistan': 'Saudi Arabia', katar: 'Qatar',
  fas: 'Morocco', mısır: 'Egypt', misir: 'Egypt', nijerya: 'Nigeria', senegal: 'Senegal',
  kamerun: 'Cameroon', abd: 'USA', kanada: 'Canada', avustralya: 'Australia',
  isviçre: 'Switzerland', 'i̇sviçre': 'Switzerland', isvicre: 'Switzerland',
  macaristan: 'Hungary', romanya: 'Romania', bulgaristan: 'Bulgaria', slovakya: 'Slovakia',
  slovenya: 'Slovenia', irlanda: 'Ireland', 'i̇rlanda': 'Ireland', iskoçya: 'Scotland',
  'i̇skoçya': 'Scotland', galler: 'Wales', izlanda: 'Iceland', 'i̇zlanda': 'Iceland',
  finlandiya: 'Finland', gürcistan: 'Georgia', gurcistan: 'Georgia',
  azerbaycan: 'Azerbaijan', kazakistan: 'Kazakhstan', 'i̇srail': 'Israel', israil: 'Israel',
  umman: 'Oman', 'birleşik arap emirlikleri': 'United Arab Emirates', bae: 'United Arab Emirates',
  kuveyt: 'Kuwait', bahreyn: 'Bahrain', ürdün: 'Jordan', tunus: 'Tunisia',
  cezayir: 'Algeria', kolombiya: 'Colombia', şili: 'Chile', sili: 'Chile', peru: 'Peru',
  uruguay: 'Uruguay', paraguay: 'Paraguay', ekvador: 'Ecuador', çin: 'China', cin: 'China'
}

interface CacheRow {
  badge: string | null
  at: number
}

type Cache = Record<string, CacheRow>

let cache: Cache | null = null
const file = (): string => join(app.getPath('userData'), 'team-badges.json')

function read(): Cache {
  if (cache) return cache
  try {
    cache = existsSync(file()) ? (JSON.parse(readFileSync(file(), 'utf8')) as Cache) : {}
  } catch {
    cache = {}
  }
  return cache
}

function persist(): void {
  try {
    writeFileSync(file(), JSON.stringify(read()))
  } catch {
    /* a failed cache write must not break the sports rail */
  }
}

const keyOf = (name: string): string => name.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim()

function queryFor(name: string): string {
  const key = keyOf(name)
  return COUNTRY_ALIASES[key] ?? name.trim()
}

async function lookup(name: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const url = `${API}?t=${encodeURIComponent(queryFor(name))}`
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    const body = JSON.parse((await res.text()).replace(CONTROL, ' ')) as {
      teams?: { strBadge?: string | null; strTeamBadge?: string | null }[] | null
    }
    const team = body.teams?.[0]
    return team?.strBadge || team?.strTeamBadge || null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Badges for the team names parsed out of the EPG. Hits and misses are both
 * cached on disk, because many EPG names are local nicknames that will never
 * resolve and should not be retried on every refresh.
 */
export async function teamBadges(names: string[]): Promise<Record<string, string | null>> {
  const store = read()
  const now = Date.now()
  const out: Record<string, string | null> = {}
  const pending: string[] = []

  for (const name of [...new Set(names.map((n) => n.trim()).filter(Boolean))]) {
    const row = store[keyOf(name)]
    const ttl = row?.badge ? HIT_TTL_MS : MISS_TTL_MS
    if (row && now - row.at < ttl) out[name] = row.badge
    else pending.push(name)
  }

  let index = 0
  let changed = false
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, pending.length) }, async () => {
      while (index < pending.length) {
        const name = pending[index++]
        const badge = await lookup(name)
        store[keyOf(name)] = { badge, at: Date.now() }
        out[name] = badge
        changed = true
      }
    })
  )

  if (changed) persist()
  return out
}
