import { useAsync, type AsyncState } from './useAsync'
import { parseName } from '@/lib/match'
import type { TmdbItem, VodItem } from '@shared/types'

export interface ProviderEpisode {
  id: number
  num: number
  title: string
  url: string
  still: string | null
}

export interface ProviderSeason {
  season: number
  episodes: ProviderEpisode[]
}

export interface ProviderSeriesView {
  seasons: ProviderSeason[]
  episodeCount: number
  /** Best TMDB series match, used for artwork and the overview only. */
  tmdb: TmdbItem | null
}

/** Artwork only, so an exact title match is required rather than a near miss. */
function bestTvMatch(name: string, results: TmdbItem[]): TmdbItem | null {
  const want = parseName(name)
  const shows = results.filter((item) => item.kind === 'tv')
  return shows.find((item) => parseName(item.title).title === want.title) ?? null
}

/**
 * Seasons and episodes come from the provider, because those are what can
 * actually be played; TMDB is queried only to dress the page.
 */
export function useProviderSeries(item: VodItem | null): AsyncState<ProviderSeriesView | null> {
  return useAsync(async () => {
    if (!item) return null
    const [info, search] = await Promise.all([
      window.akis.iptv.seriesInfo(item.id),
      window.akis.tmdb.search(item.name).catch(() => [])
    ])

    /* The search endpoint carries no logo, so the match is detailed once. */
    const match = bestTvMatch(item.name, search)
    const tmdb = match ? await window.akis.tmdb.detail(match.kind, match.id).catch(() => match) : null

    return {
      seasons: info.seasons,
      episodeCount: info.seasons.reduce((total, season) => total + season.episodes.length, 0),
      tmdb
    }
  }, [item?.id])
}
