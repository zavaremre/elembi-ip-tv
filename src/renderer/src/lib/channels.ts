import type { Channel } from '@shared/types'

/** Names are already cleaned in the main process, so these match the display form. */
const PREFERRED = /^(trt ?1|star tv|show tv|atv|kanal d|now|tv8|fox|teve2|bein sports 1|trt spor|a spor|ntv|cnn türk|habertürk)\b/i
const NOT_A_CHANNEL = /bilgi ekran|info ?screen|^test|^#|^-{2,}|dummy/i
const SPORT = /spor|sport|bein|futbol/i

/** Keeps the national channels at the front and drops the panel's filler entries. */
export function pickFeatured(channels: Channel[], count: number): Channel[] {
  const real = channels.filter((c) => !NOT_A_CHANNEL.test(c.name))
  const preferred = real.filter((c) => PREFERRED.test(c.name))
  const preferredIds = new Set(preferred.map((c) => c.id))
  const rest = real.filter((c) => !preferredIds.has(c.id))
  return [...preferred, ...rest].slice(0, count)
}

export function sportChannels(channels: Channel[]): Channel[] {
  return channels.filter((c) => !NOT_A_CHANNEL.test(c.name) && (SPORT.test(c.group) || SPORT.test(c.name)))
}
