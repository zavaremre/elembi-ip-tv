import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from 'react'

/**
 * Position and size for the mini player, driven by the pointer.
 *
 * The panel used to be pinned to the bottom-right corner at a fixed width,
 * which is the one place it is in the way: it covers the last card of every
 * row. It is kept inside the window on both axes, so a drag cannot throw it
 * somewhere it can never be grabbed back from, and the same clamp runs again
 * when the window itself is resized.
 */

const MARGIN = 20
const MIN_WIDTH = 180
const MAX_WIDTH = 640
const STORE_KEY = 'elembi.mini-window'

interface Box {
  x: number
  y: number
  width: number
}

export interface MiniWindow {
  style: CSSProperties
  /** Pointer-down anywhere on the panel that is not a control. */
  onDragStart: (event: ReactPointerEvent) => void
  /** Pointer-down on the corner grip. */
  onResizeStart: (event: ReactPointerEvent) => void
  dragging: boolean
}

const clamp = (value: number, low: number, high: number): number => Math.min(Math.max(value, low), high)

function maxWidth(): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - MARGIN * 2))
}

function stored(): Box | null {
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<Box>
    if (typeof value.x !== 'number' || typeof value.y !== 'number' || typeof value.width !== 'number') return null
    return { x: value.x, y: value.y, width: value.width }
  } catch {
    return null
  }
}

/** Bottom-right, where it was before anyone moved it. */
function defaultBox(): Box {
  const width = clamp(252, MIN_WIDTH, maxWidth())
  return { x: window.innerWidth - width - MARGIN, y: window.innerHeight - 200 - MARGIN, width }
}

export function useMiniWindow(active: boolean, ref: RefObject<HTMLDivElement | null>): MiniWindow {
  const [box, setBox] = useState<Box>(() => stored() ?? defaultBox())
  const [dragging, setDragging] = useState(false)
  /* Read during a pointer move, so a re-render per frame is not needed. */
  const grab = useRef<{ mode: 'move' | 'size'; dx: number; dy: number; right: number; bottom: number; aspect: number } | null>(null)

  /** Keeps the panel reachable: its own height is only known from the element. */
  const fit = useCallback(
    (next: Box): Box => {
      const height = ref.current?.offsetHeight ?? 200
      const width = clamp(next.width, MIN_WIDTH, maxWidth())
      return {
        width,
        x: clamp(next.x, MARGIN, Math.max(MARGIN, window.innerWidth - width - MARGIN)),
        y: clamp(next.y, MARGIN, Math.max(MARGIN, window.innerHeight - height - MARGIN))
      }
    },
    [ref]
  )

  /* A window resize can leave it off-screen, and so can opening it after one. */
  useEffect(() => {
    if (!active) return
    const settle = (): void => setBox((current) => fit(current))
    settle()
    window.addEventListener('resize', settle)
    return () => window.removeEventListener('resize', settle)
  }, [active, fit])

  useEffect(() => {
    if (!dragging) return

    const onMove = (event: PointerEvent): void => {
      const held = grab.current
      if (!held) return
      if (held.mode === 'move') {
        setBox((current) => fit({ ...current, x: event.clientX - held.dx, y: event.clientY - held.dy }))
        return
      }
      /* Resizing from the top-left corner, so the opposite corner stays put. */
      const width = clamp(held.right - event.clientX, MIN_WIDTH, maxWidth())
      setBox(() => fit({ width, x: held.right - width, y: held.bottom - width * held.aspect }))
    }

    const onUp = (): void => {
      grab.current = null
      setDragging(false)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, fit])

  /* Written on release rather than per frame; a drag is hundreds of events. */
  useEffect(() => {
    if (dragging) return
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(box))
    } catch {
      /* A full or blocked store is not worth failing a drag over. */
    }
  }, [dragging, box])

  const begin = (mode: 'move' | 'size') => (event: ReactPointerEvent): void => {
    /* Controls keep their clicks; only the panel itself is a handle. */
    if (mode === 'move' && (event.target as HTMLElement).closest('button, a, input, [data-nodrag]')) return
    event.preventDefault()
    const rect = ref.current?.getBoundingClientRect()
    grab.current = {
      mode,
      dx: event.clientX - box.x,
      dy: event.clientY - box.y,
      right: rect ? rect.right : box.x + box.width,
      bottom: rect ? rect.bottom : box.y + box.width * 0.75,
      aspect: rect && rect.width > 0 ? rect.height / rect.width : 0.75
    }
    setDragging(true)
  }

  return {
    style: { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px` },
    onDragStart: begin('move'),
    onResizeStart: begin('size'),
    dragging
  }
}
