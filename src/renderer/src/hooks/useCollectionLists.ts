import { useAsync, type AsyncState } from './useAsync'
import type { TmdbItem } from '@shared/types'

export type CollectionId = 'top-rated' | 'now-playing' | 'airing-today' | 'provider-vod'

const LOADERS: Record<Exclude<CollectionId, 'provider-vod'>, () => Promise<TmdbItem[]>> = {
  'top-rated': () => window.elembi.tmdb.topRated('movie'),
  'now-playing': () => window.elembi.tmdb.nowPlaying(),
  'airing-today': () => window.elembi.tmdb.airingToday()
}

/** Fetches the list behind a showcase collection when it is opened. */
export function useCollectionList(id: CollectionId | null): AsyncState<TmdbItem[]> {
  return useAsync(async () => {
    if (!id || id === 'provider-vod') return []
    return LOADERS[id]()
  }, [id])
}
