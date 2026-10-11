# ADR 0001 — Kurslar · Davet kartı/QR · Etkinlik girişi · Harita/DM

**Durum:** Kabul edildi (Faz 0, 2026-10-11) · **Kaynak:** `docs/prd/kurs-topluluk-ekosistemi.md` · **Kapsam:** PRD'nin Faz 1–5'i boyunca geçerli mimari kararlar.

Her "doğrulandı" iddiasında dosya:satır vardır. Doğrulanamayanlar **belirsiz** işaretlidir ve ilgili fazın ilk işi olarak issue planında yer alır. Canlı doğrulamalar 2026-10-11'de `curl -sI` ile yapıldı.

---

## 0. Bağlam: PRD'nin kodla çelişen ya da yanlış varsayan noktaları

| # | PRD ifadesi | Kod/canlı gerçeği (kanıt) | Karar |
|---|---|---|---|
| 1 | §1 `?ref=handle` → `ysf_ref` çerezi (30 gün) çalışıyor | **Canlıda çerez kurulmuyor.** `/?ref=plantest` → 200, `x-vercel-cache: HIT`, `Set-Cookie` yok. Ana sayfa statik (`src/pages/index.astro`'da `prerender=false` yok, `astro.config.mjs:35` `output:"static"`); `.vercel/output/config.json`'da `{handle:"filesystem"}` `_render` rotalarından önce, catch-all yok → middleware (`src/middleware.ts:8-16`) hiç koşmaz. Üç link üreticisi `/?ref=` üretiyor: `src/features/library/OkumaKapisi.astro:68`, `src/pages/api/uye/kitap-linkler.ts:39`, `src/pages/uye/index.astro:151`. SSR sayfada (`/aramiza-katil?ref=`) çerez kuruluyor. | Hotfix F1-00: statik sayfalarda 3 satırlık `is:inline` script çerezi istemcide kurar (mevcut çerez zaten httpOnly değil). Mevcut `referrals` verisi eksik olabilir; 2. seviye (Faz 5) bunu bilerek açılır. |
| 2 | §4.1 "mevcut kural: diğerleri admin onayından geçer" | Admin onay yolu **yok**: `src/pages/api/uye/admin.ts` ve `src/pages/uye/admin.astro:14-28` yalnız memberPosts/clubs/quizzes/applications. Pending kurs hiç yayınlanamıyor. | F1-01: admin kuyruğuna kurs onayı. |
| 3 | §4.1 "yayın için en az 3 öğe" (mevcut gibi) | 0 öğeli kurs `published` olabiliyor: `egitim.ts:134` ham form sayısına bakıyor, geçersiz öğeler `:157,:172,:184`'te `continue`; kurs satırı öğelerden önce yazılıyor (`:137-151`). | F1-02: öğeler önce çözülür, geçerli < 3 → 400. |
| 4 | §4.1 "misafir ilk öğeyi görür, diğerleri giriş ister" | Misafir tüm öğeleri görüyor (`src/pages/egitim/[id].astro:39-56, 96-129`). | Yeni davranış, F1-04. |
| 5 | §4.1 "üye yazılarının görünürlük kuralları korunur" | **Korunmuyor:** kurs sayfası `status/visibility` kontrolsüz tam render (`egitim/[id].astro:45-50, 113-118`); API başkasının yazısını öğe kabul ediyor (`egitim.ts:166-171`). | F1-01 güvenlik önkoşulu; sitemap'e girmeden kapanır. |
| 6 | §1 "pending kurs onay bekler" | Pending kurs `/egitim/[id]`'den herkese açık ve ilerleme alıyor (`egitim/[id].astro:18` yalnız draft'ı yönlendiriyor). | F1-01: pending/draft yalnız üretici ve admin, diğerlerine 404. |
| 7 | §4.2 "görev 25–100" | `taskDefault 50` × `campaignMultiplier 1.5` = 75, görev başına ayarlanabilir (`src/lib/points.ts:33,35`, `src/pages/api/uye/gorev.ts:225`). | PRD metni "görev varsayılan 75". |
| 8 | §4.2 "yeni üye getirmek 100 puan" | Normal üye 25+75=100; temsilci 38+75=113 (`src/lib/member.ts:87-90` `repReferralMultiplier`). | Tavan gerçek delta toplamı üzerinden (K1.3). |
| 9 | §4.2 "haftalık" tavanlar | Mevcut tavanlar **kayan 7 gün** (`egitim.ts:40`, `gorev.ts:41`); ISO hafta yardımcısı yok. | Davet tavanı kayan 7 gün; ISO haftası yalnız havuz anahtarı (K1.3, K6). |
| 10 | §4.2 `cron_runs` anahtarı `haftalik:YYYY-Www` | Konvansiyon: iş adı ayrı `job` kolonunda, `periodKey` yalnız dönem (`src/pages/api/cron/gunluk.ts:16-45, 180-205`). | `job='canlilik-havuzu'`, `periodKey='2026-W41'`. |
| 11 | §0.3 "atomiklik tek SQL'le sağlanır" | Toplam-tabanlı koşullarda yarış daralır, sıfırlanmaz; kesinlik yalnız unique index'ten (K1.5). | Kabul edilen sınır; ADR'de nüans. |
| 12 | §4.2 "mevcut idempotency index'i çift yazımı engeller" | Yalnız `ref_id IS NOT NULL AND reason <> 'like_received'` (`src/db/schema.ts:89-91`). | Her yeni reason refId taşır (§7 tablosu). |
| 13 | §1 Altyapı "satori + resvg OG hattı" | Build-time; ikisi **devDependencies** (`package.json:48,54`); fontlar `process.cwd()/src/...` (`src/features/seo/og/render.ts:11-16`); fonksiyon paketinde `.ttf` yok. | K3.1. |
| 14 | §4.3 / AC-25 "js-budget bütçesi içinde" | Bayt bütçesi değil, köken allowlist'i; yalnız iki yazı sayfasında (`tests/e2e/js-budget.spec.ts:9-38`). | "Bütçe" = allowlist'e yeni köken girmez. LCP: Lighthouse CI var (`lighthouserc.json` performans ≥ 0.95; `.github/workflows/ci.yml:23`) ama yalnız `staticDistDir`'daki iki statik sayfada; yeni SSR kurs/davet sayfaları ölçülmüyor → F2-02'de preview URL'e karşı elle Lighthouse. |
| 15 | §4.5 `event_attended` "taşınır" | RSVP refId `String(eventId)` (`src/pages/api/uye/etkinlik.ts:31-36`). | refId aynen kalır; eski RSVP ödülünü doğal tekilleştirir (K1.4). |
| 16 | §4.6 "mesaj gövdesi `lib/markdown.ts` kaçışından geçer" | `src/lib/markdown.ts:7-10` yalnız `<` kaçışı + marked; protokol beyaz listesi yok, `javascript:` link bugün de üretilebilir (PROGRESS.md risk kaydı); feed düz metin (`FeedCard.astro:57,91`). | DM **düz metin + yalnız https otomatik link**, markdown yok. Beyaz liste Faz 4'te üye yazıları için. |
| 17 | §2.7 / AC-21 "gizlilik varsayılandır" | Şehir `/uyeler` (`src/pages/uyeler.astro:20,30,72`) ve `/u/[handle]` (`:104`) üzerinden bireysel olarak zaten açık. | AC-21 "harita yanıtları" ile sınırlı. |
| 18 | §1 "81 il SVG" | Tek silüet path + 81 il merkez noktası (`src/pages/harita.astro:83-90`, `src/data/il-koordinatlari.json`); il sınırı poligonu yok. | Popover pin tabanlı kalır. |
| 19 | §4.6 harita popover genişler | Popover kulüp adını kaçışsız `innerHTML`'e basıyor (`harita.astro:155-160`), ad doğrulanmıyor (`src/pages/api/uye/kulup.ts:19`) → stored XSS yüzeyi. | F4-01 (Faz 1'e alınabilir): `textContent`/sunucu render. |
| 20 | §4.1 "/dersler, /egitim/[id] → 301" | Redirect altyapısı yok; `Astro.redirect` varsayılanı 302 (`node_modules/astro/dist/core/render-context.js:257` API `context.redirect`, `:544` sayfa `Astro.redirect`); `astro.config`'te `redirects` yok. | K3.3. |
| 21 | §4.1 "sitemap SSR sayfalarını eklemez" | Statik yollu SSR sayfalar **ekleniyor** (`/dersler`, `/uye/*` dist sitemap'te), yalnız dinamik `[slug]` eklenmiyor (`node_modules/@astrojs/sitemap/dist/index.js:69-92`). Sürüm 3.7.3 `filter`, `customSitemaps`, `customPages` destekliyor. | `filter` ile `/uye/*` çıkar; kurs/etkinlik için SSR `sitemap-kurslar.xml` + `customSitemaps`. |
| 22 | §4.3 "Clerk girişi aynı akışta, dönüşte ek dokunuşsuz" | Header girişi her zaman `/uye/hosgeldin`'e zorluyor (`src/layouts/Base.astro:121` `forceRedirectUrl`). | Karşılama sayfasında kendi `SignInButton`'ı `forceRedirectUrl=mevcut URL`. |
| 23 | §8 "her faz sonunda `npm run qa` yeşil" | `search.spec.ts` dev'de kırmızı (CLAUDE.md); qa tüm spec'leri dev sunucuda koşuyor. **Çalıştırılmadı, belirsiz.** | F1-11: dev'de skip ya da çözüm; yoksa hiçbir faz kapanamaz. |
| 24 | §4.8 `users` yeni kolonlar (`il`) | `city` var, `il` yok (`schema.ts:26`); `profil.ts:24` değeri doğrulamadan yazıyor. | `il` kolonu açılmaz; il beyaz listesi `profil.ts`'e. |
| 25 | (PRD'de yok, AC-1'i etkiler) | `public/robots.txt` Sitemap satırı `yusufdeniz.dev`; OG kartında `yusufdeniz.dev` (`render.ts:103`); canlı domain `.com`. | F1-04'te düzelt. |
| 26 | §4.3 "/D/ normalizasyonu middleware'de ya da vercel.json'da" | **Vercel rotaları harf duyarlı**: canlıda `/Dersler` ve `/Etkinlikler` → 404. `/D/x` için ne statik dosya ne `_render` rotası var → middleware'e hiç ulaşılmaz. `vercel.json` redirect'inin Build Output API çıktısıyla birleşimi **belirsiz**. | K3.3: `astro.config.mjs` `redirects`. |
| 27 | §4.8 `src/db/index.ts` | Dosya `src/db/client.ts` (`:19-25` tembel Proxy). | Metin düzeltmesi. |
| 28 | §4.2 "RSVP'de ⭐ harcaması kalır" | ⭐ yalnız ilk RSVP'de ve +10 yazıldıktan sonra alınıyor (`etkinlik.ts:30-46`); bakiyesi 15 olan koltuk alabiliyor. | RSVP puanı kalkınca yan etki kalkar; kapasite ile ⭐ etkileşimi F3-02'de. |
| 29 | §4.3 başarı ekranı "İlk derse başla / ilk dersi bitirince" | Sözlük (`CONTEXT.md` "Kurs") arayüzde "ders"i yasaklıyor. | Metin "İlk öğeye başla / ilk öğeyi bitirince". |
| 30 | §4.5 "Zaten giriş yaptı (09:41)" | Clerk TR yereli oturum açmaya "Giriş yap" diyor (`astro.config.mjs:65`); iki anlam karışır. | Arayüz metni "Zaten geldi (09:41)"; kavram adı "giriş doğrulaması" kalır. |

---

## K1. neon-http altında atomiklik

### K1.1 Üç ilkel, öncelik sırasıyla (yeni ilkel yok)

Her yazma şu üç mevcut desenden biriyle yapılır; "önce oku, sonra yaz" yeni kodda yasak.

| # | İlkel | Repodaki örnek | Ne için |
|---|---|---|---|
| A | `INSERT … SELECT … WHERE (koşul) ON CONFLICT DO NOTHING RETURNING` — koşul WHERE'de, tek SQL | `spendPoints` `src/lib/rewards.ts:277-296` | bakiye, tavan, kapasite, sayaç koşullu yazımlar; iade |
| B | `insert().onConflictDoNothing().returning()` + unique index → satır döndüyse "ilk kez" | RSVP `src/pages/api/uye/etkinlik.ts:25-30`, `awardPoints` `rewards.ts:243-253`, cron `birKez` `gunluk.ts:16-23` | katılım, atıf, bekleyen puan satırı, cron kilidi |
| C | `UPDATE … SET … WHERE <eski durum> RETURNING` → satır döndüyse geçişi bu istek yaptı | repoda yok (SQL'in kendisi) | giriş doğrulaması (`checked_in_at IS NULL`), bekleyen → kesin (`status='pending'`), kurs aktivasyonu (`activated_at IS NULL`), en iyi cevap (`accepted_at IS NULL`) |

**Gerekçe.** Sürücü transaction'ı reddediyor: `node_modules/drizzle-orm/neon-http/session.js:151-158` `throw new Error("No transactions support in neon-http driver")`. Üç ilkel de tek round-trip, tek ifade.

**Alternatif (red).** Neon WebSocket sürücüsü (`Pool` + interaktif transaction): yeni istemci, soğuk başlangıç, `src/db/client.ts:19-25` tembel Proxy deseninin değişmesi.

### K1.2 `db.batch`

**Bulgu (doğrulandı).** Var ve etkileşimsiz: `drizzle-orm/neon-http/driver.js:65-66 → session.batch`, `session.js:117-133` tüm sorguları hazırlayıp tek HTTP transaction'ında gönderiyor. Repoda hiç kullanılmamış.

**Karar.** v1'de **kullanılmaz.** Sonraki ifade öncekinin `RETURNING`'ini göremez; "giriş yazıldıysa ödül ver" gibi bağımlı adımlar yine WHERE'e gömülmek zorunda. Her adım idempotent olduğunda yarım kalan akış sonraki istek ya da cron'da kendini onarır. Faz 3'te ölçülmüş bir gecikme sorunu çıkarsa yeniden değerlendirilir.

### K1.3 Tavanlar tek SQL'de: `awardPoints` `tavan` parametresi

`awardPoints`'e isteğe bağlı `tavan?: { reasons: Reason[]; since: Date; limit: number }`. Verildiğinde insert şu tek SQL olur (A ilkeli, `spendPoints` şablonu):

```sql
insert into points_ledger (user_id, delta, reason, ref_id)
select $u, least($delta, $limit - s.t), $reason, $ref
from (select coalesce(sum(delta),0) t from points_ledger
      where user_id=$u and reason in (...) and created_at >= $since) s
where $limit - s.t > 0
on conflict do nothing
returning delta
```

- **Dönüş tipi `boolean` → `number`**: yazılan delta, `0` = yazılmadı (idem ya da tavan). Truthiness kullanan çağıranlar (`if (!yazildi) return`) kırılmaz. **Kırılan tek yer (doğrulandı):** `begeniPuaniVer` `Promise<boolean>` imzasıyla `return awardPoints(...)` yapıyor (`rewards.ts:317, :346`) → `return (await awardPoints(...)) > 0`. Faz 1'de grep: `return awardPoints`, `= await awardPoints`, `=== true`.
- Saf eşlenik `gorevOdulKirp(istenen, harcanan, tavan)` (`src/lib/economy.ts:20-28`) birim testte ve pano metninde; SQL'in `least/where` kısmı bu fonksiyonun aynısıdır. DB'ye karşı gerçek kanıt F1-11'deki entegrasyon testi.
- Mevcut `kursOduluVer` (`egitim.ts:40-53`, oku-sonra-yaz) bu parametreye taşınır.
- **Pencere:** davet tavanı kayan 7 gün (`now() - 7 gün`, mevcut tavanlarla aynı); üretici günlük tavanı ve kaynak günde 3 TR günü (`gunBaslangici`, `rewards.ts`). ISO haftası yalnız canlılık havuzunda.
- **Temsilci çarpanı:** tavan gerçek delta toplamı üzerinden; rep daveti 38 yazıyor (`member.ts:87-90`).

### K1.4 Giriş doğrulaması: tek istek, idempotent, batch'siz

1. `UPDATE event_rsvps SET checked_in_at=now(), checkin_method=$m, checked_in_by=$g WHERE event_id=$e AND user_id=$u AND checked_in_at IS NULL RETURNING id` → satır yoksa: kayıtlıysa "Zaten geldi (HH:MM)" (ayrı SELECT; §0 #30), değilse kayıtsız akışı. Çevrimdışı kuyruk aynı isteği tekrar gönderir, ikinci UPDATE boş döner (AC-16, AC-18).
2. Satır döndüyse sırayla: `awardPoints(event_attended, refId=String(eventId))` → davetliyse `awardPoints(event_invite_welcome, 'event:{id}')` (anında; bekleyen satır yok) → davet edenin bekleyen `event_invite_attended`'ı K2 sırasıyla kesinleşir; davetlinin hesabı 24 saatten gençse kesinleşme yerine `matures_at = created_at + 24h` yazılır (K2). `event_hosted` için bu adımda hiçbir şey yazılmaz: kaynak `event_rsvps.checked_in_at` sayımıdır, dağıtım F3-06 cron'unda (K2).

**refId kararı.** `event_attended` için refId **`String(eventId)` olarak kalır** (bugünkü RSVP yazımıyla aynı, `etkinlik.ts:35`). Geçişten önce RSVP ile +10 almış üye girişte ikinci +10 alamaz; "geçmiş kayıtlara dokunulmaz" kendiliğinden sağlanır. Yeni etkinliklerde RSVP puan yazmaz, çakışma yok.

### K1.5 Toplam-tabanlı koşullar ve yarış (Faz 1 inceleme sonrası düzeltildi)

Tek SQL'e gömülü **toplam-tabanlı** koşul (toplam < tavan) READ COMMITTED altında N eşzamanlı ifadenin AYNI anlık görüntüyü görmesini engellemez: 8 paralel istek sum=0 görüp 8 ödül yazabilir (aşım "en fazla bir ödül" DEĞİL, istek sayısı kadar). Kilidi aynı ifadeye koymak da işe yaramaz — anlık görüntü kilit alınmadan önce çekilir.
**Karar:** tavanlı yol `db.batch` ile tek HTTP transaction'ında İKİ ifade: `select pg_advisory_xact_lock(user_id)` + `INSERT…SELECT`. İkinci ifade kilitten sonra yeni anlık görüntü alır; `tests/integration/ekonomi-db.test.ts` 30 paralel çağrıda toplamın TAM 100 olduğunu gerçek Neon'da doğrular. Bu, K1.2'deki "`db.batch` v1'de kullanılmaz" kararının tek bilinçli istisnasıdır (neden: bağımlı adım yok, yalnız kilit + yazma).
`spendPoints` (bakiye ≥ maliyet) için aynı yarış teorik olarak sürer; unique `refId` başına tek harcama kuralı pratik riski sınırlıyor. `shortcut: spendPoints kilitsiz; ölçümde çift harcama görünürse aynı batch deseni uygulanır.`

---

## K2. Bekleyen puan (`pending_points`) — tek tasarım

**Tablo.** `pending_points(id, user_id, reason, ref_id, delta, yazilan default 0, status, matures_at, expires_at, created_at, resolved_at)`; `status ∈ pending | confirmed | expired`; `unique(user_id, reason, ref_id)`; `index(status, matures_at)`, `index(status, expires_at)`. Ledger'a girmez → seviye ve bakiye yalnız `points_ledger`'dan (`member.ts:134-152`, `levels.ts:3`), AC-14 tasarım gereği.

- `matures_at`: zamanla kesinleşir (hesap yaşı 24 s). `expires_at`: olay gelmezse düşer (kurs daveti 14 gün, etkinlik daveti `ends_at`). İkisi de nullable; olay-tetikli satırlarda yalnız `expires_at` dolu.
- **Hesap yaşı (PRD §4.2) tüm bekleyenlere uygulanır:** olay geldi (aktivasyon, giriş) ama puanı doğuran hesap (`users.created_at`) 24 saatten gençse kesinleştirme yapılmaz; `UPDATE … SET matures_at = <created_at> + interval '24 hours', expires_at = NULL WHERE id=$i AND status='pending'`, cron olgunlaşınca kesinleştirir. Üretici puanları için de aynı yol (kaynak = öğrenen hesabı). QR'la kapıda ya da karşılama sayfasında yeni kaydolan davetli tam bu durumdadır (AC-5 notu).
- **Kırpma ayrı status değil:** `confirmed` + `yazilan < delta` → panoda "kırpıldı" ve gerekçe (PRD §2.5). Kırpılan kısım geri kazanılmaz.
- **`event_hosted` ve `event_well_rated` için bekleyen satır YOK.** Kaynak veri zaten tabloda: `count(event_rsvps.checked_in_at)` ve `ratings`. Cron `ends_at + 48h`'te `toplam = min(katılımcı, 100) × 5` hesaplar, saf `hostPaylari(toplam, hostlar)` (eşit böl, aşağı yuvarla, kalan açana) ile her host'a `awardPoints(event_hosted, 'event:{id}')` yazar (idem). Pano host'a "bekleyen ≈ N puan, {tarih}" satırını canlı sayımdan gösterir. Upsert/birikim mantığı ve "ortak düzenleyen sonradan eklendi, pay değişti" sorunu böylece yok.

**Kesinleşme sırası (zorunlu): ÖNCE ledger, SONRA status.**
1. `n = awardPoints({userId, delta, reason, refId: pending.ref_id, tavan?})` — idempotent (`points_ledger_idem_idx`); çift çağrıda `0`.
2. `UPDATE pending_points SET status='confirmed', yazilan=$n, resolved_at=now() WHERE id=$i AND status='pending'`.

1'den sonra çökülürse sonraki koşumda 1 `0` döner; `yazilan` ledger'daki `(user_id, reason, ref_id)` satırından okunur (yoksa 0), 2 tamamlanır. Ters sıra "confirmed ama ledger'da yok" bırakır; yasak.

**Cron** (`gunluk.ts` `birKezCalistir`, `job='bekleyen'`, `periodKey=gunKey`): `status='pending' AND matures_at < now()` → kesinleştir (yukarıdaki sıra); `status='pending' AND expires_at < now()` → `UPDATE … SET status='expired'`. Ledger'a dokunmaz.

**Faz 1'e çekilir.** PRD §4.2 hesap yaşı kuralını üretici puanlarına da uyguluyor; `pending_points` Faz 2'de kalsaydı Faz 1 taze hesaplardan tıklama çiftliğine açık kalırdı.

---

## K3. Kart ve QR üretim yolu

### K3.1 satori + resvg çalışma zamanına taşınır

**Bulgu (doğrulandı).** `render.ts:2` "build-time"; `render.ts:11` `join(process.cwd(), "src/features/seo/og/fonts")`; `satori` ve `@resvg/resvg-js` devDependencies (`package.json:48,54`); fonksiyon paketinde `.ttf` yok. Adapter 8.2.11 `includeFiles` destekliyor (`node_modules/@astrojs/vercel/dist/index.d.ts:22`), dosyaları proje köküne göre çözüp ortak-ata düzeniyle kopyalıyor (`dist/lib/nft.js:42-49`).

**Karar.**
1. `satori`, `@resvg/resvg-js` → `dependencies`.
2. `astro.config.mjs:38` → `vercel({ …, includeFiles: ["src/features/seo/og/fonts/fraunces-600.ttf", "…/inter-400.ttf", "…/inter-700.ttf"] })`. `process.cwd()` yolu korunur: `.vc-config.json` handler'ı `dist/server/entry.mjs` ve `nft.js:42-49` ortak-ata kopyalaması paketin proje kökü düzeninde kurulduğunu gösteriyor (koddan çıkarıldı, **muhtemel**); açık kalan tek nokta Vercel çalışma dizininin paket kökü olması → preview smoke. B planı: Vite `?inline` ile fontlar data-URI (+~1 MB chunk, `process.cwd()` bağımlılığı kalkar).
3. `renderOgImage` genişlik/yükseklik parametresi alır (1200×630 → 1080×1920, 1080×1080); tek şablon ailesi.
4. `scripts/check-build-output.mjs`'e "fonksiyon paketinde 3 `.ttf` ve bir `resvg*.node` var" kontrolü.
5. resvg linux-x64 binary'si `package-lock`'ta optional kilitli; `sharp`'ın aynı napi desenli `.node`'u mevcut pakette var → **muhtemel**, yerelde (darwin) doğrulanamaz → preview deploy'da `/api/kart/…png` smoke (F2-05 ilk işi).

### K3.2 QR kütüphanesi: `uqr`

Repoda ve `node_modules`'da QR kütüphanesi yok. **`uqr`** (unjs; 0 bağımlılık, ESM, `renderSVG(text, {ecc:"M", border:4})`; metin büyük harfse alfanümerik mod). Çıktı SVG → satori'ye `<img src="data:image/svg+xml;base64,…">`; istemciye JS gitmez. Alternatifler (red): `qrcode` (geçişli bağımlılıklar), nayuki `qrcodegen.ts` vendor (~1000 satır). Paket boyutu ve mod seçimi **doğrulanmadı** (F2-01 ilk işi).

### K3.3 Yönlendirmeler ve `/D|T|C/` normalizasyonu

**Bulgu (canlı).** Vercel yönlendirmesi harf duyarlı (`/Dersler` → 404). `/D/x` için rota yok → middleware'e ulaşılmaz. Astro rota regex'i de harf duyarlı (`node_modules/astro/dist/core/routing/manifest/pattern.js:22`).

**Karar.** Tek sayfa `src/pages/d/[kod].astro` (`prerender=false`). `astro.config.mjs` `redirects`:
```js
redirects: {
  "/dersler": { status: 301, destination: "/kurslar" },
  "/D/[kod]": { status: 301, destination: "/d/q/[kod]" },
  "/T/[token]": { status: 301, destination: "/t/[token]" },
  "/C/[etkinlik]/[token]": { status: 301, destination: "/c/[etkinlik]/[token]" },
}
```
Adapter bunu `config.json` rotasına yazar; Vercel harf duyarlı olduğu için `^/D/…` regex'i yalnız büyük harfi yakalar. **Faz 2'de yaşanan tuzak:** Astro yönlendirme rotasının ANAHTARINI küçük harfe çevirir (`create.js` `joinSegments` → `/d/[kod]`) ve aynı anahtarlı sayfa dosyasını rota listesinden düşürür (`filteredFiledBasedRoutes`); deseni ise büyük harfe özel kalır → `/d/[kod].astro` sayfası yok oldu, `/d/x` 404 verdi. Çözüm: bağlantı kanalı sayfası `src/pages/d/[...kod].astro` (rest param, farklı anahtar); `/d/q/[kod].astro` hedef olarak kalır. **Kural (koddan doğrulandı):** dinamik parametreli destination yalnız **var olan bir rota anahtarıyla birebir eşleşirse** çözülür (`node_modules/astro/dist/core/routing/manifest/create.js:261` `routeMap.get(destination)`); eşleşmezse adapter hedefi `[kod]` yerine konmadan olduğu gibi yazar (`node_modules/@astrojs/vercel/dist/lib/redirects.js:55-59`). Bu yüzden destination'a query (`?k=qr`) **eklenemez** ve her hedef için aynı parametre adlı bir sayfa dosyası şarttır: `src/pages/d/[kod].astro` (bağlantı kanalı), `src/pages/d/q/[kod].astro` (QR kanalı; aynı handler'ı `kanal='qr'` ile çağıran 3 satır), `src/pages/t/[token].astro`, `src/pages/c/[etkinlik]/[token].astro`. QR içeriği `HTTPS://HOST/D/KOD`, paylaşım bağlantısı `https://host/d/kod`; kanal ayrımı yoldan gelir. Kod gövdesi handler'da `toUpperCase()` + Crockford normalizasyonu (O→0, I/L→1) ile çözülür (AC-12). `{etkinlik}` = `events.id` (rakam; QR alfanümerik moduna uyar). `vercel.json`'a redirect eklenmez; `src/pages/D/` klasörü açılmaz (macOS harf duyarsız dosya sistemi).

`/egitim/[id]` → `/kurslar/[slug]`: id→slug DB araması gerektiği için SSR stub `Astro.redirect(url, 301)` (açık status; varsayılan 302).

### K3.4 Paylaşım önizlemesi ve cache

- `/d/[kod]`: ziyaret kaydı → `ysf_ref` + `ysf_davet` (`course:{id}:{inviterId}`, 30 gün, lax, httpOnly, secure) → `302 /kurslar/[slug]?d={kod}`. Hedef sayfa `d` parametresi varsa `og:image` = `/api/kart/{kod}/og.png` ve "{Ad} seni davet etti" bandı. Bot çerez taşımaz; kod URL'de taşınır, WhatsApp/Telegram önizlemesi kişisel kartı gösterir.
- Kart rotası `/api/kart/{kod}/{format}.png?v={hash8}`; `hash = sha256(kod+not+ad+avatar+hedefBaşlık)`. Yanıt `public, s-maxage=31536000, stale-while-revalidate=86400` (`src/pages/api/kitap-onizleme.ts:62` deseni). Not değişince yeni `v`; purge yok.
- Kart URL'leri `?ref` taşımaz (`middleware.ts:9-16` Set-Cookie yazar; Set-Cookie'li yanıt CDN'de önbelleklenmez). Clerk handshake'in anonim GET'te çerez yazması **belirsiz** → preview'da başlıklar kontrol edilir.
- A6 PDF: `@pdf-lib/fontkit` kurulu değil, standart fontlar ğ/ş/ı kodlayamaz → PDF'e resvg PNG'si `embedPng` ile gömülür. pdf-lib oluştur/kaydet deseni mevcut (`kitap-onizleme.ts:47-57`); `embedPng` repoda yeni kullanım.
- Kapaklar `/book-covers/` göreli yollar `public/`'ta, fonksiyonda yok → satori'ye `siteKok()` (`src/lib/urls.ts`) mutlak URL.

---

## K4. Gerçek zamanlı katman: yoklama

**Karar: (a) yoklama.** Açık ve görünür sekmede (`visibilitychange`) 12 sn'de bir `GET /api/uye/mesajlar/yeni?since=<ts>`; 2 dk hareketsizlikte 60 sn; gizli sekmede durur. Yoklama yalnız **açık konuşma** sayfasında; okunmamış DM sayısı mevcut `BildirimZili` server island'ına (`src/features/community/BildirimZili.astro`) tek bir sayı olarak eklenir (PRD §4.6 "mevcut bildirim zili"), ayrı uç yok. Ek istemci JS yerel kaynaklı → `js-budget.spec.ts` allowlist'i değişmez. Asıl maliyet Neon compute'un uyanık kalması (her yoklama bir sorgu); görünürlük ve geri çekilme kuralları bu yüzden zorunlu. Sayısal maliyet iddiası kanıtsız olduğu için ADR'ye girmez.

**(b) Yönetilen servis (Ably/Pusher) — red v1.** Yeni hesap + ücretli katman riski (PRD §0.6), token ucu, istemci SDK'sı allowlist'e girer, ikinci kimlik doğrulama yüzeyi.
**(c) Go relay — red v1.** Ayrı deploy + ops, Clerk JWKS doğrulaması, ikinci dil. PRD §4.7 gereği yalnız ölçülmüş ihtiyaçla; öneri eşiği: günlük aktif DM kullanıcısı > 500 ya da canlı quiz odası fazı.

**Vercel WebSocket notu.** Adapter çıktısı `nodejs22.x` + `handler: dist/server/entry.mjs` (`.vercel/output/functions/_render.func/.vc-config.json`); Astro istek modeli fetch `Request/Response`, `upgrade` olayına erişim yok → **Astro + @astrojs/vercel ile WebSocket sunucusu yazılamaz**. Adapter dışı elle yazılmış fonksiyonun Build Output çıktısıyla birleşimi **belirsiz**. v1 kararını değiştirmez.

**Harita.** İl düzeyi yeterli (PRD §7.6); ilçe + harita kütüphanesi ertelendi. Mevcut sıfır bağımlılık SVG korunur.

---

## K5. Puan geri alma (`course_launched` iadesi)

**Bulgu (doğrulandı).** `admin_adjust` enum'da var (`schema.ts:72`), kodda hiç yazılmıyor. Tüm seviye/lider/lig toplamları `delta > 0` filtreli (`rewards.ts:150`, `member.ts:147`, `src/pages/lider.astro:22`, `src/lib/league.ts:76`, `src/lib/social.ts:24`, `gunluk.ts:94`). `awardPoints` negatif delta'yı bakiye kontrolsüz kabul ediyor.

**Karar.** Yeni reason yok; **negatif `admin_adjust`**, tek SQL (A ilkeli):
```sql
insert into points_ledger (user_id, delta, reason, ref_id)
select user_id, -delta, 'admin_adjust', 'iade:' || reason || ':' || ref_id
from points_ledger
where user_id=$u and reason=$reason and ref_id=$ref
on conflict do nothing
returning id
```
`rewards.ts`'e `revokePoints({userId, reason, refId})` (~12 satır): ödül yoksa yazmaz, iki kez çağrılırsa idem index yutar, iade miktarı orijinal satırdan okunur.

**Bilinçli kabul.** Seviye, lider ve lig **düşmez** (kazanılan-toplam tasarımı). Bakiye düşer; eksiye inerse `spendPoints` WHERE'i harcamayı kendiliğinden reddeder. Zarar üst sınırı kurs başına 50.
**Alternatifler (red):** satır silme (append-only bozulur, verilmiş `level_reward` kalır); kazanılan formülünü 10 yerde değiştirme (Faz 5 ekonomi kartında ihtiyaç ölçülürse); yeni `course_launched_revoked` reason (aynı etki, gereksiz enum girdisi).
Bekleyen puanlar iade gerektirmez: `status='expired'`.

---

## K6. Veri modeli farkı (PRD §4.8'in kesin hâli)

**Temel bulgu.** `clubs.kind` ve `points_ledger.reason` DB'de düz `text` (`drizzle/0000_dry_nova.sql:106,239`; snapshot'ta enum yok). Genişleme yalnız TS enum değişikliği; `drizzle-kit push` ALTER üretmez. Bedel: yanlış string DB'ye sessizce girer (koruma TS'te). `points_ledger_idem_idx` her yeni reason'ı otomatik kapsar; tek kural refId zorunlu.

