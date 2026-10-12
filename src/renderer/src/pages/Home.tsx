import { useMemo } from 'react'
import { ChannelCard } from '@/components/ChannelCard'
import { ChannelLogoLoop } from '@/components/ChannelLogoLoop'
import { ContinueCard } from '@/components/ContinueCard'
import { GenreTile } from '@/components/GenreTile'
import { Hero } from '@/components/Hero'
import { MatchCard } from '@/components/MatchCard'
import { MiniEpg } from '@/components/MiniEpg'
import { PersonCard } from '@/components/PersonCard'
import { PlatformCard } from '@/components/PlatformCard'
import { PosterCard } from '@/components/PosterCard'
import { Row } from '@/components/Row'
import { ShowcaseCard } from '@/components/ShowcaseCard'
import { useAudioVariants } from '@/hooks/useAudioVariants'
import { useProviderPosters } from '@/hooks/useProviderPosters'
import { dur } from '@/lib/fmt'
import { buildPlatforms } from '@/lib/platforms'
import { poster } from '@/lib/img'
import type { HomeData } from '@/hooks/useHomeData'
import type { Reminders } from '@/hooks/useReminders'
import type { Channel, Genre, Match, Progress, TmdbItem, VodItem } from '@shared/types'

/** Where a row's "see all" control should land. */
export type SeeAllTarget =
  | 'popular-movies'
  | 'popular-series'
  | 'sports'
  | 'live'
  | 'provider-movies'
  | 'provider-series'
  | 'genres'

interface HomeProps {
  data: HomeData
  reminders: Reminders
  progress: Progress[]
  onOpenTmdb: (item: TmdbItem) => void
  onPlayChannel: (channel: Channel) => void
  onPlayVod: (item: VodItem) => void
  onPlayProgress: (item: Progress) => void
  onPlayMatch: (match: Match) => void
  onOpenGenre: (genre: Genre) => void
  onOpenCollection: (id: string) => void
  onOpenPlatform: (name: string, categories: string[]) => void
  onOpenPerson: (person: { id: number; name: string }) => void
  onSeeAll: (target: SeeAllTarget) => void
}

const PROVIDER_RAIL_COUNT = 18

