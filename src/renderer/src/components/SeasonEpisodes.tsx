import { useState } from 'react'
import { Art } from './Art'
import { useSeasonEpisodes } from '@/hooks/useSeasonEpisodes'
import { episodeKey, fetchSeasonEpisodes, toEpisodeTarget, type EpisodeTarget, type PlayableEpisode } from '@/lib/episodes'
import type { EpisodeSource } from '@/hooks/usePlayback'
import { dur } from '@/lib/fmt'
import { backdrop, poster } from '@/lib/img'
import type { Progress, SeasonSummary } from '@shared/types'

interface SeasonEpisodesProps {
  tvId: number
  showTitle: string
  seasons: SeasonSummary[]
  /** Xtream series id when the title was matched in the provider catalogue. */
  providerSeriesId: number | null
  imdbId?: string | null
  progress: Progress[]
  onPlayEpisodes: (episodes: EpisodeTarget[], index: number, source: EpisodeSource) => void
}

/** Season picker plus the episode list, merged from TMDB and the provider. */
export function SeasonEpisodes({
  tvId,
  showTitle,
  seasons,
  providerSeriesId,
  imdbId,
  progress,
  onPlayEpisodes
}: SeasonEpisodesProps): React.JSX.Element {
  const [active, setActive] = useState(seasons[0]?.number ?? 1)
  const view = useSeasonEpisodes(tvId, active, providerSeriesId)

  const watched = new Map(progress.map((row) => [row.key, row.duration > 0 ? row.position / row.duration : 0]))

  /** Only playable episodes go into the queue, so auto-advance never stalls. */
  const playable = (view.data?.episodes ?? []).filter((episode) => Boolean(episode.url))
  const queue = playable.map((episode) => toEpisodeTarget({ tvId, showTitle, season: active, imdbId }, episode))

  /** Lets the player browse other seasons without duplicating the merge logic. */
  const source: EpisodeSource = {
    seasons: seasons.map((season) => ({ number: season.number, label: season.name, count: season.episodes })),
    activeSeason: active,
    load: async (season) => {
      const loaded = await fetchSeasonEpisodes(tvId, season, providerSeriesId)
      return loaded.episodes
        .filter((episode) => Boolean(episode.url))
        .map((episode) => toEpisodeTarget({ tvId, showTitle, season, imdbId }, episode))
    }
  }

  const play = (episode: PlayableEpisode): void => {
    const index = playable.findIndex((candidate) => candidate.number === episode.number)
    if (index < 0) return
    onPlayEpisodes(queue, index, source)
  }

  return (
    <section className="shell px-[var(--pad)]">
      <div className="flex flex-wrap items-center gap-3 pb-4">
        <h2 className="text-[19px] font-extrabold lg:text-[25px]">Bölümler</h2>
        <span className="mono pt-1 text-[11px] tracking-[0.08em] text-tx3">
          {seasons.length} SEZON
          {view.data ? ` · ${view.data.episodes.length} BÖLÜM` : ''}
          {view.data && providerSeriesId !== null ? ` · SAĞLAYICIDA ${view.data.providerCount}` : ''}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4" style={{ scrollbarWidth: 'none' }}>
        {seasons.map((season) => (
          <button
            key={season.number}
            type="button"
            onClick={() => setActive(season.number)}
            aria-current={season.number === active}
            className={`flex h-9 shrink-0 items-center gap-2 rounded-[10px] border px-3.5 text-[12.5px] font-bold ${
              season.number === active ? 'border-acc bg-acc/15 text-acc' : 'border-line bg-surf text-tx2 hover:border-acc/40'
            }`}
          >
            {season.name}
            <span className="mono text-[10.5px] font-normal text-tx3">{season.episodes}</span>
          </button>
        ))}
      </div>

      {view.error ? (
        <p className="text-[13px] text-live">{view.error}</p>
      ) : view.loading ? (
        <p className="mono text-[12px] tracking-[0.12em] text-acc uppercase">bölümler yükleniyor…</p>
      ) : !view.data || view.data.episodes.length === 0 ? (
        <p className="text-[13px] text-tx3">Bu sezon için bölüm bilgisi yok.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {view.data.episodes.map((episode) => {
            const canPlay = Boolean(episode.url)
            const ratio = watched.get(`series:${episode.providerId ?? episodeKey(tvId, active, episode.number)}`) ?? 0
            return (
              <li key={episode.number}>
                <div
                  className={`spot flex gap-4 rounded-[16px] border border-line bg-surf/55 p-3 ${canPlay ? '' : 'opacity-60'}`}
                >
                  <div className="relative w-[164px] shrink-0">
                    <Art
                      src={backdrop(episode.still, 'w300') ?? episode.providerStill}
                      alt={episode.name}
                     
                      shape="still"
                      className="rounded-[10px]"
                    />
                    {canPlay ? (
                      <span className="pointer-events-none absolute inset-0 z-3 grid place-items-center">
                        <span className="grid h-9 w-9 place-items-center rounded-full border border-white/65 bg-ink/50 backdrop-blur-sm">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                        </span>
                      </span>
                    ) : null}
                    {ratio > 0 ? (
                      <span className="absolute inset-x-1.5 bottom-1.5 z-4 h-[3px] overflow-hidden rounded-full bg-black/55">
                        <i className="block h-full bg-acc" style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }} />
                      </span>
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="mono text-[12px] text-acc">{String(episode.number).padStart(2, '0')}</span>
                      <h3 className="truncate text-[15px] font-bold">{episode.name}</h3>
                      {episode.rating > 0 ? <span className="mono text-[11px] text-gold">★ {episode.rating.toFixed(1).replace('.', ',')}</span> : null}
                      <span className="mono text-[11px] text-tx3">
                        {[episode.air, dur(episode.runtime)].filter(Boolean).join(' · ')}
                      </span>
                      {ratio > 0.95 ? (
                        <span className="mono flex items-center gap-1 text-[10px] tracking-[0.08em] text-score uppercase">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                            <path d="m5 13 4 4L19 7" />
                          </svg>
                          izlendi
                        </span>
                      ) : null}
                    </div>
                    {episode.overview ? (
                      <p className="mt-1.5 line-clamp-2 max-w-[80ch] text-[13px] leading-[1.55] text-tx2">{episode.overview}</p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center">
                    {canPlay ? (
                      <button
                        type="button"
                        onClick={() => play(episode)}
                        className="flex h-9 items-center gap-2 rounded-[10px] bg-tx px-4 text-[12.5px] font-bold text-ink"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                        {ratio > 0 && ratio < 0.95 ? 'Devam et' : 'Oynat'}
                      </button>
                    ) : (
                      <span className="mono text-[10.5px] tracking-[0.08em] text-tx3 uppercase">sağlayıcıda yok</span>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
