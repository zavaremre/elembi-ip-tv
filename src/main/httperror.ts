import { isProviderUrl } from './ratelimit'
import { t } from './i18n'

/**
 * Turns a failed request into something worth reading.
 *
 * The raw form — "HTTP 404 — http://host:8080/player_api.php?username=…" — is a
 * developer's note: it names no cause, suggests no next step, and puts the
 * subscriber's username on screen. What a viewer needs to know is whether the
 * address is wrong, the subscription is over, or the panel has shut them out,
 * because each of those is a different thing to do about it. The status code is
 * kept at the end so a report still carries enough to diagnose.
 */

function providerReason(status: number): string {
  if (status === 401 || status === 403) return t('err.http.auth')
  if (status === 404) {
    /* Measured on this provider: a line removed from the streaming server
       answers 404 to credentialed requests while still answering 401 without
       them, so a missing subscription is the likelier cause than a typo. */
    return t('err.http.unknownLine')
  }
  if (status === 429) return t('err.http.rateLimited')
  if (status === 402) return t('err.http.unpaid')
  if (status >= 500) return t('err.http.providerServer')
  return t('err.http.providerRefused')
}

function tmdbReason(status: number): string {
  if (status === 401) return t('err.http.tmdbKey')
  if (status === 404) return t('err.http.tmdbMissing')
  if (status === 429) return t('err.http.tmdbRate')
  if (status >= 500) return t('err.http.tmdbServer')
  return t('err.http.tmdbRefused')
}

/** A readable explanation for a response that came back with a failing status. */
export function describeStatus(url: string, status: number): string {
  const reason = isProviderUrl(url) ? providerReason(status) : tmdbReason(status)
  return `${reason} (HTTP ${status})`
}

/**
 * The same for a request that never got a response. These arrive as opaque
 * fetch failures, so the shape of the error is all there is to go on.
 */
export function describeFailure(url: string, error: unknown): string {
  const where = t(isProviderUrl(url) ? 'err.where.provider' : 'err.where.tmdb')
  if (error instanceof Error) {
    if (error.name === 'AbortError') return t('err.net.timeout', { where })
    if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(error.message)) return t('err.net.dns', { where })
    if (/ECONNREFUSED/i.test(error.message)) return t('err.net.refused', { where })
    if (/ECONNRESET|socket hang up|terminated/i.test(error.message)) {
      /* The signature of the block this provider applied in October. */
      return t('err.net.reset', { where })
    }
    if (/certificate|SSL|TLS/i.test(error.message)) return t('err.net.tls', { where })
  }
  return t('err.net.unreachable', { where })
}
