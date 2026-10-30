import type { Key } from './index'

/**
 * ISO codes to dictionary keys. Both the two- and three-letter forms appear in
 * the wild — a provider's audio tracks use one, a Matroska file the other — so
 * both map to the same entry.
 */
const BY_CODE: Record<string, Key> = {
  tur: 'lang.tr', tr: 'lang.tr',
  eng: 'lang.en', en: 'lang.en',
  ger: 'lang.de', deu: 'lang.de', de: 'lang.de',
  fre: 'lang.fr', fra: 'lang.fr', fr: 'lang.fr',
  spa: 'lang.es', es: 'lang.es',
  ita: 'lang.it', it: 'lang.it',
  rus: 'lang.ru', ru: 'lang.ru',
  ara: 'lang.ar', ar: 'lang.ar',
  pol: 'lang.pl', pl: 'lang.pl',
  dut: 'lang.nl', nld: 'lang.nl', nl: 'lang.nl',
  swe: 'lang.sv', sv: 'lang.sv',
  kor: 'lang.ko', ko: 'lang.ko',
  jpn: 'lang.ja', ja: 'lang.ja',
  ukr: 'lang.uk', uk: 'lang.uk',
  fin: 'lang.fi', fi: 'lang.fi',
  /* What a file says when it does not know; it still needs a name on screen. */
  und: 'lang.code.other'
}

/** The key for a code, or null when it is one we have no name for. */
export function languageKey(code: string | null | undefined): Key | null {
  return code ? (BY_CODE[code.toLowerCase()] ?? null) : null
}
