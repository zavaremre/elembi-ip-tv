import { useT } from '@/i18n'

interface PlayerLoadingProps {
  /** Distinguishes a session being prepared from ordinary buffering. */
  preparing: boolean
}

/** Shown while the local session starts or the buffer refills after a seek. */
export function PlayerLoading({ preparing }: PlayerLoadingProps): React.JSX.Element {
  const t = useT()
  return (
    <div className="pointer-events-none absolute inset-0 z-5 grid place-items-center">
      <div className="flex flex-col items-center gap-3 rounded-[16px] bg-ink/55 px-7 py-6 backdrop-blur-[10px]">
        <span className="h-11 w-11 rounded-full border-2 border-white/15 border-t-acc motion-safe:animate-spin" />
        <span className="mono text-[11px] tracking-[0.16em] text-tx2 uppercase">
          {preparing ? t('player.preparing') : t('player.loading')}
        </span>
      </div>
    </div>
  )
}
