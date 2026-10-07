/**
 * Subtitle retiming. Two corrections matter and they are not the same thing: a
 * constant offset moves every line, while a rate fix stretches the timeline. A
 * subtitle timed for 23.976 fps played against a 25 fps copy runs further behind
 * the longer it goes, and no offset can straighten that — only scaling does.
 */

import { parseTitle } from '@shared/title'

const CUE_TIMES = /^((?:\d{2}:)?\d{2}:\d{2}\.\d{3})\s*-->\s*((?:\d{2}:)?\d{2}:\d{2}\.\d{3})(.*)$/

/**
 * Key the remembered timing is stored under. Episodes of a series share one, so
 * an offset found on one episode applies to the rest; films key on their id.
 *
 * Series key on the normalised title because the two ways into an episode carry
 * different names for the same show — the provider's and TMDB's — and both
 * normalise to the same string. Measured over the 2133 series in the catalogue:
 * the title alone let 56 groups collide, the year brings that down to 4 and all
 * four are the same show listed twice. The raw name is the fallback for titles
 * that normalise to nothing, such as non-Latin ones or a bare year like "1923".
 */
export function syncKeyFor(kind: 'live' | 'vod' | 'series', id: number, title: string): string {
  if (kind !== 'series') return `${kind}:${id}`
  const parsed = parseTitle(title)
  const base = parsed.title || title.trim().toLowerCase()
  return `series:${parsed.year ? `${base}:${parsed.year}` : base}`
}

function stamp(total: number): string {
  const clamped = Math.max(0, total)
  const h = Math.floor(clamped / 3600)
  const m = Math.floor((clamped % 3600) / 60)
  const s = Math.floor(clamped % 60)
  const ms = Math.round((clamped % 1) * 1000)
  const pad = (n: number, width = 2): string => String(n).padStart(width, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`
}

export function parseStamp(value: string): number {
  const parts = value.split(':')
  const seconds = Number(parts.pop() ?? 0)
  const minutes = Number(parts.pop() ?? 0)
  const hours = Number(parts.pop() ?? 0)
  return hours * 3600 + minutes * 60 + seconds
}

/**
 * Retimes every cue and drops the ones that fall before the start. Clamping them
 * to zero instead would fire every earlier line at once, which is what made
 * subtitles look wildly out of sync after a seek.
 */
export function retimeVtt(vtt: string, delay: number, scale: number): string {
  if (delay === 0 && scale === 1) return vtt
  const blocks = vtt.split(/\n\s*\n/)
  const kept: string[] = []

  for (const block of blocks) {
    const lines = block.split('\n')
    const timeIndex = lines.findIndex((line) => CUE_TIMES.test(line.trim()))
    if (timeIndex === -1) {
      kept.push(block)
      continue
    }
    const match = CUE_TIMES.exec(lines[timeIndex].trim())
    if (!match) continue
    const start = parseStamp(match[1]) * scale + delay
    const end = parseStamp(match[2]) * scale + delay
    if (end <= 0) continue
    lines[timeIndex] = `${stamp(Math.max(0, start))} --> ${stamp(end)}${match[3] ?? ''}`
    kept.push(lines.join('\n'))
  }

  return kept.join('\n\n')
}

/*
 * Relative, not absolute: 23.976 against 24 is only 0.024 apart yet drifts about
 * 5 seconds over a feature, which is exactly the mismatch worth fixing. Half a
 * tenth of a percent is below anything audible and above the services' rounding.
 */
const FPS_TOLERANCE = 0.0005

export const fpsAgree = (a: number, b: number): boolean => Math.abs(a / b - 1) <= FPS_TOLERANCE
/* Real conversions sit between 23.976/29.97 and 29.97/23.976; the rest is noise. */
const MIN_SCALE = 0.79
const MAX_SCALE = 1.26

/**
 * The rate fix for playing a subtitle timed at `subtitleFps` against a file
 * running at `videoFps`. A given frame sits at n/subtitleFps in the subtitle and
 * at n/videoFps here, so the whole timeline scales by their ratio. Anything
 * outside the plausible band is treated as bad metadata and ignored.
 */
export function scaleFor(subtitleFps: number | null, videoFps: number | null): number {
  if (!subtitleFps || !videoFps) return 1
  if (fpsAgree(subtitleFps, videoFps)) return 1
  const scale = subtitleFps / videoFps
  if (scale < MIN_SCALE || scale > MAX_SCALE) return 1
  return Math.round(scale * 1e6) / 1e6
}
