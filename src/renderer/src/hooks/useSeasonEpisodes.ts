import { useAsync, type AsyncState } from './useAsync'
import { fetchSeasonEpisodes, type PlayableEpisode } from '@/lib/episodes'

export interface SeasonView {
  name: string
  episodes: PlayableEpisode[]
  providerCount: number
}

/** Loads one season's episodes for the detail page. */
export function useSeasonEpisodes(
  tvId: number | null,
  seasonNumber: number | null,
  providerSeriesId: number | null
): AsyncState<SeasonView | null> {
  return useAsync(async () => {
    if (tvId === null || seasonNumber === null) return null
    return fetchSeasonEpisodes(tvId, seasonNumber, providerSeriesId)
  }, [tvId, seasonNumber, providerSeriesId])
}
