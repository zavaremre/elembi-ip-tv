import { platformLogo } from './platformLogo'
import type { Channel, VodItem, WatchProvider } from '@shared/types'

/**
 * One card per service, not per category.
 *
 * The catalogue splits a single platform across several categories — Netflix
 * alone arrives as five, including its animation and German-language shelves —
 * and showing each as its own card read as five Netflixes. Grouping by the logo
 * they resolve to puts them back together, and opening the card carries every
 * category it stands for, so the whole platform is there.
 */
export interface Platform {
  /** Stable identity: the logo for a service, the name for anything else. */
  key: string
  name: string
  count: number
  logo: string | null
  /** Every provider category this card stands for. */
  categories: string[]
}

/**
 * Shortens a name only where it has to be shortened: a card standing for several
 * categories needs one label for all of them. A card that is its own category
 * keeps the provider's wording, since trimming "DEUTSCHE SERIEN" to "DEUTSCHE"
 * loses the only thing it said.
 */
function display(group: string): string {
  const cleaned = group
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(SERIES|SERIEN|DIZILERI|DIZILER)\b/gi, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || group
}

export function buildPlatforms(
  series: VodItem[],
  providers: WatchProvider[],
  channels: Channel[]
): Platform[] {
  const counts = new Map<string, number>()
  for (const item of series) {
    const group = item.group?.trim()
    if (group && group !== 'Diğer') counts.set(group, (counts.get(group) ?? 0) + 1)
  }

  const merged = new Map<string, Platform>()
  for (const [group, count] of counts) {
    /* A category holding one entry is noise, not a shelf worth a card. */
    if (count < 2) continue
    const logo = platformLogo(group, providers, channels)
    const key = logo ?? group
    const existing = merged.get(key)
    if (existing) {
      existing.count += count
      existing.categories.push(group)
      /* The shortest label is the platform's own: "Netflix" over "Netflix Yerli". */
      const label = display(group)
      if (label.length < existing.name.length) existing.name = label
      continue
    }
    merged.set(key, { key, name: group, count, logo, categories: [group] })
  }

  return [...merged.values()]
    .map((card) => (card.categories.length > 1 ? card : { ...card, name: card.categories[0] }))
    .sort((a, b) => b.count - a.count)
}
