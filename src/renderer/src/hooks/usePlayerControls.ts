import { useCallback, useEffect, useRef, useState } from 'react'
import type { Timeline } from './usePlayerEngine'

export interface PlayerControls {
  playing: boolean
  time: number
  duration: number
  buffered: number
  volume: number
  muted: boolean
  speed: number
  fullscreen: boolean
  controlsVisible: boolean
  toggle: () => void
  seek: (seconds: number) => void
  nudge: (delta: number) => void
  changeVolume: (value: number) => void
  toggleMute: () => void
  changeSpeed: (value: number) => void
  toggleFullscreen: () => void
  togglePip: () => void
  wake: () => void
  bind: {
    onPlay: () => void
    onPause: () => void
    onTimeUpdate: () => void
    onLoadedMetadata: () => void
    onProgress: () => void
  }
}

const IDLE_MS = 2800
const SEEK_SMALL = 5
const SEEK_BIG = 10

/** Playback state, keyboard shortcuts and auto-hiding controls. */
export function usePlayerControls(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  containerRef: React.RefObject<HTMLElement | null>,
  options: {
    isLive: boolean
    enabled: boolean
    resumeAt?: number
    /** Present when playback runs through a non-seekable remux pipe. */
    timeline: Timeline | null
    /** While a player menu is open, Escape belongs to that menu. */
    menuOpen: boolean
    onExit: () => void
  }
): PlayerControls {
  const { isLive, enabled, resumeAt, timeline, menuOpen, onExit } = options
  const [playing, setPlaying] = useState(true)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const idleTimer = useRef(0)

  const wake = useCallback((): void => {
    setControlsVisible(true)
    window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => setControlsVisible(false), IDLE_MS)
  }, [])

  useEffect(() => {
    wake()
    return () => window.clearTimeout(idleTimer.current)
  }, [wake])

  const toggle = useCallback((): void => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play()
    else video.pause()
    wake()
  }, [videoRef, wake])

  const seek = useCallback(
    (seconds: number): void => {
      const video = videoRef.current
      if (!video || isLive) return
      const target = Math.max(0, seconds)
      /* A pipe cannot be sought, so the engine restarts it at the position. */
      if (timeline) timeline.seek(Math.min(target, timeline.duration || target))
      else video.currentTime = Math.min(target, video.duration || target)
      wake()
    },
    [videoRef, isLive, timeline, wake]
  )

  const nudge = useCallback(
    (delta: number): void => {
      const video = videoRef.current
      if (!video) return
      if (timeline) seek(timeline.offset + video.currentTime + delta)
      else video.currentTime += delta
      wake()
    },
    [videoRef, timeline, seek, wake]
  )

  const changeVolume = useCallback(
    (value: number): void => {
      const video = videoRef.current
      if (!video) return
      const next = Math.max(0, Math.min(1, value))
      video.volume = next
      video.muted = next === 0
      setVolume(next)
      setMuted(next === 0)
      wake()
    },
    [videoRef, wake]
  )

  const toggleMute = useCallback((): void => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
    wake()
  }, [videoRef, wake])

  const changeSpeed = useCallback(
    (value: number): void => {
      const video = videoRef.current
      if (!video) return
      video.playbackRate = value
      setSpeed(value)
      wake()
    },
    [videoRef, wake]
  )

  const toggleFullscreen = useCallback((): void => {
    const container = containerRef.current
    if (!container) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void container.requestFullscreen()
  }, [containerRef])

  const togglePip = useCallback((): void => {
    const video = videoRef.current
    if (!video) return
    if (document.pictureInPictureElement) void document.exitPictureInPicture()
    else void video.requestPictureInPicture?.()
  }, [videoRef])

  useEffect(() => {
    const onChange = (): void => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  /* YouTube-style shortcuts, active only while the player is in full view. */
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      const video = videoRef.current
      if (!video) return

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault()
          toggle()
          return
        case 'ArrowRight':
          nudge(SEEK_SMALL)
          return
        case 'ArrowLeft':
          nudge(-SEEK_SMALL)
          return
        case 'l':
        case 'L':
          nudge(SEEK_BIG)
          return
        case 'j':
        case 'J':
          nudge(-SEEK_BIG)
          return
        case 'ArrowUp':
          e.preventDefault()
          changeVolume(video.volume + 0.05)
          return
        case 'ArrowDown':
          e.preventDefault()
          changeVolume(video.volume - 0.05)
          return
        case 'm':
        case 'M':
          toggleMute()
          return
        case 'f':
        case 'F':
          toggleFullscreen()
          return
        case 'i':
        case 'I':
          togglePip()
          return
        case 'Escape':
          if (!menuOpen && !document.fullscreenElement) onExit()
          return
        default:
          break
      }

      const total = timeline?.duration ?? video.duration
      if (/^[0-9]$/.test(e.key) && !isLive && total) {
        seek((Number(e.key) / 10) * total)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, isLive, menuOpen, videoRef, toggle, nudge, seek, timeline, changeVolume, toggleMute, toggleFullscreen, togglePip, onExit, wake])

  const readBuffered = useCallback((): void => {
    const video = videoRef.current
    if (!video || video.buffered.length === 0) return
    /* Pipe playback starts at zero, so the offset makes it an absolute position. */
    setBuffered((timeline?.offset ?? 0) + video.buffered.end(video.buffered.length - 1))
  }, [videoRef, timeline])

  return {
    playing,
    time,
    duration,
    buffered,
    volume,
    muted,
    speed,
    fullscreen,
    controlsVisible,
    toggle,
    seek,
    nudge,
    changeVolume,
    toggleMute,
    changeSpeed,
    toggleFullscreen,
    togglePip,
    wake,
    bind: {
      onPlay: () => setPlaying(true),
      onPause: () => setPlaying(false),
      onTimeUpdate: () => {
        const video = videoRef.current
        if (video) setTime((timeline?.offset ?? 0) + video.currentTime)
      },
      onLoadedMetadata: () => {
        const video = videoRef.current
        if (!video) return
        setDuration(timeline ? timeline.duration : video.duration)
        /* Resuming a pipe is handled by starting it at the offset instead. */
        if (!timeline && resumeAt && resumeAt > 10 && Number.isFinite(video.duration)) video.currentTime = resumeAt
      },
      onProgress: readBuffered
    }
  }
}
