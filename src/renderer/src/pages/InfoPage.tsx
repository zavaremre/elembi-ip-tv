import { useState } from 'react'
import { NoiseOverlay } from '@/components/fx/NoiseOverlay'

export type InfoTab = 'about' | 'help' | 'privacy' | 'terms'

interface InfoPageProps {
  tab: InfoTab
  onTab: (tab: InfoTab) => void
  onBack: () => void
  /** Read from the running process, since both differ per platform. */
  dataDir: string
  platform: string
}

const TABS: { id: InfoTab; label: string }[] = [
  { id: 'about', label: 'Hakkında' },
  { id: 'help', label: 'Yardım' },
  { id: 'privacy', label: 'Gizlilik' },
  { id: 'terms', label: 'Koşullar' }
]

function H({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <h2 className="mt-8 mb-2.5 text-[17px] font-extrabold tracking-[-0.01em] first:mt-0">{children}</h2>
}

function P({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="mb-3 text-[14px] leading-[1.68] text-tx2">{children}</p>
}

function Code({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <code className="mono rounded-[5px] bg-white/8 px-1.5 py-0.5 text-[12.5px] text-tx">{children}</code>
}

function Rows({ items }: { items: [string, string][] }): React.JSX.Element {
  return (
    <dl className="mb-3 overflow-hidden rounded-[12px] border border-line">
      {items.map(([key, value]) => (
        <div key={key} className="flex gap-4 border-b border-white/5 px-3.5 py-2.5 last:border-b-0">
          <dt className="mono w-[182px] shrink-0 text-[11.5px] text-tx3">{key}</dt>
          <dd className="text-[13px] leading-snug text-tx2">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Keys({ items }: { items: [string, string][] }): React.JSX.Element {
  return (
    <div className="mb-3 grid gap-1.5 sm:grid-cols-2">
      {items.map(([key, what]) => (
        <div key={key} className="flex items-center gap-3 rounded-[10px] border border-line px-3 py-2">
          <span className="mono shrink-0 rounded-[6px] border border-line bg-white/8 px-2 py-0.5 text-[11.5px]">{key}</span>
          <span className="text-[12.5px] text-tx2">{what}</span>
        </div>
      ))}
    </div>
  )
}

/* Named per platform: the install command is the one thing that differs. */
const FFMPEG_HINT: Record<string, string> = {
  darwin: 'brew install ffmpeg',
  win32: 'winget install ffmpeg',
  linux: 'apt install ffmpeg'
}

function About({ dataDir, platform }: { dataDir: string; platform: string }): React.JSX.Element {
  return (
    <>
      <H>Elembi nedir</H>
      <P>
        Elembi, kendi IPTV aboneliğinizi masaüstünde izlemek için yazılmış bir oynatıcıdır. Aboneliğinizin
        kanal, film ve dizi listesini alır, üzerine TMDB'den afiş, özet, oyuncu ve anahtar kelime
        bilgisi ekler. Kendi içinde hiçbir yayın veya içerik barındırmaz; ne izleyeceğinizi tamamen
        sizin girdiğiniz abonelik belirler.
      </P>
      <H>Nasıl çalışır</H>
      <P>
        Tüm ağ istekleri uygulamanın ana sürecinden çıkar, arayüz doğrudan internete bağlanmaz.
        Oynatma için dosyalar yerel bir <Code>ffmpeg</Code> oturumundan geçirilir — Chromium MKV
        dosyalarında konumlu ileri sarma yapamadığı ve AC-3 sesi çözemediği için. Bu dönüşümün
        çıktısı yalnızca <Code>127.0.0.1</Code> üzerinde dinleyen bir yerel sunucuyla oynatıcıya
        verilir, dışarıya açılmaz.
      </P>
      <H>Teknik</H>
      <Rows
        items={[
          ['Sürüm', '0.1.0'],
          ['Çalışma ortamı', 'Electron 35 · React 19 · TypeScript'],
          ['Gereken araç', 'ffmpeg (sistemde kurulu olmalı)'],
          ['Platformlar', 'macOS, Windows ve Linux — şu ana kadar yalnızca macOS üzerinde denendi'],
          ['Şu anki platform', platform],
          ['Veri klasörü', dataDir]
        ]}
      />
      <P>
        Bu ürün TMDB API'sini kullanır, ancak TMDB tarafından onaylanmış veya sertifikalanmış
        değildir. Takım armaları TheSportsDB'den gelir.
      </P>
    </>
  )
}

function Help({ platform }: { platform: string }): React.JSX.Element {
  return (
    <>
      <H>Kurulum</H>
      <P>
        Sağlayıcınızın verdiği bağlantı adresini yapıştırmanız yeterli — M3U, Xtream API ya da EPG
        adresi, hangisi elinizdeyse olur. Kullanıcı adı ve şifre bu adresin içinde olduğu için ayrıca
        girmeniz gerekmez. Adres bunları içermiyorsa uygulama listeyi açıp içinden okur.
      </P>
      <P>
        Afişlerin, özetlerin ve platform logolarının gelmesi için bir TMDB okuma anahtarı gerekir;
        ücretsizdir. Anahtar olmadan katalog çalışır ama görseller boş kalır.
      </P>
      <H>ffmpeg neden gerekli</H>
      <P>
        Sağlayıcıların çoğu filmleri MKV olarak verir. Chromium bu dosyalarda konumlu ileri sarma
        yapamaz ve yaygın olan AC-3 / E-AC-3 sesi hiç çözemez. ffmpeg kurulu değilse ileri sarma,
        bu seslerin duyulması ve dosya içindeki altyazılar çalışmaz. Bu sistemde{' '}
        <Code>{FFMPEG_HINT[platform] ?? 'ffmpeg'}</Code> ile kurulur.
      </P>
      <H>Sık karşılaşılanlar</H>
      <Rows
        items={[
          [
            'Sağlayıcıya bağlanılamıyor',
            'Önce adresi ve aboneliğin süresini kontrol edin. Panel, kısa sürede çok fazla istek gelirse adresinizi geçici olarak kilitleyebilir; bu durumda bir süre bekleyip tekrar denemek gerekir.'
          ],
          [
            'Katalog görünüyor ama oynatmıyor',
            'Sağlayıcıya ulaşılamadığında uygulama diskteki son kataloğu gösterir. Liste dolu görünür, oynatma çalışmaz; bağlantı dönünce kendiliğinden düzelir.'
          ],
          [
            'Başka cihazda açıkken oynatmıyor',
            'Aboneliklerin çoğu aynı anda tek bağlantıya izin verir. Diğer cihazdaki oynatıcıyı kapatın.'
          ],
          [
            'Altyazı gelmiyor',
            'Altyazılar dosyanın içinden okunur ve Türkçe varsa kendiliğinden açılır. Dosyada gömülü altyazı yoksa, oynatıcıdaki “Dosyadan yükle” ile elinizdeki bir .srt dosyasını açabilirsiniz.'
          ],
          [
            'Afişler eksik',
            'TMDB anahtarı tanımlı değil ya da başlık TMDB’de tam adıyla bulunamıyor. İkinci durumda sayfa açılır, yalnızca görsel ve özet gelmez.'
          ]
        ]}
      />
      <H>Oynatıcı kısayolları</H>
      <Keys
        items={[
          ['Boşluk / K', 'Oynat ve duraklat'],
          ['← / →', '5 saniye geri ve ileri'],
          ['J / L', '10 saniye geri ve ileri'],
          ['↑ / ↓', 'Sesi azalt ve artır'],
          ['M', 'Sesi kapat'],
          ['F', 'Tam ekran'],
          ['I', 'Küçük pencere'],
          ['Esc', 'Tam ekrandan veya oynatıcıdan çık']
        ]}
      />
    </>
  )
}

function Privacy({ dataDir }: { dataDir: string }): React.JSX.Element {
  return (
    <>
      <H>Özet</H>
      <P>
        Elembi'nin arkasında bir sunucu yok. Hesap açmanız istenmez, kullanım verisi toplanmaz,
        uygulamada hiçbir analitik veya izleme kodu bulunmaz. Verdiğiniz bilgiler yalnızca
        bilgisayarınızda durur ve yalnızca sizin seçtiğiniz servislere gider.
      </P>
      <H>Bilgisayarınızda ne saklanıyor</H>
      <P>
        Hepsi <Code>{dataDir}</Code> klasöründedir. Klasörü silmek uygulamanın bildiği her şeyi
        siler.
      </P>
      <Rows
        items={[
          ['config.json', 'Abonelik adresiniz, kullanıcı adınız, şifreniz ve TMDB anahtarınız'],
          ['state.json', 'Kaldığınız yerler, favorileriniz ve başlık başına altyazı gecikmesi'],
          ['catalog-*.json', 'Sağlayıcınızın kanal, film ve dizi listesi'],
          ['artwork.json · logo-colors.json', 'Bulunan afiş adresleri ve logolardan okunan renkler'],
          ['vod-audio.json', 'Başlıkların dublaj mı altyazı mı olduğu'],
          ['team-badges.json', 'Takım armalarının adresleri'],
          ['xmltv-cache.json', 'Sağlayıcınızın yayın akışı (EPG) verisi']
        ]}
      />
      <P>
        Şifreniz bu dosyada düz metin olarak tutulur; işletim sisteminin anahtar zinciri
        kullanılmaz. Dosya yalnızca sizin kullanıcı hesabınızın erişebildiği bir yerdedir, ama
        bilgisayarınıza erişen biri okuyabilir.
      </P>
      <H>Cihazdan ne çıkıyor</H>
      <Rows
        items={[
          [
            'Sağlayıcınız',
            'Katalog, yayın akışı ve izlediğiniz her şey oradan gelir. Xtream protokolü gereği kullanıcı adınız ve şifreniz her istekte adresin içinde gönderilir, ayrıca hangi içeriği açtığınızı sağlayıcınız görür.'
          ],
          [
            'api.themoviedb.org',
            'Açtığınız başlıkların adları afiş ve özet bulmak için sorgulanır. Yani TMDB neye baktığınızı görür. Abonelik bilgileriniz gönderilmez.'
          ],
          ['image.tmdb.org', 'Afiş, arka plan ve platform logosu görselleri buradan indirilir.'],
          ['www.thesportsdb.com', 'Maç kartlarındaki armalar için yalnızca takım adları sorgulanır.']
        ]}
      />
      <P>
        Bunların dışında hiçbir adrese bağlanılmaz. Oynatma için kurulan yerel sunucu yalnızca{' '}
        <Code>127.0.0.1</Code> üzerinde dinler, ağınızdaki diğer cihazlara açık değildir.
      </P>
      <H>Üçüncü taraflar</H>
      <P>
        TMDB ve TheSportsDB'ye giden istekler o servislerin kendi gizlilik koşullarına tabidir.
        Sağlayıcınızın verilerinizi nasıl işlediği de onunla aranızdaki ilişkiye bağlıdır; Elembi bu
        konuda aracı değildir.
      </P>
    </>
  )
}

function Terms(): React.JSX.Element {
  return (
    <>
      <H>Ne sunuyor, ne sunmuyor</H>
      <P>
        Elembi bir oynatıcıdır. İçinde hiçbir yayın, film veya dizi barındırmaz; herhangi bir abonelik
        satmaz veya sağlamaz. Yalnızca sizin girdiğiniz aboneliğe bağlanır ve o aboneliğin verdiğini
        gösterir.
      </P>
      <H>Sorumluluk</H>
      <P>
        Kullandığınız aboneliğin ve eriştiğiniz içeriğin bulunduğunuz yerdeki mevzuata uygun olması
        sizin sorumluluğunuzdadır. Uygulamayı kullanarak gösterdiğiniz içeriğin kaynağından Elembi
        sorumlu değildir ve bu konuda hiçbir denetim yapmaz.
      </P>
      <H>Garanti verilmez</H>
      <P>
        Uygulama olduğu gibi sunulur. Kesintisiz veya hatasız çalışacağına, her sağlayıcıyla uyumlu
        olacağına dair bir söz verilmez. Kullanımından doğabilecek veri kaybı veya başka zararlar
        için sorumluluk kabul edilmez.
      </P>
      <H>Üçüncü taraf servisler</H>
      <P>
        Afiş ve bilgi verisi TMDB'den, takım armaları TheSportsDB'den gelir. Bu servislerin kendi
        kullanım koşulları geçerlidir. Bu ürün TMDB API'sini kullanır, ancak TMDB tarafından
        onaylanmış veya sertifikalanmış değildir.
      </P>
      <H>Kaynak kod</H>
      <P>
        Elembi açık kaynaktır. Kodu inceleyebilir, değiştirebilir ve kendiniz derleyebilirsiniz.
        Dağıtım koşulları depodaki lisans dosyasında belirtilir.
      </P>
    </>
  )
}

/** About, help, privacy and terms; reached from Settings rather than the header. */
export function InfoPage({ tab, onTab, onBack, dataDir, platform }: InfoPageProps): React.JSX.Element {
  const [hovered, setHovered] = useState<InfoTab | null>(null)

  return (
    <main className="relative pb-24">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <NoiseOverlay />
      </div>

      {/*
        * The menu sits at the top, right under the window's title band, so the
        * four pages read as one tabbed screen rather than four destinations.
        * The back control shares the row to keep it off its own line.
        */}
      <div className="sticky top-[66px] z-10 border-b border-line bg-ink/80 backdrop-blur-[18px]">
        <div className="mx-auto flex max-w-[760px] flex-wrap items-center gap-x-3 gap-y-2 px-[var(--pad)] py-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Ayarlara dön"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-line text-tx3 hover:border-acc/40 hover:text-tx"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>

          <nav className="flex flex-wrap gap-1.5" aria-label="Bilgi sayfaları">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onTab(item.id)}
                onPointerEnter={() => setHovered(item.id)}
                onPointerLeave={() => setHovered(null)}
                aria-current={item.id === tab}
                className={`rounded-[10px] border px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                  item.id === tab
                    ? 'border-acc bg-acc/15 text-acc'
                    : `border-line text-tx2 ${hovered === item.id ? 'bg-white/8 text-tx' : ''}`
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="relative mx-auto max-w-[760px] px-[var(--pad)] pt-7">
        <h1 className="text-[clamp(22px,3vw,30px)] leading-[1.1] font-black tracking-[-0.03em]">
          {TABS.find((item) => item.id === tab)?.label}
        </h1>

        <article className="mt-6">
          {tab === 'about' ? (
            <About dataDir={dataDir} platform={platform} />
          ) : tab === 'help' ? (
            <Help platform={platform} />
          ) : tab === 'privacy' ? (
            <Privacy dataDir={dataDir} />
          ) : (
            <Terms />
          )}
        </article>
      </div>
    </main>
  )
}
