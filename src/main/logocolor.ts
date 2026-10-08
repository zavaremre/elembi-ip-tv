import { app, nativeImage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Reads the brand colour out of a logo so a card can be built around it.
 *
 * Done here rather than in the renderer because a canvas cannot sample an image
 * from another origin, and Electron's own decoder needs no extra dependency.
 * Answers are kept on disk: a logo's colour never changes.
 */

const FETCH_TIMEOUT_MS = 12_000
/** Below this the sample is not a brand colour — HBO Max's mark yields 71 px. */
const MIN_SAMPLE = 250

interface Sample {
  r: number
  g: number
  b: number
  n: number
}

/**
 * The most common colour that carries identity. Transparent pixels are not
 * there, near-black and near-white are usually the mark or the plate it sits on,
 * and greys say nothing about a brand — so all three are skipped and what
 * remains is bucketed coarsely, which keeps gradients in a logo together.
 */
function dominant(bitmap: Buffer): string | null {
  const buckets = new Map<string, Sample>()
  for (let i = 0; i + 3 < bitmap.length; i += 4) {
    /* Electron hands back BGRA, not RGBA. */
    const b = bitmap[i]
    const g = bitmap[i + 1]
    const r = bitmap[i + 2]
    const alpha = bitmap[i + 3]
    if (alpha < 200) continue
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (max < 40 || min > 215 || max - min < 24) continue
    const key = `${r >> 4},${g >> 4},${b >> 4}`
    const cur = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 }
    cur.r += r
    cur.g += g
    cur.b += b
    cur.n += 1
    buckets.set(key, cur)
  }
  if (buckets.size === 0) return null

  const top = [...buckets.values()].sort((a, b) => b.n - a.n)[0]
  if (top.n < MIN_SAMPLE) return null
  const hex = (value: number): string => Math.round(value / top.n).toString(16).padStart(2, '0')
  return `#${hex(top.r)}${hex(top.g)}${hex(top.b)}`
}

const file = (): string => join(app.getPath('userData'), 'logo-colors.json')
let cache: Record<string, string | null> | null = null

function read(): Record<string, string | null> {
  if (cache) return cache
  try {
    cache = existsSync(file()) ? (JSON.parse(readFileSync(file(), 'utf8')) as Record<string, string | null>) : {}
  } catch {
    cache = {}
  }
  return cache
}

function persist(): void {
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(file(), JSON.stringify(read()))
  } catch {
    /* A colour that cannot be cached is only read again next time. */
  }
}

async function lookup(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    const image = nativeImage.createFromBuffer(Buffer.from(await res.arrayBuffer()))
    if (image.isEmpty()) return null
    return dominant(image.toBitmap())
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Colours for the given logos, fetching only the ones not already known. */
export async function logoColors(urls: string[]): Promise<Record<string, string | null>> {
  const store = read()
  const out: Record<string, string | null> = {}
  const pending: string[] = []

  for (const url of urls) {
    if (!url) continue
    if (url in store) out[url] = store[url]
    else if (!pending.includes(url)) pending.push(url)
  }
  if (pending.length === 0) return out

  /* A handful of small images; two at a time keeps it off the main thread's back. */
  let index = 0
  await Promise.all(
    Array.from({ length: Math.min(2, pending.length) }, async () => {
      while (index < pending.length) {
        const url = pending[index++]
        const color = await lookup(url)
        store[url] = color
        out[url] = color
      }
    })
  )
  persist()
  return out
}
