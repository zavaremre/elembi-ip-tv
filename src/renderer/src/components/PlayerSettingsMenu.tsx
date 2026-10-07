import type { PlayerEngine } from '@/hooks/usePlayerEngine'

interface PlayerSettingsMenuProps {
  engine: PlayerEngine
  speed: number
  onSpeed: (value: number) => void
  isLive: boolean
  showStats: boolean
  onShowStats: (value: boolean) => void
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="border-b border-line py-2 last:border-b-0">
      <div className="mono px-3 pb-1.5 text-[9.5px] tracking-[0.14em] text-tx3 uppercase">{title}</div>
      {children}
    </div>
  )
}

function Option({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] ${active ? 'text-acc' : 'text-tx2 hover:text-tx'}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-acc' : 'bg-transparent'}`} />
      {label}
    </button>
  )
}

/** Quality, speed, audio and subtitle options, read from the live stream. */
export function PlayerSettingsMenu({
  engine,
  speed,
  onSpeed,
  isLive,
  showStats,
  onShowStats
}: PlayerSettingsMenuProps): React.JSX.Element {
  return (
    <div className="absolute right-0 bottom-12 z-10 w-[232px] overflow-hidden rounded-[14px] border border-white/14 bg-ink2/95 shadow-[0_26px_60px_-20px_rgba(0,0,0,.9)] backdrop-blur-[20px]">
      {engine.levels.length > 1 ? (
        <Section title="Kalite">
          <Option label="Otomatik" active={engine.currentLevel === -1} onClick={() => engine.setLevel(-1)} />
          {[...engine.levels]
            .sort((a, b) => b.height - a.height)
            .map((level) => (
              <Option
                key={level.index}
                label={`${level.height || '?'}p · ${Math.round(level.bitrate / 1000)} kbps`}
                active={engine.currentLevel === level.index}
                onClick={() => engine.setLevel(level.index)}
              />
            ))}
        </Section>
      ) : null}

      {!isLive ? (
        <Section title="Hız">
          <div className="flex flex-wrap gap-1 px-3 pb-1">
            {SPEEDS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onSpeed(value)}
                className={`rounded-[7px] px-2 py-1 text-[12px] font-semibold ${speed === value ? 'bg-acc text-ink' : 'bg-white/8 text-tx2 hover:text-tx'}`}
              >
                {value}×
              </button>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Teknik">
        <Option label={showStats ? 'Teknik bilgileri gizle' : 'Teknik bilgileri göster'} active={showStats} onClick={() => onShowStats(!showStats)} />
      </Section>
    </div>
  )
}
