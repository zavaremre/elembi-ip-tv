import { useState } from 'react'
import { tc } from '@/lib/fmt'

interface PlayerSeekBarProps {
  time: number
  duration: number
  /** Absolute position, already including any remux offset. */
  buffered: number
  onSeek: (seconds: number) => void
}

/**
 * Seeking commits on release. A remux pipe restarts on every seek, so firing
 * per drag increment would relaunch ffmpeg dozens of times and never settle.
 */
export function PlayerSeekBar({ time, duration, buffered, onSeek }: PlayerSeekBarProps): React.JSX.Element {
  const [scrub, setScrub] = useState<number | null>(null)
  const position = scrub ?? time
  const pct = (value: number): string => `${Math.min(100, Math.max(0, (value / duration) * 100))}%`

  const commit = (): void => {
    if (scrub === null) return
    onSeek(scrub)
    setScrub(null)
  }

  return (
    <div className="group relative mb-3 h-5">
      <div className="absolute inset-x-0 top-1/2 h-[5px] -translate-y-1/2 overflow-hidden rounded-full bg-white/22">
        <i className="absolute inset-y-0 left-0 bg-white/30" style={{ width: pct(buffered) }} />
        <i className="absolute inset-y-0 left-0 bg-acc" style={{ width: pct(position) }} />
      </div>

      <span
        className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-acc shadow-[0_0_10px_var(--color-acc)] transition-transform group-hover:scale-110"
        style={{ left: pct(position) }}
      />

      {scrub !== null ? (
        <span
          className="mono pointer-events-none absolute -top-7 -translate-x-1/2 rounded-[7px] border border-line bg-ink/90 px-1.5 py-0.5 text-[11px]"
          style={{ left: pct(scrub) }}
        >
          {tc(scrub)}
        </span>
      ) : null}

      <label className="absolute inset-0">
        <span className="sr-only">Konum</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(duration))}
          step={1}
          value={Math.floor(position)}
          onChange={(e) => setScrub(Number(e.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
          className="h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  )
}
