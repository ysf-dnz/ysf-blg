# PROGRESS — ysf-blog "Bilgi Ödüldür" Platformu

> Oturum kapanış kaydı (2026-08-09). Mimari anayasa: `CLAUDE.md`.
> Bu dosya: son durum + kalan işler. Yeni oturum buradan devam eder.

## 🎓 FAZ 1 TAMAM — Kurslar (2026-10-11, dal `faz1-kurslar`, push EDİLMEDİ)
İssue'lar GitHub #1–#13 (F1-00, F1-0T, F1-01…F1-11). Kod: 3 commit (hotfix+test altyapısı · motor · sayfalar).
- **Canlı bug onarımı (F1-00)**: `/?ref=` statik sayfada çerez kurmuyordu → `Base.astro` inline script. **search.spec kök nedeni** D3Chart yorumundaki literal `<script>` (Vite dep-scan) — düzeltildi.
- **Şema** Neon'a push'landı (dev=canlı!): `course_enrollments`, `course_resources`, `ratings`, `reports`, `pending_points`; `courses.slug` (backfill → NOT NULL), summary/cover_url/level/est_minutes/hidden; `comments.course_item_id/accepted_at/hidden_at`; `likes.comment_id`; reason +5.
- **Motor**: `awardPoints` → `number` + tek-SQL tavan (`tavanIcin` otomatik); `pending_points` (`puanOlayi`, kesinleşme ÖNCE ledger); `revokePoints`; `egitim.ts` (join/complete C-ilkeli, course_launched, asgari süre, accept-answer, resource, rate); `feed.ts` kurs yorumu/beğenisi; `sikayet.ts`; admin kurs onayı + şikâyet kuyruğu; cron `bekleyen`.
- **Sayfalar**: `/kurslar` (filtre/sıralama, gruplu sayımlar), `/kurslar/[slug]` (misafir ilk öğe + kilit CTA, JSON-LD Course, og kapak, soru-cevap, ek kaynak, değerlendirme, paylaş), `/dersler` & `/egitim/[id]` → 301, `sitemap-kurslar.xml`, robots `.com`, pano "Bekleyen puan".
- **Düşman inceleme (4 mercek × çürütme, 34 ajan)**: 28 bulgu doğrulandı ve düzeltildi — kritik: JSON-LD `set:html` kaçışsız (kurs başlığı `</script>` ile stored XSS; `JsonLd.astro`'da da aynı kalıp) → `\u003c` kaçışı + başlık 90; yüksek: onaysız kursta en iyi cevap çiftliği → `k.status='published'` + `answer_accepted` günlük tavan 30 + yorum önce kurs doğrulaması; orta: tavan yarışı (paralel N istek aynı anlık görüntü → N kat aşım) → `db.batch` + `pg_advisory_xact_lock` (entegrasyon testi TAM 100), admin "geri aç" pending/rejected kursu yayınlıyordu → durum kapısı, şikâyet hedef doğrulama + 10/saat, ek kaynak 3 bekleyen sınırı, `course_launched` hesap yaşı (`puanOlayi` + en genç katılımcı), kurs kaldırılınca bekleyen üretici puanları düşer, coverUrl `URL.canParse`, slug soneki rastgele, `İ` slug'ı, `/egitim/[id]` tamsayı, og boyutu yalnız varsayılan görselde, `guvenliYol()` tek yardımcı, seed en iyi cevap can'a, build bekçisine sitemap/redirect kontrolleri, AC-2 testi id→slug'ı gerçekten sınar.
- **Testler**: birim 119 (+7 kurs-ekonomi), **entegrasyon 7/7 gerçek Neon** (AC-11/13 tavan TAM 100, K2, K5), e2e kurslar.spec 5 + kurs.spec 3 (auth, ticket) yeşil; `npm run qa`: check/unit/build/postbuild/bekçi yeşil; e2e tam takım taze sunucuda 43/45 → kalan 2 soğuk-başlangıç zaman aşımı (`domcontentloaded` + lokal 1 retry ile giderildi, 11/11). **Tuzak**: build, çalışan dev sunucusunun Vite önbelleğini geçersiz kılar → e2e sırasında tam sayfa reload; qa'yı bayat sunucuyla koşturma (`lsof -ti:4321 | xargs kill` + `rm -rf node_modules/.vite`).
- **Bilinçli kalan**: `seed:demo` demo kursu silip yeniden kurar → gerçek üyelerin demo kurstaki ilerleme/katılımı silinir, `course_completed` yeni kurs id'siyle yeniden kazanılabilir (dev=canlı; demo kursa gerçek üye katılmış olabilir — seed'i canlıda bilinçli koş). `spendPoints` kilitsiz (refId başına tek harcama pratik korumadır).
- **Nasıl denerim**: `npm run seed:demo` → `/kurslar` → `/kurslar/sifirdan-go-learning-go-yol-haritasi-demo` (misafir: 1. öğe açık, 2. kilitli; üye: Kursa katıl → Tamamlandı işaretle → aside ✅; soru sor/beğen; Ek kaynak öner) · üretici (ayse demo, girişsiz) yerine admin olarak `/uye/admin` → "Onay bekleyen kurslar" ve "Şikâyet kuyruğu" · `/uye/egitim-olustur` ile 3 öğeli kurs → `?yayin=1`/`?onay=1` · `/dersler` → 301 · `/sitemap-kurslar.xml`.
- **Elle doğrulanacak (admin girişi gerekir)**: admin panelindeki kurs onayı ve şikâyet kaldır/geri aç akışı (e2e test üyesi admin değil).
- **Sonraki**: Faz 2 (GitHub #14): davet kodu + `/d/[kod]` + `/d/q/[kod]`, runtime kart (satori→dependencies, includeFiles, uqr), davet bekleyenleri (`puanOlayi` hazır), davet tavanı 300 (`tavanIcin`'e eklenir), Davetlerim.

## 🧭 FAZ 0 TAMAM — Kurs · Davet QR · Topluluklarımız · Etkinlik girişi · Harita/DM (2026-10-11)
PRD: `docs/prd/kurs-topluluk-ekosistemi.md`. Kod/şema/bağımlılık DEĞİŞMEDİ; yalnız belge.
- **ADR:** `docs/adr/0001-kurs-davet-etkinlik-harita.md` — neon-http atomiklik (A/B/C ilkelleri, `awardPoints` `tavan` parametresi + `number` dönüş), `pending_points` tek tasarım (ÖNCE ledger SONRA status), kart/QR hattı (satori+resvg → dependencies, `includeFiles`, `uqr`, `/D|T|C/` → `astro.config redirects` 301), yoklama kararı, iade = negatif `admin_adjust` (seviye düşmez), veri modeli kesin hâli + reason→refId tablosu, PRD'nin kodla çelişen 28 noktası.
- **Issue planı:** `docs/prd/kurs-topluluk-ekosistemi-issue-plani.md` — Faz 1 (13), Faz 2 (6+human), Faz 3 (6), Faz 4 (4), Faz 5 (4); AC-1..25 eşlemesi. GitHub'da HENÜZ AÇILMADI (onay bekliyor).
- **Sözlük:** `CONTEXT.md` "Kurs ve etkinlik" bölümü (16 terim) + Davet/Karşılama sayfası netleştirmesi. `docs/assumptions.md` (14), `docs/ideas.md` (9) açıldı.
- **Canlıda doğrulanan 2 kritik bulgu:** (1) `/?ref=x` statik → `Set-Cookie: ysf_ref` YOK → **davet zinciri canlıda kırık** (hotfix F1-00: `Base.astro`'da 3 satır inline script). (2) Vercel rotaları harf duyarlı (`/Dersler` 404) → `/D/` normalizasyonu middleware'de yapılamaz.
- **Bekleyen (Yusuf):** 7 soruya yanıt (issue planı başı / son mesaj); Clerk dashboard'da e-posta kodu stratejisi; onay sonrası issue açılışı ve F1-00 hotfix.
- **Faz 1 ilk işleri:** F1-0T (qa yeşil önkoşulu: search.spec + @clerk/testing), `awardPoints` `number` dönüşü için `begeniPuaniVer` imzası (`rewards.ts:317,346`), slug backfill nullable-first. Tutarlılık denetimi (3 mercek) sonrası düzeltildi: `?k=qr` destination Astro'da çalışmaz → `/d/q/[kod]` ayrı sayfa; `event_hosted` bekleyen satırı yok (canlı sayım); hesap yaşı kuralı tüm bekleyenlere.

## 🆕 TOPLULUK MOTORU (2026-08-09, ikinci oturum)
**Görev 2.0 + hiyerarşi + lig/sezon + ödül mıknatısı** — plan: `~/.claude/plans/bunlar-bu-skill-e-giggly-raven.md`
- **Görev sistemi**: atomik claim (`WHERE status='backlog'` + RETURNING), kulüp üyeliği şartı, üye başına 2 aktif görev limiti, yönetici "Ata ▾" doğrudan atama, Kolay/Orta/Zor zorluk presetleri (25/50/100), `due_at` UI + geri sayım rozetleri, `/uye`'de "Görevlerim", tüm geçişlerde bildirim, kampanya kapatma (`action=close` → kampanya.ts).
- **Hiyerarşi**: kulüp içi gruplar (`club_groups`; lider otomatik mod), mod terfi UI (🛡️±), grup hedefli görev (ilk 48s yalnız grup — `?grup=1`), grup katkı özeti (30g), 19+ üye nudge'ı. API: `kulup.ts` grup-kur/grup-ata/rol/lig-kur.
- **Lig/Sezon**: `lib/league.ts` (skor = pozitif katkı ÷ √üye; `aktifSezon()` yoksa ayı otomatik açar), `/lider?t=lig` Kulüpler Ligi, kulüp sayfası 🏟️ Lig sekmesi (sıra + iç sıralama + başkanın özel ligleri `club_leagues`).
- **Ödüller**: `lib/rewards.ts` — `awardPoints()` puanın TEK KAPISI (tüm 11 endpoint refactor edildi); streak (lazy: dün→+1, 7g→+25+rozet, 30g→+150+rozet), seviye açılımları (3: hazine kitabı bedava `source=level`; 5: +kitap+usta-okur; 7: quiz/eğitim onaysız yayın — quiz-olustur.ts/egitim.ts), sayaç rozetleri (gorev-10, quiz-ustasi, davetci-5→bedava kitap), ilk-yazi/kulup-kurucu rozetleri (admin.ts), rozet vitrini `/uye`+`/u/[handle]`, sıradaki-seviye kartı.
- **Cron (Vercel)**: `vercel.json` → `GET /api/cron/gunluk` (03:00 UTC; `CRON_SECRET` Bearer/x-cron-secret — .env.local'e eklendi). İşler: bayat görev süpürme, sezon kapanışı (şampiyon kulübe sezon-sampiyonu rozeti + site ilk 10'a hazine kitabı) + yeni sezon, ayın 1'i oylama birincisi → "Ayın Kitabı" kampanyası + oy sıfırlama, biten özel liglerin kapanışı (lig-birincisi). `cron_runs` idempotency doğrulandı (2. çağrı no-op, auth'suz 401). NOT: QStash kararı yerine Vercel Cron seçildi (daha az bağımlılık).
- **Şema**: +5 tablo (seasons, club_leagues, club_groups, badges, cron_runs), `club_members.group_id`, `campaign_tasks.group_id`, `users.streak_count/streak_last_day`, ledger reason +3 (streak_bonus, season_reward, level_reward). Neon'a push'landı.
- **Onarımlar**: kulüp etkinliği ucu (clubId + kulüp rolü), ⭐ öncelikli koltuk UI (checkbox + sayaç), etkinlikler kulüp redirect'i.
- **Test**: `tests/unit/league-rewards.test.ts` (12 test — normalizasyon, streak, sezon penceresi); toplam 102 birim yeşil; build yeşil; seed genişletildi (2 grup, özel lig, 4 rozet, streak'ler).

## ✅ Tamamlanan (kronolojik özet)
1. **UX temeli**: mobil nav, skip-link, aria-current, erişilebilir pagination, boş durumlar, reduced-motion.
2. **Animasyon sistemi**: `motion.css` + `features/motion/init.ts` (reveal/stagger/ticker/progress), View Transitions, hero word-reveal, girih drift, story ring spin, 3B kitap kapakları.
3. **Platform çekirdeği (Faz 0-1)**: Clerk (Google, TR) + Neon/Drizzle (~25 tablo), middleware korumalı `/uye/**`, kitap erişim kapısı (server island `OkumaKapisi`), statik kitap sayfaları korundu; rss/og/md endpoint'leri prerender bekçisiyle statik.
4. **Faz 2-5**: üye yazıları (Medium editör: floating toolbar, otosave, görünürlük public/members) + admin onay + `/topluluk` feed (beğeni=puan) + `/u/[handle]` profil (bio, sosyal linkler, takip) + Kahoot quiz (sunucu puanlama) + `/lider` + kulüpler (`club_id` çok-kiracılı) + Kanban kampanya panosu + eğitim stüdyosu (YouTube+yazı+quiz karışık müfredat) + 81 il SVG haritası + davet/temsilcilik.
5. **Topluluk IA/UI**: `ToplulukLayout` sekme çubuğu (8 sayfa), sağ ray (mini liderlik, aktif kampanya, etkinlikler), `routes.ts`, `social.ts`/`books-lookup.ts` N+1 temizliği, FeedCard/Avatar/EmptyState bileşenleri.
6. **Ekonomi korumaları**: `economy.ts` — beğeni freni (kişi-başı günde 5 puanlı), kulüp haftalık görev tavanı 1000p (otomatik kırpma + pano bütçe rozeti); harcamalar: kitap hediye (100p), öncelikli koltuk (25p), flair mağazası (50p).
7. **Bilgi Hazinesi**: 5 kitap seçimli onboarding (ilki hediye), `learning_list`, panoda kilitli hazine çubukları, editörde 🎯 hedef rozetleri.
8. **Kitap sayfası konsepti**: 💎 NotebookLM değer kartı (`deger-notlari.json`; Mindset gerçek üretim), kilit vitrinli kart ("açılınca seni bekleyenler"), ref-kodlu paylaşım (WA/LinkedIn/IG) + 🎴 canvas davet kartı, abonelikler KALDIRILDI, hazine açılış konfetisi + indirme bandı (`?acildi=1`).
9. **Kulüp ortak kütüphanesi**: `club_books` (katalog kitabı veya not/https kaynak), Kitaplık sekmesi.
10. **Test altyapısı**: e2e dev-server'a taşındı (preview desteklenmiyor — ölçülerek kanıtlandı), build-output bekçisi, `economy/levels/quiz-score/markdown/permissions` birim testleri (90 birim), gate sızıntı testleri; `npm run seed:demo` numune seti (5 üye, kulüp, kampanya, quiz, kurs, etkinlik).

## 🏗️ MİMARİ KARAR: QStash (zamanlanmış işler)
- **Günlük cron**: Upstash **QStash** schedule → `POST /api/cron/gunluk`
  (Upstash-Signature doğrulamalı). İşler: bayat `claimed` görevleri backlog'a döndürme
  (şu an sayfa render'ında lazy — cron'a taşınacak), haftalık kulüp bütçe dönemi kaydı,
  liderlik sezon kapanışı bildirimleri, bildirim özetleme.
- **Sabit-saat fallback**: QStash teslim edemezse Vercel cron (`vercel.json`, 06:00 UTC)
  AYNI endpoint'i tetikler — endpoint tetikleyici-bağımsız yazılır.
- **Idempotency devri**: `cron_runs (job, period_key UNIQUE)` — örn. `gunluk:2026-08-09`.
  Kayıt varsa koşum atlanır → çifte tetik/retry güvenli; iş adımları da idempotent
  (update-where-status, onConflictDoNothing). Kurulum: `vercel integration` ile QStash
  → `QSTASH_*` env → endpoint + `cron_runs` şeması → schedule → fallback → birim test.

## 📋 KALAN İŞLER (öncelik sırası)
1. `npm run qa` tam yeşil koşum (son koşum token sınırında yarım; d3 spec timeout 25 sn'e çıkarıldı, Vite cache temizlendi).
2. **Commit + Vercel deploy** (hiç yapılmadı). Öncesi: Vercel env `PUBLIC_CLERK_PUBLISHABLE_KEY` eşlemesi, `SITE_URL`, Clerk prod instance.
3. QStash kurulumu (yukarıdaki karar birebir).
4. Auth'lu e2e (`@clerk/testing`): hazine seçimi → yazı → onay → kilit açma akışı.
5. 884 kitaba toplu değer notu (NotebookLM MCP batch — QStash kuyruğuyla sürülebilir).
6. Canlı quiz odası (PIN+WebSocket), Resend e-posta, moderasyon, streak.
7. Küçük borçlar: `hikaye/[id]` EN, astro-check hint'leri, FeedCard'ın kulüp sayfasında kullanımı.

## ⚠️ Risk kaydı (bilinçli kabul edilenler + izlenecekler)
- **Güvenlik — üye içeriği**: markdown'da `<` escape edilir (`lib/markdown.ts`) → inline HTML/script çalışmaz; ancak link URL'leri serbest (javascript: engeli marked'ta yok — İZLE: link protokol beyaz listesi eklenebilir). Sosyal linkler yalnız `https://` regex'iyle kabul.
- **Quiz hile koruması**: doğru cevap istemciye gitmez, puanlama sunucuda; ama süre istemci saatiyle ölçülür (ms değeri kullanıcı manipüle edebilir → hız bonusu şişebilir; puan tavanı 50 olduğundan risk sınırlı — İZLE).
- **Drive sızıntısı**: misafir DOM'unda iframe/link olmaması `gate.spec` bekçisiyle korunur; `uc?export=download` linki yalnız erişimi olana render edilir ama URL tahmin edilebilir (fileId public) — GERÇEK koruma Drive tarafındaki izinler; site sadece vitrin kapısı.
- **Rate limit yalnız feed/yorum POST'unda** (30 sn); diğer API'lerde yok (kitap-ac/hediye-et bakiye kontrollü olduğundan düşük risk; takip/oy spam'i İZLE).
- **Moderasyon yok**: yayın admin onaylı ama feed anlık — şikâyet mekanizması Kalan İşler #6'da.
- **Davet kartı canvas**: kapak görselleri `lh3.googleusercontent` CORS'una bağlı; taint olursa kapaksız karta düşer (fallback kodda var).
- **Ref cookie** 30 gün `lax`; davet puanı yalnız İLK kayıtta işlenir (referrals.invitedId unique).
- **Node 26 lokalde** — Vercel functions desteklemiyor uyarısı: deploy'da Vercel kendi Node'unu kullanır, lokal build uyarısı zararsız.
- **EN i18n borcu**: topluluk sayfalarının tamamı TR-only (EN karşılıkları yok); EN ana sayfa hikâye linkleri TR'ye gider (bilinçli).
- **Demo üyeler girişsizdir**: `demo_*` clerkId'lerin Clerk hesabı YOK — profilleri/verileri görüntülenir ama onlarla oturum açılamaz; auth'lu test için gerçek Google girişi veya @clerk/testing gerekir.

## 🛠️ Runbook (operasyon el kitabı)
- **Dev sunucu hastalanırsa** (EMFILE / 504 Outdated Optimize Dep / island 500): sunucuyu durdur → `rm -rf node_modules/.vite` → yeniden başlat. Island 500'ü kod sanmadan önce bunu dene; gerçek hatayı `preview_logs`/dev log'unda "Failed query" satırında ara.
- **Şema değişikliği**: `src/db/schema.ts` düzenle → `node --env-file=.env.local node_modules/.bin/drizzle-kit push --force` (TTY olmayan kabukta interaktif soru soramaz; kolon tipi değişimi soru doğurursa boş tabloyu elle `drop table` edip tekrar push — bu oturumda course_progress'te yapıldı).
- **Seed**: `npm run seed:demo` — idempotent; önce `demo_%` kullanıcıları ve TÜM bağlı verilerini FK sırasıyla siler, sonra kurar. Gerçek kullanıcı verisine dokunmaz.
- **Env'ler**: `.env.local` = `vercel env pull` çıktısı + entegrasyon eklerken otomatik güncellenir. Clerk anahtarları `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`/`CLERK_SECRET_KEY`; astro.config `loadEnv` ile okur. `POSTGRES_URL` Neon pooled; drizzle-kit ve seed `--env-file` ile koşar.
- **Vercel**: proje bağlı (`.vercel/project.json`: prj_xHCJIvCDfbyM1K0hqWPAuDwtmDuW, team faruks-projects-447cf768, CLI girişi `yusufdeniz`). Kurulu entegrasyonlar: Clerk (kaynak: clerk-coquelicot-pocket) + Neon. Yeni entegrasyon şart onayı isterse: `vercel integration add <ad>` → çıkan verification_uri'yi KULLANICI tarayıcıda onaylar → komut tekrar koşulur.
- **Admin olmak**: `sn.yusufdeniz@gmail.com` ile ilk Google girişi otomatik admin (`OWNER_EMAILS`, `src/lib/member.ts`); panel `/uye/admin` (bekleyen yazı/quiz/kulüp/başvuru kuyrukları).
- **Test**: `npm test` (90 birim, DB'siz — db istemcisi tembel Proxy), `npx playwright test` (dev server'ı kendi kaldırır; 4321 doluysa `reuseExistingServer` mevcut sunucuyu kullanır — bayat sunucuya dikkat), `npm run qa` hepsi. Tek spec: `npx playwright test tests/e2e/gate.spec.ts`.
- **NotebookLM değer notu üretimi**: MCP `notebook_query(notebook_id, "…nöropazarlama tanıtımı…")` → `src/data/deger-notlari.json`'a `bookId: {baslik, metin}` ekle. Mindset defteri: `5629a23a-c1bb-442d-91f2-15400ec06df4`. Sık kullanılan kitap id'leri: Mindset `1JlqnQCbEoW5DGVOXte4O88AdSofFbH2Z`, Learning Go `1h6nwQ-jHvqKuCtpiP3kdb5GsBtOcPww6`, Effective Go (numune) `1pASwcWSHzwO55U2Lv-v4giPCoZBmdy-l`.
- **Keystatic admin**: yalnız `npm run admin` (ASTRO_KEYSTATIC=1); prod build'e admin çıkmaz. Pagefind: postbuild dist'i indexler ve `public/pagefind`e kopyalar (dev'de arama bu kopyadan çalışır).

## 🧭 Oturum sürekliliği (sıfırdan başlarken)
- **Plan dosyası**: `~/.claude/plans/macbook-macbook-pro-ysf-blog-i-in-ux-sprightly-llama.md` (sıradaki adımların ayrıntısı).
- **Kalıcı hafıza**: `~/.claude/projects/-Users-macbook-Downloads-ysf-blog/memory/` (otomatik yüklenir).
- **`.env.local` kaybolursa**: git'te YOK (bilinçli). Kurtarma: `vercel link --yes` (proje zaten bağlı) → `vercel env pull` → Clerk+Neon env'leri entegrasyonlardan otomatik gelir. NotebookLM MCP oturumu düşerse: `nlm login`.
- **Remote**: `git@github.com:ysf-dnz/ysf-blg.git` (origin/main push'lu, takipli). Neon'daki DB şeması ve seed verisi buluttadır, kayıp riski yok.

## Bilinen dev tuzakları
- Uzun dev oturumu: EMFILE / `504 Outdated Optimize Dep` → restart + `rm -rf node_modules/.vite`.
- `astro preview` Vercel adapter'da çalışmaz; e2e dev server'a koşar.
- Clerk env adları: entegrasyon `NEXT_PUBLIC_*` verir, `@clerk/astro` config'te `loadEnv` ile okunur.
- Demo hesaplar `demo_` clerkId'li — gerçek girişle çakışmaz; `seed:demo` idempotent.
