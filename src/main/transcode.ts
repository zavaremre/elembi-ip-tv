import { spawn, type ChildProcess } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import type { AudioTrackInfo, MediaProbe, SubtitleTrackInfo } from '../shared/types'
import { t } from './i18n'
import { languageKey } from '../shared/i18n/languages'

const FFMPEG = 'ffmpeg'
const FFPROBE = 'ffprobe'
const PROBE_TIMEOUT_MS = 20_000

/** Chromium decodes none of AC-3, E-AC-3, DTS or TrueHD. */
const PLAYABLE_AUDIO = new Set(['aac', 'mp3', 'opus', 'vorbis', 'flac'])

/*
 * Text subtitle codecs, the ones ffmpeg can turn into WebVTT. The bitmap formats
 * — PGS, VobSub, DVB — are pictures of words and would need OCR, so they are
 * listed but never offered.
 */
const TEXT_SUBTITLES = new Set(['subrip', 'ass', 'ssa', 'mov_text', 'webvtt', 'text', 'subviewer', 'microdvd'])


function run(command: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(t('ffmpeg.timeout', { command })))
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
      else reject(new Error(err.trim().split('\n').pop() ?? t('ffmpeg.exited', { command, code: String(code) })))
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
  tags?: { language?: string; title?: string }
  disposition?: Record<string, number>
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
  const subtitles: SubtitleTrackInfo[] = streams
    .filter((stream) => stream.codec_type === 'subtitle')
    .map((stream, order) => ({
      order,
      language: stream.tags?.language ?? null,
      title: stream.tags?.title ?? null,
      codec: stream.codec_name ?? 'bilinmiyor',
      text: TEXT_SUBTITLES.has(stream.codec_name ?? '')
    }))

  const format = data.format?.format_name ?? ''
  const seekable = /mp4|mov|m4a/.test(format)
  const unplayableAudio = audio.length > 0 && !audio.some((track) => track.playable)

  return {
    duration: Number(data.format?.duration ?? 0) || 0,
    audio,
    subtitles,
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
    const headers = {
      'Cache-Control': 'no-store',
      /* Without this a Web Audio tap on the element would output silence. */
      'Access-Control-Allow-Origin': '*'
    }

    const match = /^\/hls\/([a-f0-9]+)\/([A-Za-z0-9._]+)$/.exec(url.pathname)
    const file = match ? hlsFile(match[1], match[2]) : null
    if (!file) {
      res.writeHead(404).end()
      return
    }

    /*
     * ffmpeg labels the subtitle group "subtitle_0" and names no language, so the
     * master playlist is rewritten on the way out. It is four lines of text and
     * the player reads it once.
     */
    if (match![2] === 'master.m3u8') {
      res.writeHead(200, { ...headers, 'Content-Type': file.type }).end(labelledMaster(file.path))
      return
    }

    res.writeHead(200, { ...headers, 'Content-Type': file.type })
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
  /** The one embedded track carried inside this session's stream. */
  subtitle: SubtitleTrackInfo | null
}

let session: HlsSession | null = null
/**
 * The session being replaced. Its ffmpeg is already gone — the subscription
 * allows a single connection — but its segments stay readable so the element can
 * play on while the replacement starts. Measured: a restart needs 3.1–4.3s, and
 * deleting these straight away was what cut the sound for exactly that long.
 */
let retiring: HlsSession | null = null

/**
 * The subtitle travels inside the HLS output rather than beside it.
 *
 * This is the whole point: ffmpeg normalises each output against its own first
 * packet, and those differ, so a sidecar file needed its own correction and the
 * correction kept being wrong. Measured on The Odyssey seeking to 1800s — in one
 * stream the video lands at 1.442 and the cue at 1.173, a difference of -0.269,
 * matching the absolute times exactly. The player aligns subtitles the same way
 * it aligns audio, and no arithmetic of ours is involved. It is also why mpv and
 * VLC never had this problem: they keep one clock. -copyts was the wrong answer
 * and a trap besides — it is global, so it silently moved video and audio too.
 *
 * ffmpeg's webvtt muxer takes one stream per group, so one language is carried
 * at a time and switching restarts the session, as changing audio track does.
 */
