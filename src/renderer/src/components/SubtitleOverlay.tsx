import type { SubtitleStyle } from '@/hooks/useSubtitleStyle'

interface SubtitleOverlayProps {
  lines: string[]
  style: SubtitleStyle
  /** Lifts the text clear of the control bar while it is on screen. */
  raised: boolean
}

const EDGE: Record<SubtitleStyle['edge'], string> = {
  shadow: '0 2px 6px rgba(0,0,0,.95), 0 0 2px rgba(0,0,0,.9)',
  outline:
    '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 4px rgba(0,0,0,.8)',
  none: 'none'
}

/** Subtitles drawn by the app, so their size, colour and position are ours. */
export function SubtitleOverlay({ lines, style, raised }: SubtitleOverlayProps): React.JSX.Element | null {
  if (lines.length === 0) return null

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-5 flex flex-col items-center gap-1 px-[8%] text-center"
      style={{ bottom: `${style.bottom + (raised ? 9 : 0)}%` }}
    >
      {lines.map((line, index) => (
        <span
          key={`${index}-${line.slice(0, 12)}`}
          className="max-w-[90%] rounded-[6px] px-2.5 py-0.5 leading-[1.35] font-semibold"
          style={{
            fontSize: `calc(${style.scale} * clamp(16px, 2.4vw, 34px))`,
            color: style.color,
            backgroundColor: style.background > 0 ? `rgba(0,0,0,${style.background})` : 'transparent',
            textShadow: EDGE[style.edge],
            whiteSpace: 'pre-line'
          }}
        >
          {line.replace(/<[^>]+>/g, '')}
        </span>
      ))}
    </div>
  )
}
