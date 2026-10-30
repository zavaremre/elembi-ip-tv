import { Art } from './Art'
import { useT } from '@/i18n'
import { useRailScroll } from '@/hooks/useRailScroll'
import type { ReactNode } from 'react'

interface RowProps {
  title: string
  meta?: string
  tagline?: string
  action?: string
  onAction?: () => void
  loading?: boolean
  error?: string | null
  empty?: string
  skeleton?: 'poster' | 'still'
  children: ReactNode
}

const SKELETON_COUNT = 8

/** Section shell for every horizontal rail: heading, state line and the scroller itself. */
export function Row({
  title,
  meta,
  tagline,
  action,
  onAction,
  loading,
  error,
  empty,
  skeleton = 'poster',
  children
}: RowProps): React.JSX.Element {
  const t = useT()
  const rail = useRailScroll()

  return (
    <section className="group/row relative mb-7 lg:mb-10">
      <div className="flex items-center gap-3 px-[var(--pad)] pb-3.5">
        <h2 className="text-[19px] font-extrabold lg:text-[25px]">{title}</h2>
        {meta ? <span className="mono pt-1 text-[11px] tracking-[0.08em] text-tx3">{meta}</span> : null}
        {tagline ? <span className="border-l border-line pl-3 text-[13px] text-tx3">{tagline}</span> : null}
        {action ? (
          <button
            type="button"
            onClick={onAction}
            className="ml-auto flex items-center gap-1.5 text-[13px] font-bold text-tx3 hover:text-acc"
          >
            {action}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="px-[var(--pad)] text-[13px] text-live">{error}</p>
      ) : loading ? (
        <div className="scroller" aria-busy="true">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <div
              key={`skeleton-${i}`}
              className={skeleton === 'poster' ? 'w-[clamp(136px,11.5vw,186px)]' : 'w-[clamp(220px,19vw,268px)]'}
            >
              <Art src={null} alt="" shape={skeleton} className="opacity-30" />
            </div>
          ))}
        </div>
      ) : empty ? (
        <p className="px-[var(--pad)] text-[13px] text-tx3">{empty}</p>
      ) : (
        <div className="relative">
          <div ref={rail.ref} className="scroller">
            {children}
          </div>
          <RailArrow side="left" show={rail.canLeft} onClick={() => rail.scroll(-1)} />
          <RailArrow side="right" show={rail.canRight} onClick={() => rail.scroll(1)} />
        </div>
      )}
    </section>
  )
}

/**
 * Sits over the rail's faded edge. Hidden until the row is hovered or the
 * button itself is focused, so a keyboard can still reach it.
 */
function RailArrow({
  side,
  show,
  onClick
}: {
  side: 'left' | 'right'
  show: boolean
  onClick: () => void
}): React.JSX.Element | null {
  const t = useT()
  if (!show) return null
  const left = side === 'left'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={left ? t('rail.prev') : t('rail.next')}
      /* Not gated behind a breakpoint: these are the only way to move a rail
         with a mouse, so a narrow window must not take them away. */
      className={`absolute top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/18 bg-ink/80 text-tx opacity-0 backdrop-blur-[14px] transition-opacity duration-200 hover:border-acc/50 hover:bg-ink focus-visible:opacity-100 group-hover/row:opacity-100 md:h-11 md:w-11 ${
        left ? 'left-2' : 'right-2'
      }`}
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden="true">
        <path d={left ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'} />
      </svg>
    </button>
  )
}
