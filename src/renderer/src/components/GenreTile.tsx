import { Art } from './Art'

import type { Genre } from '@shared/types'

interface GenreTileProps {
  genre: Genre
  onOpen: () => void
}

/** Typographic genre tile — GlareHover gives the flat surface some material. */
export function GenreTile({ genre, onOpen }: GenreTileProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="glare relative grid aspect-video w-[clamp(190px,17vw,226px)] place-items-center overflow-hidden rounded-[16px] border border-white/8 hover:border-acc/50"
    >
      <Art src={null} alt="" shape="fill" flat />
      <span className="relative z-3 font-disp text-[clamp(18px,1.9vw,24px)] font-black tracking-[-0.02em] uppercase drop-shadow-[0_3px_18px_rgba(0,0,0,.7)]">
        {genre.name}
      </span>
    </button>
  )
}
