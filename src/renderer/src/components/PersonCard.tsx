import { Art } from './Art'
import { hue, poster } from '@/lib/img'
import type { CastMember } from '@shared/types'

interface PersonCardProps {
  person: CastMember
}

/** Cast entry: the face carries recognition, the role explains it. */
export function PersonCard({ person }: PersonCardProps): React.JSX.Element {
  return (
    <div className="w-[clamp(104px,8vw,128px)]">
      <Art src={poster(person.profile, 'w185')} alt={person.name} hue={hue(person.id)} shape="poster" flat className="rounded-[12px]" />
      <div className="mt-2 truncate text-[12.5px] font-bold">{person.name}</div>
      {person.character ? <div className="truncate text-[11.5px] text-tx3">{person.character}</div> : null}
    </div>
  )
}
