import { Art } from './Art'
import { clock } from '@/lib/fmt'

import type { CardLayout } from './PosterCard'
import type { Channel, NowNext } from '@shared/types'

interface ChannelCardProps {
  channel: Channel
  guide: NowNext | null
  layout?: CardLayout
  onPlay: () => void
}

/** Live channel card: what is on now, how far in, and what follows. */
export function ChannelCard({ channel, guide, layout = 'rail', onPlay }: ChannelCardProps): React.JSX.Element {
  const now = guide?.now ?? null
  const next = guide?.next ?? null

  return (
    <button
      type="button"
      onClick={onPlay}
      className={`spot group rounded-[14px] text-left ${layout === 'rail' ? 'w-[clamp(220px,19vw,268px)]' : 'w-full'}`}
    >
      <Art src={channel.logo} alt={channel.name} shape="still" contain className="lift-sm">
        <span className="mono absolute top-2.5 left-2.5 z-3 flex items-center gap-1.5 rounded-md bg-live px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.07em] text-white">
          <i className="pulse" />
          CANLI
        </span>
        <span className="mono absolute top-2.5 right-2.5 z-3 rounded-[5px] border border-line bg-ink/60 px-1.5 py-0.5 text-[10.5px] text-tx2 backdrop-blur-sm">
          {channel.num}
        </span>
        <span className="absolute bottom-2.5 left-2.5 z-3 font-disp text-[14px] font-black tracking-[-0.02em] drop-shadow-[0_2px_10px_rgba(0,0,0,.8)]">
          {channel.name}
        </span>
      </Art>

      <div className="mt-2.5 truncate text-[13.5px] font-bold">{now?.title ?? 'Yayın akışı bilinmiyor'}</div>
      <div className="mt-2 h-[3px] overflow-hidden rounded-[3px] bg-white/15">
        <i className="block h-full bg-acc shadow-[0_0_10px_var(--color-acc)]" style={{ width: `${Math.round((guide?.progress ?? 0) * 100)}%` }} />
      </div>
      <div className="mono mt-1.5 flex items-center gap-1.5 truncate text-[11px] text-tx3">
        {now ? (
          <span>
            {clock(now.start)}–{clock(now.stop)}
          </span>
        ) : null}
        {next ? (
          <span className="truncate text-tx2">
            Sıradaki {next.title} · {clock(next.start)}
          </span>
        ) : null}
      </div>
    </button>
  )
}
