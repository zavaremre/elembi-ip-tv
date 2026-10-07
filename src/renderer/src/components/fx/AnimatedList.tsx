import { Children } from 'react'

interface AnimatedListProps {
  children: React.ReactNode
  stagger?: number
  className?: string
}

/** React Bits AnimatedList — staggered reveal, capped so long lists never feel slow. */
export function AnimatedList({ children, stagger = 40, className = '' }: AnimatedListProps): React.JSX.Element {
  return (
    <div className={`alist ${className}`}>
      {Children.map(children, (child, i) => (
        <div style={{ animationDelay: `${Math.min(i, 6) * stagger}ms` }}>{child}</div>
      ))}
    </div>
  )
}
