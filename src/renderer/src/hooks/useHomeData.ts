import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAsync, type AsyncState } from './useAsync'
import { useTeamBadges } from './useTeamBadges'
import type { GuideRow } from '@/components/MiniEpg'
import type { Collection } from '@/components/ShowcaseCard'
import { pickFeatured } from '@/lib/channels'
import { buildProviderIndex, type ProviderIndex } from '@/lib/providerIndex'
import { backdrop } from '@/lib/img'
import type {
  Channel,
  Genre,
  Match,
  NowNext,
  ProviderStatus,
  TmdbItem,
  TrendingPerson,
  VodItem,
  WatchProvider
} from '@shared/types'

const HERO_COUNT = 10
/** The provider filter removes most of a single page, so several are fetched. */
const POPULAR_PAGES = 5
const RAIL_LIMIT = 40
const LIVE_RAIL_COUNT = 10
const GUIDE_ROWS = 4

export interface HomeData {
  hero: AsyncState<TmdbItem[]>
  movies: AsyncState<TmdbItem[]>
  series: AsyncState<TmdbItem[]>
  matches: AsyncState<Match[]>
  channels: AsyncState<Channel[]>
  vod: AsyncState<VodItem[]>
  providerSeries: AsyncState<VodItem[]>
  /** TMDB's services for the region, for logos on the platform cards. */
  watchProviders: AsyncState<WatchProvider[]>
  /** The cast of this week's trending titles. */
  people: AsyncState<TrendingPerson[]>
  genres: AsyncState<Genre[]>
  featured: Channel[]
  guide: Map<number, NowNext>
  guideRows: GuideRow[]
  collections: Collection[]
  status: AsyncState<ProviderStatus>
  teamBadges: Map<string, string>
  providerIndex: ProviderIndex
  /** True when the title can actually be played from the provider catalogue. */
  isPlayable: (item: TmdbItem) => boolean
  reload: () => void
}

