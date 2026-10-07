import { useEffect, useState } from 'react'
import type { Keyword } from '@shared/types'

const DEBOUNCE_MS = 320

/** TMDB keyword suggestions for the current query, so a search can become a topic filter. */
export function useKeywordSuggestions(query: string): Keyword[] {
  const [keywords, setKeywords] = useState<Keyword[]>([])

  useEffect(() => {
    if (query.trim().length < 3) {
      setKeywords([])
      return
    }
    let alive = true
    const timer = window.setTimeout(() => {
      window.akis.tmdb
        .searchRich(query)
        .then((result) => alive && setKeywords(result.keywords))
        .catch(() => alive && setKeywords([]))
    }, DEBOUNCE_MS)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [query])

  return keywords
}
