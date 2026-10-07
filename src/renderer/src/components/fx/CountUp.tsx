import { useEffect, useRef, useState } from 'react'

interface CountUpProps {
  to: number
  duration?: number
  className?: string
}

/** React Bits CountUp — makes a changing number visible, used for scores and totals. */
export function CountUp({ to, duration = 900, className = '' }: CountUpProps): React.JSX.Element {
  const [value, setValue] = useState(0)
  const from = useRef(0)

  useEffect(() => {
    const start = from.current
    const delta = to - start
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || duration === 0) {
      from.current = to
      setValue(to)
      return
    }
    let raf = 0
    let t0 = 0
    const step = (t: number): void => {
      if (!t0) t0 = t
      const k = Math.min((t - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - k, 3)
      setValue(Math.round(start + delta * eased))
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = to
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to, duration])

  return <span className={`mono ${className}`}>{value}</span>
}
