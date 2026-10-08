import { useCallback, useState } from 'react'
import type { Section } from '@/components/AppHeader'
import type { CollectionId } from './useCollectionLists'
import type { DetailRef } from './useTmdbDetail'
import type { DiscoverFilters, VodItem } from '@shared/types'

export interface View {
  section: Section
  collection: CollectionId | null
  detailRef: DetailRef | null
  /** A series in the provider catalogue, shown with its own season list. */
  providerSeries: VodItem | null
  /** Set when a page was opened for a platform: its categories and its name. */
  providerScope: { name: string; categories: string[] } | null
  filters: DiscoverFilters
}

export interface ViewStack {
  view: View
  canGoBack: boolean
  /** Pushes the current view and applies the patch. */
  go: (patch: Partial<View>) => void
  back: () => void
  /** In-place update that is not a navigation step, e.g. changing a filter. */
  replace: (patch: Partial<View>) => void
}

const HISTORY_LIMIT = 24

/** Navigation history for the whole app, so one back control serves every page. */
export function useViewStack(initial: View): ViewStack {
  const [view, setView] = useState<View>(initial)
  const [past, setPast] = useState<View[]>([])

  const go = useCallback(
    (patch: Partial<View>): void => {
      setPast((history) => [...history, view].slice(-HISTORY_LIMIT))
      setView((current) => ({ ...current, ...patch }))
    },
    [view]
  )

  const back = useCallback((): void => {
    if (past.length === 0) return
    setView(past[past.length - 1])
    setPast(past.slice(0, -1))
  }, [past])

  const replace = useCallback((patch: Partial<View>): void => {
    setView((current) => ({ ...current, ...patch }))
  }, [])

  return { view, canGoBack: past.length > 0, go, back, replace }
}
