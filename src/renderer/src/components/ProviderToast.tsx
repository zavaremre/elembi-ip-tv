import { useEffect, useState } from 'react'
import type { ProviderStatus } from '@shared/types'

interface ProviderToastProps {
  status: ProviderStatus | null
  loading: boolean
  error: string | null
  /** Counts taken from the lists the page actually uses. */
  counts: { channels: number; movies: number; series: number }
  onRetry: () => void
  onOpenSettings: () => void
}

const DISMISS_MS = 4500
const nf = new Intl.NumberFormat('tr-TR')

/** Connection state as a toast: visible while it matters, gone once it is fine. */
export function ProviderToast({
  status,
  loading,
  error,
  counts,
  onRetry,
  onOpenSettings
}: ProviderToastProps): React.JSX.Element | null {
  const failed = Boolean(error) || (status !== null && !status.ok)
  const connected = !loading && !failed && counts.channels > 0
  const [dismissed, setDismissed] = useState(false)

  /* A healthy connection needs a moment of confirmation, not a permanent strip. */
  useEffect(() => {
    if (!connected) return
    const timer = window.setTimeout(() => setDismissed(true), DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [connected])

  useEffect(() => {
    if (loading || failed) setDismissed(false)
  }, [loading, failed])

  if (dismissed || (!loading && !failed && !connected)) return null

  return (
    <div
      /* Below the 66px header band: inside it the window drag region eats clicks. */
      className={`nodrag fixed top-[82px] right-5 z-70 flex max-w-[420px] items-center gap-3 rounded-[14px] border px-4 py-3 shadow-[0_22px_50px_-18px_rgba(0,0,0,.9)] backdrop-blur-[20px] ${
        failed ? 'border-live/45 bg-live/12' : 'border-line bg-ink2/88'
      }`}
    >
      {loading ? (
        <span className="h-4 w-4 shrink-0 rounded-full border-2 border-white/15 border-t-acc motion-safe:animate-spin" />
      ) : failed ? (
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-live" />
      ) : (
        <span className="pulse shrink-0 text-score" />
      )}

      <div className="min-w-0">
        <div className="text-[13px] font-bold">
          {loading ? 'Sağlayıcıya bağlanılıyor' : failed ? 'Sağlayıcıya bağlanılamadı' : 'Sağlayıcı bağlı'}
        </div>
        <div className="mono mt-0.5 truncate text-[11px] text-tx3">
          {failed
            ? (error ?? status?.message ?? 'ulaşılamadı')
            : loading
              ? 'kanal ve katalog alınıyor'
              : `${nf.format(counts.channels)} kanal · ${nf.format(counts.movies)} film · ${nf.format(counts.series)} dizi${
                  status?.user?.expires ? ` · bitiş ${status.user.expires}` : ''
                }`}
        </div>
      </div>

      {failed ? (
        <button type="button" onClick={onRetry} className="ml-1 h-8 shrink-0 rounded-[9px] border border-line bg-white/10 px-3 text-[12.5px] font-bold">
          Tekrar dene
        </button>
      ) : null}

      <button
        type="button"
        onClick={failed ? onOpenSettings : () => setDismissed(true)}
        aria-label={failed ? 'Ayarları aç' : 'Kapat'}
        className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-white/10"
      >
        {failed ? (
          <span className="mono text-[10px] text-acc">⚙</span>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        )}
      </button>
    </div>
  )
}
