import { Art } from './Art'
import { useT } from '@/i18n'
import { poster } from '@/lib/img'

interface PersonCardProps {
  id: number
  name: string
  profile: string | null
  /** The role in a cast list, or what they are in on the trending row. */
  note?: string | null
  onOpen: () => void
}

/**
 * A face with a line of context under it. A button rather than a div, because it
 * leads to the rest of their work — and a clickable div is unreachable by
 * keyboard.
 */
export function PersonCard({ id, name, profile, note, onOpen }: PersonCardProps): React.JSX.Element {
  const t = useT()
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t('card.personWorks', { name })}
      className="spot w-[clamp(104px,8vw,128px)] text-left"
    >
      <Art src={poster(profile, 'w185')} alt={name} shape="poster" className="lift-sm" />
      <div className="mt-2 truncate text-[12.5px] font-bold">{name}</div>
      {note ? <div className="truncate text-[11.5px] text-tx3">{note}</div> : null}
    </button>
  )
}
