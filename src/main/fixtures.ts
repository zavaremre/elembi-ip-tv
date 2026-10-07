import type { AudioVariant, FixtureTag } from '../shared/types'

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&apos;': "'",
  '&quot;': '"',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' '
}

export function decodeXmlText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&[a-z]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity)
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Tape-delay and highlight markers used by Turkish sport channels.
 * The boundaries are letter-class lookarounds, not \b: Turkish "Canlı" ends in
 * a dotless i, which ASCII word boundaries and case folding both get wrong.
 */
const MARKERS: { re: RegExp; tag: FixtureTag }[] = [
  { re: /(?<!\p{L})(CANL[Iı]|LIVE)(?!\p{L})/iu, tag: 'live' },
  { re: /(?<!\p{L})(BANT|TEKRA?R)(?!\p{L})/iu, tag: 'replay' },
  { re: /(?<!\p{L})(GEN[İIı]Ş?\s*[ÖO]ZET|[ÖO]ZET|HIGHLIGHTS)(?!\p{L})/iu, tag: 'highlights' }
]

/** "SUPER LIG (26-27) 3. HAFTA" style prefixes carry the competition name. */
const LEAGUE_PREFIX = /^(.{3,44}?)\s*\((?:\d{2}-\d{2}|\d{4})\)\s*(?:\d+\s*\.?\s*(?:HAFTA|TUR|HFT|HAFTASI)\s*)?/iu
const SEPARATOR = /\s+(?:-|–|—|vs\.?)\s+/i
const NOISE =
  /(?<!\p{L})(BANT|TEKRA?R|CANL[Iı]|LIVE|GEN[İIı]Ş?\s*[ÖO]ZET|[ÖO]ZET|HIGHLIGHTS|MAÇ\s*ÖNÜ|ST[ÜU]DYO)(?!\p{L})/giu
/** Sides that name a session rather than a competitor. */
const NOT_A_TEAM =
  /^(yarış|race|tur|seans|antrenman|sıralama|qualifying|free practice|fp\d|heat|etap|stage|und |campeonato|clausura|apertura|serie [a-d]|bundesliga|premier|gulf cup|eredivisie)/iu
const TEAM_MAX = 26

export interface ParsedFixture {
  league: string | null
  home: string
  away: string
  tag: FixtureTag
}

const tidy = (value: string): string =>
    value
    .replace(/\([^)]*\)/g, ' ')
    .replace(NOISE, ' ')
    .replace(/['"‘’“”]{2,}/g, ' ')
    .replace(/[/|]+/g, ' ')
    .replace(/\s*-\s*$/, '')
    .replace(/^\s*-\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Keeps the last words of an over-long side, which is where the team name sits. */
const trimSide = (side: string): string => {
  const clean = tidy(side.split(',')[0])
  if (clean.length <= TEAM_MAX) return clean
  const words = clean.split(' ')
  return words.slice(-2).join(' ')
}

/**
 * Pulls a fixture out of an EPG title. Returns null when the programme is not a
 * match, so news and studio shows never leak into the sports rail.
 */
export function parseFixture(rawTitle: string): ParsedFixture | null {
  const title = decodeXmlText(rawTitle)
  if (!title || /haber|bülten|bulten|gündem|gundem|basın|program rehberi/i.test(title)) return null

  let tag: FixtureTag = 'scheduled'
  for (const marker of MARKERS) {
    if (marker.re.test(title)) {
      tag = marker.tag
      break
    }
  }

  const leagueMatch = LEAGUE_PREFIX.exec(title)
  const league = leagueMatch ? tidy(leagueMatch[1]) : null
  const body = leagueMatch ? title.slice(leagueMatch[0].length) : title

  const parts = tidy(body).split(SEPARATOR).filter(Boolean)
  if (parts.length < 2) return null

  const home = trimSide(parts[0])
  const away = trimSide(parts[1])
  if (!home || !away) return null
  if (home.length < 2 || away.length < 2) return null
  if (home.length > TEAM_MAX || away.length > TEAM_MAX) return null
  if (/^\d+$/.test(home) || /^\d+$/.test(away)) return null
  if (NOT_A_TEAM.test(home) || NOT_A_TEAM.test(away)) return null

  return { league: league && league.length <= 44 ? league : null, home, away, tag }
}

/** XMLTV stamps look like "20261004210000 +0300". */
export function parseXmltvTime(value: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-]\d{2})(\d{2}))?/.exec(value.trim())
  if (!m) return 0
  const [, y, mo, d, h, mi, s, tzh, tzm] = m
  const base = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
  if (tzh === undefined) return base
  const offset = (Number(tzh) * 60 + Math.sign(Number(tzh)) * Number(tzm)) * 60_000
  return base - offset
}

/** Channel names arrive as "TR:STAR TV ᴴᴰ"; strip the country tag and quality glyphs. */
export function cleanChannelName(name: string): string {
  return name
    .replace(/^[A-Z]{2,4}\s*[:|]\s*/, '')
    .replace(/[ᴴᴰᵁᶠᴾᴷᴬᵂᴿᴸᵛᴹᴱ⁴⁺ᵏ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Category names arrive as "[TR] Spor". */
export function cleanGroupName(group: string): string {
  return group.replace(/^\[[^\]]*\]\s*/, '').replace(/\s+/g, ' ').trim()
}

/** Categories arrive as "[TR] Spor" and names as "TR:STAR TV" or "DE.Some Movie". */
export function countryFromGroup(group: string): string | null {
  const m = /^\s*\[([A-Za-z]{2,4})\]/.exec(group)
  return m ? m[1].toUpperCase() : null
}

export function countryFromName(name: string): string | null {
  const m = /^([A-Z]{2,3})\s*[:.|]\s*\p{L}/u.exec(name)
  return m ? m[1].toUpperCase() : null
}

/** Strips the provider's country prefix from a VOD or series title. */
export function cleanTitle(name: string): string {
  return name
    .replace(/^[A-Z]{2,3}\s*[:.|]\s*(?=\p{L})/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Turkish catalogues sometimes mark the audio variant in the name or category. */
const DUB_RE = /(?<!\p{L})(dublaj|dublajl[ıi]|t[uü]rk[cç]e\s*dub|tr\s*dub|dub)(?!\p{L})/iu
const SUB_RE = /(?<!\p{L})(altyaz[ıi]l?[ıi]?|alt\s*yaz[ıi]|subtitle[sd]?|tr\s*alt|orijinal\s*dil|sub)(?!\p{L})/iu

export function audioVariant(name: string, group: string): AudioVariant {
  const haystack = `${name} ${group}`
  /* Dub wins when both appear, because a dubbed release is the stronger claim. */
  if (DUB_RE.test(haystack)) return 'dub'
  if (SUB_RE.test(haystack)) return 'sub'
  return null
}
