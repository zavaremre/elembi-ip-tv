import { useCallback, useState } from 'react'

export interface SubtitleStyle {
  /** Multiplier applied to the base cue size. */
  scale: number
  color: string
  background: number
  edge: 'shadow' | 'outline' | 'none'
  /** Distance from the bottom of the video, in percent of its height. */
  bottom: number
}

export const SUBTITLE_DEFAULTS: SubtitleStyle = {
  scale: 1,
  color: '#ffffff',
  background: 0.55,
  edge: 'shadow',
  bottom: 12
}

const STORAGE_KEY = 'akis.subtitleStyle'

function load(): SubtitleStyle {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? { ...SUBTITLE_DEFAULTS, ...(JSON.parse(raw) as Partial<SubtitleStyle>) } : SUBTITLE_DEFAULTS
  } catch {
    return SUBTITLE_DEFAULTS
  }
}

export interface SubtitleStyleState {
  style: SubtitleStyle
  set: (patch: Partial<SubtitleStyle>) => void
  reset: () => void
}

/** Appearance of the subtitle overlay, kept across sessions. */
export function useSubtitleStyle(): SubtitleStyleState {
  const [style, setStyle] = useState<SubtitleStyle>(load)

  const persist = useCallback((next: SubtitleStyle): void => {
    setStyle(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* a full storage must not break playback */
    }
  }, [])

  return {
    style,
    set: (patch) => persist({ ...style, ...patch }),
    reset: () => persist(SUBTITLE_DEFAULTS)
  }
}
