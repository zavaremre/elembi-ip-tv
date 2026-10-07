import { useCallback, useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import type { AudioTrackInfo } from '@shared/types'

export interface QualityLevel {
  index: number
  height: number
  bitrate: number
}

export interface TrackOption {
  id: number
  label: string
}

export interface EngineStats {
  level: string
  bitrate: number
  dropped: number
  buffer: number
}

/**
 * A remux pipe is not seekable, so position is tracked here and a new pipe is
 * started at the requested offset.
 */
export interface Timeline {
  offset: number
  duration: number
  seek: (seconds: number) => void
}

export type PlaybackMode = 'hls' | 'native' | 'remux'

export interface PlayerEngine {
  mode: PlaybackMode
  adaptive: boolean
  levels: QualityLevel[]
  currentLevel: number
  setLevel: (index: number) => void
  audioTracks: TrackOption[]
  audioTrack: number
  setAudioTrack: (id: number) => void
  subtitleTracks: TrackOption[]
  subtitleTrack: number
  setSubtitleTrack: (id: number) => void
  stats: EngineStats
  /** True while a local session is being started, before any frame can arrive. */
  preparing: boolean
  error: string | null
  notice: string | null
  timeline: Timeline | null
  /** Frame rate of the file, when probed; used to rank subtitle candidates. */
  fps: number | null
  retry: () => void
}

const STATS_INTERVAL_MS = 1000
const LANGUAGE_NAMES: Record<string, string> = {
  tur: 'Türkçe', tr: 'Türkçe', eng: 'İngilizce', en: 'İngilizce', ger: 'Almanca', deu: 'Almanca',
  fre: 'Fransızca', fra: 'Fransızca', ita: 'İtalyanca', spa: 'İspanyolca', rus: 'Rusça',
  ara: 'Arapça', jpn: 'Japonca', kor: 'Korece', pol: 'Lehçe', und: 'Bilinmeyen'
}

function labelFor(track: AudioTrackInfo, index: number): string {
  const language = track.language ? (LANGUAGE_NAMES[track.language.toLowerCase()] ?? track.language) : null
  const parts = [language ?? `Ses ${index + 1}`, track.title, `${track.codec}${track.channels ? ` ${track.channels}ch` : ''}`]
  return parts.filter(Boolean).join(' · ')
}

/** Owns playback: hls.js for streams, a local remux for files Chromium cannot handle alone. */
export function usePlayerEngine(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  url: string,
  /** Set once Web Audio has tapped the element; a direct URL would then be silent. */
  forceRemux = false
): PlayerEngine {
  const hlsRef = useRef<Hls | null>(null)
  const sourceRef = useRef(url)
  const [mode, setMode] = useState<PlaybackMode>('native')
  const [levels, setLevels] = useState<QualityLevel[]>([])
  const [currentLevel, setCurrentLevel] = useState(-1)
  const [audioTracks, setAudioTracks] = useState<TrackOption[]>([])
  const [audioTrack, setAudioTrackState] = useState(0)
  const [subtitleTracks, setSubtitleTracks] = useState<TrackOption[]>([])
  const [subtitleTrack, setSubtitleTrackState] = useState(-1)
  const [stats, setStats] = useState<EngineStats>({ level: 'otomatik', bitrate: 0, dropped: 0, buffer: 0 })
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [fps, setFps] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [offset, setOffset] = useState(0)
  const [duration, setDuration] = useState(0)

  /**
   * Starts a local HLS session at a position with a chosen track. The playlist
   * carries real segment durations, so the element gets a seekable timeline
   * instead of the unseekable single pipe this replaced.
   */
  const openLocal = useCallback(
    async (audioOrder: number, start: number): Promise<void> => {
      const video = videoRef.current
      if (!video) return
      setPreparing(true)
      try {
        const playlist = await window.akis.media.startHls(sourceRef.current, audioOrder, start)
        hlsRef.current?.destroy()
        video.pause()
        video.removeAttribute('src')
        /* MSE keeps the element same-origin, so a stale crossorigin attribute must go. */
        video.removeAttribute('crossorigin')
        video.load()
        setOffset(start)
        setAudioTrackState(audioOrder)
        const hls = new Hls({ enableWorker: true, backBufferLength: 120, enableCEA708Captions: false })
        hlsRef.current = hls
        hls.loadSource(playlist)
        hls.attachMedia(video)
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad()
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
          else setError('Yerel akış açılamadı')
        })
        void video.play().catch(() => undefined)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Yerel akış başlatılamadı')
      } finally {
        setPreparing(false)
      }
    },
    [videoRef]
  )

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    sourceRef.current = url
    setError(null)
    setNotice(null)
    setLevels([])
    setAudioTracks([])
    /* Live streams never reach the probe, so a stale rate must not linger. */
    setFps(null)
    setSubtitleTracks([])
    setOffset(0)
    setDuration(0)
    setAudioTrackState(0)

    let cancelled = false
    const isHls = /\.m3u8(\?|$)/i.test(url)

    if (isHls && Hls.isSupported()) {
      setMode('hls')
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 90, enableCEA708Captions: false })
      hlsRef.current = hls
      hls.loadSource(url)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLevels(hls.levels.map((level, index) => ({ index, height: level.height ?? 0, bitrate: level.bitrate ?? 0 })))
        setAudioTracks(
          hls.audioTracks.map((track, i) => ({
            id: i,
            label: [track.name, track.lang].filter(Boolean).join(' · ') || `Ses ${i + 1}`
          }))
        )
        setAudioTrackState(hls.audioTrack)
        setSubtitleTracks(
          hls.subtitleTracks.map((track, i) => ({
            id: i,
            label: [track.name, track.lang].filter(Boolean).join(' · ') || `Altyazı ${i + 1}`
          }))
        )
        setSubtitleTrackState(hls.subtitleTrack)
      })
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        const level = hls.levels[data.level]
        setStats((prev) => ({ ...prev, level: level?.height ? `${level.height}p` : 'otomatik', bitrate: level?.bitrate ?? 0 }))
      })
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad()
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
        else setError('Akış açılamadı — sağlayıcı bu yayını vermiyor olabilir')
      })

      return () => {
        cancelled = true
        hls.destroy()
        hlsRef.current = null
      }
    }

    /*
     * Progressive files: Chromium exposes no audio-track API and decodes neither
     * AC-3 nor E-AC-3, so anything with several tracks or an unsupported codec
     * goes through the local ffmpeg pipe instead.
     */
    const start = async (): Promise<void> => {
      const canRemux = await window.akis.media.available().catch(() => false)
      if (cancelled) return

      if (!canRemux) {
        setMode('native')
        video.removeAttribute('crossorigin')
        if (/\.ts(\?|$)/i.test(url)) {
          setError('MPEG-TS akışı bu oynatıcıda açılamıyor. .env dosyasında XTREAM_OUTPUT=hls yapın.')
          return
        }
        video.src = url
        return
      }

      const info = await window.akis.media.probe(url).catch(() => null)
      if (cancelled) return
      setFps(info?.fps ?? null)

      if (!info || (!info.needsRemux && !forceRemux)) {
        setMode('native')
        /* The provider sends no CORS headers, so the element must stay untapped. */
        video.removeAttribute('crossorigin')
        video.src = url
        if (info?.audio.length === 1) setAudioTracks([{ id: 0, label: labelFor(info.audio[0], 0) }])
        return
      }

      setMode('remux')
      setDuration(info.duration)
      setAudioTracks(info.audio.map((track, index) => ({ id: track.order, label: labelFor(track, index) })))
      const unplayable = info.audio.filter((track) => !track.playable)
      if (unplayable.length > 0) {
        setNotice(`${unplayable[0].codec.toUpperCase()} sesi yerel olarak AAC'ye çevriliyor`)
      }
      await openLocal(0, 0)
    }

    void start()
    return () => {
      cancelled = true
      void window.akis.media.stop().catch(() => undefined)
      video.removeAttribute('src')
      video.load()
    }
  }, [url, attempt, videoRef, openLocal, forceRemux])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const video = videoRef.current
      if (!video) return
      const quality = video.getVideoPlaybackQuality?.()
      let buffer = 0
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= video.currentTime && video.buffered.end(i) >= video.currentTime) {
          buffer = video.buffered.end(i) - video.currentTime
        }
      }
      setStats((prev) => ({ ...prev, dropped: quality?.droppedVideoFrames ?? 0, buffer }))
    }, STATS_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [videoRef])

  const setLevel = useCallback((index: number): void => {
    if (hlsRef.current) hlsRef.current.currentLevel = index
    setCurrentLevel(index)
  }, [])

  const setAudioTrack = useCallback(
    (id: number): void => {
      if (mode === 'remux') {
        const video = videoRef.current
        void openLocal(id, offset + (video?.currentTime ?? 0))
        return
      }
      if (hlsRef.current) hlsRef.current.audioTrack = id
      setAudioTrackState(id)
    },
    [mode, offset, openLocal, videoRef]
  )

  const setSubtitleTrack = useCallback((id: number): void => {
    if (hlsRef.current) hlsRef.current.subtitleTrack = id
    setSubtitleTrackState(id)
  }, [])

  /**
   * Inside the produced window the playlist is seekable, so the element handles
   * it instantly and exactly. Only a jump past what ffmpeg has written restarts
   * the session.
   */
  const seek = useCallback(
    (seconds: number): void => {
      const video = videoRef.current
      const target = Math.max(0, seconds)
      const local = target - offset
      if (video && local >= 0 && video.seekable.length > 0 && local <= video.seekable.end(video.seekable.length - 1)) {
        video.currentTime = local
        return
      }
      void openLocal(audioTrack, target)
    },
    [audioTrack, offset, openLocal, videoRef]
  )

  const timeline: Timeline | null = mode === 'remux' ? { offset, duration, seek } : null

  return {
    mode,
    adaptive: mode === 'hls',
    levels,
    currentLevel,
    setLevel,
    audioTracks,
    audioTrack,
    setAudioTrack,
    subtitleTracks,
    subtitleTrack,
    setSubtitleTrack,
    stats,
    preparing,
    error,
    notice,
    timeline,
    fps,
    retry: () => setAttempt((n) => n + 1)
  }
}
