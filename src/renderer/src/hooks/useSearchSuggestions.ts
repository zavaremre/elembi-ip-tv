import { useEffect, useState } from 'react'
import type { Keyword, PersonHit } from '@shared/types'

const DEBOUNCE_MS = 320
const MIN_LENGTH = 3

export interface SearchSuggestions {
  /** TMDB keywords, so a search can become a topic filter. */
  keywords: Keyword[]
  /** People of that name, so a search can become their filmography. */
  people: PersonHit[]
}

const EMPTY: SearchSuggestions = { keywords: [], people: [] }

/**
 * What a typed query could mean besides a title: a subject, or a person.
 *
 * Both come from one searchRich call. A name typed into a title search returns
 * whatever films happen to carry it in their title, which is rarely what was
 * meant — offering the person turns the query into their own credits instead.
 */
export function useSearchSuggestions(query: string): SearchSuggestions {
  const [suggestions, setSuggestions] = useState<SearchSuggestions>(EMPTY)

  useEffect(() => {
    if (query.trim().length < MIN_LENGTH) {
      setSuggestions(EMPTY)
      return
    }
    let alive = true
    const timer = window.setTimeout(() => {
      window.elembi.tmdb
        .searchRich(query)
        /*
         * Defaulted, not trusted: the main process is a separate build, and in
         * development it can be an older one that knows nothing about people.
         * A missing field used to reach the page as undefined.length.
         */
        .then((result) => alive && setSuggestions({ keywords: result?.keywords ?? [], people: result?.people ?? [] }))
        .catch(() => alive && setSuggestions(EMPTY))
    }, DEBOUNCE_MS)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [query])

  return suggestions
}
