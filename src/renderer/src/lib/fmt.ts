export const clock = (ms: number): string =>
  new Date(ms).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

export function dur(min: number | null | undefined): string | null {
  if (!min) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}s ${String(m).padStart(2, '0')}dk` : `${m} dk`
}

export function left(position: number, duration: number): string {
  const s = Math.max(0, duration - position)
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return h ? `${h}s ${m}dk kaldı` : `${m} dk kaldı`
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

const SUBTITLE_LANGUAGES: Record<string, string> = {
  tur: 'Türkçe',
  eng: 'İngilizce',
  ger: 'Almanca',
  deu: 'Almanca',
  fre: 'Fransızca',
  fra: 'Fransızca',
  spa: 'İspanyolca',
  ita: 'İtalyanca',
  rus: 'Rusça',
  ara: 'Arapça',
  ukr: 'Ukraynaca',
  dut: 'Felemenkçe',
  swe: 'İsveççe',
  fin: 'Fince'
}

/**
 * Names a subtitle track the file only labels with a three-letter code. The
 * language wins over the track's own title: these files carry release tags there
 * — "tr #turkseed" and the like — which mean nothing to the viewer.
 */
export function subtitleTrackLabel(track: { language: string | null; title: string | null }): string {
  if (track.language) return SUBTITLE_LANGUAGES[track.language] ?? track.language.toUpperCase()
  return track.title?.trim() || 'Altyazı'
}
