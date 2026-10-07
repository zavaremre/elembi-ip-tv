/** Title normalisation shared by the provider matcher and the artwork lookup. */

const TAGS =
  /\b(4k|uhd|fhd|hd|sd|tr|dublaj|altyazı|altyazili|türkçe|turkce|multi|vip|x265|hevc|1080p?|720p?|2160p?|web-?dl|bluray|remux|imax|extended|uncut)\b/gi

const YEAR_RE = /(?:^|[([\s.\-_])((?:19|20)\d{2})(?:[)\]\s.\-_]|$)/g

/** This panel prefixes many entries with a catalogue number, e.g. "069-". */
const CATALOGUE_PREFIX = /^\s*\d{1,4}\s*[-.]\s*/

/** Trailing words that do not change which title an entry is. */
const HARMLESS_SUFFIX = /^(the movie|film|filmi|serisi|collection|koleksiyon|part|bolum|izle)$/i

export interface ParsedTitle {
  tokens: string[]
  title: string
  year: number | null
}

function fold(value: string): string {
  return value
    .toLocaleLowerCase('tr')
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/[àáâãä]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõ]/g, 'o')
    .replace(/[ùúû]/g, 'u')
}

/** Normalises a name while keeping the year, which is what separates remakes. */
export function parseTitle(raw: string): ParsedTitle {
  let year: number | null = null
  YEAR_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = YEAR_RE.exec(raw))) year = Number(match[1])

  const title = fold(raw.replace(CATALOGUE_PREFIX, ''))
    .replace(YEAR_RE, ' ')
    .replace(TAGS, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return { tokens: title ? title.split(' ') : [], title, year }
}

/** Every key a name should be findable under: exact, order-insensitive, suffix-trimmed. */
export function titleKeys(parsed: ParsedTitle): string[] {
  if (parsed.tokens.length === 0) return []
  const keys = [parsed.tokens.join(' '), [...parsed.tokens].sort().join(' ')]

  let end = parsed.tokens.length
  while (end > 1 && HARMLESS_SUFFIX.test(parsed.tokens[end - 1])) end -= 1
  if (end !== parsed.tokens.length) keys.push(parsed.tokens.slice(0, end).join(' '))

  return [...new Set(keys)]
}

/** True when two names describe the same title, ignoring ordering and filler. */
export function sameTitle(a: ParsedTitle, b: ParsedTitle): boolean {
  if (a.tokens.length === 0 || b.tokens.length === 0) return false
  const left = titleKeys(a)
  const right = new Set(titleKeys(b))
  return left.some((key) => right.has(key))
}