function hlsArgs(
  src: string,
  audioOrder: number,
  start: number,
  dir: string,
  subtitle: SubtitleTrackInfo | null
): string[] {
  return [
    '-nostdin',
    '-v', 'error',
    /*
     * Without this the audio is trimmed to the requested position while the video
     * falls back to the preceding keyframe. Measured: audio arrived 6.187s after
     * the first frame, which is the silence heard after every seek. With it, 0.020s.
     */
    '-noaccurate_seek',
    ...(start > 0 ? ['-ss', String(start)] : []),
    '-i', src,
    '-map', '0:v:0',
    '-map', `0:a:${audioOrder}`,
    ...(subtitle ? ['-map', `0:s:${subtitle.order}`] : []),
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ac', '2',
    ...(subtitle ? ['-c:s', 'webvtt'] : []),
    '-af', 'aresample=async=1:min_hard_comp=0.100',
    '-f', 'hls',
    '-hls_time', String(SEGMENT_SECONDS),
    '-hls_list_size', '0',
    '-hls_playlist_type', 'event',
    '-hls_flags', 'independent_segments+temp_file',
    /* Named the same way with or without a subtitle, so one path serves both. */
    '-var_stream_map', subtitle ? 'v:0,a:0,s:0,sgroup:subs,name:main' : 'v:0,a:0,name:main',
    '-master_pl_name', 'master.m3u8',
    '-hls_segment_filename', join(dir, 'v%v_seg%05d.ts'),
    join(dir, 'v%v.m3u8')
  ]
}

function discard(dead: HlsSession | null): void {
  if (!dead) return
  try {
    rmSync(dead.dir, { recursive: true, force: true })
  } catch {
    /* A temp directory that will not go is the OS's problem, not ours. */
  }
}

/** Ends the running session's ffmpeg but leaves its files for the moment. */
function retire(): HlsSession | null {
  if (!session) return null
  session.child.kill('SIGKILL')
  const dead = session
  session = null
  return dead
}

export function stopHls(): void {
  discard(retire())
  discard(retiring)
  retiring = null
}

/**
 * Writes a growing HLS playlist to a temp directory. Unlike a single pipe this
 * gives the player real segment durations, so seeking inside what has already
 * been produced is instant and exact instead of restarting ffmpeg.
 */
export async function startHls(
  src: string,
  audioOrder: number,
  start: number,
  subtitle: SubtitleTrackInfo | null = null
): Promise<string> {
  /* Anything left from an earlier switch has served its purpose by now. */
  discard(retiring)
  retiring = retire()

  const id = randomBytes(8).toString('hex')
  const dir = join(tmpdir(), `elembi-hls-${id}`)
  mkdirSync(dir, { recursive: true })

  const child = spawn(FFMPEG, hlsArgs(src, audioOrder, start, dir, subtitle), { stdio: ['ignore', 'ignore', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()))
  session = { id, dir, child, src, audioOrder, start, subtitle }

  const playlist = join(dir, 'vmain.m3u8')
  const deadline = Date.now() + PLAYLIST_WAIT_MS
  while (Date.now() < deadline) {
    if (session?.id !== id) throw new Error('Oturum iptal edildi')
    if (existsSync(playlist) && readFileSync(playlist, 'utf8').includes('#EXTINF')) {
      const port = await ensureServer()
      /* This session can serve itself now, so the previous files can go. */
      discard(retiring)
      retiring = null
      return `http://127.0.0.1:${port}/hls/${id}/master.m3u8`
    }
    if (child.exitCode !== null) {
      throw new Error(stderr.trim().split('\n').pop() ?? t('ffmpeg.crashed'))
    }
    await new Promise((resolve) => setTimeout(resolve, PLAYLIST_POLL_MS))
  }
  throw new Error(t('ffmpeg.noPlaylist'))
}


/**
 * Gives the subtitle group a name and a language the player can show, which
 * ffmpeg does not write. Falls back to the file as-is if anything looks off.
 */
function labelledMaster(path: string): string {
  const text = readFileSync(path, 'utf8')
  const track = (session ?? retiring)?.subtitle
  if (!track) return text
  /*
   * The language wins over the track's own title. These files label tracks with
   * release tags — "tr #turkseed" on the film this was built against — which is
   * noise to the viewer, so the title is only a fallback.
   */
  const key = languageKey(track.language)
  const name = track.language
    ? (key ? t(key) : track.language.toUpperCase())
    : track.title?.trim() || t('track.subtitleLabel')
  return text.replace(/^#EXT-X-MEDIA:TYPE=SUBTITLES.*$/m, (line) =>
    line
      .replace(/NAME="[^"]*"/, `NAME="${name}"`)
      .replace(/(TYPE=SUBTITLES)/, `$1${track.language ? `,LANGUAGE="${track.language}"` : ''}`)
  )
}

export function hlsFile(id: string, file: string): { path: string; type: string } | null {
  /* The retiring session is still answered, which is the whole point of it. */
  const owner = session?.id === id ? session : retiring?.id === id ? retiring : null
  if (!owner) return null
  if (!/^[A-Za-z0-9._]+$/.test(file) || file.includes('..')) return null
  const path = join(owner.dir, file)
  if (!existsSync(path)) return null
  const type = file.endsWith('.m3u8')
    ? 'application/vnd.apple.mpegurl'
    : file.endsWith('.vtt')
      ? 'text/vtt; charset=utf-8'
      : 'video/mp2t'
  return { path, type }
}
