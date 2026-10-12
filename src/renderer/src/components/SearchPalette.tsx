import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatedList } from './fx/AnimatedList'
import { Art } from './Art'
import { norm } from '@/lib/match'
import { poster } from '@/lib/img'
import type { Channel, TmdbItem, VodItem } from '@shared/types'

export interface PaletteHit {
  id: string
  label: string
  kindLabel: string
  image: string | null
  run: () => void
}

interface SearchPaletteProps {
  open: boolean
  onClose: () => void
  channels: Channel[]
  vod: VodItem[]
  series: VodItem[]
  onPlayChannel: (channel: Channel) => void
  onPlayVod: (item: VodItem) => void
  onOpenTmdb: (item: TmdbItem) => void
  onSeeAll: (query: string) => void
  /** Prefilled when the palette is opened from a detail page. */
  initialQuery?: string
}

const PLACEHOLDERS = ['bu akşam 2 saatlik bir film', 'derbi hangi kanalda', 'kaldığım yerden devam']
const LIMIT_PER_GROUP = 4

/** ⌘K palette: provider channels and VOD are matched locally, TMDB is queried for discovery. */
export function SearchPalette({
  open,
  onClose,
  channels,
  vod,
  series,
  onPlayChannel,
  onPlayVod,
  onOpenTmdb,
  onSeeAll,
  initialQuery = ''
}: SearchPaletteProps): React.JSX.Element | null {
  const [query, setQuery] = useState('')
  const [tmdbHits, setTmdbHits] = useState<TmdbItem[]>([])
  const [cursor, setCursor] = useState(0)
  const [typed, setTyped] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery(initialQuery)
      inputRef.current?.focus()
    } else {
      setQuery('')
      setTmdbHits([])
      setCursor(0)
    }
  }, [open, initialQuery])

  /* TextType hint while the field is empty. */
  useEffect(() => {
    if (!open || query) return
    let phrase = 0
    let char = 0
    let deleting = false
    let timer = 0
    const tick = (): void => {
      const word = PLACEHOLDERS[phrase]
      setTyped(word.slice(0, char))
      if (!deleting) {
        char += 1
        if (char > word.length) {
          deleting = true
          timer = window.setTimeout(tick, 1600)
          return
        }
      } else {
        char -= 1
        if (char === 0) {
          deleting = false
          phrase = (phrase + 1) % PLACEHOLDERS.length
        }
      }
      timer = window.setTimeout(tick, deleting ? 26 : 62)
    }
    tick()
    return () => window.clearTimeout(timer)
  }, [open, query])

  useEffect(() => {
    if (!query.trim()) {
      setTmdbHits([])
      return
    }
    const timer = window.setTimeout(() => {
      window.akis.tmdb
        .search(query)
        .then((r) => setTmdbHits(r.slice(0, LIMIT_PER_GROUP)))
        .catch(() => setTmdbHits([]))
    }, 260)
    return () => window.clearTimeout(timer)
  }, [query])

  const hits = useMemo<PaletteHit[]>(() => {
    const q = norm(query)
    if (!q) return []
    const channelHits = channels
      .filter((c) => norm(c.name).includes(q))
      .slice(0, LIMIT_PER_GROUP)
      .map<PaletteHit>((c) => ({
        id: `ch-${c.id}`,
        label: c.name,
        kindLabel: `canlı · ${c.group}`,
        image: c.logo,
        run: () => onPlayChannel(c)
      }))
    const providerHits = [...vod, ...series]
      .filter((v) => norm(v.name).includes(q))
      .slice(0, LIMIT_PER_GROUP)
      .map<PaletteHit>((v) => ({
        id: `${v.kind}-${v.id}`,
        label: v.name,
        kindLabel: v.kind === 'vod' ? 'film · sağlayıcı' : 'dizi · sağlayıcı',
        image: v.cover,
        run: () => onPlayVod(v)
      }))
    const discoveryHits = tmdbHits.map<PaletteHit>((t) => ({
      id: `tmdb-${t.kind}-${t.id}`,
      label: t.title,
      kindLabel: `${t.kind === 'tv' ? 'dizi' : 'film'} · TMDB${t.year ? ` ${t.year}` : ''}`,
      image: poster(t.poster, 'w185'),
      run: () => onOpenTmdb(t)
    }))
    return [...channelHits, ...providerHits, ...discoveryHits]
  }, [query, channels, vod, series, tmdbHits, onPlayChannel, onPlayVod, onOpenTmdb])

  useEffect(() => setCursor(0), [query])

  if (!open) return null

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && hits[cursor]) { hits[cursor].run(); onClose() }
  }

  return (
    <div className="fixed inset-0 z-90 flex items-start justify-center bg-ink/70 px-4 pt-[14vh] backdrop-blur-[6px]" onClick={onClose}>
      <div
        className="w-full max-w-[640px] overflow-hidden rounded-[18px] border border-white/12 bg-ink2/92 shadow-[0_40px_90px_-30px_rgba(0,0,0,.9)] backdrop-blur-[26px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3.5">
          <span className="mono rounded-[4px] bg-white/10 px-1.5 py-0.5 text-[10px] text-acc">⌘K</span>
          <label className="flex-1">
            <span className="sr-only">Ara</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKey}
              placeholder={typed || 'Kanal, film veya dizi ara'}
              className="mono w-full bg-transparent text-[14px] outline-none placeholder:text-tx3"
            />
          </label>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {hits.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px] text-tx3">
              {query ? 'Sonuç yok — sağlayıcıda ve TMDB’de arandı' : 'Yazmaya başla: kanal adı, film adı ya da dizi adı'}
            </p>
          ) : (
            <AnimatedList>
              {hits.map((hit, i) => (
                <button
                  key={hit.id}
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => { hit.run(); onClose() }}
                  className={`flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-1.5 text-left text-[13px] ${
                    i === cursor ? 'bg-acc/12 shadow-[inset_2px_0_0_var(--color-acc)]' : ''
                  }`}
                >
                  <Art src={hit.image} alt="" shape="box" flat contain className="h-[26px] w-[40px] shrink-0 rounded-[5px]" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{hit.label}</span>
                  <span className="mono shrink-0 text-[9.5px] tracking-[0.08em] text-tx3 uppercase">{hit.kindLabel}</span>
                </button>
              ))}
            </AnimatedList>
          )}
        </div>

        {query.trim() ? (
          <button
            type="button"
            onClick={() => {
              onSeeAll(query)
              onClose()
            }}
            className="flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-left text-[12.5px] font-bold text-acc hover:bg-acc/8"
          >
            “{query}” için tüm sonuçlar ve filtreler
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        ) : null}

        <div className="mono flex gap-4 border-t border-line bg-white/3 px-4 py-2 text-[10px] text-tx3">
          <span>↑↓ gez</span>
          <span>↵ aç</span>
          <span>esc kapat</span>
        </div>
      </div>
    </div>
  )
}
