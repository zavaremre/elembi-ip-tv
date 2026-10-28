import { useEffect, useRef, useState } from 'react'
import { parseTitle } from '@shared/title'
import type { ArtworkRequest, VodItem } from '@shared/types'

const keyOf = (item: VodItem): string => `${item.kind}-${item.id}`

/**
 * TMDB poster paths for the provider entries on screen. The catalogue's own
 * covers are uneven — some are 600x900, others 320x240 thumbnails that look
 * broken in a 2:3 frame — so TMDB artwork is used wherever a title matches.
 */
export interface ProviderPosters {
  paths: Map<string, string>
  /** Keys the lookup has answered, match or not; lets the card avoid a swap. */
  resolved: Set<string>
}

export function useProviderPosters(items: VodItem[]): ProviderPosters {
  const [posters, setPosters] = useState<ProviderPosters>({ paths: new Map(), resolved: new Set() })
  const requested = useRef(new Set<string>())
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const pending = items.filter((item) => !requested.current.has(keyOf(item)))
  const signature = pending.map(keyOf).join(',')

  useEffect(() => {
    if (!signature) return
    const requests: ArtworkRequest[] = pending.map((item) => ({
      key: keyOf(item),
      name: item.name,
      kind: item.kind,
      year: parseTitle(item.name).year
    }))
    requests.forEach((request) => requested.current.add(request.key))

    /*
     * Sent at once rather than debounced: registering the keys empties `pending`,
     * so the signature changes immediately and the cleanup would cancel a pending
     * timer before it ever fired. The main process batches and caches anyway, and
     * `requested` keeps the same key from being asked twice.
     */
    window.elembi.art
      .posters(requests)
      .then((result) => {
        /* Guarded on mount only; the request itself stays valid. */
        if (!mounted.current) return
        setPosters((current) => {
          const paths = new Map(current.paths)
          const resolved = new Set(current.resolved)
          for (const [key, path] of Object.entries(result)) {
            resolved.add(key)
            if (path) paths.set(key, path)
          }
          return { paths, resolved }
        })
      })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  return posters
}
