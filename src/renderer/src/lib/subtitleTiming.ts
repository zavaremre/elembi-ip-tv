import { parseTitle } from '@shared/title'

export { parseStamp, retimeVtt } from '@shared/vtt'

/**
 * Key the remembered timing is stored under. Episodes of a series share one, so
 * an offset found on one episode applies to the rest; films key on their id.
 *
 * Series key on the normalised title because the two ways into an episode carry
 * different names for the same show — the provider's and TMDB's — and both
 * normalise to the same string. Measured over the 2133 series in the catalogue:
 * the title alone let 56 groups collide, the year brings that down to 4 and all
 * four are the same show listed twice. The raw name is the fallback for titles
 * that normalise to nothing, such as non-Latin ones or a bare year like "1923".
 */
export function syncKeyFor(kind: 'live' | 'vod' | 'series', id: number, title: string): string {
  if (kind !== 'series') return `${kind}:${id}`
  const parsed = parseTitle(title)
  const base = parsed.title || title.trim().toLowerCase()
  return `series:${parsed.year ? `${base}:${parsed.year}` : base}`
}
