import { useAsync } from '@/hooks/useAsync'
import type { AppConfig, ProviderStatus } from '@shared/types'

interface SettingsPanelProps {
  onRefresh: () => void
  /** Opens the setup screen again, for a changed or second subscription. */
  onEditProvider: () => void
  onOpenInfo: (tab: 'about' | 'help' | 'privacy' | 'terms') => void
}

function Field({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="border-b border-white/5 py-2.5 last:border-b-0">
      <div className="mono text-[10px] tracking-[0.12em] text-tx3 uppercase">{label}</div>
      <div className="mono mt-1 text-[13px]">{value}</div>
    </div>
  )
}

/** Provider and TMDB status, read from the main process. Credentials stay in .env. */
export function SettingsPanel({ onRefresh, onEditProvider, onOpenInfo }: SettingsPanelProps): React.JSX.Element {
  const status = useAsync<ProviderStatus>(() => window.akis.iptv.status(), [])
  const config = useAsync<AppConfig>(() => window.akis.app.config(), [])

  return (
    <div className="shell px-[var(--pad)] py-8">
      <h2 className="text-[28px] font-extrabold">Ayarlar</h2>
      <p className="mt-2 max-w-[60ch] text-[14px] text-tx2">
        Kimlik bilgileri <code className="mono rounded-[5px] bg-acc/12 px-1.5 text-acc">.env</code> dosyasından okunuyor ve
        hiçbir zaman arayüz paketine girmiyor. Tüm istekler ana süreçte yapılır.
      </p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <section className="rounded-[18px] border border-line bg-surf p-5">
          <h3 className="mono flex items-center gap-2 text-[11px] tracking-[0.12em] text-tx3 uppercase">
            Sağlayıcı
            <span className={`h-2 w-2 rounded-full ${status.data?.ok ? 'bg-score' : 'bg-live'}`} />
          </h3>
          {status.loading ? (
            <p className="mono mt-3 text-[12px] text-acc">bağlanıyor…</p>
          ) : status.data?.ok ? (
            <div className="mt-2">
              <Field label="Durum" value={status.data.user?.status ?? '—'} />
              <Field label="Bitiş" value={status.data.user?.expires ?? 'süresiz'} />
              <Field label="Bağlantı" value={`${status.data.user?.activeConnections ?? '0'} / ${status.data.user?.maxConnections ?? '—'}`} />
              <Field label="Canlı kanal" value={String(status.data.counts?.live ?? 0)} />
              <Field label="Film (VOD)" value={String(status.data.counts?.vod ?? 0)} />
              <Field label="Dizi" value={String(status.data.counts?.series ?? 0)} />
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-live">{status.data?.message ?? status.error}</p>
          )}
        </section>

        <section className="rounded-[18px] border border-line bg-surf p-5">
          <h3 className="mono text-[11px] tracking-[0.12em] text-tx3 uppercase">TMDB</h3>
          <div className="mt-2">
            <Field label="Anahtar" value={config.data?.tmdb.hasToken ? 'tanımlı' : 'eksik'} />
            <Field label="Dil" value={config.data?.tmdb.lang ?? '—'} />
            <Field label="Bölge" value={config.data?.tmdb.region ?? '—'} />
            <Field label="Sunucu" value={config.data?.xtream.host ?? '—'} />
            <Field label="Kullanıcı" value={config.data?.xtream.user ?? '—'} />
            <Field label="Çıkış biçimi" value={config.data?.xtream.output ?? '—'} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={onEditProvider}
              className="rounded-[10px] border border-line bg-white/8 px-4 py-2 text-[13px] font-bold hover:border-acc/40"
            >
              Aboneliği değiştir
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-5 text-[13px] font-semibold text-tx3">
            {(
              [
                ['about', 'Hakkında'],
                ['help', 'Yardım'],
                ['privacy', 'Gizlilik politikası'],
                ['terms', 'Şartlar ve koşullar']
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" onClick={() => onOpenInfo(id)} className="hover:text-tx">
                {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={onRefresh} className="mt-4 rounded-[10px] border border-line bg-white/8 px-4 py-2 text-[13px] font-bold hover:border-acc/40">
            Listeyi yenile
          </button>
        </section>
      </div>
    </div>
  )
}
