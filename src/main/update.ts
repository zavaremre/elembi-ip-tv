import { app } from 'electron'
import { config } from './config'

/**
 * Tells the viewer a newer build exists. It does not install it.
 *
 * electron-updater would, on Windows and on the AppImage — but not here. The
 * macOS bundle is ad-hoc signed, and Squirrel.Mac requires a downloaded update
 * to satisfy the same signing requirement as the running app; an ad-hoc
 * signature differs on every build, so the install step is refused. A .deb is
 * never updatable that way either. A notification is the one mechanism that
 * works for all five artifacts we publish, so that is what this does.
 */

const RELEASES = 'https://api.github.com/repos/zavaremre/elembi-ip-tv/releases/latest'
const PAGE = 'https://github.com/zavaremre/elembi-ip-tv/releases/latest'
const TIMEOUT_MS = 8_000
/* Once a day is plenty for a release cadence measured in weeks. */
const RECHECK_MS = 24 * 3600_000

export interface UpdateInfo {
  version: string
  /** The release page, opened in the browser — we do not download anything. */
  url: string
}

let cached: { at: number; info: UpdateInfo | null } | null = null

/** Compares two dotted versions numerically, so 0.10.0 beats 0.9.0. Exported to be testable. */
export function isNewer(candidate: string, current: string): boolean {
  const parse = (v: string): number[] => v.replace(/^v/, '').split('.').map((n) => Number.parseInt(n, 10) || 0)
  const a = parse(candidate)
  const b = parse(current)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const left = a[i] ?? 0
    const right = b[i] ?? 0
    if (left !== right) return left > right
  }
  return false
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  /* Off means off: no request is made, so nothing reaches GitHub. */
  if (config().UPDATE_CHECK === '0') return null
  if (cached && Date.now() - cached.at < RECHECK_MS) return cached.info

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(RELEASES, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!res.ok) throw new Error(String(res.status))
    const body = (await res.json()) as { tag_name?: string; draft?: boolean; prerelease?: boolean }
    const tag = body.tag_name
    const info =
      tag && !body.draft && !body.prerelease && isNewer(tag, app.getVersion())
        ? { version: tag.replace(/^v/, ''), url: PAGE }
        : null
    cached = { at: Date.now(), info }
    return info
  } catch {
    /*
     * A failed check is not worth a message. Not cached either, so a launch
     * with no network does not suppress the next hour's check.
     */
    return null
  } finally {
    clearTimeout(timer)
  }
}
