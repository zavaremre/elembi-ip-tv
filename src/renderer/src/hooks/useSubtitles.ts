import { useCallback, useEffect, useRef, useState } from 'react'
import { retimeVtt } from '@/lib/subtitleTiming'
import type { SubtitleSync } from '@shared/types'

export interface SubtitleContext {
  imdbId?: string | null
  query: string
  season?: number | null
  episode?: number | null
  /**
   * Identifies the title the timing belongs to, so a sync found by hand is
   * remembered. Episodes of one series share a key: they come from the same
   * release, so the offset carries over.
   */
  syncKey: string
}

export interface SubtitleState {
  active: string | null
  /** Text of the cues active right now, read only from our own track. */
  cues: string[]
  delay: number
  /** True while the timing came back from the store rather than being set now. */
  remembered: boolean
  busy: boolean
  error: string | null
  loadLocal: () => void
  clear: () => void
  nudgeDelay: (delta: number) => void
  resetSync: () => void
}

/** Marks the track this hook owns, so the engine ignores it when reading cues. */
export const LOCAL_TRACK_ID = 'elembi-local-subtitle'

const SAVE_DEBOUNCE_MS = 500


/**
 * Subtitles the viewer loaded from disk. Tracks carried inside the video are
 * handled by the player engine instead, because they ride inside the stream and
 * the player aligns them itself.
 */
export function useSubtitles(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  context: SubtitleContext,
  /** Remux playback restarts at zero, so cues must move back by the offset. */
  timelineOffset = 0
): SubtitleState {
  const [active, setActive] = useState<string | null>(null)
  const [cues, setCues] = useState<string[]>([])
  const [delay, setDelay] = useState(0)
  const [remembered, setRemembered] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sourceVtt = useRef<string | null>(null)
  const trackUrl = useRef<string | null>(null)
  const trackNode = useRef<HTMLTrackElement | null>(null)
  const cueCleanup = useRef<(() => void) | null>(null)
  /** Timing saved for this title, read once per key and used when one is picked. */
  const stored = useRef<SubtitleSync>({ delay: 0 })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Read the remembered timing up front so picking a subtitle can apply it. */
  useEffect(() => {
    let alive = true
    stored.current = { delay: 0 }
    window.elembi.subs
      .sync(context.syncKey)
      .then((sync) => {
        if (alive) stored.current = sync
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [context.syncKey])

  const persistSync = useCallback(
    (next: SubtitleSync): void => {
      stored.current = next
      if (saveTimer.current) clearTimeout(saveTimer.current)
      /* Held keys fire this repeatedly, so the write waits for the last one. */
      saveTimer.current = setTimeout(() => {
        window.elembi.subs.saveSync(context.syncKey, next).catch(() => undefined)
      }, SAVE_DEBOUNCE_MS)
    },
    [context.syncKey]
  )

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    },
    []
  )

  const render = useCallback(
    (vtt: string, label: string, offset: number, sessionTime = false): void => {
      const video = videoRef.current
      if (!video) return

      if (trackNode.current) trackNode.current.remove()
      if (trackUrl.current) URL.revokeObjectURL(trackUrl.current)

      /*
       * A downloaded subtitle is timed against the whole film, while the element
       * plays from the seek point, so the offset has to come back out. A track
       * written by the session is already on the element's timeline — taking the
       * offset out again would push it off by however far the viewer skipped.
       */
      const shift = sessionTime ? offset : offset - timelineOffset
      const blob = new Blob([retimeVtt(vtt, shift)], { type: 'text/vtt' })
      const url = URL.createObjectURL(blob)
      const track = document.createElement('track')
      track.kind = 'subtitles'
      track.id = LOCAL_TRACK_ID
      track.label = label
      track.srclang = 'tr'
      track.src = url
      video.appendChild(track)
      /*
       * Hidden, never showing: the app draws the cues itself. The mode is set at
       * once rather than on load, because a track left showing even briefly makes
       * the browser paint its own copy on top of ours.
       */
      if (track.track) track.track.mode = 'hidden'
      track.addEventListener('load', () => {
        if (track.track) track.track.mode = 'hidden'
      })

      /*
       * Reading cues from this track alone, never from video.textTracks: the
       * element can carry tracks we did not create, and mixing them in is what
       * made the subtitles look scrambled.
       */
      const textTrack = track.track
      const onCueChange = (): void => {
        const list = textTrack?.activeCues
        const texts: string[] = []
        for (let i = 0; i < (list?.length ?? 0); i++) {
          const cue = list?.[i] as VTTCue | undefined
          if (cue?.text) texts.push(cue.text)
        }
        setCues(texts)
      }
      textTrack?.addEventListener('cuechange', onCueChange)
      cueCleanup.current?.()
      cueCleanup.current = () => textTrack?.removeEventListener('cuechange', onCueChange)

      trackUrl.current = url
      trackNode.current = track
      setActive(label)
      setCues([])
    },
    [videoRef, timelineOffset]
  )

  /* A seek changes the pipe origin, so the active track has to be rebuilt. */
  useEffect(() => {
    if (sourceVtt.current && active) render(sourceVtt.current, active, delay)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineOffset])

  const clear = useCallback((): void => {
    cueCleanup.current?.()
    cueCleanup.current = null
    setCues([])
    if (trackNode.current) trackNode.current.remove()
    if (trackUrl.current) URL.revokeObjectURL(trackUrl.current)
    trackNode.current = null
    trackUrl.current = null
    sourceVtt.current = null
    setActive(null)
    setDelay(0)
    setRemembered(false)
  }, [])

  useEffect(() => clear, [clear])

  const loadLocal = useCallback((): void => {
    setError(null)
    setBusy(true)
    window.elembi.subs
      .openLocal()
      .then((file) => {
        if (!file) return
        /* A file off disk carries no frame rate, so only the offset is reused. */
        const offset = stored.current.delay
        sourceVtt.current = file.vtt
        setDelay(offset)
        setRemembered(offset !== 0)
        render(file.vtt, file.label, offset)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false))
  }, [render])

  const nudgeDelay = useCallback(
    (delta: number): void => {
      const next = Math.round((delay + delta) * 100) / 100
      setDelay(next)
      setRemembered(false)
      persistSync({ delay: next })
      if (sourceVtt.current && active) render(sourceVtt.current, active, next)
    },
    [delay, active, render, persistSync]
  )

  const resetSync = useCallback((): void => {
    setDelay(0)
    setRemembered(false)
    persistSync({ delay: 0 })
    if (sourceVtt.current && active) render(sourceVtt.current, active, 0)
  }, [active, render, persistSync])

  return {
    active,
    cues,
    delay,
    remembered,
    busy,
    error,
    loadLocal,
    clear,
    nudgeDelay,
    resetSync
  }
}
