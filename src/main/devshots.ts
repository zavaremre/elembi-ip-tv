import { app, type BrowserWindow } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeT } from '../shared/i18n'
import { uiLang } from './i18n'
import type { Key } from '../shared/i18n'

/**
 * Captures the real interface for the README, driven from inside the app.
 *
 * Only runs when ELEMBI_SHOTS is set, so it is inert in normal use. Written this
 * way because the alternatives are worse: a screen grab needs the window's
 * coordinates and the right OS permission, and clicking by coordinate breaks
 * the moment the layout moves. capturePage gives the window's own pixels, and
 * the navigation below asks for controls by the text on them.
 */

const OUT = join(app.getAppPath(), 'docs/screenshots')

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Clicks a control by what it says. Icon-only buttons carry no text, so the
 * accessible name counts too — the settings gear is reachable no other way.
 */
const CLICK = `(function (needle, nth) {
  const want = needle.toLowerCase()
  const all = [...document.querySelectorAll('button, a, [role="button"]')]
  const named = (el) => ((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '') +
    ' ' + (el.getAttribute('title') || '')).replace(/\\s+/g, ' ').trim().toLowerCase()
  /*
   * Exact first. Matching on "contains" alone picked a channel called
   * Sportdigital over the Spor tab, and a DIGER DIZILER card over Diziler, so
   * three shots came back showing the same page.
   */
  const exact = all.filter((el) => named(el) === want)
  const loose = all.filter((el) => named(el).includes(want))
  const el = (exact.length ? exact : loose)[nth || 0]
  if (!el) return 'yok:' + needle
  el.scrollIntoView({ block: 'center' })
  el.click()
  return (exact.length ? 'tam:' : 'kismi:') + needle
})`

/** Scrolls the page so a shot shows the rows below the fold. */
const SCROLL = `(function (y) {
  const page = document.getElementById('page')
  if (page) page.scrollTo({ top: y })
  return 'scroll:' + y
})`

/**
 * Blanks anything that identifies the subscription before a shot is taken.
 *
 * The settings page prints the panel's address and the username, and that shot
 * went into a public repository once. Masking here rather than remembering not
 * to capture the page: the next person to add a step should not have to know.
 */
const MASK = `(function (labels) {
  const SECRET = /^https?:\\/\\//
  let hidden = 0
  for (const el of document.querySelectorAll('div, span, td, dd')) {
    const text = (el.textContent || '').trim()
    if (el.children.length > 0 || !text) continue
    const label = (el.previousElementSibling?.textContent || '').trim().toLowerCase()
    if (SECRET.test(text) || labels.includes(label)) {
      el.textContent = '••••••••••••'
      hidden++
    }
  }
  return 'maskelendi:' + hidden
})`

const HERO = `(async function (wanted) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const want = wanted.toLowerCase()
  const hero = document.querySelector('section[class*="76vh"]')
  if (!hero) return 'hero yok'
  /* The title is a logo image when TMDB has one, an <h1> otherwise. */
  const titleOf = () => {
    const img = hero.querySelector('img[alt]')
    const h1 = hero.querySelector('h1')
    return ((img && img.alt) || (h1 && h1.textContent) || '').trim()
  }
  const count = hero.querySelectorAll('button[aria-current]').length
  if (titleOf().toLowerCase().includes(want)) return 'hero:' + titleOf()
  for (let i = 0; i < count; i++) {
    /* Re-queried each time: React replaces these on every slide change. */
    const dots = hero.querySelectorAll('button[aria-current]')
    if (!dots[i]) break
    dots[i].click()
    await sleep(520)
    if (titleOf().toLowerCase().includes(want)) return 'hero:' + titleOf()
  }
  const first = hero.querySelectorAll('button[aria-current]')[0]
  if (first) {
    first.click()
    await sleep(520)
  }
  return 'hero bulunamadı:' + wanted + ' (' + titleOf() + ')'
})`

interface Step {
  name: string
  /** Controls to click in order before the shot is taken, named by dictionary
      key so the sequence works in whatever language the app is in. */
  path?: [Key, number?][]
  /** Pins the hero on the title whose name contains this, before capturing. */
  hero?: string
  /** How far down the page to scroll, for rows below the fold. */
  scroll?: number
  /** Blanks the subscription's address and username before capturing. */
  mask?: boolean
  settle?: number
}