### Yeni tablolar

| Tablo | Karar | Kolonlar / index | Faz |
|---|---|---|---|
| `course_enrollments` | Gerekli | `user_id, course_id, joined_at, activated_at, completed_at, invite_code_id`; `unique(user_id, course_id)`; `index(course_id, activated_at)`. Aktivasyon/bitirme C ilkeli. `joined_at` asgari süre için şart (`course_progress` yalnız `completedAt` tutuyor). | 1 (`invite_code_id`: 2) |
| `course_resources` | Gerekli | `course_id, user_id, url (https-only), note, status pending\|accepted\|rejected, created_at, accepted_at`; `index(course_id, status)` | 1 |
| `ratings` | **Birleştir** (PRD: `course_ratings` + `event_ratings`) | `user_id, course_id?, event_id?, stars, body, created_at`; `unique(user_id, course_id)`, `unique(user_id, event_id)` (likes deseni, `schema.ts:189-195`) | 1 / 3 |
| `pending_points` | Gerekli (K2) | K2 | **1** |
| `reports` | Gerekli, **Faz 1'e çek** (şikâyet §4.1) | `reporter_id, target_type course\|comment\|user\|message, target_id, reason, status open\|resolved\|dismissed, created_at`; `unique(reporter_id, target_type, target_id)`; `index(status, created_at)`. Polimorfik (bilinçli sapma; moderasyon kuyruğunda FK gerekmez). | 1 |
| `invite_codes` | Gerekli | `code` (7 Crockford), `inviter_id, target_type course\|event, target_id, note (≤80, kartın kişisel notu), created_at, revoked_at`; `unique(code)`; kısmi `unique(inviter_id, target_type, target_id) WHERE revoked_at IS NULL` | 2 |
| `invite_visits` | Gerekli, minimal | `invite_code_id, ip_hash, ua_hash, kanal qr\|link, created_at`; `index(ip_hash, created_at)` (60/dk), `index(invite_code_id)`; 30 gün cron DELETE | 2 |
| `event_staff` | Gerekli | `event_id, user_id, role host\|scanner, created_at`; `unique(event_id, user_id)`; `events.created_by` otomatik host | 3 |
| `messages` | **Birleştir** (PRD: `conversations` + `conversation_members` + `messages`) | `sender_id, recipient_id, body, created_at, read_at`; konuşma = (least, greatest) çifti; `index(recipient_id, read_at)`, `index(sender_id, recipient_id, created_at)`, `index(recipient_id, sender_id, created_at)`. Grup sohbeti kapsam dışı (§6). | 4 |
| `blocks` | Gerekli | `blocker_id, blocked_id, created_at`; `unique(blocker_id, blocked_id)` | 4 |
| `invite_attributions` | **Gerekmez** | Tekillik zaten `course_enrollments(user, course)` ve `event_rsvps(event, user)`; `invite_code_id` kolonu bu iki tabloya. "İlk geçerli davet kazanır" insert anında + onConflictDoNothing. Davetlerim hunisi iki tablodan UNION. | — |

