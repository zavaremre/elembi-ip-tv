import { useAsync, type AsyncState } from './useAsync'
import type { TmdbItem } from '@shared/types'

/**
 * The other films in a series. Fetched separately from the detail because TMDB
 * only names the series on a film, not its members, and most films belong to
 * none — so this costs a request exactly when there is something to show.
 */
export function useCollection(id: number | null): AsyncState<TmdbItem[]> {
  return useAsync(async () => (id ? window.elembi.tmdb.collection(id) : []), [id])
}
