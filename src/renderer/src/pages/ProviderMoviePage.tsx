import { Art } from '@/components/Art'
import { NoiseOverlay } from '@/components/fx/NoiseOverlay'
import { useProviderMovie } from '@/hooks/useProviderMovie'
import { dur } from '@/lib/fmt'
import { backdrop, hue, logo, poster } from '@/lib/img'
import type { Progress, TmdbItem, VodItem } from '@shared/types'

interface ProviderMoviePageProps {
  item: VodItem
  progress: Progress[]
  onPlay: () => void
  onOpenTmdb: (item: TmdbItem) => void
  onBack: () => void
}

function Skeleton({ className = '' }: { className?: string }): React.JSX.Element {
  return <span className={`block animate-pulse bg-white/8 ${className}`} aria-hidden="true" />
}

/**
 * A film in the provider catalogue. Reached by clicking the film anywhere, so
 * nothing starts playing until it is asked for — the same way a series opens its
 * episode list first. TMDB dresses the page when it recognises the title; the
 * provider is what actually plays, so a miss costs only the artwork.
 */
export function ProviderMoviePage({
  item,
  progress,
  onPlay,
  onOpenTmdb,
  onBack
}: ProviderMoviePageProps): React.JSX.Element {
  const view = useProviderMovie(item)
  const tmdb = view.data
  const watched = progress.find((row) => row.key === `vod:${item.id}`)
  const ratio = watched && watched.duration > 0 ? watched.position / watched.duration : 0

  return (
    <main className="pb-24">
      <section className="relative h-[clamp(260px,34vh,360px)] -mt-[66px] overflow-hidden">
        <Art src={backdrop(tmdb?.backdrop, 'w1280')} alt={item.name} hue={hue(`vod-${item.id}`)} shape="fill" flat />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,var(--color-ink)_2%,rgba(8,8,12,.5)_48%,rgba(8,8,12,.78)_100%)]" />
        <NoiseOverlay />
        <button
          type="button"
          onClick={onBack}
          className="nodrag absolute top-[82px] left-[var(--pad)] z-5 flex items-center gap-2 rounded-[10px] border border-line bg-ink/60 px-3 py-2 text-[13px] font-bold backdrop-blur-sm hover:border-acc/40"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
            <path d="m15 6-6 6 6 6" />
          </svg>
          Geri
        </button>
      </section>

      <div className="shell relative z-5 -mt-[110px] flex gap-6 px-[var(--pad)]">
        <div className="w-[150px] shrink-0">
          <Art
            /* Nothing until TMDB answers: showing the provider cover first and
               swapping to the poster afterwards reads as a flicker. */
            src={view.loading ? null : (poster(tmdb?.poster, 'w500') ?? item.cover)}
            alt={item.name}
            hue={hue(`vod-${item.id}`)}
            shape="poster"
            className="shadow-[0_24px_54px_-20px_rgba(0,0,0,.95)]"
          />
        </div>

        <div className="min-w-0 flex-1">
          {view.loading ? (
            <Skeleton className="h-[52px] w-[46%] rounded-[10px]" />
          ) : logo(tmdb?.logo) ? (
            <img
              src={logo(tmdb?.logo) ?? ''}
              alt={item.name}
              className="mb-1 max-h-[104px] max-w-[62%] object-contain object-left drop-shadow-[0_6px_30px_rgba(0,0,0,.6)]"
            />
          ) : (
            <h1 className="text-[clamp(24px,3.4vw,42px)] leading-[0.96] font-black tracking-[-0.03em]">{item.name}</h1>
          )}

          {tmdb && tmdb.originalTitle && tmdb.originalTitle !== tmdb.title ? (
            <div className="mt-1 text-[13px] text-tx3 italic">{tmdb.originalTitle}</div>
          ) : null}

          <div className="mono mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-tx3">
            <span>{item.group}</span>
            {item.country ? <span>{item.country}</span> : null}
            {item.audio ? <span className="text-acc">{item.audio === 'dub' ? 'TÜRKÇE DUBLAJ' : 'ALTYAZILI'}</span> : null}
            {item.rating ? <span className="text-gold">★ {item.rating.toFixed(1).replace('.', ',')}</span> : null}
            {view.loading ? (
              <Skeleton className="h-3 w-24 rounded-full" />
            ) : tmdb ? (
              <>
                {tmdb.year ? <span>{tmdb.year}</span> : null}
                {dur(tmdb.runtime) ? <span>{dur(tmdb.runtime)}</span> : null}
              </>
            ) : null}
          </div>

          {view.loading ? (
            <div className="mt-3.5 flex max-w-[72ch] flex-col gap-2">
              <Skeleton className="h-3 w-full rounded-full" />
              <Skeleton className="h-3 w-[92%] rounded-full" />
              <Skeleton className="h-3 w-[64%] rounded-full" />
            </div>
          ) : tmdb?.overview ? (
            <p className="mt-3.5 max-w-[72ch] text-[14.5px] leading-[1.62] text-tx2">{tmdb.overview}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onPlay}
              className="spec flex h-11 items-center gap-2.5 rounded-[12px] bg-tx px-5 text-[14px] font-bold text-ink"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              {ratio > 0 && ratio < 0.95 ? 'Devam et' : 'Oynat'}
            </button>
            {tmdb ? (
              <button
                type="button"
                onClick={() => onOpenTmdb(tmdb)}
                className="flex h-11 items-center rounded-[12px] border border-line bg-white/8 px-5 text-[13.5px] font-bold hover:border-acc/40"
              >
                TMDB detayı
              </button>
            ) : null}
            {ratio > 0 && ratio < 0.95 ? (
              <span className="mono flex items-center gap-2 text-[11px] text-tx3">
                <span className="block h-[3px] w-24 overflow-hidden rounded-full bg-white/15">
                  <i className="block h-full bg-acc" style={{ width: `${Math.round(ratio * 100)}%` }} />
                </span>
                %{Math.round(ratio * 100)}
              </span>
            ) : null}
          </div>

          {!view.loading && !tmdb ? (
            <p className="mt-4 text-[12.5px] text-tx3">
              TMDB bu başlığı tanımadı, bu yüzden afiş ve özet yok. Oynatma sağlayıcıdan çalışır.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  )
}
