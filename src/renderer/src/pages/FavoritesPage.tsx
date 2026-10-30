import { PosterCard } from '@/components/PosterCard'
import { useT, type Key } from '@/i18n'
import { favoriteKey, type Favorites } from '@/hooks/useFavorites'
import type { Favorite } from '@shared/types'

interface FavoritesPageProps {
  favorites: Favorites
  onOpen: (row: Favorite) => void
}

const KIND_LABEL: Record<Favorite['kind'], Key> = {
  'tmdb-movie': 'fav.kind.movie',
  'tmdb-tv': 'fav.kind.tv',
  vod: 'fav.kind.vod',
  series: 'fav.kind.series'
}

/** Everything the viewer kept, newest first. */
export function FavoritesPage({ favorites, onOpen }: FavoritesPageProps): React.JSX.Element {
  const t = useT()
  return (
    <main className="shell px-[var(--pad)] pt-6 pb-24">
      <h1 className="text-[clamp(26px,3.4vw,38px)] font-extrabold">{t('fav.title')}</h1>
      <p className="mono mt-1 text-[11px] tracking-[0.1em] text-tx3 uppercase">
        {t('common.count.titles', { n: favorites.rows.length })}
      </p>

      {favorites.rows.length === 0 ? (
        <p className="mt-6 max-w-[60ch] text-[14px] text-tx2">
          {t('fav.empty')}
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-x-4 gap-y-7">
          {favorites.rows.map((row) => (
            <PosterCard
              key={row.key}
              title={row.title}
              image={row.image}
              meta={t(KIND_LABEL[row.kind])}
              layout="grid"
              favorite={favorites.has(favoriteKey(row.kind, row.id))}
              onToggleFavorite={() => favorites.toggle(row)}
              onOpen={() => onOpen(row)}
            />
          ))}
        </div>
      )}
    </main>
  )
}
