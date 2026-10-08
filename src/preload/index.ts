import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppConfig,
  ArtworkRequest,
  AudioVariant,
  Channel,
  DiscoverFilters,
  DiscoverResult,
  EpgEntry,
  Genre,
  Match,
  MediaKind,
  MediaProbe,
  NowNext,
  Progress,
  ProviderStatus,
  SearchResult,
  SeasonDetail,
  SubtitleFile,
  SubtitleSync,
  SubtitleTrackInfo,
  TmdbDetail,
  TmdbItem,
  VodItem,
  WatchProvider
} from '../shared/types'

type Res<T> = { ok: true; data: T } | { ok: false; error: string }

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, ...args)) as Res<T>
  if (!res.ok) throw new Error(res.error)
  return res.data
}

const api = {
  tmdb: {
    trending: () => call<TmdbItem[]>('tmdb:trending'),
    popularMovies: (page?: number) => call<TmdbItem[]>('tmdb:popularMovies', page),
    popularTv: (page?: number) => call<TmdbItem[]>('tmdb:popularTv', page),
    topRated: (kind: MediaKind) => call<TmdbItem[]>('tmdb:topRated', kind),
    nowPlaying: () => call<TmdbItem[]>('tmdb:nowPlaying'),
    airingToday: () => call<TmdbItem[]>('tmdb:airingToday'),
    byGenre: (kind: MediaKind, id: number) => call<TmdbItem[]>('tmdb:byGenre', kind, id),
    genres: () => call<Genre[]>('tmdb:genres'),
    watchProviders: () => call<WatchProvider[]>('tmdb:watchProviders'),
    search: (q: string) => call<TmdbItem[]>('tmdb:search', q),
    detail: (kind: MediaKind, id: number) => call<TmdbItem>('tmdb:detail', kind, id),
    full: (kind: MediaKind, id: number) => call<TmdbDetail>('tmdb:full', kind, id),
    searchRich: (q: string) => call<SearchResult>('tmdb:searchRich', q),
    discover: (filters: DiscoverFilters) => call<DiscoverResult>('tmdb:discover', filters),
    season: (tvId: number, seasonNumber: number) => call<SeasonDetail>('tmdb:season', tvId, seasonNumber)
  },
  iptv: {
    status: () => call<ProviderStatus>('iptv:status'),
    channels: () => call<Channel[]>('iptv:channels'),
    nowNext: (id: number) => call<NowNext>('iptv:nowNext', id),
    epg: (id: number, limit?: number) => call<EpgEntry[]>('iptv:epg', id, limit),
    matches: () => call<Match[]>('iptv:matches'),
    vod: () => call<VodItem[]>('iptv:vod'),
    series: () => call<VodItem[]>('iptv:series'),
    seriesInfo: (id: number) => call<{ seasons: { season: number; episodes: { id: number; num: number; title: string; url: string; still: string | null }[] }[] }>('iptv:seriesInfo', id),
    audioInfo: (ids: number[]) => call<Record<number, { language: string | null; variant: AudioVariant }>>('iptv:audioInfo', ids),
    liveUrl: (id: number) => call<string>('iptv:liveUrl', id),
    vodUrl: (id: number, ext?: string) => call<string>('iptv:vodUrl', id, ext),
    seriesUrl: (id: number, ext?: string) => call<string>('iptv:seriesUrl', id, ext)
  },
  media: {
    available: () => call<boolean>('media:available'),
    probe: (url: string) => call<MediaProbe>('media:probe', url),
    startHls: (src: string, audioOrder: number, start: number, subtitle: SubtitleTrackInfo | null = null) =>
      call<string>('media:startHls', src, audioOrder, start, subtitle),
    stop: () => call<boolean>('media:stop')
  },
  art: {
    logoColors: (urls: string[]) => call<Record<string, string | null>>('art:logoColors', urls),
    posters: (requests: ArtworkRequest[]) => call<Record<string, string | null>>('art:posters', requests)
  },
  teams: {
    badges: (names: string[]) => call<Record<string, string | null>>('teams:badges', names)
  },
  subs: {
    openLocal: () => call<SubtitleFile | null>('subs:openLocal'),
    sync: (key: string) => call<SubtitleSync>('subs:sync', key),
    saveSync: (key: string, sync: SubtitleSync) => call<boolean>('subs:saveSync', { key, sync })
  },
  store: {
    progress: () => call<Progress[]>('store:progress'),
    saveProgress: (p: Omit<Progress, 'updated'>) => call<Progress[]>('store:saveProgress', p),
    favorites: () => call<number[]>('store:favorites'),
    toggleFavorite: (id: number) => call<number[]>('store:toggleFavorite', id)
  },
  app: {
    config: () => call<AppConfig>('app:config'),
    setConfig: (patch: Record<string, string>) => call<boolean>('app:setConfig', patch),
    refresh: () => call<boolean>('app:refresh'),
    openInPlayer: (url: string) => call<boolean>('app:openInPlayer', url),
    platform: process.platform
  }
}

contextBridge.exposeInMainWorld('akis', api)

export type AkisApi = typeof api
