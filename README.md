# Akış

Electron + React + Tailwind IPTV client. Live TV, VOD and series come from an
Xtream Codes panel; artwork, metadata and discovery come from TMDB.

## Setup

```bash
npm install
cp .env.example .env   # fill in the values
npm run dev
```

`.env` keys:

| Key | Purpose |
| --- | --- |
| `TMDB_TOKEN` | TMDB v4 read token (preferred) |
| `TMDB_KEY` | TMDB v3 api key (fallback) |
| `TMDB_LANG` / `TMDB_REGION` | `tr-TR` / `TR` |
| `XTREAM_HOST` | e.g. `http://host:8080` |
| `XTREAM_USER` / `XTREAM_PASS` | panel credentials |
| `XTREAM_OUTPUT` | `hls` (m3u8) or `ts` |
| `OPENSUBTITLES_KEY` | optional; enables automatic subtitle search |
| `OPENSUBTITLES_USER` / `OPENSUBTITLES_PASS` | optional; signing in raises the download quota |

`.env` is gitignored. Credentials never reach the renderer bundle: every TMDB
and Xtream request is made in the main process and exposed over IPC through
`src/preload`. Settings can also be stored in `<userData>/config.json`, which
takes precedence over `.env`.

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | electron-vite dev server + app |
| `npm run build` | production bundle into `out/` |
| `npm run typecheck` | `tsc` over the node and web projects |

## Features

- **Home** — hero carousel from TMDB trending, popular movies and series, today's
  fixtures from the provider EPG, live channels with now/next, favourites loop,
  continue watching, tonight's guide strip, collections, genres.
- **Detail page** — TMDB credits, keywords (clickable into a filtered search),
  alternative titles, certification, trailer in YouTube's embedded player, and the
  season/episode list merged with the provider's playable episodes.
- **Only what plays** — TMDB rails, collections, genre lists, related rails and the
  hero are filtered to titles the provider actually carries, so nothing on screen
  is a dead end. The catalogue is indexed once per refresh (11k entries → 18.5k
  keys in ~55 ms, lookups at ~3 µs), because scanning it per title would stall
  rendering. The Discover page keeps a toggle for seeing everything.
- **Artwork** — provider covers are uneven: measured, *The Queen's Gambit* ships a
  600x900 poster while *Game of Thrones* ships a 320x240 thumbnail that looks
  broken in a 2:3 frame. Posters therefore come from TMDB, matched on normalised
  title plus year and kept only on a confident match, with the provider's own
  cover as the fallback. Measured 12 of 14 series matched in 0.7 s, cached on
  disk afterwards.
- **Dub or subtitled** — poster badges come from the real audio track, read per
  title from `get_vod_info` (`info.audio.tags.language`): a Turkish track means
  dubbed, any other known language means original audio. Roughly 70% of the
  catalogue is tagged; untagged files get no badge rather than a guess. Lookups
  are batched for the visible items, capped at five in flight, and cached on disk.
  The name of a title is not a usable signal here — only 23 of 8947 entries say
  anything, and *Örümcek Adam (2002)* carries English audio despite its Turkish
  name.
- **Team badges** — fixtures carry club and national-team crests from TheSportsDB,
  with a Turkish-to-English alias map for national teams and disk caching of both
  hits and misses, since many EPG names are local nicknames that never resolve.
- **Where to watch** — when a title is missing or unreleased, the detail page shows
  the legal options for the configured region from TMDB/JustWatch, plus a button
  that opens the palette prefilled to search the provider by hand.
- **Discover** — free text plus TMDB discover filters: genre, year range, minimum
  rating and votes, original language, keyword, sort, and a provider-only toggle.
- **Provider browsing** — live TV, movies and series filtered by country and
  category, with text search, sort and paged rendering.
- **Provider series** — a series in the provider catalogue opens its own season and
  episode list, dressed with TMDB artwork when a match is found.
- **Episode queue** — playing from a season list queues the rest of it, so the
  player rolls into the next episode with a countdown card, and every row shows
  how far it was watched.
- **Title matching** — provider entries are matched on full token equality, the
  release year, and the kind: this catalogue holds 30 titles that exist as both a
  film and a series, so a film must never resolve to the series of the same name.
  Unreleased titles are never matched. The matcher also
  understands this panel's two naming habits: catalogue prefixes like `069-` and
  compound `Turkish Title - English Title` names.
- **Subtitles** — embedded stream tracks, a local `.srt`/`.vtt` file (decoded as
  UTF-8, falling back to windows-1254 for older Turkish files), or an
  OpenSubtitles search when `OPENSUBTITLES_KEY` is set. Offset control shifts
  every cue in 0.5 s steps. The anonymous download quota is a handful per day, so
  downloads are cached per session and the remaining count is shown in the player;
  adding account credentials raises the quota.
- **Player** — hls.js with quality, audio and subtitle selection, playback speed,
  buffered progress, Picture-in-Picture, fullscreen, technical stats and
  YouTube-style keyboard shortcuts. One video element serves both the full player
  and the persistent mini player, so switching never restarts the stream.
- **Navigation** — a view stack, so one back control works on every page.

## Local remux

