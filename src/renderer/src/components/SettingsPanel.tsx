import { useState } from 'react'
import { useAsync } from '@/hooks/useAsync'
import { LANGUAGES, useLang, useT, type Key, type Lang, type Translate } from '@/i18n'
import type { AppConfig, ProviderStatus, UpdateInfo } from '@shared/types'

interface SettingsPanelProps {
  onRefresh: () => void
  /** Opens the setup screen again, for a changed or second provider. */
  onEditProvider: () => void
  onOpenInfo: (tab: 'about' | 'help' | 'privacy' | 'terms') => void
  onLanguage: (lang: Lang) => void
  /** Switches the daily release check, and with it the only call to GitHub. */
  onUpdateCheck: (on: boolean) => void
}

type Pane = 'provider' | 'language' | 'updates' | 'advanced' | 'about'

const NAV: { id: Pane; label: Key; icon: string; group: Key }[] = [
  { id: 'provider', label: 'set.nav.provider', icon: '◉', group: 'set.group.connection' },
  { id: 'language', label: 'set.nav.language', icon: '◍', group: 'set.group.app' },
  { id: 'updates', label: 'set.nav.updates', icon: '↻', group: 'set.group.app' },
  { id: 'advanced', label: 'set.nav.advanced', icon: '⚙', group: 'set.group.other' },
  { id: 'about', label: 'set.nav.about', icon: '?', group: 'set.group.other' }
]

const MASK = '••••••••••'
const UPDATE_HOST = 'api.github.com'

/** One line of a pane: what it is on the left, its value or control on the right. */
function Row({
  label,
  note,
  children
}: {
  label: string
  note?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-5 border-b border-white/5 py-[15px] last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold">{label}</div>
        {note ? <div className="mt-[3px] text-[12px] leading-snug text-tx3">{note}</div> : null}
      </div>
      {children}
    </div>
  )
}

function Value({ children, tone }: { children: React.ReactNode; tone?: 'ok' }): React.JSX.Element {
  return <span className={`mono shrink-0 text-right text-[13px] ${tone === 'ok' ? 'text-score' : 'text-tx2'}`}>{children}</span>
}

function Group({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="mono mt-7 border-t border-line pt-[18px] text-[9.5px] tracking-[0.16em] text-tx3">{children}</div>
  )
}

function Button({ onClick, children, disabled }: { onClick?: () => void; children: React.ReactNode; disabled?: boolean }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 rounded-[9px] border border-line bg-white/6 px-3.5 py-[7px] text-[12.5px] font-bold hover:border-acc/40 disabled:opacity-50"
    >
      {children}
    </button>
  )
}

/** Days between now and a timestamp, floored; negative once it has passed. */
function daysUntil(at: number): number {
  return Math.floor((at - Date.now()) / 86_400_000)
}

