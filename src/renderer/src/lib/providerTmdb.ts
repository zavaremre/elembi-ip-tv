import { candidateVariants, parseName } from './match'
import type { MediaKind, TmdbItem } from '@shared/types'

/**
 * Finds the TMDB entry for something in the provider catalogue, by title.
 *
 * The provider's names carry years, release tags and language markers, and
 * searching with them finds almost nothing: measured over a spread of the
 * catalogue, the raw name matched 1 of 14 films while the cleaned title matched
 * 10. Each side of a "Turkish Title - English Title" name is tried in turn,
 * since either may be the one TMDB knows.
 *
 * Used for artwork and an overview, so an exact title match is required — a near
 * miss here would dress a page with the wrong film.
 */
export async function matchTmdb(name: string, kind: MediaKind): Promise<TmdbItem | null> {
  const variants = candidateVariants(name)
  const queries = [...new Set(variants.map((variant) => variant.title).filter(Boolean))]
  if (queries.length === 0) return null

  for (const query of queries) {
    const results = await window.elembi.tmdb.search(query).catch(() => [])
    const sameKind = results.filter((item) => item.kind === kind)
    const exact = sameKind.filter((item) =>
      variants.some((variant) => parseName(item.title).title === variant.title)
    )
    if (exact.length === 0) continue

    /* Several titles repeat across years; the year in the provider's name picks. */
    const year = variants.find((variant) => variant.year)?.year
    const pick = (year && exact.find((item) => item.year === String(year))) || exact[0]
    /* The search endpoint carries no logo or runtime, so the match is detailed. */
    return window.elembi.tmdb.detail(pick.kind, pick.id).catch(() => pick)
  }
  return null
}
