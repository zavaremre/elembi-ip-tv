import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export type Section = 'home' | 'search' | 'movies' | 'series' | 'live' | 'sports' | 'settings'

interface AppHeaderProps {
  section: Section
  onSection: (section: Section) => void
  onSearch: () => void
  onRefresh: () => void
  refreshing: boolean
  providerOk: boolean
  canGoBack: boolean
  onBack: () => void
}

const NAV: { id: Section; label: string }[] = [
  { id: 'home', label: 'Ana Sayfa' },
  { id: 'search', label: 'Keşfet' },
  { id: 'movies', label: 'Filmler' },
  { id: 'series', label: 'Diziler' },
  { id: 'live', label: 'Canlı TV' },
  { id: 'sports', label: 'Spor' }
]

/** Glass header with the React Bits PillNav indicator; doubles as the window drag region. */
export function AppHeader({
  section,
  onSection,
  onSearch,
  onRefresh,
  refreshing,
  providerOk,
  canGoBack,
  onBack
}: AppHeaderProps): React.JSX.Element {
  const [scrolled, setScrolled] = useState(false)
  const [pill, setPill] = useState({ left: 0, width: 0 })
  const navRef = useRef<HTMLElement>(null)
  const hovered = useRef<Section | null>(null)
  const isMac = window.akis.app.platform === 'darwin'

  useEffect(() => {
    const scroller = document.getElementById('page')
    if (!scroller) return
    const onScroll = (): void => setScrolled(scroller.scrollTop > 40)
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])

  const place = (id: Section | null): void => {
    const nav = navRef.current
    const target = nav?.querySelector<HTMLButtonElement>(`[data-nav="${id ?? section}"]`)
    if (target) setPill({ left: target.offsetLeft, width: target.offsetWidth })
  }

  useLayoutEffect(() => {
    place(null)
    const onResize = (): void => place(hovered.current)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])

  return (
    <header
      className={`drag sticky top-0 z-60 flex h-[66px] shrink-0 items-center gap-4 px-[var(--pad)] backdrop-blur-[26px] backdrop-saturate-[1.7] transition-colors lg:gap-9 ${
        scrolled ? 'border-b border-line bg-ink/85' : 'border-b border-transparent bg-ink/40'
      } ${isMac ? 'pl-[86px]' : ''}`}
    >
      {/* drag must be repeated here: -webkit-app-region does not inherit, so this
          wrapper would otherwise carve the draggable band out of the header. */}
      <div className="drag shell flex items-center gap-4 lg:gap-9">
      {canGoBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Geri"
          className="nodrag grid h-9 w-9 flex-none place-items-center rounded-[10px] border border-line bg-white/7 hover:border-acc/40"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" className="text-tx2" aria-hidden="true">
            <path d="m15 6-6 6 6 6" />
          </svg>
        </button>
      ) : null}

      <div className="flex flex-none items-center gap-2.5">
        <span className="relative h-[26px] w-[26px] rounded-[8px] bg-linear-to-br from-acc to-[#6B4BFF] shadow-[0_0_18px_rgba(0,216,255,.45)]">
          <span className="absolute top-[7px] left-[9px] border-y-[6px] border-l-[8px] border-y-transparent border-l-ink" />
        </span>
        <b className="gtext font-disp text-[19px] font-black tracking-[-0.03em]">AKIŞ</b>
      </div>

      <nav ref={navRef} className="nodrag relative hidden gap-0.5 text-[14px] font-semibold md:flex" onMouseLeave={() => { hovered.current = null; place(null) }}>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 z-0 h-[34px] -translate-y-1/2 rounded-[9px] border border-line bg-white/10 transition-[left,width] duration-[380ms] ease-[var(--ease-out2)]"
          style={{ left: pill.left, width: pill.width, opacity: pill.width ? 1 : 0 }}
        />
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            data-nav={item.id}
            onClick={() => onSection(item.id)}
            onMouseEnter={() => { hovered.current = item.id; place(item.id) }}
            className={`relative z-1 rounded-[9px] px-3.5 py-1.5 ${section === item.id ? 'text-tx' : 'text-tx2 hover:text-tx'}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="nodrag ml-auto flex items-center gap-2.5">
        <button
          type="button"
          onClick={onSearch}
          className="hidden h-9 items-center gap-2.5 rounded-[10px] border border-line bg-white/7 px-3 text-[13px] text-tx3 hover:text-tx2 sm:flex"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M16.5 16.5 21 21" />
          </svg>
          Ara veya sor
          <kbd className="mono rounded-[4px] bg-white/10 px-1.5 py-0.5 text-[11px] text-tx2">⌘K</kbd>
        </button>

        <button
          type="button"
          onClick={onRefresh}
          aria-label="Listeleri yenile"
          className="grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-white/7"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
            className={refreshing ? 'animate-spin text-acc' : 'text-tx2'}
          >
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <path d="M21 4v5h-5" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => onSection('settings')}
          aria-label="Ayarlar ve sağlayıcı durumu"
          className="relative grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-white/7"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="text-tx2" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15H4.5a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.06-.06A2 2 0 1 1 8.57 5.2l.06.06A1.7 1.7 0 0 0 10.5 5.6V5.5a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 11h.1a2 2 0 1 1 0 4h-.1Z" />
          </svg>
          <span
            className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-ink ${providerOk ? 'bg-score' : 'bg-live'}`}
            aria-label={providerOk ? 'Sağlayıcı bağlı' : 'Sağlayıcı bağlı değil'}
          />
        </button>

        <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-linear-to-br from-[#FF2D7E] to-[#FFB03A] text-[14px] font-extrabold text-[#1A0A12]">
          EZ
        </span>
        </div>
      </div>
    </header>
  )
}
