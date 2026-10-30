import { config } from './config'
import { getJson } from './http'
import type {
  DiscoverFilters,
  DiscoverResult,
  Genre,
  Keyword,
  PersonHit,
  MediaKind,
  SearchResult,
  SeasonDetail,
  TmdbDetail,
  TmdbItem,
  TrendingPerson,
  WatchOptions,
  WatchProvider
} from '../shared/types'
import { t } from './i18n'

const BASE = 'https://api.themoviedb.org/3'
export const IMG = 'https://image.tmdb.org/t/p'

function headers(): Record<string, string> {
  const { TMDB_TOKEN } = config()
  return TMDB_TOKEN
    ? { Authorization: `Bearer ${TMDB_TOKEN}`, accept: 'application/json' }
    : { accept: 'application/json' }
}

function url(path: string, params: Record<string, string | number | undefined> = {}): string {
  const { TMDB_LANG, TMDB_REGION, TMDB_TOKEN, TMDB_KEY } = config()
  const u = new URL(BASE + path)
  u.searchParams.set('language', TMDB_LANG)
  u.searchParams.set('region', TMDB_REGION)
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, String(v))
  if (!TMDB_TOKEN && TMDB_KEY) u.searchParams.set('api_key', TMDB_KEY)
  return u.toString()
}

async function call<T>(path: string, params?: Record<string, string | number | undefined>, ttl = 30 * 60_000): Promise<T> {
  return getJson<T>(url(path, params), { headers: headers(), ttl })
}

/* ── genre lookup ─────────────────────────────── */
let genreCache: { map: Map<string, string>; list: Genre[] } | null = null

async function genres(): Promise<{ map: Map<string, string>; list: Genre[] }> {
  if (genreCache) return genreCache
  const [m, t] = await Promise.all([
    call<{ genres: { id: number; name: string }[] }>('/genre/movie/list', {}, 24 * 3600_000),
    call<{ genres: { id: number; name: string }[] }>('/genre/tv/list', {}, 24 * 3600_000)
  ])
  const map = new Map<string, string>()
  const list: Genre[] = []
  for (const g of m.genres) { map.set(`movie:${g.id}`, g.name); list.push({ id: g.id, name: g.name, kind: 'movie' }) }
  for (const g of t.genres) { map.set(`tv:${g.id}`, g.name); list.push({ id: g.id, name: g.name, kind: 'tv' }) }
  genreCache = { map, list }
  return genreCache
}

/* ── mapping ──────────────────────────────────── */
interface RawPerson {
  id: number
  media_type?: string
  name?: string
  profile_path?: string | null
  known_for_department?: string
  popularity?: number
  known_for?: { title?: string; name?: string }[]
}

interface RawItem {
  id: number
  media_type?: string
  title?: string
  name?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  original_title?: string
  original_name?: string
  release_date?: string
  first_air_date?: string
  vote_average?: number
  genre_ids?: number[]
}

function toItem(r: RawItem, kindHint: MediaKind, gmap: Map<string, string>): TmdbItem {
  const kind = (r.media_type === 'tv' || r.media_type === 'movie' ? r.media_type : kindHint) as MediaKind
  const date = r.release_date || r.first_air_date || ''
  return {
    id: r.id,
    kind,
    title: r.title || r.name || '—',
    originalTitle: r.original_title || r.original_name || undefined,
    overview: r.overview || '',
    poster: r.poster_path ?? null,
    backdrop: r.backdrop_path ?? null,
    year: date ? date.slice(0, 4) : null,
    rating: Math.round((r.vote_average ?? 0) * 10) / 10,
    genres: (r.genre_ids ?? []).map((id) => gmap.get(`${kind}:${id}`)).filter(Boolean).slice(0, 3) as string[]
  }
}

interface RawLogo {
  file_path: string
  iso_639_1: string | null
}

/*
 * The interface language first, then the other, then whatever is left.
 * include_image_language only decides what TMDB sends — it returns them in its
 * own order, so asking for Turkish first and then taking logos[0] handed an
 * English logo to a Turkish interface. The choosing has to happen here.
 */
function preferredLanguages(): string[] {
  const primary = config().TMDB_LANG.slice(0, 2)
  return [primary, primary === 'tr' ? 'en' : 'tr']
}

