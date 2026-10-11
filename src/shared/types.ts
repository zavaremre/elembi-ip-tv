/** Contract shared between the main and renderer processes. */

export type MediaKind = 'movie' | 'tv'

export interface TmdbItem {
  id: number
  kind: MediaKind
  title: string
  /** Also returned by the list endpoints; raises the provider hit rate a lot. */
  originalTitle?: string
  overview: string
  poster: string | null
  backdrop: string | null
  logo?: string | null
  year: string | null
  rating: number
  genres: string[]
  runtime?: number | null
  seasons?: number | null
}

export interface Genre {
  id: number
  name: string
  kind: MediaKind
}

/** Live channel from the Xtream panel. */
export interface Channel {
  id: number
  num: number
  name: string
  logo: string | null
  group: string
  epgId: string | null
  country: string | null
  url: string
  archive: boolean
}

export interface EpgEntry {
  title: string
  description: string
  start: number
  stop: number
}

export interface NowNext {
  now: EpgEntry | null
  next: EpgEntry | null
  progress: number
}

/** Sport channels mark tape-delayed and highlight programmes; a fixture carries that state. */
export type FixtureTag = 'live' | 'scheduled' | 'replay' | 'highlights'

/** Fixture parsed out of an EPG programme title. */
export interface Match {
  channelId: number
  channelName: string
  channelLogo: string | null
  league: string
  home: string
  away: string
  start: number
  stop: number
  live: boolean
  minute: number | null
  tag: FixtureTag
}

/** Xtream VOD movie or series entry. */
export interface VodItem {
  id: number
  kind: 'vod' | 'series'
  name: string
  cover: string | null
  rating: number | null
  group: string
  country: string | null
  audio: AudioVariant
  added: number
  url?: string
  containerExt?: string
}

export interface Progress {
  key: string
  kind: 'live' | 'vod' | 'series'
  id: number
  /** Stored so a resume never has to guess the container extension again. */
  url: string
  title: string
  sub?: string
  image?: string | null
  position: number
  duration: number
  updated: number
}

export interface AppConfig {
  xtream: { host: string; user: string; pass: string; output: string }
  tmdb: { lang: string; region: string; hasToken: boolean }
  externalPlayer: string
  favorites: number[]
  /** Where settings and caches live; differs on every platform. */
  dataDir: string
  platform: string
}

export interface ProviderStatus {
  ok: boolean
  message: string
  /** Set when the catalogue on screen came from disk rather than the panel. */
  offline?: boolean
  user?: { status: string; expires: string | null; maxConnections: string; activeConnections: string }
  counts?: { live: number; vod: number; series: number }
}

/* ── TMDB detail ──────────────────────────────── */

export interface CastMember {
  id: number
  name: string
  character: string
  profile: string | null
}

/**
 * Someone worth noticing this week, with the trending titles they are in.
 *
 * Not from TMDB's own person trending list: that is driven by raw page views and
 * measured as unusable — twenty entries with popularity between 1 and 19, no
 * known-for credits at all, and names from the adult industry. The cast of the
 * week's trending titles is the same question answered with real data.
 */
export interface TrendingPerson {
  id: number
  name: string
  profile: string | null
  /** The trending titles they appear in, which is why they are listed. */
  titles: TmdbItem[]
}

export interface CrewMember {
  id: number
  name: string
  job: string
}

export interface Keyword {
  id: number
  name: string
}

export interface SeasonSummary {
  number: number
  name: string
  episodes: number
  air: string | null
  poster: string | null
  overview: string
}

/** Everything the detail page shows, in one request via append_to_response. */
export interface TmdbDetail extends TmdbItem {
  tagline: string
  status: string
  originalTitle: string
  originalLanguage: string
  /** Original plus localised titles; used to match the provider catalogue. */
  alternativeTitles: string[]
  keywords: Keyword[]
  cast: CastMember[]
  directors: CrewMember[]
  trailerKey: string | null
  certification: string | null
  countries: string[]
  networks: string[]
  voteCount: number
  episodeRuntime: number | null
  seasonsList: SeasonSummary[]
  similar: TmdbItem[]
  recommendations: TmdbItem[]
  imdbId: string | null
  watch: WatchOptions
  /** The series a film belongs to, when TMDB groups it into one. */
  collection: { id: number; name: string } | null
}

/** 'dub' = Turkish audio, 'sub' = original audio with subtitles. */
export type AudioVariant = 'dub' | 'sub' | null

export interface WatchProvider {
  id: number
  name: string
  logo: string | null
}

/** Legal streaming options for the configured region, from TMDB/JustWatch. */
export interface WatchOptions {
  link: string | null
  flatrate: WatchProvider[]
  rent: WatchProvider[]
  buy: WatchProvider[]
  free: WatchProvider[]
}

export interface SearchResult {
  titles: TmdbItem[]
  keywords: Keyword[]
}

/* ── discover / filtering ─────────────────────── */

export type SortOption =
  | 'popularity.desc'
  | 'vote_average.desc'
  | 'primary_release_date.desc'
  | 'revenue.desc'
  | 'title.asc'

export interface DiscoverFilters {
  kind: MediaKind
  /** Free text. TMDB search ignores filters, so those are applied locally. */
  query: string
  genreIds: number[]
  keywordIds: number[]
  /**
   * A cast member whose work is being browsed. The name travels with the id so
   * the chip can say who it is — unlike keywords, which show as a bare "#1234".
   */
  person: { id: number; name: string } | null
  yearFrom: number | null
  yearTo: number | null
  minRating: number | null
  minVotes: number | null
  language: string | null
  sort: SortOption
  page: number
}

export interface DiscoverResult {
  items: TmdbItem[]
  page: number
  totalPages: number
  totalResults: number
  /** True when filters had to be applied locally because a text query was used. */
  filteredLocally: boolean
}

/* ── seasons and episodes ─────────────────────── */

export interface Episode {
  number: number
  name: string
  overview: string
  still: string | null
  air: string | null
  runtime: number | null
  rating: number
}

export interface SeasonDetail {
  number: number
  name: string
  overview: string
  poster: string | null
  air: string | null
  episodes: Episode[]
}

/* ── subtitles ────────────────────────────────── */

/** Remembered subtitle offset for one title, in seconds. */
export interface SubtitleSync {
  delay: number
}

export interface SubtitleFile {
  label: string
  /** WebVTT text, ready to be turned into a blob track. */
  vtt: string
}

/* ── local remux ──────────────────────────────── */

export interface AudioTrackInfo {
  /** Position among audio streams, which is what ffmpeg's -map expects. */
  order: number
  language: string | null
  title: string | null
  codec: string
  channels: number
  /** False for AC-3, E-AC-3, DTS and friends, which Chromium cannot decode. */
  playable: boolean
}

/**
 * A subtitle track carried inside the file. These are worth far more than
 * anything downloaded: they ship with the video, so their timing cannot drift.
 */
export interface SubtitleTrackInfo {
  /** Position among subtitle streams, which is what ffmpeg's -map 0:s:N wants. */
  order: number
  language: string | null
  title: string | null
  codec: string
  /** False for bitmap formats like PGS, which cannot become text without OCR. */
  text: boolean
}

export interface MediaProbe {
  duration: number
  audio: AudioTrackInfo[]
  subtitles: SubtitleTrackInfo[]
  needsRemux: boolean
}


/** One artwork lookup for a provider entry. */
export interface ArtworkRequest {
  /** Stable cache key, e.g. "series-8". */
  key: string
  name: string
  kind: 'vod' | 'series'
  year?: number | null
}
