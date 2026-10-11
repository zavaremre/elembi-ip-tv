/**
 * Reads an Xtream subscription out of whatever form the provider handed over.
 *
 * Panels give out a different link depending on which button you press, and a
 * subscriber has no reason to know which one the app wants. All of these carry
 * the same three facts — where the server is, and the two credentials — so any
 * of them is accepted:
 *
 *   http://host:8080/get.php?username=U&password=P&type=m3u_plus&output=ts
 *   http://host:8080/player_api.php?username=U&password=P
 *   http://host:8080/xmltv.php?username=U&password=P
 *   http://host:8080/live/U/P/1234.ts        (a stream address)
 *   http://host:8080                         (with the two fields filled in)
 */

export interface XtreamCredentials {
  host: string
  user: string
  pass: string
  /** Set when the link said which container it wants. */
  output?: string
}

/** Paths that carry the credentials as the first two segments. */
const STREAM_PATH = /^\/(?:live|movie|series)\/([^/]+)\/([^/]+)\//

export function parseXtreamUrl(input: string): XtreamCredentials | null {
  const text = input.trim()
  if (!text) return null

  /* A bare host is common; URL needs the scheme to parse it at all. */
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`

  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }
  if (!url.hostname) return null

  const host = `${url.protocol}//${url.host}`
  const output = url.searchParams.get('output') ?? undefined

  const fromQuery = {
    user: url.searchParams.get('username') ?? '',
    pass: url.searchParams.get('password') ?? ''
  }
  if (fromQuery.user && fromQuery.pass) {
    return { host, user: fromQuery.user, pass: fromQuery.pass, output }
  }

  const stream = STREAM_PATH.exec(url.pathname)
  if (stream) {
    return { host, user: decodeURIComponent(stream[1]), pass: decodeURIComponent(stream[2]) }
  }

  /* Only the server, which is still useful when the fields are filled by hand. */
  return { host, user: '', pass: '' }
}

/**
 * True when the three facts needed to talk to a panel are present. The output
 * format is not among them: ffmpeg takes whatever the provider sends.
 */
export function isComplete(credentials: XtreamCredentials | null): boolean {
  return Boolean(credentials?.host && credentials.user && credentials.pass)
}
