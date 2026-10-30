import type { VodItem } from '@shared/types'

/**
 * What the provider has just put in the catalogue.
 *
 * The obvious source for "new" would be TMDB's own release lists, and it was
 * measured first: of 46 titles in now_playing only 3 were in this catalogue,
 * and those were re-releases of 2006 and 2019 films. upcoming matched nothing
 * at all. The provider's own added timestamp is both denser and the truthful
 * answer to the question — it is this subscription that gained something.
 *
 * Films and series are mixed because they arrive mixed. For a series the stamp
 * moves when an episode lands, so the row says "added", not "released": a
 * long-running show reappears when its new episode does, which is the thing
 * worth surfacing about it.
 */

const DAY_MS = 86_400_000

export interface FreshOptions {
  /** How far back still counts as new. */
  days?: number
  limit?: number
}

/**
 * Taken from each catalogue separately before merging, which is the whole
 * trick: a series' stamp moves with every episode, so the daily Turkish serials
 * refresh themselves to the top every day. Merging by date alone gave a row of
 * 17 series and 3 films. Each side gets half, and whatever one side cannot fill
 * the other takes.
 */
export function recentlyAdded(
  films: VodItem[],
  series: VodItem[],
  { days = 30, limit = 20 }: FreshOptions = {}
): VodItem[] {
  const cutoff = Date.now() - days * DAY_MS
  const newest = (pool: VodItem[]): VodItem[] =>
    pool
      .filter((item) => typeof item.added === 'number' && item.added >= cutoff)
      .sort((a, b) => (b.added ?? 0) - (a.added ?? 0))

  const freshFilms = newest(films)
  const freshSeries = newest(series)
  const half = Math.ceil(limit / 2)
  const fromFilms = freshFilms.slice(0, Math.max(half, limit - freshSeries.length))
  const fromSeries = freshSeries.slice(0, Math.max(half, limit - freshFilms.length))

  return [...fromFilms, ...fromSeries].sort((a, b) => (b.added ?? 0) - (a.added ?? 0)).slice(0, limit)
}

/**
 * Relative day as a key plus its day count, so the caller translates it. This
 * module has no component around it and cannot reach the dictionary itself.
 */
export function addedLabel(added: number | null | undefined): { key: 'day.today' | 'day.yesterday' | 'day.ago'; days: number } | null {
  if (typeof added !== 'number') return null
  const days = Math.floor((Date.now() - added) / DAY_MS)
  if (days <= 0) return { key: 'day.today', days }
  if (days === 1) return { key: 'day.yesterday', days }
  if (days < 30) return { key: 'day.ago', days }
  return null
}