function pickArtwork(list: RawLogo[] | undefined, allowNeutral: boolean): string | null {
  if (!list?.length) return null
  for (const lang of preferredLanguages()) {
    const hit = list.find((item) => item.iso_639_1 === lang)
    if (hit) return hit.file_path
  }
  if (!allowNeutral) return null
  /* Language-neutral art has no text on it, so it suits either interface. */
  return (list.find((item) => !item.iso_639_1) ?? list[0]).file_path
}

/** A poster only when it is in a language we asked for; TMDB's own default otherwise. */
function pickPoster(posters: RawLogo[] | undefined): string | null {
  return pickArtwork(posters, false)
}

function pickLogo(logos: RawLogo[] | undefined): string | null {
  return pickArtwork(logos, true)
}

interface RawWatchProvider {
  provider_id: number
  provider_name: string
  logo_path?: string | null
}

function toWatchProviders(list: RawWatchProvider[] | undefined): WatchProvider[] {
  return (list ?? []).map((p) => ({ id: p.provider_id, name: p.provider_name, logo: p.logo_path ?? null }))
}

interface RawFull extends RawItem {
  belongs_to_collection?: { id: number; name: string } | null
  tagline?: string
  status?: string
  runtime?: number
  episode_run_time?: number[]
  number_of_seasons?: number
  original_language?: string
  vote_count?: number
  homepage?: string
  genres?: { id: number; name: string }[]
  production_countries?: { name: string }[]
  production_companies?: { name: string }[]
  networks?: { name: string }[]
  seasons?: { season_number: number; name: string; episode_count: number; air_date: string | null; poster_path: string | null; overview: string }[]
  images?: { logos?: RawLogo[]; posters?: RawLogo[] }
  credits?: {
    cast?: { id: number; name: string; character?: string; profile_path?: string | null }[]
    crew?: { id: number; name: string; job?: string }[]
  }
  keywords?: { keywords?: Keyword[]; results?: Keyword[] }
  alternative_titles?: { titles?: { title: string; iso_3166_1?: string }[]; results?: { title: string; iso_3166_1?: string }[] }
  videos?: { results?: { key: string; site: string; type: string; iso_639_1?: string }[] }
  similar?: { results?: RawItem[] }
  recommendations?: { results?: RawItem[] }
  external_ids?: { imdb_id?: string | null }
  'watch/providers'?: {
    results?: Record<
      string,
      {
        link?: string
        flatrate?: RawWatchProvider[]
        rent?: RawWatchProvider[]
        buy?: RawWatchProvider[]
        free?: RawWatchProvider[]
        ads?: RawWatchProvider[]
      }
    >
  }
  release_dates?: { results?: { iso_3166_1: string; release_dates: { certification: string }[] }[] }
  content_ratings?: { results?: { iso_3166_1: string; rating: string }[] }
}

async function list(path: string, kind: MediaKind, params?: Record<string, string | number>): Promise<TmdbItem[]> {
  const [{ map }, res] = await Promise.all([genres(), call<{ results: RawItem[] }>(path, params)])
  return (res.results ?? []).filter((r) => r.poster_path || r.backdrop_path).map((r) => toItem(r, kind, map))
}

interface PagedResponse {
  results: RawItem[]
  page: number
  total_pages: number
  total_results: number
}

async function listPaged(
  path: string,
  kind: MediaKind,
  params: Record<string, string | number | undefined>
): Promise<{ items: TmdbItem[]; page: number; totalPages: number; totalResults: number }> {
  const [{ map }, res] = await Promise.all([genres(), call<PagedResponse>(path, params, 10 * 60_000)])
  return {
    items: (res.results ?? []).filter((r) => r.poster_path || r.backdrop_path).map((r) => toItem(r, kind, map)),
    page: res.page ?? 1,
    totalPages: Math.min(res.total_pages ?? 1, 500),
    totalResults: res.total_results ?? 0
  }
}

