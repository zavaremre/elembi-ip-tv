const BASE = 'https://image.tmdb.org/t/p'

export type PosterSize = 'w185' | 'w342' | 'w500'
export type StillSize = 'w300' | 'w780' | 'w1280' | 'original'

export function poster(path: string | null | undefined, size: PosterSize = 'w342'): string | null {
  return path ? `${BASE}/${size}${path}` : null
}
export function backdrop(path: string | null | undefined, size: StillSize = 'w780'): string | null {
  return path ? `${BASE}/${size}${path}` : null
}
export function logo(path: string | null | undefined, size: 'w300' | 'w500' = 'w500'): string | null {
  return path ? `${BASE}/${size}${path}` : null
}

/** Stable hue derived from the item itself, so every skeleton keeps its own tone. */
export function hue(seed: string | number): number {
  const s = String(seed)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
  return h
}
