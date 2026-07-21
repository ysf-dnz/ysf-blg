# ysf-blog

Yusuf Deniz'in kişisel blogu — Astro 5, Tailwind v4, MDX. Türkçe ana dil,
İngilizce seçmeli. Instagram tarzı hikâye halkaları, NotebookLM kütüphane
entegrasyonu (438 defter) ve Keystatic admin paneli ile.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu (arama dev'de boş — Pagefind postbuild'de üretilir) |
| `npm run admin` | Dev sunucu + **Keystatic admin** → http://localhost:4321/keystatic |
| `npm run build` | Üretim build + Pagefind indeksi + llms.txt |
| `npm run preview` | Build çıktısını yerelde sun |
| `npm test` | Vitest (unit + component) |
| `npm run test:e2e` | Playwright (build + preview'a karşı) |
| `npx lhci autorun` | Lighthouse CI (perf/a11y ≥ 95 kapısı) |
| `npm run sync:kutuphanem` | kutuphanem verisini çek → `src/data/kutuphanem.json` |
| `npm run sync:kitaplik` | Drive kitap listesini doğrula → `src/data/books.json` |

## Yeni yazı nasıl eklenir?

**Yol 1 — Admin paneli:** `npm run admin` → http://localhost:4321/keystatic →
"Yazılar (TR)" → New. Tüm frontmatter alanları (kategori, etiketler, kaynaklar,
NotebookLM defteri dropdown'ı) formdan doldurulur. Kaydet = dosya
`src/content/posts/tr/` altına yazılır; commit + push ile yayınlanır.

**Yol 2 — Elle:** `src/content/posts/tr/<slug>.mdx` oluştur:

```yaml
---
title: "Yazı başlığı"
description: "2-3 cümlelik özet — SEO ve AI alıntılanabilirliği için önemli."
pubDate: 2026-07-21
category: "ai"            # ai | yazilim | girisimcilik | egitim | kisisel
tags: ["etiket1", "etiket2"]
draft: true               # yayınlarken false yapın
lang: "tr"
translationOf: "english-slug"        # (ops.) diğer dildeki karşılık
kutuphaneNode: "<defter-uuid>"       # (ops.) kutuphanem defter id'si
kaynaklar:                           # (ops.) yazı sonunda listelenir
  - baslik: "Kaynak adı"
    url: "https://..."
    tur: "notebooklm"     # notebooklm | kitap | makale | video
---
```

Gövdede kullanılabilen MDX bileşenleri: `<YouTube id="..." />`,
`<Callout type="bilgi|uyari|ipucu">`, `<D3Chart type="line" data={[...]} />`.
Kod bloklarında `title="dosya.ts"` başlık, `// [!code highlight]` satır vurgusu.

**Yol 3 — Claude Code:** "şu defterden yazı taslağı çıkar" →
`.claude/skills/yazi-taslagi` skill'i NotebookLM defterini sorgulayıp
kaynakları hazır bir taslak üretir.

## Hikâyeler (story halkaları)

`src/content/stories/*.yaml` — admin panelindeki "Hikâyeler" bölümünden veya
elle yönetilir. `slides` doluysa site içi story viewer'da açılır; boşsa
tıklama doğrudan `targetUrl`'e (Medium/YouTube/Instagram) gider. `expiresAt`
geçmiş hikâyeler görünmez; görülenler soluk halkaya döner (localStorage).

## Kütüphane entegrasyonu

- **kutuphanem senkronu:** `npm run sync:kutuphanem` —
  [kutuphanem](https://ysf-dnz.github.io/kutuphanem) sayfasındaki gömülü veriyi
  çekip `src/data/kutuphanem.json`'a yazar (17 kategori, 438 defter) ve diff
  raporu basar. `/kutuphane` bu veriyle build edilir; her defterin kendi
  sayfası vardır. Yazıdaki `kutuphaneNode` geçersizse **build kırılır**.
- **Kitap rafı (Drive):** Vercel'in Drive erişimi yoktur. Claude Code'da
  "kitaplığı senkronla" deyin (`.claude/skills/kitaplik-sync`) → MCP ile
  `src/data/books-raw.json` üretilir → `npm run sync:kitaplik` doğrulayıp
  `books.json`'a yazar. Küratörlük (gizle/sırala/kapak) admin panelindeki
  "Kitap Rafı Küratörlüğü" singleton'ından (`books-overrides.json`).

## Admin (Keystatic)

- **Local mode (varsayılan):** `npm run admin`. Admin yalnızca
  `ASTRO_KEYSTATIC=1` iken yüklenir; üretim build'inde admin'e ait tek bayt yoktur.
- **GitHub mode (opsiyonel):** Tarayıcıdan her yerden düzenleme istenirse
  `keystatic.config.tsx` içinde `storage: { kind: "github", repo: "kullanici/repo" }`
  yapın, [Keystatic GitHub App](https://keystatic.com/docs/github-mode) kurun ve
  `/keystatic` + `/api/keystatic` route'larını `prerender=false` ile Vercel
  function olarak açın. Erişim = repo yazma yetkisi; her kayıt bir commit olur
  ve Vercel otomatik yeniden build eder.

## Giscus (yorumlar)

1. Repo'yu GitHub'a push'layın, repo ayarlarından **Discussions**'ı açın.
2. [giscus.app](https://giscus.app) üzerinde repo'yu seçin ("Announcements"
   kategorisi önerilir), üretilen `data-repo-id` ve `data-category-id`
   değerlerini alın.
3. `.env` (ve Vercel env ayarları) içine yazın:
   `PUBLIC_GISCUS_REPO`, `PUBLIC_GISCUS_REPO_ID`, `PUBLIC_GISCUS_CATEGORY_ID`.
   Env boşken yorum bloğu hiç render edilmez.

## SEO / GEO

- canonical + hreflang (tr/en/x-default), OG/Twitter meta, satori ile
  yazı başına OG görseli (`/og/<slug>.png`), JSON-LD `@graph`
  (Person + WebSite + BlogPosting + BreadcrumbList).
- **GEO:** `llms.txt` + `llms-full.txt` (postbuild), her yazının ham
  markdown'ı `/yazilar/<slug>.md`, robots.txt'te GPTBot/ClaudeBot/
  PerplexityBot açıkça izinli.

## Deploy (Vercel)

Repo'yu Vercel'e bağlayın; adapter `@astrojs/vercel`, çıktı statik.
Env: `SITE_URL` + Giscus değişkenleri. Domain alındığında `SITE_URL`,
`public/robots.txt` içindeki mutlak URL'ler ve `keystatic` dokümanı güncellenmeli.

## Mimari notları

- `src/features/<ad>/` — her özellik kendi bileşen+util'ini taşır; feature'lar
  arası paylaşım yalnızca `src/lib` üzerinden.
- Veri akışı tek yön: dış kaynak → `scripts/sync-*` → `src/data/*.json`
  (commit edilir) → content collections → sayfalar. Build hiçbir dış servise
  bağımlı değildir.
- Client JS bütçesi: yazı sayfasında D3 island dışında sıfır harici script
  (e2e `js-budget.spec.ts` bunu zorlar); story viewer ~8K tek dosya;
  d3 yalnızca grafik görünür olunca iner.
