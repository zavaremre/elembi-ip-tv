import { app, dialog } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { config } from './config'
import type { SubtitleCandidate, SubtitleFile } from '../shared/types'

const API = 'https://api.opensubtitles.com/api/v1'
const USER_AGENT = 'Akis v0.1'

/**
 * Turkish subtitle files are still commonly shipped as windows-1254, so UTF-8 is
 * tried first and a legacy decode is used when it produces replacement chars.
 */
function decodeSubtitle(buffer: Buffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  if (!utf8.includes('�')) return utf8
  try {
    return new TextDecoder('windows-1254').decode(buffer)
  } catch {
    return utf8
  }
}

/** SRT and WebVTT differ only in the header and the millisecond separator. */
export function srtToVtt(text: string): string {
  const body = text
    .replace(/^﻿/, '')
    .replace(/\r/g, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    .trim()
  return body.startsWith('WEBVTT') ? body : `WEBVTT\n\n${body}`
}

export async function openLocalSubtitle(): Promise<SubtitleFile | null> {
  const result = await dialog.showOpenDialog({
    title: 'Altyazı dosyası seç',
    filters: [{ name: 'Altyazı', extensions: ['srt', 'vtt'] }],
    properties: ['openFile']
  })
  const path = result.filePaths[0]
  if (result.canceled || !path) return null
  const buffer = await readFile(path)
  return { label: basename(path), vtt: srtToVtt(decodeSubtitle(buffer)), remaining: null, notice: null }
}

let token: string | null = null
let tokenAttempted = false

function headers(): Record<string, string> {
  const { OPENSUBTITLES_KEY } = config()
  const base: Record<string, string> = {
    'Api-Key': OPENSUBTITLES_KEY,
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }
  if (token) base.Authorization = `Bearer ${token}`
  return base
}

/**
 * The anonymous download quota is only a handful per day; signing in with an
 * account raises it, so credentials are used when they are configured.
 */
async function login(): Promise<void> {
  const { OPENSUBTITLES_USER, OPENSUBTITLES_PASS } = config()
  if (token || tokenAttempted || !OPENSUBTITLES_USER || !OPENSUBTITLES_PASS) return
  tokenAttempted = true
  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ username: OPENSUBTITLES_USER, password: OPENSUBTITLES_PASS })
    })
    if (!res.ok) return
    const body = (await res.json()) as { token?: string }
    token = body.token ?? null
  } catch {
    /* staying anonymous is an acceptable fallback */
  }
}

/**
 * Downloads are quota-limited — the free tier allows five per day — so a fetched
 * subtitle is kept on disk and never costs a second download.
 */
const downloaded = new Map<number, SubtitleFile>()

const cacheDir = (): string => join(app.getPath('userData'), 'subtitles')

function cachePath(fileId: number): string {
  return join(cacheDir(), `${fileId}.json`)
}

function readCached(fileId: number): SubtitleFile | null {
  const memory = downloaded.get(fileId)
  if (memory) return memory
  try {
    const path = cachePath(fileId)
    if (!existsSync(path)) return null
    const file = JSON.parse(readFileSync(path, 'utf8')) as SubtitleFile
    writeCached(fileId, file)
    return file
  } catch {
    return null
  }
}

function writeCached(fileId: number, file: SubtitleFile): void {
  downloaded.set(fileId, file)
  try {
    mkdirSync(cacheDir(), { recursive: true })
    writeFileSync(cachePath(fileId), JSON.stringify(file))
  } catch {
    /* a failed cache write only costs quota next time */
  }
}

interface RawSubtitle {
  attributes?: {
    language?: string
    release?: string
    download_count?: number
    hearing_impaired?: boolean
    fps?: number
    files?: { file_id?: number; file_name?: string }[]
  }
}

/*
 * Frame rate decides whether a subtitle can stay in sync at all: one timed for
 * 23.976 fps against a 25 fps copy drifts further apart the longer it runs, and
 * no constant offset fixes that. The provider's streams carry no release name to
 * compare against, so this is the one hard signal available for ranking.
 */
/*
 * Relative, not absolute: 23.976 against 24 is only 0.024 apart yet drifts about
 * 5 seconds over a feature. A green badge here means "needs no correction", so
 * the figure must match the one the renderer retimes with.
 */
const FPS_TOLERANCE = 0.0005

