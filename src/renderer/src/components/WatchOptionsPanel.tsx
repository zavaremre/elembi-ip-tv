import { poster } from '@/lib/img'
import type { WatchOptions, WatchProvider } from '@shared/types'

interface WatchOptionsPanelProps {
  watch: WatchOptions
  title: string
  onManualSearch: () => void
}

const GROUPS: { key: keyof Omit<WatchOptions, 'link'>; label: string }[] = [
  { key: 'flatrate', label: 'Abonelikte' },
  { key: 'free', label: 'Ücretsiz' },
  { key: 'rent', label: 'Kiralama' },
  { key: 'buy', label: 'Satın alma' }
]

function Provider({ provider }: { provider: WatchProvider }): React.JSX.Element {
  return (
    <span className="flex items-center gap-2 rounded-[9px] border border-line bg-white/6 py-1 pr-2.5 pl-1">
      {poster(provider.logo, 'w185') ? (
        <img src={poster(provider.logo, 'w185') ?? ''} alt="" className="h-6 w-6 rounded-[6px] object-cover" loading="lazy" />
      ) : null}
      <span className="text-[12.5px] font-semibold text-tx2">{provider.name}</span>
    </span>
  )
}

/** Shown when the provider catalogue has no copy: where the title can be watched legally. */
export function WatchOptionsPanel({ watch, title, onManualSearch }: WatchOptionsPanelProps): React.JSX.Element {
  const groups = GROUPS.filter((group) => watch[group.key].length > 0)

  return (
    <div className="mt-4 rounded-[14px] border border-line bg-surf/55 p-4">
      <div className="mono text-[10px] tracking-[0.12em] text-tx3 uppercase">Nerede izlenir</div>

      {groups.length === 0 ? (
        <p className="mt-2 text-[13px] text-tx2">
          Bu başlık için Türkiye’de yasal bir yayın seçeneği listelenmiyor. Sağlayıcı listende farklı bir adla duruyor
          olabilir.
        </p>
      ) : (
        <div className="mt-2.5 flex flex-col gap-2.5">
          {groups.map((group) => (
            <div key={group.key} className="flex flex-wrap items-center gap-2">
              <span className="mono w-[86px] shrink-0 text-[10.5px] text-tx3">{group.label}</span>
              {watch[group.key].map((provider) => (
                <Provider key={`${group.key}-${provider.id}`} provider={provider} />
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onManualSearch}
          className="flex h-9 items-center gap-2 rounded-[10px] border border-line bg-white/8 px-3.5 text-[12.5px] font-bold hover:border-acc/45"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M16.5 16.5 21 21" />
          </svg>
          Sağlayıcıda elle ara
        </button>
        {watch.link ? (
          <a
            href={watch.link}
            target="_blank"
            rel="noreferrer"
            className="flex h-9 items-center rounded-[10px] border border-line bg-white/8 px-3.5 text-[12.5px] font-bold hover:border-acc/45"
          >
            TMDB’de tüm seçenekler
          </a>
        ) : null}
        <span className="mono text-[10.5px] text-tx3">{title}</span>
      </div>
    </div>
  )
}