/*
 * The title the hero is pinned to, so the shot does not depend on where the
 * rotation happened to be. Change this to feature something else; a title the
 * hero is not carrying falls back to the first slide rather than failing.
 *
 * Not every title can be pinned in every language. The provider names this
 * one's Turkish release "Verity: Gerçeğin Diğer Kıyısı", which the Turkish
 * TMDB title matches and the English one ("Verity") does not — so in English
 * it is not in the hero at all.
 */
const HERO_TITLE = 'Avengers: Endgame'

const STEPS: Step[] = [
  { name: '01-home', hero: HERO_TITLE, settle: 3000 },
  /* Platforms sit directly under the hero now, so the old 1520 scrolled past them. */
  { name: '02-platforms', hero: HERO_TITLE, scroll: 600, settle: 2600 },
  { name: '03-home-rows', scroll: 1180, settle: 2600 },
  { name: '04-live-tv', path: [['nav.live']], settle: 2600 },
  { name: '05-movies', path: [['nav.movies']], settle: 2600 },
  { name: '06-series', path: [['nav.series']], settle: 2600 },
  { name: '07-sports', path: [['nav.sports']], settle: 2600 },
  { name: '08-discover', path: [['nav.discover']], settle: 2800 },
  { name: '09-detail', path: [['common.openDetail']], settle: 7000 },
  { name: '10-detail-cast', path: [['common.openDetail']], scroll: 1100, settle: 7000 },
  { name: '11-favorites', path: [['nav.favorites']], settle: 2600 },
  { name: '12-settings', path: [['shell.settings']], settle: 1800, mask: true },
  { name: '13-about', path: [['shell.settings'], ['info.tab.about']], settle: 1600, mask: true },
  { name: '14-help', path: [['shell.settings'], ['info.tab.help']], settle: 1600 },
  { name: '15-privacy', path: [['shell.settings'], ['info.tab.privacy']], settle: 1600 },
  { name: '16-setup', path: [['shell.settings'], ['set.editProvider']], settle: 1800 }
]

export async function captureShots(win: BrowserWindow): Promise<void> {
  mkdirSync(OUT, { recursive: true })
  /* Labels come from the dictionary, so the run follows the app's language. */
  const t = makeT(uiLang())
  const masked = [t('set.host'), t('set.user'), t('info.about.dataDir')].map((label) =>
    label.toLowerCase()
  )
  process.stdout.write(`  dil: ${uiLang()}\n`)

  /* The provider toast clears after 4.5s and artwork lands later; wait it out. */
  await wait(12000)

  for (const step of STEPS) {
    /* Home first every time, so a step never inherits the last one's view. */
    await win.webContents.executeJavaScript(`${CLICK}(${JSON.stringify(t('nav.home'))})`).catch(() => null)
    await win.webContents.executeJavaScript(`${SCROLL}(0)`).catch(() => null)
    await wait(1400)

    if (step.hero) {
      const said = await win.webContents
        .executeJavaScript(`${HERO}(${JSON.stringify(step.hero)})`)
        .catch(() => 'hata')
      process.stdout.write(`  ${step.name}: ${said}\n`)
    }

    for (const [key, nth] of step.path ?? []) {
      const label = t(key)
      const said = await win.webContents
        .executeJavaScript(`${CLICK}(${JSON.stringify(label)}, ${nth ?? 0})`)
        .catch(() => 'hata')
      process.stdout.write(`  ${step.name}: ${label} → ${said}\n`)
      await wait(1500)
    }

    if (step.mask) {
      const said = await win.webContents
        .executeJavaScript(`${MASK}(${JSON.stringify(masked)})`)
        .catch(() => 'hata')
      process.stdout.write(`  ${step.name}: ${said}\n`)
    }

    if (step.scroll) {
      await win.webContents.executeJavaScript(`${SCROLL}(${step.scroll})`).catch(() => null)
      await wait(1200)
    }
    await wait(step.settle ?? 1500)
    /* The frame has to be on screen and current, or the capture is the old one. */
    win.show()
    win.focus()
    await wait(600)
    const image = await win.webContents.capturePage()
    /* JPEG, because that is what the README links and a PNG of this is 4 MB. */
    writeFileSync(join(OUT, `${step.name}.jpg`), image.toJPEG(84))
    const size = image.getSize()
    process.stdout.write(`  ${step.name}.jpg  ${size.width}x${size.height}\n`)
  }

  process.stdout.write('  bitti\n')
  app.quit()
}
