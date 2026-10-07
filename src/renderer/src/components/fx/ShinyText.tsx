interface ShinyTextProps {
  children: React.ReactNode
  className?: string
}

/** React Bits ShinyText — metallic sweep, reserved for quality badges. */
export function ShinyText({ children, className = '' }: ShinyTextProps): React.JSX.Element {
  return <span className={`shiny ${className}`}>{children}</span>
}
