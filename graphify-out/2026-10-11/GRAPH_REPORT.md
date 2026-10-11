# Graph Report - ysf-blog  (2026-10-11)

## Corpus Check
- 294 files · ~757,781 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1477 nodes · 2388 edges · 132 communities (111 shown, 21 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bdb4ce15`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- scripts
- Base.astro
- posts.ts
- dependencies
- [dosya].ts
- db/schema.ts
- client.ts
- initStories
- CLAUDE.md — Mimari Anayasa
- sync-drive-books.ts
- content.config.ts
- gorev.ts
- rewards.ts
- getOrCreateMember
- gunluk.ts
- uye/index.astro
- Organizations (B2B SaaS)
- index.ts
- NotebookLM ile Katmanlı Öğrenme Sistemi (post)
- PostLayout.astro
- tsconfig.json
- en/index.astro
- ArchiveView.astro
- generate-llms-txt.ts
- sync-kutuphanem.ts
- keystatic.config.tsx
- []
- quiz-score.ts
- kart.ts
- Adding Clerk
- profil.astro
- Astro Content Collections ile Tip Güvenli Blog (post)
- Seo.astro
- slugs.ts
- astro.config.mjs
- middleware.ts
- check-build-output.mjs
- vercel.json
- Yaratıcılık ve Sanatçının Zihniyeti Kitabı — Özet (78 bölüm)
- The Optimist: Sam Altman (Keach Hagey) — Kitap Özeti
- useTranslations
- yurtlarburada (project)
- compilerOptions
- Neon
- clerk-backend-api/SKILL.md
- What You Must Do When Invoked
- nextjs-basic-auth/package.json
- member.ts
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
- economy.ts
- awardPoints
- urls.ts
- parse.ts
- kitap-onizleme.ts
- assumptions.md
- ideas.md
- league.ts
- davet-db.test.ts
- begeniPuaniVer

## God Nodes (most connected - your core abstractions)
1. `getOrCreateMember()` - 69 edges
2. `Db` - 55 edges
3. `useTranslations()` - 28 edges
4. `getPublishedPosts()` - 23 edges
5. `awardPoints()` - 23 edges
6. `PUAN` - 19 edges
7. `levelFor()` - 18 edges
8. `POST()` - 17 edges
9. `Organizations (B2B SaaS)` - 17 edges
10. `compilerOptions` - 16 edges

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

## Communities (132 total, 21 thin omitted)

### Community 0 - "scripts"
Cohesion: 0.05
Nodes (43): @astrojs/check, @clerk/testing, drizzle-kit, @lhci/cli, devDependencies, @astrojs/check, @clerk/testing, drizzle-kit (+35 more)

### Community 1 - "Base.astro"
Cohesion: 0.09
Nodes (9): durumEtiket, t, string, localizePath(), projeler, t, prerender, projeler (+1 more)

### Community 2 - "posts.ts"
Cohesion: 0.10
Nodes (22): styles, enabled, t, findTranslation(), getPublishedPosts(), Post, postPath(), postSlug() (+14 more)

### Community 3 - "dependencies"
Cohesion: 0.04
Nodes (49): @astrojs/mdx, @astrojs/react, @astrojs/rss, @astrojs/sitemap, @astrojs/vercel, @clerk/astro, @clerk/localizations, @keystatic/astro (+41 more)

### Community 4 - "[dosya].ts"
Cohesion: 0.17
Nodes (12): BookData, bookTitle(), getBookMap(), groupByCategory(), qrIcerigi(), A6, DOSYA, GET() (+4 more)

### Community 5 - "db/schema.ts"
Cohesion: 0.04
Nodes (44): booksJson, db, kitapId(), kur(), tumKitaplar, applications, badges, bookAccess (+36 more)

### Community 6 - "client.ts"
Cohesion: 0.08
Nodes (24): Db, sekmeler, formatDate(), kartSurumu(), FEATURED_GIFT_BOOK_ID, R, getEarnedMap(), getLevelsMap() (+16 more)

### Community 7 - "initStories"
Cohesion: 0.11
Nodes (31): ogrenMenu, easeOutExpo(), initHeader(), initMotion(), initProgress(), initReveal(), initTicker(), closePop() (+23 more)

### Community 8 - "CLAUDE.md — Mimari Anayasa"
Cohesion: 0.07
Nodes (36): CI Pipeline (test + build + Lighthouse + Playwright), i18n Yönlendirme Tasarımı (tr prefix'siz, /en/ prefix'li), MDX Bileşen Kütüphanesi (YouTube, Callout, D3Chart, Kaynaklar), Spec Kalite Kapıları (Lighthouse ≥95, ~0 client JS), Kişisel Blog İmplementasyon Spesifikasyonu (orijinal), CLAUDE.md — Mimari Anayasa, awardPoints() Puan Kapısı, Bilgi Hazinesi Onboarding (+28 more)

### Community 9 - "sync-drive-books.ts"
Cohesion: 0.08
Nodes (29): BookTitle, DEDUPE_NOISE, dedupeKey(), normalizeForMatch(), parseBookFileName(), titleMatchScore(), allFiles, byTitle (+21 more)

### Community 10 - "content.config.ts"
Cohesion: 0.11
Nodes (15): bookExtras, books, booksQa, collections, libraryCategories, libraryNotebooks, notebookIds, posts (+7 more)

### Community 11 - "gorev.ts"
Cohesion: 0.24
Nodes (13): gorevOdulKirp(), canManage(), canManageGlobal(), ClubRole, clubRoleOf(), POST(), haftalikGorevHarcamasi(), POST() (+5 more)

### Community 12 - "rewards.ts"
Cohesion: 0.14
Nodes (16): BadgeKind, Bekleyen, bekleyeniKesinlestir(), DAVET_REASONLARI, gunBicimi, kazanilan(), ledgerDeltaSql(), Reason (+8 more)

### Community 13 - "getOrCreateMember"
Cohesion: 0.12
Nodes (16): renderMemberMarkdown(), slugifyTitle(), getOrCreateMember(), slugifyHandle(), POST(), prerender, POST(), prerender (+8 more)

### Community 14 - "gunluk.ts"
Cohesion: 0.23
Nodes (15): awardBadge(), bekleyenleriIsle(), gunKey(), hazineKitabiAc(), sonrakiStreak(), streakIlerlet(), ayinKitabi(), bayatGorevSupur() (+7 more)

### Community 15 - "uye/index.astro"
Cohesion: 0.38
Nodes (6): LEVEL_THRESHOLDS, levelFor(), pointsToNextLevel(), earnedPoints(), POST(), prerender

### Community 16 - "Organizations (B2B SaaS)"
Cohesion: 0.06
Nodes (31): 1. Read Organization from Auth, 2. Dynamic Routes with Org Slug, 3. Role-Based Access Control, 4. Conditional Rendering with `<Show>`, 5. OrganizationSwitcher, 6. Session Task — Choose Organization, Agent-first: Programmatic org management, Authorization Pattern (Complete Example) (+23 more)

### Community 17 - "index.ts"
Cohesion: 0.23
Nodes (9): t, t, visible, en, dicts, Lang, langFromUrl(), tr (+1 more)

### Community 18 - "NotebookLM ile Katmanlı Öğrenme Sistemi (post)"
Cohesion: 0.21
Nodes (17): Hello: Why does this blog exist? (EN manifesto post), Merhaba: Bu blog neden var? (TR manifesto post), NotebookLM ile Katmanlı Öğrenme Sistemi (post), Building a Second Brain — Tiago Forte, How to Take Smart Notes — Sönke Ahrens, Katmanlı Defter Mimarisi (kaynak → kategori → köprü defterleri), NotebookLM, Kütüphanem — Zihin Haritası (project) (+9 more)

### Community 19 - "PostLayout.astro"
Cohesion: 0.18
Nodes (8): encoded, t, targets, canonicalUrl, okumaSuresi, t, translation, readingTimeMinutes()

### Community 20 - "tsconfig.json"
Cohesion: 0.13
Nodes (14): astro/tsconfigs/strict, .astro/types.d.ts, dist, scripts/**/*, src/**/*, tests/**/*, compilerOptions, allowImportingTsExtensions (+6 more)

### Community 21 - "en/index.astro"
Cohesion: 0.13
Nodes (10): [], nodes, t, lang, bilesen, KUTUPHANEM_URL, posts, t (+2 more)

### Community 22 - "ArchiveView.astro"
Cohesion: 0.15
Nodes (11): t, CATEGORIES, Category, KAYNAK_TURLERI, KaynakTuru, getStaticPaths, t, getStaticPaths (+3 more)

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

### Community 27 - "quiz-score.ts"
Cohesion: 0.33
Nodes (3): ScoreAnswer, ScoreQuestion, ScoreResult

### Community 28 - "kart.ts"
Cohesion: 0.16
Nodes (17): Agac, dataUri(), el(), KART_BOYUT, KartFormat, KartGirdi, renderDavetKarti(), RENK (+9 more)

### Community 29 - "Adding Clerk"
Cohesion: 0.06
Nodes (30): 1. Detect the Framework, 2. Fetch the Quickstart Guide, 3. Follow the Instructions, 4. Get API Keys, Adding Clerk, Agent-first: Provision via CLI, ClerkProvider Placement (Next.js), Common Pitfalls (+22 more)

### Community 30 - "profil.astro"
Cohesion: 0.40
Nodes (4): ilListesi, PLATFORMLAR, prerender, socials

### Community 31 - "Astro Content Collections ile Tip Güvenli Blog (post)"
Cohesion: 0.67
Nodes (4): Astro Content Collections ile Tip Güvenli Blog (post), Astro Content Layer intro video (YouTube glwocSx1X8E), Astro Content Layer API + Zod Schema Validation, Story: Astro içerik videosu (YouTube link ring)

### Community 32 - "Seo.astro"
Cohesion: 0.50
Nodes (3): canonical, lang, ogImage

### Community 36 - "check-build-output.mjs"
Cohesion: 0.29
Nodes (5): beklenen, kitapSayfalari, ADR-0001, sirDesenleri, sizanKitap

### Community 52 - "useTranslations"
Cohesion: 0.15
Nodes (11): data, lang, t, renderOgImage(), useTranslations(), KATEGORILER, t, t (+3 more)

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

### Community 70 - "member.ts"
Cohesion: 0.14
Nodes (20): Ctx, hasBookAccess(), OWNER_EMAILS, pointBalance(), PUAN, spendPoints(), siteKok(), prerender (+12 more)

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
Cohesion: 0.33
Nodes (5): Bilgi Ödüldür, Büyüme, Kurs ve etkinlik, Kütüphane, Language

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
Cohesion: 0.08
Nodes (40): DAKIKADA_ISTEK, karsila(), bildir(), CROCKFORD, DAVET_CEREZ, davetAktivasyonu(), davetBitirme(), davetCereziKur() (+32 more)

### Community 116 - "economy.ts"
Cohesion: 0.22
Nodes (11): asgariSureGectiMi(), GUNLUK_BEGENI_PUAN_SINIRI, HESAP_YASI_SAAT, hesapGencMi(), KULUP_HAFTALIK_TAVAN, likePuaniVerilirMi(), OGE_ASGARI_SN, olgunlasmaAni() (+3 more)

### Community 117 - "awardPoints"
Cohesion: 0.27
Nodes (11): activateReferralIfFirstPost(), scoreQuiz(), awardPoints(), revokePoints(), satirlar(), sayacRozetleri(), POST(), prerender (+3 more)

### Community 118 - "urls.ts"
Cohesion: 0.21
Nodes (10): davetKoduUret(), guvenliYol(), POST(), prerender, POST(), prerender, sonSaniyelerdeVarMi(), POST() (+2 more)

### Community 119 - "parse.ts"
Cohesion: 0.19
Nodes (7): id, id, driveFileId(), spotifyEmbedUrl(), youtubeId(), embed, id

### Community 127 - "league.ts"
Cohesion: 0.27
Nodes (10): aktifSezon(), ayPenceresi(), kulupIciSiralama(), kulupSiralamasi(), KulupSkoru, normalizeSkor(), pozitifPuanlar(), sezonAdi() (+2 more)

### Community 128 - "davet-db.test.ts"
Cohesion: 0.33
Nodes (4): Db, Dv, Rw, uye()

### Community 129 - "begeniPuaniVer"
Cohesion: 0.50
Nodes (4): begeniPuaniVer(), gunBaslangici(), POST(), prerender

## Knowledge Gaps
- **762 isolated node(s):** `api-specs-context.sh script`, `execute-request.sh script`, `extract-endpoint-detail.sh script`, `extract-tag-endpoints.sh script`, `name` (+757 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getOrCreateMember()` connect `getOrCreateMember` to `begeniPuaniVer`, `[dosya].ts`, `member.ts`, `client.ts`, `gorev.ts`, `uye/index.astro`, `lib/davet.ts`, `awardPoints`, `urls.ts`, `[]`, `profil.astro`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `Db` connect `client.ts` to `begeniPuaniVer`, `[dosya].ts`, `member.ts`, `gorev.ts`, `rewards.ts`, `getOrCreateMember`, `gunluk.ts`, `uye/index.astro`, `lib/davet.ts`, `awardPoints`, `urls.ts`, `[]`, `league.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `useTranslations()` connect `useTranslations` to `Base.astro`, `posts.ts`, `member.ts`, `uye/index.astro`, `index.ts`, `PostLayout.astro`, `en/index.astro`, `ArchiveView.astro`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `api-specs-context.sh script`, `execute-request.sh script`, `extract-endpoint-detail.sh script` to the rest of the system?**
  _762 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._
- **Should `Base.astro` be split into smaller, more focused modules?**
  _Cohesion score 0.09365079365079365 - nodes in this community are weakly interconnected._
- **Should `posts.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09986504723346828 - nodes in this community are weakly interconnected._