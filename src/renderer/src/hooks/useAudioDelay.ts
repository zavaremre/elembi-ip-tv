import { useCallback, useEffect, useRef, useState } from 'react'

export interface AudioDelay {
  ms: number
  nudge: (deltaMs: number) => void
  reset: () => void
  available: boolean
}

const MAX_MS = 1500
const STEP_LIMIT_MS = 1500

/**
 * Audio delay through a Web Audio DelayNode. ffmpeg filters cannot carry an
 * offset through the fragmented MP4 muxer, which normalises each stream to zero,
 * so the correction is applied in the browser instead — instant, and it works in
 * every playback mode.
 */
export function useAudioDelay(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  /** False for media without CORS headers, where tapping the element mutes it. */
  enabled: boolean,
  /** Called the first time the element is routed through Web Audio. */
  onTap?: () => void
): AudioDelay {
  const [ms, setMs] = useState(0)
  const [available, setAvailable] = useState(false)
  const context = useRef<AudioContext | null>(null)
  const delayNode = useRef<DelayNode | null>(null)

  /* createMediaElementSource may be called once per element, so the graph is built lazily. */
  const ensureGraph = useCallback((): boolean => {
    const video = videoRef.current
    if (!video || !enabled) return false
    if (delayNode.current) return true
    try {
      const ctx = new AudioContext()
      const source = ctx.createMediaElementSource(video)
      const delay = ctx.createDelay(MAX_MS / 1000)
      source.connect(delay)
      delay.connect(ctx.destination)
      context.current = ctx
      delayNode.current = delay
      setAvailable(true)
      onTap?.()
      return true
    } catch {
      setAvailable(false)
      return false
    }
  }, [videoRef, enabled, onTap])

  useEffect(() => {
    return () => {
      void context.current?.close()
      context.current = null
      delayNode.current = null
    }
  }, [])

  const apply = useCallback(
    (nextMs: number): void => {
      if (!ensureGraph()) return
      const ctx = context.current
      const delay = delayNode.current
      if (!ctx || !delay) return
      if (ctx.state === 'suspended') void ctx.resume()
      delay.delayTime.value = nextMs / 1000
      setMs(nextMs)
    },
    [ensureGraph]
  )

  return {
    ms,
    available: enabled && (available || ms > 0),
    nudge: (deltaMs) => apply(Math.min(STEP_LIMIT_MS, Math.max(0, ms + deltaMs))),
    reset: () => apply(0)
  }
}
