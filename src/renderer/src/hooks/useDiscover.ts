import { useCallback, useEffect, useRef, useState } from 'react'
import type { DiscoverFilters, TmdbItem } from '@shared/types'

export interface DiscoverState {
  items: TmdbItem[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  totalResults: number
  filteredLocally: boolean
  canLoadMore: boolean
  loadMore: () => void
}

const signatureOf = (filters: DiscoverFilters): string => JSON.stringify({ ...filters, page: 0 })

/** Keeps the accumulated pages for the current filter set and resets when it changes. */
export function useDiscover(filters: DiscoverFilters): DiscoverState {
  const signature = signatureOf(filters)
  const [items, setItems] = useState<TmdbItem[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const [filteredLocally, setFilteredLocally] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeSignature = useRef(signature)

  const fetchPage = useCallback(
    async (targetPage: number, replace: boolean, sig: string): Promise<void> => {
      if (replace) setLoading(true)
      else setLoadingMore(true)
      setError(null)
      try {
        const result = await window.akis.tmdb.discover({ ...filters, page: targetPage })
        if (activeSignature.current !== sig) return
        setItems((prev) => (replace ? result.items : [...prev, ...result.items]))
        setPage(result.page)
        setTotalPages(result.totalPages)
        setTotalResults(result.totalResults)
        setFilteredLocally(result.filteredLocally)
      } catch (e) {
        if (activeSignature.current === sig) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (activeSignature.current === sig) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature]
  )

  useEffect(() => {
    activeSignature.current = signature
    void fetchPage(1, true, signature)
  }, [signature, fetchPage])

  return {
    items,
    loading,
    loadingMore,
    error,
    totalResults,
    filteredLocally,
    canLoadMore: page < totalPages,
    loadMore: () => void fetchPage(page + 1, false, signature)
  }
}
