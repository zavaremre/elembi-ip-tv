import { config } from './config'

/**
 * One gate in front of every request to the provider's panel.
 *
 * The subscription has no request quota, but the panel locks an address out when
 * it sees too many requests in a minute. The dub/subtitle badge is the reason the
 * volume gets high at all: only 23 of the 8947 films name their audio, so the
 * rest each need their own lookup. The answer is not to drop the badge but to
 * spend a fixed budget per minute on it.
 *
 * A token bucket rather than a fixed delay: a small burst keeps opening a film or
 * a channel guide feeling immediate, while the refill rate holds the long-run
 * average under the ceiling.
 */
const WINDOW_MS = 60_000
const DEFAULT_PER_MINUTE = 60
/* Enough for a page of interactive work without emptying a minute's budget. */
const BURST = 8
/* Background work stops here, leaving the rest of the bucket for the viewer. */
const BACKGROUND_FLOOR = 0.5

function perMinute(): number {
  const raw = Number(config().XTREAM_MAX_PER_MINUTE)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PER_MINUTE
}

let tokens = BURST
let lastRefill = Date.now()
/** Resolvers waiting for a token, interactive ones first. */
const queue: { background: boolean; resolve: () => void }[] = []
let pump: ReturnType<typeof setTimeout> | null = null

function refill(): void {
  const now = Date.now()
  const gained = ((now - lastRefill) / WINDOW_MS) * perMinute()
  if (gained <= 0) return
  tokens = Math.min(BURST, tokens + gained)
  lastRefill = now
}

/** Seconds until one more token exists, for scheduling the next drain. */
function waitForToken(): number {
  const needed = 1 - tokens
  return Math.max(10, Math.ceil((needed / perMinute()) * WINDOW_MS))
}

function drain(): void {
  pump = null
  refill()

  while (queue.length > 0) {
    /* Interactive first: a viewer waiting on a click outranks badge filling. */
    let index = queue.findIndex((item) => !item.background)
    if (index === -1) index = 0
    const next = queue[index]

    const floor = next.background ? BURST * BACKGROUND_FLOOR : 1
    if (tokens < 1 || tokens < floor) break

    queue.splice(index, 1)
    tokens -= 1
    next.resolve()
  }

  if (queue.length > 0 && pump === null) pump = setTimeout(drain, waitForToken())
}

/**
 * Waits until the panel may be asked again. `background` marks work nobody is
 * waiting on, so it yields to anything the viewer triggered.
 */
export function throttleProvider(background = false): Promise<void> {
  refill()
  const floor = background ? BURST * BACKGROUND_FLOOR : 1
  if (queue.length === 0 && tokens >= 1 && tokens >= floor) {
    tokens -= 1
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    queue.push({ background, resolve })
    if (pump === null) pump = setTimeout(drain, waitForToken())
  })
}

/** True when the url points at the provider rather than TMDB or artwork hosts. */
export function isProviderUrl(url: string): boolean {
  const host = config().XTREAM_HOST
  if (!host) return false
  try {
    return new URL(url).host === new URL(host).host
  } catch {
    return false
  }
}

/** What the gate is doing right now, for the settings screen. */
export function providerRate(): { perMinute: number; waiting: number; tokens: number } {
  refill()
  return { perMinute: perMinute(), waiting: queue.length, tokens: Math.floor(tokens) }
}
