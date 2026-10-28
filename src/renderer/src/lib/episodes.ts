import { backdrop } from './img'
import type { Episode } from '@shared/types'

export interface EpisodeTarget {
  url: string
  title: string
  sub: string
  image: string | null
  episodeId: number
  season?: number
  episode?: number
  imdbId?: string | null
}

export interface PlayableEpisode extends Episode {
  /** Present only when the provider carries this episode. */
  url: string | null
  providerStill: string | null
  providerId: number | null
}

/** Season and episode numbers are packed so keys can never collide. */
export const episodeKey = (tvId: number, season: number, episode: number): number =>
  tvId * 1_000_000 + season * 1_000 + episode

export interface EpisodeContext {
  tvId: number
  showTitle: string
  season: number
  imdbId?: string | null
}

export function toEpisodeTarget(context: EpisodeContext, episode: PlayableEpisode): EpisodeTarget {
  return {
    url: episode.url ?? '',
    title: context.showTitle,
    sub: `${context.season}. sezon ${episode.number}. bölüm · ${episode.name}`,
    image: backdrop(episode.still, 'w780') ?? episode.providerStill,
    episodeId: episode.providerId ?? episodeKey(context.tvId, context.season, episode.number),
    season: context.season,
    episode: episode.number,
    imdbId: context.imdbId
  }
}

/**
 * TMDB supplies episode titles, stills and air dates; the provider supplies the
 * playable URL. The two are merged on season and episode number.
 */
export async function fetchSeasonEpisodes(
  tvId: number,
  seasonNumber: number,
  providerSeriesId: number | null
): Promise<{ episodes: PlayableEpisode[]; providerCount: number; name: string }> {
  const [season, providerInfo] = await Promise.all([
    window.elembi.tmdb.season(tvId, seasonNumber),
    providerSeriesId !== null ? window.elembi.iptv.seriesInfo(providerSeriesId).catch(() => null) : Promise.resolve(null)
  ])

  const providerSeason = providerInfo?.seasons.find((s) => s.season === seasonNumber) ?? null
  const byNumber = new Map((providerSeason?.episodes ?? []).map((e) => [e.num, e]))

  return {
    name: season.name,
    providerCount: byNumber.size,
    episodes: season.episodes.map((episode) => {
      const match = byNumber.get(episode.number)
      return {
        ...episode,
        url: match?.url ?? null,
        providerStill: match?.still ?? null,
        providerId: match?.id ?? null
      }
    })
  }
}
