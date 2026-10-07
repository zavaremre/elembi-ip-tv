import { Art } from './Art'
import { left } from '@/lib/fmt'
import { hue } from '@/lib/img'
import type { Progress } from '@shared/types'

interface ContinueCardProps {
  item: Progress
  onPlay: () => void
}

/** Up-next card: how much is left, not how much was watched. */
export function ContinueCard({ item, onPlay }: ContinueCardProps): React.JSX.Element {
  const ratio = item.duration > 0 ? item.position / item.duration : 0

  return (
    <button type="button" onClick={onPlay} className="spot w-[clamp(230px,20vw,290px)] rounded-[14px] text-left">
      <Art src={item.image ?? null} alt={item.title} hue={hue(item.title)} shape="still" className="lift-sm">
        <span className="absolute inset-0 z-3 grid place-items-center">
          <span className="grid h-[42px] w-[42px] place-items-center rounded-full border-[1.5px] border-white/65 bg-ink/50 backdrop-blur-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </span>
      </Art>
      <div className="mt-2 h-[3px] overflow-hidden rounded-[3px] bg-white/15">
        <i className="block h-full bg-acc shadow-[0_0_10px_var(--color-acc)]" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      <div className="mt-2.5 truncate text-[13.5px] font-bold">{item.title}</div>
      <div className="mono mt-1 flex gap-1.5 truncate text-[11px] text-tx3">
        <em className="text-acc not-italic">{left(item.position, item.duration)}</em>
        {item.sub ? <span className="truncate">· {item.sub}</span> : null}
      </div>
    </button>
  )
}
