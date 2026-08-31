# Graph Report - ysf-blog  (2026-08-30)

## Corpus Check
- Large corpus: 1097 files · ~713,216 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 749 nodes · 1504 edges · 65 communities (56 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.83)
- Token cost: 256,066 input · 0 output

## Community Hubs (Navigation)
- Dev Bağımlılıkları
- Site İskeleti & Kütüphane UI
- Yazı Yayın Hattı
- Çalışma Zamanı Bağımlılıkları
- Üyelik & Üye API'leri
- DB Şeması & Demo Seed
- Topluluk Sayfaları
- Hikâyeler & Motion
- Mimari Anayasa & Bilgi Tabanı
- Kitap Senkron Betikleri
- İçerik Şemaları & Tipler
- Yetkiler & Kampanya-Görev
- Puan Ödül Motoru
- Okuma Kapısı & Ekonomi
- Kulüp Ligi & Günlük Cron
- DB İstemcisi & Seviyeler
- Ders Modülleri
- i18n Çekirdeği
- Blog İçeriği & Projeler
- Yazı Düzeni Bileşenleri
- TypeScript Yapılandırması
- Ana Sayfa & URL Yardımcıları
- Arşiv & Kategori Sayfaları
- llms.txt Üretici
- Kütüphanem Senkronu
- Keystatic Yapılandırması
- D3 Grafik Bileşeni
- Quiz Puanlama
- OG Görsel Render
- Ekonomi Korumaları
- Üye Profili
- Astro İçerik Yazısı
- SEO Bileşeni
- Slug Yardımcıları
- Astro Yapılandırması
- Middleware
- Build Çıktı Bekçisi
- Vercel Yapılandırması
- Yaratıcılık Kitabı Notları
- The Optimist Kitabı
- Tulpar Carpet Projesi
- Yurtlarburada Projesi

