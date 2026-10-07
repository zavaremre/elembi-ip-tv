import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { config, patchConfig } from './config'
import { clearCache } from './http'
import { store } from './store'
import { tmdb } from './tmdb'
import { subtitles, openLocalSubtitle } from './subtitles'
import { teamBadges } from './teams'
import { available as ffmpegAvailable, probe, startHls, stopHls } from './transcode'
import { posters } from './artwork'
import { audioInfo } from './vodinfo'
import { liveUrl, seriesUrl, vodUrl, xtream } from './xtream'
import type {
  AppConfig,
  ArtworkRequest,
  DiscoverFilters,
  MediaKind,
  SubtitleSync
} from '../shared/types'

const isDev = !app.isPackaged

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#08080C',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 24 },
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => win.show())
  win.webContents.on('context-menu', (_event, params) => {
    const template: Electron.MenuItemConstructorOptions[] = []
    if (params.selectionText) template.push({ label: 'Kopyala', role: 'copy' })
    if (params.isEditable) template.push({ label: 'Yapıştır', role: 'paste' })
    if (template.length > 0) template.push({ type: 'separator' })
    template.push(
      { label: 'Yenile', click: () => win.webContents.reload() },
      { label: 'Denetle', click: () => win.webContents.inspectElement(params.x, params.y) },
      { label: 'Geliştirici araçları', click: () => win.webContents.toggleDevTools() }
    )
    Menu.buildFromTemplate(template).popup({ window: win })
  })

  /**
   * A plain link navigates the renderer itself, which leaves the app stranded on
   * a web page with no way back. Anything that is not the app's own document is
   * handed to the system browser instead.
   */
  win.webContents.on('will-navigate', (event, url) => {
    const rendererUrl = process.env.ELECTRON_RENDERER_URL
    if (url.startsWith('file://')) return
    if (rendererUrl && url.startsWith(rendererUrl)) return
    event.preventDefault()
    void shell.openExternal(url)
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
  return win
}

/** One handler per channel; failures travel to the renderer as a message instead of throwing. */
function registerIpc(): void {
  const on = <A extends unknown[], R>(ch: string, fn: (...args: A) => Promise<R> | R): void => {
    ipcMain.handle(ch, async (_e, ...args) => {
      try {
        return { ok: true, data: await fn(...(args as A)) }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    })
  }

  /* TMDB */
  on('tmdb:trending', () => tmdb.trending())
  on('tmdb:popularMovies', (page?: number) => tmdb.popularMovies(page))
  on('tmdb:popularTv', (page?: number) => tmdb.popularTv(page))
  on('tmdb:topRated', (kind: MediaKind) => tmdb.topRated(kind))
  on('tmdb:nowPlaying', () => tmdb.nowPlaying())
  on('tmdb:airingToday', () => tmdb.airingToday())
  on('tmdb:byGenre', (kind: MediaKind, id: number) => tmdb.byGenre(kind, id))
  on('tmdb:genres', () => tmdb.genres())
  on('tmdb:search', (q: string) => tmdb.search(q))
  on('tmdb:detail', (kind: MediaKind, id: number) => tmdb.detail(kind, id))
  on('tmdb:full', (kind: MediaKind, id: number) => tmdb.full(kind, id))
  on('tmdb:searchRich', (q: string) => tmdb.searchRich(q))
  on('tmdb:discover', (filters: DiscoverFilters) => tmdb.discover(filters))
  on('tmdb:season', (tvId: number, seasonNumber: number) => tmdb.season(tvId, seasonNumber))

  /* provider */
  on('iptv:status', () => xtream.status())
  on('iptv:channels', () => xtream.channels())
  on('iptv:nowNext', (id: number) => xtream.nowNext(id))
  on('iptv:epg', (id: number, limit?: number) => xtream.epg(id, limit))
  on('iptv:matches', () => xtream.matches())
  on('iptv:vod', () => xtream.vod())
  on('iptv:series', () => xtream.series())
  on('iptv:seriesInfo', (id: number) => xtream.seriesInfo(id))
  on('iptv:audioInfo', (ids: number[]) => audioInfo(ids))
  on('iptv:liveUrl', (id: number) => liveUrl(id))
  on('iptv:vodUrl', (id: number, ext?: string) => vodUrl(id, ext))
  on('iptv:seriesUrl', (id: number, ext?: string) => seriesUrl(id, ext))

  /* local remux: audio tracks and unsupported codecs */
  on('media:available', () => ffmpegAvailable())
  on('media:probe', (url: string) => probe(url))
  on('media:startHls', (src: string, audioOrder: number, start: number) => startHls(src, audioOrder, start))
  on('media:stop', () => {
    stopHls()
    return true
  })

  /* artwork */
  on('art:posters', (requests: ArtworkRequest[]) => posters(requests))

  /* team badges */
  on('teams:badges', (names: string[]) => teamBadges(names))

  /* subtitles */
  on('subs:available', () => subtitles.configured())
  on('subs:openLocal', () => openLocalSubtitle())
  on('subs:search', (params: Parameters<typeof subtitles.search>[0]) => subtitles.search(params))
  on('subs:download', (fileId: number) => subtitles.download(fileId))
  on('subs:sync', (key: string) => store.subtitleSync(key))
  on('subs:saveSync', ({ key, sync }: { key: string; sync: SubtitleSync }) => {
    store.saveSubtitleSync(key, sync)
    return true
  })

  /* local state */
  on('store:progress', () => store.progress())
  on('store:saveProgress', (p: Parameters<typeof store.saveProgress>[0]) => store.saveProgress(p))
  on('store:favorites', () => store.favorites())
  on('store:toggleFavorite', (id: number) => store.toggleFavorite(id))

  /* settings */
  on('app:config', (): AppConfig => {
    const c = config()
    return {
      xtream: { host: c.XTREAM_HOST, user: c.XTREAM_USER, pass: c.XTREAM_PASS ? '•'.repeat(8) : '', output: c.XTREAM_OUTPUT },
      tmdb: { lang: c.TMDB_LANG, region: c.TMDB_REGION, hasToken: Boolean(c.TMDB_TOKEN || c.TMDB_KEY) },
      externalPlayer: c.EXTERNAL_PLAYER,
      favorites: store.favorites()
    }
  })
  on('app:setConfig', (patch: Record<string, string>) => {
    patchConfig(patch)
    clearCache()
    xtream.resetGuideCache()
    return true
  })
  /**
   * Chromium exposes no audio-track API for progressive files, so a stream with
   * several dubs can only be switched in a native player.
   */
  on('app:openInPlayer', (url: string) => {
    const player = config().EXTERNAL_PLAYER
    if (process.platform === 'darwin' && player) {
      /* argv form, never a shell string, so the URL cannot be interpreted */
      spawn('open', ['-a', player, url], { detached: true, stdio: 'ignore' }).unref()
      return true
    }
    void shell.openExternal(url)
    return true
  })

  on('app:refresh', () => {
    clearCache()
    xtream.resetGuideCache()
    return true
  })
}

/** A single instance only: the provider allows one simultaneous connection. */
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [existing] = BrowserWindow.getAllWindows()
    if (!existing) return
    if (existing.isMinimized()) existing.restore()
    existing.focus()
  })

  app.whenReady().then(() => {
    registerIpc()
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

/* ffmpeg and its temp directory must not outlive the app. */
app.on('will-quit', () => stopHls())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
