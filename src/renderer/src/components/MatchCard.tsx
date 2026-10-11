import { Art } from './Art'
import { CountUp } from './fx/CountUp'
import { clock, matchDay } from '@/lib/fmt'
import { hue } from '@/lib/img'
import type { CardLayout } from './PosterCard'
import type { FixtureTag, Match } from '@shared/types'

interface MatchCardProps {
  match: Match
  onPlay: () => void
  onRemind: () => void
  reminded: boolean
  layout?: CardLayout
  badges: Map<string, string>
}

const TAG_LABEL: Record<FixtureTag, string> = {
  live: 'CANLI',
  scheduled: 'BAŞLIYOR',
  replay: 'BANT',
  highlights: 'ÖZET'
}

const TAG_STYLE: Record<FixtureTag, string> = {
  live: 'bg-live text-white',
  scheduled: 'text-acc',
  replay: 'border border-line bg-white/8 text-tx2',
  highlights: 'border border-line bg-white/8 text-tx2'
}

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toLocaleUpperCase('tr')

function Team({ name, badge }: { name: string; badge?: string }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      {badge ? (
        <img src={badge} alt="" loading="lazy" className="h-[42px] w-[42px] shrink-0 object-contain" />
      ) : (
        <Art src={null} alt="" hue={hue(name)} shape="box" flat className="h-[42px] w-[42px] rounded-[13px]">
          <span className="absolute inset-0 z-3 grid place-items-center font-disp text-[13px] font-black">{initials(name)}</span>
        </Art>
      )}
      <span className="line-clamp-2 text-[12.5px] font-bold text-tx2">{name}</span>
    </div>
  )
}

/** Fixture card. The tag matters: this panel's guide is full of tape-delay and highlight slots. */
export function MatchCard({ match, onPlay, onRemind, reminded, layout = 'rail', badges }: MatchCardProps): React.JSX.Element {
  const upcoming = match.start > Date.now()
  const onAir = match.start <= Date.now() && match.stop > Date.now()

  return (
    <article
      className={`spot relative overflow-hidden rounded-[20px] ${layout === 'rail' ? 'w-[clamp(272px,24vw,330px)]' : 'w-full'} border border-line bg-surf/60 p-3.5 backdrop-blur-[22px] backdrop-saturate-150 before:absolute before:inset-x-0 before:top-0 before:h-[3px] ${
        match.tag === 'live'
          ? 'before:bg-linear-to-r before:from-live before:to-[#FF7A3D]'
          : match.tag === 'scheduled'
            ? 'before:bg-linear-to-r before:from-acc before:to-[#6B4BFF]'
            : 'before:bg-white/12'
      }`}
    >
      <header className="mono flex items-center gap-2 text-[10.5px] tracking-[0.1em] text-tx3 uppercase">
        <span className="truncate">{match.league}</span>
        <span className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 font-semibold tracking-[0.07em] ${TAG_STYLE[match.tag]}`}>
          {match.tag === 'live' ? <i className="pulse" /> : null}
          {TAG_LABEL[match.tag]}
          {match.tag === 'live' && match.minute !== null ? (
            <>
              {' '}
              <CountUp to={match.minute} />&apos;
            </>
          ) : null}
        </span>
      </header>

      <div className="my-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Team name={match.home} badge={badges.get(match.home)} />
        <div className="flex flex-col items-center gap-1">
          <span className="mono text-[19px] leading-none text-tx2">{clock(match.start)}</span>
          {/* The guide reaches into tomorrow, so the hour alone does not say when. */}
          <span className="mono text-[10px] leading-none tracking-[0.07em] text-tx3 uppercase">
            {matchDay(match.start)}
          </span>
        </div>
        <Team name={match.away} badge={badges.get(match.away)} />
      </div>

      <footer className="flex items-center gap-2 border-t border-line pt-3">
        <span className="truncate text-[12px] font-semibold text-tx3">{match.channelName}</span>
        {upcoming ? (
          <button
            type="button"
            onClick={onRemind}
            aria-pressed={reminded}
            className={`ml-auto flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] border px-3.5 text-[12.5px] font-bold ${
              reminded ? 'border-acc/50 bg-acc/15 text-acc' : 'border-line bg-white/10'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            {reminded ? 'Kurulu' : 'Hatırlat'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onPlay}
            className={`ml-auto flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] px-3.5 text-[12.5px] font-bold ${
              onAir && match.tag === 'live' ? 'bg-live text-white hover:brightness-110' : 'border border-line bg-white/10'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            {onAir ? 'İzle' : 'Kanalı aç'}
          </button>
        )}
      </footer>
    </article>
  )
}
