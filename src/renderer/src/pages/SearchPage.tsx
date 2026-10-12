import { useEffect, useState } from 'react'
import { FilterBar } from '@/components/FilterBar'
import { PosterCard } from '@/components/PosterCard'
import { useDiscover } from '@/hooks/useDiscover'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { useKeywordSuggestions } from '@/hooks/useKeywordSuggestions'
import { poster } from '@/lib/img'
import type { DiscoverFilters, Genre, Keyword, TmdbItem } from '@shared/types'

interface SearchPageProps {
  filters: DiscoverFilters
  genres: Genre[]
  isPlayable: (item: TmdbItem) => boolean
  providerOnly: boolean
  onChange: (patch: Partial<DiscoverFilters>) => void
  onProviderOnly: (value: boolean) => void
  onReset: () => void
  onOpenItem: (item: TmdbItem) => void
}

const QUERY_DEBOUNCE_MS = 320

/** Search and browse page: free text plus the full TMDB discover filter set. */
export function SearchPage({
  filters,
  genres,
  isPlayable,
  providerOnly,
  onChange,
  onProviderOnly,
  onReset,
  onOpenItem
}: SearchPageProps): React.JSX.Element {
  const [text, setText] = useState(filters.query)
  const suggestions = useKeywordSuggestions(text)
  const discover = useDiscover(filters)
  const sentinelRef = useInfiniteScroll({
    onMore: discover.loadMore,
    enabled: discover.canLoadMore && !discover.loadingMore && !discover.loading
  })

  useEffect(() => {
    if (text === filters.query) return
    const timer = window.setTimeout(() => onChange({ query: text, page: 1 }), QUERY_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  const visible = providerOnly ? discover.items.filter(isPlayable) : discover.items

  const addKeyword = (keyword: Keyword): void => {
    if (filters.keywordIds.includes(keyword.id)) return
    onChange({ keywordIds: [...filters.keywordIds, keyword.id], query: '', page: 1 })
    setText('')
  }

  return (
    <main className="shell px-[var(--pad)] pt-6 pb-24">
      <h1 className="text-[clamp(26px,3.4vw,38px)] font-extrabold">Keşfet</h1>

      <label className="mt-4 block">
        <span className="sr-only">Film veya dizi ara</span>
        <div className="flex h-12 items-center gap-3 rounded-[14px] border border-line bg-surf px-4 focus-within:border-acc/50">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 text-tx3" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M16.5 16.5 21 21" />
          </svg>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Film veya dizi adı yaz, ya da aşağıdan filtrele"
            className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-tx3"
          />
          {text ? (
            <button type="button" onClick={() => setText('')} aria-label="Aramayı temizle" className="text-tx3 hover:text-tx">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ) : null}
        </div>
      </label>

      {suggestions.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="mono text-[10px] tracking-[0.12em] text-tx3 uppercase">Konu olarak ara</span>
          {suggestions.map((keyword) => (
            <button
              key={keyword.id}
              type="button"
              onClick={() => addKeyword(keyword)}
              className="rounded-full border border-acc/35 bg-acc/10 px-3 py-1 text-[12.5px] text-acc hover:bg-acc/20"
            >
              {keyword.name}
            </button>
          ))}
        </div>
      ) : null}

      {filters.person ? (

        <div className="mt-3 flex flex-wrap items-center gap-2">

          <span className="mono text-[10px] tracking-[0.12em] text-tx3 uppercase">Oyuncu</span>

          {/* The name travels in the filter, so the chip says who rather than which id. */}

          <button

            type="button"

            onClick={() => onChange({ person: null, page: 1 })}

            className="flex items-center gap-1.5 rounded-full border border-acc bg-acc/15 px-3 py-1 text-[12px] font-bold text-acc"

          >

            {filters.person.name}

            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">

              <path d="M6 6l12 12M18 6L6 18" />

            </svg>

          </button>

        </div>

      ) : null}

      {filters.keywordIds.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="mono text-[10px] tracking-[0.12em] text-tx3 uppercase">Seçili konular</span>
          {filters.keywordIds.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange({ keywordIds: filters.keywordIds.filter((k) => k !== id), page: 1 })}
              className="flex items-center gap-1.5 rounded-full border border-acc bg-acc/15 px-3 py-1 text-[12.5px] text-acc"
            >
              #{id}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-5">
        <FilterBar
          filters={filters}
          genres={genres}
          resultCount={visible.length}
          filteredLocally={discover.filteredLocally}
          providerOnly={providerOnly}
          onChange={onChange}
          onProviderOnly={onProviderOnly}
          onReset={onReset}
        />
      </div>

      {discover.error ? (
        <p className="mt-6 text-[13px] text-live">{discover.error}</p>
      ) : discover.loading ? (
        <p className="mono mt-6 text-[12px] tracking-[0.12em] text-acc uppercase">yükleniyor…</p>
      ) : visible.length === 0 ? (
        <p className="mt-6 text-[14px] text-tx3">
          {providerOnly ? 'Bu filtrelerle sağlayıcıda eşleşen bir başlık yok.' : 'Bu filtrelerle sonuç bulunamadı.'}
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-4 lg:gap-5">
            {visible.map((item) => (
              <PosterCard
                key={`${item.kind}-${item.id}`}
                title={item.title}
                image={poster(item.poster)}
               
                rating={item.rating}
                meta={item.year}
                layout="grid"
                onOpen={() => onOpenItem(item)}
              />
            ))}
          </div>

          <div ref={sentinelRef} className="h-px" aria-hidden="true" />
          {discover.loadingMore ? (
            <p className="mono mt-6 text-center text-[11.5px] tracking-[0.12em] text-acc uppercase">yükleniyor…</p>
          ) : !discover.canLoadMore ? (
            <p className="mono mt-6 text-center text-[11px] text-tx3">listenin sonu</p>
          ) : null}
        </>
      )}
    </main>
  )
}
