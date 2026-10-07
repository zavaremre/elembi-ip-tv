import { config } from './config'
import {
  audioVariant,
  cleanChannelName,
  cleanGroupName,
  cleanTitle,
  countryFromGroup,
  countryFromName,
  parseFixture
} from './fixtures'
import { catalog, catalogIsStale, catalogSavedAt, clearCatalog } from './catalog'
import { getJson } from './http'
import { guide, resetGuide } from './xmltv'
import type { Channel, EpgEntry, Match, NowNext, ProviderStatus, VodItem } from '../shared/types'

/* ── helpers ──────────────────────────────────── */

function api(action?: string, params: Record<string, string | number> = {}): string {
  const { XTREAM_HOST, XTREAM_USER, XTREAM_PASS } = config()
  const u = new URL('/player_api.php', XTREAM_HOST)
  u.searchParams.set('username', XTREAM_USER)
  u.searchParams.set('password', XTREAM_PASS)
  if (action) u.searchParams.set('action', action)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v))
  return u.toString()
}

const fromBase64 = (value: string | undefined): string => {
  if (!value) return ''
  try {
    return Buffer.from(value, 'base64').toString('utf8')
  } catch {
    return value
  }
}

/** Panels report times either as "YYYY-MM-DD HH:mm:ss" (server clock) or as unix seconds. */
function toMillis(value: unknown): number {
  if (typeof value === 'number') return value * 1000
  if (typeof value === 'string') {
    if (/^\d+$/.test(value)) return Number(value) * 1000
    const parsed = new Date(`${value.replace(' ', 'T')}Z`)
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime()
  }
  return 0
}

/* ── raw panel payloads ───────────────────────── */
interface RawLive {
  stream_id: number
  num: number
  name: string
  stream_icon: string
  epg_channel_id: string | null
  category_id: string
  tv_archive?: number
}
interface RawCategory {
  category_id: string
  category_name: string
}
interface RawVod {
  stream_id: number
  name: string
  stream_icon: string
  rating: string
  category_id: string
  added: string
  container_extension?: string
}
interface RawSeries {
  series_id: number
  name: string
  cover: string
  rating: string
  category_id: string
  last_modified: string
}
interface RawShortEpg {
  title: string
  description: string
  start: string
  end: string
  start_timestamp?: string
  stop_timestamp?: string
}

/* ── stream URLs ──────────────────────────────── */
export function liveUrl(id: number): string {
  const { XTREAM_HOST, XTREAM_USER, XTREAM_PASS, XTREAM_OUTPUT } = config()
  const ext = XTREAM_OUTPUT === 'hls' ? 'm3u8' : 'ts'
  return `${XTREAM_HOST}/live/${XTREAM_USER}/${XTREAM_PASS}/${id}.${ext}`
}
export function vodUrl(id: number, ext = 'mp4'): string {
  const { XTREAM_HOST, XTREAM_USER, XTREAM_PASS } = config()
  return `${XTREAM_HOST}/movie/${XTREAM_USER}/${XTREAM_PASS}/${id}.${ext}`
}
export function seriesUrl(episodeId: number, ext = 'mp4'): string {
  const { XTREAM_HOST, XTREAM_USER, XTREAM_PASS } = config()
  return `${XTREAM_HOST}/series/${XTREAM_USER}/${XTREAM_PASS}/${episodeId}.${ext}`
}

/* ── fixtures ─────────────────────────────────── */
const SPORT_RE = /spor|sport|bein|futbol|match/i
const MATCH_WINDOW_BACK_MS = 4 * 3600_000
const MATCH_WINDOW_AHEAD_MS = 30 * 3600_000
const TAG_ORDER = { live: 0, scheduled: 1, replay: 2, highlights: 3 } as const

/* ── public API ───────────────────────────────── */
/* ── catalogue loaders ─────────────────────────── */

async function loadChannels(): Promise<Channel[]> {
  const [categories, streams] = await Promise.all([
    getJson<RawCategory[]>(api('get_live_categories'), { ttl: 6 * 3600_000 }),
    getJson<RawLive[]>(api('get_live_streams'), { ttl: 30 * 60_000, timeout: 30_000 })
  ])
  const byCategory = new Map(
    categories.map((c) => [c.category_id, { name: cleanGroupName(c.category_name), country: countryFromGroup(c.category_name) }])
  )
  return streams.map((s) => {
    const category = byCategory.get(s.category_id)
    return {
      id: s.stream_id,
      num: s.num,
      name: cleanChannelName(s.name),
      logo: s.stream_icon || null,
      group: category?.name ?? 'Diğer',
      epgId: s.epg_channel_id || null,
      country: category?.country ?? countryFromName(s.name),
      url: liveUrl(s.stream_id),
      archive: Boolean(s.tv_archive)
    }
  })
}

