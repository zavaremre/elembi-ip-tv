import { useCallback, useEffect, useState } from 'react'
import { useT } from '@/i18n'
import type { PlaybackTarget } from '@/components/Player'
import type { EpisodeTarget } from '@/lib/episodes'

export interface SeasonOption {
  number: number
  label: string
  count: number
}

/** Supplied by whoever starts playback, so the player can browse other seasons. */
export interface EpisodeSource {
  seasons: SeasonOption[]
  activeSeason: number
  load: (season: number) => Promise<EpisodeTarget[]>
}
import type { Channel, Progress, VodItem } from '@shared/types'

export interface Playback {
  target: PlaybackTarget | null
  mode: 'full' | 'mini'
  progress: Progress[]
  error: string | null
  /** The episode queued after the current one, when playing from a season list. */
  next: EpisodeTarget | null
  setMode: (mode: 'full' | 'mini') => void
  close: () => void
  playChannel: (channel: Channel) => void
  playVod: (item: VodItem) => Promise<void>
  playEpisode: (target: EpisodeTarget) => void
  /** Plays one episode and keeps the rest of the season queued behind it. */
  playEpisodeList: (episodes: EpisodeTarget[], index: number, source?: EpisodeSource) => void
  advance: () => void
  /** Season and episode browsing from inside the player. */
  browser: {
    seasons: SeasonOption[]
    season: number | null
    list: EpisodeTarget[]
    loading: boolean
  } | null
  browseSeason: (season: number) => void
  playFromBrowser: (index: number) => void
  playProgress: (item: Progress) => void
  saveProgress: (seconds: number, duration: number) => void
  clearError: () => void
}

/** Owns the single playback target and keeps resume positions in the main process. */
export function usePlayback(): Playback {
  const [target, setTarget] = useState<PlaybackTarget | null>(null)
  const [queue, setQueue] = useState<EpisodeTarget[]>([])
  const [queueIndex, setQueueIndex] = useState(-1)
  const [source, setSource] = useState<EpisodeSource | null>(null)
  const [browseSeason, setBrowseSeason] = useState<number | null>(null)
  const [browseList, setBrowseList] = useState<EpisodeTarget[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [mode, setMode] = useState<'full' | 'mini'>('full')
  const [progress, setProgress] = useState<Progress[]>([])
  const [error, setError] = useState<string | null>(null)
  const t = useT()

  useEffect(() => {
    window.elembi.store.progress().then(setProgress).catch(() => setProgress([]))
  }, [])

  const resumeFor = useCallback((key: string): number | undefined => progress.find((p) => p.key === key)?.position, [progress])

  const resetQueue = useCallback((): void => {
    setQueue([])
    setQueueIndex(-1)
    setSource(null)
    setBrowseSeason(null)
    setBrowseList([])
  }, [])

  const playChannel = useCallback((channel: Channel): void => {
    resetQueue()
    setTarget({
      key: `live:${channel.id}`,
      kind: 'live',
      id: channel.id,
      url: channel.url,
      title: channel.name,
      sub: channel.group,
      image: channel.logo
    })
    setMode('full')
  }, [])

  const playVod = useCallback(
    async (item: VodItem): Promise<void> => {
      resetQueue()
      try {
        if (item.kind === 'vod') {
          const url = item.url ?? (await window.elembi.iptv.vodUrl(item.id, item.containerExt))
          const key = `vod:${item.id}`
          setTarget({ key, kind: 'vod', id: item.id, url, title: item.name, sub: item.group, image: item.cover, resumeAt: resumeFor(key) })
        } else {
          const info = await window.elembi.iptv.seriesInfo(item.id)
          const episode = info.seasons[0]?.episodes[0]
          if (!episode) {
            setError(t('err.noEpisodeList'))
            return
          }
          const key = `series:${episode.id}`
          setTarget({
            key,
            kind: 'series',
            id: episode.id,
            url: episode.url,
            title: item.name,
            sub: t('episode.seasonEpisode', { season: info.seasons[0].season, episode: episode.num }),
            image: episode.still ?? item.cover,
            resumeAt: resumeFor(key)
          })
        }
        setMode('full')
      } catch (e) {
        setError(e instanceof Error ? e.message : t('err.playback'))
      }
    },
    [resumeFor, t]
  )

  const toTarget = useCallback(
    (episode: EpisodeTarget): PlaybackTarget => {
      const key = `series:${episode.episodeId}`
      return {
        key,
        kind: 'series',
        id: episode.episodeId,
        url: episode.url,
        title: episode.title,
        sub: episode.sub,
        image: episode.image,
        resumeAt: resumeFor(key),
        season: episode.season ?? null,
        episode: episode.episode ?? null,
        imdbId: episode.imdbId ?? null
      }
    },
    [resumeFor]
  )

  const playEpisodeList = useCallback(
    (episodes: EpisodeTarget[], index: number, episodeSource?: EpisodeSource): void => {
      if (index < 0 || index >= episodes.length) return
      setQueue(episodes)
      setQueueIndex(index)
      setSource(episodeSource ?? null)
      setBrowseSeason(episodeSource?.activeSeason ?? episodes[index].season ?? null)
      setBrowseList(episodes)
      setTarget(toTarget(episodes[index]))
      setMode('full')
    },
    [toTarget]
  )

  const browse = useCallback(
    (season: number): void => {
      if (!source) return
      setBrowseSeason(season)
      setBrowseLoading(true)
      source
        .load(season)
        .then(setBrowseList)
        .catch(() => setBrowseList([]))
        .finally(() => setBrowseLoading(false))
    },
    [source]
  )

  /** Picking an episode also makes its season the queue, so auto-advance follows. */
  const playFromBrowser = useCallback(
    (index: number): void => {
      if (index < 0 || index >= browseList.length) return
      setQueue(browseList)
      setQueueIndex(index)
      setTarget(toTarget(browseList[index]))
      setMode('full')
    },
    [browseList, toTarget]
  )

  const playEpisode = useCallback((episode: EpisodeTarget): void => playEpisodeList([episode], 0), [playEpisodeList])

  const advance = useCallback((): void => {
    const next = queueIndex + 1
    if (queueIndex < 0 || next >= queue.length) return
    setQueueIndex(next)
    setTarget(toTarget(queue[next]))
    setMode('full')
  }, [queue, queueIndex, toTarget])

  const playProgress = useCallback((item: Progress): void => {
    setTarget({
      key: item.key,
      kind: item.kind,
      id: item.id,
      url: item.url,
      title: item.title,
      sub: item.sub,
      image: item.image,
      resumeAt: item.position
    })
    setMode('full')
  }, [])

  const saveProgress = useCallback(
    (seconds: number, duration: number): void => {
      if (!target || target.kind === 'live') return
      window.elembi.store
        .saveProgress({
          key: target.key,
          kind: target.kind,
          id: target.id,
          url: target.url,
          title: target.title,
          sub: target.sub,
          image: target.image ?? null,
          position: seconds,
          duration
        })
        .then(setProgress)
        .catch(() => undefined)
    },
    [target]
  )

  const next = queueIndex >= 0 && queueIndex + 1 < queue.length ? queue[queueIndex + 1] : null

  return {
    target,
    mode,
    progress,
    error,
    next,
    setMode,
    close: () => {
      setTarget(null)
      resetQueue()
    },
    playChannel,
    playVod,
    playEpisode,
    playEpisodeList,
    advance,
    browser: source ? { seasons: source.seasons, season: browseSeason, list: browseList, loading: browseLoading } : null,
    browseSeason: browse,
    playFromBrowser,
    playProgress,
    saveProgress,
    clearError: () => setError(null)
  }
}
