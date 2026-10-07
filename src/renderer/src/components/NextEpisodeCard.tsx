import { useEffect, useRef, useState } from 'react'
import { Art } from './Art'
import { hue } from '@/lib/img'

interface NextEpisodeCardProps {
  title: string
  sub?: string
  image?: string | null
  seconds: number
  onPlay: () => void
  onCancel: () => void
}

/** Countdown to the next episode, the way a streaming app hands over. */
export function NextEpisodeCard({ title, sub, image, seconds, onPlay, onCancel }: NextEpisodeCardProps): React.JSX.Element {
  const [left, setLeft] = useState(seconds)
  /**
   * The ticker must not depend on the callback's identity: the player re-renders
   * several times a second, which would keep restarting the timer.
   */
  const playRef = useRef(onPlay)
  playRef.current = onPlay

  useEffect(() => {
    const timer = window.setInterval(() => setLeft((value) => value - 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (left <= 0) playRef.current()
  }, [left])

  return (
    <div className="absolute right-[var(--pad)] bottom-28 z-20 flex w-[352px] gap-3.5 rounded-[16px] border border-white/16 bg-ink2/92 p-3.5 shadow-[0_26px_60px_-20px_rgba(0,0,0,.95)] backdrop-blur-[22px]">
      <div className="w-[116px] shrink-0">
        <Art src={image ?? null} alt={title} hue={hue(title)} shape="still" className="rounded-[10px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mono text-[10px] tracking-[0.14em] text-acc uppercase">Sıradaki bölüm · {left}</div>
        <div className="mt-1 truncate text-[13.5px] font-bold">{title}</div>
        {sub ? <div className="mono mt-0.5 truncate text-[11px] text-tx3">{sub}</div> : null}
        <div className="mt-2.5 flex gap-2">
          <button type="button" onClick={onPlay} className="h-8 rounded-[9px] bg-tx px-3.5 text-[12.5px] font-bold text-ink">
            Şimdi oynat
          </button>
          <button type="button" onClick={onCancel} className="h-8 rounded-[9px] border border-line bg-white/8 px-3.5 text-[12.5px] font-bold">
            İptal
          </button>
        </div>
      </div>
    </div>
  )
}
