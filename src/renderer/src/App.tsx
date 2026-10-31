import { useCallback, useEffect, useState } from 'react'
import { useFavorites } from './hooks/useFavorites'
import { LanguageProvider, makeT, type Key, type Lang } from './i18n'
import { AppHeader, type Section } from './components/AppHeader'
import { DetailPage } from './components/DetailPage'
import { Player } from './components/Player'
import { ProviderToast } from './components/ProviderToast'
import { UpdateToast } from './components/UpdateToast'
import { useUpdate } from './hooks/useUpdate'
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
import { ProviderMoviePage } from './pages/ProviderMoviePage'
import { InfoPage, type InfoTab } from './pages/InfoPage'
import { FavoritesPage } from './pages/FavoritesPage'
import { SetupPage } from './pages/SetupPage'
import { ProviderSeriesPage } from './pages/ProviderSeriesPage'
import { SearchPage } from './pages/SearchPage'
import type { DiscoverFilters, Favorite, Genre, Keyword, Match, MediaKind, TmdbItem, VodItem } from '@shared/types'

/* Keys, not text: this table is built once, outside any language. */
const COLLECTION_TITLES: Record<CollectionId, Key> = {
  'top-rated': 'row.topRated',
  'now-playing': 'row.nowPlaying',
  'airing-today': 'row.todayOnAir',
  'provider-vod': 'row.providerArchive'
}

