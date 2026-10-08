import { useEffect, useState } from 'react'
import { AppHeader, type Section } from './components/AppHeader'
import { DetailPage } from './components/DetailPage'
import { Player } from './components/Player'
import { ProviderToast } from './components/ProviderToast'
import { ReminderToast } from './components/ReminderToast'
import { SearchPalette } from './components/SearchPalette'
import { SettingsPanel } from './components/SettingsPanel'
import { useAsync } from './hooks/useAsync'
import { useCollectionList, type CollectionId } from './hooks/useCollectionLists'
import { useHomeData } from './hooks/useHomeData'
import { usePlayback } from './hooks/usePlayback'
import { usePointerFx } from './hooks/useFx'
import { useReminders } from './hooks/useReminders'
import { useTmdbDetail } from './hooks/useTmdbDetail'
import { useViewStack } from './hooks/useViewStack'
import { isReleased, type ProviderMatchState } from './lib/match'
import { sportChannels } from './lib/channels'
import { Home, type SeeAllTarget } from './pages/Home'
import { ListPage, type ListView } from './pages/ListPage'
import { ProviderBrowser } from './pages/ProviderBrowser'
import { ProviderSeriesPage } from './pages/ProviderSeriesPage'
import { SearchPage } from './pages/SearchPage'
import type { DiscoverFilters, Genre, Keyword, Match, TmdbItem, VodItem } from '@shared/types'

const COLLECTION_TITLES: Record<CollectionId, string> = {
  'top-rated': 'En Çok Oylananlar',
  'now-playing': 'Vizyonda Olanlar',
  'airing-today': 'Bugün Yayında',
  'provider-vod': 'Sağlayıcı Arşivi'
}

const DEFAULT_FILTERS: DiscoverFilters = {
  kind: 'movie',
  query: '',
  genreIds: [],
  keywordIds: [],
  yearFrom: null,
  yearTo: null,
  minRating: null,
  minVotes: 50,
  language: null,
  sort: 'popularity.desc',
  page: 1
}

