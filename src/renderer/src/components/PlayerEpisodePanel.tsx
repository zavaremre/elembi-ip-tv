import { Art } from './Art'
import { useT } from '@/i18n'

import type { EpisodeTarget } from '@/lib/episodes'
import type { SeasonOption } from '@/hooks/usePlayback'
import type { Progress } from '@shared/types'

interface PlayerEpisodePanelProps {
  seasons: SeasonOption[]
  season: number | null
  list: EpisodeTarget[]
  loading: boolean
  currentKey: string | null
  progress: Progress[]
  onSeason: (season: number) => void
  onPick: (index: number) => void
  onClose: () => void
}

/** Season and episode picker inside the player, without leaving playback. */
export function PlayerEpisodePanel({
  seasons,
  season,
  list,
  loading,
  currentKey,
  progress,
  onSeason,
  onPick,
  onClose
}: PlayerEpisodePanelProps): React.JSX.Element {
  const t = useT()
  const watched = new Map(progress.map((row) => [row.key, row.duration > 0 ? row.position / row.duration : 0]))

  return (
    <div className="absolute right-0 bottom-12 z-20 flex max-h-[62vh] w-[420px] flex-col overflow-hidden rounded-[16px] border border-white/14 bg-ink2/96 shadow-[0_30px_70px_-22px_rgba(0,0,0,.95)] backdrop-blur-[22px]">
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
        <span className="mono text-[10px] tracking-[0.14em] text-tx3 uppercase">{t('season.episodes')}</span>
        <button type="button" onClick={onClose} aria-label="Kapat" className="ml-auto grid h-7 w-7 place-items-center rounded-[8px] bg-white/10">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {seasons.length > 1 ? (
        <div className="flex flex-wrap gap-1.5 border-b border-line px-3.5 py-2.5">
          {seasons.map((option) => (
            <button
              key={option.number}
              type="button"
              onClick={() => onSeason(option.number)}
              aria-current={option.number === season}
              className={`flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] border px-2.5 text-[11.5px] font-bold ${
                option.number === season ? 'border-acc bg-acc/15 text-acc' : 'border-line bg-white/6 text-tx2 hover:text-tx'
              }`}
            >
              {option.number}. Sezon
              <span className="mono text-[9.5px] font-normal text-tx3">{option.count}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <p className="mono px-2 py-4 text-[11px] tracking-[0.12em] text-acc uppercase">{t('search.loading')}</p>
        ) : list.length === 0 ? (
          <p className="px-2 py-4 text-[12.5px] text-tx3">{t('player.noEpisodes')}</p>
        ) : (
          list.map((episode, index) => {
            const key = `series:${episode.episodeId}`
            const ratio = watched.get(key) ?? 0
            const playing = key === currentKey
            return (
              <button
                key={episode.episodeId}
                type="button"
                onClick={() => onPick(index)}
                className={`flex w-full items-center gap-3 rounded-[11px] p-2 text-left ${playing ? 'bg-acc/14 shadow-[inset_2px_0_0_var(--color-acc)]' : 'hover:bg-white/6'}`}
              >
                <div className="relative w-[92px] shrink-0">
                  <Art src={episode.image} alt={episode.sub} shape="still" className="rounded-[7px]" />
                  {ratio > 0 ? (
                    <span className="absolute inset-x-1 bottom-1 z-4 h-[2.5px] overflow-hidden rounded-full bg-black/55">
                      <i className="block h-full bg-acc" style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }} />
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="mono text-[11px] text-acc">{String(episode.episode ?? index + 1).padStart(2, '0')}</span>
                    {playing ? <span className="mono text-[9.5px] tracking-[0.1em] text-acc uppercase">oynuyor</span> : null}
                    {ratio > 0.95 ? <span className="mono text-[9.5px] tracking-[0.1em] text-score uppercase">izlendi</span> : null}
                  </div>
                  <div className="mt-0.5 truncate text-[12.5px] font-semibold">{episode.sub.split(' · ').slice(-1)[0]}</div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
