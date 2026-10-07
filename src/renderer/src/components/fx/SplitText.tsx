interface SplitTextProps {
  text: string
  className?: string
  stagger?: number
  /** Changing this restarts the entrance animation. */
  runKey?: string | number
}

/** React Bits SplitText — staggered per-character entrance, used only on the hero title. */
export function SplitText({ text, className = '', stagger = 26, runKey }: SplitTextProps): React.JSX.Element {
  let index = 0
  const lines = text.split('\n')

  return (
    <span key={runKey} className={`split ${className}`}>
      {lines.map((line, li) => (
        <span key={`${runKey}-l${li}`} className="block">
          {line.split(' ').map((word, wi) => (
            <span key={`${runKey}-l${li}w${wi}`} className="wd">
              {[...word].map((char, ci) => {
                const delay = Math.min(index++, 22) * stagger
                return (
                  <span key={`${runKey}-l${li}w${wi}c${ci}`} className="ch" style={{ animationDelay: `${delay}ms` }}>
                    {char}
                  </span>
                )
              })}
              {wi < line.split(' ').length - 1 ? ' ' : null}
            </span>
          ))}
        </span>
      ))}
    </span>
  )
}
