import { subtitleTrackLabel } from '@/lib/fmt'
import { useT } from '@/i18n'
import type { PlayerEngine } from '@/hooks/usePlayerEngine'
import type { AudioDelay } from '@/hooks/useAudioDelay'
import type { SubtitleStyleState } from '@/hooks/useSubtitleStyle'
import type { SubtitleState } from '@/hooks/useSubtitles'

interface PlayerAudioMenuProps {
  engine: PlayerEngine
  subs: SubtitleState
  audioDelay: AudioDelay
  subtitleStyle: SubtitleStyleState
  onExternal: () => void
  externalPlayer: string
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="border-b border-line py-2 last:border-b-0">
      <div className="mono px-3 pb-1.5 text-[9.5px] tracking-[0.14em] text-tx3 uppercase">{title}</div>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1">
      <span className="mono w-14 shrink-0 text-[10.5px] text-tx3">{label}</span>
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[6px] px-1.5 py-0.5 text-[11px] font-semibold ${active ? 'bg-acc text-ink' : 'bg-white/10 text-tx2 hover:text-tx'}`}
    >
      {label}
    </button>
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
      <span className="truncate">{label}</span>
    </button>
  )
}

/** Audio and subtitle picking, one click from the control bar. */
export function PlayerAudioMenu({
  engine,
  subs,
  audioDelay,
  subtitleStyle,
  onExternal,
  externalPlayer
}: PlayerAudioMenuProps): React.JSX.Element {
  const t = useT()
  return (
    <div className="absolute right-0 bottom-12 z-20 max-h-[56vh] w-[268px] overflow-y-auto rounded-[14px] border border-white/14 bg-ink2/95 shadow-[0_26px_60px_-20px_rgba(0,0,0,.9)] backdrop-blur-[20px]">
      <Section title={engine.mode === 'remux' ? t('audio.local') : t('audio.title')}>
        {engine.audioTracks.length > 1 ? (
          engine.audioTracks.map((track) => (
            <Option key={track.id} label={track.label} active={engine.audioTrack === track.id} onClick={() => engine.setAudioTrack(track.id)} />
          ))
        ) : engine.mode === 'hls' ? (
          <div className="px-3 py-1.5 text-[11.5px] leading-snug text-tx3">{t('audio.singleStream')}</div>
        ) : (
          <>
            <div className="px-3 py-1.5 text-[11.5px] leading-snug text-tx3">{t('audio.single')}</div>
            <Option label={t('player.openExternal', { player: externalPlayer })} active={false} onClick={onExternal} />
          </>
        )}
        {!audioDelay.available ? (
          <div className="mt-1 border-t border-line px-3 pt-2 text-[10.5px] leading-snug text-tx3">
            {t('audio.delayUnavailable')}
          </div>
        ) : (
          <>
        <div className="mt-1 flex items-center gap-1.5 border-t border-line px-3 pt-2">
          <span className="mono text-[11px] text-tx3">gecikme</span>
          <button type="button" onClick={() => audioDelay.nudge(-50)} className="rounded-[6px] bg-white/10 px-2 text-[12px] font-bold">
            −
          </button>
          <span className="mono w-16 text-center text-[11.5px]">{audioDelay.ms} ms</span>
          <button type="button" onClick={() => audioDelay.nudge(50)} className="rounded-[6px] bg-white/10 px-2 text-[12px] font-bold">
            +
          </button>
          {audioDelay.ms > 0 ? (
            <button type="button" onClick={audioDelay.reset} className="mono ml-auto text-[10.5px] text-acc">
              {t('style.reset')}
            </button>
          ) : null}
        </div>
        <div className="px-3 pt-1 pb-1 text-[10.5px] leading-snug text-tx3">
          {t('audio.delayNote')}
        </div>
          </>
        )}
      </Section>

      <Section title={t('audio.subtitle')}>
        {/*
          * Offered first: these come out of the file and travel inside the
          * stream, so the player times them against the picture itself. Nothing
          * to adjust, and nothing to download.
          */}
        {engine.embedded.length > 0 ? (
          <>
            <div className="px-3 pb-1 text-[10.5px] leading-snug text-score">
              {t('audio.embedded')}
            </div>
            <Option
              label={t('audio.off')}
              active={engine.embeddedTrack === null}
              onClick={() => engine.setEmbeddedTrack(null)}
            />
            {engine.embedded.map((track) => (
              <Option
                key={track.order}
                label={(() => {
                  const label = subtitleTrackLabel(track)
                  return label.key ? t(label.key) : label.fallback || t('track.subtitleLabel')
                })()}
                active={engine.embeddedTrack === track.order}
                onClick={() => engine.setEmbeddedTrack(track.order)}
              />
            ))}
            {engine.embedded.length > 1 ? (
              <div className="px-3 pt-0.5 pb-1 text-[10px] leading-snug text-tx3">
                {t('audio.switchNote')}
              </div>
            ) : null}
            <div className="mt-1 mb-1 border-t border-line" />
          </>
        ) : null}

        {engine.subtitleTracks.length > 0 ? (
          <>
            <Option label={t('audio.subtitleOff')} active={engine.subtitleTrack === -1} onClick={() => engine.setSubtitleTrack(-1)} />
            {engine.subtitleTracks.map((track) => (
              <Option
                key={track.id}
                label={track.label}
                active={engine.subtitleTrack === track.id}
                onClick={() => engine.setSubtitleTrack(track.id)}
              />
            ))}
          </>
        ) : null}

        {subs.active ? (
          <>
            <div className="truncate px-3 py-1 text-[12px] text-acc">{subs.active}</div>
            <div className="flex items-center gap-1 px-3 py-1.5">
                <span className="mono mr-1 text-[11px] text-tx3">gecikme</span>
                <Chip active={false} onClick={() => subs.nudgeDelay(-1)} label="−1" />
                <Chip active={false} onClick={() => subs.nudgeDelay(-0.25)} label="−¼" />
                <span className="mono w-16 text-center text-[11.5px]">{subs.delay.toFixed(2)} sn</span>
                <Chip active={false} onClick={() => subs.nudgeDelay(0.25)} label="+¼" />
              <Chip active={false} onClick={() => subs.nudgeDelay(1)} label="+1" />
            </div>
            {subs.remembered ? (
              <div className="px-3 pb-1 text-[10.5px] leading-snug text-tx3">
                {t('audio.syncRemembered')}
              </div>
            ) : null}
            {subs.delay !== 0 ? (
              <Option label={t('audio.syncReset')} active={false} onClick={subs.resetSync} />
            ) : null}
            <Option label={t('audio.subtitleRemove')} active={false} onClick={subs.clear} />
          </>
        ) : null}

        <Option label={subs.busy ? t('audio.working') : t('audio.subtitleLoad')} active={false} onClick={subs.loadLocal} />

        {subs.error ? <div className="px-3 py-1.5 text-[11.5px] leading-snug text-live">{subs.error}</div> : null}
      </Section>

      <Section title={t('audio.subtitleStyle')}>
        <Row label="Boyut">
          {[0.75, 1, 1.25, 1.5, 2].map((scale) => (
            <Chip
              key={scale}
              active={subtitleStyle.style.scale === scale}
              onClick={() => subtitleStyle.set({ scale })}
              label={`${Math.round(scale * 100)}%`}
            />
          ))}
        </Row>
        <Row label="Renk">
          {['#ffffff', '#ffe14d', '#9fe8ff', '#b7ff9f'].map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => subtitleStyle.set({ color })}
              aria-label={`Renk ${color}`}
              className={`h-5 w-5 rounded-full border ${subtitleStyle.style.color === color ? 'border-acc' : 'border-white/25'}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </Row>
        <Row label="Zemin">
          {[0, 0.35, 0.55, 0.85].map((background) => (
            <Chip
              key={background}
              active={subtitleStyle.style.background === background}
              onClick={() => subtitleStyle.set({ background })}
              label={background === 0 ? 'yok' : `${Math.round(background * 100)}%`}
            />
          ))}
        </Row>
        <Row label="Kenar">
          {(['shadow', 'outline', 'none'] as const).map((edge) => (
            <Chip
              key={edge}
              active={subtitleStyle.style.edge === edge}
              onClick={() => subtitleStyle.set({ edge })}
              label={edge === 'shadow' ? t('style.shadow') : edge === 'outline' ? t('style.outline') : t('style.flat')}
            />
          ))}
        </Row>
        <Row label="Konum">
          <Chip active={false} onClick={() => subtitleStyle.set({ bottom: Math.max(2, subtitleStyle.style.bottom - 3) })} label={t('style.down')} />
          <span className="mono w-10 text-center text-[11px]">{subtitleStyle.style.bottom}%</span>
          <Chip active={false} onClick={() => subtitleStyle.set({ bottom: Math.min(45, subtitleStyle.style.bottom + 3) })} label={t('style.up')} />
        </Row>
        <Option label={t('audio.styleReset')} active={false} onClick={subtitleStyle.reset} />
      </Section>
    </div>
  )
}
