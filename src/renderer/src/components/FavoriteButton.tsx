import { useT } from '@/i18n'

interface FavoriteButtonProps {
  active: boolean
  onToggle: () => void
  /** 'card' rides on a poster and appears on hover; 'bar' sits beside the play button. */
  variant?: 'card' | 'bar'
}

/**
 * The heart. A button of its own rather than a corner of the card, because the
 * card already is one and nesting them makes both unreachable from a keyboard.
 */
export function FavoriteButton({ active, onToggle, variant = 'card' }: FavoriteButtonProps): React.JSX.Element {
  const t = useT()
  const label = active ? t('fav.remove') : t('fav.add')

  const chrome =
    variant === 'card'
      ? `absolute top-2.5 right-2.5 z-4 grid h-8 w-8 place-items-center rounded-full border border-white/18 bg-ink/65 backdrop-blur-[10px] transition-opacity duration-200 focus-visible:opacity-100 group-hover:opacity-100 ${
          active ? 'opacity-100' : 'opacity-0'
        }`
      : 'grid h-11 w-11 place-items-center rounded-[12px] border border-line bg-white/8 hover:border-acc/40'

  return (
    <button
      type="button"
      onClick={(e) => {
        /* The card behind this is a button too; without it the title opens. */
        e.stopPropagation()
        onToggle()
      }}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={chrome}
    >
      <svg
        width={variant === 'card' ? 16 : 18}
        height={variant === 'card' ? 16 : 18}
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.9"
        className={active ? 'text-live' : 'text-tx2'}
        aria-hidden="true"
      >
        <path d="M12 20.3 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 1 1 19.4 13Z" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
