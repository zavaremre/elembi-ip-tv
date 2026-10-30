import { createContext, useContext, useMemo } from 'react'
import { makeT, type Key, type Lang, type Translate, type Vars } from '@shared/i18n'
import type { ReactNode } from 'react'

/* The dictionary itself lives in shared, since the main process writes for the
   viewer too. This file is only the React half: the language in context, and
   the hooks that read it. */
export { LANGUAGES, asLang, makeT } from '@shared/i18n'
export type { Key, Lang, Translate, Vars }

const LanguageContext = createContext<Lang>('tr')

export function LanguageProvider({ lang, children }: { lang: Lang; children: ReactNode }): React.JSX.Element {
  return <LanguageContext.Provider value={lang}>{children}</LanguageContext.Provider>
}

export function useLang(): Lang {
  return useContext(LanguageContext)
}

export function useT(): Translate {
  const lang = useLang()
  return useMemo(() => makeT(lang), [lang])
}

/** Locale for Intl calls, so dates and numbers follow the interface too. */
export function useLocale(): string {
  const t = useT()
  return t('locale')
}
