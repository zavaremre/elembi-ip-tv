import { useEffect } from 'react'

interface TrailerModalProps {
  youtubeKey: string
  title: string
  onClose: () => void
}

/** Trailers play in YouTube's own embedded player; the stream player stays for the provider. */
export function TrailerModal({ youtubeKey, title, onClose }: TrailerModalProps): React.JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="win-clip fixed inset-0 z-90 grid place-items-center bg-ink/85 p-6 backdrop-blur-[6px]" onClick={onClose}>
      <div
        className="w-full max-w-[1100px] overflow-hidden rounded-[18px] border border-white/12 bg-black shadow-[0_40px_90px_-30px_rgba(0,0,0,.95)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="mono text-[10px] tracking-[0.14em] text-tx3 uppercase">Fragman</span>
          <span className="truncate text-[13.5px] font-bold">{title}</span>
          <button type="button" onClick={onClose} aria-label="Fragmanı kapat" className="ml-auto grid h-8 w-8 place-items-center rounded-[10px] bg-white/10">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <iframe
          title={`${title} fragmanı`}
          src={`https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1&rel=0&modestbranding=1`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="aspect-video w-full border-0"
        />
      </div>
    </div>
  )
}
