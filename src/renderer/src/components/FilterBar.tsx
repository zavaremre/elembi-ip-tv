import type { DiscoverFilters, Genre, MediaKind, SortOption } from '@shared/types'
import { useT, type Key } from '@/i18n'

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

const SORTS: { value: SortOption; key: Key }[] = [
  { value: 'popularity.desc', key: 'filter.sort.popularity' },
  { value: 'vote_average.desc', key: 'filter.sort.score' },
  { value: 'primary_release_date.desc', key: 'filter.sort.newest' },
  { value: 'revenue.desc', key: 'filter.sort.rating' },
  { value: 'title.asc', key: 'filter.sort.title' }
]

const LANGUAGES: { value: string; key: Key }[] = [
  { value: '', key: 'filter.allLanguages' },
  { value: 'tr', key: 'lang.tr' },
  { value: 'en', key: 'lang.en' },
  { value: 'ko', key: 'lang.ko' },
  { value: 'ja', key: 'lang.ja' },
  { value: 'es', key: 'lang.es' },
  { value: 'fr', key: 'lang.fr' },
  { value: 'de', key: 'lang.de' },
  { value: 'it', key: 'lang.it' }
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
  const t = useT()
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
              {kind === 'movie' ? t('filter.kind.movie') : t('filter.kind.tv')}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5">
          <span className="mono text-[10px] tracking-[0.1em] text-tx3 uppercase">{t('filter.sort')}</span>
          <select value={filters.sort} onChange={(e) => onChange({ sort: e.target.value as SortOption })} className={selectClass}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {t(s.key)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="mono text-[10px] tracking-[0.1em] text-tx3 uppercase">{t('filter.year')}</span>
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
          <span className="mono text-[10px] tracking-[0.1em] text-tx3 uppercase">{t('filter.score')}</span>
          <select
            value={filters.minRating ?? 0}
            onChange={(e) => onChange({ minRating: Number(e.target.value) || null })}
            className={selectClass}
          >
            {RATINGS.map((r) => (
              <option key={r} value={r}>
                {r === 0 ? t('filter.any') : `${r}+`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="mono text-[10px] tracking-[0.1em] text-tx3 uppercase">{t('filter.votes')}</span>
          <select
            value={filters.minVotes ?? 0}
            onChange={(e) => onChange({ minVotes: Number(e.target.value) || null })}
            className={selectClass}
          >
            {VOTES.map((v) => (
              <option key={v} value={v}>
                {v === 0 ? t('filter.any') : `${v}+`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="mono text-[10px] tracking-[0.1em] text-tx3 uppercase">{t('filter.lang')}</span>
          <select
            value={filters.language ?? ''}
            onChange={(e) => onChange({ language: e.target.value || null })}
            className={selectClass}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {t(l.key)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-[9px] border border-line bg-surf px-3 text-[12.5px] font-semibold text-tx2">
          <input type="checkbox" checked={providerOnly} onChange={(e) => onProviderOnly(e.target.checked)} className="accent-[var(--color-acc)]" />
          {t('filter.providerOnly')}
        </label>

        <button type="button" onClick={onReset} className="ml-auto h-9 rounded-[9px] border border-line px-3.5 text-[12.5px] font-bold text-tx3 hover:text-acc">
          {t('filter.clear')}
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
        <span>{t('filter.results', { n: resultCount })}</span>
        {filteredLocally ? <span className="text-gold">{t('filter.localNote')}</span> : null}
        {filters.keywordIds.length > 0 ? <span className="text-acc">{t('filter.keywordsSelected', { n: filters.keywordIds.length })}</span> : null}
      </div>
    </section>
  )
}