/** The home screen: one hero plus the rails, in the order the design calls for. */
export function Home({
  data,
  reminders,
  progress,
  onOpenTmdb,
  onPlayChannel,
  onPlayVod,
  onPlayProgress,
  onPlayMatch,
  onOpenGenre,
  onOpenCollection,
  onOpenPlatform,
  onOpenPerson,
  onSeeAll
}: HomeProps): React.JSX.Element {
  /*
   * Read from the catalogue rather than from a list of platform names: these are
   * the provider's own series categories, so one it adds — or renames — appears
   * without a code change. Largest first, since that is roughly how interesting
   * they are, and singletons are left out as noise.
   */
  const platforms = useMemo(
    () => buildPlatforms(data.providerSeries.data ?? [], data.watchProviders.data ?? [], data.channels.data ?? []),
    [data.providerSeries.data, data.watchProviders.data, data.channels.data]
  )

  const railVod = (data.vod.data ?? []).slice(0, PROVIDER_RAIL_COUNT)
  const railSeries = (data.providerSeries.data ?? []).slice(0, PROVIDER_RAIL_COUNT)
  const audioVariants = useAudioVariants(railVod)
  const tmdbPosters = useProviderPosters([...railVod, ...railSeries])
  /* Nothing until the lookup answers: showing the provider cover first and
     swapping to the TMDB poster afterwards reads as a glitch. */
  const artworkFor = (key: string, cover: string | null): string | null =>
    poster(tmdbPosters.paths.get(key)) ?? (tmdbPosters.resolved.has(key) ? cover : null)

  return (
    <>
      <Hero items={data.hero.data ?? []} loading={data.hero.loading} onPlay={onOpenTmdb} onOpen={onOpenTmdb} />

      <main className="shell relative z-4 -mt-10 pb-24">

        {platforms.length > 0 ? (
          <Row title="Platformlar" meta={`${platforms.length} KATEGORİ`} tagline="Sağlayıcıda ne varsa">
            {platforms.map((entry) => (
              <PlatformCard
                key={entry.key}
                name={entry.name}
                count={entry.count}
                logo={entry.logo}
                categories={entry.categories}
                onClick={() => onOpenPlatform(entry.name, entry.categories)}
              />
            ))}
          </Row>
        ) : null}

        <Row
          title="Popüler Filmler"
          meta={data.movies.data ? `SAĞLAYICIDA ${data.movies.data.length}` : undefined}
          loading={data.movies.loading || data.vod.loading}
          error={data.movies.error}
          empty={data.movies.data?.length === 0 ? 'Bu haftanın popüler filmlerinden sağlayıcı listende olan yok.' : undefined}
          action="Tümünü gör"
          onAction={() => onSeeAll('popular-movies')}
        >
          {(data.movies.data ?? []).map((item) => (
            <PosterCard
              key={item.id}
              title={item.title}
              image={poster(item.poster)}
             
              rating={item.rating}
              meta={[item.year, dur(item.runtime)].filter(Boolean).join(' · ')}
              onOpen={() => onOpenTmdb(item)}
            />
          ))}
        </Row>

        <Row
          title="Popüler Diziler"
          meta={data.series.data ? `SAĞLAYICIDA ${data.series.data.length}` : undefined}
          tagline="TMDB popülerlik sırasına göre"

          loading={data.series.loading || data.providerSeries.loading}
          error={data.series.error}
          empty={data.series.data?.length === 0 ? 'Popüler dizilerden sağlayıcı listende olan yok.' : undefined}
          action="Tümünü gör"
          onAction={() => onSeeAll('popular-series')}
        >
          {(data.series.data ?? []).map((item) => (
            <PosterCard
              key={item.id}
              title={item.title}
              image={poster(item.poster)}
             
              rating={item.rating}
              meta={item.year}
              onOpen={() => onOpenTmdb(item)}
            />
          ))}
        </Row>

        {(data.people.data ?? []).length > 0 ? (
          <Row
            title="Haftanın Oyuncuları"
            tagline="Bu hafta öne çıkan yapımlardan"
            loading={data.people.loading}
          >
            {(data.people.data ?? []).map((person) => (
              <PersonCard
                key={person.id}
                id={person.id}
                name={person.name}
                profile={person.profile}
                /* Why they are on the list, which is more use than a job title. */
                note={person.titles[0]?.title}
                onOpen={() => onOpenPerson({ id: person.id, name: person.name })}
              />
            ))}
          </Row>
        ) : null}

        <Row
          title="Bugünkü Maçlar"
          meta="SAĞLAYICI EPG"
          loading={data.matches.loading}
          error={data.matches.error}
          empty={data.matches.data?.length === 0 ? 'Bugün için spor kanallarının yayın akışında karşılaşma bulunamadı' : undefined}
          action="Tümünü gör"
          onAction={() => onSeeAll('sports')}
        >
          {(data.matches.data ?? []).map((match) => (
            <MatchCard
              key={`${match.channelId}-${match.start}`}
              match={match}
              reminded={reminders.has(match)}
              badges={data.teamBadges}
              onPlay={() => onPlayMatch(match)}
              onRemind={() => reminders.toggle(match)}
            />
          ))}
        </Row>

        <Row
          title="Şimdi Canlı"
          meta={data.channels.data ? `${data.channels.data.length} KANAL` : undefined}
          loading={data.channels.loading}
          error={data.channels.error}
          skeleton="still"
          action="Tümünü gör"
          onAction={() => onSeeAll('live')}
        >
          {data.featured.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              guide={data.guide.get(channel.id) ?? null}
              onPlay={() => onPlayChannel(channel)}
            />
          ))}
        </Row>

        {data.channels.data && data.channels.data.length > 0 ? (
          <section className="mb-7 lg:mb-10">
            <div className="flex items-center gap-3 px-[var(--pad)] pb-3.5">
              <h2 className="text-[19px] font-extrabold lg:text-[25px]">Kanal Şeridi</h2>
              <span className="mono pt-1 text-[11px] tracking-[0.08em] text-tx3">ÜZERİNE GELİNCE DURUR</span>
              <button
                type="button"
                onClick={() => onSeeAll('live')}
                className="ml-auto flex items-center gap-1.5 text-[13px] font-bold text-tx3 hover:text-acc"
              >
                Tümünü gör
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
            </div>
            <ChannelLogoLoop channels={data.featured} onPlay={onPlayChannel} />
          </section>
        ) : null}

        {progress.length > 0 ? (
          <Row title="İzlemeye Devam Et" tagline="Kaldığın yerden" skeleton="still">
            {progress.map((item) => (
              <ContinueCard key={item.key} item={item} onPlay={() => onPlayProgress(item)} />
            ))}
          </Row>
        ) : null}

        {data.guideRows.length > 0 ? (
          <section className="mb-7 lg:mb-10">
            <div className="flex items-center gap-3 px-[var(--pad)] pb-3.5">
              <h2 className="text-[19px] font-extrabold lg:text-[25px]">Bu Akşam Kılavuzda</h2>
              <span className="mono pt-1 text-[11px] tracking-[0.08em] text-tx3">EPG</span>
              <button
                type="button"
                onClick={() => onSeeAll('live')}
                className="ml-auto flex items-center gap-1.5 text-[13px] font-bold text-tx3 hover:text-acc"
              >
                Tümünü gör
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
            </div>
            <MiniEpg rows={data.guideRows} onPlay={onPlayChannel} />
          </section>
        ) : null}

        {data.collections.length > 0 ? (
          <Row title="Koleksiyonlar" tagline="Gerçek TMDB listelerinden derlendi">
            {data.collections.map((collection) => (
              <ShowcaseCard key={collection.id} collection={collection} onOpen={() => onOpenCollection(collection.id)} />
            ))}
          </Row>
        ) : null}

        <Row
          title="Sağlayıcı Filmleri"
          meta={data.vod.data ? `${data.vod.data.length} BAŞLIK` : undefined}
          loading={data.vod.loading}
          error={data.vod.error}
          action="Tümünü gör"
          onAction={() => onSeeAll('provider-movies')}
        >
          {railVod.map((item) => (
            <PosterCard
              key={item.id}
              title={item.name}
              image={artworkFor(`vod-${item.id}`, item.cover)}
             
              rating={item.rating}
              meta={item.group}
              audio={item.audio ?? audioVariants.get(item.id) ?? null}
              onOpen={() => onPlayVod(item)}
            />
          ))}
        </Row>

        <Row
          title="Sağlayıcı Dizileri"
          meta={data.providerSeries.data ? `${data.providerSeries.data.length} DİZİ` : undefined}
          loading={data.providerSeries.loading}
          error={data.providerSeries.error}
          action="Tümünü gör"
          onAction={() => onSeeAll('provider-series')}
        >
          {railSeries.map((item) => (
            <PosterCard
              key={item.id}
              title={item.name}
              image={artworkFor(`series-${item.id}`, item.cover)}
             
              rating={item.rating}
              meta={item.group}
              audio={item.audio}
              onOpen={() => onPlayVod(item)}
            />
          ))}
        </Row>

        <Row
          title="Türlere Göre"
          meta="TMDB"
          loading={data.genres.loading}
          error={data.genres.error}
          action="Tümünü gör"
          onAction={() => onSeeAll('genres')}
        >
          {(data.genres.data ?? []).filter((genre) => genre.kind === 'movie').slice(0, 12).map((genre) => (
            <GenreTile key={`${genre.kind}-${genre.id}`} genre={genre} onOpen={() => onOpenGenre(genre)} />
          ))}
        </Row>
      </main>
    </>
  )
}
