# Graph Report - ysf-blog  (2026-10-12)

## Corpus Check
- 333 files · ~812,373 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1776 nodes · 3383 edges · 175 communities (132 shown, 43 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e68de715`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- scripts
- Base.astro
- posts.ts
- dependencies
- katilimcilar.csv.ts
- db/schema.ts
- etkinlik/[slug].astro
- initStories
- CLAUDE.md — Mimari Anayasa
- sync-drive-books.ts
- content.config.ts
- gorev.ts
- rewards.ts
- kulup/[slug].astro
- gunluk.ts
- ArchiveView.astro
- Organizations (B2B SaaS)
- index.ts
- NotebookLM ile Katmanlı Öğrenme Sistemi (post)
- PostLayout.astro
- tsconfig.json
- LibraryView.astro
- etkinlik-kural.ts
- generate-llms-txt.ts
- sync-kutuphanem.ts
- keystatic.config.tsx
- []
- quiz.ts
- kart.ts
- Adding Clerk
- uye/davet.ts
- Astro Content Collections ile Tip Güvenli Blog (post)
- Db
- slugs.ts
- astro.config.mjs
- lib/mesaj.ts
- check-build-output.mjs
- vercel.json
- Yaratıcılık ve Sanatçının Zihniyeti Kitabı — Özet (78 bölüm)
- The Optimist: Sam Altman (Keach Hagey) — Kitap Özeti
- karsilama.ts
- yurtlarburada (project)
- compilerOptions
- Neon
- clerk-backend-api/SKILL.md
- What You Must Do When Invoked
- nextjs-basic-auth/package.json
- OkumaKapisi.astro
- Webhooks
- Custom Sign-In Flow
- Custom Sign-Up Flow
- `<Show>` Component
- Lakebase Postgres
- Custom UI
- Next.js Patterns
- Sign-In Flow
- Custom Sign-Up Flow (Core 2)
- Organization Invitations
- Roles and Permissions
- Enterprise SSO
- Server vs Client
- Framework-Specific Webhook Handlers
- graphify reference: extra exports and benchmark
- Middleware Strategies
- Next.js Patterns for Organizations
- graphify reference: query, path, explain
- Kitap Özeti (NotebookLM → books-qa ozet alanı)
- API Routes
- Caching with Auth
- Server Actions
- Language
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- Kitap Analizi (NotebookLM → books-qa)
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- Kitaplık Senkronu (Google Drive → books.json)
- Defterden Yazı Taslağı (NotebookLM → MDX)
- api-specs-context.sh
- execute-request.sh
- extract-endpoint-detail.sh
- extract-tag-endpoints.sh
- proxy.ts
- CLAUDE.md
- extraction-spec.md
- Faz 1 — Kurslar (13 issue)
- ADR 0001 — Kurslar · Davet kartı/QR · Etkinlik girişi · Harita/DM
- 4. Özellikler
- lib/davet.ts
- league.ts
- en/index.astro
- getOrCreateMember
- parse.ts
- kitap-onizleme.ts
- assumptions.md
- ideas.md
- Seo.astro
- lib/etkinlik.ts
- egitim.ts
- markdown.ts
- client.ts
- seed-demo.ts
- uye/etkinlik.ts
- giris-kuyrugu.test.ts
- @astrojs/mdx
- @astrojs/rss
- @astrojs/sitemap
- @astrojs/vercel
- @clerk/astro
- @clerk/localizations
- @keystatic/astro
- @keystatic/core
- motion
- @neondatabase/serverless
- d3
- drizzle-orm
- leaflet
- marked
- pdf-lib
- react
- react-dom
- @resvg/resvg-js
- satori
- sharp
- @shikijs/transformers
- uqr
- etkinlik-db.test.ts
- il-sinirlari-cek.ts
- urls.ts
- davet-db.test.ts
- [etkinlik]/[token].astro
- biletGiris
- hediye-et.ts
- mesaj-db.test.ts
- [dosya].ts
- mesaj.spec.ts
- siteKok
- ekonomi-db.test.ts

## God Nodes (most connected - your core abstractions)
1. `getOrCreateMember()` - 89 edges
2. `Db` - 72 edges
3. `R` - 37 edges
4. `useTranslations()` - 28 edges
5. `PUAN` - 26 edges
6. `awardPoints()` - 25 edges
7. `etkinlikBitis()` - 24 edges
8. `getPublishedPosts()` - 23 edges
9. `POST()` - 20 edges
10. `trSaat()` - 19 edges

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
- **Agent Workflow Konvansiyonları** — claude_architecture_constitution, docs_agents_domain_domain_docs_convention, docs_agents_issue_tracker_github_issue_conventions, docs_agents_triage_labels_triage_label_mapping [EXTRACTED 1.00]
- **NotebookLM Kitap İçerik Koleksiyonu (books-qa + book-extras)** — src_content_books_qa_1ai2wb1aane0sgrsrqxrdfwf1ag817iid_ted_gibi_konus, src_content_books_qa_1gd6osks6fashvzxdjo8afjwelx6de_2g_ogrenme_teknikleri, src_content_books_qa_1jlqnqcbeow5dgvoxte4o88adsoffbh2z_mindset_ozet, src_content_books_qa_1t72b7ncqk1geq7mdfvwiwahcxiq4cqel_irade_terbiyesi, src_content_books_qa_1bc8fvyxzog_bhvbzexsrmyk9sa9xw5em_yaraticilik_ozeti, src_content_books_qa_1rkg62k1l7vpbc_bglojld_vavsx2ebmt_the_optimist, src_content_books_qa_1ywyckwndayf6wkjxhrhxnju_15grgelx_coder_cafe, src_content_book_extras_zihniyet_mindset_modules [EXTRACTED 1.00]
- **Puan Ekonomisi Akışı** — claude_points_ledger_single_source, claude_award_points_gateway, claude_economy_guards, claude_league_season_system, claude_bilgi_hazinesi_onboarding [EXTRACTED 1.00]
- **Homepage story ring feed** — src_content_stories_yeni_yazi_notebooklm, src_content_stories_astro_video, src_content_stories_kutuphane_grafigi [INFERRED 0.75]
- **Kütüphanem NotebookLM knowledge ecosystem** — src_content_projeler_kutuphanem, src_content_posts_tr_notebooklm_ile_ogrenme, src_content_stories_kutuphane_grafigi, src_content_posts_tr_merhaba_dunya, src_content_posts_en_hello_world, src_content_posts_tr_notebooklm_ile_ogrenme_notebooklm [INFERRED 0.85]

## Communities (175 total, 43 thin omitted)

### Community 0 - "scripts"
Cohesion: 0.04
Nodes (46): @astrojs/check, @clerk/testing, drizzle-kit, @lhci/cli, devDependencies, @astrojs/check, @clerk/testing, drizzle-kit (+38 more)

### Community 1 - "Base.astro"
Cohesion: 0.10
Nodes (9): durumEtiket, t, string, localizePath(), projeler, t, prerender, projeler (+1 more)

### Community 2 - "posts.ts"
Cohesion: 0.09
Nodes (24): styles, enabled, t, Lang, findTranslation(), getPublishedPosts(), Post, postPath() (+16 more)

### Community 3 - "dependencies"
Cohesion: 0.29
Nodes (7): @astrojs/react, dependencies, astro, @astrojs/react, lite-youtube-embed, astro, lite-youtube-embed

### Community 4 - "katilimcilar.csv.ts"
Cohesion: 0.39
Nodes (7): etkinlikBul(), csvUret(), yonetebilirMi(), an(), GET(), prerender, YONTEM

### Community 5 - "db/schema.ts"
Cohesion: 0.05
Nodes (42): applications, badges, blocks, bookAccess, campaigns, campaignTasks, campaignVotes, clubBooks (+34 more)

### Community 6 - "etkinlik/[slug].astro"
Cohesion: 0.17
Nodes (13): kayitSayilari(), biletQrIcerigi(), degerlendirmeAcikMi(), DONEN_PENCERE_SN, etkinlikBitis(), KAPI_ACILIS_DK, trAralik(), TUR_AD (+5 more)

### Community 7 - "initStories"
Cohesion: 0.14
Nodes (28): ogrenMenu, easeOutExpo(), initHeader(), initMotion(), initProgress(), initReveal(), initTicker(), closePop() (+20 more)

### Community 8 - "CLAUDE.md — Mimari Anayasa"
Cohesion: 0.07
Nodes (36): CI Pipeline (test + build + Lighthouse + Playwright), i18n Yönlendirme Tasarımı (tr prefix'siz, /en/ prefix'li), MDX Bileşen Kütüphanesi (YouTube, Callout, D3Chart, Kaynaklar), Spec Kalite Kapıları (Lighthouse ≥95, ~0 client JS), Kişisel Blog İmplementasyon Spesifikasyonu (orijinal), CLAUDE.md — Mimari Anayasa, awardPoints() Puan Kapısı, Bilgi Hazinesi Onboarding (+28 more)

### Community 9 - "sync-drive-books.ts"
Cohesion: 0.09
Nodes (25): BookTitle, DEDUPE_NOISE, dedupeKey(), normalizeForMatch(), parseBookFileName(), titleMatchScore(), allFiles, byTitle (+17 more)

### Community 10 - "content.config.ts"
Cohesion: 0.10
Nodes (16): bookExtras, books, booksQa, collections, libraryCategories, libraryNotebooks, notebookIds, posts (+8 more)

### Community 11 - "gorev.ts"
Cohesion: 0.21
Nodes (13): gorevOdulKirp(), canManage(), canManageGlobal(), ClubRole, clubRoleOf(), haftalikGorevHarcamasi(), POST(), prerender (+5 more)

### Community 12 - "rewards.ts"
Cohesion: 0.15
Nodes (16): BadgeKind, Bekleyen, bekleyeniKesinlestir(), bekleyenleriIsle(), DAVET_REASONLARI, gunBicimi, kazanilan(), ledgerDeltaSql() (+8 more)

### Community 13 - "kulup/[slug].astro"
Cohesion: 0.07
Nodes (38): etkinlikGorunurSql, trSaat(), trTarih(), HaritaEtkinlik, haritaEtkinlikleri(), HaritaFiltre, HaritaIl, HaritaUye (+30 more)

### Community 14 - "gunluk.ts"
Cohesion: 0.24
Nodes (15): birKez(), birKezCalistir(), etkinlikSonrasiIsle(), kulupIciSiralama(), kulupSiralamasi(), pozitifPuanlar(), awardBadge(), hazineKitabiAc() (+7 more)

### Community 15 - "ArchiveView.astro"
Cohesion: 0.20
Nodes (9): t, CATEGORIES, Category, KaynakTuru, getStaticPaths, t, getStaticPaths, getStaticPaths (+1 more)

### Community 16 - "Organizations (B2B SaaS)"
Cohesion: 0.06
Nodes (31): 1. Read Organization from Auth, 2. Dynamic Routes with Org Slug, 3. Role-Based Access Control, 4. Conditional Rendering with `<Show>`, 5. OrganizationSwitcher, 6. Session Task — Choose Organization, Agent-first: Programmatic org management, Authorization Pattern (Complete Example) (+23 more)

### Community 17 - "index.ts"
Cohesion: 0.16
Nodes (14): t, t, visible, renderOgImage(), en, dicts, langFromUrl(), useTranslations() (+6 more)

### Community 18 - "NotebookLM ile Katmanlı Öğrenme Sistemi (post)"
Cohesion: 0.21
Nodes (17): Hello: Why does this blog exist? (EN manifesto post), Merhaba: Bu blog neden var? (TR manifesto post), NotebookLM ile Katmanlı Öğrenme Sistemi (post), Building a Second Brain — Tiago Forte, How to Take Smart Notes — Sönke Ahrens, Katmanlı Defter Mimarisi (kaynak → kategori → köprü defterleri), NotebookLM, Kütüphanem — Zihin Haritası (project) (+9 more)

### Community 19 - "PostLayout.astro"
Cohesion: 0.19
Nodes (8): encoded, t, targets, canonicalUrl, okumaSuresi, t, translation, readingTimeMinutes()

### Community 20 - "tsconfig.json"
Cohesion: 0.13
Nodes (14): astro/tsconfigs/strict, .astro/types.d.ts, dist, scripts/**/*, src/**/*, tests/**/*, compilerOptions, allowImportingTsExtensions (+6 more)

### Community 21 - "LibraryView.astro"
Cohesion: 0.19
Nodes (9): data, lang, t, Kategori, KategoriKaydi, KATEGORILER, kayitlar, KURALLAR (+1 more)

### Community 22 - "etkinlik-kural.ts"
Cohesion: 0.11
Nodes (30): gorevliHizAsildiMi(), base32(), BILET_IMZA_UZUNLUK, biletCoz(), biletToken(), csvHucre(), DONEN_IMZA_UZUNLUK, donenGecerli() (+22 more)

### Community 23 - "generate-llms-txt.ts"
Cohesion: 0.24
Nodes (10): collectPosts(), DIST, hedefler, llms, llmsFull, parseFrontmatter(), PostMeta, POSTS_DIR (+2 more)

### Community 24 - "sync-kutuphanem.ts"
Cohesion: 0.31
Nodes (6): extractConstObject(), KutuphanemData, main(), OUT_PATH, RawNode, ROOT

### Community 25 - "keystatic.config.tsx"
Cohesion: 0.25
Nodes (4): bookCategoryOptions, kategoriOptions, kaynakTuruOptions, notebookOptions

### Community 26 - "[]"
Cohesion: 0.60
Nodes (6): [], answer(), clientQuestions, el(), prerender, showQuestion()

### Community 27 - "quiz.ts"
Cohesion: 0.27
Nodes (6): ScoreAnswer, ScoreQuestion, scoreQuiz(), ScoreResult, POST(), prerender

### Community 28 - "kart.ts"
Cohesion: 0.16
Nodes (17): Agac, dataUri(), el(), KART_BOYUT, KartFormat, renderDavetKarti(), renderDavetKartiDetay(), RENK (+9 more)

### Community 29 - "Adding Clerk"
Cohesion: 0.06
Nodes (30): 1. Detect the Framework, 2. Fetch the Quickstart Guide, 3. Follow the Instructions, 4. Get API Keys, Adding Clerk, Agent-first: Provision via CLI, ClerkProvider Placement (Next.js), Common Pitfalls (+22 more)

### Community 30 - "uye/davet.ts"
Cohesion: 0.15
Nodes (16): davetKoduUret(), SV4_PUAN, SIKAYET_SAATLIK, SIKAYET_TURLERI, sikayetKaydet(), SikayetTuru, sikayetTuruMu(), guvenliYol() (+8 more)

### Community 31 - "Astro Content Collections ile Tip Güvenli Blog (post)"
Cohesion: 0.67
Nodes (4): Astro Content Collections ile Tip Güvenli Blog (post), Astro Content Layer intro video (YouTube glwocSx1X8E), Astro Content Layer API + Zod Schema Validation, Story: Astro içerik videosu (YouTube link ring)

### Community 32 - "Db"
Cohesion: 0.34
Nodes (7): Db, LEVEL_THRESHOLDS, levelFor(), pointsToNextLevel(), earnedPoints(), POST(), prerender

### Community 35 - "lib/mesaj.ts"
Cohesion: 0.06
Nodes (66): DM_AZAMI_UZUNLUK, DM_GUNLUK_YENI_KONUSMA, DM_PENCERE_LIMIT, DM_PENCERE_SN, DM_POLITIKALARI, DM_YANITSIZ_SINIR, DmDurum, dmKarar (+58 more)

### Community 36 - "check-build-output.mjs"
Cohesion: 0.29
Nodes (5): beklenen, kitapSayfalari, ADR-0001, sirDesenleri, sizanKitap

### Community 52 - "karsilama.ts"
Cohesion: 0.27
Nodes (9): DAKIKADA_ISTEK, karsila(), davetCereziKur(), davetCoz(), davetHedefi, etkinlikDaveti, kisaHash(), kodNormalize() (+1 more)

### Community 65 - "compilerOptions"
Cohesion: 0.07
Nodes (26): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+18 more)

### Community 66 - "Neon"
Cohesion: 0.07
Nodes (26): Architecture: How to Use Neon, Backend Primitives, Branch configuration, Branch-First Dev Flow, Choosing the Right Skill, Fetching Docs as Markdown, Finding the Right Page, Getting Started with Neon (+18 more)

### Community 67 - "clerk-backend-api/SKILL.md"
Cohesion: 0.08
Nodes (25): 0. Print usage, 1. Fetch tags, 2. Fetch tag endpoints, 3. Fetch endpoint detail, 4. Execute request, API specs context, Clerk Backend API — Full Endpoint Reference, Create organization + invite member (two-step) (+17 more)

### Community 68 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 69 - "nextjs-basic-auth/package.json"
Cohesion: 0.09
Nodes (21): dependencies, @clerk/nextjs, next, react, react-dom, devDependencies, @types/react, @types/react-dom (+13 more)

### Community 70 - "OkumaKapisi.astro"
Cohesion: 0.17
Nodes (9): pointBalance(), FEATURED_GIFT_BOOK_ID, books, featured, prerender, vitrindekiler, durum, FLAIRLER (+1 more)

### Community 71 - "Webhooks"
Cohesion: 0.10
Nodes (19): Common Pitfalls, Complete Webhook Handler (Next.js App Router), Full Example: Organization Membership Sync to Database, Full Example: Welcome Email (Resend) + Slack Notification on user.created, Make the Webhook Route Public, Organization events (`organization.created`, `organization.updated`, `organization.deleted`), Organization Membership events (`organizationMembership.created`, `organizationMembership.updated`, `organizationMembership.deleted`), Other Frameworks (+11 more)

### Community 72 - "Custom Sign-In Flow"
Cohesion: 0.11
Nodes (18): Complete Example: Email/Password with MFA, Custom Sign-In Flow, Device Trust, Docs, Email Code, Error Handling, Finalizing Sign-In, Hook API (+10 more)

### Community 73 - "Custom Sign-Up Flow"
Cohesion: 0.11
Nodes (17): Complete Example: Phone OTP Sign-Up, Custom Sign-Up Flow, Docs, Email Code, Email Link, Email / Phone Verification, Error Handling, Finalizing Sign-Up (+9 more)

### Community 74 - "`<Show>` Component"
Cohesion: 0.12
Nodes (15): Authentication State, Billing Feature Check, Billing Plan Check, Custom Condition (Function), Docs, Fallback Content, Import, Migration from Core 2 (+7 more)

### Community 75 - "Lakebase Postgres"
Cohesion: 0.12
Nodes (15): 1. Select the organization and project, 2. Get the connection string, 3. Pick the connection method and driver, 4. Set up the schema, Autoscaling, Branching, Connection Pooling, Instant Restore (+7 more)

### Community 76 - "Custom UI"
Cohesion: 0.14
Nodes (13): Appearance Customization, Appearance Pattern, Common Pitfalls, Component Customization Options, Custom Flow References, Custom UI, options (structure, logo, social buttons), See Also (+5 more)

### Community 77 - "Next.js Patterns"
Cohesion: 0.14
Nodes (13): Common Pitfalls, Conditional Rendering with `<Show>`, Docs, getToken() for external APIs, Manual JWT verification (no Clerk middleware), Mental Model, Minimal Pattern, Next.js Patterns (+5 more)

### Community 78 - "Sign-In Flow"
Cohesion: 0.15
Nodes (12): 1. Create Sign-In, 2. First Factor Verification, 3. Second Factor (MFA), 4. Finalize, Complete Example: Email/Password with MFA, Custom Sign-In Flow (Core 2), Docs, Error Handling (+4 more)

### Community 79 - "Custom Sign-Up Flow (Core 2)"
Cohesion: 0.17
Nodes (11): 1. Create Sign-Up, 2. Prepare Verification, 3. Attempt Verification, 4. Finalize, Complete Example: Email/Password with Email Verification, Custom Sign-Up Flow (Core 2), Docs, Error Handling (+3 more)

### Community 80 - "Organization Invitations"
Cohesion: 0.18
Nodes (10): Accept Invitations (Custom Flow), Built-in Invitation UI, Bulk Create, Create Invitation, Get a Single Invitation, Key Rules, List Invitations, Organization Invitations (+2 more)

### Community 81 - "Roles and Permissions"
Cohesion: 0.18
Nodes (10): Billing Gates Permissions, Change a User's Role, Checking Roles and Permissions, Custom Permissions, Custom Roles, Default Roles, Key Rules, Role Sets (+2 more)

### Community 82 - "Enterprise SSO"
Cohesion: 0.20
Nodes (9): Accessing SSO Info on the User, Common Mistakes, Configuration Flow, Custom Sign-In Flow with SSO, Enterprise SSO, JIT Provisioning (how SSO users auto-join), Key Rules, Strategy Name (+1 more)

### Community 83 - "Server vs Client"
Cohesion: 0.22
Nodes (8): Client Component, Conditional Rendering, CRITICAL: Always `await auth()`, Hybrid Pattern, Import Rules, Server Component, Server vs Client, When to Use

### Community 84 - "Framework-Specific Webhook Handlers"
Cohesion: 0.22
Nodes (8): Astro, Common Patterns Across Frameworks, Express, Fastify, Framework-Specific Webhook Handlers, Nuxt, React Router, TanStack Start

### Community 85 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 86 - "Middleware Strategies"
Cohesion: 0.29
Nodes (6): Middleware Strategies, Permission-Gated Routes, Protected-First (internal tools, dashboards), Public-First (marketing sites, blogs), Session Tasks, Token-Based Protection (Machine APIs)

### Community 87 - "Next.js Patterns for Organizations"
Cohesion: 0.29
Nodes (6): API Route Example, Key Rules, Middleware: Role + Permission Protection, Next.js Patterns for Organizations, Server Actions: Scope Writes by `orgId`, URL Slug Safety Invariant

### Community 88 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 89 - "Kitap Özeti (NotebookLM → books-qa ozet alanı)"
Cohesion: 0.33
Nodes (5): Adım 1 — Yapı çıkarımı, Adım 2 — Parça parça yeniden anlatım (5 sorgu), Adım 3 — YAML'a yaz, Adım 4 — Doğrula, Kitap Özeti (NotebookLM → books-qa ozet alanı)

### Community 90 - "API Routes"
Cohesion: 0.40
Nodes (4): 401 vs 403, API Routes, Auth Check Pattern, Org Route Protection

### Community 91 - "Caching with Auth"
Cohesion: 0.40
Nodes (4): Caching with Auth, Org-Scoped Cache, Revalidate After Updates, User-Scoped Cache

### Community 92 - "Server Actions"
Cohesion: 0.40
Nodes (4): Basic Protection, Org + Role Check (B2B), Permission Check (RBAC), Server Actions

### Community 93 - "Language"
Cohesion: 0.29
Nodes (6): Bilgi Ödüldür, Büyüme, Harita ve mesaj, Kurs ve etkinlik, Kütüphane, Language

### Community 94 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 95 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 96 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 97 - "Kitap Analizi (NotebookLM → books-qa)"
Cohesion: 0.50
Nodes (3): Adımlar, Kitap Analizi (NotebookLM → books-qa), Sabit soru seti (4 katman × 3 soru)

### Community 112 - "Faz 1 — Kurslar (13 issue)"
Cohesion: 0.05
Nodes (41): F1-00 · Davet çerezi hotfix (canlı bug), F1-01 · Kurs görünürlük ve onay kapıları (güvenlik önkoşulu), F1-02 · `courses` yeni alanlar, slug, "en az 3 geçerli öğe", F1-03 · Rotalar: `/kurslar`, `/kurslar/[slug]`, 301'ler, sekme adı, F1-04 · Herkese açık SSR/SEO, F1-05 · Katılım: `course_enrollments`, "Kursa katıl", aktivasyon, F1-06 · Üretici puanları, asgari süre, atomik tavan, bekleyen puan, F1-07 · Soru-cevap: öğe altı yorum, cevap beğenisi, en iyi cevap (+33 more)

### Community 113 - "ADR 0001 — Kurslar · Davet kartı/QR · Etkinlik girişi · Harita/DM"
Cohesion: 0.08
Nodes (24): 0. Bağlam: PRD'nin kodla çelişen ya da yanlış varsayan noktaları, 7. reason → refId tablosu (tek kaynak), 8. Faz 0 kapanışında doğrulanmış / bekleyen, ADR 0001 — Kurslar · Davet kartı/QR · Etkinlik girişi · Harita/DM, Belirsiz (çalıştırılmadı), Faz başına şema dilimi, K1.1 Üç ilkel, öncelik sırasıyla (yeni ilkel yok), K1.2 `db.batch` (+16 more)

### Community 114 - "4. Özellikler"
Cohesion: 0.10
Nodes (19): 0. Rolün ve kuralların, 1. Mevcut durum ve hedef, 2. Ürün ilkeleri (belirsiz durumda bunlara göre karar ver), 3. Önce kapatılacak açıklar, 4.1 Kurslar (Dersler'in evrimi), 4.2 Puan kuralları, 4.3 Davet kartı ve QR (kurs ve etkinlik için ortak), 4.4 Topluluklarımız (+11 more)

### Community 115 - "lib/davet.ts"
Cohesion: 0.13
Nodes (21): bildir(), CROCKFORD, DAVET_CEREZ, davetAktivasyonu(), davetBitirme(), davetKanali(), davetSuresiDoldu(), Etkinlik (+13 more)

### Community 116 - "league.ts"
Cohesion: 0.26
Nodes (10): aktifSezon(), ayPenceresi(), KulupSkoru, normalizeSkor(), sezonAdi(), UyeSkoru, gunKey(), sonrakiStreak() (+2 more)

### Community 117 - "en/index.astro"
Cohesion: 0.11
Nodes (13): [], nodes, t, lang, bilesen, getActiveStories(), hasSlides(), Story (+5 more)

### Community 118 - "getOrCreateMember"
Cohesion: 0.11
Nodes (23): activateReferralIfFirstPost(), Ctx, getOrCreateMember(), OWNER_EMAILS, slugifyHandle(), awardPoints(), sayacRozetleri(), POST() (+15 more)

### Community 119 - "parse.ts"
Cohesion: 0.19
Nodes (7): id, id, driveFileId(), spotifyEmbedUrl(), youtubeId(), embed, id

### Community 127 - "Seo.astro"
Cohesion: 0.50
Nodes (3): canonical, lang, ogImage

### Community 128 - "lib/etkinlik.ts"
Cohesion: 0.12
Nodes (27): davetCereziOku(), davetCereziSil(), kursaKatil(), hostPaylari(), hostToplami(), iyiDegerlendirildiMi(), BiletSonucu, DegerlendirmeSonucu (+19 more)

### Community 129 - "egitim.ts"
Cohesion: 0.18
Nodes (15): asgariSureGectiMi(), Member, bildir(), bitirmeOdulleri(), Katilim, katilimBul(), Kurs, KURS_ACILIS_ESIGI (+7 more)

### Community 132 - "markdown.ts"
Cohesion: 0.36
Nodes (5): renderMemberMarkdown(), slugifyTitle(), uyeMarked, POST(), prerender

### Community 133 - "client.ts"
Cohesion: 0.09
Nodes (23): BookData, bookTitle(), getBookMap(), groupByCategory(), formatDate(), R, getEarnedMap(), getLevelsMap() (+15 more)

### Community 134 - "seed-demo.ts"
Cohesion: 0.32
Nodes (7): booksJson, db, etkinlikleriSil(), kitapId(), kur(), temizle(), tumKitaplar

### Community 135 - "uye/etkinlik.ts"
Cohesion: 0.22
Nodes (17): donenGiris(), etkinligiDegerlendir(), etkinlikAcikMi(), girisYap(), gorevliEkle(), gorevliHizAsildi(), gorevliRol, gorevliSil() (+9 more)

### Community 136 - "giris-kuyrugu.test.ts"
Cohesion: 0.31
Nodes (8): kuyrugaEkle(), KuyrukOgesi, kuyrukOku(), kuyruktanCikar(), tokenAyikla(), yeniOkumaMi(), for(), if()

### Community 162 - "etkinlik-db.test.ts"
Cohesion: 0.22
Nodes (5): Db, Dv, etkinlik(), Ev, Rw

### Community 163 - "il-sinirlari-cek.ts"
Cohesion: 0.29
Nodes (4): eksik, features, iller, Sonuc

### Community 164 - "urls.ts"
Cohesion: 0.31
Nodes (4): belgeGezintisiMi(), kullaniciGezintisiMi(), KORUMALI, onRequest

### Community 165 - "davet-db.test.ts"
Cohesion: 0.33
Nodes (3): Db, Dv, Rw

### Community 166 - "[etkinlik]/[token].astro"
Cohesion: 0.33
Nodes (4): METIN, otomatik, prerender, sayfa

### Community 167 - "biletGiris"
Cohesion: 0.67
Nodes (3): biletGiris(), POST(), prerender

### Community 168 - "hediye-et.ts"
Cohesion: 0.26
Nodes (9): hasBookAccess(), spendPoints(), POST(), prerender, POST(), prerender, FLAIRLER, POST() (+1 more)

### Community 169 - "mesaj-db.test.ts"
Cohesion: 0.17
Nodes (7): Db, Ec, Hr, Ms, Rw, Sk, UyeEk

### Community 170 - "[dosya].ts"
Cohesion: 0.25
Nodes (8): KartGirdi, qrIcerigi(), A6, DOSYA, GET(), KISA_TARIH, prerender, SEVIYE_AD

### Community 171 - "mesaj.spec.ts"
Cohesion: 0.40
Nodes (4): benimId(), db(), gonder(), Pin

### Community 172 - "siteKok"
Cohesion: 0.67
Nodes (3): siteKok(), GET(), prerender

## Knowledge Gaps
- **853 isolated node(s):** `api-specs-context.sh script`, `execute-request.sh script`, `extract-endpoint-detail.sh script`, `extract-tag-endpoints.sh script`, `name` (+848 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **43 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getOrCreateMember()` connect `getOrCreateMember` to `egitim.ts`, `markdown.ts`, `client.ts`, `etkinlik/[slug].astro`, `uye/etkinlik.ts`, `katilimcilar.csv.ts`, `gorev.ts`, `kulup/[slug].astro`, `etkinlik-kural.ts`, `[]`, `quiz.ts`, `uye/davet.ts`, `Db`, `lib/mesaj.ts`, `[etkinlik]/[token].astro`, `biletGiris`, `hediye-et.ts`, `siteKok`, `OkumaKapisi.astro`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `Db` connect `Db` to `lib/etkinlik.ts`, `egitim.ts`, `markdown.ts`, `client.ts`, `etkinlik/[slug].astro`, `uye/etkinlik.ts`, `katilimcilar.csv.ts`, `gorev.ts`, `rewards.ts`, `kulup/[slug].astro`, `gunluk.ts`, `etkinlik-kural.ts`, `[]`, `quiz.ts`, `uye/davet.ts`, `lib/mesaj.ts`, `[etkinlik]/[token].astro`, `hediye-et.ts`, `[dosya].ts`, `karsilama.ts`, `OkumaKapisi.astro`, `lib/davet.ts`, `league.ts`, `getOrCreateMember`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `gonder()` connect `mesaj.spec.ts` to `[etkinlik]/[token].astro`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `api-specs-context.sh script`, `execute-request.sh script`, `extract-endpoint-detail.sh script` to the rest of the system?**
  _853 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._
- **Should `Base.astro` be split into smaller, more focused modules?**
  _Cohesion score 0.10037878787878787 - nodes in this community are weakly interconnected._
- **Should `posts.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09146341463414634 - nodes in this community are weakly interconnected._