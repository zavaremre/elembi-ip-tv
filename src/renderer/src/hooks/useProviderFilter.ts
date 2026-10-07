import { useMemo, useState } from 'react'
import { norm } from '@/lib/match'

export type ProviderSort = 'number' | 'name' | 'newest' | 'rating'

export interface ProviderEntry {
  name: string
  group: string
  country: string | null
  num?: number
  added?: number
  rating?: number | null
}

export interface Facet {
  value: string
  count: number
}

export interface ProviderFilter<T> {
  countries: Facet[]
  categories: Facet[]
  country: string
  category: string
  query: string
  sort: ProviderSort
  visible: T[]
  total: number
  limit: number
  setCountry: (value: string) => void
  setCategory: (value: string) => void
  setQuery: (value: string) => void
  setSort: (value: ProviderSort) => void
  showMore: () => void
  reset: () => void
}

const PAGE_SIZE = 120

const countFacets = (values: (string | null)[]): Facet[] => {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'tr'))
}

/**
 * Country and category facets for the provider catalogue, plus text search and
 * a render cap, because the VOD list runs to thousands of entries.
 */
export function useProviderFilter<T extends ProviderEntry>(items: T[], defaultSort: ProviderSort): ProviderFilter<T> {
  const [country, setCountryState] = useState('')
  const [category, setCategoryState] = useState('')
  const [query, setQueryState] = useState('')
  const [sort, setSortState] = useState<ProviderSort>(defaultSort)
  const [limit, setLimit] = useState(PAGE_SIZE)

  const countries = useMemo(() => countFacets(items.map((i) => i.country)), [items])

  const inCountry = useMemo(
    () => (country ? items.filter((i) => i.country === country) : items),
    [items, country]
  )

  const categories = useMemo(() => countFacets(inCountry.map((i) => i.group)), [inCountry])

  const filtered = useMemo(() => {
    const needle = norm(query)
    const rows = inCountry.filter((item) => {
      if (category && item.group !== category) return false
      if (needle && !norm(item.name).includes(needle)) return false
      return true
    })

    const sorted = [...rows]
    if (sort === 'number') sorted.sort((a, b) => (a.num ?? 0) - (b.num ?? 0))
    else if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    else if (sort === 'newest') sorted.sort((a, b) => (b.added ?? 0) - (a.added ?? 0))
    else sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    return sorted
  }, [inCountry, category, query, sort])

  return {
    countries,
    categories,
    country,
    category,
    query,
    sort,
    visible: filtered.slice(0, limit),
    total: filtered.length,
    limit,
    setCountry: (value) => {
      setCountryState(value)
      setCategoryState('')
      setLimit(PAGE_SIZE)
    },
    setCategory: (value) => {
      setCategoryState(value)
      setLimit(PAGE_SIZE)
    },
    setQuery: (value) => {
      setQueryState(value)
      setLimit(PAGE_SIZE)
    },
    setSort: (value) => {
      setSortState(value)
      setLimit(PAGE_SIZE)
    },
    showMore: () => setLimit((current) => current + PAGE_SIZE),
    reset: () => {
      setCountryState('')
      setCategoryState('')
      setQueryState('')
      setSortState(defaultSort)
      setLimit(PAGE_SIZE)
    }
  }
}