function ProviderPane({
  t,
  status,
  config,
  onRefresh,
  onEditProvider
}: {
  t: Translate
  status: ProviderStatus | null
  config: AppConfig | null
  onRefresh: () => void
  onEditProvider: () => void
}): React.JSX.Element {
  const ok = Boolean(status?.ok)
  const nf = new Intl.NumberFormat(t('locale'))
  const left = status?.user?.expiresAt != null ? daysUntil(status.user.expiresAt) : null

  return (
    <>
      <h3 className="text-[21px] font-extrabold">{t('set.nav.provider')}</h3>
      <p className="mt-[7px] max-w-[62ch] text-[13px] leading-relaxed text-tx3">{t('set.provider.lead')}</p>

      <div
        className={`mt-5 flex items-center gap-3.5 rounded-[12px] border p-4 ${
          ok ? 'border-score/30 bg-score/6' : 'border-live/35 bg-live/8'
        }`}
      >
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[14px] ${
            ok ? 'bg-score/16 text-score' : 'bg-live/16 text-live'
          }`}
          aria-hidden="true"
        >
          {ok ? '✓' : '!'}
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-bold">{ok ? t('set.provider.okTitle') : t('set.provider.badTitle')}</div>
          <div className="mt-[3px] text-[12.5px] leading-snug text-tx2">
            {ok
              ? status?.user?.expires
                ? t('set.provider.okNote', { date: status.user.expires })
                : t('set.provider.okNoDate')
              : (status?.message ?? t('toast.unreachable'))}
          </div>
        </div>
        <span className="ml-auto">
          <Button onClick={onRefresh}>{ok ? t('set.refreshList') : t('common.retry')}</Button>
        </span>
      </div>

      <div className="mt-2.5">
        <Row label={t('set.provider.validity')} note={t('set.provider.validityNote')}>
          <Value>
            {status?.user?.expires ?? t('set.unlimited')}
            {left != null && left > 0 ? ` · ${t('set.daysLeft', { n: left })}` : ''}
          </Value>
        </Row>
        <Row label={t('set.connections')} note={t('set.provider.connNote')}>
          <Value>
            {status?.user?.activeConnections ?? '0'} / {status?.user?.maxConnections ?? '—'}
          </Value>
        </Row>
        <Row label={t('set.liveChannels')}><Value>{nf.format(status?.counts?.live ?? 0)}</Value></Row>
        <Row label={t('set.vodCount')}><Value>{nf.format(status?.counts?.vod ?? 0)}</Value></Row>
        <Row label={t('set.seriesCount')}><Value>{nf.format(status?.counts?.series ?? 0)}</Value></Row>
      </div>

      <Group>{t('set.provider.addressGroup')}</Group>
      <div>
        {/* Masked rather than omitted: knowing a value is set is the useful part. */}
        <Row label={t('set.host')} note={t('set.provider.addressNote')}>
          <Value>{config?.xtream.host ? MASK : '—'}</Value>
        </Row>
        <Row label={t('set.user')}><Value>{config?.xtream.user ? MASK : '—'}</Value></Row>
        <Row label={t('set.provider.change')} note={t('set.provider.changeNote')}>
          <Button onClick={onEditProvider}>{t('set.open')}</Button>
        </Row>
      </div>
    </>
  )
}

function LanguagePane({
  t,
  lang,
  config,
  onLanguage
}: {
  t: Translate
  lang: Lang
  config: AppConfig | null
  onLanguage: (next: Lang) => void
}): React.JSX.Element {
  return (
    <>
      <h3 className="text-[21px] font-extrabold">{t('set.nav.language')}</h3>
      <p className="mt-[7px] max-w-[62ch] text-[13px] leading-relaxed text-tx3">{t('set.lang.lead')}</p>

      <div className="mt-[18px]">
        <Row label={t('set.lang.appLang')} note={t('set.lang.reloadNote')}>
          <div className="flex shrink-0 gap-1.5">
            {LANGUAGES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onLanguage(option.id)}
                aria-pressed={lang === option.id}
                className={`rounded-[9px] border px-3.5 py-[7px] text-[13px] font-bold transition-colors ${
                  lang === option.id ? 'border-acc/50 bg-acc/12 text-acc' : 'border-line text-tx2 hover:border-acc/40'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Row>
      </div>
      {/* The cost is measured, so it is said rather than discovered. */}
      <p className="mt-3.5 max-w-[60ch] text-[12.5px] leading-relaxed text-tx3">{t('set.lang.cost')}</p>

      <Group>{t('set.lang.artGroup')}</Group>
      <div>
        <Row label={t('set.language')} note={t('set.lang.tmdbNote')}><Value>{config?.tmdb.lang ?? '—'}</Value></Row>
        <Row label={t('set.region')} note={t('set.lang.regionNote')}><Value>{config?.tmdb.region ?? '—'}</Value></Row>
      </div>
    </>
  )
}

function UpdatesPane({
  t,
  config,
  onUpdateCheck
}: {
  t: Translate
  config: AppConfig | null
  onUpdateCheck: (on: boolean) => void
}): React.JSX.Element {
  const on = config?.updateCheck ?? true
  const version = config?.version ?? '—'
  const [probe, setProbe] = useState<{ state: 'idle' | 'busy' | 'done'; found: UpdateInfo | null }>({
    state: 'idle',
    found: null
  })

  const check = (): void => {
    setProbe({ state: 'busy', found: null })
    window.elembi.app
      .update()
      .then((found) => setProbe({ state: 'done', found }))
      .catch(() => setProbe({ state: 'done', found: null }))
  }

  const line = !on
    ? t('set.upd.off')
    : probe.found
      ? t('set.upd.found', { version: probe.found.version })
      : t('set.upd.latest')

  return (
    <>
      <h3 className="text-[21px] font-extrabold">{t('set.nav.updates')}</h3>
      <p className="mt-[7px] max-w-[62ch] text-[13px] leading-relaxed text-tx3">{t('set.upd.lead')}</p>

      <div className="mt-5 flex items-center gap-3.5 rounded-[12px] border border-line bg-white/3 p-4">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-acc/14 text-[14px] text-acc" aria-hidden="true">↻</span>
        <div className="min-w-0">
          <div className="text-[14px] font-bold">{t('set.upd.current', { version })}</div>
          <div className="mt-[3px] text-[12.5px] leading-snug text-tx2">{line}</div>
        </div>
        <span className="ml-auto">
          {probe.found ? (
            /* An anchor, not a button: the main process already sends outbound
               navigation to the system browser, so no new channel is needed. */
            <a
              href={probe.found.url}
              className="shrink-0 rounded-[9px] bg-acc px-3.5 py-[7px] text-[12.5px] font-bold text-ink"
            >
              {t('set.upd.download')}
            </a>
          ) : (
            <Button onClick={check} disabled={!on || probe.state === 'busy'}>
              {probe.state === 'busy' ? t('set.upd.checking') : t('set.upd.checkNow')}
            </Button>
          )}
        </span>
      </div>

      <div className="mt-2.5">
        <Row label={t('update.check')} note={t('set.upd.toggleNote')}>
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => onUpdateCheck(e.target.checked)}
            aria-label={t('update.check')}
            className="h-4 w-4 shrink-0 accent-[var(--color-acc)]"
          />
        </Row>
      </div>
      <p className="mt-3.5 max-w-[60ch] text-[12.5px] leading-relaxed text-tx3">
        {t('set.upd.privacy', { host: UPDATE_HOST })}
      </p>
    </>
  )
}

