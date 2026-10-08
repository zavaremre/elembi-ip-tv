import { NoiseOverlay } from './fx/NoiseOverlay'
import { hue } from '@/lib/img'

interface PlatformCardProps {
  name: string
  count: number
  /** Official artwork when the category is a service we could identify. */
  logo: string | null
  /** Brand colour read out of that artwork; null when it carries none. */
  color: string | null
  onClick: () => void
}

/** Mixes a hex colour towards black, for the far end of the card's gradient. */
function darken(hex: string, amount: number): string {
  const value = hex.replace('#', '')
  if (value.length !== 6) return hex
  const channel = (at: number): string => {
    const raw = Number.parseInt(value.slice(at, at + 2), 16)
    return Math.round(raw * (1 - amount)).toString(16).padStart(2, '0')
  }
  return `#${channel(0)}${channel(2)}${channel(4)}`
}

/**
 * A service as a card. The ground is the brand's own colour, read from its logo
 * in the main process, so Netflix is Netflix red without a palette written into
 * the code; a logo that carries no colour — a white wordmark — falls back to a
 * tint derived from the name, which at least stays the same between sessions.
 */
export function PlatformCard({ name, count, logo, color, onClick }: PlatformCardProps): React.JSX.Element {
  const tint = hue(`platform-${name}`)
  const ground = color
    ? `linear-gradient(145deg, ${color}, ${darken(color, 0.62)})`
    : `linear-gradient(145deg, hsl(${tint} 62% 24%), hsl(${tint + 28} 55% 13%))`

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${name}, ${count} içerik`}
      className="spot group relative flex h-[116px] w-[206px] shrink-0 flex-col justify-end overflow-hidden rounded-[16px] border border-white/12 p-3.5 text-left transition-transform hover:scale-[1.02] hover:border-white/25"
      style={{ background: ground }}
    >
      {logo ? (
        /*
         * The logo twice: a large blurred copy as the card's own light, and the
         * crisp mark on top. That is what makes it read as a designed card rather
         * than a picture dropped on a colour.
         */
        <img
          src={logo}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -top-6 -right-7 h-[130px] w-[130px] scale-125 object-contain opacity-30 blur-[26px] transition-opacity duration-300 group-hover:opacity-45"
        />
      ) : (
        <span
          className="pointer-events-none absolute -top-8 -right-6 h-28 w-28 rounded-full opacity-40 blur-[22px]"
          style={{ background: `hsl(${tint + 14} 85% 52%)` }}
          aria-hidden="true"
        />
      )}

      {/* Keeps the text legible whatever the brand colour turns out to be. */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(0deg, rgba(0,0,0,.55), rgba(0,0,0,0) 62%)' }}
        aria-hidden="true"
      />
      <NoiseOverlay />

      {logo ? (
        /* The mark carries the name, so repeating it as text would crowd the card. */
        <img
          src={logo}
          alt={name}
          loading="lazy"
          /* Feathered edges so the mark sits in the card instead of on it. */
          className="relative mb-1 max-h-[44px] max-w-[132px] self-start object-contain object-left drop-shadow-[0_2px_12px_rgba(0,0,0,.45)]"
          style={{
            maskImage: 'radial-gradient(118% 118% at 50% 50%, #000 72%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(118% 118% at 50% 50%, #000 72%, transparent 100%)'
          }}
        />
      ) : (
        <span className="relative text-[15px] leading-[1.15] font-extrabold tracking-[-0.01em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,.6)]">
          {name}
        </span>
      )}

      <span className="mono relative text-[11px] text-white/75">{count} içerik</span>
    </button>
  )
}
