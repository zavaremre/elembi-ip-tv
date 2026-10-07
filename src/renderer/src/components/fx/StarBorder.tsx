interface StarBorderProps {
  children: React.ReactNode
  className?: string
}

/** React Bits StarBorder — one editorial accent per screen, nothing more. */
export function StarBorder({ children, className = '' }: StarBorderProps): React.JSX.Element {
  return <span className={`starb ${className}`}>{children}</span>
}
