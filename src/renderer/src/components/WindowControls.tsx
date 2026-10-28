import { useEffect, useState } from 'react'

/**
 * Minimise, maximise and close for a window with no system frame.
 *
 * The maximised state is read back rather than assumed, because the window can
 * also be zoomed from outside the app — a double-click on the drag band, or the
 * desktop's own shortcut — and the icon has to agree with reality. A resize is
 * the one event every one of those paths produces.
 */
export function WindowControls(): React.JSX.Element {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    let alive = true
    const read = (): void => {
      window.elembi.win
        .isMaximized()
        .then((value) => alive && setMaximized(value))
        .catch(() => undefined)
    }
    read()
    window.addEventListener('resize', read)
    return () => {
      alive = false
      window.removeEventListener('resize', read)
    }
  }, [])

  /*
   * The window paints its own 4px corners, and against the edges of the screen
   * those corners are four notches of desktop. Squared off while it fills the
   * screen; the attribute lives on the document because the rounding does.
   */
  useEffect(() => {
    document.documentElement.dataset.windowFull = maximized ? 'true' : 'false'
  }, [maximized])

  const button = 'grid h-7 w-7 place-items-center rounded-[7px] text-tx3 transition-colors hover:bg-white/10 hover:text-tx'

  return (
    <div className="nodrag flex items-center gap-1" role="group" aria-label="Pencere">
      <button type="button" onClick={() => void window.elembi.win.minimize()} aria-label="Küçült" title="Küçült" className={button}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <path d="M2.5 6h7" strokeLinecap="round" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => void window.elembi.win.toggleMaximize().then(setMaximized).catch(() => undefined)}
        aria-label={maximized ? 'Pencereye döndür' : 'Büyüt'}
        title={maximized ? 'Pencereye döndür' : 'Büyüt'}
        className={button}
      >
        {maximized ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
            <rect x="2" y="4" width="6" height="6" rx="1.2" />
            <path d="M4.4 4V2.9A.9.9 0 0 1 5.3 2H9.1a.9.9 0 0 1 .9.9v3.8a.9.9 0 0 1-.9.9H8" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
            <rect x="2.4" y="2.4" width="7.2" height="7.2" rx="1.3" />
          </svg>
        )}
      </button>

      <button
        type="button"
        onClick={() => void window.elembi.win.close()}
        aria-label="Kapat"
        title="Kapat"
        className="grid h-7 w-7 place-items-center rounded-[7px] text-tx3 transition-colors hover:bg-live hover:text-white"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
