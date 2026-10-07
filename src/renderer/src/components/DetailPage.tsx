import { useState } from 'react'
import { Art } from './Art'
import { NoiseOverlay } from './fx/NoiseOverlay'
import { PersonCard } from './PersonCard'
import { PosterCard } from './PosterCard'
import { SeasonEpisodes } from './SeasonEpisodes'
import { Row } from './Row'
import { ShinyText } from './fx/ShinyText'
import { TrailerModal } from './TrailerModal'
import { WatchOptionsPanel } from './WatchOptionsPanel'
import { dur } from '@/lib/fmt'
import { backdrop, hue, logo, poster } from '@/lib/img'
import type { EpisodeSource } from '@/hooks/usePlayback'
import type { EpisodeTarget } from '@/lib/episodes'
import type { ProviderMatchState } from '@/lib/match'
import type { Keyword, Progress, TmdbDetail, TmdbItem, VodItem } from '@shared/types'

interface DetailPageProps {
  detail: TmdbDetail | null
  loading: boolean
  error: string | null
  match: ProviderMatchState
  onPlay: (match: VodItem) => void
  onBack: () => void
  onOpenItem: (item: TmdbItem) => void
  onKeyword: (keyword: Keyword) => void
  onPlayEpisodes: (episodes: EpisodeTarget[], index: number, source: EpisodeSource) => void
  progress: Progress[]
  /** Only titles the provider carries are offered as related watching. */
  isPlayable: (item: TmdbItem) => boolean
  onManualSearch: (title: string) => void
}

function Fact({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div>
      <div className="mono text-[10px] tracking-[0.12em] text-tx3 uppercase">{label}</div>
      <div className="mt-1 text-[13.5px] font-semibold">{value}</div>
    </div>
  )
}