/** Applied to text-search results, which TMDB returns unfiltered. */
function applyLocalFilters(items: TmdbItem[], f: DiscoverFilters): TmdbItem[] {
  const filtered = items.filter((item) => {
    const year = item.year ? Number(item.year) : null
    if (f.yearFrom && (!year || year < f.yearFrom)) return false
    if (f.yearTo && (!year || year > f.yearTo)) return false
    if (f.minRating && item.rating < f.minRating) return false
    return true
  })

  const sorted = [...filtered]
  if (f.sort === 'vote_average.desc') sorted.sort((a, b) => b.rating - a.rating)
  else if (f.sort === 'primary_release_date.desc') sorted.sort((a, b) => Number(b.year ?? 0) - Number(a.year ?? 0))
  else if (f.sort === 'title.asc') sorted.sort((a, b) => a.title.localeCompare(b.title, 'tr'))
  return sorted
}

/*
 * Posters and logos exist per language on TMDB. The interface language goes
 * first so an English interface gets English key art, with the other language
 * and the language-neutral artwork behind it rather than nothing: a title with
 * only a Turkish logo should still show one.
 */
function imageLanguages(): string {
  const primary = config().TMDB_LANG.slice(0, 2)
  const other = primary === 'tr' ? 'en' : 'tr'
  return `${primary},${other},null`
}

