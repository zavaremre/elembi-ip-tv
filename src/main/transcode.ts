import { spawn, type ChildProcess } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import type { AudioTrackInfo, MediaProbe } from '../shared/types'

const FFMPEG = 'ffmpeg'
const FFPROBE = 'ffprobe'
const PROBE_TIMEOUT_MS = 20_000

/** Chromium decodes none of AC-3, E-AC-3, DTS or TrueHD. */
const PLAYABLE_AUDIO = new Set(['aac', 'mp3', 'opus', 'vorbis', 'flac'])

function run(command: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`${command} zaman aşımına uğradı`))
    }, timeoutMs)
    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()))
    child.stderr.on('data', (chunk: Buffer) => (err += chunk.toString()))
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(out)
      else reject(new Error(err.trim().split('\n').pop() ?? `${command} ${code} ile çıktı`))
    })
  })
}

let availability: boolean | null = null

export async function available(): Promise<boolean> {
  if (availability !== null) return availability
  try {
    await run(FFMPEG, ['-version'], 5000)
    availability = true
  } catch {
    availability = false
  }
  return availability
}

interface RawStream {
  index: number
  codec_type?: string
  codec_name?: string
  channels?: number
  r_frame_rate?: string
  avg_frame_rate?: string
  tags?: { language?: string; title?: string }
}

/** ffprobe reports frame rates as "24000/1001"; 0 denominators do occur. */
function toFps(value: string | undefined): number | null {
  if (!value) return null
  const [num, den] = value.split('/')
  const fps = Number(num) / (Number(den) || 1)
  return Number.isFinite(fps) && fps > 1 && fps < 1000 ? Math.round(fps * 1000) / 1000 : null
}

/** Reads the real track list, which the provider API only half reports. */
export async function probe(url: string): Promise<MediaProbe> {
  const text = await run(
    FFPROBE,
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', url],
    PROBE_TIMEOUT_MS
  )
  const data = JSON.parse(text) as { streams?: RawStream[]; format?: { duration?: string; format_name?: string } }
  const streams = data.streams ?? []

  const audio: AudioTrackInfo[] = streams
    .filter((stream) => stream.codec_type === 'audio')
    .map((stream, order) => ({
      /* ffmpeg's -map uses the per-type order, not the global stream index. */
      order,
      language: stream.tags?.language ?? null,
      title: stream.tags?.title ?? null,
      codec: stream.codec_name ?? 'bilinmiyor',
      channels: stream.channels ?? 0,
      playable: PLAYABLE_AUDIO.has(stream.codec_name ?? '')
    }))

  /*
   * Measured in Electron 35: an MP4 seeks in about a second, while a direct
   * Matroska seek never completes because Chromium hunts for the index. So the
   * pipe is used for every container except MP4, where it would only add delay.
   */
  const video = streams.find((stream) => stream.codec_type === 'video')
  const fps = toFps(video?.r_frame_rate) ?? toFps(video?.avg_frame_rate)

  const format = data.format?.format_name ?? ''
  const seekable = /mp4|mov|m4a/.test(format)
  const unplayableAudio = audio.length > 0 && !audio.some((track) => track.playable)

  return {
    duration: Number(data.format?.duration ?? 0) || 0,
    audio,
    fps,
    needsRemux: !seekable || audio.length > 1 || unplayableAudio
  }
}

/* ── loopback server ──────────────────────────── */

let server: Server | null = null
let port = 0

async function ensureServer(): Promise<number> {
  if (server && port) return port

  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    /*
     * The session id is the secret: 64 random bits, valid only while the session
     * lives. A query token cannot be used because hls.js resolves segment URLs
     * against the playlist path and drops the query string.
     */
    const match = /^\/hls\/([a-f0-9]+)\/([A-Za-z0-9.]+)$/.exec(url.pathname)
    if (!match) {
      res.writeHead(404).end()
      return
    }
    const file = hlsFile(match[1], match[2])
    if (!file) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, {
      'Content-Type': file.type,
      'Cache-Control': 'no-store',
      /* Without this a Web Audio tap on the element would output silence. */
      'Access-Control-Allow-Origin': '*'
    })
    createReadStream(file.path).pipe(res)
  })

  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  port = typeof address === 'object' && address ? address.port : 0
  return port
}

/* ── on-demand HLS session ────────────────────── */

const SEGMENT_SECONDS = 6
const PLAYLIST_WAIT_MS = 25_000
const PLAYLIST_POLL_MS = 120

interface HlsSession {
  id: string
  dir: string
  child: ChildProcess
  src: string
  audioOrder: number
  start: number
}

let session: HlsSession | null = null

function hlsArgs(src: string, audioOrder: number, start: number, dir: string): string[] {
  return [
    '-nostdin',
    '-v', 'error',
    ...(start > 0 ? ['-ss', String(start)] : []),
    '-i', src,
    '-map', '0:v:0',
    '-map', `0:a:${audioOrder}`,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ac', '2',
    '-af', 'aresample=async=1:min_hard_comp=0.100',
    '-f', 'hls',
    '-hls_time', String(SEGMENT_SECONDS),
    '-hls_list_size', '0',
    '-hls_playlist_type', 'event',
    '-hls_flags', 'independent_segments+temp_file',
    '-hls_segment_filename', join(dir, 'seg%05d.ts'),
    join(dir, 'index.m3u8')
  ]
}

export function stopHls(): void {
  if (!session) return
  session.child.kill('SIGKILL')
  rmSync(session.dir, { recursive: true, force: true })
  session = null
}

/**
 * Writes a growing HLS playlist to a temp directory. Unlike a single pipe this
 * gives the player real segment durations, so seeking inside what has already
 * been produced is instant and exact instead of restarting ffmpeg.
 */
export async function startHls(src: string, audioOrder: number, start: number): Promise<string> {
  stopHls()
  const id = randomBytes(8).toString('hex')
  const dir = join(tmpdir(), `akis-hls-${id}`)
  mkdirSync(dir, { recursive: true })

  const child = spawn(FFMPEG, hlsArgs(src, audioOrder, start, dir), { stdio: ['ignore', 'ignore', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()))
  session = { id, dir, child, src, audioOrder, start }

  const playlist = join(dir, 'index.m3u8')
  const deadline = Date.now() + PLAYLIST_WAIT_MS
  while (Date.now() < deadline) {
    if (session?.id !== id) throw new Error('Oturum iptal edildi')
    if (existsSync(playlist) && readFileSync(playlist, 'utf8').includes('#EXTINF')) {
      const port = await ensureServer()
      return `http://127.0.0.1:${port}/hls/${id}/index.m3u8`
    }
    if (child.exitCode !== null) {
      throw new Error(stderr.trim().split('\n').pop() ?? 'ffmpeg beklenmedik şekilde kapandı')
    }
    await new Promise((resolve) => setTimeout(resolve, PLAYLIST_POLL_MS))
  }
  throw new Error('HLS oturumu zamanında başlamadı')
}

/** Serves one file from the active session directory; the id guards the path. */
export function hlsFile(id: string, file: string): { path: string; type: string } | null {
  if (!session || session.id !== id) return null
  if (!/^[a-z0-9.]+$/i.test(file)) return null
  const path = join(session.dir, file)
  if (!existsSync(path)) return null
  return { path, type: file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t' }
}
