import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { config } from './config'
import { decodeXmlText, parseXmltvTime } from './fixtures'
import type { EpgEntry } from '../shared/types'
import { throttleProvider } from './ratelimit'

const PROGRAMME_RE = /<programme\s+start="([^"]+)"\s+stop="([^"]+)"\s+channel="([^"]*)"[^>]*>([\s\S]*?)<\/programme>/g
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/
const DESC_RE = /<desc[^>]*>([\s\S]*?)<\/desc>/
const TTL_MS = 3 * 3600_000
const FETCH_TIMEOUT_MS = 90_000

type Guide = Map<string, EpgEntry[]>

interface Cached {
  at: number
  guide: Guide
}

let memory: Cached | null = null
let loading: Promise<Guide> | null = null

const diskPath = (): string => join(app.getPath('userData'), 'xmltv-cache.json')

function parse(xml: string): Guide {
  const guide: Guide = new Map()
  PROGRAMME_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = PROGRAMME_RE.exec(xml))) {
    const [, rawStart, rawStop, channelId, body] = match
    const title = TITLE_RE.exec(body)?.[1]
    if (!channelId || !title) continue
    const entry: EpgEntry = {
      title: decodeXmlText(title),
      description: decodeXmlText(DESC_RE.exec(body)?.[1] ?? ''),
      start: parseXmltvTime(rawStart),
      stop: parseXmltvTime(rawStop)
    }
    if (!entry.start || !entry.stop) continue
    const list = guide.get(channelId)
    if (list) list.push(entry)
    else guide.set(channelId, [entry])
  }
  for (const list of guide.values()) list.sort((a, b) => a.start - b.start)
  return guide
}

function readDisk(): Cached | null {
  try {
    if (!existsSync(diskPath())) return null
    const raw = JSON.parse(readFileSync(diskPath(), 'utf8')) as { at: number; channels: [string, EpgEntry[]][] }
    return { at: raw.at, guide: new Map(raw.channels) }
  } catch {
    return null
  }
}

function writeDisk(cached: Cached): void {
  try {
    writeFileSync(diskPath(), JSON.stringify({ at: cached.at, channels: [...cached.guide] }))
  } catch {
    /* a failed cache write must not break playback */
  }
}

async function download(): Promise<Guide> {
  const { XTREAM_HOST, XTREAM_USER, XTREAM_PASS } = config()
  const url = new URL('/xmltv.php', XTREAM_HOST)
  url.searchParams.set('username', XTREAM_USER)
  url.searchParams.set('password', XTREAM_PASS)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    await throttleProvider()
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`XMLTV HTTP ${res.status}`)
    return parse(await res.text())
  } finally {
    clearTimeout(timer)
  }
}

/**
 * This panel returns empty get_short_epg responses, so the guide comes from
 * xmltv.php: ~2 MB, parsed once and then cached in memory and on disk.
 */
export async function guide(): Promise<Guide> {
  if (memory && Date.now() - memory.at < TTL_MS) return memory.guide
  if (loading) return loading

  if (!memory) {
    const disk = readDisk()
    if (disk) memory = disk
    if (disk && Date.now() - disk.at < TTL_MS) return disk.guide
  }

  loading = download()
    .then((fresh) => {
      memory = { at: Date.now(), guide: fresh }
      writeDisk(memory)
      return fresh
    })
    .catch((e: unknown) => {
      if (memory) return memory.guide
      throw e
    })
    .finally(() => {
      loading = null
    })

  return loading
}

export function resetGuide(): void {
  memory = null
}