const DEFAULT_FILTERS: DiscoverFilters = {
  kind: 'movie',
  query: '',
  genreIds: [],
  keywordIds: [],
  person: null,
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
    providerSeries: null, providerMovie: null, providerScope: null,
    filters: DEFAULT_FILTERS
  })
  const { section, collection, detailRef, providerSeries, providerMovie, providerScope, filters } = stack.view
  const { replace: stackReplace } = stack
  /* Titles the provider does not carry are hidden by default. */
  const [providerOnly, setProviderOnly] = useState(true)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  /* Bumped after saving, so the config is re-read rather than trusted. */
  const [setupNonce, setSetupNonce] = useState(0)
  const [infoTab, setInfoTab] = useState<InfoTab>('about')

  const appConfig = useAsync(() => window.elembi.app.config(), [setupNonce])
  /* The main process resolves this against the system when nothing is stored. */
  const lang: Lang = appConfig.data?.language === 'en' ? 'en' : 'tr'
  /* makeT, not useT: this component renders the provider, so it is outside it. */
  const t = makeT(lang)
  /* Waits for the config, so a check is never made while it is switched off. */
  const { update, dismiss: dismissUpdate } = useUpdate(appConfig.data?.updateCheck ?? false)
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

  const favorites = useFavorites()

  /*
   * A favourite row carries only what draws a card, so opening one goes back
   * through the same doors as the card it was saved from: a TMDB id opens the
   * TMDB page, a provider id opens the provider's.
   */
  const openFavorite = (row: Favorite): void => {
    if (row.kind === 'tmdb-movie' || row.kind === 'tmdb-tv') {
      go({ detailRef: { kind: row.kind === 'tmdb-tv' ? 'tv' : 'movie', id: row.id }, providerSeries: null, providerMovie: null, providerScope: null })
      return
    }
    const item = (row.kind === 'series' ? data.providerSeries.data : data.vod.data)?.find((x) => x.id === row.id)
    if (item) openVod(item)
  }

  const openDetail = (item: TmdbItem): void => go({ detailRef: { kind: item.kind, id: item.id }, providerSeries: null, providerMovie: null, providerScope: null })

  /*
   * Swaps the provider film page for the TMDB detail once the title has been
   * recognised. replace, not go: the provider page was a step on the way to
   * this one, so back belongs to whatever the film was clicked from.
   */
  const handoverToTmdb = useCallback(
    (item: TmdbItem): void => {
      stackReplace({ detailRef: { kind: item.kind, id: item.id }, providerMovie: null })
    },
    /* stack itself is a fresh object every render, so depending on it would make
       this callback change every render and re-fire the handover effect. */
    [stackReplace]
  )

  /**
   * Nothing plays straight from a card. A series opens its episode list and a
   * film its own page, so there is one way in wherever it was clicked from.
   */
  const openVod = (item: VodItem): void => {
    if (item.kind === 'series') go({ providerSeries: item, providerMovie: null, detailRef: null })
    else go({ providerMovie: item, providerSeries: null, detailRef: null })
  }

  const goSection = (next: Section): void => {
    /* Tapping Settings again closes it rather than doing nothing. */
    if (next === 'settings' && section === 'settings' && stack.canGoBack) {
      back()
      return
    }
    go({ section: next, collection: null, detailRef: null, providerSeries: null, providerMovie: null, providerScope: null })
  }

  const openCollection = (id: string): void =>
    go({ collection: id as CollectionId, detailRef: null, providerSeries: null, providerMovie: null, providerScope: null })

  /** A cast member's own credits, on the same page keywords and genres land on. */
  const openPerson = (person: { id: number; name: string }, kind: MediaKind): void =>
    go({
      section: 'search',
      collection: null,
      detailRef: null,
      providerSeries: null,
      providerMovie: null,
      providerScope: null,
      filters: { ...DEFAULT_FILTERS, kind, person }
    })

  /** Genre tiles and keyword chips both land on the search page with filters applied. */
  const openGenre = (genre: Genre): void =>
    go({
      section: 'search',
      collection: null,
      detailRef: null,
      providerSeries: null, providerMovie: null, providerScope: null,
      filters: { ...DEFAULT_FILTERS, kind: genre.kind, genreIds: [genre.id] }
    })

  const openKeyword = (keyword: Keyword): void =>
    go({
      section: 'search',
      collection: null,
      detailRef: null,
      providerSeries: null, providerMovie: null, providerScope: null,
      filters: { ...DEFAULT_FILTERS, kind: detailRef?.kind ?? 'movie', keywordIds: [keyword.id] }
    })

  /** Row headings route to the page that holds the full list. */
  const seeAll = (target: SeeAllTarget): void => {
    if (target === 'popular-movies' || target === 'popular-series' || target === 'genres') {
      go({
        section: 'search',
        collection: null,
        detailRef: null,
        providerSeries: null, providerMovie: null, providerScope: null,
        filters: { ...DEFAULT_FILTERS, kind: target === 'popular-series' ? 'tv' : 'movie' }
      })
      return
    }
    const section: Section =
      target === 'favorites'
        ? 'favorites'
        : target === 'sports'
          ? 'sports'
          : target === 'live'
            ? 'live'
            : target === 'provider-series'
              ? 'series'
              : 'movies'
    go({ section, collection: null, detailRef: null, providerSeries: null, providerMovie: null, providerScope: null })
  }

  const playMatch = (match: Match): void => {
    const channel = data.channels.data?.find((c) => c.id === match.channelId)
    if (channel) playback.playChannel(channel)
  }

  /*
   * Nothing works without a subscription, and until this session there was no
   * way to enter one outside a .env file. The setup screen stands in front of
   * the app when the panel details are missing, and Settings can call it back.
   */
  const configured = Boolean(appConfig.data?.xtream.host && appConfig.data.xtream.user)
  const needsSetup = !appConfig.loading && (!configured || setupOpen)

  if (needsSetup) {
    return (
      <SetupPage
        initial={{
          host: appConfig.data?.xtream.host ?? '',
          user: appConfig.data?.xtream.user ?? '',
          output: appConfig.data?.xtream.output ?? 'hls',
          hasToken: appConfig.data?.tmdb.hasToken ?? false
        }}
        onSaved={() => {
          setSetupOpen(false)
          setSetupNonce((n) => n + 1)
          data.reload()
        }}
        onCancel={configured ? () => setSetupOpen(false) : undefined}
      />
    )
  }

  const refresh = (): void => {
    setRefreshing(true)
    data.reload()
    window.setTimeout(() => setRefreshing(false), 1200)
  }

  const listView = ((): ListView | null => {
    if (collection) {
      if (collection === 'provider-vod') {
        return { kind: 'provider', title: t(COLLECTION_TITLES[collection]), meta: t('row.meta.titles', { n: data.vod.data?.length ?? 0 }), items: data.vod.data ?? [] }
      }
      return { kind: 'tmdb', title: t(COLLECTION_TITLES[collection]), meta: 'TMDB', items: collectionList.data ?? [] }
    }
    if (section === 'sports') {
      const matches = data.matches.data ?? []
      if (matches.length > 0) return { kind: 'matches', title: t('nav.sports'), meta: t('row.meta.todayTomorrow'), items: matches }
      return { kind: 'channels', title: t('row.sportChannels'), items: sportChannels(data.channels.data ?? []) }
    }
    return null
  })()

  const listLoading = collection
    ? collection === 'provider-vod'
      ? data.vod.loading
      : collectionList.loading
    : data.channels.loading

  const browser =
    !collection && !providerSeries && !providerMovie && (section === 'live' || section === 'movies' || section === 'series')
      ? section === 'live'
        ? { title: t('row.liveTv'), dataset: { kind: 'channels' as const, items: data.channels.data ?? [] }, state: data.channels }
        : section === 'movies'
          ? { title: t('page.movies'), dataset: { kind: 'vod' as const, items: data.vod.data ?? [] }, state: data.vod }
          : { title: t('page.series'), dataset: { kind: 'series' as const, items: data.providerSeries.data ?? [] }, state: data.providerSeries }
      : null

  return (
    <LanguageProvider lang={lang}>
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
            favorites={favorites}
            detail={detail.data}
            loading={detail.loading}
            error={detail.error}
            match={providerMatchState}
            onPlay={(match) => {
              /*
               * This page is already the detail page, so its play control plays.
               * A series is the exception: what it opens is the episode list, and
               * that replaces this view rather than stacking on top of it.
               */
              if (match.kind === 'series') {
                back()
                openVod(match)
                return
              }
              void playback.playVod(match)
            }}
            onBack={back}
            onOpenItem={openDetail}
            onKeyword={openKeyword}
            onPerson={(person) => openPerson(person, detail.data?.kind ?? 'movie')}
            onPlayEpisodes={playback.playEpisodeList}
            progress={playback.progress}
            isPlayable={data.isPlayable}
            onManualSearch={(title) => {
              setPaletteQuery(title)
              setPaletteOpen(true)
            }}
          />
        ) : section === 'favorites' && !providerSeries && !providerMovie ? (
          /* Opening a provider favourite fills providerMovie but leaves the
             section alone, and this branch used to swallow it. */
          <FavoritesPage favorites={favorites} onOpen={openFavorite} />
        ) : section === 'info' ? (
          <InfoPage
            tab={infoTab}
            onTab={setInfoTab}
            onBack={() => goSection('settings')}
            version={appConfig.data?.version ?? ''}
            dataDir={appConfig.data?.dataDir ?? ''}
            platform={appConfig.data?.platform ?? ''}
          />
        ) : section === 'settings' ? (
          <SettingsPanel
            onLanguage={(next) => {
              /*
               * TMDB follows the interface. Measured cost: of 180 popular
               * titles the provider matched 45 in Turkish and 33 in English —
               * films take the loss, because the catalogue lists them by their
               * Turkish release name. TMDB_LANG stays its own setting, so this
               * can be put back without giving up an English interface.
               */
              void window.elembi.app
                .setConfig({ UI_LANG: next, TMDB_LANG: next === 'en' ? 'en-US' : 'tr-TR' })
                /*
                 * A reload, not a state bump. Every rail, detail page and
                 * search result already holds what TMDB said in the old
                 * language, each behind its own deps; re-reading the config
                 * changed the labels and left all of that Turkish. The main
                 * process has already dropped its HTTP cache, so this comes
                 * back in the new language.
                 */
                .then(() => window.location.reload())
            }}
            onUpdateCheck={(on) => {
              /* Written through, then re-read, so the toast stops asking the
                 moment it is switched off rather than at the next launch. */
              void window.elembi.app
                .setConfig({ UPDATE_CHECK: on ? '1' : '0' })
                .then(() => window.location.reload())
            }}
            onRefresh={refresh}
            onEditProvider={() => setSetupOpen(true)}
            onOpenInfo={(next) => {
              setInfoTab(next)
              goSection('info')
            }}
          />
        ) : providerSeries ? (
          <ProviderSeriesPage
            favorites={favorites}
            item={providerSeries}
            onPlayEpisodes={playback.playEpisodeList}
            progress={playback.progress}
            onOpenTmdb={openDetail}
            onBack={back}
          />
        ) : providerMovie ? (
          <ProviderMoviePage
            favorites={favorites}
            item={providerMovie}
            progress={playback.progress}
            onPlay={() => void playback.playVod(providerMovie)}
            onResolved={handoverToTmdb}
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
            onOpenFavorite={openFavorite}
            favorites={favorites}
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
            onOpenPerson={(person) => openPerson(person, 'movie')}
            onOpenPlatform={(name, categories) =>
              go({
                section: 'series',
                collection: null,
                detailRef: null,
                providerSeries: null, providerMovie: null,
                                providerScope: { name, categories }
              })
            }
          />
        )}
      </div>

      {section === 'home' && !detailRef && !providerSeries && !providerMovie && !collection ? (
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

      {/* Hidden while something is playing: a release is never urgent enough
          to sit over a video. */}
      {update && !playback.target ? <UpdateToast update={update} onDismiss={dismissUpdate} /> : null}

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
        onOpenPerson={(person) => openPerson(person, 'movie')}
        onSeeAll={(query) =>
          go({ section: 'search', collection: null, detailRef: null, providerSeries: null, providerMovie: null, providerScope: null, filters: { ...DEFAULT_FILTERS, query } })
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
    </LanguageProvider>
  )
}