const sameFps = (a: number | null, b: number | null): boolean =>
  a !== null && b !== null && Math.abs(a / b - 1) <= FPS_TOLERANCE

/** Turkish first, then English, then whatever else came back. */
const languageRank = (code: string): number => (code === 'tr' ? 0 : code === 'en' ? 1 : 2)

export const subtitles = {
  configured(): boolean {
    return Boolean(config().OPENSUBTITLES_KEY)
  },

  /** Searches OpenSubtitles by IMDb id when available, falling back to the title. */
  async search(params: {
    imdbId?: string | null
    query?: string
    season?: number | null
    episode?: number | null
    languages?: string
    /** Frame rate of the file being played, used to rank the results. */
    fps?: number | null
  }): Promise<SubtitleCandidate[]> {
    if (!this.configured()) throw new Error('OpenSubtitles anahtarı tanımlı değil (.env → OPENSUBTITLES_KEY)')

    const url = new URL(`${API}/subtitles`)
    url.searchParams.set('languages', params.languages ?? 'tr,en')
    url.searchParams.set('order_by', 'download_count')
    if (params.imdbId) url.searchParams.set('imdb_id', params.imdbId.replace(/^tt/, ''))
    else if (params.query) url.searchParams.set('query', params.query)
    if (params.season) url.searchParams.set('season_number', String(params.season))
    if (params.episode) url.searchParams.set('episode_number', String(params.episode))

    const res = await fetch(url, { headers: headers() })
    if (!res.ok) throw new Error(`OpenSubtitles HTTP ${res.status}`)
    const body = (await res.json()) as { data?: RawSubtitle[] }
    const ours = typeof params.fps === 'number' && params.fps > 1 ? params.fps : null

    return (body.data ?? [])
      .flatMap((entry) => {
        const file = entry.attributes?.files?.[0]
        if (!file?.file_id) return []
        const fps = typeof entry.attributes?.fps === 'number' && entry.attributes.fps > 1 ? entry.attributes.fps : null
        return [
          {
            fileId: file.file_id,
            label: file.file_name ?? entry.attributes?.release ?? 'altyazı',
            language: entry.attributes?.language ?? '?',
            downloads: entry.attributes?.download_count ?? 0,
            hearingImpaired: Boolean(entry.attributes?.hearing_impaired),
            fps,
            fpsMatch: sameFps(fps, ours)
          } satisfies SubtitleCandidate
        ]
      })
      /*
       * Language is what the viewer asked for, so it outranks everything; frame
       * rate then decides which of those can actually hold sync, and the
       * download count only breaks the remaining ties.
       */
      .sort((a, b) => {
        const byLanguage = languageRank(a.language) - languageRank(b.language)
        if (byLanguage !== 0) return byLanguage
        if (a.fpsMatch !== b.fpsMatch) return a.fpsMatch ? -1 : 1
        return b.downloads - a.downloads
      })
      .slice(0, 20)
  },

  async download(fileId: number): Promise<SubtitleFile> {
    if (!this.configured()) throw new Error('OpenSubtitles anahtarı tanımlı değil')
    const cached = readCached(fileId)
    if (cached) return cached

    await login()
    const res = await fetch(`${API}/download`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ file_id: fileId })
    })
    const body = (await res.json().catch(() => null)) as
      | { link?: string; file_name?: string; remaining?: number; message?: string }
      | null

    if (!res.ok) {
      if (res.status === 406 || (body?.remaining ?? 1) <= 0) {
        throw new Error(`Günlük altyazı indirme kotası doldu. ${body?.message ?? ''}`.trim())
      }
      throw new Error(`İndirme bağlantısı alınamadı (HTTP ${res.status})`)
    }
    if (!body?.link) throw new Error('İndirme bağlantısı boş döndü')

    const fileRes = await fetch(body.link)
    if (!fileRes.ok) throw new Error(`Altyazı indirilemedi (HTTP ${fileRes.status})`)
    const buffer = Buffer.from(await fileRes.arrayBuffer())

    const file: SubtitleFile = {
      label: body.file_name ?? 'altyazı',
      vtt: srtToVtt(decodeSubtitle(buffer)),
      remaining: typeof body.remaining === 'number' ? body.remaining : null,
      notice: body.message ?? null
    }
    writeCached(fileId, file)
    return file
  }
}
