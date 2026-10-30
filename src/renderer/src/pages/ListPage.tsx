import { ChannelCard } from '@/components/ChannelCard'
import { useT } from '@/i18n'
import { MatchCard } from '@/components/MatchCard'
import { PosterCard } from '@/components/PosterCard'
import { useProviderPosters } from '@/hooks/useProviderPosters'
import { poster } from '@/lib/img'
import type { Reminders } from '@/hooks/useReminders'
import type { Channel, Match, NowNext, TmdbItem, VodItem } from '@shared/types'

export type ListView =
  | { kind: 'tmdb'; title: string; meta?: string; items: TmdbItem[] }
  | { kind: 'provider'; title: string; meta?: string; items: VodItem[] }
  | { kind: 'channels'; title: string; meta?: string; items: Channel[] }
  | { kind: 'matches'; title: string; meta?: string; items: Match[] }

interface ListPageProps {
  view: ListView
  loading?: boolean
  guide: Map<number, NowNext>
  reminders: Reminders
  isPlayable: (item: TmdbItem) => boolean
  teamBadges: Map<string, string>
  onOpenTmdb: (item: TmdbItem) => void
  onPlayVod: (item: VodItem) => void
  onPlayChannel: (channel: Channel) => void
  onPlayMatch: (match: Match) => void
}

/** One grid page shared by the nav sections and the showcase collections. */
export function ListPage({
  view,
  loading,
  guide,
  reminders,
  isPlayable,
  teamBadges,
  onOpenTmdb,
  onPlayVod,
  onPlayChannel,
  onPlayMatch
}: ListPageProps): React.JSX.Element {
  const t = useT()
  /* Kept inside the branch so the discriminated union stays narrowed below. */
  const providerItems = view.kind === 'provider' ? view.items : []
  const tmdbPosters = useProviderPosters(providerItems)
  const artworkFor = (key: string, cover: string | null): string | null =>
    poster(tmdbPosters.paths.get(key)) ?? (tmdbPosters.resolved.has(key) ? cover : null)
  const tmdbItems = view.kind === 'tmdb' ? view.items.filter(isPlayable) : []
  const count = view.kind === 'tmdb' ? tmdbItems.length : view.items.length
  const gridClass =
    view.kind === 'channels' || view.kind === 'matches'
      ? 'grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4'
      : 'grid grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-4 lg:gap-5'

  return (
    <main className="shell px-[var(--pad)] pt-6 pb-24">
      <div className="flex items-center gap-3 pb-5">
        <h1 className="text-[clamp(26px,3.4vw,38px)] font-extrabold">{view.title}</h1>
        {view.meta ? <span className="mono pt-2 text-[11px] tracking-[0.1em] text-tx3">{view.meta}</span> : null}
      </div>

      {loading ? (
        <p className="mono text-[12px] tracking-[0.12em] text-acc uppercase">{t('search.loading')}</p>
      ) : count === 0 ? (
        <p className="text-[14px] text-tx3">
          {view.kind === 'tmdb'
            ? t('list.emptyProvider')
            : t('list.empty')}
        </p>
      ) : (
        <div className={gridClass}>
          {view.kind === 'tmdb'
            ? tmdbItems.map((item) => (
                <PosterCard
                  key={item.id}
                  title={item.title}
                  image={poster(item.poster)}
                  rating={item.rating}
                  meta={item.year}
                  layout="grid"
                  onOpen={() => onOpenTmdb(item)}
                />
              ))
            : null}

          {view.kind === 'provider'
            ? view.items.map((item) => (
                <PosterCard
                  key={`${item.kind}-${item.id}`}
                  title={item.name}
                  image={artworkFor(`${item.kind}-${item.id}`, item.cover)}
                  rating={item.rating}
                  meta={item.group}
                  audio={item.audio}
                  layout="grid"
                  onOpen={() => onPlayVod(item)}
                />
              ))
            : null}

          {view.kind === 'channels'
            ? view.items.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  guide={guide.get(channel.id) ?? null}
                  layout="grid"
                  onPlay={() => onPlayChannel(channel)}
                />
              ))
            : null}

          {view.kind === 'matches'
            ? view.items.map((match) => (
                <MatchCard
                  key={`${match.channelId}-${match.start}`}
                  match={match}
                  reminded={reminders.has(match)}
                  badges={teamBadges}
                  layout="grid"
                  onPlay={() => onPlayMatch(match)}
                  onRemind={() => reminders.toggle(match)}
                />
              ))
            : null}
        </div>
      )}
    </main>
  )
}
