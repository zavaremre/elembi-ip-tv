import { useMemo } from 'react'
import { useT } from '@/i18n'
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
import { favoriteKey, type Favorites } from '@/hooks/useFavorites'
import { addedLabel, recentlyAdded } from '@/lib/fresh'
import { buildPlatforms } from '@/lib/platforms'
import { poster } from '@/lib/img'
import type { HomeData } from '@/hooks/useHomeData'
import type { Reminders } from '@/hooks/useReminders'
import type { Channel, Favorite, Genre, Match, Progress, TmdbItem, VodItem } from '@shared/types'

/** Where a row's "see all" control should land. */
export type SeeAllTarget =
  | 'popular-movies'
  | 'popular-series'
  | 'sports'
  | 'live'
  | 'provider-movies'
  | 'provider-series'
  | 'genres'
  | 'favorites'

interface HomeProps {
  data: HomeData
  reminders: Reminders
  favorites: Favorites
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
  onOpenFavorite: (row: Favorite) => void
  onSeeAll: (target: SeeAllTarget) => void
}

const PROVIDER_RAIL_COUNT = 18

/** The home screen: one hero plus the rails, in the order the design calls for. */
export function Home({
  data,
  reminders,
  favorites,
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
  onOpenFavorite,
  onSeeAll
}: HomeProps): React.JSX.Element {
  const t = useT()
  /*
   * Read from the catalogue rather than from a list of platform names: these are
   * the provider's own series categories, so one it adds — or renames — appears
   * without a code change. Largest first, since that is roughly how interesting
   * they are, and singletons are left out as noise.
   */
  const platforms = useMemo(
    () => buildPlatforms(data.providerSeries.data ?? [], data.watchProviders.data ?? [], data.channels.data ?? [], t),
    [data.providerSeries.data, data.watchProviders.data, data.channels.data, t]
  )

  const railVod = (data.vod.data ?? []).slice(0, PROVIDER_RAIL_COUNT)
  const railSeries = (data.providerSeries.data ?? []).slice(0, PROVIDER_RAIL_COUNT)
  /* What the subscription gained lately, films and series in one row. */
  const fresh = useMemo(
    () => recentlyAdded(data.vod.data ?? [], data.providerSeries.data ?? []),
    [data.vod.data, data.providerSeries.data]
  )
  const audioVariants = useAudioVariants(railVod)
  const tmdbPosters = useProviderPosters([...fresh, ...railVod, ...railSeries])
  /* Nothing until the lookup answers: showing the provider cover first and
     swapping to the TMDB poster afterwards reads as a glitch. */
  /* One place to turn either kind of item into the heart's two props. */
  const favOf = (kind: Favorite['kind'], id: number, title: string, image: string | null) => ({
    favorite: favorites.has(favoriteKey(kind, id)),
    onToggleFavorite: () => favorites.toggle({ kind, id, title, image })
  })

  const artworkFor = (key: string, cover: string | null): string | null =>
    poster(tmdbPosters.paths.get(key)) ?? (tmdbPosters.resolved.has(key) ? cover : null)

  return (
    <>
      <Hero items={data.hero.data ?? []} loading={data.hero.loading} onOpen={onOpenTmdb} />

      <main className="shell relative z-4 -mt-10 pb-24">

        {platforms.length > 0 ? (
          <Row title={t('home.platforms')} meta={t('home.platforms.meta', { n: platforms.length })} tagline={t('home.platforms.tagline')}>
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

        {favorites.rows.length > 0 ? (
          <Row
            title={t('fav.title')}
            meta={t('common.count.titles', { n: favorites.rows.length })}
            tagline={t('fav.tagline')}
            action={t('common.seeAll')}
            onAction={() => onSeeAll('favorites')}
          >
            {favorites.rows.slice(0, 18).map((row) => (
              <PosterCard
                key={row.key}
                title={row.title}
                image={row.image}
                favorite
                onToggleFavorite={() => favorites.toggle(row)}
                onOpen={() => onOpenFavorite(row)}
              />
            ))}
          </Row>
        ) : null}

        {/* Hidden rather than shown near-empty: a catalogue that gained nothing
            has nothing to say here. */}
        {fresh.length >= 4 ? (
          <Row title={t('home.fresh')} meta={t('home.fresh.provider')} tagline={t('home.fresh.tagline')}>
            {fresh.map((item) => (
              <PosterCard
                key={`${item.kind}-${item.id}`}
                title={item.name}
                image={artworkFor(`${item.kind === 'series' ? 'series' : 'vod'}-${item.id}`, item.cover)}
                rating={item.rating}
                meta={(() => {
                  const label = addedLabel(item.added)
                  return label ? t(label.key, { n: label.days }) : null
                })()}
                audio={item.audio}
                flag={item.kind === 'series' ? { text: t('row.badge.series'), tone: 'new' } : undefined}
                {...favOf(item.kind === 'series' ? 'series' : 'vod', item.id, item.name, artworkFor(`${item.kind === 'series' ? 'series' : 'vod'}-${item.id}`, item.cover))}
                onOpen={() => onPlayVod(item)}
              />
            ))}
          </Row>
        ) : null}

        <Row
          title={t('row.popularMovies')}
          meta={data.movies.data ? t('detail.inProvider', { n: data.movies.data.length }) : undefined}
          loading={data.movies.loading || data.vod.loading}
          error={data.movies.error}
          empty={data.movies.data?.length === 0 ? t('row.empty.movies') : undefined}
          action={t('common.seeAll')}
          onAction={() => onSeeAll('popular-movies')}
        >
          {(data.movies.data ?? []).map((item) => (
            <PosterCard
              key={item.id}
              title={item.title}
              image={poster(item.poster)}
              rating={item.rating}
              meta={[item.year, dur(item.runtime, t)].filter(Boolean).join(' · ')}
              {...favOf(item.kind === 'tv' ? 'tmdb-tv' : 'tmdb-movie', item.id, item.title, poster(item.poster))}
              onOpen={() => onOpenTmdb(item)}
            />
          ))}
        </Row>

        <Row
          title={t('row.popularSeries')}
          meta={data.series.data ? t('detail.inProvider', { n: data.series.data.length }) : undefined}
          tagline={t('row.tagline.popular')}

          loading={data.series.loading || data.providerSeries.loading}
          error={data.series.error}
          empty={data.series.data?.length === 0 ? t('row.empty.series') : undefined}
          action={t('common.seeAll')}
          onAction={() => onSeeAll('popular-series')}
        >
          {(data.series.data ?? []).map((item) => (
            <PosterCard
              key={item.id}
              title={item.title}
              image={poster(item.poster)}
              rating={item.rating}
              meta={item.year}
              {...favOf(item.kind === 'tv' ? 'tmdb-tv' : 'tmdb-movie', item.id, item.title, poster(item.poster))}
              onOpen={() => onOpenTmdb(item)}
            />
          ))}
        </Row>

        {(data.people.data ?? []).length > 0 ? (
          <Row
            title={t('row.people')}
            tagline={t('row.tagline.week')}
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
          title={t('row.matches')}
          meta={t('row.meta.epg')}
          loading={data.matches.loading}
          error={data.matches.error}
          empty={data.matches.data?.length === 0 ? t('row.empty.matches') : undefined}
          action={t('common.seeAll')}
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
          title={t('row.liveNow')}
          meta={data.channels.data ? `${data.channels.data.length} KANAL` : undefined}
          loading={data.channels.loading}
          error={data.channels.error}
          skeleton="still"
          action={t('common.seeAll')}
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
              <h2 className="text-[19px] font-extrabold lg:text-[25px]">{t('row.channelStrip')}</h2>
              <span className="mono pt-1 text-[11px] tracking-[0.08em] text-tx3">{t('row.meta.hoverStops')}</span>
              <button
                type="button"
                onClick={() => onSeeAll('live')}
                className="ml-auto flex items-center gap-1.5 text-[13px] font-bold text-tx3 hover:text-acc"
              >
                {t('common.seeAll')}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
            </div>
            <ChannelLogoLoop channels={data.featured} onPlay={onPlayChannel} />
          </section>
        ) : null}

        {progress.length > 0 ? (
          <Row title={t('row.continue')} tagline={t('row.tagline.continue')} skeleton="still">
            {progress.map((item) => (
              <ContinueCard key={item.key} item={item} onPlay={() => onPlayProgress(item)} />
            ))}
          </Row>
        ) : null}

        {data.guideRows.length > 0 ? (
          <section className="mb-7 lg:mb-10">
            <div className="flex items-center gap-3 px-[var(--pad)] pb-3.5">
              <h2 className="text-[19px] font-extrabold lg:text-[25px]">{t('row.tonightGuide')}</h2>
              <span className="mono pt-1 text-[11px] tracking-[0.08em] text-tx3">EPG</span>
              <button
                type="button"
                onClick={() => onSeeAll('live')}
                className="ml-auto flex items-center gap-1.5 text-[13px] font-bold text-tx3 hover:text-acc"
              >
                {t('common.seeAll')}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
            </div>
            <MiniEpg rows={data.guideRows} onPlay={onPlayChannel} />
          </section>
        ) : null}

        {data.collections.length > 0 ? (
          <Row title={t('row.collections')} tagline={t('row.tagline.collections')}>
            {data.collections.map((collection) => (
              <ShowcaseCard key={collection.id} collection={collection} onOpen={() => onOpenCollection(collection.id)} />
            ))}
          </Row>
        ) : null}

        <Row
          title={t('row.providerMovies')}
          meta={data.vod.data ? t('row.meta.titles', { n: data.vod.data.length }) : undefined}
          loading={data.vod.loading}
          error={data.vod.error}
          action={t('common.seeAll')}
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
              {...favOf('vod', item.id, item.name, artworkFor(`vod-${item.id}`, item.cover))}
              onOpen={() => onPlayVod(item)}
            />
          ))}
        </Row>

        <Row
          title={t('row.providerSeries')}
          meta={data.providerSeries.data ? t('row.meta.series', { n: data.providerSeries.data.length }) : undefined}
          loading={data.providerSeries.loading}
          error={data.providerSeries.error}
          action={t('common.seeAll')}
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
              {...favOf('series', item.id, item.name, artworkFor(`series-${item.id}`, item.cover))}
              onOpen={() => onPlayVod(item)}
            />
          ))}
        </Row>

        <Row
          title={t('row.genres')}
          meta={t('row.meta.tmdb')}
          loading={data.genres.loading}
          error={data.genres.error}
          action={t('common.seeAll')}
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