/** Full detail page: TMDB supplies every field here, including the keywords. */
export function DetailPage({
  detail,
  loading,
  error,
  match,
  onPlay,
  onBack,
  onOpenItem,
  onKeyword,
  onPlayEpisodes,
  progress,
  isPlayable,
  onManualSearch
}: DetailPageProps): React.JSX.Element {
  const [trailerOpen, setTrailerOpen] = useState(false)

  if (loading || !detail) {
    return (
      <main className="px-[var(--pad)] py-10">
        {error ? <p className="text-[14px] text-live">{error}</p> : <p className="mono text-[12px] tracking-[0.12em] text-acc uppercase">yükleniyor…</p>}
      </main>
    )
  }

  const similar = detail.similar.filter(isPlayable)
  const recommendations = detail.recommendations.filter(isPlayable)
  const runtime = detail.kind === 'tv' ? dur(detail.episodeRuntime) : dur(detail.runtime)
  const facts = [
    detail.year ? { label: 'Yıl', value: detail.year } : null,
    runtime ? { label: detail.kind === 'tv' ? 'Bölüm süresi' : 'Süre', value: runtime } : null,
    detail.kind === 'tv' && detail.seasons ? { label: 'Sezon', value: `${detail.seasons}` } : null,
    detail.certification ? { label: 'Yaş', value: detail.certification } : null,
    detail.countries.length ? { label: 'Ülke', value: detail.countries.join(', ') } : null,
    detail.networks.length ? { label: detail.kind === 'tv' ? 'Kanal' : 'Yapım', value: detail.networks.join(', ') } : null,
    detail.directors.length ? { label: detail.directors[0].job === 'Director' ? 'Yönetmen' : 'Yapımcı', value: detail.directors.map((d) => d.name).join(', ') } : null,
    detail.status ? { label: 'Durum', value: detail.status } : null
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <main className="pb-24">
      <section className="relative h-[clamp(320px,46vh,460px)] -mt-[66px] overflow-hidden">
        <Art src={backdrop(detail.backdrop, 'w1280')} alt={detail.title} hue={hue(detail.id)} shape="fill" flat />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,var(--color-ink)_2%,rgba(8,8,12,.5)_46%,rgba(8,8,12,.75)_100%)]" />
        <NoiseOverlay />
        <button
          type="button"
          onClick={onBack}
          className="nodrag absolute top-[82px] left-[var(--pad)] z-5 flex items-center gap-2 rounded-[10px] border border-line bg-ink/60 px-3 py-2 text-[13px] font-bold backdrop-blur-sm hover:border-acc/40"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
            <path d="m15 6-6 6 6 6" />
          </svg>
          Geri
        </button>
      </section>

      <div className="shell relative z-5 -mt-[150px] flex flex-col gap-7 px-[var(--pad)] lg:flex-row">
        <div className="w-[190px] shrink-0">
          <Art
            src={poster(detail.poster, 'w500')}
            alt={detail.title}
            hue={hue(detail.id)}
            shape="poster"
            className="shadow-[0_24px_54px_-20px_rgba(0,0,0,.95)]"
          />
        </div>

        <div className="min-w-0 flex-1">
          {logo(detail.logo) ? (
            <img src={logo(detail.logo) ?? ''} alt={detail.title} className="mb-3 max-h-[92px] max-w-[60%] object-contain object-left" />
          ) : (
            <h1 className="text-[clamp(30px,4.4vw,56px)] leading-[0.94] font-black tracking-[-0.035em]" style={{ fontVariationSettings: "'wdth' 104" }}>
              {detail.title}
            </h1>
          )}

          <div className="mono mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-tx3">
            {detail.originalTitle && detail.originalTitle !== detail.title ? (
              <span>
                Özgün ad: <b className="font-medium text-tx2">{detail.originalTitle}</b>
              </span>
            ) : null}
            {detail.originalLanguage ? <span className="uppercase">{detail.originalLanguage}</span> : null}
            {detail.imdbId ? (
              <a
                href={`https://www.imdb.com/title/${detail.imdbId}`}
                target="_blank"
                rel="noreferrer"
                className="text-acc hover:underline"
              >
                IMDb
              </a>
            ) : null}
          </div>

          {detail.tagline ? <p className="mt-3 text-[15px] text-tx2 italic">“{detail.tagline}”</p> : null}

          <div className="mt-4 flex flex-wrap items-center gap-2.5 text-[13.5px] text-tx2">
            {detail.rating > 0 ? (
              <span className="flex items-center gap-1.5 font-bold text-gold">
                ★ {detail.rating.toFixed(1).replace('.', ',')}
                <span className="mono text-[11px] font-normal text-tx3">{detail.voteCount} oy</span>
              </span>
            ) : null}
            {detail.genres.map((g) => (
              <span key={g} className="rounded-[7px] border border-line bg-white/6 px-2 py-0.5 text-[12px]">
                {g}
              </span>
            ))}
            <ShinyText className="mono rounded-[5px] border border-acc/40 bg-acc/10 px-1.5 py-0.5 text-[10.5px] tracking-[0.09em] text-acc uppercase">
              TMDB
            </ShinyText>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            {match.kind === 'searching' ? (
              <span className="mono text-[12px] tracking-[0.1em] text-acc uppercase">sağlayıcıda aranıyor…</span>
            ) : match.kind === 'found' ? (
              <button
                type="button"
                onClick={() => onPlay(match.item)}
                className="spec flex h-[46px] items-center gap-2.5 rounded-[12px] bg-tx px-6 text-[15px] font-bold text-ink"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                Oynat
              </button>
            ) : match.kind === 'unreleased' ? (
              <span className="rounded-[10px] border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-[12.5px] text-gold">
                Henüz yayına girmedi{match.status ? ` · ${match.status}` : ''}
              </span>
            ) : (
              <span className="rounded-[10px] border border-line bg-surf px-3.5 py-2.5 text-[12.5px] text-tx2">
                Sağlayıcı listesinde eşleşme bulunamadı
              </span>
            )}

            {detail.trailerKey ? (
              <button
                type="button"
                onClick={() => setTrailerOpen(true)}
                className="flex h-[46px] items-center gap-2 rounded-[12px] border border-line bg-white/10 px-5 text-[14px] font-bold hover:bg-white/17"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                Fragman
              </button>
            ) : null}

            {match.kind === 'found' ? (
              <span className="mono text-[11.5px] text-tx3">sağlayıcı kaydı: {match.item.name}</span>
            ) : null}
          </div>

          {match.kind === 'missing' || match.kind === 'unreleased' ? (
            <WatchOptionsPanel watch={detail.watch} title={detail.title} onManualSearch={() => onManualSearch(detail.title)} />
          ) : null}

          {detail.overview ? <p className="mt-6 max-w-[72ch] text-[15px] leading-[1.65] text-tx2">{detail.overview}</p> : null}

          {facts.length > 0 ? (
            <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-4 border-t border-line pt-5">
              {facts.map((fact) => (
                <Fact key={fact.label} label={fact.label} value={fact.value} />
              ))}
            </div>
          ) : null}

          {detail.keywords.length > 0 ? (
            <div className="mt-6 border-t border-line pt-5">
              <div className="mono text-[10px] tracking-[0.12em] text-tx3 uppercase">Anahtar kelimeler</div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {detail.keywords.map((keyword) => (
                  <button
                    key={keyword.id}
                    type="button"
                    onClick={() => onKeyword(keyword)}
                    className="rounded-full border border-line bg-white/6 px-3 py-1 text-[12.5px] text-tx2 hover:border-acc/45 hover:text-acc"
                  >
                    {keyword.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {detail.alternativeTitles.length > 0 ? (
            <div className="mono mt-5 text-[11.5px] text-tx3">
              Diğer adlar: <span className="text-tx2">{detail.alternativeTitles.slice(0, 5).join(' · ')}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="shell mt-10">
        {detail.cast.length > 0 ? (
          <Row title="Oyuncular" meta={`${detail.cast.length} KİŞİ`}>
            {detail.cast.map((person) => (
              <PersonCard key={person.id} person={person} />
            ))}
          </Row>
        ) : null}

        {detail.kind === 'tv' && detail.seasonsList.length > 0 ? (
          <div className="mb-7 lg:mb-10">
            <SeasonEpisodes
              tvId={detail.id}
              showTitle={detail.title}
              seasons={detail.seasonsList}
              providerSeriesId={match.kind === 'found' && match.item.kind === 'series' ? match.item.id : null}
              imdbId={detail.imdbId}
              progress={progress}
              onPlayEpisodes={onPlayEpisodes}
            />
          </div>
        ) : null}

        {similar.length > 0 ? (
          <Row title="Benzer Yapımlar" meta={`SAĞLAYICIDA ${similar.length}`}>
            {similar.map((item) => (
              <PosterCard
                key={item.id}
                title={item.title}
                image={poster(item.poster)}
                hueSeed={item.id}
                rating={item.rating}
                meta={item.year}
                onOpen={() => onOpenItem(item)}
              />
            ))}
          </Row>
        ) : null}

        {recommendations.length > 0 ? (
          <Row title="Bunu İzleyenler" meta={`SAĞLAYICIDA ${recommendations.length}`}>
            {recommendations.map((item) => (
              <PosterCard
                key={item.id}
                title={item.title}
                image={poster(item.poster)}
                hueSeed={item.id}
                rating={item.rating}
                meta={item.year}
                onOpen={() => onOpenItem(item)}
              />
            ))}
          </Row>
        ) : null}
      </div>

      {trailerOpen && detail.trailerKey ? (
        <TrailerModal youtubeKey={detail.trailerKey} title={detail.title} onClose={() => setTrailerOpen(false)} />
      ) : null}
    </main>
  )
}
