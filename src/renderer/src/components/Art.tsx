import { useState } from 'react'
import type { ReactNode } from 'react'

type Shape = 'poster' | 'still' | 'fill' | 'box'

interface ArtProps {
  src: string | null | undefined
  alt: string
  shape?: Shape
  contain?: boolean
  /**
   * Which edge of the image to keep when `cover` has to crop it. Backdrops are
   * wider than the stage they fill, so the default centre crop eats the top of
   * the frame — where the subject usually is.
   */
  anchor?: 'top'
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
export function Art({ src, alt, shape = 'poster', contain, anchor, flat, className = '', children }: ArtProps): React.JSX.Element {
  const [ready, setReady] = useState(false)

  return (
    <div
      className={`art ${SHAPE[shape]} ${flat ? 'flat' : ''} ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          className={`${ready ? 'ready' : ''} ${contain ? 'contain' : ''} ${anchor === 'top' ? 'anchor-top' : ''}`}
          onLoad={() => setReady(true)}
          onError={() => setReady(false)}
        />
      ) : null}
      {children}
    </div>
  )
}
