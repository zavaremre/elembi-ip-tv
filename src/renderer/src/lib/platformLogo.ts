import type { Channel, WatchProvider } from '@shared/types'

/**
 * Finds a logo for one of the provider's categories.
 *
 * Two sources, both already in hand: TMDB's list of services for the configured
 * region covers the streaming platforms, and the catalogue's own channel icons
 * cover the broadcasters, whose categories are named after a channel we carry.
 * Nothing is hard-coded, so a category the provider adds or renames is picked up
 * on its own — and a category that is a genre rather than a platform simply gets
 * no logo instead of a misleading one.
 */

/*
 * Words that say nothing about which service a category belongs to. They are the
 * difference between reading "NETFLIX SERIES" as Netflix and failing to match it.
 */
const NOISE = new Set([
  'series',
  'serien',
  'dizileri',
  'diziler',
  'yeni',
  'animasyon',
  'yerli',
  'tr',
  'de',
  'en',
  'go',
  'hd'
])

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0 && !NOISE.has(token))
}

/**
 * Matches a category against TMDB's services. A service counts when its whole
 * name appears in the category, or when the category is named after its leading
 * word — which is what keeps "APPLE TV +" off the Turkish "TV+" logo while still
 * letting "TV + SERIES" find it.
 */
function fromProviders(group: string, providers: WatchProvider[]): string | null {
  const wanted = tokens(group)
  if (wanted.length === 0) return null
  const set = new Set(wanted)

  let best: WatchProvider | null = null
  let score = 0
  for (const provider of providers) {
    if (!provider.logo) continue
    const theirs = tokens(provider.name)
    if (theirs.length === 0) continue
    const hits = theirs.filter((token) => set.has(token)).length
    if (hits === 0) continue
    if (hits !== theirs.length && theirs[0] !== wanted[0]) continue
    if (hits > score) {
      score = hits
      best = provider
    }
  }
  return best?.logo ?? null
}

/**
 * Matches a category against the channels we carry. "TV" is dropped from both
 * sides because the catalogue uses it inconsistently — "SHOW TV DIZILERI" against
 * the channel "SHOW TV" — and what remains has to match exactly, so a
 * documentaries category does not end up wearing a broadcaster's logo.
 */
function fromChannels(group: string, channels: Channel[]): string | null {
  const wanted = new Set(tokens(group).filter((token) => token !== 'tv'))
  if (wanted.size === 0) return null

  for (const channel of channels) {
    if (!channel.logo) continue
    const theirs = new Set(tokens(channel.name).filter((token) => token !== 'tv'))
    if (theirs.size !== wanted.size) continue
    let same = true
    for (const token of theirs) {
      if (!wanted.has(token)) {
        same = false
        break
      }
    }
    if (same) return channel.logo
  }
  return null
}

export function platformLogo(group: string, providers: WatchProvider[], channels: Channel[]): string | null {
  return fromProviders(group, providers) ?? fromChannels(group, channels)
}
