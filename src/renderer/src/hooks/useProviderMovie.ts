import { useAsync, type AsyncState } from './useAsync'
import { matchTmdb } from '@/lib/providerTmdb'
import type { TmdbItem, VodItem } from '@shared/types'

/**
 * TMDB detail for a film in the provider catalogue, matched by title.
 *
 * The page exists whether or not TMDB knows the film — the provider is what can
 * actually be played — so a miss leaves the page bare rather than unreachable.
 */
export function useProviderMovie(item: VodItem | null): AsyncState<TmdbItem | null> {
  return useAsync(async () => (item ? matchTmdb(item.name, 'movie') : null), [item?.id])
}