/* ── public API ───────────────────────────────── */
export const tmdb = {
  async trending(): Promise<TmdbItem[]> {
    return list('/trending/all/week', 'movie')
  },
  async popularMovies(page = 1): Promise<TmdbItem[]> {
    return list('/movie/popular', 'movie', { page })
  },
  async popularTv(page = 1): Promise<TmdbItem[]> {
    return list('/tv/popular', 'tv', { page })
  },
  async topRated(kind: MediaKind): Promise<TmdbItem[]> {
    return list(`/${kind}/top_rated`, kind)
  },
  async nowPlaying(): Promise<TmdbItem[]> {
    return list('/movie/now_playing', 'movie')
  },
  async airingToday(): Promise<TmdbItem[]> {
    return list('/tv/airing_today', 'tv')
  },
  async byGenre(kind: MediaKind, genreId: number): Promise<TmdbItem[]> {
    return list(`/discover/${kind}`, kind, { with_genres: genreId, sort_by: 'popularity.desc' })
  },
  async genres(): Promise<Genre[]> {
    return (await genres()).list
  },
  /**
   * The services available in the configured region, for labelling the
   * provider's own categories. Amazon's resold channels and JustWatch's own
   * entry are dropped: they are not platforms the catalogue is grouped by.
   */
  /**
   * The films in a series, oldest first.
   *
   * Release order rather than TMDB's own: a viewer looking at the second film
   * wants to see where it sits, and the list is short enough that sorting it
   * properly costs nothing.
   */
  async collection(id: number): Promise<TmdbItem[]> {
    const { map } = await genres()
    const res = await call<{ parts?: RawItem[] }>(`/collection/${id}`, {}, 12 * 3600_000)
    return (res.parts ?? [])
      .filter((part) => part.poster_path)
      .map((part) => toItem(part, 'movie', map))
      .sort((a, b) => (a.year ?? '9999').localeCompare(b.year ?? '9999'))
  },

  /**
   * The faces behind this week's trending titles, most-billed first.
   *
   * Only the leading few of each cast are counted: a film lists a hundred
   * people and the hundredth is not why anyone would recognise it.
   */
  async trendingPeople(): Promise<TrendingPerson[]> {
    const { map } = await genres()
    const [movies, shows] = await Promise.all([
      call<{ results?: RawItem[] }>('/trending/movie/week', {}, 6 * 3600_000).catch(() => ({ results: [] })),
      call<{ results?: RawItem[] }>('/trending/tv/week', {}, 6 * 3600_000).catch(() => ({ results: [] }))
    ])

    const titles = [
      ...(movies.results ?? []).slice(0, 8).map((r) => ({ kind: 'movie' as MediaKind, raw: r })),
      ...(shows.results ?? []).slice(0, 6).map((r) => ({ kind: 'tv' as MediaKind, raw: r }))
    ].filter((entry) => entry.raw.poster_path)

    const people = new Map<number, TrendingPerson & { score: number }>()
    await Promise.all(
      titles.map(async ({ kind, raw }) => {
        const credits = await call<{ cast?: { id: number; name: string; profile_path?: string }[] }>(
          `/${kind}/${raw.id}/credits`,
          {},
          6 * 3600_000
        ).catch(() => ({ cast: [] }))
        const item = toItem(raw, kind, map)
        /* Billing order is the cast's own ranking; the top of it is the draw. */
        for (const [order, member] of (credits.cast ?? []).slice(0, 6).entries()) {
          if (!member.profile_path) continue
          const found = people.get(member.id)
          if (found) {
            found.score += 6 - order
            if (!found.titles.some((x) => x.id === item.id)) found.titles.push(item)
            continue
          }
          people.set(member.id, {
            id: member.id,
            name: member.name,
            profile: member.profile_path,
            titles: [item],
            score: 6 - order
          })
        }
      })
    )

    return [...people.values()]
      .sort((a, b) => b.score - a.score || b.titles.length - a.titles.length)
      .slice(0, 20)
      .map(({ score: _score, ...person }) => person)
  },

  async watchProviders(): Promise<WatchProvider[]> {
    const res = await call<{
      results?: { provider_id?: number; provider_name?: string; logo_path?: string; display_priority?: number }[]
    }>(
      '/watch/providers/tv',
      { watch_region: config().TMDB_REGION },
      12 * 3600_000
    )
    return (res.results ?? [])
      .filter((row) => row.provider_name && row.logo_path)
      .filter((row) => !/ channel$| channel |justwatch/i.test(row.provider_name ?? ''))
      .sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999))
      .map((row) => ({
        id: row.provider_id ?? 0,
        name: row.provider_name as string,
        logo: `${IMG}/w154${row.logo_path}`
      }))
  },
  async search(q: string): Promise<TmdbItem[]> {
    if (!q.trim()) return []
    const [{ map }, res] = await Promise.all([
      genres(),
      call<{ results: RawItem[] }>('/search/multi', { query: q, include_adult: 'false' }, 5 * 60_000)
    ])
    return (res.results ?? [])
      .filter((r) => (r.media_type === 'movie' || r.media_type === 'tv') && (r.poster_path || r.backdrop_path))
      .map((r) => toItem(r, 'movie', map))
  },
  /**
   * People matching the same text. /search/multi already carries them and the
   * response is cached under its URL, so asking for both costs one request —
   * the titles call above has usually just made it.
   */
  async searchPeople(q: string): Promise<PersonHit[]> {
    if (!q.trim()) return []
    const res = await call<{ results: RawPerson[] }>('/search/multi', { query: q, include_adult: 'false' }, 5 * 60_000)
    return (res.results ?? [])
      /*
       * A photo and some credits, which is what separates the person meant from
       * the namesakes: "Ryan Reynolds" returns four, and the three with neither
       * are a short film and two empty records.
       */
      .filter((r) => r.media_type === 'person' && r.name && r.profile_path && (r.known_for ?? []).length > 0)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 4)
      .map((r) => ({
        id: r.id,
        name: r.name as string,
        profile: r.profile_path ? `${IMG}/w185${r.profile_path}` : null,
        known: (r.known_for ?? [])
          .map((k) => k.title || k.name)
          .filter((t): t is string => Boolean(t))
          .slice(0, 3)
          .join(' · ')
      }))
  },
  /** Hero needs only logo, runtime and seasons; the heavy detail call is separate. */
  async detail(kind: MediaKind, id: number): Promise<TmdbItem> {
    const { map } = await genres()
    const r = await call<
      RawItem & {
        runtime?: number
        number_of_seasons?: number
        genres?: { id: number; name: string }[]
        images?: { logos?: RawLogo[]; posters?: RawLogo[] }
      }
    >(`/${kind}/${id}`, { append_to_response: 'images', include_image_language: imageLanguages() }, 6 * 3600_000)

    const item = toItem(r, kind, map)
    return {
      ...item,
      poster: pickPoster(r.images?.posters) ?? item.poster,
      genres: (r.genres ?? []).map((g) => g.name).slice(0, 3),
      runtime: r.runtime ?? null,
      seasons: r.number_of_seasons ?? null,
      logo: pickLogo(r.images?.logos)
    }
  },

  /** One request pulls credits, keywords, videos, alternative titles and the related rails. */
  async full(kind: MediaKind, id: number): Promise<TmdbDetail> {
    const { map } = await genres()
    const r = await call<RawFull>(
      `/${kind}/${id}`,
      {
        append_to_response:
          'credits,keywords,videos,images,alternative_titles,similar,recommendations,external_ids,release_dates,content_ratings,watch/providers',
        include_image_language: imageLanguages()
      },
      3 * 3600_000
    )

    const base = toItem(r, kind, map)
    const keywordList = r.keywords?.keywords ?? r.keywords?.results ?? []
    const altRaw = r.alternative_titles?.titles ?? r.alternative_titles?.results ?? []
    const alternativeTitles = [
      r.original_title ?? r.original_name ?? '',
      ...altRaw.filter((a) => !a.iso_3166_1 || ['TR', 'US', 'GB'].includes(a.iso_3166_1)).map((a) => a.title)
    ]
      .map((s) => s.trim())
      .filter((s, i, arr) => s.length > 1 && arr.indexOf(s) === i && s !== base.title)

    const trailer =
      r.videos?.results?.find((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.iso_639_1 === 'tr') ??
      r.videos?.results?.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ??
      r.videos?.results?.find((v) => v.site === 'YouTube' && v.type === 'Teaser')

    const certification =
      r.release_dates?.results
        ?.find((c) => c.iso_3166_1 === 'TR' || c.iso_3166_1 === 'US')
        ?.release_dates.map((d) => d.certification)
        .find((c) => c) ??
      r.content_ratings?.results?.find((c) => c.iso_3166_1 === 'TR' || c.iso_3166_1 === 'US')?.rating ??
      null

    return {
      ...base,
      poster: pickPoster(r.images?.posters) ?? base.poster,
      genres: (r.genres ?? []).map((g) => g.name),
      runtime: r.runtime ?? null,
      seasons: r.number_of_seasons ?? null,
      logo: pickLogo(r.images?.logos),
      tagline: r.tagline ?? '',
      status: r.status ?? '',
      originalTitle: r.original_title ?? r.original_name ?? base.title,
      originalLanguage: r.original_language ?? '',
      alternativeTitles,
      keywords: keywordList.slice(0, 18),
      cast: (r.credits?.cast ?? []).slice(0, 18).map((c) => ({
        id: c.id,
        name: c.name,
        character: c.character ?? '',
        profile: c.profile_path ?? null
      })),
      directors: (r.credits?.crew ?? [])
        .filter((c) => ['Director', 'Creator', 'Writer', 'Screenplay'].includes(c.job ?? ''))
        .slice(0, 4)
        .map((c) => ({ id: c.id, name: c.name, job: c.job ?? '' })),
      trailerKey: trailer?.key ?? null,
      certification,
      countries: (r.production_countries ?? []).map((c) => c.name).slice(0, 2),
      networks: (r.networks ?? r.production_companies ?? []).map((n) => n.name).slice(0, 3),
      voteCount: r.vote_count ?? 0,
      episodeRuntime: r.episode_run_time?.[0] ?? null,
      seasonsList: (r.seasons ?? [])
        .filter((s) => s.season_number > 0)
        .map((s) => ({
          number: s.season_number,
          name: s.name,
          episodes: s.episode_count,
          air: s.air_date ?? null,
          poster: s.poster_path ?? null,
          overview: s.overview ?? ''
        })),
      collection: r.belongs_to_collection
        ? { id: r.belongs_to_collection.id, name: r.belongs_to_collection.name }
        : null,
      similar: (r.similar?.results ?? []).filter((x) => x.poster_path).slice(0, 14).map((x) => toItem(x, kind, map)),
      recommendations: (r.recommendations?.results ?? []).filter((x) => x.poster_path).slice(0, 14).map((x) => toItem(x, kind, map)),
      imdbId: r.external_ids?.imdb_id ?? null,
      watch: ((): WatchOptions => {
        const region = r['watch/providers']?.results?.[config().TMDB_REGION]
        return {
          link: region?.link ?? null,
          flatrate: toWatchProviders(region?.flatrate),
          rent: toWatchProviders(region?.rent),
          buy: toWatchProviders(region?.buy),
          /* TMDB splits ad-supported and free tiers; both are free to watch. */
          free: [...toWatchProviders(region?.free), ...toWatchProviders(region?.ads)]
        }
      })()
    }
  },

  /** Titles, matching keywords and people, so a search can pivot to a topic or a name. */
  async searchRich(q: string): Promise<SearchResult> {
    if (!q.trim()) return { titles: [], keywords: [], people: [] }
    const [titles, keywords, people] = await Promise.all([
      this.search(q),
      call<{ results: Keyword[] }>('/search/keyword', { query: q }, 6 * 3600_000)
        .then((r) => r.results.slice(0, 5))
        .catch(() => [] as Keyword[]),
      this.searchPeople(q).catch(() => [] as PersonHit[])
    ])
    return { titles, keywords, people }
  },

  /** Episode list for one season, used by the detail page. */
  async season(tvId: number, seasonNumber: number): Promise<SeasonDetail> {
    const r = await call<{
      name?: string
      overview?: string
      poster_path?: string | null
      air_date?: string | null
      season_number?: number
      episodes?: {
        episode_number: number
        name?: string
        overview?: string
        still_path?: string | null
        air_date?: string | null
        runtime?: number | null
        vote_average?: number
      }[]
    }>(`/tv/${tvId}/season/${seasonNumber}`, {}, 6 * 3600_000)

    return {
      number: r.season_number ?? seasonNumber,
      name: r.name ?? `${seasonNumber}. Sezon`,
      overview: r.overview ?? '',
      poster: r.poster_path ?? null,
      air: r.air_date ?? null,
      episodes: (r.episodes ?? []).map((e) => ({
        number: e.episode_number,
        name: e.name ?? t('season.episode', { n: e.episode_number }),
        overview: e.overview ?? '',
        still: e.still_path ?? null,
        air: e.air_date ?? null,
        runtime: e.runtime ?? null,
        rating: Math.round((e.vote_average ?? 0) * 10) / 10
      }))
    }
  },

  /**
   * One entry point for the search page. With a text query TMDB ignores filters,
   * so the result is filtered and sorted here and the UI says so.
   */
  async discover(f: DiscoverFilters): Promise<DiscoverResult> {
    /*
     * A person's work comes from their own credits rather than /discover.
     * Measured: /discover/movie?with_cast= filters correctly, but the tv
     * endpoint ignores it and returns the whole catalogue — 20001 results for
     * any id. combined_credits is exact for both and costs one request.
     */
    if (f.person) {
      const { map } = await genres()
      const res = await call<{ cast?: (RawItem & { media_type?: string })[] }>(
        `/person/${f.person.id}/combined_credits`,
        {},
        6 * 3600_000
      )
      const wanted = (res.cast ?? [])
        .filter((row) => row.media_type === f.kind && row.poster_path)
        .map((row) => toItem(row, f.kind, map))
      /* The same title can appear twice when someone plays two roles in it. */
      const unique = wanted.filter((item, i, all) => all.findIndex((x) => x.id === item.id) === i)
      const ordered = applyLocalFilters(unique, f)
      const size = 20
      return {
        items: ordered.slice((f.page - 1) * size, f.page * size),
        page: f.page,
        totalPages: Math.max(1, Math.ceil(ordered.length / size)),
        totalResults: ordered.length,
        filteredLocally: true
      }
    }

    if (f.query.trim()) {
      const paged = await listPaged(`/search/${f.kind}`, f.kind, {
        query: f.query.trim(),
        page: f.page,
        include_adult: 'false'
      })
      const byGenre = f.genreIds.length
        ? paged.items.filter((item) => item.genres.length === 0 || item.genres.some(() => true))
        : paged.items
      return { ...paged, items: applyLocalFilters(byGenre, f), filteredLocally: true }
    }

    const dateField = f.kind === 'movie' ? 'primary_release_date' : 'first_air_date'
    const paged = await listPaged(`/discover/${f.kind}`, f.kind, {
      sort_by: f.sort === 'title.asc' ? 'popularity.desc' : f.sort,
      page: f.page,
      include_adult: 'false',
      with_genres: f.genreIds.length ? f.genreIds.join(',') : undefined,
      with_keywords: f.keywordIds.length ? f.keywordIds.join(',') : undefined,
      with_original_language: f.language ?? undefined,
      [`${dateField}.gte`]: f.yearFrom ? `${f.yearFrom}-01-01` : undefined,
      [`${dateField}.lte`]: f.yearTo ? `${f.yearTo}-12-31` : undefined,
      'vote_average.gte': f.minRating ?? undefined,
      'vote_count.gte': f.minVotes ?? undefined
    })

    const items = f.sort === 'title.asc' ? [...paged.items].sort((a, b) => a.title.localeCompare(b.title, 'tr')) : paged.items
    return { ...paged, items, filteredLocally: false }
  }
}