function dedupe(items: TmdbItem[]): TmdbItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.kind}-${item.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Loads every rail on the home screen; each request fails on its own without blanking the page. */
export function useHomeData(): HomeData {
  const [nonce, setNonce] = useState(0)

  const trending = useAsync(() => window.elembi.tmdb.trending(), [nonce])
  const movies = useAsync(async () => {
    const pages = await Promise.all(
      Array.from({ length: POPULAR_PAGES }, (_, i) => window.elembi.tmdb.popularMovies(i + 1))
    )
    return dedupe(pages.flat())
  }, [nonce])
  const series = useAsync(async () => {
    const pages = await Promise.all(
      Array.from({ length: POPULAR_PAGES }, (_, i) => window.elembi.tmdb.popularTv(i + 1))
    )
    return dedupe(pages.flat())
  }, [nonce])
  const genres = useAsync(() => window.elembi.tmdb.genres(), [nonce])
  const topRated = useAsync(() => window.elembi.tmdb.topRated('movie'), [nonce])
  const nowPlaying = useAsync(() => window.elembi.tmdb.nowPlaying(), [nonce])
  const airing = useAsync(() => window.elembi.tmdb.airingToday(), [nonce])

  const channels = useAsync(() => window.elembi.iptv.channels(), [nonce])
  const matches = useAsync(() => window.elembi.iptv.matches(), [nonce])
  const vod = useAsync(() => window.elembi.iptv.vod(), [nonce])
  const providerSeries = useAsync(() => window.elembi.iptv.series(), [nonce])
  const watchProviders = useAsync(() => window.elembi.tmdb.watchProviders(), [nonce])
  const people = useAsync(() => window.elembi.tmdb.trendingPeople(), [nonce])
  const status = useAsync(() => window.elembi.iptv.status(), [nonce])
  const teamBadges = useTeamBadges(matches.data ?? [])

  /* Indexed once per refresh: a per-title scan of ~11k entries would stall rendering. */
  const providerIndex = useMemo(
    () => buildProviderIndex([...(vod.data ?? []), ...(providerSeries.data ?? [])]),
    [vod.data, providerSeries.data]
  )
  const isPlayable = useCallback((item: TmdbItem): boolean => providerIndex.has(item), [providerIndex])

  const playableMovies = useMemo(
    () => (movies.data ?? []).filter(isPlayable).slice(0, RAIL_LIMIT),
    [movies.data, isPlayable]
  )
  const playableSeries = useMemo(
    () => (series.data ?? []).filter(isPlayable).slice(0, RAIL_LIMIT),
    [series.data, isPlayable]
  )

  const [heroItems, setHeroItems] = useState<TmdbItem[]>([])

  /**
   * The hero only shows titles the provider actually carries, so its play button
   * always works. Trending alone rarely has ten of them, so the popular and
   * top-rated lists top it up.
   */
  const heroCandidates = useMemo(() => {
    const pool = [...(trending.data ?? []), ...(movies.data ?? []), ...(series.data ?? []), ...(topRated.data ?? [])]
    const seen = new Set<string>()
    const picked: TmdbItem[] = []
    for (const item of pool) {
      const key = `${item.kind}-${item.id}`
      if (seen.has(key)) continue
      seen.add(key)
      if (!item.backdrop || !isPlayable(item)) continue
      picked.push(item)
      if (picked.length === HERO_COUNT) break
    }
    return picked
  }, [trending.data, movies.data, series.data, topRated.data, isPlayable])

  /* Render what the list endpoints gave us, then fill in logos and runtimes. */
  useEffect(() => {
    if (heroCandidates.length === 0) return
    setHeroItems(heroCandidates)
    let alive = true
    Promise.all(heroCandidates.map((item) => window.elembi.tmdb.detail(item.kind, item.id).catch(() => item))).then((full) => {
      if (alive) setHeroItems(full)
    })
    return () => {
      alive = false
    }
  }, [heroCandidates])

  const hero: AsyncState<TmdbItem[]> = {
    data: heroItems.length > 0 ? heroItems : null,
    loading: trending.loading || vod.loading,
    error: trending.error
  }

  const featured = channels.data ? pickFeatured(channels.data, LIVE_RAIL_COUNT) : []

  const [guide, setGuide] = useState<Map<number, NowNext>>(new Map())
  const [guideRows, setGuideRows] = useState<GuideRow[]>([])

  useEffect(() => {
    if (featured.length === 0) return
    let alive = true

    Promise.all(
      featured.map(async (channel) => {
        const nowNext = await window.elembi.iptv.nowNext(channel.id).catch(() => null)
        return [channel.id, nowNext] as const
      })
    ).then((pairs) => {
      if (!alive) return
      const next = new Map<number, NowNext>()
      for (const [id, nowNext] of pairs) if (nowNext) next.set(id, nowNext)
      setGuide(next)
    })

    Promise.all(
      featured.slice(0, GUIDE_ROWS).map(async (channel) => ({
        channel,
        entries: await window.elembi.iptv.epg(channel.id, 8).catch(() => [])
      }))
    ).then((rows) => {
      if (alive) setGuideRows(rows.filter((row) => row.entries.length > 0))
    })

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featured.map((c) => c.id).join(','), nonce])

  const collections: Collection[] = [
    topRated.data?.length
      ? {
          id: 'top-rated',
          kicker: `Koleksiyon · ${topRated.data.length} film`,
          title: 'En Çok\nOylananlar',
          subtitle: 'TMDB puanına göre zirve',
          image: backdrop(topRated.data[0].backdrop, 'w780')
        }
      : null,
    nowPlaying.data?.length
      ? {
          id: 'now-playing',
          kicker: `Koleksiyon · ${nowPlaying.data.length} film`,
          title: 'Vizyonda\nOlanlar',
          subtitle: 'Bu dönem sinemalarda',
          image: backdrop(nowPlaying.data[0].backdrop, 'w780')
        }
      : null,
    airing.data?.length
      ? {
          id: 'airing-today',
          kicker: `Koleksiyon · ${airing.data.length} dizi`,
          title: 'Bugün\nYayında',
          subtitle: 'Bugün yeni bölümü olan diziler',
          image: backdrop(airing.data[0].backdrop, 'w780')
        }
      : null,
    vod.data?.length
      ? {
          id: 'provider-vod',
          kicker: `Arşiv · ${vod.data.length} başlık`,
          title: 'Sağlayıcı\nArşivi',
          subtitle: 'Listende oynatılabilir her şey',
          image: vod.data[0]?.cover ?? null
        }
      : null
  ].filter(Boolean) as Collection[]

  const reload = useCallback(() => {
    window.elembi.app
      .refresh()
      .then(() => setNonce((n) => n + 1))
      .catch(() => setNonce((n) => n + 1))
  }, [])

  return {
    hero,
    movies: { ...movies, data: playableMovies },
    series: { ...series, data: playableSeries },
    matches,
    channels,
    vod,
    providerSeries,
    watchProviders,
    people,
    genres,
    featured,
    guide,
    guideRows,
    collections,
    status,
    teamBadges,
    providerIndex,
    isPlayable,
    reload
  }
}
