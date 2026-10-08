import { useEffect, useRef, useState } from 'react'
import { NextEpisodeCard } from './NextEpisodeCard'
import { PlayerAudioMenu } from './PlayerAudioMenu'
import { PlayerEpisodePanel } from './PlayerEpisodePanel'
import { PlayerLoading } from './PlayerLoading'
import { PlayerSeekBar } from './PlayerSeekBar'
import { SubtitleOverlay } from './SubtitleOverlay'
import { PlayerSettingsMenu } from './PlayerSettingsMenu'
import { usePlayerControls } from '@/hooks/usePlayerControls'
import { useAudioDelay } from '@/hooks/useAudioDelay'
import { usePlayerEngine } from '@/hooks/usePlayerEngine'
import { useSubtitleStyle } from '@/hooks/useSubtitleStyle'
import { useSubtitles } from '@/hooks/useSubtitles'
import { syncKeyFor } from '@/lib/subtitleTiming'
import { tc } from '@/lib/fmt'
import type { EpisodeTarget } from '@/lib/episodes'
import type { SeasonOption } from '@/hooks/usePlayback'
import type { Progress } from '@shared/types'

export interface PlaybackTarget {
  key: string
  kind: 'live' | 'vod' | 'series'
  id: number
  url: string
  title: string
  sub?: string
  image?: string | null
  resumeAt?: number
  /** Used to look subtitles up; falls back to the title. */
  imdbId?: string | null
  season?: number | null
  episode?: number | null
}

interface PlayerProps {
  target: PlaybackTarget
  mode: 'full' | 'mini'
  /** Set when a season list is queued behind the current episode. */
  next: { title: string; sub?: string; image?: string | null } | null
  /** Season and episode browsing; null for channels and single films. */
  browser: {
    seasons: SeasonOption[]
    season: number | null
    list: EpisodeTarget[]
    loading: boolean
  } | null
  progress: Progress[]
  externalPlayer: string
  onSeason: (season: number) => void
  onPickEpisode: (index: number) => void
  onMode: (mode: 'full' | 'mini') => void
  onClose: () => void
  onNext: () => void
  onProgress: (seconds: number, duration: number) => void
}

const SAVE_EVERY_MS = 10_000
const NEXT_COUNTDOWN_S = 8

/** One open menu at a time, so clicking the same control closes it again. */
type OpenMenu = 'episodes' | 'audio' | 'settings' | null

