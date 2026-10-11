import { isProviderUrl } from './ratelimit'

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
  if (status === 401 || status === 403) {
    return 'Sağlayıcı kimlik bilgilerini kabul etmedi. Kullanıcı adı veya şifre değişmiş olabilir'
  }
  if (status === 404) {
    /* Measured on this provider: a line removed from the streaming server
       answers 404 to credentialed requests while still answering 401 without
       them, so a missing subscription is the likelier cause than a typo. */
    return 'Sağlayıcı bu aboneliği tanımıyor. Hat kapatılmış veya adres değişmiş olabilir'
  }
  if (status === 429) {
    return 'Sağlayıcı çok fazla istek geldiği için erişimi geçici olarak kıstı. Bir süre sonra kendiliğinden açılır'
  }
  if (status === 402) return 'Aboneliğin ödemesi görünmüyor'
  if (status >= 500) return 'Sağlayıcının sunucusunda sorun var, bizden kaynaklanmıyor'
  return 'Sağlayıcı isteği reddetti'
}

function tmdbReason(status: number): string {
  if (status === 401) return 'TMDB anahtarı geçersiz. Ayarlardan yeniden girin'
  if (status === 404) return 'TMDB bu kaydı bulamadı'
  if (status === 429) return 'TMDB istek sınırına takıldı, biraz sonra tekrar denenecek'
  if (status >= 500) return 'TMDB tarafında sorun var'
  return 'TMDB isteği reddetti'
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
  const where = isProviderUrl(url) ? 'Sağlayıcıya' : 'TMDB sunucusuna'
  if (error instanceof Error) {
    if (error.name === 'AbortError') return `${where} ulaşıldı ama yanıt zamanında gelmedi`
    if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(error.message)) {
      return `${where} ait adres çözümlenemedi. İnternet bağlantınızı veya adresi kontrol edin`
    }
    if (/ECONNREFUSED/i.test(error.message)) return `${where} bağlantı reddedildi. Adres veya port yanlış olabilir`
    if (/ECONNRESET|socket hang up|terminated/i.test(error.message)) {
      /* The signature of the block this provider applied in October. */
      return `${where} bağlantı kesildi. Sağlayıcı adresinizi engellemiş olabilir`
    }
    if (/certificate|SSL|TLS/i.test(error.message)) return `${where} güvenli bağlantı kurulamadı`
  }
  return `${where} ulaşılamadı`
}
