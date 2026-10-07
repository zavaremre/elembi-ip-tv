import type { TmdbDetail, VodItem } from '@shared/types'

import { parseTitle, titleKeys, type ParsedTitle } from '@shared/title'

export type ParsedName = ParsedTitle

/** The entry point used across the renderer; normalisation lives in shared/title. */
export const parseName = parseTitle

export function norm(value: string): string {
  return parseTitle(value).title
}

export { titleKeys }

const CATALOGUE_PREFIX = /^\s*\d{1,4}\s*[-.]\s*/
const COMPOUND_SPLIT = /\s+-\s+/

/**
 * Provider names are often "Turkish Title - English Title", so each side is
 * offered as its own candidate while the year stays read from the whole name.
 */
export function candidateVariants(raw: string): ParsedName[] {
  const whole = parseTitle(raw)
  const segments = raw.replace(CATALOGUE_PREFIX, '').split(COMPOUND_SPLIT)
  if (segments.length < 2 || segments.length > 3) return [whole]

  const variants = [whole]
  for (const segment of segments) {
    const parsed = parseTitle(segment)
    if (parsed.tokens.length === 0) continue
    if (parsed.title === whole.title) continue
    variants.push({ ...parsed, year: parsed.year ?? whole.year })
  }
  return variants
}

/** Nothing in the provider catalogue can match a title that has not come out. */
export function isReleased(detail: TmdbDetail): boolean {
  if (detail.kind === 'movie') return detail.status === 'Released'
  return detail.status !== 'Planned' && detail.status !== 'In Production'
}

/** What the detail page should say about the provider lookup. */
export type ProviderMatchState =
  | { kind: 'searching' }
  | { kind: 'found'; item: VodItem }
  | { kind: 'missing' }
  | { kind: 'unreleased'; status: string }
