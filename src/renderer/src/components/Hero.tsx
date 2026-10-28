import { useEffect, useState } from 'react'
import { NoiseOverlay } from './fx/NoiseOverlay'
import { SplitText } from './fx/SplitText'
import { StarBorder } from './fx/StarBorder'
import { Art } from './Art'
import { useMagnet } from '@/hooks/useFx'
import { dur } from '@/lib/fmt'
import { backdrop, logo } from '@/lib/img'
import type { TmdbItem } from '@shared/types'

interface HeroProps {
  items: TmdbItem[]
  loading: boolean
  onOpen: (item: TmdbItem) => void
}

const ROTATE_MS = 7600

/** Full-bleed featured stage: one slide at a time, title entering with SplitText. */
export function Hero({ items, loading, onOpen }: HeroProps): React.JSX.Element {
  const [index, setIndex] = useState(0)
  /* Bumped on manual navigation so the auto-rotate timer starts over. */
  const [epoch, setEpoch] = useState(0)
  const openRef = useMagnet<HTMLButtonElement>()

  useEffect(() => {
    if (items.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS)
    return () => window.clearInterval(timer)
  }, [items.length, epoch])

  const goTo = (target: number): void => {
    if (items.length === 0) return
    setIndex(((target % items.length) + items.length) % items.length)
    setEpoch((value) => value + 1)
  }

  const item = items[index]

  if (loading || !item) {
    return (
      <section className="relative h-[clamp(500px,76vh,760px)] shrink-0 -mt-[66px]">
        <Art src={null} alt="" shape="fill" />
        <div className="absolute inset-x-0 bottom-0 h-[140px] bg-linear-to-t from-ink to-transparent" />
      </section>
    )
  }

  const meta = [item.year, item.kind === 'tv' ? `${item.seasons ?? 1}. sezon` : dur(item.runtime), item.genres.join(', ')].filter(Boolean)

  return (
    <section className="relative h-[clamp(500px,76vh,760px)] shrink-0 -mt-[66px] overflow-hidden">
      <Art key={item.id} src={backdrop(item.backdrop, 'original')} alt={item.title} shape="fill" anchor="top" flat />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,12,.97)_0%,rgba(8,8,12,.8)_34%,rgba(8,8,12,.08)_66%,rgba(8,8,12,.55)_100%),linear-gradient(0deg,var(--color-ink)_1%,rgba(8,8,12,.35)_30%,transparent_62%)]" />
      <NoiseOverlay />

      <div className="pointer-events-none absolute inset-0 z-3">
        <div className="shell relative h-full">
      <div className="pointer-events-auto absolute bottom-[clamp(92px,10.5vh,126px)] left-[var(--pad)] max-w-[min(620px,52vw)]">
        <div className="fadeup flex items-center gap-2.5 text-[11.5px] tracking-[0.18em] text-acc uppercase">
          <StarBorder>Elembi Özel</StarBorder>
          <span className="mono">{item.kind === 'tv' ? 'Dizi' : 'Film'} · haftanın öne çıkanı</span>
        </div>

        {logo(item.logo) ? (
          <img src={logo(item.logo) ?? ''} alt={item.title} className="mt-4 max-h-[150px] max-w-[72%] object-contain drop-shadow-[0_6px_40px_rgba(0,0,0,.6)]" />
        ) : (
          <h1
            className="mt-3.5 text-[clamp(44px,6.4vw,92px)] leading-[0.86] font-black tracking-[-0.045em] drop-shadow-[0_6px_40px_rgba(0,0,0,.6)]"
            style={{ fontVariationSettings: "'wdth' 102" }}
          >
            <SplitText text={item.title} runKey={item.id} />
          </h1>
        )}

        <div className="fadeup mt-4 flex flex-wrap items-center gap-2.5 text-[13.5px] text-tx2" style={{ animationDelay: '340ms' }}>
          {item.rating > 0 ? <span className="flex items-center gap-1.5 font-bold text-gold">★ {item.rating.toFixed(1).replace('.', ',')}</span> : null}
          {meta.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>

        {item.overview ? (
          <p className="fadeup mt-4 max-w-[52ch] text-[15.5px] leading-[1.6] text-tx2" style={{ animationDelay: '440ms' }}>
            {item.overview.length > 220 ? `${item.overview.slice(0, 217)}…` : item.overview}
          </p>
        ) : null}

{/*
         * One action, because there was only ever one: the second button said
         * "Sağlayıcıda oynat" and opened the same detail page, since nothing is
         * played before the detail page has shown what the provider carries.
         */}
        <div className="fadeup mt-6 flex flex-wrap items-center gap-2.5" style={{ animationDelay: '560ms' }}>
          <button
            ref={openRef}
            type="button"
            onClick={() => onOpen(item)}
            className="spec flex h-[46px] items-center gap-2.5 rounded-[12px] bg-tx px-6 text-[15px] font-bold text-ink shadow-[0_10px_34px_-12px_rgba(255,255,255,.5)] transition-transform duration-[380ms] ease-[var(--ease-out2)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 7.6v.4" strokeLinecap="round" />
            </svg>
            Detayı aç
          </button>
        </div>
      </div>

      {items.length > 1 ? (
        <div className="pointer-events-auto absolute right-[var(--pad)] bottom-[clamp(96px,10.9vh,130px)] flex items-center gap-2.5">
          <span className="mono text-[11px] text-tx3">
            {index + 1} / {items.length}
          </span>
          <div className="flex items-center gap-1.5">
            {items.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`${i + 1}. öne çıkan`}
                aria-current={i === index}
                className={`h-[3px] rounded-[3px] transition-all duration-300 ${i === index ? 'w-10 bg-acc shadow-[0_0_12px_var(--color-acc)]' : 'w-[18px] bg-white/25 hover:bg-white/45'}`}
              />
            ))}
          </div>
          <div className="ml-1.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Önceki öne çıkan"
              className="grid h-8 w-8 place-items-center rounded-full border border-white/18 bg-ink/50 text-tx backdrop-blur-[14px] transition-colors hover:border-acc/50 hover:bg-ink/75"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden="true">
                <path d="m15 6-6 6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Sonraki öne çıkan"
              className="grid h-8 w-8 place-items-center rounded-full border border-white/18 bg-ink/50 text-tx backdrop-blur-[14px] transition-colors hover:border-acc/50 hover:bg-ink/75"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-2 h-[140px] bg-linear-to-t from-ink to-transparent" />
    </section>
  )
}
