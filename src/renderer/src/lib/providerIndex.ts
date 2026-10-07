import { candidateVariants, parseName } from './match'
import { titleKeys } from '@shared/title'
import type { TmdbItem, VodItem } from '@shared/types'

interface Entry {
  item: VodItem
  year: number | null
}

/** TMDB kinds map one-to-one onto the provider's two catalogues. */
const providerKindOf = (kind: TmdbItem['kind']): VodItem['kind'] => (kind === 'tv' ? 'series' : 'vod')

const YEAR_TOLERANCE = 1

export interface ProviderIndex {
  size: number
  /**
   * A map lookup instead of a full scan. `kind` matters: the catalogue holds 30
   * titles that exist as both a film and a series, so a film must never resolve
   * to the series of the same name.
   */
  find: (titles: (string | null | undefined)[], year: number | null, kind?: VodItem['kind']) => VodItem | null
  has: (item: TmdbItem) => boolean
}

/**
 * The catalogue runs to ~11k entries, so scanning it per title would stall the
 * rails. It is indexed once per refresh instead.
 */
export function buildProviderIndex(pool: VodItem[]): ProviderIndex {
  const byKey = new Map<string, Entry[]>()

  for (const item of pool) {
    for (const variant of candidateVariants(item.name)) {
      for (const key of titleKeys(variant)) {
        const entry: Entry = { item, year: variant.year }
        const bucket = byKey.get(key)
        if (bucket) bucket.push(entry)
        else byKey.set(key, [entry])
      }
    }
  }

  const find = (
    titles: (string | null | undefined)[],
    year: number | null,
    kind?: VodItem['kind']
  ): VodItem | null => {
    let fallback: VodItem | null = null

    for (const title of titles) {
      if (!title) continue
      for (const key of titleKeys(parseName(title))) {
        const bucket = byKey.get(key)
        if (!bucket) continue
        for (const entry of bucket) {
          if (kind && entry.item.kind !== kind) continue
          if (year === null) return entry.item
          if (entry.year === null) {
            /* An entry without a year is accepted only if nothing better turns up. */
            fallback ??= entry.item
            continue
          }
          if (Math.abs(entry.year - year) <= YEAR_TOLERANCE) return entry.item
        }
      }
    }
    return fallback
  }

  return {
    size: byKey.size,
    find,
    has: (item) =>
      find([item.title, item.originalTitle], item.year ? Number(item.year) : null, providerKindOf(item.kind)) !== null
  }
}
