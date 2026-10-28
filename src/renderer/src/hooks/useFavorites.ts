import { useCallback, useEffect, useState } from 'react'
import type { Favorite, FavoriteKind } from '@shared/types'

export interface Favorites {
  rows: Favorite[]
  has: (key: string) => boolean
  toggle: (row: Omit<Favorite, 'added' | 'key'>) => void
}

export const favoriteKey = (kind: FavoriteKind, id: number): string => `${kind}:${id}`

/**
 * The viewer's own shelf, kept in the main process so it survives a restart.
 *
 * Toggling updates the list before the write is acknowledged: the heart is a
 * direct response to a click, and a round trip through IPC is long enough to
 * feel like the click missed. The answer replaces the guess when it lands.
 */
export function useFavorites(): Favorites {
  const [rows, setRows] = useState<Favorite[]>([])

  useEffect(() => {
    let alive = true
    window.elembi.store
      .favorites()
      .then((list) => alive && setRows(list ?? []))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  const toggle = useCallback((row: Omit<Favorite, 'added' | 'key'>): void => {
    const key = favoriteKey(row.kind, row.id)
    const full = { ...row, key }
    setRows((current) =>
      current.some((x) => x.key === key)
        ? current.filter((x) => x.key !== key)
        : [{ ...full, added: Date.now() }, ...current]
    )
    window.elembi.store
      .toggleFavorite(full)
      .then((list) => setRows(list ?? []))
      .catch(() => undefined)
  }, [])

  const has = useCallback((key: string): boolean => rows.some((row) => row.key === key), [rows])

  return { rows, has, toggle }
}
