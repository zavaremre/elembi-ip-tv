import { wordmarkFor } from '@/lib/wordmark'
import { useT } from '@/i18n'

interface PlatformCardProps {
  name: string
  count: number
  /** Artwork for the service, when the category resolved to one. */
  logo: string | null
  /** Every provider category this card stands for; picks the written logo. */
  categories: string[]
  onClick: () => void
}

/* A square icon wants all the height; a wide wordmark does not. Scaling by the
 * square root of the ratio gives marks of very different shapes roughly the same
 * optical weight, so a row of them reads as one set. */
const MARK_HEIGHT = 36
const markHeight = (ratio: number): number =>
  Math.round(MARK_HEIGHT * Math.min(1, Math.max(0.52, Math.sqrt(2.9 / ratio))))

/**
 * A service as a compact badge: its written logo on the app's own dark ground,
 * with the name and count below the tile rather than inside it.
 *
 * The ground carries no brand colour. Ten services each painting their card
 * their own colour turned the row into a swatch chart and left white wordmarks
 * (Disney+, prime video) sitting on whatever hue happened to be read out of
 * them; on one dark ground the logos are the only thing that differs, which is
 * the point of the row.
 */
export function PlatformCard({ name, count, logo, categories, onClick }: PlatformCardProps): React.JSX.Element {
  const t = useT()
  const mark = wordmarkFor(categories)
  /* TMDB's artwork is square, and falls back to the full tile height. */
  const src = mark?.src ?? logo
  const height = markHeight(mark?.ratio ?? 1)

  return (
    <div className="w-[158px] shrink-0 text-center">
      <button
        type="button"
        onClick={onClick}
        aria-label={t('card.platform', { name, count })}
        className="spot group grid h-[88px] w-[158px] place-items-center overflow-hidden rounded-[12px] bg-[#101015] px-[18px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.085)] transition-all duration-300 ease-[var(--ease-out2)] hover:-translate-y-[3px] hover:bg-[#16161d] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,.16)]"
      >
        {src ? (
          <img
            src={src}
            alt={name}
            loading="lazy"
            draggable={false}
            className="max-w-[112px] object-contain"
            style={{ maxHeight: `${height}px` }}
          />
        ) : (
          /* No mark to show, so the name becomes one. */
          <span className="disp text-[16px] leading-[1.15] font-black tracking-[-0.025em] text-tx">{name}</span>
        )}
      </button>

      <div className="mt-[9px] text-[12.5px] leading-[1.32] font-semibold">
        {name}
        <span className="mono block text-[10.5px] font-normal text-tx3 tabular-nums">{t('common.count.items', { n: count })}</span>
      </div>
    </div>
  )
}
