import { useT } from '@/i18n'
import type { UpdateInfo } from '@shared/types'

interface UpdateToastProps {
  update: UpdateInfo
  onDismiss: () => void
}

/**
 * A newer release exists. Nothing is installed from here: the macOS bundle is
 * ad-hoc signed, so an in-place update would be refused, and a .deb cannot be
 * replaced from inside the running app — so this points at the release page and
 * lets the viewer install it the way they installed this one.
 */
export function UpdateToast({ update, onDismiss }: UpdateToastProps): React.JSX.Element {
  const t = useT()

  return (
    <div
      /* Bottom right, not top: the provider toast owns the top corner for the
         first seconds of a launch, which is exactly when this arrives. */
      className="nodrag fixed right-5 bottom-5 z-70 flex max-w-[420px] items-center gap-3 rounded-[14px] border border-acc/45 bg-ink2/88 px-4 py-3 shadow-[0_22px_50px_-18px_rgba(0,0,0,.9)] backdrop-blur-[20px]"
    >
      <span className="pulse shrink-0 text-acc" />

      <div className="min-w-0">
        <div className="text-[13px] font-bold">{t('update.title', { version: update.version })}</div>
        <div className="mono mt-0.5 truncate text-[11px] text-tx3">{t('update.note')}</div>
      </div>

      {/* An anchor, not a button: the main process already sends outbound
          navigation to the system browser, so no new channel is needed. */}
      <a
        href={update.url}
        onClick={onDismiss}
        className="ml-1 flex h-8 shrink-0 items-center rounded-[9px] bg-acc px-3 text-[12.5px] font-bold text-ink"
      >
        {t('update.download')}
      </a>

      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('update.later')}
        className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-white/10"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}
