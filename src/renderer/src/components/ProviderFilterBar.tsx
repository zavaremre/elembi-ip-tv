import type { Facet, ProviderSort } from '@/hooks/useProviderFilter'

interface ProviderFilterBarProps {
  countries: Facet[]
  categories: Facet[]
  country: string
  category: string
  query: string
  sort: ProviderSort
  sorts: { value: ProviderSort; label: string }[]
  shown: number
  total: number
  searchLabel: string
  onCountry: (value: string) => void
  onCategory: (value: string) => void
  onQuery: (value: string) => void
  onSort: (value: ProviderSort) => void
  onReset: () => void
}

const selectClass =
  'h-9 max-w-[220px] rounded-[9px] border border-line bg-surf px-2.5 text-[12.5px] font-semibold text-tx2 outline-none hover:border-acc/40 focus-visible:border-acc'

/** Country, category, text and sort controls over the provider catalogue. */
export function ProviderFilterBar({
  countries,
  categories,
  country,
  category,
  query,
  sort,
  sorts,
  shown,
  total,
  searchLabel,
  onCountry,
  onCategory,
  onQuery,
  onSort,
  onReset
}: ProviderFilterBarProps): React.JSX.Element {
  return (
    <section className="rounded-[18px] border border-line bg-surf/55 p-4 backdrop-blur-[18px]">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex min-w-0 items-center gap-1.5">
          <span className="sr-only">{searchLabel}</span>
          <div className="flex h-9 items-center gap-2 rounded-[9px] border border-line bg-surf px-3 focus-within:border-acc/50">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 text-tx3" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M16.5 16.5 21 21" />
            </svg>
            <input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder={searchLabel}
              className="w-[180px] bg-transparent text-[12.5px] outline-none placeholder:text-tx3"
            />
          </div>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="mono text-[10px] tracking-[0.1em] text-tx3 uppercase">Ülke</span>
          <select value={country} onChange={(e) => onCountry(e.target.value)} className={selectClass}>
            <option value="">Tümü</option>
            {countries.map((c) => (
              <option key={c.value} value={c.value}>
                {c.value} ({c.count})
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 items-center gap-1.5">
          <span className="mono text-[10px] tracking-[0.1em] text-tx3 uppercase">Kategori</span>
          <select value={category} onChange={(e) => onCategory(e.target.value)} className={selectClass}>
            <option value="">Tümü</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.value} ({c.count})
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="mono text-[10px] tracking-[0.1em] text-tx3 uppercase">Sırala</span>
          <select value={sort} onChange={(e) => onSort(e.target.value as ProviderSort)} className={selectClass}>
            {sorts.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <button type="button" onClick={onReset} className="ml-auto h-9 rounded-[9px] border border-line px-3.5 text-[12.5px] font-bold text-tx3 hover:text-acc">
          Temizle
        </button>
      </div>

      <div className="mono mt-3 text-[11px] text-tx3">
        {shown} / {total} gösteriliyor
        {country ? ` · ülke ${country}` : ''}
        {category ? ` · ${category}` : ''}
      </div>
    </section>
  )
}
