import { useAsync, type AsyncState } from './useAsync'
import { matchTmdb } from '@/lib/providerTmdb'
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

/**
 * Seasons and episodes come from the provider, because those are what can
 * actually be played; TMDB is queried only to dress the page.
 */
export function useProviderSeries(item: VodItem | null): AsyncState<ProviderSeriesView | null> {
  return useAsync(async () => {
    if (!item) return null
    const [info, tmdb] = await Promise.all([
      window.elembi.iptv.seriesInfo(item.id),
      matchTmdb(item.name, 'tv')
    ])

    return {
      seasons: info.seasons,
      episodeCount: info.seasons.reduce((total, season) => total + season.episodes.length, 0),
      tmdb
    }
  }, [item?.id])
}
