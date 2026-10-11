import { describeFailure, describeStatus } from './httperror'
import { isProviderUrl, throttleProvider } from './ratelimit'

/** JSON fetcher with an in-memory TTL cache that also de-duplicates concurrent requests. */

interface Entry { at: number; ttl: number; data: unknown }

const cache = new Map<string, Entry>()
const inflight = new Map<string, Promise<unknown>>()

export function clearCache(prefix?: string): void {
  if (!prefix) return void cache.clear()
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k)
}

export async function getJson<T>(
  url: string,
  opts: {
    headers?: Record<string, string>
    ttl?: number
    timeout?: number
    /** Work nobody is waiting on; yields to anything the viewer triggered. */
    background?: boolean
  } = {}
): Promise<T> {
  const ttl = opts.ttl ?? 10 * 60_000
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < hit.ttl) return hit.data as T

  const running = inflight.get(url)
  if (running) return running as Promise<T>

  const task = (async () => {
    /*
     * Gated on the host rather than on a flag at each call site: the panel locks
     * out bursts, and a new call site added later would otherwise slip past.
     * TMDB is untouched.
     */
    if (isProviderUrl(url)) await throttleProvider(opts.background)
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), opts.timeout ?? 15_000)
    try {
      let res: Response
      try {
        res = await fetch(url, { headers: opts.headers, signal: ctrl.signal })
      } catch (error) {
        /* Nothing came back at all, which reads differently from a refusal. */
        throw new Error(describeFailure(url, error))
      }
      if (!res.ok) throw new Error(describeStatus(url, res.status))
      const data = (await res.json()) as T
      cache.set(url, { at: Date.now(), ttl, data })
      return data
    } finally {
      clearTimeout(t)
      inflight.delete(url)
    }
  })()

  inflight.set(url, task)
  return task
}
