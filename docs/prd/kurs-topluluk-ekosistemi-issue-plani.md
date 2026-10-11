# Issue planı — Kurslar · Davet QR'ı · Topluluklarımız · Etkinlik girişi · Harita/DM

**Kaynak:** `docs/prd/kurs-topluluk-ekosistemi.md` + `docs/adr/0001-kurs-davet-etkinlik-harita.md` · **Durum:** 7 soru varsayılanlarıyla kabul edildi (2026-10-11). GitHub: Faz 1 issue'ları #1–#13, faz epikleri #14–#17. **Faz 1 uygulandı** (dal `faz1-kurslar`; `pending_points` Faz 1'de; `F1-0T` qa önkoşulu eklendi). **Faz 2 uygulandı** (dal `faz2-davet`, GitHub #18–#24; F2-H human). Sapmalar: bağlantı kanalı sayfası `/d/[...kod]` (rest param — redirect anahtarı tuzağı), kart CDN 1 gün, `invite_codes.note`, `/kurslar?davet=gecersiz` bandı. **Faz 3 uygulandı** (dal `faz3-etkinlik`, GitHub #25–#30; merge kararı Yusuf'ta). Sapmalar (`docs/assumptions.md` #18–#35): QR hedefleri `/t/q/[token]`, `/c/q/[etkinlik]/[token]` (Vercel kenarı harf duyarsız — ADR K3.3 düzeltmesi); `events.slug` nullable + ilk görüntülemede atama; çerez `event:{id}:{codeId}`; giriş penceresi kapı −60 dk → bitiş; kontenjan `db.batch` + danışma kilidi; JS QR çözücü yerine telefon kamerası akışı; `event_well_rated` düzenleyenler arasında bölünür.

**Her issue'nun ortak bitti-tanımı:** `npm run qa` yeşil (postbuild dahil) · yeni fren `economy.ts`'te saf + `it.each` testli · yeni `reason` `schema.ts` enum'unda, refId ADR §7'den · `canli-index-uygula.sql` gerekiyorsa güncel · `npm run seed:demo` yeni veriyi kapsıyor · `CLAUDE.md`/`CONTEXT.md`/`PROGRESS.md` güncel · `graphify update .` koşuldu.
**Etiketler:** `ready-for-agent` varsayılan; Yusuf'un elle yapacakları `ready-for-human`.

Dosya yolları repo köküne göre.

---

## Faz 1 — Kurslar (13 issue)

### F1-00 · Davet çerezi hotfix (canlı bug)
Statik sayfalarda `?ref=` çerez kurmuyor (ADR §0 #1). `src/layouts/Base.astro`'ya 3 satırlık `<script is:inline>`: `location.search`'te `ref` varsa ve `^[a-z0-9-]{2,40}$` eşleşiyorsa `document.cookie = "ysf_ref=…; Max-Age=2592000; Path=/; SameSite=Lax"`. Link üreticileri değişmez; ana sayfa statik kalır.
**Kabul:** Canlıda `curl` ile değil, tarayıcıda `/?ref=demo` → `document.cookie` içinde `ysf_ref`; `gate.spec`/`js-budget` yeşil (inline script istek değil).
**Dosyalar:** `src/layouts/Base.astro`. **Bağımlı:** yok. Ayrı commit, Faz 1'den önce çıkabilir.

### F1-0T · QA yeşil önkoşulu: `search.spec`, `@clerk/testing` kurulumu
Ortak bitti-tanımı "qa yeşil" dediği için bu iş **bağımlılıksız, Faz 1'in ilk işi**; aksi hâlde F1-01…F1-10 kendi bitti-tanımını karşılayamaz. (a) `search.spec.ts` dev'de kırmızı (Pagefind dev'de 0 sonuç) → dev'de `test.skip` ya da çözüm; `playwright.config.ts:16-18` bayat yorum. (b) `@clerk/testing` devDependency; Playwright global setup `clerkSetup()`; auth'lu testler için ayrı `serial` proje + test kullanıcısı storageState (test dosyası yok, yalnız altyapı). (c) `npm run qa` bir kez uçtan uca yeşil.
**Human:** Clerk dev instance'ta test kullanıcısı (`+clerk_test` e-posta kodu); e2e için ayrı Neon branch (`POSTGRES_URL_TEST`).
**Kabul:** `npm run qa` yeşil; auth'lu boş bir spec storageState ile `/uye`'ye girebiliyor.
**Dosyalar:** `package.json`; `playwright.config.ts`; `tests/e2e/search.spec.ts`; `tests/e2e/global-setup.ts` (yeni); `CLAUDE.md`. **Bağımlı:** yok. Etiket: `ready-for-agent` + human adımı.

### F1-01 · Kurs görünürlük ve onay kapıları (güvenlik önkoşulu)
(a) Kurs içindeki yazı öğesi `src/pages/topluluk/[slug].astro:20-21` kilit deseniyle render edilir (members-only + misafir → kilit; yalnız `status=published`). (b) API öğe olarak yalnız kendi yayınlanmış yazısını kabul eder (`egitim.ts:166-171`). (c) draft/pending kurs üretici ve admin dışında 404; `complete` yalnız published kursta. (d) `/uye/admin`'e "Onay bekleyen kurslar" + onayla/reddet + üreticiye bildirim.
**Kabul:** Misafir DOM'unda members-only yazı gövdesi yok (gate.spec deseni); pending kurs misafire 404; onay `published` yapar.
**Dosyalar:** `src/pages/egitim/[id].astro:18,45-50,113-118`; `src/pages/api/uye/egitim.ts:77-88,166-171`; `src/pages/api/uye/admin.ts`; `src/pages/uye/admin.astro:14-28`. **Bağımlı:** yok.

### F1-02 · `courses` yeni alanlar, slug, "en az 3 geçerli öğe"
`slug` (nullable → backfill → unique + NOT NULL; ADR K6), `summary ≤140`, `cover_url` (boşsa `bookId` kapağı), `level`, `est_minutes`, `status +hidden`. API sırası: öğeler önce çözülür, geçerli < 3 → 400, kurs sonra yazılır. Slug `kulup.ts:28` deseni.
**Kabul:** 2 geçerli öğeyle POST 400; slug unique `canli-index-uygula.sql`'de; seed alanları doldurur.
**Dosyalar:** `src/db/schema.ts:490-503`; `src/pages/api/uye/egitim.ts:111-195`; `src/pages/uye/egitim-olustur.astro`; `drizzle/canli-index-uygula.sql`; `scripts/seed-demo.ts:258-270`. **Bağımlı:** yok.

### F1-03 · Rotalar: `/kurslar`, `/kurslar/[slug]`, 301'ler, sekme adı
`dersler.astro` → `kurslar/index.astro`; `egitim/[id].astro` → `kurslar/[slug].astro` (ToplulukLayout). `/dersler` → `astro.config.mjs` `redirects` 301. `/egitim/[id]` SSR stub: id→slug, `Astro.redirect(url, 301)`. `R.dersler/egitim` → `R.kurslar/kurs(slug)`; ToplulukLayout etiketi "Kurslar"; bildirim href'leri; `/uye/egitim-olustur` URL'si kalır, etiketi "Kurs oluştur". **Dokunulmaz:** "eğitim" blog kategorisi ve görev türü (`src/lib/i18n/tr.ts:34`, `types.ts:5`, `src/features/seo/og/render.ts:23`, `global.css:27`, `kampanya/[id].astro:128`, `FeedCard.astro:36`).
**Kabul:** AC-2 (e2e `maxRedirects:0`, 301 + Location); `community.spec.ts:4` sekme testi "Kurslar".
**Dosyalar:** `src/lib/routes.ts:15-16,31`; `src/layouts/ToplulukLayout.astro:19`; `src/components/ui/FloatingNudges.astro:16`; `src/pages/dersler.astro`; `src/pages/egitim/[id].astro`; `src/pages/api/uye/egitim.ts:65-66,108,195`; `src/pages/uye/yaz.astro:67`; `astro.config.mjs`; `tests/e2e/community.spec.ts`; `CLAUDE.md`, `README.md`. **Bağımlı:** F1-01 (aynı dosyayı düzenliyor), F1-02.

### F1-04 · Herkese açık SSR/SEO
Misafir müfredat + ilk öğe; `?b≥1` kilit kartı + giriş CTA'sı. `Course` JSON-LD. **OG Faz 1'de kapak** (`cover_url` ya da kitap kapağı, `Seo.astro ogImagePath`); dinamik kart F2-05. Sitemap: SSR `src/pages/sitemap-kurslar.xml.ts` + `sitemap({ customSitemaps:[…], filter: p => !/\/uye(\/|$)/.test(p) })` (`includes('/uye')` herkese açık `/uyeler`'i de düşürür); `public/robots.txt` Sitemap satırı `yusufdeniz.com`.
**Kabul:** AC-1; AC-25; `sitemap-index.xml` içinde `sitemap-kurslar.xml`; `/uye/*` sitemap'te yok, `/uyeler` var.
**Dosyalar:** `src/pages/kurslar/[slug].astro`; `src/features/seo/Seo.astro:30,60-62`; `astro.config.mjs:71-76`; `public/robots.txt`; yeni `src/pages/sitemap-kurslar.xml.ts`. **Bağımlı:** F1-03.

### F1-05 · Katılım: `course_enrollments`, "Kursa katıl", aktivasyon
Tablo (ADR K6). Buton üyeye; kendi kursuna katılım yok. `complete` katılım şartı koyar. Aktivasyon sinyali C ilkeli: `UPDATE course_enrollments SET activated_at=now() WHERE user_id=? AND course_id=? AND activated_at IS NULL RETURNING id`; bitirme aynı desenle `completed_at` (tüm öğeler tamam koşulu WHERE'de). Backfill `course_progress`'ten.
**Kabul:** İki kez katılım yok; paralel iki `complete` tek aktivasyon olayı; seed enrollments.
**Dosyalar:** `src/db/schema.ts`; `src/pages/api/uye/egitim.ts:77-107`; `src/pages/kurslar/[slug].astro`; `scripts/seed-demo.ts`; `drizzle/canli-index-uygula.sql`. **Bağımlı:** F1-03.

### F1-06 · Üretici puanları, asgari süre, atomik tavan, bekleyen puan
`PUAN`: `courseLaunched 50`, `courseLearnerActivated 5`, `courseLearnerCompleted 10`, `courseProducerDailyCap 100`; enum +3. `economy.ts`: `asgariSureGectiMi(ogeSayisi, joinedAt, simdi)` (öğe×60 sn); kırpma `gorevOdulKirp` yeniden kullanılır. **`awardPoints` `tavan` parametresi + `number` dönüş** (ADR K1.3); `begeniPuaniVer` (`rewards.ts:317,346`) `return (await awardPoints(...)) > 0` olur, yoksa `astro check` kırmızı; grep `return awardPoints` / `= await awardPoints` / `=== true`; `kursOduluVer` taşınır. **`pending_points` tablosu + kesinleşme sırası + `bekleyen` cron işi** (ADR K2); hesap yaşı 24 s: kaynak hesap `created_at > now()-24h` ise üretici puanı `matures_at` ile bekleyene yazılır. Tetikler: aktivasyon → `course_learner_activated`; 3. aktif enrollment → `course_launched`; bitirme → `course_learner_completed` + `course_completed` yalnız asgari süre geçmişse (geçmemişse ilerleme kalır, bildirimde gerekçe). `/uye` panosunda "Bekleyen" (ne kadar, neye bağlı, ne zaman; kırpıldıysa gerekçe).
**Kabul:** AC-3, AC-4, AC-13, AC-14; `it.each` tabloları (süre sınırları; tavan 0/kısmi/tam; kesinleşme sırası); invariant testi: bir kursta üreticinin tek öğrenciden kazanabileceği ≤ 15 + launched payı.
**Dosyalar:** `src/lib/points.ts`; `src/lib/economy.ts`; `src/lib/rewards.ts:236-296`; `src/db/schema.ts:55-76`; `src/pages/api/uye/egitim.ts:34-68`; `src/pages/api/cron/gunluk.ts:180-205`; `src/pages/uye/index.astro`; `tests/unit/economy.test.ts`. **Bağımlı:** F1-05.

### F1-07 · Soru-cevap: öğe altı yorum, cevap beğenisi, en iyi cevap
`comments.course_item_id/accepted_at/hidden_at`; `likes.comment_id` + unique. **Yeni aksiyon açılmaz:** `feed.ts` zaten `comments`'e yorum ve `likes`'a beğeni yazıyor (`feed.ts:62-104`), `sonSaniyelerdeVarMi` (`:13-25`) `comments` tablosunu saydığı için kurs yorumlarını da kendiliğinden frenler → `comment` aksiyonuna `courseItemId`, `like` aksiyonuna `commentId` dalı eklenir; `egitim.ts`'e yalnız `accept-answer`. Düz metin (FeedCard deseni). `begeniPuaniVer`'e üçüncü join (likes→comments.user_id); refId `yorum:{id}`. En iyi cevap C ilkeli: `UPDATE comments SET accepted_at=now() WHERE id=? AND <kurs üreticisi=?> AND user_id<>? AND accepted_at IS NULL RETURNING` → `answer_accepted` +10.
**Kabul:** Günlük 5 freni yorum beğenilerini de sayar; üretici kendi cevabını seçemez; öğe başına tek en iyi cevap; AC-13.
**Dosyalar:** `src/db/schema.ts:163-197`; `src/lib/rewards.ts:313-352`; `src/pages/api/uye/feed.ts:13-25,62-104`; `src/pages/api/uye/egitim.ts` (accept-answer); `src/pages/kurslar/[slug].astro`; `src/lib/points.ts`; `drizzle/canli-index-uygula.sql`. **Bağımlı:** F1-05.

### F1-08 · Ek kaynak önerisi
`course_resources` (url https-only, `profil.ts:17-18` regex'i; note ≤200; status). Üretici onayı → `resource_accepted` +15, günde 3 (tavan param. `since=gunBaslangici()`, `limit=45`). Kursta "Ek kaynaklar" önerenin adıyla.
**Kabul:** 4. kabul listelenir ama puan üretmez; `http://` 400.
**Dosyalar:** `src/db/schema.ts`; `src/pages/api/uye/egitim.ts`; `src/pages/kurslar/[slug].astro`; `src/lib/points.ts`. **Bağımlı:** F1-06.

### F1-09 · Değerlendirme + liste filtre/sıralama
`ratings` (course_id; unique user+course); yalnız `activated_at` dolu katılımcı; puan yok. `/kurslar`: filtre topluluk ve kitap; sıralama yeni, popüler (enrollments), en çok tamamlanan, en canlı (son 7 gün progress); tek SQL grup sayımları.
**Kabul:** Aktive olmamış üyeye form yok, API 403; sıralama parametreleri sırayı değiştirir (e2e, seed verisiyle).
**Dosyalar:** `src/db/schema.ts`; `src/pages/api/uye/egitim.ts`; `src/pages/kurslar/index.astro`. **Bağımlı:** F1-05.

### F1-10 · Şikâyet kuyruğu, gizleme, `course_launched` iadesi
`reports` (ADR K6, polimorfik). Sv4+ üç farklı üye → `courses.status='hidden'` / `comments.hidden_at` (tek UPDATE, sayım WHERE'de). Admin kuyruğu: incele/kaldır/geri aç. İade `revokePoints` (ADR K5; negatif `admin_adjust`, refId `iade:course_launched:course:{id}`).
**Kabul:** 3. şikâyette kurs listeden ve sayfadan kaybolur (üretici "inceleniyor" görür); aynı kişi iki kez şikâyet edemez; iade idempotent; iade sonrası seviye değişmez (bilinçli).
**Dosyalar:** `src/db/schema.ts`; yeni `src/pages/api/uye/sikayet.ts`; `src/lib/rewards.ts`; `src/pages/api/uye/admin.ts`; `src/pages/uye/admin.astro`; `src/pages/kurslar/[slug].astro`. **Bağımlı:** F1-06.

### F1-11 · Auth'lu kurs e2e + DB entegrasyon testi
Auth'lu `tests/e2e/kurs.spec.ts` (F1-0T altyapısıyla; katıl → ilk öğe → aktivasyon; AC-3; AC-4 için `joined_at` test ortamında geri çekilir). **DB entegrasyon testi** `tests/integration/*.test.ts`: `POSTGRES_URL_TEST` varsa koşar, yoksa skip; tavan SQL'in paralel çağrıda bir ödülden fazla aşmadığı, idem index'in çift yazımı yuttuğu, bekleyen kesinleşme sırasının yarım kalınca kendini onardığı (AC-11, AC-13 gerçek kanıtı).
**Kabul:** AC-3/AC-4 e2e; entegrasyon testi env varsa koşar.
**Dosyalar:** `tests/e2e/kurs.spec.ts`; `tests/integration/`. **Bağımlı:** F1-0T, F1-05, F1-06.

---

## Faz 2 — Davet kartı ve QR (6 + 1 human)

### F2-01 · Davet kodu, `/d/[kod]`, büyük harf 301'leri, QR
`invite_codes` (+`note`) + saf `crockfordNormalize` (upper, O→0, I/L→1) + test. Ortak handler `src/features/davet/karsilama.ts` → `src/pages/d/[kod].astro` (kanal `link`) ve `src/pages/d/q/[kod].astro` (kanal `qr`, 3 satır): normalize → `invite_visits` (ip/ua hash, kanal) → IP 60/dk (son 60 sn sayım, 429) → `ysf_ref` (middleware deseni, ortak yardımcıya alınır) + `ysf_davet` (`{target_type}:{id}:{inviterId}`, 30 gün, lax, httpOnly, secure) → `target_type`'a göre `302 /kurslar/[slug]?d={kod}` (etkinlik dalı F3-03). `astro.config.mjs` `redirects`: `/D/[kod]` → `/d/q/[kod]`, `/T/[token]` → `/t/[token]`, `/C/[etkinlik]/[token]` → `/c/[etkinlik]/[token]`, hepsi 301 (ADR K3.3: destination var olan rota anahtarıyla birebir eşleşmeli, query taşıyamaz). Cron `gunluk.ts`'e `invite_visits` 30 gün DELETE (`birKezCalistir('davet-ziyaret-temizlik', gunKey)`). **İlk iş:** `uqr` kur, boyut/alfanümerik mod doğrula. QR SVG sunucuda; içerik `HTTPS://<HOST>/D/XXXXXXX` (`siteKok()`).
**Kabul:** AC-12 (`/D/7KQ2MXA` → 301 → `/d/q/7KQ2MXA`, `kanal=qr`; `/d/7kq2mxa` → `kanal=link`; ikisi aynı daveti açar); aynı (davetçi, hedef) için mevcut kod döner; 61. istek 429; QR'da kişisel veri yok; 31 günlük ziyaret cron'da silinir.
**Dosyalar:** `src/db/schema.ts`; `src/features/davet/karsilama.ts`; `src/pages/d/[kod].astro`; `src/pages/d/q/[kod].astro`; `src/middleware.ts:8-16`; `astro.config.mjs`; `src/pages/api/cron/gunluk.ts`; `src/lib/economy.ts`; `src/lib/urls.ts`; `package.json`. **Bağımlı:** F1-05.

### F2-02 · Karşılama akışı ve katılım atfı
`/kurslar/[slug]?d={kod}`: önizleme, "{Ad} seni davet etti", puan rozeti, tek buton; `og:image` kart (F2-05; o gelmeden kapak). Girişsiz: sayfa içi `<SignInButton mode="modal" forceRedirectUrl={buSayfa+'&katil=1'}>` (`Base.astro:121`'in hosgeldin yönlendirmesi kullanılmaz). Dönüşte SSR: `getOrCreateMember` → enrollment insert (`invite_code_id` ile) RETURNING → yeni satır ve `ysf_davet` hedefi eşleşiyorsa bekleyen puanlar (F2-03). **(2026-10-12: GET'te SSR katılım KALDIRILDI — niyet `sessionStorage` + sayfa betiği POST; ADR K3.4 revizyonu, varsayım #44.)** Kendi kodu / zaten kayıtlı → atıf yok, mesaj. UA ile uygulama içi tarayıcı (Instagram, Telegram, FB) algılama → e-posta kodu vurgusu + "Tarayıcıda aç". Başarı ekranı "Sen +10, {Ad} +15 kazanacak; ilk öğeyi bitirince kesinleşir" + "İlk öğeye başla" (sözlük "ders"i yasaklar; ADR §0 #29). Preview URL'de elle Lighthouse (LCP < 2,5 sn hedefi; CI yalnız statik sayfaları ölçer).
**Kabul:** AC-5 (not: davetli 24 saatten genç hesapsa puan aktivasyonda değil `created_at+24h`'te kesinleşir, ADR K2), AC-7, AC-9; AC-6 **elle test** (otomatik yol yok).
**Dosyalar:** `src/pages/kurslar/[slug].astro`; `src/pages/api/uye/egitim.ts` (join); `src/db/schema.ts`. **Bağımlı:** F2-01, F2-03.

### F2-03 · Davet bekleyenleri
Katılımda: davetliye `course_invite_welcome` (+10, refId `course:{id}`), davet edene `course_invite_activated` (+15, `course:{id}:u:{invitee}`), ikisi `pending_points`'e `expires_at = now()+14g`. Aktivasyon sinyali (F1-05 RETURNING) → ADR K2 sırasıyla kesinleşme; **davetlinin hesabı 24 saatten gençse** kesinleştirme yerine `matures_at = created_at + 24h, expires_at = NULL` (cron tamamlar). Bitirmede (asgari süre geçmişse) davet edene `course_invite_completed` +10 **anında**, tavan parametresiyle. Cron `bekleyen` zaten var (F1-06); 14 gün düşmesi onunla.
**Kabul:** AC-5 ikinci yarısı, AC-8, AC-13; kesinleşme sırası testi (ledger önce); genç hesap → `matures_at` dolu, ledger boş.
**Dosyalar:** `src/lib/rewards.ts`; `src/pages/api/uye/egitim.ts`; `src/lib/points.ts`; `src/db/schema.ts` enum. **Bağımlı:** F1-06.

### F2-04 · Davet tavanı 300 / kayan 7 gün
`PUAN.inviteWeeklyCap 300`; reasons ADR §7 listesi (`referral_activated` hariç). `member.ts:87-99` `referral_joined` çağrısı tavan parametresine geçer (gerçek delta: temsilci 38 doğru sayılır). Kırpılan → `notifications` "kırpıldı" (`gorev.ts:239-244` deseni) + panoda gerekçe.
**Kabul:** AC-11.
**Dosyalar:** `src/lib/points.ts`; `src/lib/economy.ts` + test; `src/lib/rewards.ts`; `src/lib/member.ts:76-103`; `src/pages/uye/index.astro`. **Bağımlı:** F1-06.

### F2-05 · Kart üretimi çalışma zamanında
ADR K3.1/K3.4: `satori`, `@resvg/resvg-js` → dependencies; `includeFiles` (B planı `?inline`); `render.ts` boyut parametreli, QR data-URI. Rota `/api/kart/[kod]/[format].png?v=` (`story|kare|og`) ve `.pdf` (pdf-lib `embedPng`). Cache `public, s-maxage=31536000, stale-while-revalidate=86400`; URL `?ref` taşımaz. Kapak mutlak URL. `check-build-output.mjs`'e `.ttf` + resvg `.node` kontrolü. Kart ekranında kişisel not alanı (≤80, `invite_codes.note`; değişince `v` hash'i değişir). İndir / Paylaş (Web Share, WhatsApp öncelikli) / Kopyala (`BookDetail.astro:272-284` deseni). Kurs OG F1-04 fallback'inden bu rotaya döner. **İlk iş:** preview deploy'da PNG 200 + `Cache-Control`/`Set-Cookie` başlıkları.
**Kabul:** Preview'da story/kare/og PNG ve A6 PDF 200; js-budget yeşil; `check-build-output` yeşil.
**Dosyalar:** `src/features/seo/og/render.ts`; `package.json`; `astro.config.mjs:38`; `src/pages/api/kart/*`; `scripts/check-build-output.mjs`; `src/pages/kurslar/[slug].astro`. **Risk:** tek `_render` fonksiyonu büyür, soğuk başlangıç ölçülür. **Bağımlı:** F2-01.

### F2-06 · Davetlerim hunisi
`/uye`: kod başına görüntülenme (`invite_visits`, kanal kırılımı) → katılım (`invite_code_id`'li enrollments) → aktivasyon; kazanılan/bekleyen; **K-faktörü** (üye başına aktive olan davetli). Tek SQL grup sayımları.
**Dosyalar:** `src/pages/uye/index.astro`. **Bağımlı:** F2-02, F2-03.

### F2-H · Clerk production `ready-for-human`
Google OAuth custom credential (redirect `https://clerk.yusufdeniz.com/v1/oauth_callback`); `pk_live/sk_live` env + redeploy; e-posta kodu stratejisi açık; Restrictions → tek kullanımlık e-posta engeli; eski `sk_test` rotate (CLAUDE.md). Faz 2 canlıya çıkmadan. Production kullanıcıları sıfırdan başlar; canlıdaki 6 üyenin satırları yeni Clerk id'leriyle elle eşlenir.

---

## Faz 3 — Topluluklarımız, etkinlik, giriş doğrulaması (6)

> **Uygulandı (2026-10-11).** Aşağıdaki metin Faz 0 planıdır; uygulamadaki farklar için `docs/assumptions.md` #18–#35 ve ADR K3.3 "Düzeltme" bağlayıcıdır (özellikle F3-04/F3-05 sayfa yolları: `src/pages/t/q/[token].astro`, `src/pages/c/q/[etkinlik]/[token].astro`).

### F3-01 · Topluluklarımız
`clubs.kind` += vakıf · dernek · kurum; `kulup.ts:20-23`'e beyaz liste (bugün doğrulamasız cast); etiket haritaları (`kulupler.astro:24-28`, `kulup-kur.astro:39-41`, `seed-demo.ts:199`); ToplulukLayout sekmesi "Topluluklarımız" (URL'ler aynı); kart ızgarası (tür, il, üye sayısı, sıradaki etkinlik, kurs sayısı) + tür/il filtresi; kulüp sayfasına "Kurslar" sekmesi. **Bağımlı:** F1-03.

### F3-02 · Etkinlik modeli ve `/etkinlik/[slug]`
`events`: slug (3 adım), ends_at, kind, il (+backfill), capacity, rsvp_closes_at, cover_url; `club_id` FK (yetim kontrolü sonrası); `event_staff` (host|scanner; ≤3 ortak host; `created_by` otomatik host). SSR sayfa, OG (F2-05 şablonu), `.ics`. RSVP kapasite A ilkeli `INSERT…SELECT…WHERE count<capacity AND now()<rsvp_closes_at`; tarih/varlık kontrolü (bugün yok); yönlendirme etkinlik sayfasına. ⭐ ile kapasite etkileşimi: ⭐ kapasiteyi aşmaz. **Bağımlı:** F2-05.

### F3-03 · Etkinlik daveti ve etkinlik karşılama akışı
Kart + QR `target_type=event`. `/d/[kod]` handler'ına etkinlik dalı: `ysf_davet = event:{id}:{inviterId}` → `302 /etkinlik/[slug]?d={kod}`. Etkinlik sayfasında karşılama: önizleme, "{Ad} seni davet etti", tek "Yerimi ayır" butonu; girişsiz → sayfa içi `SignInButton forceRedirectUrl={buSayfa+'&kayit=1'}`; dönüşte SSR otomatik RSVP (kapasite A ilkeli) + `event_rsvps.invite_code_id`. Davet edene `event_invite_attended` **bekleyen** (`expires_at = ends_at`; girişte kesinleşir, gelmezse düşer → AC-19). Davetliye `event_invite_welcome` **girişte anında** (`awardPoints`, bekleyen satır YOK; ADR K1.4). **Host'lar kendi etkinliklerinde davet puanı almaz (AC-20 burada).** 2. seviye etkinlikte yok. Davetlerim hunisi (F2-06) `event_rsvps` UNION'ıyla etkinlikleri de sayar.
**Kabul:** AC-19 (bekleyen `ends_at`'te `expired`), AC-20; QR'la gelen girişsiz misafir iki dokunuşla kayıtlı.
**Dosyalar:** `src/features/davet/karsilama.ts`; `src/pages/etkinlik/[slug].astro`; `src/pages/api/uye/etkinlik.ts`; `src/pages/uye/index.astro`. **Bağımlı:** F2-02, F2-03, F2-06, F3-02.

### F3-04 · Bilet, `/t/[token]`, görevli tarayıcısı, giriş doğrulaması, RSVP puanının kaldırılması
Bilet token = `{rsvpId}.{base32(HMAC(env sırrı, "t:"+rsvpId))}` (ADR K6; kolonsuz; ilk parça RSVP'yi bulur). `/uye/biletler` kişisel QR `HTTPS://<HOST>/T/{TOKEN}`. **`src/pages/t/[token].astro`:** görevli değilse yalnız "Bu bir etkinlik biletidir"; görevliyse giriş ekranına. `/etkinlik/[slug]/giris` (host/scanner; island yalnız bu sayfada: `BarcodeDetector` varsa o, yoksa küçük JS çözücü — iOS Safari'de yok, doğrulanır; localStorage kuyruğu + senkron; ses/titreşim; görevli 120/dk). Giriş ADR K1.4 sırası; `event_rsvps.checked_in_at/checkin_method/checked_in_by`; tekrar okutmada "Zaten geldi (09:41)" (ADR §0 #30). Davetlinin hesabı 24 saatten gençse davet edenin bekleyeni `matures_at` alır (ADR K2). `event_hosted` için bu adımda yazım YOK (F3-06 cron, canlı sayım). `etkinlik.ts:31-36` `awardPoints` kalkar, `spendPoints` kalır. Kayıtsız gelen: kapıda davet QR'ı → kayıt → bilet.
**Kabul:** AC-15, AC-16, AC-18; `/t/x` misafire bilet mesajı; bozuk imzalı token 404.
**Dosyalar:** `src/pages/t/[token].astro`; `src/pages/uye/biletler.astro`; `src/pages/etkinlik/[slug]/giris.astro`; `src/pages/api/uye/etkinlik.ts`; `src/lib/rewards.ts`. **Bağımlı:** F3-02.

### F3-05 · Dönen QR `/c/[etkinlik]/[token]`
`{etkinlik}` = `events.id`. Girişteki ekran 30 sn'de bir yeniler: token = base32(HMAC-SHA256(env sırrı, `"c:"+eventId+":"+pencere`)) büyük harf; önceki pencere geçerli; girişli + `starts_at ≤ now ≤ ends_at`; kayıtsız → RSVP otomatik (kapasite) → giriş (F3-04 ile aynı K1.4 sırası, `checkin_method='rotating'`). **Kabul:** AC-17. **Dosyalar:** `src/pages/c/[etkinlik]/[token].astro`; `src/pages/etkinlik/[slug]/ekran.astro`. **Bağımlı:** F3-04.

### F3-06 · Etkinlik sonrası
Cron `ends_at+48h` (`birKezCalistir('etkinlik-host', String(eventId))`): `katilimci = count(checked_in_at)`, `toplam = min(katilimci,100)×5`, saf `hostPaylari(toplam, hostlar)` (eşit, aşağı yuvarla, kalan açana) + `it.each` → her host'a `awardPoints(event_hosted, 'event:{id}')` (ADR K2: bekleyen satır yok, canlı sayım). Pano host'a "bekleyen ≈ N, {tarih}" satırını canlı sayımdan gösterir. `ratings.event_id` 7 gün (yalnız giriş yapanlar); `event_well_rated` (ort ≥ 4,0 ve ≥10) 7. gün cron'u; CSV indirme.
**Kabul:** 101 girişli etkinlikte toplam 500; 3 host'ta 166/166/168 (kalan açana); cron ikinci koşumda no-op.
**Dosyalar:** `src/pages/api/cron/gunluk.ts`; `src/lib/economy.ts` + test; `src/pages/etkinlik/[slug].astro`; `src/pages/uye/index.astro`. **Bağımlı:** F3-03, F3-04.

---

## Faz 4 — Harita ve mesaj (4)

### F4-01 · Güvenlik önkoşulları (Faz 1'e alınabilir)
`harita.astro:155-160` popover `innerHTML` → DOM API/`textContent`; `kulup.ts:19` ad uzunluk/karakter doğrulaması; `markdown.ts` `renderer.link` https beyaz listesi (`profil.ts:17-18` regex'i) + `markdown.test.ts` tablosu. **Kabul:** AC-24. **Bağımlı:** yok.

### F4-02 · Harita görünürlük, popover üye ızgarası, filtreler
`users.map_visible_at`; profil formunda açık rıza metni (`profil.astro:53-58`); `profil.ts:24` il beyaz listesi. **Yeni API ucu açılmaz:** `harita.astro` zaten SSR ve pin verisini `data-*` ile gömüyor (`harita.astro:12, 95-97`) → üye ızgarası (yalnız `map_visible_at IS NOT NULL`) `data-uyeler` olarak aynı yolla, filtreler (topluluk / kurs / takip) sorgu parametresi. Popover: avatar, ad, seviye (`social.ts getLevelsMap`), Profil / Mesaj, o ildeki yaklaşan etkinlikler (`events.il`). **Kabul:** AC-21 (yalnız harita yanıtları; şehir `/uyeler`'de zaten açık — `docs/assumptions.md`). **Bağımlı:** F4-01, F3-02 (`events.il`).

### F4-03 · DM v1
`messages` (ADR K6, tek tablo); `/uye/mesajlar` gelen kutusu + konuşma; `users.dm_policy` (everyone | mutual [varsayılan: ortak topluluk ya da karşılıklı takip] | nobody); yeni konuşma koşulu tek SQL `EXISTS` (club_members ortak / follows karşılıklı / Sv4+); günde 20 yeni konuşma; gönderimde 30 sn (`feed.ts` deseni). **Düz metin + yalnız https otomatik link; markdown yok.** Okunmamış DM sayısı mevcut `BildirimZili` island'ına tek sayı olarak eklenir (ayrı uç yok); yoklama yalnız açık konuşma sayfasında (ADR K4); `notifications`'a yazılmaz. **Kabul:** AC-23, AC-24. **Bağımlı:** F4-01.

### F4-04 · Engelle ve şikâyet
`blocks`; etki iki yönlü: DM gönderimi (F4-03 EXISTS'e `NOT EXISTS blocks`), harita üye ızgarası (F4-02 sorgusuna filtre), Mesaj butonu. `reports.target_type` += user|message (F1-10 tablosu); şikâyet butonu konuşma ve profilde. **Kabul:** AC-22. **Bağımlı:** F1-10, F4-02, F4-03.

---

## Faz 5 — 2. seviye, havuz, ekonomi kartı, suistimal (4)

### F5-01 · `invite_second_level`
Kurs aktivasyonunda `referrals.inviter_id WHERE invited_id = <davet eden>` → A'ya +5, refId `u:{invitee}` (davetli başına 1); davet tavanında; açılış tarihinden önceki aktivasyonlara dağıtılmaz. Not: `?ref` canlıda kırık olduğu için `referrals` verisi eksik olabilir (F1-00 sonrası dolar). **Kabul:** AC-10. **Bağımlı:** F1-00, F2-03, F2-04.

### F5-02 · Canlılık havuzu
Saf `canlilikV`, `havuz(V) = V<10 ? 0 : min(100, round(15·ln(1+V)))`, `havuzDagit(havuz, paylar)` (50/30/20; aşağı yuvarla, kalan üreticiye, hak sahibi yoksa dağıtma; **aynı kişinin birden çok dilimdeki payı kullanıcı başına toplanır**, çünkü refId `course:{id}:{YYYY-Www}` kişi başına tek satır taşır) + `it.each`; TR-saatli ISO hafta yardımcısı + test; cron `job='canlilik-havuzu'`, `periodKey='2026-W41'`, pazartesi kontrolü TR gününe göre; `vitality_pool`; tavana girmez. **Bağımlı:** F1-07, F1-08, F2-03.

### F5-03 · Ekonomi kartı `/uye/admin`
Aktif üye başına haftalık basılan puan; kaynağa göre dağılım; davet payı (%40 eşiği uyarısı); kırpılan/düşen bekleyen oranları; kurs ve etkinlik hunileri (katılım→aktivasyon→tamamlama; kayıt→giriş). Tek SQL. **Bağımlı:** F2-03, F3-04.

### F5-04 · Suistimal raporu
`users.flagged_at` kolonu (şema dilimi burada); `invite_visits` ip/ua kümeleri → aynı davetçiye 24 saatte N yeni hesap → `flagged_at`, bekleyenler bekletilir, admin kuyruğu; işaretliler lider/lig sorgularından çıkar (`lider.astro`, `league.ts`, `social.ts`). **Bağımlı:** F2-01, F2-03.

---

## Kabul kriteri → issue eşlemesi

| AC | Issue | AC | Issue | AC | Issue |
|---|---|---|---|---|---|
| 1 | F1-04 | 10 | F5-01 | 19 | F3-03 (düşme cron'u F1-06) |
| 2 | F1-03 | 11 | F2-04 (+F1-11 DB testi) | 20 | F3-03 |
| 3 | F1-06 (+F1-11 e2e) | 12 | F2-01 | 21 | F4-02 |
| 4 | F1-06 (+F1-11 e2e) | 13 | F1-06, F1-07, F2-03 (+F1-11) | 22 | F4-04 |
| 5 | F2-02, F2-03 | 14 | F1-06 | 23 | F4-03 |
| 6 | F2-02 (**elle**) | 15 | F3-04 | 24 | F4-01, F4-03 |
| 7 | F2-02 | 16 | F3-04 | 25 | F1-04 (her issue) |
| 8 | F2-03 | 17 | F3-05 | | |
| 9 | F2-02 | 18 | F3-04 | | |
