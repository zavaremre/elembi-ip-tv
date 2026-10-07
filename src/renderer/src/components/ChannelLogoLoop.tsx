import type { Channel } from '@shared/types'

interface ChannelLogoLoopProps {
  channels: Channel[]
  onPlay: (channel: Channel) => void
}

/** React Bits LogoLoop — fits the whole favourites list on one line, pauses on hover. */
export function ChannelLogoLoop({ channels, onPlay }: ChannelLogoLoopProps): React.JSX.Element {
  const track = [...channels, ...channels]

  return (
    <div className="loop px-[var(--pad)] py-1">
      <div className="lptrack">
        {track.map((channel, i) => (
          <button
            key={`${channel.id}-${i}`}
            type="button"
            onClick={() => onPlay(channel)}
            className="flex h-[52px] flex-none items-center gap-2.5 rounded-[12px] border border-line bg-surf px-4.5 font-disp text-[15px] font-black tracking-[-0.02em] whitespace-nowrap text-tx2 hover:border-acc/40 hover:text-tx"
          >
            <i className="pulse text-score" />
            {channel.name}
            <s className="mono text-[10.5px] font-normal text-tx3 no-underline">{channel.num}</s>
          </button>
        ))}
      </div>
    </div>
  )
}
