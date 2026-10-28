import { PosterCard } from '@/components/PosterCard'
import { favoriteKey, type Favorites } from '@/hooks/useFavorites'
import type { Favorite } from '@shared/types'

interface FavoritesPageProps {
  favorites: Favorites
  onOpen: (row: Favorite) => void
}

const KIND_LABEL: Record<Favorite['kind'], string> = {
  'tmdb-movie': 'film',
  'tmdb-tv': 'dizi',
  vod: 'film · sağlayıcı',
  series: 'dizi · sağlayıcı'
}

/** Everything the viewer kept, newest first. */
export function FavoritesPage({ favorites, onOpen }: FavoritesPageProps): React.JSX.Element {
  return (
    <main className="shell px-[var(--pad)] pt-6 pb-24">
      <h1 className="text-[clamp(26px,3.4vw,38px)] font-extrabold">Favorilerim</h1>
      <p className="mono mt-1 text-[11px] tracking-[0.1em] text-tx3 uppercase">
        {favorites.rows.length} BAŞLIK
      </p>

      {favorites.rows.length === 0 ? (
        <p className="mt-6 max-w-[60ch] text-[14px] text-tx2">
          Henüz bir şey eklemediniz. Bir film veya dizinin üzerine gelip kalbe dokunduğunuzda burada
          toplanır; liste bu bilgisayarda kalır, hiçbir yere gönderilmez.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-x-4 gap-y-7">
          {favorites.rows.map((row) => (
            <PosterCard
              key={row.key}
              title={row.title}
              image={row.image}
              meta={KIND_LABEL[row.kind]}
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
