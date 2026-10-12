import disney from '@/assets/platforms/disney.svg'
import exxen from '@/assets/platforms/exxen.png'
import gain from '@/assets/platforms/gain.svg'
import hbomax from '@/assets/platforms/hbomax.png'
import netflix from '@/assets/platforms/netflix.svg'
import prime from '@/assets/platforms/prime.png'
import tabii from '@/assets/platforms/tabii.svg'
import tod from '@/assets/platforms/tod.svg'
import tvplus from '@/assets/platforms/tvplus.svg'

/**
 * The services' own written logos, for the card that stands for a platform.
 *
 * TMDB ships a square app icon per service, which is what the cards used to
 * wear; on a wide card those read as a sticker rather than a brand. These are
 * each service's own wordmark, taken from its own site — seven as transparent
 * SVG, two as transparent PNG where the site publishes no vector.
 *
 * This is a written-down list, and deliberately so: there is no feed that maps
 * a service to its logo artwork. It changes nothing about how a platform is
 * recognised — that still happens dynamically in platformLogo, against TMDB's
 * list for the region and the provider's own channel icons. A service missing
 * from here simply keeps the TMDB icon, exactly as before.
 */
export interface Wordmark {
  src: string
  /** Width over height, so a card can size wide and stacked marks alike. */
  ratio: number
}

interface Entry extends Wordmark {
  /** Leading words of a category that mean this service. */
  match: string[]
}

const WORDMARKS: Entry[] = [
  { match: ['netflix'], src: netflix, ratio: 3.7 },
  { match: ['disney', 'plus'], src: disney, ratio: 1.83 },
  { match: ['amazon'], src: prime, ratio: 3.28 },
  { match: ['prime', 'video'], src: prime, ratio: 3.28 },
  /* blutv.com now redirects to HBO Max: the service was folded into it here. */
  { match: ['blutv'], src: hbomax, ratio: 1.39 },
  { match: ['hbo', 'max'], src: hbomax, ratio: 1.39 },
  { match: ['tod'], src: tod, ratio: 2.43 },
  { match: ['gain'], src: gain, ratio: 2.0 },
  { match: ['tabii'], src: tabii, ratio: 3.19 },
  { match: ['tv', 'plus'], src: tvplus, ratio: 1.63 },
  { match: ['exxen'], src: exxen, ratio: 2.06 }
]

/* The same words platformLogo ignores, for the same reason: they say nothing
 * about which service a category belongs to. */
const NOISE = new Set(['series', 'serien', 'dizileri', 'diziler', 'yeni', 'animasyon', 'yerli', 'tr', 'de', 'en', 'go', 'hd'])

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0 && !NOISE.has(token))
}

/**
 * Matched on the leading words rather than anywhere in the name, which is what
 * keeps "APPLE TV +" off the Turkish TV+ mark while "TV + SERIES" still finds it.
 */
function matches(entry: Entry, words: string[]): boolean {
  if (words.length < entry.match.length) return false
  return entry.match.every((token, at) => words[at] === token)
}

/** The wordmark for any of the categories a card stands for, if we have one. */
export function wordmarkFor(categories: string[]): Wordmark | null {
  for (const category of categories) {
    const words = tokens(category)
    const hit = WORDMARKS.find((entry) => matches(entry, words))
    if (hit) return { src: hit.src, ratio: hit.ratio }
  }
  return null
}
