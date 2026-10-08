import { useEffect, useRef, useState } from 'react'

/**
 * Brand colours for the logos on screen. The main process decodes them, because
 * a canvas cannot sample an image served from another origin, and keeps them on
 * disk — a logo's colour never changes, so each one is read once ever.
 */
export function useLogoColors(urls: (string | null)[]): Map<string, string> {
  const [colors, setColors] = useState<Map<string, string>>(new Map())
  const asked = useRef(new Set<string>())
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const pending = urls.filter((url): url is string => Boolean(url) && !asked.current.has(url as string))
  const key = pending.join('|')

  useEffect(() => {
    if (!key) return
    const list = key.split('|')
    list.forEach((url) => asked.current.add(url))

    window.akis.art
      .logoColors(list)
      .then((result) => {
        if (!mounted.current) return
        setColors((current) => {
          const next = new Map(current)
          for (const [url, color] of Object.entries(result)) if (color) next.set(url, color)
          return next
        })
      })
      .catch(() => undefined)
  }, [key])

  return colors
}