async function loadVod(): Promise<VodItem[]> {
  const [categories, streams] = await Promise.all([
    getJson<RawCategory[]>(api('get_vod_categories'), { ttl: 6 * 3600_000 }),
    getJson<RawVod[]>(api('get_vod_streams'), { ttl: 30 * 60_000, timeout: 45_000 })
  ])
  const byCategory = new Map(
    categories.map((c) => [c.category_id, { name: cleanGroupName(c.category_name), country: countryFromGroup(c.category_name) }])
  )
  return streams.map((s) => ({
    id: s.stream_id,
    kind: 'vod' as const,
    name: cleanTitle(s.name),
    cover: s.stream_icon || null,
    rating: s.rating ? Number(s.rating) || null : null,
    group: byCategory.get(s.category_id)?.name ?? 'Diğer',
    country: byCategory.get(s.category_id)?.country ?? countryFromName(s.name),
    audio: audioVariant(s.name, byCategory.get(s.category_id)?.name ?? ''),
    added: Number(s.added) * 1000 || 0,
    containerExt: s.container_extension ?? 'mp4',
    url: vodUrl(s.stream_id, s.container_extension ?? 'mp4')
  }))
}

async function loadSeries(): Promise<VodItem[]> {
  const [categories, list] = await Promise.all([
    getJson<RawCategory[]>(api('get_series_categories'), { ttl: 6 * 3600_000 }),
    getJson<RawSeries[]>(api('get_series'), { ttl: 30 * 60_000, timeout: 45_000 })
  ])
  const byCategory = new Map(
    categories.map((c) => [c.category_id, { name: cleanGroupName(c.category_name), country: countryFromGroup(c.category_name) }])
  )
  return list.map((s) => ({
    id: s.series_id,
    kind: 'series' as const,
    name: cleanTitle(s.name),
    cover: s.cover || null,
    rating: s.rating ? Number(s.rating) || null : null,
    group: byCategory.get(s.category_id)?.name ?? 'Diğer',
    country: byCategory.get(s.category_id)?.country ?? countryFromName(s.name),
    audio: audioVariant(s.name, byCategory.get(s.category_id)?.name ?? ''),
    added: Number(s.last_modified) * 1000 || 0
  }))
}

/* ── api ──────────────────────────────────────── */