## God Nodes (most connected - your core abstractions)
1. `getOrCreateMember()` - 62 edges
2. `Db` - 47 edges
3. `useTranslations()` - 28 edges
4. `awardPoints()` - 27 edges
5. `getPublishedPosts()` - 23 edges
6. `levelFor()` - 17 edges
7. `PUAN` - 15 edges
8. `scripts` - 14 edges
9. `initStories()` - 14 edges
10. `localizePath()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `CI Pipeline (test + build + Lighthouse + Playwright)` --semantically_similar_to--> `npm run qa Kalite Kapısı`  [INFERRED] [semantically similar]
  .github/workflows/ci.yml → CLAUDE.md
- `Bilgi Ödüldür Platform Konsepti` --semantically_similar_to--> `Öğrenmede Oyunlaştırma (rozet, seviye, sosyal rekabet)`  [INFERRED] [semantically similar]
  CLAUDE.md → src/content/books-qa/1Gd6osks6faShVZxdJO8AFJWElX6dE_2g.yaml
- `cron_runs Idempotency Deseni` --semantically_similar_to--> `The Coder Cafe — 66 Zamansız Kavram — Soru-Cevap`  [INFERRED] [semantically similar]
  PROGRESS.md → src/content/books-qa/1yWyCKWndayf6wkJXHrHxnju_15grgelx.yaml
- `NotebookLM Değer Notu Üretimi` --conceptually_related_to--> `Mindset (Carol Dweck) — Soru-Cevap + Özet`  [INFERRED]
  CLAUDE.md → src/content/books-qa/1JlqnQCbEoW5DGVOXte4O88AdSofFbH2Z.yaml
- `CI Pipeline (test + build + Lighthouse + Playwright)` --implements--> `Spec Kalite Kapıları (Lighthouse ≥95, ~0 client JS)`  [INFERRED]
  .github/workflows/ci.yml → blog-implementasyon-prompt-ysfblog.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **NotebookLM Kitap İçerik Koleksiyonu (books-qa + book-extras)** — src_content_books_qa_1ai2wb1aane0sgrsrqxrdfwf1ag817iid_ted_gibi_konus, src_content_books_qa_1gd6osks6fashvzxdjo8afjwelx6de_2g_ogrenme_teknikleri, src_content_books_qa_1jlqnqcbeow5dgvoxte4o88adsoffbh2z_mindset_ozet, src_content_books_qa_1t72b7ncqk1geq7mdfvwiwahcxiq4cqel_irade_terbiyesi, src_content_books_qa_1bc8fvyxzog_bhvbzexsrmyk9sa9xw5em_yaraticilik_ozeti, src_content_books_qa_1rkg62k1l7vpbc_bglojld_vavsx2ebmt_the_optimist, src_content_books_qa_1ywyckwndayf6wkjxhrhxnju_15grgelx_coder_cafe, src_content_book_extras_zihniyet_mindset_modules [EXTRACTED 1.00]
- **Agent Workflow Konvansiyonları** — claude_architecture_constitution, docs_agents_domain_domain_docs_convention, docs_agents_issue_tracker_github_issue_conventions, docs_agents_triage_labels_triage_label_mapping [EXTRACTED 1.00]
- **Puan Ekonomisi Akışı** — claude_points_ledger_single_source, claude_award_points_gateway, claude_economy_guards, claude_league_season_system, claude_bilgi_hazinesi_onboarding [EXTRACTED 1.00]
- **Kütüphanem NotebookLM knowledge ecosystem** — src_content_projeler_kutuphanem, src_content_posts_tr_notebooklm_ile_ogrenme, src_content_stories_kutuphane_grafigi, src_content_posts_tr_merhaba_dunya, src_content_posts_en_hello_world, src_content_posts_tr_notebooklm_ile_ogrenme_notebooklm [INFERRED 0.85]
- **Homepage story ring feed** — src_content_stories_yeni_yazi_notebooklm, src_content_stories_astro_video, src_content_stories_kutuphane_grafigi [INFERRED 0.75]

## Communities (65 total, 9 thin omitted)

### Community 0 - "Dev Bağımlılıkları"
Cohesion: 0.04
Nodes (45): @astrojs/check, drizzle-kit, @lhci/cli, devDependencies, @astrojs/check, drizzle-kit, @lhci/cli, pagefind (+37 more)

### Community 1 - "Site İskeleti & Kütüphane UI"
Cohesion: 0.09
Nodes (14): data, durumEtiket, t, string, localizePath(), useTranslations(), KATEGORILER, t (+6 more)

### Community 2 - "Yazı Yayın Hattı"
Cohesion: 0.09
Nodes (26): styles, enabled, t, renderOgImage(), findTranslation(), getPublishedPosts(), Post, postPath() (+18 more)

### Community 3 - "Çalışma Zamanı Bağımlılıkları"
Cohesion: 0.05
Nodes (41): @astrojs/mdx, @astrojs/react, @astrojs/rss, @astrojs/sitemap, @astrojs/vercel, @clerk/astro, @clerk/localizations, @keystatic/astro (+33 more)

### Community 4 - "Üyelik & Üye API'leri"
Cohesion: 0.09
Nodes (25): renderMemberMarkdown(), slugifyTitle(), Ctx, getOrCreateMember(), Member, OWNER_EMAILS, slugifyHandle(), POST() (+17 more)

### Community 5 - "DB Şeması & Demo Seed"
Cohesion: 0.05
Nodes (36): booksJson, db, kitapId(), kur(), tumKitaplar, applications, badges, bookAccess (+28 more)

### Community 6 - "Topluluk Sayfaları"
Cohesion: 0.07
Nodes (23): sekmeler, BookData, bookTitle(), getBookMap(), groupByCategory(), FEATURED_GIFT_BOOK_ID, R, getEarnedMap() (+15 more)

### Community 7 - "Hikâyeler & Motion"
Cohesion: 0.11
Nodes (31): ogrenMenu, easeOutExpo(), initHeader(), initMotion(), initProgress(), initReveal(), initTicker(), closePop() (+23 more)

### Community 8 - "Mimari Anayasa & Bilgi Tabanı"
Cohesion: 0.07
Nodes (36): CI Pipeline (test + build + Lighthouse + Playwright), i18n Yönlendirme Tasarımı (tr prefix'siz, /en/ prefix'li), MDX Bileşen Kütüphanesi (YouTube, Callout, D3Chart, Kaynaklar), Spec Kalite Kapıları (Lighthouse ≥95, ~0 client JS), Kişisel Blog İmplementasyon Spesifikasyonu (orijinal), CLAUDE.md — Mimari Anayasa, awardPoints() Puan Kapısı, Bilgi Hazinesi Onboarding (+28 more)

### Community 9 - "Kitap Senkron Betikleri"
Cohesion: 0.08
Nodes (29): BookTitle, DEDUPE_NOISE, dedupeKey(), normalizeForMatch(), parseBookFileName(), titleMatchScore(), allFiles, byTitle (+21 more)

### Community 10 - "İçerik Şemaları & Tipler"
Cohesion: 0.09
Nodes (18): bookExtras, books, booksQa, collections, libraryCategories, libraryNotebooks, notebookIds, posts (+10 more)

### Community 11 - "Yetkiler & Kampanya-Görev"
Cohesion: 0.21
Nodes (14): gorevOdulKirp(), GUNLUK_BEGENI_PUAN_SINIRI, KULUP_HAFTALIK_TAVAN, canManage(), canManageGlobal(), ClubRole, clubRoleOf(), haftalikGorevHarcamasi() (+6 more)

### Community 12 - "Puan Ödül Motoru"
Cohesion: 0.18
Nodes (19): activateReferralIfFirstPost(), scoreQuiz(), awardBadge(), awardPoints(), BadgeKind, hazineKitabiAc(), kazanilan(), Reason (+11 more)

### Community 13 - "Okuma Kapısı & Ekonomi"
Cohesion: 0.17
Nodes (15): hasBookAccess(), pointBalance(), PUAN, POST(), prerender, POST(), prerender, POST() (+7 more)

### Community 14 - "Kulüp Ligi & Günlük Cron"
Cohesion: 0.20
Nodes (17): aktifSezon(), ayPenceresi(), kulupIciSiralama(), kulupSiralamasi(), KulupSkoru, normalizeSkor(), pozitifPuanlar(), sezonAdi() (+9 more)

### Community 15 - "DB İstemcisi & Seviyeler"
Cohesion: 0.25
Nodes (10): Db, LEVEL_THRESHOLDS, levelFor(), pointsToNextLevel(), earnedPoints(), parseYoutubeId(), POST(), prerender (+2 more)

### Community 16 - "Ders Modülleri"
Cohesion: 0.15
Nodes (9): id, id, lang, bilesen, driveFileId(), spotifyEmbedUrl(), youtubeId(), embed (+1 more)

### Community 17 - "i18n Çekirdeği"
Cohesion: 0.20
Nodes (10): lang, t, t, t, visible, en, dicts, langFromUrl() (+2 more)

### Community 18 - "Blog İçeriği & Projeler"
Cohesion: 0.21
Nodes (17): Hello: Why does this blog exist? (EN manifesto post), Merhaba: Bu blog neden var? (TR manifesto post), NotebookLM ile Katmanlı Öğrenme Sistemi (post), Building a Second Brain — Tiago Forte, How to Take Smart Notes — Sönke Ahrens, Katmanlı Defter Mimarisi (kaynak → kategori → köprü defterleri), NotebookLM, Kütüphanem — Zihin Haritası (project) (+9 more)

### Community 19 - "Yazı Düzeni Bileşenleri"
Cohesion: 0.17
Nodes (10): encoded, t, targets, canonicalUrl, okumaSuresi, t, translation, formatDate() (+2 more)

### Community 20 - "TypeScript Yapılandırması"
Cohesion: 0.13
Nodes (14): astro/tsconfigs/strict, .astro/types.d.ts, dist, scripts/**/*, src/**/*, tests/**/*, compilerOptions, allowImportingTsExtensions (+6 more)

### Community 21 - "Ana Sayfa & URL Yardımcıları"
Cohesion: 0.16
Nodes (8): [], nodes, t, KUTUPHANEM_URL, posts, t, posts, t

### Community 22 - "Arşiv & Kategori Sayfaları"
Cohesion: 0.18
Nodes (8): t, CATEGORIES, getStaticPaths, t, getStaticPaths, getStaticPaths, t, getStaticPaths

### Community 23 - "llms.txt Üretici"
Cohesion: 0.31
Nodes (8): collectPosts(), DIST, llms, llmsFull, parseFrontmatter(), PostMeta, POSTS_DIR, urlFor()

### Community 24 - "Kütüphanem Senkronu"
Cohesion: 0.31
Nodes (6): extractConstObject(), KutuphanemData, main(), OUT_PATH, RawNode, ROOT

### Community 25 - "Keystatic Yapılandırması"
Cohesion: 0.25
Nodes (4): bookCategoryOptions, kategoriOptions, kaynakTuruOptions, notebookOptions

### Community 26 - "D3 Grafik Bileşeni"
Cohesion: 0.39
Nodes (6): [], answer(), clientQuestions, el(), prerender, showQuestion()

### Community 27 - "Quiz Puanlama"
Cohesion: 0.33
Nodes (3): ScoreAnswer, ScoreQuestion, ScoreResult

### Community 28 - "OG Görsel Render"
Cohesion: 0.40
Nodes (4): fontDir, fonts, KATEGORI_RENK, OgInput

### Community 29 - "Ekonomi Korumaları"
Cohesion: 0.60
Nodes (4): likePuaniVerilirMi(), POST(), prerender, sonSaniyelerdeVarMi()

### Community 30 - "Üye Profili"
Cohesion: 0.40
Nodes (4): ilListesi, PLATFORMLAR, prerender, socials

### Community 31 - "Astro İçerik Yazısı"
Cohesion: 0.67
Nodes (4): Astro Content Collections ile Tip Güvenli Blog (post), Astro Content Layer intro video (YouTube glwocSx1X8E), Astro Content Layer API + Zod Schema Validation, Story: Astro içerik videosu (YouTube link ring)

### Community 32 - "SEO Bileşeni"
Cohesion: 0.50
Nodes (3): canonical, lang, ogImage

## Knowledge Gaps
- **284 isolated node(s):** `env`, `bookCategoryOptions`, `notebookOptions`, `kategoriOptions`, `kaynakTuruOptions` (+279 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getOrCreateMember()` connect `Üyelik & Üye API'leri` to `Topluluk Sayfaları`, `Yetkiler & Kampanya-Görev`, `Puan Ödül Motoru`, `Okuma Kapısı & Ekonomi`, `Kulüp Ligi & Günlük Cron`, `DB İstemcisi & Seviyeler`, `D3 Grafik Bileşeni`, `Ekonomi Korumaları`, `Üye Profili`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `Db` connect `DB İstemcisi & Seviyeler` to `Üyelik & Üye API'leri`, `Topluluk Sayfaları`, `Yetkiler & Kampanya-Görev`, `Puan Ödül Motoru`, `Okuma Kapısı & Ekonomi`, `Kulüp Ligi & Günlük Cron`, `D3 Grafik Bileşeni`, `Ekonomi Korumaları`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `useTranslations()` connect `Site İskeleti & Kütüphane UI` to `Yazı Yayın Hattı`, `Okuma Kapısı & Ekonomi`, `DB İstemcisi & Seviyeler`, `i18n Çekirdeği`, `Yazı Düzeni Bileşenleri`, `Ana Sayfa & URL Yardımcıları`, `Arşiv & Kategori Sayfaları`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `env`, `bookCategoryOptions`, `notebookOptions` to the rest of the system?**
  _284 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dev Bağımlılıkları` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `Site İskeleti & Kütüphane UI` be split into smaller, more focused modules?**
  _Cohesion score 0.08773784355179703 - nodes in this community are weakly interconnected._
- **Should `Yazı Yayın Hattı` be split into smaller, more focused modules?**
  _Cohesion score 0.09407665505226481 - nodes in this community are weakly interconnected._