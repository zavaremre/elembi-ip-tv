import { useCallback, useEffect, useRef, useState } from 'react'
import { retimeVtt, scaleFor } from '@/lib/subtitleTiming'
import type { SubtitleCandidate, SubtitleSync } from '@shared/types'

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
  serviceAvailable: boolean
  active: string | null
  /** Text of the cues active right now, read only from our own track. */
  cues: string[]
  delay: number
  /** Linear rate fix, 1 when the subtitle was timed for this frame rate. */
  scale: number
  /** Frame rate of the subtitle in use, when the service reported one. */
  subtitleFps: number | null
  /** True while the timing came back from the store rather than being set now. */
  remembered: boolean
  candidates: SubtitleCandidate[]
  busy: boolean
  error: string | null
  /** Downloads left on the OpenSubtitles quota, when reported. */
  remaining: number | null
  notice: string | null
  loadLocal: () => void
  search: () => void
  pick: (candidate: SubtitleCandidate) => void
  clear: () => void
  nudgeDelay: (delta: number) => void
  resetSync: () => void
}

const SAVE_DEBOUNCE_MS = 500

/** External subtitles: load from disk or OpenSubtitles, then retime if needed. */
export function useSubtitles(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  context: SubtitleContext,
  /** Remux playback restarts at zero, so cues must move back by the offset. */
  timelineOffset = 0,
  /** Frame rate of the file, used to rank candidates and to fix drift. */
  videoFps: number | null = null
): SubtitleState {
  const [serviceAvailable, setServiceAvailable] = useState(false)
  const [active, setActive] = useState<string | null>(null)
  const [cues, setCues] = useState<string[]>([])
  const [delay, setDelay] = useState(0)
  const [scale, setScale] = useState(1)
  const [subtitleFps, setSubtitleFps] = useState<number | null>(null)
  const [remembered, setRemembered] = useState(false)
  const [candidates, setCandidates] = useState<SubtitleCandidate[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const sourceVtt = useRef<string | null>(null)
  const trackUrl = useRef<string | null>(null)
  const trackNode = useRef<HTMLTrackElement | null>(null)
  const cueCleanup = useRef<(() => void) | null>(null)
  /** Timing saved for this title, read once per key and used when one is picked. */
  const stored = useRef<SubtitleSync>({ delay: 0, scale: 1, fileId: null })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileId = useRef<number | null>(null)

  useEffect(() => {
    window.akis.subs.available().then(setServiceAvailable).catch(() => setServiceAvailable(false))
  }, [])

  /* Read the remembered timing up front so picking a subtitle can apply it. */
  useEffect(() => {
    let alive = true
    stored.current = { delay: 0, scale: 1, fileId: null }
    window.akis.subs
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
        window.akis.subs.saveSync(context.syncKey, next).catch(() => undefined)
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
    (vtt: string, label: string, offset: number, rate: number): void => {
      const video = videoRef.current
      if (!video) return

      if (trackNode.current) trackNode.current.remove()
      if (trackUrl.current) URL.revokeObjectURL(trackUrl.current)

      const blob = new Blob([retimeVtt(vtt, offset - timelineOffset, rate)], { type: 'text/vtt' })
      const url = URL.createObjectURL(blob)
      const track = document.createElement('track')
      track.kind = 'subtitles'
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
    if (sourceVtt.current && active) render(sourceVtt.current, active, delay, scale)
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
    fileId.current = null
    setActive(null)
    setDelay(0)
    setScale(1)
    setSubtitleFps(null)
    setRemembered(false)
  }, [])

  useEffect(() => clear, [clear])

  const loadLocal = useCallback((): void => {
    setError(null)
    setBusy(true)
    window.akis.subs
      .openLocal()
      .then((file) => {
        if (!file) return
        /* A file off disk carries no frame rate, so only the offset is reused. */
        const offset = stored.current.delay
        sourceVtt.current = file.vtt
        fileId.current = null
        setDelay(offset)
        setScale(1)
        setSubtitleFps(null)
        setRemembered(offset !== 0)
        render(file.vtt, file.label, offset, 1)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false))
  }, [render])

  const search = useCallback((): void => {
    setError(null)
    setBusy(true)
    window.akis.subs
      .search({
        imdbId: context.imdbId,
        query: context.query,
        season: context.season,
        episode: context.episode,
        fps: videoFps
      })
      .then(setCandidates)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false))
  }, [context.imdbId, context.query, context.season, context.episode, videoFps])

  const pick = useCallback(
    (candidate: SubtitleCandidate): void => {
      setError(null)
      setBusy(true)
      window.akis.subs
        .download(candidate.fileId)
        .then((file) => {
          /*
           * The offset belongs to the title, so it comes back from the store. The
           * rate fix belongs to this file: it is only reused when the same
           * subtitle is picked again, otherwise it is derived from the rates.
           */
          const offset = stored.current.delay
          const sameFile = stored.current.fileId === candidate.fileId
          const rate = sameFile ? stored.current.scale : scaleFor(candidate.fps, videoFps)

          sourceVtt.current = file.vtt
          fileId.current = candidate.fileId
          setDelay(offset)
          setScale(rate)
          setSubtitleFps(candidate.fps)
          setRemembered(offset !== 0 || (sameFile && rate !== 1))
          render(file.vtt, `${candidate.language.toUpperCase()} · ${candidate.label}`, offset, rate)
          setCandidates([])
          setRemaining(file.remaining)
          setNotice(file.notice)
          if (!sameFile && rate !== 1) persistSync({ delay: offset, scale: rate, fileId: candidate.fileId })
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setBusy(false))
    },
    [render, videoFps, persistSync]
  )

  const nudgeDelay = useCallback(
    (delta: number): void => {
      const next = Math.round((delay + delta) * 100) / 100
      setDelay(next)
      setRemembered(false)
      persistSync({ delay: next, scale, fileId: fileId.current })
      if (sourceVtt.current && active) render(sourceVtt.current, active, next, scale)
    },
    [delay, scale, active, render, persistSync]
  )

  const resetSync = useCallback((): void => {
    setDelay(0)
    setScale(1)
    setRemembered(false)
    persistSync({ delay: 0, scale: 1, fileId: null })
    if (sourceVtt.current && active) render(sourceVtt.current, active, 0, 1)
  }, [active, render, persistSync])

  return {
    serviceAvailable,
    active,
    cues,
    delay,
    scale,
    subtitleFps,
    remembered,
    candidates,
    busy,
    error,
    remaining,
    notice,
    loadLocal,
    search,
    pick,
    clear,
    nudgeDelay,
    resetSync
  }
}
