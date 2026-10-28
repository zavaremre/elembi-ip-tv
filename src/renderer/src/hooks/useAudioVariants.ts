import { useEffect, useRef, useState } from 'react'
import type { AudioVariant, VodItem } from '@shared/types'

/**
 * Resolves the audio language for the VOD items currently on screen. The panel
 * only answers one id per request, so lookups are batched, cached on disk by the
 * main process, and never repeated for ids already known.
 */

/*
 * Asked in small groups rather than one call for the whole page. The main process
 * holds the panel to a fixed number of requests per minute — it locks an address
 * out otherwise — so a page's worth of badges takes a while, and arriving in
 * groups means they appear as they are answered instead of all at the end.
 */
const CHUNK = 8

export function useAudioVariants(items: VodItem[]): Map<number, AudioVariant> {
  const [variants, setVariants] = useState<Map<number, AudioVariant>>(new Map())
  const requested = useRef(new Set<number>())
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const ids = items
    .filter((item) => item.kind === 'vod' && !requested.current.has(item.id))
    .map((item) => item.id)
  const key = ids.join(',')

  useEffect(() => {
    if (!key) return
    const pending = key.split(',').map(Number)
    pending.forEach((id) => requested.current.add(id))

    /* Not debounced: the signature empties as soon as the ids are registered, so
       a pending timer would be cancelled by the cleanup before it fired. */
    const run = async (): Promise<void> => {
      for (let i = 0; i < pending.length; i += CHUNK) {
        /* Mount-scoped only; a request already sent stays valid. */
        if (!mounted.current) return
        const chunk = pending.slice(i, i + CHUNK)
        const result = await window.elembi.iptv.audioInfo(chunk).catch(() => null)
        if (!result || !mounted.current) continue
        setVariants((current) => {
          const next = new Map(current)
          for (const [id, info] of Object.entries(result)) next.set(Number(id), info.variant)
          return next
        })
      }
    }

    void run()
  }, [key])

  return variants
}