export const xtream = {
  configured(): boolean {
    const c = config()
    return Boolean(c.XTREAM_HOST && c.XTREAM_USER && c.XTREAM_PASS)
  },

  async status(): Promise<ProviderStatus> {
    if (!this.configured()) return { ok: false, message: 'Sağlayıcı bilgileri girilmedi (.env)' }
    try {
      const info = await getJson<{
        user_info?: { status: string; exp_date: string | null; max_connections: string; active_cons: string; auth: number }
      }>(api(), { ttl: 60_000, timeout: 12_000 })
      const user = info.user_info
      if (!user || user.auth === 0) return { ok: false, message: 'Kimlik doğrulama başarısız — kullanıcı adı veya şifre' }

      const [live, vod, series] = await Promise.all([
        this.channels().catch(() => []),
        this.vod().catch(() => []),
        this.series().catch(() => [])
      ])
      return {
        ok: true,
        message: 'Bağlandı',
        user: {
          status: user.status,
          expires: user.exp_date ? new Date(Number(user.exp_date) * 1000).toLocaleDateString('tr-TR') : null,
          maxConnections: user.max_connections,
          activeConnections: user.active_cons
        },
        counts: { live: live.length, vod: vod.length, series: series.length },
        offline: catalogIsStale()
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Sağlayıcıya ulaşılamadı'
      const saved = catalogSavedAt()
      /*
       * Still a failure — playback needs the panel. Saying so while naming the
       * saved copy explains why the catalogue is on screen anyway.
       */
      if (saved) {
        const day = new Date(saved).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
        return { ok: false, offline: true, message: `Ulaşılamıyor — ${day} tarihli kayıtlı katalog, oynatma çalışmaz` }
      }
      return { ok: false, message: reason }
    }
  },

  async channels(): Promise<Channel[]> {
    return catalog('channels', 6 * 3600_000, loadChannels)
  },

  /** XMLTV first; the panel's own short EPG is only a fallback. */
  async epg(streamId: number, limit = 8): Promise<EpgEntry[]> {
    const channels = await this.channels()
    const channel = channels.find((c) => c.id === streamId)

    if (channel?.epgId) {
      const programmes = (await guide().catch(() => null))?.get(channel.epgId)
      if (programmes?.length) {
        const now = Date.now()
        const upcoming = programmes.filter((e) => e.stop > now - 2 * 3600_000)
        return (upcoming.length ? upcoming : programmes).slice(0, limit)
      }
    }

    const res = await getJson<{ epg_listings?: RawShortEpg[] }>(
      api('get_short_epg', { stream_id: streamId, limit }),
      { ttl: 5 * 60_000, timeout: 12_000 }
    )
    return (res.epg_listings ?? [])
      .map((e) => ({
        title: fromBase64(e.title),
        description: fromBase64(e.description),
        start: e.start_timestamp ? toMillis(e.start_timestamp) : toMillis(e.start),
        stop: e.stop_timestamp ? toMillis(e.stop_timestamp) : toMillis(e.end)
      }))
      .filter((e) => e.start > 0)
      .sort((a, b) => a.start - b.start)
  },

  async nowNext(streamId: number): Promise<NowNext> {
    const list = await this.epg(streamId, 6)
    const now = Date.now()
    const current = list.find((e) => e.start <= now && e.stop > now) ?? null
    const next = list.find((e) => e.start > now) ?? null
    const progress =
      current && current.stop > current.start
        ? Math.min(1, Math.max(0, (now - current.start) / (current.stop - current.start)))
        : 0
    return { now: current, next, progress }
  },

  /** Reads the whole XMLTV guide once and extracts fixtures from sport channels. */
  async matches(max = 16): Promise<Match[]> {
    const [channels, programmes] = await Promise.all([this.channels(), guide()])
    const now = Date.now()
    const from = now - MATCH_WINDOW_BACK_MS
    const to = now + MATCH_WINDOW_AHEAD_MS
    const found: Match[] = []
    const seen = new Set<string>()

    for (const channel of channels) {
      if (!channel.epgId) continue
      if (!SPORT_RE.test(channel.group) && !SPORT_RE.test(channel.name)) continue
      const list = programmes.get(channel.epgId)
      if (!list) continue

      for (const entry of list) {
        if (entry.start < from || entry.start > to) continue
        const fixture = parseFixture(entry.title)
        if (!fixture) continue
        const key = `${fixture.home}|${fixture.away}|${Math.round(entry.start / 60_000)}`
        if (seen.has(key)) continue
        seen.add(key)

        const onAir = entry.start <= now && entry.stop > now
        found.push({
          channelId: channel.id,
          channelName: channel.name,
          channelLogo: channel.logo,
          league: fixture.league ?? channel.group,
          home: fixture.home,
          away: fixture.away,
          start: entry.start,
          stop: entry.stop,
          live: onAir && fixture.tag !== 'replay' && fixture.tag !== 'highlights',
          minute: onAir && fixture.tag === 'live' ? Math.floor((now - entry.start) / 60_000) : null,
          tag: onAir && fixture.tag === 'scheduled' ? 'live' : fixture.tag
        })
      }
    }

    return found
      .sort((a, b) => TAG_ORDER[a.tag] - TAG_ORDER[b.tag] || a.start - b.start)
      .slice(0, max)
  },

  async vod(): Promise<VodItem[]> {
    return catalog('vod', 12 * 3600_000, loadVod)
  },

  async series(): Promise<VodItem[]> {
    return catalog('series', 12 * 3600_000, loadSeries)
  },

  async seriesInfo(seriesId: number): Promise<{
    seasons: { season: number; episodes: { id: number; num: number; title: string; url: string; still: string | null }[] }[]
  }> {
    const res = await getJson<{
      episodes?: Record<
        string,
        { id: string; episode_num: number; title: string; container_extension: string; info?: { movie_image?: string } }[]
      >
    }>(api('get_series_info', { series_id: seriesId }), { ttl: 3600_000, timeout: 20_000 })

    const seasons = Object.entries(res.episodes ?? {}).map(([season, episodes]) => ({
      season: Number(season),
      episodes: episodes.map((e) => ({
        id: Number(e.id),
        num: e.episode_num,
        title: e.title,
        url: seriesUrl(Number(e.id), e.container_extension || 'mp4'),
        still: e.info?.movie_image || null
      }))
    }))
    seasons.sort((a, b) => a.season - b.season)
    return { seasons }
  },

  resetGuideCache(): void {
    clearCatalog()
    resetGuide()
  }
}