Chromium exposes no `audioTracks` API and decodes neither AC-3 nor E-AC-3, both
measured in Electron 35 / Chromium 134. In this catalogue that is not an edge
case: roughly a third of sampled titles carry AC-3 or E-AC-3 audio, which means
they would play silently, and multi-dub releases would always play their first
track. Seeking is the other half: an MP4 seeks in about a second and lands
exactly, while a direct Matroska seek never completes, because Chromium goes
looking for an index that sits at the end of the file.

So every progressive source except MP4 is routed through a local **HLS session**,
as is any MP4 with several audio tracks or an undecodable codec. ffmpeg writes a
growing playlist into a temp directory
(`-c:v copy -c:a aac -f hls -hls_time 6 -hls_playlist_type event`) and a loopback
server hands the playlist and its segments to hls.js. Video is copied, so cost
stays near 4% CPU, and production runs about twelve times real time: measured,
the playlist is ready in 3.2 s and 222 s of content exists after 18 s.

Because the playlist carries real segment durations, the element gets a seekable
timeline: a seek inside the produced window took **17 ms and landed exactly** on
target. Only a jump past what ffmpeg has written restarts the session, and a
session restart is also how an audio track is switched. The session id is the
only secret the loopback server checks — hls.js resolves segment URLs against the
playlist path and drops any query string, so a token cannot travel with them.

This replaced a single fragmented-MP4 pipe, which could not be sought at all: it
reported a duration of about one second, so Chromium clamped every seek back to
the start while the offset tracked in the renderer stayed put, and the clock then
described a position the content was nowhere near.

MP4 files with one playable audio track stay on the native path, where playback
starts instantly and seeking is already reliable; provider HLS keeps using hls.js
directly. Requires `ffmpeg` and `ffprobe` on PATH; without them the player falls
back to native playback and offers an external player instead.

Audio delay is applied with a Web Audio `DelayNode` rather than an ffmpeg filter,
because the fragmented muxer normalises each stream to zero and erases any
offset — a deliberate `adelay=500` left no trace. The tap only runs on the local
session and on provider HLS, both of which arrive through MSE; a tap on a direct
provider URL would output silence, and once an element is tapped it stays tapped,
so later titles are forced through the local session.

External subtitle cues are absolute while a session starts at zero, so they are
shifted by the offset and cues that fall before it are dropped rather than
clamped to zero — clamping made every earlier line fire at once, which looked
like the subtitles were wildly out of sync after a seek.

## Architecture

```
src/main        provider + TMDB clients, EPG parsing, IPC, local state
src/preload     the only bridge: window.akis.*
src/renderer    React UI (pages, components, hooks)
src/shared      types shared by both sides
```

- `main/http.ts` caches every JSON response with a TTL and de-duplicates
  concurrent requests for the same URL.
- `main/xmltv.ts` holds the guide. This panel answers `get_short_epg` with an
  empty list, so the EPG is read from `xmltv.php` (~2 MB, 6.5k programmes),
  parsed once and cached in memory and on disk.
- `main/fixtures.ts` turns EPG titles into fixtures and tags them `live`,
  `scheduled`, `replay` or `highlights` — Turkish sport channels mark
  tape-delayed and highlight slots, and showing those as live would be wrong.
- `main/store.ts` keeps resume positions and favourites in
  `<userData>/state.json`.

## Provider endpoints

The panel offers several links; only two are used, because the M3U variants carry
strictly less information than the API.

| Link | Used | Why |
| --- | --- | --- |
| `player_api.php` (Xtream API) | yes | the only source of categories, VOD/series metadata and episode lists |
| `xmltv.php` (EPG) | yes | this panel answers `get_short_epg` with an empty list, so XMLTV is the only guide |
| M3U Plus (HLS) | no | a 14 MB flat list whose stream URLs are the ones the app already builds |
| M3U Plus (TS) / MAG | no | raw MPEG-TS, which Chromium cannot demux; its URLs also omit `/live/` and the extension |
| M3U Standard | no | no `tvg-*` attributes at all |

Measured on this provider: the live HLS playlist is a single-quality media
playlist with 10 s segments, so there are no quality levels to choose from and
latency runs 20–30 s behind. Raw `.ts` streams fine over HTTP and has lower
latency, but playing it would mean adding an mpegts.js remuxer and giving up
audio and subtitle track switching.

Containers in this catalogue: 94% `mkv`, 5% `mp4`, 1% `avi`. Matroska plays in
Electron even though `canPlayType('video/x-matroska')` returns an empty string —
that API is not a reliable signal here.

## Known constraints

- The provider allows **one simultaneous connection**, so the app takes a
  single-instance lock and quits if another copy is already running.
- Only 190 of 736 channels have a usable `epg_channel_id`; channels without one
  show no now/next line.
- `tv_archive` is set on 22 channels only, so timeshift is rarely available.
- Fonts load from Google Fonts, so first paint needs network. Bundle them
  locally before shipping offline.
- Embedded subtitles inside progressive files are invisible to Chromium
  (`textTracks.length === 0` on a file carrying eight subtitle tracks), so loading
  an external subtitle file remains the only way to get subtitles on them.
- "Open in VLC" (`EXTERNAL_PLAYER`) is offered only when the remux path is
  unavailable, which means ffmpeg is not installed.
- External audio files are not supported: keeping a separate audio file in sync
  with a remote stream needs two media elements nudged against each other and
  drifts in practice.
