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
  opts: { headers?: Record<string, string>; ttl?: number; timeout?: number } = {}
): Promise<T> {
  const ttl = opts.ttl ?? 10 * 60_000
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < hit.ttl) return hit.data as T

  const running = inflight.get(url)
  if (running) return running as Promise<T>

  const task = (async () => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), opts.timeout ?? 15_000)
    try {
      const res = await fetch(url, { headers: opts.headers, signal: ctrl.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${url.replace(/password=[^&]*/, 'password=***')}`)
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
