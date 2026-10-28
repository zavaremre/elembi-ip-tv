import { useCallback, useEffect, useState } from 'react'

/**
 * Makes a horizontal rail reachable with a mouse.
 *
 * The rails hide their scrollbar, and a wheel reports only a vertical delta
 * unless the pointing device can send a horizontal one. On a trackpad that is
 * fine; with an ordinary mouse — which is what most Linux and Windows machines
 * have — it left the rails with no way to scroll at all. These are the arrows
 * that give them one.
 *
 * The wheel is deliberately not hijacked: turning vertical scroll into
 * horizontal would stop the page scrolling whenever the cursor crossed a rail,
 * which is worse than the problem. Shift+wheel already scrolls sideways on
 * every platform.
 */

/** Leaves a card's worth of overlap so nothing is skipped over. */
const PAGE_FACTOR = 0.82
/* Sub-pixel layout can leave a scroller a fraction short of its own end. */
const EPSILON = 2
/* Enough to keep layout reads off the scroll path, short enough to feel live. */
const THROTTLE_MS = 60

export interface RailScroll {
  /**
   * A callback ref, not a RefObject: the scroller is mounted only once the row
   * leaves its loading state, and an effect watching a stable ref object never
   * runs again to notice it arriving.
   */
  ref: (node: HTMLElement | null) => void
  canLeft: boolean
  canRight: boolean
  scroll: (direction: -1 | 1) => void
}

export function useRailScroll(): RailScroll {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  useEffect(() => {
    if (!node) {
      setCanLeft(false)
      setCanRight(false)
      return
    }

    const measure = (): void => {
      const max = node.scrollWidth - node.clientWidth
      setCanLeft(node.scrollLeft > EPSILON)
      setCanRight(max > EPSILON && node.scrollLeft < max - EPSILON)
    }

    /*
     * Throttled on a timer: measuring reads layout, so it must not run once per
     * scroll event. The trailing call is the one that matters — it catches the
     * position the rail actually came to rest at, which a leading-edge throttle
     * would miss by however much was left in the last burst.
     */
    let last = 0
    let trailing = 0
    const schedule = (): void => {
      const now = performance.now()
      window.clearTimeout(trailing)
      if (now - last >= THROTTLE_MS) {
        last = now
        measure()
      }
      trailing = window.setTimeout(() => {
        last = performance.now()
        measure()
      }, THROTTLE_MS)
    }

    const size = new ResizeObserver(schedule)
    size.observe(node)
    const watchChildren = (): void => {
      for (const child of Array.from(node.children)) size.observe(child)
    }
    watchChildren()

    /* Cards arrive after the data does, and each one widens the content. */
    const content = new MutationObserver(() => {
      watchChildren()
      schedule()
    })
    content.observe(node, { childList: true })

    measure()
    node.addEventListener('scroll', schedule, { passive: true })
    return () => {
      node.removeEventListener('scroll', schedule)
      size.disconnect()
      content.disconnect()
      window.clearTimeout(trailing)
    }
  }, [node])

  const scroll = useCallback(
    (direction: -1 | 1): void => {
      if (!node) return
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      node.scrollBy({ left: direction * node.clientWidth * PAGE_FACTOR, behavior: reduce ? 'auto' : 'smooth' })
    },
    [node]
  )

  return { ref: setNode, canLeft, canRight, scroll }
}
