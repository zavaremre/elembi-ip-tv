import type { DiscoverFilters, Genre, MediaKind, SortOption } from '@shared/types'

interface FilterBarProps {
  filters: DiscoverFilters
  genres: Genre[]
  resultCount: number
  filteredLocally: boolean
  providerOnly: boolean
  onChange: (patch: Partial<DiscoverFilters>) => void
  onProviderOnly: (value: boolean) => void
  onReset: () => void
}

const SORTS: { value: SortOption; label: string }[] = [
  { value: 'popularity.desc', label: 'Popülerlik' },
  { value: 'vote_average.desc', label: 'Puan' },
  { value: 'primary_release_date.desc', label: 'Yeni çıkanlar' },
  { value: 'revenue.desc', label: 'Gişe' },
  { value: 'title.asc', label: 'Ada göre' }
]

const LANGUAGES: { value: string; label: string }[] = [
  { value: '', label: 'Tüm diller' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'İngilizce' },
  { value: 'ko', label: 'Korece' },
  { value: 'ja', label: 'Japonca' },
  { value: 'es', label: 'İspanyolca' },
  { value: 'fr', label: 'Fransızca' },
  { value: 'de', label: 'Almanca' },
  { value: 'it', label: 'İtalyanca' }
]

const RATINGS = [0, 5, 6, 7, 8, 9]
const VOTES = [0, 50, 200, 1000, 5000]
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1949 }, (_, i) => CURRENT_YEAR - i)

const selectClass =
  'h-9 rounded-[9px] border border-line bg-surf px-2.5 text-[12.5px] font-semibold text-tx2 outline-none hover:border-acc/40 focus-visible:border-acc'

/** Advanced filters for the search page; every control maps to a TMDB discover parameter. */
export function FilterBar({
  filters,
  genres,
  resultCount,
  filteredLocally,
  providerOnly,
  onChange,
  onProviderOnly,
  onReset
}: FilterBarProps): React.JSX.Element {
  const kindGenres = genres.filter((g) => g.kind === filters.kind)
  const toggleGenre = (id: number): void =>
    onChange({ genreIds: filters.genreIds.includes(id) ? filters.genreIds.filter((g) => g !== id) : [...filters.genreIds, id] })

  return (
    <section className="rounded-[18px] border border-line bg-surf/55 p-4 backdrop-blur-[18px]">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex overflow-hidden rounded-[9px] border border-line">
          {(['movie', 'tv'] as MediaKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => onChange({ kind, genreIds: [] })}
              className={`h-9 px-4 text-[12.5px] font-bold ${filters.kind === kind ? 'bg-acc text-ink' : 'bg-transparent text-tx2 hover:text-tx'}`}
            >
              {kind === 'movie' ? 'Film' : 'Dizi'}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5">
          <span className="mono text-[10px] tracking-[0.1em] text-tx3 uppercase">Sırala</span>
          <select value={filters.sort} onChange={(e) => onChange({ sort: e.target.value as SortOption })} className={selectClass}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="mono text-[10px] tracking-[0.1em] text-tx3 uppercase">Yıl</span>
          <select
            value={filters.yearFrom ?? ''}
            onChange={(e) => onChange({ yearFrom: e.target.value ? Number(e.target.value) : null })}
            className={selectClass}
          >
            <option value="">—</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <span className="text-tx3">–</span>
          <select
            value={filters.yearTo ?? ''}
            onChange={(e) => onChange({ yearTo: e.target.value ? Number(e.target.value) : null })}
            className={selectClass}
          >
            <option value="">—</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="mono text-[10px] tracking-[0.1em] text-tx3 uppercase">Puan</span>
          <select
            value={filters.minRating ?? 0}
            onChange={(e) => onChange({ minRating: Number(e.target.value) || null })}
            className={selectClass}
          >
            {RATINGS.map((r) => (
              <option key={r} value={r}>
                {r === 0 ? 'Hepsi' : `${r}+`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="mono text-[10px] tracking-[0.1em] text-tx3 uppercase">Oy</span>
          <select
            value={filters.minVotes ?? 0}
            onChange={(e) => onChange({ minVotes: Number(e.target.value) || null })}
            className={selectClass}
          >
            {VOTES.map((v) => (
              <option key={v} value={v}>
                {v === 0 ? 'Hepsi' : `${v}+`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="mono text-[10px] tracking-[0.1em] text-tx3 uppercase">Dil</span>
          <select
            value={filters.language ?? ''}
            onChange={(e) => onChange({ language: e.target.value || null })}
            className={selectClass}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-[9px] border border-line bg-surf px-3 text-[12.5px] font-semibold text-tx2">
          <input type="checkbox" checked={providerOnly} onChange={(e) => onProviderOnly(e.target.checked)} className="accent-[var(--color-acc)]" />
          Sadece sağlayıcıda olanlar
        </label>

        <button type="button" onClick={onReset} className="ml-auto h-9 rounded-[9px] border border-line px-3.5 text-[12.5px] font-bold text-tx3 hover:text-acc">
          Filtreleri temizle
        </button>
      </div>

      {kindGenres.length > 0 ? (
        <div className="mt-3.5 flex flex-wrap gap-2 border-t border-line pt-3.5">
          {kindGenres.map((genre) => {
            const on = filters.genreIds.includes(genre.id)
            return (
              <button
                key={`${genre.kind}-${genre.id}`}
                type="button"
                onClick={() => toggleGenre(genre.id)}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1 text-[12.5px] ${on ? 'border-acc bg-acc/15 text-acc' : 'border-line bg-white/5 text-tx2 hover:border-acc/40'}`}
              >
                {genre.name}
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="mono mt-3 flex flex-wrap items-center gap-3 text-[11px] text-tx3">
        <span>{resultCount} sonuç listelendi</span>
        {filteredLocally ? <span className="text-gold">metin aramasında filtreler yerel uygulanıyor</span> : null}
        {filters.keywordIds.length > 0 ? <span className="text-acc">{filters.keywordIds.length} anahtar kelime seçili</span> : null}
      </div>
    </section>
  )
}
