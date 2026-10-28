import { useAsync, type AsyncState } from './useAsync'
import type { MediaKind, TmdbDetail } from '@shared/types'

export interface DetailRef {
  kind: MediaKind
  id: number
}

/** Loads the full TMDB record behind the detail page. */
export function useTmdbDetail(ref: DetailRef | null): AsyncState<TmdbDetail | null> {
  return useAsync(async () => {
    if (!ref) return null
    return window.elembi.tmdb.full(ref.kind, ref.id)
  }, [ref?.kind, ref?.id])
}
