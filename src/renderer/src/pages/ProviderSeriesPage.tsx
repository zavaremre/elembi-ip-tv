import { useState } from 'react'
import { useT } from '@/i18n'
import { FavoriteButton } from '@/components/FavoriteButton'
import { favoriteKey, type Favorites } from '@/hooks/useFavorites'
import { Art } from '@/components/Art'
import { NoiseOverlay } from '@/components/fx/NoiseOverlay'
import type { EpisodeSource } from '@/hooks/usePlayback'
import type { EpisodeTarget } from '@/lib/episodes'
import { useProviderSeries, type ProviderEpisode } from '@/hooks/useProviderSeries'
import { backdrop, logo, poster } from '@/lib/img'
import { score } from '@/lib/fmt'
import type { Progress, TmdbItem, VodItem } from '@shared/types'

type ProviderSeriesEpisodes = ProviderEpisode[]

interface ProviderSeriesPageProps {
  item: VodItem
  progress: Progress[]
  onPlayEpisodes: (episodes: EpisodeTarget[], index: number, source: EpisodeSource) => void
  favorites: Favorites
  onOpenTmdb: (item: TmdbItem) => void
  onBack: () => void
}

function Skeleton({ className = '' }: { className?: string }): React.JSX.Element {
  return <span className={`block animate-pulse bg-white/8 ${className}`} aria-hidden="true" />
}