function AdvancedPane({
  t,
  config,
  status,
  onRefresh,
  onEditProvider
}: {
  t: Translate
  config: AppConfig | null
  status: ProviderStatus | null
  onRefresh: () => void
  onEditProvider: () => void
}): React.JSX.Element {
  const ffmpeg = useAsync<boolean>(() => window.elembi.media.available(), [])
  const nf = new Intl.NumberFormat(t('locale'))
  const titles = (status?.counts?.vod ?? 0) + (status?.counts?.series ?? 0) + (status?.counts?.live ?? 0)
  const hasKey = Boolean(config?.tmdb.hasToken)

  return (
    <>
      <h3 className="text-[21px] font-extrabold">{t('set.nav.advanced')}</h3>
      <p className="mt-[7px] max-w-[62ch] text-[13px] leading-relaxed text-tx3">{t('set.adv.lead')}</p>

      <Group>{t('set.adv.playback')}</Group>
      <div>
        <Row label="ffmpeg" note={t('set.adv.ffmpegNote')}>
          <Value tone={ffmpeg.data ? 'ok' : undefined}>
            {ffmpeg.loading ? '…' : ffmpeg.data ? t('set.adv.installed') : t('set.adv.notInstalled')}
          </Value>
        </Row>
        <Row label={t('set.output')} note={t('set.adv.outputNote')}><Value>{config?.xtream.output ?? '—'}</Value></Row>
      </div>

      <Group>{t('set.adv.artwork')}</Group>
      <p className="mt-3 max-w-[62ch] text-[12.5px] leading-relaxed text-tx3">{t('set.adv.artLead')}</p>

      {hasKey ? null : (
        <div className="mt-3.5 flex items-center gap-3.5 rounded-[12px] border border-gold/35 bg-gold/7 p-4">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold/16 text-[14px] text-gold" aria-hidden="true">!</span>
          <div className="min-w-0">
            <div className="text-[14px] font-bold">{t('set.adv.noKeyTitle')}</div>
            <div className="mt-[3px] text-[12.5px] leading-snug text-tx2">{t('set.adv.noKeyNote')}</div>
          </div>
        </div>
      )}

      <div className="mt-1">
        <Row label={t('set.key')} note={t('set.adv.keyNote')}>
          <Value tone={hasKey ? 'ok' : undefined}>{hasKey ? t('set.defined') : t('set.missing')}</Value>
        </Row>
        <Row label={t('set.adv.changeKey')} note={t('set.adv.changeKeyNote')}>
          <Button onClick={onEditProvider}>{t('set.open')}</Button>
        </Row>
      </div>

      <p className="mt-3.5 max-w-[62ch] text-[12.5px] leading-relaxed text-tx3">
        {t('set.adv.keyHow')}{' '}
        {/* An anchor, not a button: the main process already sends outbound
            navigation to the system browser, so no new channel is needed. */}
        <a href="https://www.themoviedb.org/settings/api" className="font-semibold text-acc underline-offset-2 hover:underline">
          {t('set.adv.getKey')}
        </a>
      </p>

      <Group>{t('set.adv.data')}</Group>
      <div>
        <Row label={t('set.adv.catalog')} note={t('set.adv.catalogNote', { n: nf.format(titles) })}>
          <Button onClick={onRefresh}>{t('set.refreshList')}</Button>
        </Row>
        <Row label={t('info.about.dataDir')} note={t('set.adv.dataDirNote')}>
          <Value>{config?.dataDir ?? '—'}</Value>
        </Row>
      </div>
    </>
  )
}

