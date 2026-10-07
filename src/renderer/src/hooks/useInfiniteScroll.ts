import { useEffect, useRef, useState } from 'react'

interface InfiniteScrollOptions {
  onMore: () => void
  /** Pass false while a page is in flight, or the observer fires repeatedly. */
  enabled: boolean
  /** The app scrolls inside this element, not the viewport. */
  rootId?: string
}

const ROOT_MARGIN = '700px 0px'

/** Returns a ref callback for the sentinel placed after the last row of a list. */
export function useInfiniteScroll({ onMore, enabled, rootId = 'page' }: InfiniteScrollOptions): (node: HTMLElement | null) => void {
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null)
  const callback = useRef(onMore)
  callback.current = onMore

  useEffect(() => {
    if (!sentinel || !enabled) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) callback.current()
      },
      { root: document.getElementById(rootId), rootMargin: ROOT_MARGIN }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [sentinel, enabled, rootId])

  return setSentinel
}
