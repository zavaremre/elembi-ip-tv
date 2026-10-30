import { languageKey } from '@shared/i18n/languages'
import type { Translate } from '@/i18n'

/**
 * Both interface languages run on a 24-hour clock, so the wall clock is
 * formatted from a fixed locale rather than threaded through every caller —
 * tr-TR and en-GB print an hour and a minute identically.
 */
export const clock = (ms: number): string =>
  new Date(ms).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

/** One formatter per locale: building an Intl object per render is wasteful. */
const dayNames = new Map<string, Intl.DateTimeFormat>()
function dayName(locale: string): Intl.DateTimeFormat {
  const cached = dayNames.get(locale)
  if (cached) return cached
  const made = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', weekday: 'short' })
  dayNames.set(locale, made)
  return made
}

/** Midnight of the day a timestamp falls on, in local time. */
function startOfDay(ms: number): number {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/**
 * Which day a fixture is on. Compared by calendar day rather than by hours
 * elapsed: a match at 01:00 is tomorrow's even though it is three hours away,
 * and the guide this reads covers from four hours back to thirty ahead.
 */
export function matchDay(ms: number, t: Translate): string {
  const days = Math.round((startOfDay(ms) - startOfDay(Date.now())) / 86_400_000)
  if (days === 0) return t('time.today')
  if (days === 1) return t('time.tomorrow')
  if (days === -1) return t('time.yesterday')
  return dayName(t('locale')).format(new Date(ms))
}

export function dur(min: number | null | undefined, t: Translate): string | null {
  if (!min) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  const hour = t('time.hour')
  const minute = t('time.minute')
  return h ? `${h}${hour} ${String(m).padStart(2, '0')}${minute}` : `${m} ${minute}`
}

export function left(position: number, duration: number, t: Translate): string {
  const s = Math.max(0, duration - position)
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return h ? t('time.leftHm', { h, m }) : t('time.leftM', { m })
}

/** A TMDB score, with the decimal separator the interface language uses. */
export function score(rating: number, t: Translate): string {
  return rating.toLocaleString(t('locale'), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function tc(sec: number): string {
  if (!Number.isFinite(sec)) return '--:--'
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const p = (n: number): string => String(n).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`
}

/**
 * Names a subtitle track the file only labels with a three-letter code. The
 * language wins over the track's own title: these files carry release tags
 * there — "tr #turkseed" and the like — which mean nothing to the viewer.
 *
 * Returns a dictionary key when the language is one we name, so the caller
 * translates it; a module has no interface language of its own.
 */
export function subtitleTrackLabel(track: { language: string | null; title: string | null }): {
  key: ReturnType<typeof languageKey>
  fallback: string
} {
  const key = languageKey(track.language)
  if (key) return { key, fallback: track.language ?? '' }
  if (track.language) return { key: null, fallback: track.language.toUpperCase() }
  return { key: null, fallback: track.title?.trim() || '' }
}