### Yeni kolonlar

| Tablo | Kolon | Not |
|---|---|---|
| `courses` | `slug` | Nullable başla → push → SQL backfill `lower(regexp_replace(translate(title,…),'[^a-zA-Z0-9]+','-','g')) || '-' || id` → `CREATE UNIQUE INDEX` → `SET NOT NULL` → schema `.notNull()` (no-op push). Yeni kurslar `kulup.ts:28` slug deseni. |
| | `summary (≤140), cover_url, level baslangic\|orta\|ileri, est_minutes` | nullable |
| | `status` +`hidden` | PRD'de eksik; "3 şikâyette gizlenir" için. TS enum. |
| `comments` | `course_item_id` FK, `accepted_at`, `hidden_at` | `index(course_item_id)`; kısmi `unique(course_item_id) WHERE accepted_at IS NOT NULL` (öğe başına tek en iyi cevap). `member_post_id` bugün hiç yazılmıyor (`feed.ts:66-70`); üç nullable hedef CHECK'siz (mevcut yaklaşım). Düz, iş parçacıksız. |
| `likes` | `comment_id` FK | `unique(user_id, comment_id)`; `begeniPuaniVer`'e (`rewards.ts:319-342`) üçüncü join; refId `yorum:{id}`. |
| `events` | `slug` | courses ile aynı 3 adım. |
| | `ends_at, kind buluşma\|atölye\|konferans\|çevrimiçi, il, capacity, rsvp_closes_at, cover_url` | `il` kulüp etkinliklerine `UPDATE events e SET il=c.il FROM clubs c WHERE e.club_id=c.id AND e.il IS NULL`. Kapasite A ilkeli (`INSERT…SELECT…WHERE count<capacity`). |
| | `club_id` FK | Bugün FK'siz (`schema.ts:277`); eklemek için önce yetim kontrolü. İsteğe bağlı. |
| | `checkin_secret` | **Gerekmez**: dönen QR token = base32(HMAC(env sırrı, `"c:" + eventId + ":" + pencere`)); adres `/c/{events.id}/{token}`. |
| `event_rsvps` | `checked_in_at, checkin_method ticket\|rotating\|manual, checked_in_by, invite_code_id` | `checked_in_by` PRD'de eksik: görevli 120/dk ve denetim. Check-in C ilkeli. |
| | `ticket_token_hash` | **Gerekmez**: bilet token = `{rsvpId}.{base32(HMAC(env sırrı, "t:" + rsvpId))}` — ilk parça RSVP'yi bulur, ikinci parça doğrular; kolonsuz. `"t:"`/`"c:"` önekleri bilet ile dönen QR'ı aynı sırla ayırır. `shortcut: sızan bilet tek tek iptal edilemez (RSVP silinir); gereksinim çıkarsa nullable kolon + unique eklenir.` |
| `users` | `flagged_at` | **Faz 5** (tek kullanıcısı F5-04); lider/lig sorgularına `flagged_at IS NULL`. |
| | `map_visible_at` | PRD'nin `map_visible + map_consent_at` yerine tek kolon: null = görünmez, dolu = rıza anı. |
| | `dm_policy everyone\|mutual\|nobody` default `mutual` | Faz 4. |
| | `il` | **Açılmaz**; `city` var (`schema.ts:26`), `profil.ts:24`'e il beyaz listesi. Hesap yaşı `created_at`'ten. |
| `clubs` | `kind` +`vakif · dernek · kurum` | TS only. Dokunulacak: `kulupler.astro:24-28`, `kulup-kur.astro:39-41`, `kulup.ts:20-23` (doğrulamasız cast → beyaz liste), `seed-demo.ts:199`. |
| `points_ledger` | `reason` +14 | §7. |