function AboutPane({
  t,
  config,
  onOpenInfo
}: {
  t: Translate
  config: AppConfig | null
  onOpenInfo: (tab: 'about' | 'help' | 'privacy' | 'terms') => void
}): React.JSX.Element {
  const links: { id: 'about' | 'help' | 'privacy' | 'terms'; label: Key }[] = [
    { id: 'about', label: 'info.about' },
    { id: 'help', label: 'info.help' },
    { id: 'privacy', label: 'info.privacy' },
    { id: 'terms', label: 'info.terms' }
  ]

  return (
    <>
      <h3 className="text-[21px] font-extrabold">{t('set.nav.about')}</h3>
      <p className="mt-[7px] max-w-[62ch] text-[13px] leading-relaxed text-tx3">{t('set.about.lead')}</p>

      <div className="mt-[18px]">
        <Row label={t('set.version')}><Value>{config?.version ?? '—'}</Value></Row>
        <Row label={t('info.about.runtime')}><Value>Electron 35 · React 19</Value></Row>
        <Row label={t('info.about.current')}><Value>{config?.platform ?? '—'}</Value></Row>
      </div>

      <div className="mt-4 flex flex-wrap gap-2.5">
        {links.map((link) => (
          <button
            key={link.id}
            type="button"
            onClick={() => onOpenInfo(link.id)}
            className="rounded-[9px] border border-line px-3.5 py-2 text-[13px] font-semibold text-tx2 hover:border-acc/40 hover:text-tx"
          >
            {t(link.label)}
          </button>
        ))}
      </div>

      <p className="mt-[22px] max-w-[64ch] border-t border-white/5 pt-4 text-[12px] leading-relaxed text-tx3">
        {t('info.about.credit')}
      </p>
    </>
  )
}