/** Season and episode list for a series in the provider catalogue. */
export function ProviderSeriesPage({ item, progress, onPlayEpisodes, favorites, onOpenTmdb, onBack }: ProviderSeriesPageProps): React.JSX.Element {
  const t = useT()
  const view = useProviderSeries(item)
  const [activeSeason, setActiveSeason] = useState<number | null>(null)

  const seasons = view.data?.seasons ?? []
  const current = activeSeason ?? seasons[0]?.season ?? null
  const episodes = seasons.find((season) => season.season === current)?.episodes ?? []
  const tmdb = view.data?.tmdb ?? null
  const watched = new Map(progress.map((row) => [row.key, row.duration > 0 ? row.position / row.duration : 0]))

  const toQueue = (seasonNumber: number, list: ProviderSeriesEpisodes): EpisodeTarget[] =>
    list.map((episode) => ({
      url: episode.url,
      title: item.name,
      sub: `${t('episode.seasonEpisode', { season: seasonNumber, episode: episode.num })}${episode.title ? ` · ${episode.title}` : ''}`,
      image: episode.still ?? item.cover,
      episodeId: episode.id,
      season: seasonNumber,
      episode: episode.num
    }))

  /** Everything is already loaded, so season switching inside the player is local. */
  const source: EpisodeSource = {
    seasons: seasons.map((season) => ({
      number: season.season,
      label: t('season.label', { n: season.season }),
      count: season.episodes.length
    })),
    activeSeason: current ?? 1,
    load: (seasonNumber) =>
      Promise.resolve(toQueue(seasonNumber, seasons.find((season) => season.season === seasonNumber)?.episodes ?? []))
  }

  /** The whole season is queued, so playback rolls into the next episode. */
  const queue: EpisodeTarget[] = episodes.map((episode) => ({
    url: episode.url,
    title: item.name,
    sub: `${t('episode.seasonEpisode', { season: current ?? 1, episode: episode.num })}${episode.title ? ` · ${episode.title}` : ''}`,
    image: episode.still ?? item.cover,
    episodeId: episode.id,
    season: current ?? undefined,
    episode: episode.num
  }))

  return (
    <main className="pb-24">
      <section className="relative h-[clamp(474px,62vh,656px)] -mt-[66px] overflow-hidden">
        <Art src={backdrop(tmdb?.backdrop, 'original')} alt={item.name} shape="fill" anchor="top" flat />
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
          <div className="mono mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-tx3">
            <span>{item.group}</span>
            {item.country ? <span>{item.country}</span> : null}
            {item.rating ? <span className="text-gold">★ {score(item.rating, t)}</span> : null}
            {view.loading ? (
              <Skeleton className="h-3 w-28 rounded-full" />
            ) : view.data ? (
              <span>
                {t('season.seasons', { n: seasons.length })} ·{' '}
                {t('season.episodeCount', { n: view.data.episodeCount })}
              </span>
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
            {episodes[0] ? (
              <button
                type="button"
                onClick={() => onPlayEpisodes(queue, 0, source)}
                className="spec flex h-11 items-center gap-2.5 rounded-[12px] bg-tx px-5 text-[14px] font-bold text-ink"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                {t('season.playFirst')}
              </button>
            ) : null}
            <FavoriteButton
              variant="bar"
              active={favorites.has(favoriteKey('series', item.id))}
              onToggle={() =>
                favorites.toggle({
                  kind: 'series',
                  id: item.id,
                  title: item.name,
                  image: poster(tmdb?.poster, 'w500') ?? item.cover
                })
              }
            />

            {tmdb ? (
              <button
                type="button"
                onClick={() => onOpenTmdb(tmdb)}
                className="flex h-11 items-center rounded-[12px] border border-line bg-white/8 px-5 text-[13.5px] font-bold hover:border-acc/40"
              >
                {t('detail.tmdbDetail')}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <section className="shell mt-9 px-[var(--pad)]">
        {view.error ? (
          <p className="text-[13px] text-live">{view.error}</p>
        ) : view.loading ? (
          <>
            <div className="flex gap-2 pb-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-9 w-24 rounded-[10px]" />
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 rounded-[16px] border border-line bg-surf/40 p-3">
                  <Skeleton className="aspect-video w-[148px] shrink-0 rounded-[10px]" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Skeleton className="h-3.5 w-[42%] rounded-full" />
                    <Skeleton className="h-3 w-[24%] rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : seasons.length === 0 ? (
          <p className="text-[14px] text-tx3">{t('season.noList')}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 pb-4">
              {seasons.map((season) => (
                <button
                  key={season.season}
                  type="button"
                  onClick={() => setActiveSeason(season.season)}
                  aria-current={season.season === current}
                  className={`flex h-9 shrink-0 items-center gap-2 rounded-[10px] border px-3.5 text-[12.5px] font-bold ${
                    season.season === current ? 'border-acc bg-acc/15 text-acc' : 'border-line bg-surf text-tx2 hover:border-acc/40'
                  }`}
                >
                  {season.season}. Sezon
                  <span className="mono text-[10.5px] font-normal text-tx3">{season.episodes.length}</span>
                </button>
              ))}
            </div>

            <ul className="flex flex-col gap-2">
              {episodes.map((episode, index) => {
                const ratio = watched.get(`series:${episode.id}`) ?? 0
                return (
                  <li key={episode.id}>
                    <button
                      type="button"
                      onClick={() => onPlayEpisodes(queue, index, source)}
                      className="spot flex w-full items-center gap-4 rounded-[16px] border border-line bg-surf/55 p-3 text-left hover:border-acc/40"
                    >
                      <div className="relative w-[148px] shrink-0">
                        <Art
                          src={episode.still}
                          alt={episode.title}
                          shape="still"
                          className="rounded-[10px]"
                        />
                        <span className="pointer-events-none absolute inset-0 z-3 grid place-items-center">
                          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/65 bg-ink/50 backdrop-blur-sm">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                          </span>
                        </span>
                        {ratio > 0 ? (
                          <span className="absolute inset-x-1.5 bottom-1.5 z-4 h-[3px] overflow-hidden rounded-full bg-black/55">
                            <i className="block h-full bg-acc" style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }} />
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="mono text-[12px] text-acc">{String(episode.num).padStart(2, '0')}</span>
                          <h3 className="truncate text-[15px] font-bold">{episode.title || t('season.episode', { n: episode.num })}</h3>
                          {ratio > 0.95 ? (
                            <span className="mono flex items-center gap-1 text-[10px] tracking-[0.08em] text-score uppercase">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                                <path d="m5 13 4 4L19 7" />
                              </svg>
                              izlendi
                            </span>
                          ) : null}
                        </div>
                        <div className="mono mt-1 text-[11px] text-tx3">
                          {ratio > 0 && ratio < 0.95 ? t('season.resumeNote') : t('season.playable', { season: current })}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>
    </main>
  )
}