### Mevcut veriye etkisi
- Geçmiş `event_attended` satırlarına dokunulmaz (K1.4). `spend_priority` değişmez.
- `course_enrollments` backfill: `INSERT … SELECT user_id, course_id, min(completed_at), min(completed_at) FROM course_progress GROUP BY 1,2 ON CONFLICT DO NOTHING`; puan tetiklemez.
- `seed-demo.ts` `temizle()` FK sırası genişler (enrollments, ratings, reports → courses'tan önce; invite_visits → invite_codes → users; event_staff → events'ten önce; pending_points, messages, blocks → users'tan önce).
- `canli-index-uygula.sql`'e (mevcut 4 adım deseniyle) yalnız mevcut veriye bağımlı adımlar: slug çift-kayıt ön kontrolü, slug backfill + unique + NOT NULL (courses, events), enrollments backfill, `events.il` backfill, yeni index adları doğrulama listesi.

### Faz başına şema dilimi
- **Faz 1:** courses (+slug 3 adım, summary, cover_url, level, est_minutes, `hidden`), `course_enrollments` (+backfill), `course_resources`, `ratings` (course_id), `reports`, `pending_points`, comments (+course_item_id, accepted_at, hidden_at), likes (+comment_id), reason +5.
- **Faz 2:** `invite_codes`, `invite_visits`, `course_enrollments.invite_code_id`, reason +3. Cron: bekleyen (zaten Faz 1) + `invite_visits` 30 gün temizliği (F2-01).
- **Faz 3:** clubs.kind, events (+slug 3 adım, ends_at, kind, il+backfill, capacity, rsvp_closes_at, cover_url), event_rsvps (+checked_in_at, checkin_method, checked_in_by, invite_code_id), `event_staff`, `ratings.event_id`, reason +4.
- **Faz 4:** users (+map_visible_at, dm_policy), `messages`, `blocks`.
- **Faz 5:** `users.flagged_at`, reason +2; tablo yok (2. seviye `referrals_invited_idx` ile tek sorgu).

### Belirsiz (çalıştırılmadı)
`drizzle-kit push`'un dolu tabloya NOT NULL kolon eklerkenki davranışı (nullable-first bunu atlar) · canlı DB'nin `schema.ts` ile birebir aynı olduğu · canlıdaki kurs/etkinlik sayısı.

---

## 7. reason → refId tablosu (tek kaynak)

| reason | refId | Kime | Fren |
|---|---|---|---|
| `course_launched` | `course:{id}` | üretici | kurs başına 1 (idem) |
| `course_learner_activated` | `course:{id}:u:{learner}` | üretici | üretici günde 100 (tavan param., TR günü) |
| `course_learner_completed` | `course:{id}:u:{learner}` | üretici | aynı günlük tavan; asgari süre |
| `course_completed` (mevcut) | `course:{id}` | öğrenen | kayan 7 gün 100 (tavan param.); asgari süre |
| `like_received` (yorum) | `yorum:{id}` | cevap yazarı | günde 5 (begeniPuaniVer; idem index HARİÇ) |
| `answer_accepted` | `yorum:{id}` | cevap yazarı | üreticinin kendi cevabı hariç (WHERE) |
| `resource_accepted` | `kaynak:{id}` | öneren | günde 3 (tavan param. limit 45) |
| `course_invite_welcome` | `course:{id}` | davetli | kurs başına 1 (bekleyen → aktivasyon); davet tavanı |
| `course_invite_activated` | `course:{id}:u:{invitee}` | davet eden | davet tavanı (bekleyen; 14 g `expires_at`) |
| `course_invite_completed` | `course:{id}:u:{invitee}` | davet eden | davet tavanı; asgari süre |
| `invite_second_level` | `u:{invitee}` | üst davetçi | davetli başına 1 (idem); davet tavanı |
| `event_attended` (mevcut) | `{eventId}` | katılımcı | etkinlik başına 1 (idem; eski RSVP ödülünü de kapsar) |
| `event_invite_welcome` | `event:{id}` | davetli | etkinlik başına 1 |
| `event_invite_attended` | `event:{id}:u:{invitee}` | davet eden | davet tavanı (bekleyen; `ends_at`'te düşer) |
| `event_hosted` | `event:{id}` | her host | bekleyen satır yok; `ends_at+48h` cron'u `min(giriş, 100)×5`'i saf fonksiyonla böler (K2) |
| `event_well_rated` | `event:{id}` | her host | etkinlik başına 1 |
| `vitality_pool` | `course:{id}:{YYYY-Www}` | üretici/katkıcı/davetçi | kurs başına haftada 100; tavana girmez. Aynı kişi birden çok dilimden pay alabilir (üretici + davetçi) → paylar **kullanıcı başına toplanıp tek insert** yazılır, yoksa idem index ikinci payı yutar |
| `admin_adjust` (iade) | `iade:{reason}:{refId}` | — | orijinal satır varsa, bir kez |

**Davet tavanı 300 / kayan 7 gün:** `referral_joined` (mevcut), `course_invite_welcome`, `course_invite_activated`, `course_invite_completed`, `invite_second_level`, `event_invite_attended` (PRD §4.2 listesi birebir; `course_invite_*` welcome'ı kapsar). `referral_activated` (admin onaylı) ve `event_invite_welcome` (PRD listesinde yok) hariç.
**Kendine puan yok** (WHERE'de): kendi kursu, kendi yorumu, kendi davet kodu, kendi etkinliği; host'lar davet puanı almaz.

---

## 8. Faz 0 kapanışında doğrulanmış / bekleyen

| Kontrol | Durum |
|---|---|
| Canlıda `/?ref=x` Set-Cookie | **Doğrulandı: YOK** (bug) |
| Canlıda büyük harf rota | **Doğrulandı: 404** (harf duyarlı) |
| `npm run qa` bugün yeşil mi | Çalıştırılmadı (F1-11) |
| Clerk e-posta kodu stratejisi | Dashboard — Yusuf |
| `includeFiles` + resvg `.node` preview smoke | F2-05 ilk işi |
| `uqr` boyut/alfanümerik mod | F2-01 ilk işi |
| `redirects` destination'da query | **Çözüldü: desteklenmiyor** (K3.3, koddan); kanal ayrı sayfa dosyasıyla |