export function App(): React.JSX.Element {
  usePointerFx()

  const data = useHomeData()
  const playback = usePlayback()
  const reminders = useReminders(data.matches.data ?? [])

  const stack = useViewStack({
    section: 'home',
    collection: null,
    detailRef: null,
    providerSeries: null, providerScope: null,
    filters: DEFAULT_FILTERS
  })
  const { section, collection, detailRef, providerSeries, providerScope, filters } = stack.view
  /* Titles the provider does not carry are hidden by default. */
  const [providerOnly, setProviderOnly] = useState(true)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const appConfig = useAsync(() => window.akis.app.config(), [])
  const collectionList = useCollectionList(collection)
  const detail = useTmdbDetail(detailRef)
  /* Derived during render: no effect needed to keep the match in sync. */
  const providerLoading = data.vod.loading || data.providerSeries.loading
  const providerMatchState = ((): ProviderMatchState => {
    if (!detail.data || detail.loading) return { kind: 'searching' }
    if (!isReleased(detail.data)) return { kind: 'unreleased', status: detail.data.status }
    if (data.providerIndex.size === 0 && providerLoading) return { kind: 'searching' }
    const titles = [detail.data.title, detail.data.originalTitle, ...detail.data.alternativeTitles]
    const found = data.providerIndex.find(
      titles,
      detail.data.year ? Number(detail.data.year) : null,
      detail.data.kind === 'tv' ? 'series' : 'vod'
    )
    return found ? { kind: 'found', item: found } : { kind: 'missing' }
  })()

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteQuery('')
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toTop = (): void => document.getElementById('page')?.scrollTo({ top: 0 })

  const go = (patch: Parameters<typeof stack.go>[0]): void => {
    stack.go(patch)
    toTop()
  }

  const back = (): void => {
    stack.back()
    toTop()
  }

  const openDetail = (item: TmdbItem): void => go({ detailRef: { kind: item.kind, id: item.id }, providerSeries: null, providerScope: null })

  /** A provider series opens its episode list; a movie plays straight away. */
  const openVod = (item: VodItem): void => {
    if (item.kind === 'series') go({ providerSeries: item, detailRef: null })
    else void playback.playVod(item)
  }

  const goSection = (next: Section): void => {
    /* Tapping Settings again closes it rather than doing nothing. */
    if (next === 'settings' && section === 'settings' && stack.canGoBack) {
      back()
      return
    }
    go({ section: next, collection: null, detailRef: null, providerSeries: null, providerScope: null })
  }

  const openCollection = (id: string): void =>
    go({ collection: id as CollectionId, detailRef: null, providerSeries: null, providerScope: null })

  /** Genre tiles and keyword chips both land on the search page with filters applied. */
  const openGenre = (genre: Genre): void =>
    go({
      section: 'search',
      collection: null,
      detailRef: null,
      providerSeries: null, providerScope: null,
      filters: { ...DEFAULT_FILTERS, kind: genre.kind, genreIds: [genre.id] }
    })

  const openKeyword = (keyword: Keyword): void =>
    go({
      section: 'search',
      collection: null,
      detailRef: null,
      providerSeries: null, providerScope: null,
      filters: { ...DEFAULT_FILTERS, kind: detailRef?.kind ?? 'movie', keywordIds: [keyword.id] }
    })

  /** Row headings route to the page that holds the full list. */
  const seeAll = (target: SeeAllTarget): void => {
    if (target === 'popular-movies' || target === 'popular-series' || target === 'genres') {
      go({
        section: 'search',
        collection: null,
        detailRef: null,
        providerSeries: null, providerScope: null,
        filters: { ...DEFAULT_FILTERS, kind: target === 'popular-series' ? 'tv' : 'movie' }
      })
      return
    }
    const section: Section =
      target === 'sports' ? 'sports' : target === 'live' ? 'live' : target === 'provider-series' ? 'series' : 'movies'
    go({ section, collection: null, detailRef: null, providerSeries: null, providerScope: null })
  }

  const playMatch = (match: Match): void => {
    const channel = data.channels.data?.find((c) => c.id === match.channelId)
    if (channel) playback.playChannel(channel)
  }

  const refresh = (): void => {
    setRefreshing(true)
    data.reload()
    window.setTimeout(() => setRefreshing(false), 1200)
  }

  const listView = ((): ListView | null => {
    if (collection) {
      if (collection === 'provider-vod') {
        return { kind: 'provider', title: COLLECTION_TITLES[collection], meta: `${data.vod.data?.length ?? 0} BAŞLIK`, items: data.vod.data ?? [] }
      }
      return { kind: 'tmdb', title: COLLECTION_TITLES[collection], meta: 'TMDB', items: collectionList.data ?? [] }
    }
    if (section === 'sports') {
      const matches = data.matches.data ?? []
      if (matches.length > 0) return { kind: 'matches', title: 'Spor', meta: 'BUGÜN VE YARIN', items: matches }
      return { kind: 'channels', title: 'Spor Kanalları', items: sportChannels(data.channels.data ?? []) }
    }
    return null
  })()

  const listLoading = collection
    ? collection === 'provider-vod'
      ? data.vod.loading
      : collectionList.loading
    : data.channels.loading

  const browser =
    !collection && !providerSeries && (section === 'live' || section === 'movies' || section === 'series')
      ? section === 'live'
        ? { title: 'Canlı TV', dataset: { kind: 'channels' as const, items: data.channels.data ?? [] }, state: data.channels }
        : section === 'movies'
          ? { title: 'Filmler', dataset: { kind: 'vod' as const, items: data.vod.data ?? [] }, state: data.vod }
          : { title: 'Diziler', dataset: { kind: 'series' as const, items: data.providerSeries.data ?? [] }, state: data.providerSeries }
      : null

  return (
    <>
      <div id="page" className="scroll-y flex-1">
        <AppHeader
          section={section}
          onSection={goSection}
          onSearch={() => {
            setPaletteQuery('')
            setPaletteOpen(true)
          }}
          onRefresh={refresh}
          refreshing={refreshing}
          providerOk={Boolean(data.channels.data && data.channels.data.length > 0)}
          canGoBack={stack.canGoBack}
          onBack={back}
        />

        {detailRef ? (
          <DetailPage
            detail={detail.data}
            loading={detail.loading}
            error={detail.error}
            match={providerMatchState}
            onPlay={(match) => {
              back()
              openVod(match)
            }}
            onBack={back}
            onOpenItem={openDetail}
            onKeyword={openKeyword}
            onPlayEpisodes={playback.playEpisodeList}
            progress={playback.progress}
            isPlayable={data.isPlayable}
            onManualSearch={(title) => {
              setPaletteQuery(title)
              setPaletteOpen(true)
            }}
          />
        ) : section === 'settings' ? (
          <SettingsPanel onRefresh={refresh} />
        ) : providerSeries ? (
          <ProviderSeriesPage
            item={providerSeries}
            onPlayEpisodes={playback.playEpisodeList}
            progress={playback.progress}
            onOpenTmdb={openDetail}
            onBack={back}
          />
        ) : browser ? (
          <ProviderBrowser
            title={providerScope?.name ?? browser.title}
            dataset={browser.dataset}
            loading={browser.state.loading}
            error={browser.state.error}
            guide={data.guide}
            onPlayChannel={playback.playChannel}
            onPlayVod={openVod}
            categories={providerScope?.categories}
          />
        ) : section === 'search' && !collection ? (
          <SearchPage
            filters={filters}
            genres={data.genres.data ?? []}
            isPlayable={data.isPlayable}
            providerOnly={providerOnly}
            onChange={(patch) => stack.replace({ filters: { ...filters, ...patch } })}
            onProviderOnly={setProviderOnly}
            onReset={() => stack.replace({ filters: { ...DEFAULT_FILTERS, kind: filters.kind } })}
            onOpenItem={openDetail}
          />
        ) : listView ? (
          <ListPage
            view={listView}
            loading={listLoading}
            guide={data.guide}
            reminders={reminders}
            isPlayable={data.isPlayable}
            teamBadges={data.teamBadges}
            onOpenTmdb={openDetail}
            onPlayVod={openVod}
            onPlayChannel={playback.playChannel}
            onPlayMatch={playMatch}
          />
        ) : (
          <Home
            data={data}
            reminders={reminders}
            progress={playback.progress}
            onOpenTmdb={openDetail}
            onPlayChannel={playback.playChannel}
            onPlayVod={openVod}
            onPlayProgress={playback.playProgress}
            onPlayMatch={playMatch}
            onOpenGenre={openGenre}
            onOpenCollection={openCollection}
            onSeeAll={seeAll}
            onOpenPlatform={(name, categories) =>
              go({
                section: 'series',
                collection: null,
                detailRef: null,
                providerSeries: null,
                                providerScope: { name, categories }
              })
            }
          />
        )}
      </div>

      {section === 'home' && !detailRef && !providerSeries && !collection ? (
        <ProviderToast
          status={data.status.data}
          loading={data.channels.loading || data.vod.loading || data.providerSeries.loading}
          error={data.channels.error ?? data.vod.error ?? data.providerSeries.error}
          counts={{
            channels: data.channels.data?.length ?? 0,
            movies: data.vod.data?.length ?? 0,
            series: data.providerSeries.data?.length ?? 0
          }}
          onRetry={refresh}
          onOpenSettings={() => goSection('settings')}
        />
      ) : null}

      {playback.target ? (
        <Player
          target={playback.target}
          mode={playback.mode}
          next={playback.next ? { title: playback.next.title, sub: playback.next.sub, image: playback.next.image } : null}
          browser={playback.browser}
          progress={playback.progress}
          externalPlayer={appConfig.data?.externalPlayer || 'VLC'}
          onMode={playback.setMode}
          onClose={playback.close}
          onNext={playback.advance}
          onSeason={playback.browseSeason}
          onPickEpisode={playback.playFromBrowser}
          onProgress={playback.saveProgress}
        />
      ) : null}

      {reminders.due ? (
        <ReminderToast
          match={reminders.due}
          onPlay={() => {
            if (reminders.due) playMatch(reminders.due)
            reminders.dismiss()
          }}
          onDismiss={reminders.dismiss}
        />
      ) : null}

      <SearchPalette
        open={paletteOpen}
        initialQuery={paletteQuery}
        onClose={() => setPaletteOpen(false)}
        channels={data.channels.data ?? []}
        vod={data.vod.data ?? []}
        series={data.providerSeries.data ?? []}
        onPlayChannel={playback.playChannel}
        onPlayVod={openVod}
        onOpenTmdb={openDetail}
        onSeeAll={(query) =>
          go({ section: 'search', collection: null, detailRef: null, providerSeries: null, providerScope: null, filters: { ...DEFAULT_FILTERS, query } })
        }
      />

      {playback.error ? (
        <div className="fixed bottom-5 left-1/2 z-95 -translate-x-1/2 rounded-[12px] border border-live/50 bg-ink2/92 px-4 py-3 text-[13px] backdrop-blur-[18px]">
          {playback.error}
          <button type="button" onClick={playback.clearError} className="ml-3 font-bold text-acc">
            kapat
          </button>
        </div>
      ) : null}
    </>
  )
}