function IconButton({
  label,
  onClick,
  children,
  active
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  active?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-9 w-9 place-items-center rounded-[10px] hover:bg-white/14 ${active ? 'text-acc' : 'text-tx'}`}
    >
      {children}
    </button>
  )
}

/**
 * One video element for both modes, so moving between full screen and the mini
 * player never restarts the stream.
 */
export function Player({
  target,
  mode,
  next,
  browser,
  progress,
  externalPlayer,
  onMode,
  onClose,
  onNext,
  onSeason,
  onPickEpisode,
  onProgress
}: PlayerProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef(0)
  const [menu, setMenu] = useState<OpenMenu>(null)
  /**
   * Once Web Audio taps an element its audio is routed for good, and a direct
   * provider URL has no CORS headers, so after a tap every source must come
   * through the local pipe or playback would be silent.
   */
  const [tapped, setTapped] = useState(false)
  const [waiting, setWaiting] = useState(true)
  const [showStats, setShowStats] = useState(false)
  const [nextPrompt, setNextPrompt] = useState(false)
  const toggleMenu = (next: Exclude<OpenMenu, null>): void =>
    setMenu((current) => (current === next ? null : next))
  const isLive = target.kind === 'live'
  const full = mode === 'full'

  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMenu(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu])

  const engine = usePlayerEngine(videoRef, target.url, tapped)
  /* A tapped element stays tapped, so later titles must keep using the pipe. */
  const audioDelay = useAudioDelay(videoRef, engine.mode === 'remux' || engine.mode === 'hls', () => setTapped(true))
  const syncKey = syncKeyFor(target.kind, target.id, target.title)
  const subs = useSubtitles(
    videoRef,
    { imdbId: target.imdbId, query: target.title, season: target.season, episode: target.episode, syncKey },
    engine.timeline?.offset ?? 0
  )
  const subtitleStyle = useSubtitleStyle()
  const controls = usePlayerControls(videoRef, containerRef, {
    isLive,
    enabled: full,
    resumeAt: target.resumeAt,
    timeline: engine.timeline,
    /* Escape closes an open menu first, so the player must not minimise then. */
    menuOpen: menu !== null,
    onExit: () => onMode('mini')
  })

  const persist = (): void => {
    if (isLive || !controls.duration) return
    const now = Date.now()
    if (now - saveTimer.current < SAVE_EVERY_MS) return
    saveTimer.current = now
    onProgress(controls.time, controls.duration)
  }

  /* nodrag on the whole overlay: the window drag region behind it would otherwise
     swallow every click that lands inside the title bar band. */
  const chrome = full
    ? 'nodrag fixed inset-0 z-80 bg-black'
    : 'nodrag fixed right-5 bottom-5 z-80 w-[252px] overflow-hidden rounded-[20px] border border-white/15 bg-ink2/70 shadow-[0_26px_60px_-20px_rgba(0,0,0,.9)] backdrop-blur-[22px] backdrop-saturate-150'

  return (
    <div ref={containerRef} className={chrome} onPointerMove={full ? controls.wake : undefined}>
      <video
        ref={videoRef}
        className={full ? 'h-full w-full bg-black object-contain' : 'aspect-video w-full object-cover'}
        autoPlay
        playsInline
        onClick={full ? controls.toggle : undefined}
        onDoubleClick={full ? controls.toggleFullscreen : undefined}
        onPlay={controls.bind.onPlay}
        onPause={controls.bind.onPause}
        onProgress={controls.bind.onProgress}
        onWaiting={() => setWaiting(true)}
        onStalled={() => setWaiting(true)}
        onSeeking={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onSeeked={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onLoadedMetadata={() => {
          setNextPrompt(false)
          setWaiting(false)
          controls.bind.onLoadedMetadata()
        }}
        onEnded={() => {
          if (next) setNextPrompt(true)
        }}
        onTimeUpdate={() => {
          controls.bind.onTimeUpdate()
          persist()
        }}
      />

      {/* One source at a time: a loaded file wins, else what the stream carries. */}
      <SubtitleOverlay
        lines={subs.active ? subs.cues : engine.embeddedCues}
        style={subtitleStyle.style}
        raised={full && controls.controlsVisible}
      />

      {full && (engine.preparing || waiting) && !engine.error ? (
        <PlayerLoading preparing={engine.preparing} />
      ) : null}

      {isLive ? (
        <span
          className={`mono absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-[6px] bg-live px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-white transition-opacity ${
            full && !controls.controlsVisible ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <i className="pulse" />
          CANLI
        </span>
      ) : null}

      {full && engine.notice ? (
        <span className="mono absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-[7px] border border-acc/35 bg-ink/75 px-2.5 py-1 text-[10.5px] text-acc backdrop-blur-sm">
          {engine.notice}
        </span>
      ) : null}

      {engine.error ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-ink/88 p-6 text-center">
          <div>
            <p className="font-disp text-[17px] font-extrabold">Yayın açılamadı</p>
            <p className="mt-2 max-w-[46ch] text-[13px] text-tx2">{engine.error}</p>
            <div className="mt-4 flex justify-center gap-2">
              <button type="button" onClick={engine.retry} className="rounded-[10px] bg-tx px-4 py-2 text-[13px] font-bold text-ink">
                Yeniden dene
              </button>
              <button type="button" onClick={onClose} className="rounded-[10px] border border-line bg-white/10 px-4 py-2 text-[13px] font-bold">
                Kapat
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {full && nextPrompt && next ? (
        <NextEpisodeCard
          title={next.title}
          sub={next.sub}
          image={next.image}
          seconds={NEXT_COUNTDOWN_S}
          onPlay={() => {
            setNextPrompt(false)
            onNext()
          }}
          onCancel={() => setNextPrompt(false)}
        />
      ) : null}

      {full && showStats ? (
        <div className="mono absolute top-14 left-3 z-10 rounded-[10px] border border-line bg-ink/75 px-3 py-2 text-[11px] text-tx2 backdrop-blur-sm">
          <div>kalite {engine.stats.level}</div>
          <div>bit hızı {Math.round(engine.stats.bitrate / 1000)} kbps</div>
          <div>tampon {engine.stats.buffer.toFixed(1)} sn</div>
          <div>düşen kare {engine.stats.dropped}</div>
        </div>
      ) : null}

      {full && !controls.fullscreen ? (
        /*
         * The overlay is nodrag as a whole, which also covers the title bar band
         * and left the window impossible to move while watching. This strip hands
         * that band back. app-region is not inherited, so a child can opt back in.
         * Only outside real full screen, where there is no band to grab.
         */
        <div className="drag absolute inset-x-0 top-0 z-30 h-[52px]" aria-hidden="true" />
      ) : null}

      {full ? (
        <>
          {/*
            * nodrag is required: the window drag region behind the player swallows
            * mouse events in that rectangle, so buttons there never receive a click.
            * The offset also clears the title bar band unless really full screen.
            */}
          <div
            className={`nodrag absolute right-6 z-20 flex items-center gap-2 transition-opacity duration-300 ${
              controls.fullscreen ? 'top-6' : 'top-[76px]'
            } ${controls.controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          >
            <button
              type="button"
              onClick={() => onMode('mini')}
              aria-label="Mini oynatıcıya al"
              title="Mini oynatıcıya al"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/18 bg-ink/55 text-tx backdrop-blur-[14px] hover:border-acc/50 hover:bg-ink/80"
            >
              {/* Same picture-in-picture glyph as the control bar, so the two agree. */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2.5" />
                <rect x="12" y="11" width="8" height="6" rx="1.5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Oynatıcıyı kapat"
              title="Oynatıcıyı kapat"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/18 bg-ink/55 text-tx backdrop-blur-[14px] hover:border-live/60 hover:bg-live/25"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {!controls.playing ? (
            <button
              type="button"
              onClick={controls.toggle}
              aria-label="Oynat"
              className="absolute inset-0 z-10 grid place-items-center"
            >
              <span className="grid h-20 w-20 place-items-center rounded-full border border-white/50 bg-ink/45 backdrop-blur-sm">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              </span>
            </button>
          ) : null}

          {menu ? (
            <button
              type="button"
              aria-label="Menüyü kapat"
              onClick={() => setMenu(null)}
              className="absolute inset-0 z-9 cursor-default"
            />
          ) : null}

          <div
            className={`nodrag absolute inset-x-0 bottom-0 z-10 bg-[linear-gradient(0deg,rgba(0,0,0,.92),rgba(0,0,0,.55)_58%,transparent)] px-[var(--pad)] pt-16 pb-4 transition-opacity duration-300 ${
              controls.controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            {!isLive && controls.duration > 0 ? (
              <PlayerSeekBar
                time={controls.time}
                duration={controls.duration}
                buffered={controls.buffered}
                onSeek={controls.seek}
              />
            ) : null}

            <div className="flex items-center gap-1.5">
              <IconButton label={controls.playing ? 'Duraklat' : 'Oynat'} onClick={controls.toggle}>
                {controls.playing ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                )}
              </IconButton>

              {!isLive ? (
                <>
                  <IconButton label="10 saniye geri" onClick={() => controls.nudge(-10)}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="M11 5 6 9l5 4" />
                      <path d="M6 9h7a5 5 0 1 1 0 10H9" />
                    </svg>
                  </IconButton>
                  <IconButton label="10 saniye ileri" onClick={() => controls.nudge(10)}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="m13 5 5 4-5 4" />
                      <path d="M18 9h-7a5 5 0 1 0 0 10h4" />
                    </svg>
                  </IconButton>
                </>
              ) : null}

              <div className="flex items-center gap-1.5">
                <IconButton label={controls.muted ? 'Sesi aç' : 'Sesi kıs'} onClick={controls.toggleMute}>
                  {controls.muted || controls.volume === 0 ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="M11 5 6 9H3v6h3l5 4z" />
                      <path d="m16 9 5 6M21 9l-5 6" />
                    </svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="M11 5 6 9H3v6h3l5 4z" />
                      <path d="M16 9a4 4 0 0 1 0 6" />
                    </svg>
                  )}
                </IconButton>
                <label className="w-24">
                  <span className="sr-only">Ses düzeyi</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={controls.muted ? 0 : controls.volume}
                    onChange={(e) => controls.changeVolume(Number(e.target.value))}
                    className="w-full accent-[var(--color-acc)]"
                  />
                </label>
              </div>

              <span className="mono ml-2 text-[12px] text-tx2">
                {isLive ? 'canlı yayın' : `${tc(controls.time)} / ${tc(controls.duration)}`}
              </span>

              <div className="mx-3 min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold">{target.title}</div>
                {target.sub ? <div className="mono truncate text-[11px] text-tx3">{target.sub}</div> : null}
              </div>

              {engine.audioTracks.length > 0 || engine.subtitleTracks.length > 0 ? (
                <span className="mono mr-1 flex shrink-0 items-center gap-1.5 text-[10px] tracking-[0.06em] text-tx3 uppercase">
                  {engine.audioTracks.length > 0 ? <span>{engine.audioTracks.length} ses</span> : null}
                  {engine.subtitleTracks.length > 0 ? <span className="text-acc">{engine.subtitleTracks.length} altyazı</span> : null}
                </span>
              ) : null}

              {!isLive && controls.speed !== 1 ? (
                <span className="mono rounded-[6px] bg-acc/15 px-1.5 py-0.5 text-[11px] text-acc">{controls.speed}×</span>
              ) : null}

              <div className="relative">
                <IconButton label="Ses ve altyazı" onClick={() => toggleMenu('audio')} active={menu === 'audio'}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
                    <path d="M8 10h8M8 13h5" />
                  </svg>
                </IconButton>
                {menu === 'audio' ? (
                  <PlayerAudioMenu
                    engine={engine}
                    subs={subs}
                    audioDelay={audioDelay}
                    subtitleStyle={subtitleStyle}
                    externalPlayer={externalPlayer}
                    onExternal={() => {
                      setMenu(null)
                      void window.akis.app.openInPlayer(target.url)
                    }}
                  />
                ) : null}
              </div>

              <div className="relative">
                <IconButton label="Ayarlar" onClick={() => toggleMenu('settings')} active={menu === 'settings'}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <circle cx="12" cy="12" r="3.2" />
                    <path d="M12 3v2.2M12 18.8V21M4.9 7.1l1.9 1.1M17.2 15.8l1.9 1.1M4.9 16.9l1.9-1.1M17.2 8.2l1.9-1.1M3 12h2.2M18.8 12H21" />
                  </svg>
                </IconButton>
                {menu === 'settings' ? (
                  <PlayerSettingsMenu
                    engine={engine}
                    speed={controls.speed}
                    onSpeed={controls.changeSpeed}
                    isLive={isLive}
                    showStats={showStats}
                    onShowStats={setShowStats}
                  />
                ) : null}
              </div>

              {browser ? (
                <div className="relative">
                  <IconButton label="Bölümler" onClick={() => toggleMenu('episodes')} active={menu === 'episodes'}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="M4 6h10M4 12h10M4 18h10M18 6h2M18 12h2M18 18h2" />
                    </svg>
                  </IconButton>
                  {menu === 'episodes' ? (
                    <PlayerEpisodePanel
                      seasons={browser.seasons}
                      season={browser.season}
                      list={browser.list}
                      loading={browser.loading}
                      currentKey={target.key}
                      progress={progress}
                      onSeason={onSeason}
                      onPick={(index) => {
                        setMenu(null)
                        onPickEpisode(index)
                      }}
                      onClose={() => setMenu(null)}
                    />
                  ) : null}
                </div>
              ) : null}

              {next ? (
                <IconButton label="Sıradaki bölüm" onClick={onNext}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M6 5l9 7-9 7z" fill="currentColor" stroke="none" />
                    <path d="M18 5v14" />
                  </svg>
                </IconButton>
              ) : null}

              {engine.mode === 'native' ? (
                <IconButton label={`${externalPlayer} ile aç`} onClick={() => void window.akis.app.openInPlayer(target.url)}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M15 3h6v6M21 3l-9 9" />
                    <path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
                  </svg>
                </IconButton>
              ) : null}

              <IconButton label="Küçük pencere" onClick={controls.togglePip}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="2" y="4" width="20" height="16" rx="2.5" />
                  <rect x="12" y="11" width="8" height="6" rx="1.5" />
                </svg>
              </IconButton>

              <IconButton label={controls.fullscreen ? 'Tam ekrandan çık' : 'Tam ekran'} onClick={controls.toggleFullscreen}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  {controls.fullscreen ? <path d="M9 4H4v5M15 20h5v-5M20 9V4h-5M4 15v5h5" /> : <path d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5" />}
                </svg>
              </IconButton>

            </div>

            <div className="mono mt-2 flex flex-wrap gap-4 text-[10px] text-tx3">
              <span>boşluk/k oynat</span>
              <span>j/l 10 sn</span>
              <span>←/→ 5 sn</span>
              <span>↑/↓ ses</span>
              <span>m sessiz</span>
              <span>f tam ekran</span>
              <span>i mini pencere</span>
              <span>0–9 atla</span>
              <span>esc küçült</span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-bold">{target.title}</div>
            {target.sub ? <div className="mono truncate text-[10.5px] text-tx3">{target.sub}</div> : null}
          </div>
          <IconButton label="Tam ekrana al" onClick={() => onMode('full')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 14h6v6M20 10h-6V4" />
            </svg>
          </IconButton>
          <IconButton label="Oynatıcıyı kapat" onClick={onClose}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </IconButton>
        </div>
      )}
    </div>
  )
}
