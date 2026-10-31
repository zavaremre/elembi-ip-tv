import { useCallback, useEffect, useState } from 'react'
import type { UpdateInfo } from '@shared/types'

const STORAGE_KEY = 'elembi.updateDismissed'

/**
 * Whether a newer release exists, and whether the viewer wants to hear about
 * it. The dismissal is kept per version rather than as a flag: saying "not now"
 * to 0.3.0 should not silence 0.4.0, and it lives in this browser's storage
 * because it is a preference about one screen, not state worth a file.
 */
export function useUpdate(enabled: boolean): {
  update: UpdateInfo | null
  dismiss: () => void
} {
  const [update, setUpdate] = useState<UpdateInfo | null>(null)

  useEffect(() => {
    if (!enabled) {
      setUpdate(null)
      return
    }
    let alive = true
    window.elembi.app
      .update()
      .then((info) => {
        if (!alive || !info) return
        let seen: string | null = null
        try {
          seen = window.localStorage.getItem(STORAGE_KEY)
        } catch {
          /* Private windows and locked-down profiles throw; the toast still shows. */
        }
        if (seen !== info.version) setUpdate(info)
      })
      /* A check that could not run is not news. */
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [enabled])

  const dismiss = useCallback((): void => {
    if (update) {
      try {
        window.localStorage.setItem(STORAGE_KEY, update.version)
      } catch {
        /* Then it asks again next launch, which is the harmless failure. */
      }
    }
    setUpdate(null)
  }, [update])

  return { update, dismiss }
}
