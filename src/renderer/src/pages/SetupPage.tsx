import { useState } from 'react'
import { WindowControls } from '@/components/WindowControls'
import { NoiseOverlay } from '@/components/fx/NoiseOverlay'
import { isComplete, parseXtreamUrl } from '@shared/xtreamUrl'
import type { ProviderStatus } from '@shared/types'

interface SetupPageProps {
  /** Filled in when the panel is being changed rather than entered first time. */
  initial: { host: string; user: string; output: string; hasToken: boolean }
  onSaved: () => void
  onCancel?: () => void
}

type Probe = { state: 'idle' } | { state: 'testing' } | { state: 'done'; status: ProviderStatus }

function Label({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="mono mb-1.5 text-[10px] tracking-[0.12em] text-tx3 uppercase">{children}</div>
}

const INPUT =
  'h-11 w-full rounded-[11px] border border-line bg-ink/70 px-3.5 text-[13.5px] outline-none placeholder:text-tx3/70 focus:border-acc/60'

/**
 * First run, and the way back in when a subscription changes.
 *
 * The pasted link does the work: panels hand out a different address depending
 * on which button you press, and all of them carry the same three facts, so any
 * is accepted and the fields fill themselves. Nothing is saved until the panel
 * has actually answered — a subscription that cannot connect is not worth
 * keeping, and the reason is more useful here than on an empty home screen.
 */
export function SetupPage({ initial, onSaved, onCancel }: SetupPageProps): React.JSX.Element {
  const [link, setLink] = useState('')
  const [manual, setManual] = useState(false)
  const [host, setHost] = useState(initial.host)
  const [user, setUser] = useState(initial.user)
  const [pass, setPass] = useState('')
  const [token, setToken] = useState('')
  const [probe, setProbe] = useState<Probe>({ state: 'idle' })
  const [linkError, setLinkError] = useState<string | null>(null)

  /* Either the link alone or the three fields, never both as a requirement. */
  const ready = manual ? isComplete({ host, user, pass }) : link.trim().length > 0

  /* Shown next to the link so a mistyped address is obvious before connecting. */
  const peek = manual ? null : parseXtreamUrl(link)

  const test = async (): Promise<void> => {
    setProbe({ state: 'testing' })
    setLinkError(null)

    let found = { host, user, pass }
    if (!manual) {
      /*
       * Resolved in the main process: a link may carry nothing itself and have
       * to be fetched, and the playlist behind it runs to megabytes.
       */
      const result = await window.elembi.app
        .resolveLink(link.trim())
        .catch(() => ({ credentials: null, error: 'Bağlantı çözümlenemedi.' }))
      if (!result.credentials) {
        setLinkError(result.error ?? 'Bağlantı çözümlenemedi.')
        setProbe({ state: 'idle' })
        return
      }
      found = result.credentials
      setHost(found.host)
      setUser(found.user)
      setPass(found.pass)
    }

    const patch: Record<string, string> = {
      XTREAM_HOST: found.host,
      XTREAM_USER: found.user,
      XTREAM_PASS: found.pass
    }
    if (token.trim()) patch.TMDB_TOKEN = token.trim()
    await window.elembi.app.setConfig(patch).catch(() => false)
    const status = await window.elembi.iptv
      .status()
      .catch((e: unknown) => ({ ok: false, message: e instanceof Error ? e.message : 'Bağlanılamadı' }))
    setProbe({ state: 'done', status })
  }

  const connected = probe.state === 'done' && probe.status.ok

  return (
    <main className="relative min-h-dvh">
      {/*
        * This screen is the whole window on a first run, and the window has no
        * system frame — without this band it could be neither moved nor closed.
        */}
      <div className="drag fixed inset-x-0 top-0 z-50 flex h-[52px] items-center justify-end px-4">
        <WindowControls />
      </div>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <span
          className="absolute -top-40 -right-32 h-[520px] w-[520px] rounded-full opacity-25 blur-[120px]"
          style={{ background: 'radial-gradient(circle, var(--color-acc), transparent 70%)' }}
        />
        <NoiseOverlay />
      </div>

      <div className="relative mx-auto flex max-w-[560px] flex-col px-[var(--pad)] pt-[88px] pb-20">
        <h1 className="text-[clamp(26px,3.6vw,38px)] leading-[1.05] font-black tracking-[-0.03em]">
          Aboneliğini bağla
        </h1>
        <p className="mt-2.5 text-[14px] leading-[1.6] text-tx2">
          Sağlayıcının verdiği bağlantı adresini yapıştır, gerisini kendisi bulur. M3U, Xtream API ya
          da EPG adresi — hangisi elindeyse olur.
        </p>

        {manual ? (
          <div className="mt-7 grid gap-4 rounded-[14px] border border-line bg-surf/50 p-4">
            <div>
              <Label>Sunucu</Label>
              <input className={INPUT} value={host} onChange={(e) => setHost(e.target.value)} placeholder="http://sunucu:8080" spellCheck={false} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kullanıcı adı</Label>
                <input className={INPUT} value={user} onChange={(e) => setUser(e.target.value)} spellCheck={false} autoComplete="off" />
              </div>
              <div>
                <Label>Şifre</Label>
                <input className={INPUT} value={pass} onChange={(e) => setPass(e.target.value)} spellCheck={false} autoComplete="off" />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-7">
            <Label>Bağlantı adresi</Label>
            <input
              className={INPUT}
              value={link}
              onChange={(e) => {
                setLink(e.target.value)
                setLinkError(null)
                setProbe({ state: 'idle' })
              }}
              placeholder="http://sunucu:8080/get.php?username=…&password=…"
              spellCheck={false}
              autoComplete="off"
            />
            {peek?.host && !linkError ? (
              <p className="mono mt-1.5 text-[11.5px] text-tx3">sunucu: {peek.host}</p>
            ) : null}
            {linkError ? <p className="mt-1.5 text-[12.5px] leading-snug text-live">{linkError}</p> : null}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setManual(!manual)
            setLinkError(null)
            setProbe({ state: 'idle' })
          }}
          className="mt-3 self-start text-[12.5px] font-semibold text-tx3 hover:text-tx"
        >
          {manual ? 'Bağlantı adresi yapıştır' : 'Sunucu ve kullanıcı bilgilerini elle gir'}
        </button>

        <div className="mt-5">
          <Label>TMDB okuma anahtarı {initial.hasToken ? '· tanımlı' : '· gerekli'}</Label>
          <input
            className={INPUT}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={initial.hasToken ? 'Değiştirmek için yeni anahtar' : 'eyJhbGciOiJIUzI1NiJ9…'}
            spellCheck={false}
            autoComplete="off"
          />
          <p className="mt-1.5 text-[12px] leading-snug text-tx3">
            Afişler, özetler ve platform logoları TMDB'den geliyor. Anahtar olmadan katalog çalışır ama
            görseller gelmez.{' '}
            {/* An anchor, not a button: the main process already sends outbound
                navigation to the system browser, so no new channel is needed. */}
            <a
              href="https://www.themoviedb.org/settings/api"
              className="text-acc underline-offset-2 hover:underline"
            >
              Ücretsiz anahtar al
            </a>
          </p>
        </div>

        {probe.state === 'done' ? (
          <div
            className={`mt-6 rounded-[14px] border p-4 ${
              probe.status.ok ? 'border-score/40 bg-score/10' : 'border-live/40 bg-live/10'
            }`}
          >
            <div className="text-[13.5px] font-bold">
              {probe.status.ok ? 'Bağlantı kuruldu' : 'Bağlanamadı'}
            </div>
            <div className="mt-1 text-[12.5px] leading-snug text-tx2">{probe.status.message}</div>
            {probe.status.counts ? (
              <div className="mono mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-tx3">
                <span>{probe.status.counts.live} kanal</span>
                <span>{probe.status.counts.vod} film</span>
                <span>{probe.status.counts.series} dizi</span>
                {probe.status.user?.expires ? <span>bitiş {probe.status.user.expires}</span> : null}
                {probe.status.user ? (
                  <span>
                    bağlantı {probe.status.user.activeConnections}/{probe.status.user.maxConnections}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-7 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void test()}
            disabled={!ready || probe.state === 'testing'}
            className="flex h-11 items-center rounded-[12px] border border-line bg-white/10 px-5 text-[13.5px] font-bold disabled:opacity-40"
          >
            {probe.state === 'testing' ? 'Deneniyor…' : 'Bağlantıyı dene'}
          </button>
          <button
            type="button"
            onClick={onSaved}
            disabled={!connected}
            className="spec flex h-11 items-center rounded-[12px] bg-tx px-5 text-[14px] font-bold text-ink disabled:opacity-40"
          >
            Başla
          </button>
          {onCancel ? (
            <button type="button" onClick={onCancel} className="ml-auto text-[13px] font-semibold text-tx3 hover:text-tx">
              Vazgeç
            </button>
          ) : null}
        </div>

        {!ready ? (
          <p className="mt-3 text-[12px] text-tx3">
            {manual ? 'Sunucu, kullanıcı adı ve şifre gerekiyor.' : 'Sağlayıcının verdiği bağlantı adresini yapıştır.'}
          </p>
        ) : null}
      </div>
    </main>
  )
}
