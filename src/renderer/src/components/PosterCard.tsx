import { Art } from './Art'
import { FavoriteButton } from './FavoriteButton'

type FlagTone = 'new' | 'live' | 'rec'

/** Rails size the card themselves; grid cells are sized by the grid. */
export type CardLayout = 'rail' | 'grid'

interface PosterCardProps {
  title: string
  image: string | null
  rating?: number | null
  meta?: string | null
  /** Shown as an oversized outline numeral; only for genuine top-N rails. */
  rank?: number
  badge?: string
  /** Turkish dub or subtitled, when the provider says so. */
  audio?: 'dub' | 'sub' | null
  flag?: { text: string; tone: FlagTone }
  layout?: CardLayout
  /** Omitted where a card stands for something that cannot be favourited. */
  favorite?: boolean
  onToggleFavorite?: () => void
  onOpen: () => void
}

/** The provider rarely states this, so the badge appears only when it does. */
const AUDIO_BADGE: Record<'dub' | 'sub', string> = { dub: 'DUBLAJ', sub: 'ALTYAZI' }

const FLAG_TONE: Record<FlagTone, string> = {
  new: 'text-acc border-acc/45 bg-ink/60',
  live: 'text-white bg-live border-transparent',
  rec: 'text-white bg-rec border-transparent'
}

/** 2:3 key-art card — serves TMDB movies, top-10 series and provider VOD alike. */
export function PosterCard({
  title,
  image,
  rating,
  meta,
  rank,
  badge,
  audio,
  flag,
  layout = 'rail',
  favorite,
  onToggleFavorite,
  onOpen
}: PosterCardProps): React.JSX.Element {
  return (
    /*
     * A div holding two buttons, not one button holding another: the heart has
     * to be reachable on its own, and a nested button is neither valid nor
     * focusable.
     */
    <div className={`group relative ${layout === 'rail' ? 'w-[clamp(136px,11.5vw,186px)]' : 'w-full'}`}>
      <button type="button" onClick={onOpen} className="relative block w-full text-left">
        {rank ? (
          <span
            className="pointer-events-none absolute -left-2.5 bottom-[34px] z-3 font-disp text-[clamp(46px,4.6vw,70px)] leading-none font-black tracking-[-0.06em] text-[#0D0E14]"
            style={{ WebkitTextStroke: '2px rgba(255,255,255,.5)', fontVariationSettings: "'wdth' 100" }}
            aria-hidden="true"
          >
            {rank}
          </span>
        ) : null}

        <Art src={image} alt={title} shape="poster" className="lift shadow-[0_14px_34px_-16px_rgba(0,0,0,.9)]">
          {flag ? (
            <span className={`absolute top-2.5 left-2.5 z-3 mono flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.07em] backdrop-blur-sm ${FLAG_TONE[flag.tone]}`}>
              {flag.tone === 'live' ? <i className="pulse" /> : null}
              {flag.text}
            </span>
          ) : null}
          {badge ? (
            <span className="mono absolute right-2.5 bottom-2.5 z-3 rounded-[5px] border border-line bg-ink/70 px-1.5 py-0.5 text-[10.5px] backdrop-blur-sm">
              {badge}
            </span>
          ) : null}
          {audio ? (
            <span
              className={`mono absolute bottom-2.5 left-2.5 z-3 rounded-[5px] border px-1.5 py-0.5 text-[9.5px] font-semibold tracking-[0.08em] backdrop-blur-sm ${
                audio === 'dub' ? 'border-score/45 bg-ink/70 text-score' : 'border-acc/45 bg-ink/70 text-acc'
              }`}
            >
              {AUDIO_BADGE[audio]}
            </span>
          ) : null}
        </Art>

        <div className="mt-2.5 truncate text-[13.5px] font-bold">{title}</div>
        <div className="mono mt-0.5 flex items-center gap-1.5 text-[11px] text-tx3">
          {rating ? <span className="text-gold">★ {rating.toFixed(1).replace('.', ',')}</span> : null}
          {meta ? <span className="truncate">{meta}</span> : null}
        </div>
      </button>

      {onToggleFavorite ? <FavoriteButton active={Boolean(favorite)} onToggle={onToggleFavorite} /> : null}
    </div>
  )
}