/**
 * Settings as two panes: the sections on the left, one section's detail on the
 * right. The flat version put twelve read-only technical fields in front of the
 * three things anyone actually changes; here those fields live in Advanced and
 * a new setting costs a row in its own pane rather than another screenful.
 */
export function SettingsPanel({
  onRefresh,
  onEditProvider,
  onOpenInfo,
  onLanguage,
  onUpdateCheck
}: SettingsPanelProps): React.JSX.Element {
  const t = useT()
  const lang = useLang()
  const [pane, setPane] = useState<Pane>('provider')
  const status = useAsync<ProviderStatus>(() => window.elembi.iptv.status(), [])
  const config = useAsync<AppConfig>(() => window.elembi.app.config(), [])
  const failed = !status.loading && !status.data?.ok

  return (
    <div className="shell px-[var(--pad)] py-8">
      <div className="overflow-hidden rounded-[16px] border border-line bg-ink2">
        <div className="grid min-h-[520px] md:grid-cols-[232px_1fr]">
          <nav className="flex flex-col border-b border-line bg-[#0a0b10] p-3 md:border-r md:border-b-0 md:p-5 md:px-3">
            <div className="hidden items-baseline gap-2.5 px-2.5 pb-[18px] md:flex">
              <b className="font-disp text-[16px] font-black tracking-[-0.03em]">ELEMBİ</b>
              <span className="mono text-[10.5px] text-tx3">{config.data?.version ?? ''}</span>
            </div>

            <div className="flex flex-wrap gap-1 md:block">
              {NAV.map((item, i) => (
                <div key={item.id} className="contents md:block">
                  {/* The group heading only when it changes, and only once the
                      rail is vertical; wrapped it would break the row. */}
                  {NAV[i - 1]?.group !== item.group ? (
                    <div className="mono hidden px-2.5 pt-3 pb-[7px] text-[9.5px] tracking-[0.16em] text-tx3 md:block">
                      {t(item.group)}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setPane(item.id)}
                    aria-current={pane === item.id}
                    className={`flex w-auto items-center gap-2.5 rounded-[9px] px-2.5 py-[9px] text-[13.5px] font-semibold md:w-full ${
                      pane === item.id ? 'bg-acc/11 text-acc' : 'text-tx2 hover:bg-white/5 hover:text-tx'
                    }`}
                  >
                    <span className="w-[17px] shrink-0 text-center text-[13px] opacity-85" aria-hidden="true">{item.icon}</span>
                    {t(item.label)}
                    {/* The lamp is why the rail is worth having: a failure is
                        visible without opening the pane it happened in. */}
                    {item.id === 'provider' && !status.loading ? (
                      <span
                        className={`ml-auto hidden h-[7px] w-[7px] shrink-0 rounded-full md:block ${
                          failed ? 'bg-live shadow-[0_0_8px_var(--color-live)]' : 'bg-score shadow-[0_0_8px_var(--color-score)]'
                        }`}
                      />
                    ) : null}
                  </button>
                </div>
              ))}
            </div>
          </nav>

          <div className="min-w-0 px-5 py-6 md:px-8 md:py-7">
            {status.loading && pane === 'provider' ? (
              <p className="mono text-[12px] text-acc">{t('set.connecting')}</p>
            ) : pane === 'provider' ? (
              <ProviderPane t={t} status={status.data} config={config.data} onRefresh={onRefresh} onEditProvider={onEditProvider} />
            ) : pane === 'language' ? (
              <LanguagePane t={t} lang={lang} config={config.data} onLanguage={onLanguage} />
            ) : pane === 'updates' ? (
              <UpdatesPane t={t} config={config.data} onUpdateCheck={onUpdateCheck} />
            ) : pane === 'advanced' ? (
              <AdvancedPane
                t={t}
                config={config.data}
                status={status.data}
                onRefresh={onRefresh}
                onEditProvider={onEditProvider}
              />
            ) : (
              <AboutPane t={t} config={config.data} onOpenInfo={onOpenInfo} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
