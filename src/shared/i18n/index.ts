import { en } from './en'
import { tr } from './tr'

/**
 * Two dictionaries and a lookup, rather than an i18n library.
 *
 * What this interface needs is a key, a table per language and somewhere to
 * put a number in the middle of a sentence. A library brings plural rules,
 * namespaces, loaders and a backend for none of which there is a use here, at
 * a size larger than the dictionaries themselves.
 *
 * It lives in shared because both processes write for the viewer: the messages
 * a failed request turns into are composed in the main process and shown in the
 * interface, so they have to come out of the same table.
 */

export type Lang = 'tr' | 'en'

/** Turkish is the source language: every key exists there first. */
export type Key = keyof typeof tr

const DICT: Record<Lang, Partial<Record<Key, string>>> = { tr, en }

export type Vars = Record<string, string | number>

/** Fills {name} placeholders. Missing ones are left visible rather than blanked. */
function fill(text: string, vars?: Vars): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole
  )
}

export type Translate = (key: Key, vars?: Vars) => string

/**
 * A translator for one language. Turkish comes before the key itself: an
 * untranslated string should read as a sentence someone can still act on, not
 * as nav.home.
 */
export function makeT(lang: Lang): Translate {
  return (key, vars) => fill(DICT[lang][key] ?? tr[key] ?? String(key), vars)
}

/** Narrows whatever was stored or guessed to a language we actually have. */
export function asLang(value: string | null | undefined): Lang {
  return value === 'en' ? 'en' : 'tr'
}

export const LANGUAGES: { id: Lang; label: string }[] = [
  { id: 'tr', label: 'Türkçe' },
  { id: 'en', label: 'English' }
]

export { en, tr }
export { languageKey } from './languages'
