import { parseXtreamUrl, isComplete, type XtreamCredentials } from '../shared/xtreamUrl'
import { t } from './i18n'

/**
 * Works out a subscription from the one link a provider hands over.
 *
 * Subscribers are given a playlist address, not three fields, and most never
 * see a username at all — so the link is the only thing worth asking for. Three
 * of the facts we need are always in there somewhere:
 *
 *   - in the query, as with get.php?username=…&password=…
 *   - in the path, as with a stream address like /live/USER/PASS/1.ts
 *   - inside the playlist, where every entry's address carries them
 *
 * The last case is why this lives in the main process: an opaque link has to be
 * fetched to be understood, and the playlist for this provider is 14 MB. Only
 * the opening is read — the first entry appears within the first kilobyte — and
 * the rest is dropped.
 */

const FETCH_TIMEOUT_MS = 20_000
/* Generous: a playlist header plus a first entry is a few hundred bytes. */
const READ_LIMIT = 96 * 1024

export interface ResolveResult {
  credentials: XtreamCredentials | null
  /** Why it could not be worked out, for showing next to the field. */
  error: string | null
}

/** Pulls host and credentials out of the first stream address in a playlist. */
function fromPlaylist(text: string): XtreamCredentials | null {
  const match = /https?:\/\/[^\s"']+\/(?:live|movie|series)\/[^/\s"']+\/[^/\s"']+\/[^\s"']+/.exec(text)
  if (!match) return null
  const found = parseXtreamUrl(match[0])
  return isComplete(found) ? found : null
}

export async function resolveProviderLink(link: string): Promise<ResolveResult> {
  const direct = parseXtreamUrl(link)
  if (isComplete(direct)) return { credentials: direct, error: null }
  if (!direct) return { credentials: null, error: t('resolve.notALink') }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(link, { signal: controller.signal })
    if (!res.ok) {
      return { credentials: null, error: t('resolve.badStatus', { status: res.status }) }
    }

    /* Read the opening only; the body may be megabytes of playlist. */
    const reader = res.body?.getReader()
    if (!reader) return { credentials: null, error: t('resolve.emptyReply') }

    const decoder = new TextDecoder()
    let text = ''
    try {
      while (text.length < READ_LIMIT) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        const found = fromPlaylist(text)
        if (found) return { credentials: found, error: null }
      }
    } finally {
      await reader.cancel().catch(() => undefined)
    }

    const found = fromPlaylist(text)
    if (found) return { credentials: found, error: null }
    if (!text.includes('#EXTM3U')) {
      return { credentials: null, error: t('resolve.notPlaylist') }
    }
    return {
      credentials: null,
      error: t('resolve.noXtream')
    }
  } catch (e) {
    const reason = t(e instanceof Error && e.name === 'AbortError' ? 'resolve.timeout' : 'resolve.unreachable')
    return { credentials: null, error: reason }
  } finally {
    clearTimeout(timer)
  }
}
