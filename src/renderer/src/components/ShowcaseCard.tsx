import { Art } from './Art'
import { useTilt } from '@/hooks/useFx'
import { hue } from '@/lib/img'

export interface Collection {
  id: string
  kicker: string
  title: string
  subtitle: string
  image: string | null
}

interface ShowcaseCardProps {
  collection: Collection
  onOpen: () => void
}

/** Apple TV style editorial banner, the only place TiltedCard is used. */
export function ShowcaseCard({ collection, onOpen }: ShowcaseCardProps): React.JSX.Element {
  const ref = useTilt<HTMLButtonElement>()

  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      className="relative aspect-video w-[clamp(300px,34vw,468px)] overflow-hidden rounded-[22px] text-left shadow-[inset_0_1px_0_rgba(255,255,255,.16),0_20px_48px_-18px_rgba(0,0,0,.9)] transition-[box-shadow] duration-500"
      style={{ transformStyle: 'preserve-3d' }}
    >
      <Art src={collection.image} alt={collection.title} hue={hue(collection.id)} shape="fill" />
      <span className="absolute inset-x-5 bottom-5 z-3" style={{ transform: 'translateZ(34px)' }}>
        <span className="mono block text-[10.5px] tracking-[0.16em] text-acc uppercase">{collection.kicker}</span>
        <span className="mt-2 mb-1.5 block font-disp text-[clamp(23px,2.5vw,32px)] leading-[0.94] font-black tracking-[-0.035em] drop-shadow-[0_4px_24px_rgba(0,0,0,.7)]">
          {collection.title}
        </span>
        <span className="block text-[12.5px] text-tx2">{collection.subtitle}</span>
      </span>
    </button>
  )
}
