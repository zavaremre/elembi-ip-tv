import { app, type BrowserWindow } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Captures the real interface for the README, driven from inside the app.
 *
 * Only runs when AKIS_SHOTS is set, so it is inert in normal use. Written this
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

interface Step {
  name: string
  /** Controls to click in order before the shot is taken. */
  path?: [string, number?][]
  /** How far down the page to scroll, for rows below the fold. */
  scroll?: number
  settle?: number
}

const STEPS: Step[] = [
  { name: '01-home', settle: 3000 },
  { name: '02-home-rows', scroll: 760, settle: 2600 },
  { name: '03-platforms', scroll: 1520, settle: 2600 },
  { name: '04-live-tv', path: [['Canlı TV']], settle: 2600 },
  { name: '05-movies', path: [['Filmler']], settle: 2600 },
  { name: '06-series', path: [['Diziler']], settle: 2600 },
  { name: '07-sports', path: [['Spor']], settle: 2600 },
  { name: '08-discover', path: [['Keşfet']], settle: 2800 },
  { name: '09-detail', path: [['Detay']], settle: 7000 },
  { name: '10-detail-cast', path: [['Detay']], scroll: 980, settle: 7000 },
  { name: '11-settings', path: [['Ayarlar ve sağlayıcı']], settle: 1800 },
  { name: '12-about', path: [['Ayarlar ve sağlayıcı'], ['Hakkında']], settle: 1600 },
  { name: '13-help', path: [['Ayarlar ve sağlayıcı'], ['Yardım']], settle: 1600 },
  { name: '14-privacy', path: [['Ayarlar ve sağlayıcı'], ['Gizlilik politikası']], settle: 1600 },
  { name: '15-setup', path: [['Ayarlar ve sağlayıcı'], ['Aboneliği değiştir']], settle: 1800 }
]

export async function captureShots(win: BrowserWindow): Promise<void> {
  mkdirSync(OUT, { recursive: true })
  /* The provider toast clears after 4.5s and artwork lands later; wait it out. */
  await wait(12000)

  for (const step of STEPS) {
    /* Home first every time, so a step never inherits the last one's view. */
    await win.webContents.executeJavaScript(`${CLICK}('Ana Sayfa')`).catch(() => null)
    await win.webContents.executeJavaScript(`${SCROLL}(0)`).catch(() => null)
    await wait(1400)

    for (const [label, nth] of step.path ?? []) {
      const said = await win.webContents
        .executeJavaScript(`${CLICK}(${JSON.stringify(label)}, ${nth ?? 0})`)
        .catch(() => 'hata')
      process.stdout.write(`  ${step.name}: ${label} → ${said}\n`)
      await wait(1500)
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
    writeFileSync(join(OUT, `${step.name}.png`), image.toPNG())
    const size = image.getSize()
    process.stdout.write(`  ${step.name}.png  ${size.width}x${size.height}\n`)
  }

  process.stdout.write('  bitti\n')
  app.quit()
}
