import { app } from 'electron'
import { config } from './config'
import { asLang, makeT, type Key, type Lang, type Vars } from '../shared/i18n'

/**
 * The interface language as the renderer sees it: the stored choice, or the
 * system's when there is none. Resolved on every call rather than captured,
 * since the setting changes while the process is running.
 */
export function uiLang(): Lang {
  const stored = config().UI_LANG
  if (stored) return asLang(stored)
  return app.getLocale().toLowerCase().startsWith('tr') ? 'tr' : 'en'
}

/**
 * Translator for the main process. The messages a failed request turns into are
 * written here and read on screen, so they come out of the shared dictionary.
 */
export function t(key: Key, vars?: Vars): string {
  return makeT(uiLang())(key, vars)
}
