# Kişisel Blog — Claude Code İmplementasyon Promptu

> Bu dosyayı Claude Code'a ver ve "bu spesifikasyona göre projeyi kur" de.
> Domain: (satın alınınca güncelle — aday: yusufdeniz.dev)

## Proje Özeti

Yusuf Deniz'in kişisel blogu. Medium tarzı yazı deneyimi + geliştirici kimliği.
Türkçe ana dil, İngilizce seçmeli. Referans estetik: ghuntley.com (kart grid,
kategori etiketleri, güçlü kişisel marka) — ama kopya değil, özgün yorum.

## Teknoloji Kararları (kesin)

- **Astro 5** + Content Collections (content layer API)
- Taban ilham: **AstroPaper** (satnaing/astro-paper) — fork etme, temiz `npm create astro@latest`
  ile başla, AstroPaper'ın şu pratiklerini uygula: type-safe frontmatter şeması,
  dinamik OG image üretimi (satori/resvg), Pagefind arama, taslak (draft) desteği
- **Tailwind CSS v4**
- **MDX** yazı formatı
- **Pagefind** arama, **Giscus** yorumlar (GitHub Discussions)
- **Vercel** deploy (adapter: @astrojs/vercel, static output)
- RSS + sitemap + robots.txt
- Dark/light/system tema

## i18n

- Astro yerleşik i18n routing: varsayılan `tr` (prefix'siz), `en` prefix'li (`/en/...`)
- Her yazı iki dilde olmak zorunda değil. Frontmatter'da `translationOf` alanı
  varsa yazı sayfasında dil değiştirici göster, yoksa gösterme.
- UI metinleri `src/i18n/tr.ts` ve `en.ts` sözlüklerinden.

## İçerik Şeması (src/content.config.ts)

```ts
posts: {
  title: string
  description: string
  pubDate: Date
  updatedDate?: Date
  category: enum["ai", "yazilim", "girisimcilik", "egitim", "kisisel"]
  tags: string[]
  cover?: image
  draft: boolean (default false)
  lang: "tr" | "en"
  translationOf?: string   // diğer dildeki yazının slug'ı
  kaynaklar?: { baslik: string, url: string, tur?: "notebooklm" | "kitap" | "makale" | "video" }[]
  kutuphaneNode?: string   // kutuphanem grafiğindeki ilgili düğüm id'si
}
```

## MDX Bileşen Kütüphanesi (src/components/mdx/)

1. `<YouTube id="..." />` — lite-youtube-embed tabanlı, lazy, CLS'siz
2. Kod blokları — Shiki (astro yerleşik), ekstra: kopyala butonu, dosya adı
   başlığı, satır vurgulama (`// [!code highlight]` notasyonu)
3. `<Callout type="bilgi|uyari|ipucu">` — renkli kutu
4. `<D3Chart>` — client:visible island; children olarak D3 render fonksiyonu alan
   genel amaçlı sarmalayıcı. Örnek bir kullanım da ekle (basit çizgi grafik).
5. `<Kaynaklar />` — frontmatter'daki `kaynaklar` dizisini yazı sonunda
   "Bu yazının kaynakları" başlığıyla listeler; `tur: notebooklm` olanlara
   kitap ikonu + kutuphanem linki (https://ysf-dnz.github.io/kutuphanem)
6. `<Image>` — Astro yerleşik, tüm görseller optimize (webp/avif)

## Sayfalar

- `/` — Ana sayfa: kısa manifesto (1-2 cümle), son yazılar kart grid'i
  (kapak görseli, kategori etiketi, başlık, özet, okuma süresi),
  "Zihin Haritam" bölümü: kutuphanem neural graph estetiğinde mini
  dekoratif SVG + kutuphanem'e link
- `/yazilar` — arşiv, kategori filtreli, sayfalama
- `/yazilar/[slug]` — yazı detay: TOC (sticky, scroll-spy), okuma süresi,
  yazı sonu Kaynaklar bloğu, önceki/sonraki yazı, Giscus, paylaş linkleri
- `/kategori/[kategori]`
- `/hakkimda` — kısa bio, projeler (Tulpar Carpet, yurtlarburada, kutuphanem...)
- `/kutuphane` — kutuphanem'e yönlendirme/gömme sayfası
- `/rss.xml`, `/en/...` karşılıkları

## Tasarım Sistemi

- **Tipografi:** başlıklar için karakterli bir display serif (örn. "Fraunces"
  veya "Playfair Display" — Türkçe karakter desteğini doğrula), gövde için
  "Inter" veya "Source Sans 3". Okuma genişliği max ~68ch, satır aralığı geniş
  (Medium okuma konforu hedef).
- **Renk:** nötr zemin + tek güçlü vurgu rengi (öneri: derin turkuaz/petrol
  yeşili — Türk çinisi göndermesi). Dark mode'da vurgu rengi hafif açılır.
- **Doku:** hero/footer'da çok düşük opaklıkta geometrik (selçuklu yıldızı /
  girih) SVG pattern — kitsch olmasın, %3-5 opaklık.
- **Kartlar:** ghuntley.com tarzı grid ama köşeler, gölge ve hover davranışı
  özgün olsun. Kategori etiketleri renk kodlu.
- OG image şablonu: başlık + kategori + site adı, marka renkleriyle satori
  ile üretilsin.
- frontend-design skill'in varsa onu da oku ve uygula.

## Kalite Kapıları

- Lighthouse: Performance ve Accessibility ≥ 95 (ana sayfa + bir yazı sayfası)
- Yazı sayfasında D3 island dışında client JS ~0 olmalı (Pagefind ve Giscus
  lazy yüklensin)
- `npm run build` temiz geçmeli, TypeScript strict
- 3 örnek yazı ekle (biri TR+EN çift dilli, biri YouTube+kod bloklu,
  biri D3 grafikli + kaynaklar bloklu) — gerçekçi lorem değil, kısa gerçek
  içerik taslakları

## Aşamalar (bu sırayla ilerle, her aşama sonunda dev server'da göster)

1. Proje iskeleti + content şeması + temel layout + tema değiştirici
2. Yazı detay sayfası + MDX bileşenleri + Shiki yapılandırması
3. Ana sayfa tasarımı + kart grid + arşiv/kategori sayfaları
4. i18n + arama (Pagefind) + Giscus + RSS/sitemap/SEO/OG image
5. Örnek içerikler + Lighthouse optimizasyonu + Vercel deploy yapılandırması

## Notlar

- Repo adı önerisi: `blog` veya domain adı
- Giscus için repo'da Discussions açık olmalı; kurulum adımlarını README'ye yaz
- README'ye "yeni yazı nasıl eklenir" bölümü ekle (frontmatter örneğiyle)
