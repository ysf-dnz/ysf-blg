# PROGRESS — ysf-blog "Bilgi Ödüldür" Platformu

> Oturum kapanış kaydı (2026-08-09). Mimari anayasa: `CLAUDE.md`.
> Bu dosya: son durum + QStash kararı + kalan işler. Yeni oturum buradan devam eder.

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
