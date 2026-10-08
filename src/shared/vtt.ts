/**
 * WebVTT retiming, shared because both sides need it: the renderer shifts a file
 * the viewer loaded, and the main process shifts a track it pulled out of the
 * video so its cues land on the same origin the player counts from.
 */

const CUE_TIMES = /^((?:\d{2}:)?\d{2}:\d{2}\.\d{3})\s*-->\s*((?:\d{2}:)?\d{2}:\d{2}\.\d{3})(.*)$/

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
 * Shifts every cue and drops the ones that end before the start. Clamping them
 * to zero instead would fire every earlier line at once, which is what made
 * subtitles look wildly out of sync after a seek.
 */
export function retimeVtt(vtt: string, delay: number): string {
  if (delay === 0) return vtt
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
    const start = parseStamp(match[1]) + delay
    const end = parseStamp(match[2]) + delay
    if (end <= 0) continue
    lines[timeIndex] = `${stamp(Math.max(0, start))} --> ${stamp(end)}${match[3] ?? ''}`
    kept.push(lines.join('\n'))
  }

  return kept.join('\n\n')
}
