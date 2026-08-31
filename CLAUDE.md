# ysf-blog — "Bilgi Ödüldür" Topluluk Platformu

Kişisel blog + üyelikli öğrenme topluluğu. **Kitaplar satılmaz, emekle açılır**:
oku → üret (yazı/quiz/görev) → puan kazan → yeni kitap aç. Medium (editör,
takip, beğeni) + Skool (feed, seviye, harita, classroom) + Kahoot (süreli quiz)
+ Jira (kulüp Kanban'ı) desenleri tek platformda.

## Stack
- **Astro 5** server-mode (Vercel adapter) + Tailwind v4 (`src/styles/global.css` @theme; `motion.css` animasyon kütüphanesi — reveal/stagger/ticker `src/features/motion/init.ts`)
- **Clerk** auth (`@clerk/astro`; Google girişi; TR yereli). DİKKAT: Clerk `PUBLIC_CLERK_PUBLISHABLE_KEY` bekler, Vercel entegrasyonu `NEXT_PUBLIC_*` verir → eşleme `.env` dosyasında ve Vercel env'lerinde. `vercel env pull` yalnız `.env.local`'ı ezer.
- **Neon Postgres + Drizzle** (`src/db/schema.ts` ~25 tablo; `db` istemcisi TEMBEL Proxy — birim testler env istemez). Şema değişikliği: `node --env-file=.env.local node_modules/.bin/drizzle-kit push`
- İçerik: Keystatic (yalnız `npm run admin`), 884 kitap `src/data/books.json` (id = Drive fileId), Pagefind arama (server-mode'da `dist/client` indexlenir — postbuild)

## Kritik mimari kararlar
- **Kitap sayfaları STATİK** (884 sayfa, getStaticPaths, aranabilir). Dinamik her şey `src/features/library/OkumaKapisi.astro` **server island**'ında (`server:defer`): erişim kapısı, quiz/kampanya köprüleri, panel modülleri (yalnız erişene — sızıntı testi bekçi), beslenen yazılar+beğeni, paylaşım/davet kartı.
- **Misafir DOM'unda Drive iframe/link OLMAMALI** — `tests/e2e/gate.spec.ts` bekçi. Abonelik/İndirme Planları KALDIRILDI.
- **Puan tek gerçek kaynak**: `points_ledger` (harcamalar negatif). Katsayılar `src/lib/points.ts`; korumalar `src/lib/economy.ts` (beğeni: aynı kişiden günde 5 puanlı; kulüp görev ödülü haftalık 1000 tavan — otomatik kırpılır). Seviyeler `src/lib/levels.ts` (Skool eşikleri 1-9, toplam KAZANILANDAN).
- **Bilgi Hazinesi onboarding**: `/uye/hosgeldin` → 5 kitap seç (İLKİ hediye, `learning_list`); `/uye` panosunda kilitli hazine çubukları (yalnız SIRADAKİ hedef dolar); kilit `/api/uye/kitap-ac` (200p) → `?acildi=1` konfeti bandı. Hazineyi büyütmek için `/uye/hosgeldin?ek=1` (parametresiz gelen panoya döner).
- **`security.allowedDomains` ZORUNLU** (astro.config): Astro 5.14+ X-Forwarded-Host'a yalnız bu liste eşleşirse güvenir; listesiz Vercel'de Astro kendini localhost sanır → ref linkleri bozulur ve CSRF gerçek POST'ları 403'ler (canlıda yaşandı). Paylaşım linkleri `lib/urls.ts siteKok()` ile SITE'tan türetilir.
- **Misafir önizlemesi**: `/api/kitap-onizleme?bookId=` kaynak PDF'in İLK 10 sayfasını pdf-lib ile keser (bilinçli public teaser, 45MB sınır, CDN 1 yıl cache); kilit kartındaki panel iframe'i tembel yükler. Hediye seçimi 1-5 esnek (5 zorunlu değil).
- **Kutlama bantlarının linkleri statik HTML'de DEĞİL**: `?acildi=1`/`?hediye=1` bantları `/api/uye/kitap-linkler`'den beslenir; o uç erişimi sunucuda doğrular. Statik sayfaya Drive/NotebookLM linki yazmak YASAK — `check-build-output.mjs` + `gate.spec.ts` bekçi.
- Yetkiler `src/lib/permissions.ts` (admin her kulüpte başkan). Admin bootstrap: `OWNER_EMAILS` member.ts (sn.yusufdeniz@gmail.com ilk girişte admin).
- Rotalar `src/lib/routes.ts`; topluluk 8 sayfası `ToplulukLayout` sekme çubuğunda; N+1 yardımcıları `src/lib/social.ts`, `books-lookup.ts`.

## Sayfa haritası (hepsi SSR, prerender=false; içerik sayfaları statik)
`/topluluk` feed+sağ ray · `/topluluk/[slug]` yazı (beğeni; members-only blur) · `/u/[handle]` profil (takip, flair, sosyal linkler) · `/gundem` kampanyalar+oylama · `/kampanya/[id]` Kanban (backlog→üstlenildi→incelemede→tamamlandı; 7 gün bayat→backlog; bütçe rozeti) · `/kulupler` `/kulup/[slug]` (Pano·Kitaplık·Etkinlik·Üyeler) `/kulup-kur` · `/dersler` `/egitim/[id]` (YouTube+yazı+quiz karışık müfredat) · `/kitap/[id]/quiz` (Kahoot; doğru cevap istemciye GİTMEZ) · `/lider` `/etkinlikler` (⭐öncelikli koltuk) `/uyeler` `/harita` (81 il SVG) `/aramiza-katil` · `/uye/{,hosgeldin,yaz,profil,magaza,admin,quiz-olustur,egitim-olustur}`
API: `src/pages/api/uye/*` (form-POST + redirect deseni; hız sınırı feed'de)

## Komutlar
- `npm run qa` — kalite kapısı: check + birim + **`npm run build`** (postbuild DAHİL — `astro build` çağırmak pagefind/llms.txt adımını atlar, bekçi bunu yakalar) + çıktı-bekçisi + e2e
- Şema: `drizzle/0000_*.sql` boş DB için BASELINE'dır, canlıya uygulanamaz. Canlı Neon'a yeni index'ler için `drizzle/canli-index-uygula.sql` (önce çift-kayıt ön kontrolü).
- `npm run seed:demo` — 5 demo üye + kulüp + kampanya + quiz + kurs + etkinlik (idempotent; `demo_` clerkId). Demo: /kulup/odtu-yz-okuma-demo, /u/elif-celik
- e2e **dev server'a** koşar (Vercel adapter `astro preview` desteklemez — kanıtlı). Tuzaklar: `details.first()` mobil menüyü bulur (`details[id^='kat-']` kullan); tema toggle startViewTransition'la asenkron; uzun dev oturumu EMFILE/`504 Outdated Optimize Dep` üretir → sunucu restart + `rm -rf node_modules/.vite`.
- Değer notları: `src/data/deger-notlari.json` (NotebookLM MCP `notebook_query` ile üretim; 884 için batch iş BEKLİYOR — nb-sor.py hattı)

## Topluluk motoru (2026-08-09 eklendi)
- **Puanın tek kapısı `src/lib/rewards.ts` `awardPoints()`** — ledger'a DOĞRUDAN insert YASAK; streak + seviye açılımları (3/5/7: bedava kitap, usta-okur, onaysız yayın) + rozetler buradan tetiklenir.
- **`awardPoints()` IDEMPOTENT**: `points_ledger_idem_idx` (kısmi unique: `user_id, reason, ref_id`, `like_received` HARİÇ — orada refId gönderi, alıcı yazardır) + `onConflictDoNothing`. Yazıldıysa `true` döner; çağıranlar buna bakmalı.
- **Harcama tek kapı `spendPoints()`** — bakiye koşulu INSERT'in WHERE'ine gömülü TEK SQL. Sebep: `neon-http` sürücüsü interaktif transaction DESTEKLEMEZ, "önce oku sonra yaz" yarışa açıktı (200 puanla N kitap). `pointBalance` ile kontrol edip ayrı yazmak YASAK.
- **Beğeni puanı tek kapı `begeniPuaniVer()`** — günlük 5 freni feed + üye yazısı beğenilerini BİRLİKTE sayar (eskiden yazı beğenisi freni hiç yoktu).
- Gün/ay sınırı sabit **Europe/Istanbul** (`gunKey`, `gunBaslangici`) — Vercel UTC'de koşuyor, TR gecesi seri kırıyordu.
- **Seviye hediyeleri HAK ESASLI** (`seviyeHediyeleriniUygula`): hazine boşken tetiklenirse hak yanmaz, `hediye-sec` sonrası telafi edilir. (Yeni üye +50 welcome ile anında Sv3 olur; eski olay-esaslı kurguda bu hediye HER üyede yanıyordu.)
- Lig/sezon `src/lib/league.ts`: kulüp skoru = pozitif katkı ÷ √üye; `aktifSezon()` ayı otomatik açar. `/lider?t=lig`, kulüp sayfası Lig sekmesi (özel ligler `club_leagues`).
- Kulüp içi gruplar (`club_groups`; lider=mod), grup hedefli görev ilk 48s gruba özel; claim atomik + kulüp üyeliği şart + üye başına 2 aktif görev.
- Cron: `vercel.json` → `GET /api/cron/gunluk` (`CRON_SECRET`; `cron_runs` idempotency). İşler: bayat görev, sezon kapanış/açılış, ayın kitabı (oy birincisi → kampanya), özel lig kapanışı.

## Deploy (2026-08-31 CANLI)
- **Production: https://yusufdeniz.com** (+ www; `ysf-blog.vercel.app` alias'ı da çalışır). Domain Squarespace'te kayıtlı; DNS: `A @ → 76.76.21.21` + `CNAME www → cname.vercel-dns.com` (Squarespace DNS panelinde custom records; "Squarespace Defaults" park preset'i otomatik kalktı; Email Security TXT'leri korundu). `SITE_URL=https://yusufdeniz.com` — canonical/og/sitemap/llms.txt bu domain'le üretiliyor (canlı doğrulandı).
- İlk deploy'da canlı doğrulanan güvenlik: client bundle'da sır YOK, kitap sayfasında Drive/NotebookLM linki YOK, cron secret'sız 401, arama ("Mindset"→3 sonuç)/llms.txt/sitemap 200. Neon'a 8 index uygulandı (idempotency dahil). Vercel env: POSTGRES_URL, CRON_SECRET (3 ortam), SITE_URL, Clerk anahtarları.
- **Clerk production instance HAZIR (2026-08-31)**: domain `yusufdeniz.com` Clerk'te Verified (App 2/2 + Email 3/3); 5 CNAME Squarespace'e eklendi (`clerk`, `accounts`, `clkmail`, `clk._domainkey`, `clk2._domainkey`). SSL "Issuing" idi — Issued olduğunda giriş sayfası `accounts.yusufdeniz.com`'a taşınır. **KALAN 2 ADIM**: (1) Google SSO production'da custom credential İSTER — Google Cloud Console'da OAuth client (redirect URI: `https://clerk.yusufdeniz.com/v1/oauth_callback`) oluşturup Client ID+Secret'ı Clerk → SSO connections → Google'a KULLANICI girer; (2) Vercel env'leri hâlâ pk_test/sk_test — Google etkinleşince `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`+`PUBLIC_CLERK_PUBLISHABLE_KEY`=pk_live, `CLERK_SECRET_KEY`=sk_live yapıp redeploy. DİKKAT: production instance kullanıcıları SIFIRDAN başlar (dev'deki üyeler taşınmaz; canlıdaki 6 üye dev instance'ta).
- **Deploy YÖNTEMİ**: git bağlı DEĞİL → `vercel deploy --prod --archive=tgz` (CLI). `--archive=tgz` ŞART: `.vercelignore` ile üretilmiş dosyalar hariç tutulsa da free-plan "5000 dosya/24s" limitini tek arşiv aşar. `--prebuilt` KULLANMA (lokal sırları taşır). Build Vercel'de (`vercel.json` buildCommand=`npm run build` → postbuild koşar).

## Bekleyenler / sonraki adımlar
- **Clerk `sk_test` anahtarını ROTATE et (KULLANICI)**: eski lokal build'lerde client bundle'a sızmıştı (hiç deploy edilmedi, o yüzden acil değil ama temizlik şart). Clerk Dashboard → API Keys → rotate → `vercel env rm/add CLERK_SECRET_KEY` → redeploy.
- **Drive içerik koruması YARIM (Faz 5.C)**: statik sayfa sızıntısı kapandı ama 884 dosya Drive'da hâlâ "linki olan herkes" (Drive API ile doğrulandı) ve URL slug'ı = fileId. PDF boyut ölçüldü: **medyan 10MB, p95 42MB, p99/max 77MB, %4'ü >50MB** → saf proxy UX taşır AMA Range desteği ŞART. Kalan: service-account (KULLANICI Google Cloud'da oluşturmalı) + auth'lu Range-proxy `/api/uye/kitap-icerik`, slug'ı fileId'den koparma (301 haritası), `sync-drive-books.ts`'i Drive API v3'e taşıma (public klasör listelemesi sync önkoşulu — izinler kapanınca sync kırılır).
- Pagefind araması DEV sunucusunda 0 sonuç döner (index sağlam — canlıda ÇALIŞIYOR); `search.spec.ts` dev'de kırmızı. Ayrı iş (spawn task açıldı).
- Canlı quiz odası (PIN, WebSocket), e-posta bildirimleri (Resend), moderasyon araçları
- Auth'lu e2e (@clerk/testing), 884 kitaba toplu değer notu üretimi

## Agent skills

### Issue tracker

İşler GitHub Issues'ta (`ysf-dnz/ysf-blg`, `gh` CLI ile). Bkz. `docs/agents/issue-tracker.md`.

### Triage labels

Varsayılan beş rol: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. Bkz. `docs/agents/triage-labels.md`.

### Domain docs

Tek-bağlam: kökte `CONTEXT.md` + `docs/adr/`. Bkz. `docs/agents/domain.md`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
