import type { ReactNode } from 'react'
import { Art } from './Art'

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
  return (
    <section className="mb-7 lg:mb-10">
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
        <div className="scroller">{children}</div>
      )}
    </section>
  )
}
