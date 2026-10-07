import { useEffect, useRef } from 'react'

const reduced = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A single pointermove listener writes --mx/--my/--sh onto the .spot and .art
 * elements under the cursor (SpotlightCard + specular sheen).
 */
export function usePointerFx(): void {
  useEffect(() => {
    let raf = 0
    let last: PointerEvent | null = null
    let lit: HTMLElement | null = null

    const set = (el: HTMLElement, e: PointerEvent): void => {
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
      el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
    }

    const onMove = (e: PointerEvent): void => {
      last = e
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const ev = last
        if (!ev) return
        const t = ev.target as HTMLElement | null
        const spot = t?.closest?.('.spot') as HTMLElement | null
        if (spot) set(spot, ev)
        const art = t?.closest?.('.art') as HTMLElement | null
        if (lit && lit !== art) lit.style.setProperty('--sh', '0')
        if (art) {
          art.style.setProperty('--sh', '1')
          set(art, ev)
          lit = art
        } else lit = null
      })
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
}

/** Magnet — the element springs toward the cursor. */
export function useMagnet<T extends HTMLElement>(strength = 7): React.RefObject<T | null> {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || reduced()) return
    const move = (e: PointerEvent): void => {
      const r = el.getBoundingClientRect()
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2)
      el.style.transform = `translate(${(dx * strength).toFixed(2)}px, ${(dy * strength * 0.7).toFixed(2)}px)`
    }
    const out = (): void => {
      el.style.transform = ''
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', out)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', out)
    }
  }, [strength])
  return ref
}

/** TiltedCard — perspective tilt that follows the pointer. */
export function useTilt<T extends HTMLElement>(deg = 6): React.RefObject<T | null> {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || reduced()) return
    const move = (e: PointerEvent): void => {
      const r = el.getBoundingClientRect()
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2)
      el.style.transform = `perspective(900px) rotateY(${(dx * deg).toFixed(2)}deg) rotateX(${(-dy * deg * 0.82).toFixed(2)}deg) translateY(-5px) scale(1.012)`
    }
    const out = (): void => {
      el.style.transform = ''
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', out)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', out)
    }
  }, [deg])
  return ref
}
