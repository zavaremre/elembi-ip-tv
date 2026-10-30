import { clock } from '@/lib/fmt'
import { useT } from '@/i18n'
import type { Match } from '@shared/types'

interface ReminderToastProps {
  match: Match
  onPlay: () => void
  onDismiss: () => void
}

/** Fires for a reminded fixture that is about to start. */
export function ReminderToast({ match, onPlay, onDismiss }: ReminderToastProps): React.JSX.Element {
  const t = useT()
  return (
    <div className="fixed right-5 bottom-[216px] z-81 flex items-center gap-3 rounded-[13px] border border-score/42 bg-ink2/88 p-3.5 shadow-[0_22px_50px_-18px_rgba(0,0,0,.9)] backdrop-blur-[20px]">
      <span className="grid h-[34px] w-[34px] place-items-center rounded-[11px] bg-score/16 text-[17px]">⚽</span>
      <div>
        <div className="text-[13px] font-extrabold">
          {match.home} – {match.away}
        </div>
        <div className="mono mt-0.5 text-[11px] text-tx3">
          {clock(match.start)} · {match.channelName}
        </div>
      </div>
      <button type="button" onClick={onPlay} className="ml-1.5 rounded-[8px] bg-score/14 px-2.5 py-1.5 text-[12px] font-bold text-score">
        {t('match.watch')}
      </button>
      <button type="button" onClick={onDismiss} aria-label="Kapat" className="grid h-6 w-6 place-items-center rounded-[7px] bg-white/10">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}
