import { clock } from '@/lib/fmt'
import { useT } from '@/i18n'
import type { Channel, EpgEntry } from '@shared/types'

export interface GuideRow {
  channel: Channel
  entries: EpgEntry[]
}

interface MiniEpgProps {
  rows: GuideRow[]
  onPlay: (channel: Channel) => void
}

const WINDOW_BEFORE_MS = 30 * 60_000
const WINDOW_MS = 3.5 * 3600_000

/** Tonight's guide strip: a real time axis with the now marker, not a list of names. */
export function MiniEpg({ rows, onPlay }: MiniEpgProps): React.JSX.Element {
  const t = useT()
  const now = Date.now()
  const start = now - WINDOW_BEFORE_MS
  const pct = (ms: number): number => ((ms - start) / WINDOW_MS) * 100

  return (
    <div className="mx-[var(--pad)] overflow-hidden rounded-[22px] border border-line bg-surf/62 backdrop-blur-[22px] backdrop-saturate-[1.4]">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
        <b className="font-disp text-[15px] font-extrabold">{t('card.guide')}</b>
        <span className="mono ml-auto flex items-center gap-1.5 text-[12.5px] text-live">
          <i className="pulse" />
          {clock(now)}
        </span>
      </div>

      <div className="flex">
        <div className="w-[clamp(120px,13vw,172px)] shrink-0 border-r border-line">
          {rows.map((row) => (
            <button
              key={row.channel.id}
              type="button"
              onClick={() => onPlay(row.channel)}
              className="flex h-[52px] w-full items-center gap-2 border-b border-white/5 px-3.5 text-left text-[13px] font-bold last:border-b-0 hover:bg-white/4"
            >
              <i className="pulse text-score" />
              <span className="truncate">{row.channel.name}</span>
            </button>
          ))}
        </div>

        <div className="relative flex-1 overflow-hidden">
          <span className="absolute inset-y-0 z-4 w-[2px] bg-live shadow-[0_0_12px_var(--color-live)]" style={{ left: `${pct(now)}%` }}>
            <span className="absolute -left-1 top-0 h-2.5 w-2.5 rounded-full bg-live" />
          </span>
          {rows.map((row) => (
            <div key={row.channel.id} className="relative h-[52px] border-b border-white/5 last:border-b-0">
              {row.entries
                .filter((e) => e.stop > start && e.start < start + WINDOW_MS)
                .map((entry) => {
                  const live = entry.start <= now && entry.stop > now
                  const leftPct = Math.max(0, pct(entry.start))
                  const widthPct = Math.min(100 - leftPct, pct(entry.stop) - Math.max(0, pct(entry.start)))
                  return (
                    <span
                      key={`${row.channel.id}-${entry.start}`}
                      className={`absolute top-1.5 bottom-1.5 overflow-hidden rounded-[8px] px-2.5 py-1.5 ${
                        live ? 'bg-acc/14 ring-1 ring-acc/50 ring-inset' : 'bg-white/6'
                      }`}
                      style={{ left: `${leftPct}%`, width: `calc(${widthPct}% - 4px)` }}
                    >
                      <b className={`block truncate text-[12.5px] font-semibold ${live ? 'text-acc' : ''}`}>{entry.title}</b>
                      <s className="mono block text-[10.5px] text-tx3 no-underline">
                        {clock(entry.start)} – {clock(entry.stop)}
                      </s>
                    </span>
                  )
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
