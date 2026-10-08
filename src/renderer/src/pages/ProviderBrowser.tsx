import { ChannelCard } from '@/components/ChannelCard'
import { PosterCard } from '@/components/PosterCard'
import { ProviderFilterBar } from '@/components/ProviderFilterBar'
import { useAudioVariants } from '@/hooks/useAudioVariants'
import { useProviderPosters } from '@/hooks/useProviderPosters'
import { useLogoColors } from '@/hooks/useLogoColors'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { useProviderFilter, type ProviderSort } from '@/hooks/useProviderFilter'
import { poster } from '@/lib/img'
import type { Channel, NowNext, VodItem } from '@shared/types'

type Dataset =
  | { kind: 'channels'; items: Channel[] }
  | { kind: 'vod'; items: VodItem[] }
  | { kind: 'series'; items: VodItem[] }

interface ProviderBrowserProps {
  title: string
  dataset: Dataset
  loading: boolean
  error: string | null
  guide: Map<number, NowNext>
  onPlayChannel: (channel: Channel) => void
  onPlayVod: (item: VodItem) => void
  /** Opens scoped to a platform's categories, as the platform cards do. */
  categories?: string[]
}

const CHANNEL_SORTS: { value: ProviderSort; label: string }[] = [
  { value: 'number', label: 'Kanal numarası' },
  { value: 'name', label: 'Ada göre' }
]

const VOD_SORTS: { value: ProviderSort; label: string }[] = [
  { value: 'newest', label: 'Yeni eklenen' },
  { value: 'rating', label: 'Puan' },
  { value: 'name', label: 'Ada göre' }
]

/** Only VodItem carries a `kind`, which makes it the discriminant. */
/* A stable empty array, so the scope memo does not see a new one each render. */
const EMPTY_SCOPE: string[] = []

const isVod = (entry: Channel | VodItem): entry is VodItem => 'kind' in entry
const isChannel = (entry: Channel | VodItem): entry is Channel => !('kind' in entry)

/** Browse the provider catalogue by country and category: live TV, movies, series. */
export function ProviderBrowser({
  title,
  dataset,
  loading,
  error,
  guide,
  onPlayChannel,
  onPlayVod,
  categories
}: ProviderBrowserProps): React.JSX.Element {
  const isChannels = dataset.kind === 'channels'
  const filter = useProviderFilter<Channel | VodItem>(
    dataset.items,
    isChannels ? 'number' : 'newest',
    categories ?? EMPTY_SCOPE
  )
  const visibleVod = filter.visible.filter(isVod)
  const audioVariants = useAudioVariants(visibleVod)
  const tmdbPosters = useProviderPosters(visibleVod)
  const logoColors = useLogoColors(filter.visible.filter(isChannel).map((channel) => channel.logo))
  /* Nothing until the lookup answers, so the card never swaps artwork. */
  const artworkFor = (key: string, cover: string | null): string | null =>
    poster(tmdbPosters.paths.get(key)) ?? (tmdbPosters.resolved.has(key) ? cover : null)
  const hasMore = filter.visible.length < filter.total
  const sentinelRef = useInfiniteScroll({ onMore: filter.showMore, enabled: hasMore && !loading })

  return (
    <main className="shell px-[var(--pad)] pt-6 pb-24">
      <div className="flex items-center gap-3 pb-4">
        <h1 className="text-[clamp(26px,3.4vw,38px)] font-extrabold">{title}</h1>
        <span className="mono pt-2 text-[11px] tracking-[0.1em] text-tx3">{dataset.items.length} KAYIT</span>
      </div>

      <ProviderFilterBar
        countries={filter.countries}
        categories={filter.categories}
        country={filter.country}
        category={filter.category}
        query={filter.query}
        sort={filter.sort}
        sorts={isChannels ? CHANNEL_SORTS : VOD_SORTS}
        shown={filter.visible.length}
        total={filter.total}
        searchLabel={isChannels ? 'Kanal ara' : 'Başlık ara'}
        onCountry={filter.setCountry}
        onCategory={filter.setCategory}
        onQuery={filter.setQuery}
        onSort={filter.setSort}
        onReset={filter.reset}
      />

      {error ? (
        <p className="mt-6 text-[13px] text-live">{error}</p>
      ) : loading ? (
        <p className="mono mt-6 text-[12px] tracking-[0.12em] text-acc uppercase">yükleniyor…</p>
      ) : filter.total === 0 ? (
        <p className="mt-6 text-[14px] text-tx3">Bu filtrelerle kayıt yok.</p>
      ) : (
        <>
          <div
            className={`mt-6 grid gap-4 lg:gap-5 ${
              isChannels ? 'grid-cols-[repeat(auto-fill,minmax(240px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(136px,1fr))]'
            }`}
          >
            {dataset.kind === 'channels'
              ? filter.visible.filter(isChannel).map((channel) => (
                  <ChannelCard
                    key={channel.id}
                    channel={channel}
                    guide={guide.get(channel.id) ?? null}
                    layout="grid"
                    color={channel.logo ? (logoColors.get(channel.logo) ?? null) : null}
                    onPlay={() => onPlayChannel(channel)}
                  />
                ))
              : visibleVod.map((item) => (
                  <PosterCard
                    key={`${item.kind}-${item.id}`}
                    title={item.name}
                    image={artworkFor(`${item.kind}-${item.id}`, item.cover)}
                    hueSeed={`${item.kind}-${item.id}`}
                    rating={item.rating}
                    meta={item.group}
                    audio={item.audio ?? audioVariants.get(item.id) ?? null}
                    layout="grid"
                    onOpen={() => onPlayVod(item)}
                  />
                ))}
          </div>

          <div ref={sentinelRef} className="h-px" aria-hidden="true" />
          <p className="mono mt-6 text-center text-[11px] text-tx3">
            {hasMore ? `${filter.total - filter.visible.length} kayıt daha yükleniyor…` : 'listenin sonu'}
          </p>
        </>
      )}
    </main>
  )
}
