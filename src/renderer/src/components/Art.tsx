import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

type Shape = 'poster' | 'still' | 'fill' | 'box'

interface ArtProps {
  src: string | null | undefined
  alt: string
  /** Hue for the Grainient skeleton shown until the image decodes. */
  hue: number
  shape?: Shape
  contain?: boolean
  /** Drops the darkening scrim; for tiles that carry no text. */
  flat?: boolean
  className?: string
  children?: ReactNode
}

/**
 * 'box' adds no positioning so the element keeps .art's own `position: relative`.
 * Forcing it static would let .art::before and the overlay children resolve
 * against an outer ancestor and cover the whole card.
 */
const SHAPE: Record<Shape, string> = { poster: 'poster', still: 'still', fill: 'absolute inset-0', box: '' }

/** Key art with a colour-matched loading skeleton and the pointer-driven specular sheen. */
export function Art({ src, alt, hue, shape = 'poster', contain, flat, className = '', children }: ArtProps): React.JSX.Element {
  const [ready, setReady] = useState(false)

  return (
    <div
      className={`art ${SHAPE[shape]} ${flat ? 'flat' : ''} ${className}`}
      style={{ '--h': hue } as CSSProperties}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          className={`${ready ? 'ready' : ''} ${contain ? 'contain' : ''}`}
          onLoad={() => setReady(true)}
          onError={() => setReady(false)}
        />
      ) : null}
      {children}
    </div>
  )
}
