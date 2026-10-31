import { useState } from 'react'
import { NoiseOverlay } from '@/components/fx/NoiseOverlay'
import { useT, type Translate } from '@/i18n'

export type InfoTab = 'about' | 'help' | 'privacy' | 'terms'

interface InfoPageProps {
  tab: InfoTab
  onTab: (tab: InfoTab) => void
  onBack: () => void
  /** Read from the running process, since all three differ per build. */
  version: string
  dataDir: string
  platform: string
}

const TABS: { id: InfoTab; label: 'info.tab.about' | 'info.tab.help' | 'info.tab.privacy' | 'info.tab.terms' }[] = [
  { id: 'about', label: 'info.tab.about' },
  { id: 'help', label: 'info.tab.help' },
  { id: 'privacy', label: 'info.tab.privacy' },
  { id: 'terms', label: 'info.tab.terms' }
]

function H({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <h2 className="mt-8 mb-2.5 text-[17px] font-extrabold tracking-[-0.01em] first:mt-0">{children}</h2>
}

function P({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="mb-3 text-[14px] leading-[1.68] text-tx2">{children}</p>
}

function Code({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <code className="mono rounded-[5px] bg-white/8 px-1.5 py-0.5 text-[12.5px] text-tx">{children}</code>
}

function Rows({ items }: { items: [string, string][] }): React.JSX.Element {
  return (
    <dl className="mb-3 overflow-hidden rounded-[12px] border border-line">
      {items.map(([key, value]) => (
        <div key={key} className="flex gap-4 border-b border-white/5 px-3.5 py-2.5 last:border-b-0">
          <dt className="mono w-[182px] shrink-0 text-[11.5px] text-tx3">{key}</dt>
          <dd className="text-[13px] leading-snug text-tx2">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Keys({ items }: { items: [string, string][] }): React.JSX.Element {
  return (
    <div className="mb-3 grid gap-1.5 sm:grid-cols-2">
      {items.map(([key, what]) => (
        <div key={key} className="flex items-center gap-3 rounded-[10px] border border-line px-3 py-2">
          <span className="mono shrink-0 rounded-[6px] border border-line bg-white/8 px-2 py-0.5 text-[11.5px]">{key}</span>
          <span className="text-[12.5px] text-tx2">{what}</span>
        </div>
      ))}
    </div>
  )
}

/* Named per platform: the install command is the one thing that differs. */
const FFMPEG_HINT: Record<string, string> = {
  darwin: 'brew install ffmpeg',
  win32: 'winget install ffmpeg',
  linux: 'apt install ffmpeg'
}

/*
 * Paragraphs that wrap a literal — a path, a port, a shell command — are kept
 * in the dictionary as the pieces around it, since the literal itself is not
 * translated and has to stay inside a <Code> rather than a string.
 */
function About({ version, dataDir, platform, t }: { version: string; dataDir: string; platform: string; t: Translate }): React.JSX.Element {
  return (
    <>
      <H>{t('info.about.whatH')}</H>
      <P>{t('info.about.whatP')}</P>
      <H>{t('info.about.howH')}</H>
      <P>
        {t('info.about.howP1')}
        <Code>ffmpeg</Code>
        {t('info.about.howP2')}
        <Code>127.0.0.1</Code>
        {t('info.about.howP3')}
      </P>
      <H>{t('info.about.techH')}</H>
      <Rows
        items={[
          [t('info.about.version'), version],
          [t('info.about.runtime'), 'Electron 35 · React 19 · TypeScript'],
          [t('info.about.needs'), t('info.about.needsValue')],
          [t('info.about.platforms'), t('info.about.platformsValue')],
          [t('info.about.current'), platform],
          [t('info.about.dataDir'), dataDir]
        ]}
      />
      <P>{t('info.about.credit')}</P>
    </>
  )
}

function Help({ platform, t }: { platform: string; t: Translate }): React.JSX.Element {
  return (
    <>
      <H>{t('info.help.setupH')}</H>
      <P>{t('info.help.setupP1')}</P>
      <P>{t('info.help.setupP2')}</P>
      <H>{t('info.help.ffmpegH')}</H>
      <P>
        {t('info.help.ffmpegP1')}
        <Code>{FFMPEG_HINT[platform] ?? 'ffmpeg'}</Code>
        {t('info.help.ffmpegP2')}
      </P>
      <H>{t('info.help.commonH')}</H>
      <Rows
        items={[
          [t('info.help.q1'), t('info.help.a1')],
          [t('info.help.q2'), t('info.help.a2')],
          [t('info.help.q3'), t('info.help.a3')],
          [t('info.help.q4'), t('info.help.a4')],
          [t('info.help.q5'), t('info.help.a5')]
        ]}
      />
      <H>{t('info.help.keysH')}</H>
      <Keys
        items={[
          [t('info.help.key.space'), t('info.help.key.spaceWhat')],
          ['← / →', t('info.help.key.seek5')],
          ['J / L', t('info.help.key.seek10')],
          ['↑ / ↓', t('info.help.key.vol')],
          ['M', t('info.help.key.mute')],
          ['F', t('info.help.key.fullscreen')],
          ['I', t('info.help.key.mini')],
          ['Esc', t('info.help.key.esc')]
        ]}
      />
    </>
  )
}

function Privacy({ dataDir, t }: { dataDir: string; t: Translate }): React.JSX.Element {
  return (
    <>
      <H>{t('info.privacy.summaryH')}</H>
      <P>{t('info.privacy.summaryP')}</P>
      <H>{t('info.privacy.storedH')}</H>
      <P>
        {t('info.privacy.storedP1')}
        <Code>{dataDir}</Code>
        {t('info.privacy.storedP2')}
      </P>
      <Rows
        items={[
          ['config.json', t('info.privacy.file.config')],
          ['state.json', t('info.privacy.file.state')],
          ['catalog-*.json', t('info.privacy.file.catalog')],
          ['artwork.json · logo-colors.json', t('info.privacy.file.artwork')],
          ['vod-audio.json', t('info.privacy.file.audio')],
          ['team-badges.json', t('info.privacy.file.badges')],
          ['xmltv-cache.json', t('info.privacy.file.epg')]
        ]}
      />
      <P>{t('info.privacy.plainP')}</P>
      <H>{t('info.privacy.leavesH')}</H>
      <Rows
        items={[
          [t('info.privacy.providerKey'), t('info.privacy.providerValue')],
          ['api.themoviedb.org', t('info.privacy.tmdbValue')],
          ['image.tmdb.org', t('info.privacy.imagesValue')],
          ['www.thesportsdb.com', t('info.privacy.sportsValue')],
          ['api.github.com', t('info.privacy.githubValue')]
        ]}
      />
      <P>
        {t('info.privacy.localP1')}
        <Code>127.0.0.1</Code>
        {t('info.privacy.localP2')}
      </P>
      <H>{t('info.privacy.thirdH')}</H>
      <P>{t('info.privacy.thirdP')}</P>
    </>
  )
}

function Terms({ t }: { t: Translate }): React.JSX.Element {
  return (
    <>
      <H>{t('info.terms.scopeH')}</H>
      <P>{t('info.terms.scopeP')}</P>
      <H>{t('info.terms.liabilityH')}</H>
      <P>{t('info.terms.liabilityP')}</P>
      <H>{t('info.terms.warrantyH')}</H>
      <P>{t('info.terms.warrantyP')}</P>
      <H>{t('info.terms.thirdH')}</H>
      <P>{t('info.terms.thirdP')}</P>
      <H>{t('info.terms.sourceH')}</H>
      <P>{t('info.terms.sourceP')}</P>
    </>
  )
}

/** About, help, privacy and terms; reached from Settings rather than the header. */
export function InfoPage({ tab, onTab, onBack, version, dataDir, platform }: InfoPageProps): React.JSX.Element {
  const t = useT()
  const [hovered, setHovered] = useState<InfoTab | null>(null)

  return (
    <main className="relative pb-24">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <NoiseOverlay />
      </div>

      {/*
        * The menu sits at the top, right under the window's title band, so the
        * four pages read as one tabbed screen rather than four destinations.
        * The back control shares the row to keep it off its own line.
        */}
      <div className="sticky top-[66px] z-10 border-b border-line bg-ink/80 backdrop-blur-[18px]">
        <div className="mx-auto flex max-w-[760px] flex-wrap items-center gap-x-3 gap-y-2 px-[var(--pad)] py-3">
          <button
            type="button"
            onClick={onBack}
            aria-label={t('info.back')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-line text-tx3 hover:border-acc/40 hover:text-tx"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>

          <nav className="flex flex-wrap gap-1.5" aria-label={t('info.nav')}>
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onTab(item.id)}
                onPointerEnter={() => setHovered(item.id)}
                onPointerLeave={() => setHovered(null)}
                aria-current={item.id === tab}
                className={`rounded-[10px] border px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                  item.id === tab
                    ? 'border-acc bg-acc/15 text-acc'
                    : `border-line text-tx2 ${hovered === item.id ? 'bg-white/8 text-tx' : ''}`
                }`}
              >
                {t(item.label)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="relative mx-auto max-w-[760px] px-[var(--pad)] pt-7">
        <h1 className="text-[clamp(22px,3vw,30px)] leading-[1.1] font-black tracking-[-0.03em]">
          {t(TABS.find((item) => item.id === tab)?.label ?? 'info.tab.about')}
        </h1>

        <article className="mt-6">
          {tab === 'about' ? (
            <About version={version} dataDir={dataDir} platform={platform} t={t} />
          ) : tab === 'help' ? (
            <Help platform={platform} t={t} />
          ) : tab === 'privacy' ? (
            <Privacy dataDir={dataDir} t={t} />
          ) : (
            <Terms t={t} />
          )}
        </article>
      </div>
    </main>
  )
}
