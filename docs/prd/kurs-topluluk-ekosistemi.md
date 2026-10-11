# yusufdeniz.com — Kurslar · Davet QR'ı · Topluluklarımız · Etkinlik Girişi · Mesajlı Harita

**ysf-blog ("Bilgi Ödüldür") için ürün spesifikasyonu ve Claude Code uygulama talimatı**
Sürüm 1.0 · 11 Ekim 2026 · Ürün sahibi: Yusuf

> **Kullanım:** Repo'ya `docs/prd/kurs-topluluk-ekosistemi.md` olarak kaydet.
> İlk oturumda Claude Code'a: `docs/prd/kurs-topluluk-ekosistemi.md'yi baştan sona oku ve yalnızca Faz 0'ı uygula.`
> Sonraki oturumlarda: `PROGRESS.md'yi ve PRD'yi oku, Faz N'yi uygula.`

---

## 0. Rolün ve kuralların

Bu repo'da kıdemli full-stack mühendissin. `CLAUDE.md` mimari anayasa, `CONTEXT.md` sözlük, `PROGRESS.md` durum kaydıdır. Bu belge **mevcut platformun üstüne** özellik ekler; paralel sistem kurmak yasaktır. Belgede teknik olarak yanlış ya da koddaki gerçekle çelişen bir şey görürsen açıkça söyle; sessizce uygulama, sessizce de değiştirme.

1. **Önce oku:** `CLAUDE.md`, `CONTEXT.md`, `PROGRESS.md`, `src/db/schema.ts`, `src/lib/{points,economy,levels,rewards,member,permissions}.ts`, `src/pages/api/uye/{egitim,etkinlik}.ts`, `src/pages/harita.astro`. Kod soruları için CLAUDE.md'deki graphify kurallarına uy.
2. **Puanın kapıları değişmez.** Puan yalnız `awardPoints()`, `spendPoints()` ve `begeniPuaniVer()` ile yazılır. Yeni katsayılar `PUAN`'a, yeni frenler `economy.ts`'e (saf fonksiyon + birim test) girer. Her yeni `reason` ledger enum'una eklenir.
3. **neon-http interaktif transaction desteklemez.** Atomiklik tek SQL'le sağlanır: koşul INSERT/UPDATE'in WHERE'ine gömülür, `onConflictDoNothing` + `RETURNING` kullanılır; gerekirse `db.batch` (etkileşimsiz transaction; Faz 0'da doğrula). "Önce oku, sonra yaz" yasak.
4. **Sözlüğe uy.** Yeni terimleri `CONTEXT.md`'ye ekle (Kurs daveti, Kurs aktivasyonu, Giriş doğrulaması, Bekleyen puan…). Arayüzde sözlüğün kaçındığı kelimeleri kullanma: "referral" değil "davet", "landing page" değil "karşılama sayfası".
5. **Faz kapıları.** Faz 0'da uygulama kodu yazılmaz. Her fazın sonunda `npm run qa` yeşil, `PROGRESS.md` güncel; özet, ekran görüntüleri ve "nasıl denerim" listesi verilir. Sonra **dur ve onay bekle.**
6. **Sor ya da varsay.** Geri dönüşü pahalı kararlarda (şema, auth, ücretli servis, mevcut ekonomiyi değiştiren her şey) dur ve sor. Diğer belirsizliklerde makul varsayımı `docs/assumptions.md`'ye yaz ve devam et.
7. **Kapsam kayması yok.** Belgede olmayan fikirleri `docs/ideas.md`'ye yaz.
8. **İş takibi.** Fazları dikey dilimli GitHub Issue'lara böl (`docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`).

## 1. Mevcut durum ve hedef

**Bu iş için var olanlar** (ayrıntı CLAUDE.md'de):
- **Dersler:** `/dersler`, `/egitim/[id]`; `courses`, `course_items` (youtube · yazi · quiz), `course_progress`. Kursu bitirene `course_completed` +25 (haftalık tavan 100; kendi kursu hariç).
- **Kulüpler:** `clubs` (tür: universite · lise · sehir), `club_members` (president · mod · member); yönetim yetkisi `canManage`.
- **Etkinlikler:** `events`, `event_rsvps` (⭐ öncelikli koltuk 25p). **RSVP anında `event_attended` +10 yazılıyor.**
- **Davet:** `?ref=handle` → `ysf_ref` çerezi (30 gün) → kayıtta `referrals` + `referral_joined` +25; ilk onaylı yazıda `referral_activated` +75. Kitap sayfasında istemci tarafında canvas davet kartı.
- **Harita:** `/harita`, 81 il SVG; il başına üye sayısı, kulüp pinleri, popover. Mesajlaşma yok.
- **Altyapı:** Clerk, Neon + Drizzle (neon-http), satori + resvg OG hattı, pdf-lib, Vercel cron (`cron_runs` idempotency).

**Yusuf'un istekleri:**
1. Herkesin eklediği kurslar, herkese açık bir **Kurslar** sekmesinde görünür.
2. Kursa davet için **özel kart** açılır; kartın en altında **QR** vardır. QR'ı okutan hemen kursa katılır, hem kazanır hem kazandırır. Zincir "saadet zinciri misali ama dengeli ve adil" olmalı.
3. Kurs içerik, yorum ve katılımcıyla zenginleştikçe başta üreticisi, sonra etkileşimi ve içeriği zenginleştirenler puan kazanır.
4. **Topluluklarımız** sekmesi açılır. Topluluk liderleri etkinlik (konferans dahil) ve **etkinlik kartı** oluşturur, üyeleri **QR'la davet** eder. Gelenler geldikleri için, düzenleyenler düzenledikleri için puan kazanır.
5. **Harita**, Skool'daki gibi etkileşimli ve **mesajlaşmalı** olur.
6. Performans için kritik kısımlar, uyumlu olacaksa Rust ya da Go ile yazılabilir (karar: §4.7).

## 2. Ürün ilkeleri (belirsiz durumda bunlara göre karar ver)

1. **Puan, başkasının doğruladığı değerden doğar.** Kurs açmak, yorum yazmak ya da etkinlik oluşturmak tek başına puan getirmez. Puan; başkası kursunda aktive olduğunda, katkın beğenildiğinde, etkinliğine gerçekten geldiğinde gelir.
2. **Davet en fazla 2 seviye.** 2. seviye küçüktür ve davetli başına bir kez verilir; 3. seviye hiçbir koşulda yoktur.
3. **Anında his, gecikmeli onay.** Davet puanı hemen "bekleyen" olarak görünür, gerçek eylemle (kurs aktivasyonu, doğrulanmış giriş) kesinleşir. Ledger yalnız kesin puanı tutar; seviye yalnız kesin puandan hesaplanır.
4. **Puan satın alınamaz, paraya çevrilemez;** yalnız platform içi ayrıcalıklarda harcanır (mevcut mağaza). Bu çizgi değişirse 2. seviye kapatılır ve hukuki görüş alınır: 6502 sayılı Kanun'un 80. maddesi piramit satış sistemlerini yasaklar.
5. **Frenler sessizdir** (`economy.ts` ilkesi): kullanıcı engellenmez, puan musluğu kısılır. Sosyal sinyal (katılım, beğeni, ilerleme) her zaman çalışır; kırpılan puanın gerekçesi panoda görünür.
6. **Mobil önce.** QR'dan kursa ya da etkinlik kaydına en fazla iki dokunuş.
7. **Gizlilik varsayılandır.** Haritada görünmek ve yabancıdan mesaj almak açık rızayla açılır.

## 3. Önce kapatılacak açıklar

Yeni özellikler bu açıkları büyütür:

| Açık | Neden şimdi önemli | Çözüm | Faz |
|---|---|---|---|
| RSVP anında `event_attended` +10 | QR'la kayıt kolaylaşınca gelmeyen de puan toplar | Puan doğrulanmış girişe taşınır; RSVP puansız olur | 3 |
| `referral_joined` +25 kayıtta anında ve tavansız | Tek konferans QR'ı: 300 kayıt = 7.500 puan ≈ 37 kitap | Haftalık davet tavanı (§4.2) | 2 |
| Kurs öğesi süresiz tamamlanabiliyor | Üretici puanı tıklama çiftliğine açılır | Tamamlama puanı için asgari süre (§4.2) | 1 |
| OG render build-time için yazılmış; fontlar `process.cwd()/src/...` yolundan okunuyor | Davet kartları çalışma zamanında üretilecek; bu dosyalar Vercel fonksiyon paketine girmeyebilir | Faz 0'da doğrula; gerekirse fontları fonksiyona dahil et | 2 |
| Clerk production'da Google SSO için kullanıcı adımı bekliyor (CLAUDE.md) | QR akışı canlıda bu girişe dayanır | Faz 2 canlıya çıkmadan tamamlanmalı (Yusuf'un işi) | 2 |
| Üye içeriğindeki bağlantılarda protokol beyaz listesi yok (PROGRESS.md risk kaydı) | DM, kullanıcıdan kullanıcıya yeni bir saldırı yüzeyi açar | Yalnız `https:` bağlantılara izin ver | 4 |

## 4. Özellikler

### 4.1 Kurslar (Dersler'in evrimi)

- **Tek kavram.** Mevcut `courses`, `course_items` ve `course_progress` genişler; paralel tablo açılmaz. Arayüzde "eğitim" ve "ders" yerine "kurs" denir; terimi `CONTEXT.md`'ye işle.
- **Sekme ve adresler.** ToplulukLayout'ta "Dersler" sekmesi **"Kurslar"** olur: `/kurslar`, `/dersler` → 301. Kurs sayfası `/kurslar/[slug]`, `/egitim/[id]` → 301. `R` rotalarını güncelle.
- **Herkese açık.** Liste ve kurs sayfası misafire açık ve SSR'dır; `Course` JSON-LD ve dinamik OG görseli vardır. `@astrojs/sitemap` SSR sayfalarını kendiliğinden eklemez; kurs ve etkinlik URL'leri için dinamik sitemap ya da `customPages` kullan. Misafir müfredatı ve ilk öğeyi görür, diğer öğeler giriş ister. Üye yazılarının mevcut görünürlük kuralları korunur.
- **Liste.** Yayındaki kurslar; topluluk ve kitap filtresi; sıralama: yeni, popüler, en çok tamamlanan, en canlı.
- **Yeni alanlar** (`courses`): `slug`, `summary` (≤140 karakter, kartın vaadi), `cover_url` (yoksa bağlı kitabın kapağı), `level` (başlangıç · orta · ileri), `est_minutes`.
- **Katılım.** Yeni `course_enrollments` tablosu ve "Kursa katıl" butonu. **Kurs aktivasyonu** = ilk öğenin tamamlanması.
- **Yayın.** Mevcut kural kalır: kulüp kursu, admin ya da Sv7 doğrudan yayınlar; diğerleri admin onayından geçer. Yayın için en az 3 öğe gerekir.
- **Zenginleştirme:**
  - **Soru-cevap:** her öğenin altında. Yorumlar mevcut `comments`'e bağlanır; cevap beğenisi `likes` üzerinden, puanı `begeniPuaniVer()` ile. Üretici bir cevabı "en iyi cevap" seçebilir.
  - **Kaynak önerisi:** katılımcı bağlantı + not önerir; üretici onaylarsa kaynak, önerenin adıyla kursta listelenir.
  - **Değerlendirme:** 1–5 yıldız + yorum; yalnız aktive olmuş katılımcılar verebilir. Sıralamada kullanılır, puan üretmez.
- **Şikâyet.** Kurs ve yorumda "Şikâyet et" → `/uye/admin` kuyruğu. Sv4+ üç farklı üyeden şikâyet alan içerik incelenene kadar gizlenir. Kaldırılan kursun `course_launched` puanı geri alınır; geri alma yöntemini (negatif `admin_adjust` ya da yeni bir reason) ve seviye hesabına etkisini Faz 0'da netleştir.

### 4.2 Puan kuralları

**Ölçek.** Değerler mevcut ekonomiye göre kalibre edildi: karşılama 50, onaylı yazı 100, görev 25–100, kurs bitirme 25, kitap açma 200. Kursta aktive olup kursu bitiren bir davetli, davet edene 25 puan getirir (yaklaşık 8 davetli = 1 kitap). Yeni üye getirmek bugünkü gibi 100 puandır. Bir konferans düzenlemek en fazla 550 puan getirir.

| `reason` | Kime | Ne zaman | Puan | Kesinleşme | Fren |
|---|---|---|---|---|---|
| `course_launched` | Üretici | Kursun ilk 3 katılımcısı aktive oldu | +50 | Anında | Kurs başına 1 |
| `course_learner_activated` | Üretici | Bir katılımcı kursta aktive oldu | +5 | Anında | Üretici başına günde toplam 100 |
| `course_learner_completed` | Üretici | Bir katılımcı kursu bitirdi | +10 | Anında | Aynı günlük tavan; asgari süre |
| `course_completed` (mevcut) | Öğrenen | Kursu bitirdi | +25 | Anında | Mevcut haftalık 100; asgari süre |
| `like_received` (mevcut) | Yorum/cevap yazarı | Beğeni aldı | +1 | Anında | Mevcut fren: aynı kişiden günde 5 |
| `answer_accepted` | Cevap yazarı | Üretici "en iyi cevap" seçti | +10 | Anında | Üreticinin kendi cevabı hariç |
| `resource_accepted` | Öneren | Kaynak önerisi kursa eklendi | +15 | Anında | Günde 3 |
| `course_invite_welcome` | Davetli | Davetle katıldığı kursta aktive oldu | +10 | Bekler → kurs aktivasyonunda | Kurs başına 1 |
| `course_invite_activated` | Davet eden | Davetlisi kursta aktive oldu | +15 | Bekler → aktivasyonda; 14 günde olmazsa düşer | Davet tavanı |
| `course_invite_completed` | Davet eden | Davetlisi kursu bitirdi | +10 | Anında | Davet tavanı; asgari süre |
| `invite_second_level` | Davet edenin davet edeni | 2. seviye davetli ilk kez bir kursta aktive oldu | +5 | Anında | Davetli başına 1; davet tavanı |
| `event_attended` (mevcut, taşınır) | Katılımcı | Doğrulanmış giriş | +10 | Girişte | Etkinlik başına 1 |
| `event_invite_welcome` | Davetli | Davetle geldiği etkinlikte giriş yaptı | +5 | Girişte | Etkinlik başına 1 |
| `event_invite_attended` | Davet eden | Davetlisi etkinliğe giriş yaptı | +10 | Bekler → girişte; gelmezse etkinlik bitince düşer | Davet tavanı |
| `event_hosted` | Düzenleyen(ler) | Her doğrulanmış katılımcı | +5 | Bekler → etkinlik bitiminden 48 saat sonra | Etkinlik başına ilk 100 katılımcı |
| `event_well_rated` | Düzenleyen(ler) | Ortalama ≥ 4,0 ve en az 10 değerlendirme | +50 | Değerlendirme penceresi (7 gün) kapanınca | Etkinlik başına 1 |
| `vitality_pool` | Üretici, katkıcılar, davet edenler | Haftalık canlılık havuzu (Faz 5) | Değişken | Pazartesi cron'u | Kurs başına haftada en fazla 100 |

**Kurallar**
- **Davet tavanı:** `referral_joined` (mevcut), `course_invite_*`, `event_invite_attended` ve `invite_second_level` için kişi başı **haftada 300 puan**. Aşan kısım `gorevOdulKirp` desenindeki gibi sessizce kırpılır, gerekçesi panoda görünür. `referral_activated` tavana girmez; zaten admin onayıyla sınırlı. Temsilci çarpanı yalnız mevcut kurallarda kalır.
- **Asgari süre:** kurs tamamlama puanları (öğrenen, üretici, davet eden) yalnız katılımdan bu yana en az `öğe sayısı × 60 sn` geçmişse yazılır. İlerleme her durumda kaydedilir.
- **Hesap yaşı:** başkasına puan kazandıran eylem (katılım, aktivasyon, giriş) 24 saatten genç bir hesaptan geliyorsa o puan bekleyen yazılır ve hesap 24 saatlik olunca kesinleşir.
- **Kendine puan yok:** kendi kursuna katılım, kendi yorumunu beğenme, kendi davet koduyla katılım, kendi etkinliğinde giriş puan üretmez. Düzenleyenler kendi etkinliklerinde davet puanı almaz; onlar `event_hosted` alır.
- **2. seviye yalnız kurs davetlerinde** işler. Etkinlik daveti fiziksel katılımı ödüllendirir, zincir kurmaz.
- **Ortak düzenleyenler:** etkinliği açan otomatik düzenleyendir (`host`) ve en fazla 3 ortak düzenleyen ekleyebilir. Düzenleyen puanları host'lar arasında eşit bölünür, aşağı yuvarlanır, kalan etkinliği açana yazılır. Yalnız bilet okutan görevliler (`scanner`) puan almaz.
- **Bekleyen puan:** ledger'a girmez, ayrı tutulur. Kesinleşince aynı `reason` + `ref_id` ile `awardPoints()` çağrılır; mevcut idempotency index'i çift yazımı engeller. Süresi dolanlar düşer. Zaman bazlı kesinleşme ve düşmeler mevcut günlük cron'a eklenir. `/uye` panosunda "Bekleyen" ayrı gösterilir: ne kadar, neye bağlı, ne zaman.

**Canlılık havuzu (Faz 5): "kurs zenginleştikçe kazan"**
- Her pazartesi cron'da (`cron_runs` dönem anahtarı `haftalik:YYYY-Www`), yayındaki her kurs için:
  `V = 1 × (son 7 günde ilerleme kaydeden katılımcı) + 3 × (tamamlama) + 0,5 × (beğeni alan yorum/cevap) + 2 × (kabul edilen kaynak)`
- `V < 10` ise havuz yok; değilse `havuz = min(100, round(15 × ln(1 + V)))`.
- Dağıtım: **%50** üretici · **%30** o hafta o kursta beğeni alan katkıcılar (üretici hariç; aldıkları beğeni payına göre) · **%20** o hafta aktif olan davetlilerin davet edenleri (davetli payına göre). Aşağı yuvarla, kalanı üreticiye yaz. Hak sahibi olmayan dilim dağıtılmaz.
- Logaritma bilinçli bir tercih: 100 kat daha canlı bir kurs yaklaşık 3 kat puan alır. Büyük kurs ekonomiyi yutmaz, küçük ama canlı kurs görünür kalır. Havuz payları davet tavanına girmez; `ref_id` = `course:{id}:{YYYY-Www}`.

**Suistimal önlemleri**
- Clerk kısıtlamalarında tek kullanımlık e-posta engeli varsa aç.
- Kısa sürede aynı cihaz ya da IP imzasından aynı davet edene bağlanan çok sayıda yeni hesap → hesapları işaretle, bekleyen puanları beklet, `/uye/admin` kuyruğuna düşür.
- Hız sınırı: `/d/` için IP başına dakikada 60; bilet okutmada görevli başına dakikada 120; DM sınırları §4.6'da.
- İşaretli hesaplar liderlik ve lig hesaplarında görünmez.

### 4.3 Davet kartı ve QR (kurs ve etkinlik için ortak)

**Kart**
- **Kim üretir:** kursa katılmış her üye ve kursun üreticisi; etkinliğe kayıtlı her üye ve düzenleyenler. Kart kişiye ve hedefe özeldir; atıf bu sayede doğru çalışır.
- **Düzen (yukarıdan aşağı):** kapak → başlık → kısa vaat → meta (öğe sayısı ve süre ya da tarih, saat, mekân) → "{Ad} seni davet ediyor" + avatar + isteğe bağlı kişisel not (≤80 karakter) → **en altta QR**; QR'ın altında elle yazılabilir kısa bağlantı ve "Tara, hemen katıl" (etkinlikte "Tara, yerini ayır").
- **Üretim:** sunucuda, mevcut satori + resvg hattıyla; tek şablon ailesi. Formatlar: hikâye 1080×1920 PNG, kare 1080×1080 PNG, baskı için A6 PDF (pdf-lib), bağlantı önizlemesi için OG 1200×630. Çıktılar CDN'de önbelleklenir; kişisel not değişince yeniden üretilir.
- **Aksiyonlar:** İndir · Paylaş (Web Share API; WhatsApp öncelikli) · Bağlantıyı kopyala. WhatsApp ya da Telegram önizlemesinde kartın kendisi görünür.
- Kitap sayfasındaki mevcut canvas kartı bu PRD'de taşınmaz (`docs/ideas.md`).

**Kod ve QR**
- `invite_codes`: `code` (7 karakter Crockford Base32: I, L, O, U kullanılmaz; elle yazımda O→0, I ve L→1 okunur), `inviter_id`, `target_type (course | event)`, `target_id`, `created_at`, `revoked_at`. (Davet eden, hedef) başına tek aktif kod.
- **QR içeriği tamamen büyük harf:** `HTTPS://YUSUFDENIZ.COM/D/7KQ2MXA`. QR'ın alfanümerik modu daha az modül demektir; küçük baskıda bile kolay okunur. Hata düzeltme M, quiet zone en az 4 modül, açık zemin üstünde koyu modül, baskıda en az 2×2 cm. QR'da kişisel veri yok.
- **`/D/…` → `/d/…` normalizasyonu** middleware'de ya da `vercel.json`'da yapılır. Ayrı bir `src/pages/D` klasörü açma: macOS'un varsayılan dosya sistemi büyük-küçük harf duyarsızdır, `D` ile `d` aynı klasöre düşer. Aynı kural `/T/` ve `/C/` için de geçerli (§4.5).
- QR sunucuda SVG olarak üretilir; istemciye QR kütüphanesi gönderilmez. Kütüphaneyi Faz 0'da seç.

**Karşılama sayfası akışı (`/d/{kod}`)**
1. Kod çözülür; ziyaret kaydedilir (IP ve user-agent hash'li, 30 gün saklanır).
2. Mevcut `ysf_ref` çerezi kurulur (platform daveti mevcut kayıt akışıyla işler). Yanına hedefe bağlı yeni `ysf_davet` çerezi kurulur (hedef + davet eden, 30 gün, `lax`).
3. Hedefin karşılama sayfasına gidilir (`/kurslar/[slug]?davet=1` ya da `/etkinlik/[slug]?davet=1`): hedefin önizlemesi, "{Ad} seni davet etti", kazanılacak puan rozeti ve tek büyük buton ("Kursa katıl" / "Yerimi ayır").
4. Giriş yoksa Clerk girişi aynı akışta açılır; dönüşte katılım ek dokunuş gerekmeden tamamlanır.
5. Katılım anında `ysf_davet` hedefi bu hedefse atıf yazılır (`invite_attributions`; hedef + davetli başına tek satır) ve bekleyen puanlar oluşur. İlk geçerli davet kazanır; hedef eşleşmiyorsa atıf yazılmaz.
6. Başarı ekranı: "Sen +10, {Ad} +15 kazanacak; ilk dersi bitirince kesinleşir" + "İlk derse başla".

**Atıf kuralları**
- Kursa zaten kayıtlı biri okutursa puan yok: "Zaten bu kurstasın → Devam et".
- Platform üyesi olup kursa katılmamış biri okutursa kurs daveti puanları işler.
- Kendi kodunu okutan kursa katılır, davet puanı yazılmaz.
- **2. seviye bağı:** bir üyenin üst davetçisi, mevcut `referrals` kaydındaki davet edenidir (onu platforma kim getirdiyse). A, B'yi platforma getirdi; B, C'yi bir kursa davet etti; C aktive olunca B `course_invite_activated`, A `invite_second_level` alır. Bu bağ mevcut veriden türer. 2. seviye puanı Faz 5'te açılır ve geriye dönük dağıtılmaz.

**Uygulama içi tarayıcılar.** Instagram ve Telegram gibi uygulamaların içindeki tarayıcılarda Google, OAuth girişini engeller. Bunu algıla; Clerk'in e-posta kodu girişini öne çıkar ve "Tarayıcıda aç" ipucu göster. Clerk'te e-posta kodu stratejisini aç.

**Performans.** Karşılama sayfası 4G'de orta segment Android'de LCP < 2,5 sn; ek istemci JS'i mevcut `js-budget.spec.ts` bütçesi içinde.

**Davetlerim.** `/uye` panosunda kod başına huni (görüntülenme → katılım → aktivasyon), kazanılan ve bekleyen puan.

### 4.4 Topluluklarımız

- **Varsayılan karar: topluluk = mevcut `clubs`.** "Kulüpler" sekmesinin etiketi **"Topluluklarımız"** olur. `clubs.kind` genişler: mevcut universite · lise · sehir'e ek türler (ör. vakıf, dernek, kurum; listeyi Faz 0'da Yusuf'a sor). URL'ler değişmez (`/kulupler`, `/kulup/[slug]`). Paralel tablo açılmaz.
- **Topluluk lideri** = kulübün `president` ya da `mod`'u (mevcut `canManage`).
- **Liste:** kart ızgarası (tür, il, üye sayısı, sıradaki etkinlik, kurs sayısı); tür ve il filtresi.
- **Topluluk sayfası:** mevcut sekmelere (Pano · Kitaplık · Etkinlik · Üyeler · Lig) "Kurslar" eklenir.

### 4.5 Etkinlikler, etkinlik kartı ve giriş doğrulaması

- **Oluşturma:** mevcut yetkiyle (kulüp etkinliği: başkan/mod; site geneli: rep/admin). Yeni alanlar: bitiş zamanı, tür (buluşma · atölye · konferans · çevrimiçi), il (harita pini), kapasite, kayıt kapanışı, kapak, ortak düzenleyenler ve görevliler. Etkinlik sayfası `/etkinlik/[slug]`: herkese açık SSR, OG kartı, takvime ekle (.ics).
- **Kart ve davet QR'ı:** §4.3'teki ortak sistem.
- **İki ayrı QR; bu ayrım zorunlu.** Davet QR'ı yalnız kayıt (RSVP) ve atıf yapar. Katılım puanını yalnız doğrulanmış giriş verir; aksi hâlde evinden QR'ı okutan da "gelmiş" sayılır.

**Giriş doğrulaması (check-in)**
- **a) Kişisel bilet (varsayılan):** kayıtlı üyenin "Biletlerim" ekranında kişisel QR: `HTTPS://YUSUFDENIZ.COM/T/{TOKEN}` (opak rastgele token; DB'de hash'li). Görevli `/etkinlik/[slug]/giris` ekranından okutur; ekranda katılımcının adı ve avatarı büyük görünür. Görevli olmayan biri bu bağlantıyı açarsa yalnız "Bu bir etkinlik biletidir" görür.
- **b) Dönen QR (kalabalık konferanslar için ek seçenek):** girişteki ekranda 30 saniyede bir yenilenen QR: `/C/{KOD}/{TOKEN}`. Token = HMAC(etkinlik sırrı, 30 sn'lik pencere); bir önceki pencere de geçerli; kod ve token büyük harf Base32. Katılımcı kendi telefonuyla okutur; giriş yapmış olmalı ve etkinlik saat aralığı içinde olmalı. Uzaktan paylaşıma karşı kişisel bilet kadar güçlü değildir; bu yüzden varsayılan değildir.
- **Giriş anında** (tek istekte ve idempotent; neon-http kısıtı için §0.3): giriş zamanı ve yöntemi yazılır; katılımcıya `event_attended` +10, davetliyse `event_invite_welcome` +5. Davet edenin bekleyen `event_invite_attended` puanı kesinleşir, düzenleyenlere bekleyen `event_hosted` yazılır.
- **RSVP puanı kaldırılır.** ⭐ öncelikli koltuk harcaması RSVP'de kalır. Geçmiş kayıtlara dokunulmaz.
- **Görevli tarayıcısı:** kamerayla art arda okuma (okuma başına < 1 sn), ses ve titreşimle onay, tekrar okumada "Zaten giriş yaptı (09:41)". Bağlantı koparsa yerel kuyruk, sonra senkron (sunucu idempotent). Tarayıcıda `BarcodeDetector` varsa o kullanılır, yoksa küçük bir JS çözücü (iOS Safari'de `BarcodeDetector` yok; doğrula). Island olarak yalnız bu sayfada yüklenir.
- **Kayıtsız gelen:** kapıda davet QR'ından kayıt olup biletini gösterir (kapasite varsa). Dönen QR yönteminde kayıt girişte otomatik açılır.
- **Sonrası:** yalnız giriş yapanlar 7 gün içinde etkinliği değerlendirir (1–5). Düzenleyen katılım listesini CSV olarak indirir.

### 4.6 Harita: Skool tarzı, mesajlaşmalı

- **Mevcut `/harita` korunur ve genişler.** Sıfır bağımlılık SVG ve il düzeyi gizlilik bilinçli kararlardır. İl düzeyi yetmezse ilçe + harita kütüphanesi seçeneğini Faz 0 ADR'sinde maliyetiyle öner; varsayılan SVG.
- **Görünürlük:** profilde "Haritada görün" (varsayılan kapalı; açık rıza metniyle). İl başına anonim toplam üye sayısı bugünkü gibi kalır.
- **İl popover'ı:** mevcut kulüp listesi + haritada görünmeyi seçmiş üyelerin avatar ızgarası (ad, seviye, ortak topluluk ve kurs) → **Profil** · **Mesaj gönder**; o ildeki yaklaşan etkinlikler.
- **Filtreler:** topluluk, kurs ("bu kursu alanlar"), "takip ettiklerim".

**Mesajlaşma (v1: birebir DM)**
- `/uye/mesajlar`: gelen kutusu ve konuşma görünümü, okundu bilgisi; mevcut bildirim zili ve okunmamış sayacı. Profilde ve harita popover'ında "Mesaj gönder".
- **Kimden mesaj alınır** (alıcının ayarı): herkes · ortak topluluk ya da karşılıklı takip (varsayılan) · kimse.
- **Spam freni:** ortak topluluk ya da karşılıklı takip yoksa yeni konuşma başlatmak için Sv4+; günde en fazla 20 yeni konuşma; mesaj gönderiminde hız sınırı.
- **Engelle** (iki yönlü: mesaj, harita, DM butonu) ve **şikâyet et** (`/uye/admin` kuyruğu).
- Mesaj gövdesi mevcut `lib/markdown.ts` kaçışından geçer; bağlantılarda yalnız `https:` kabul edilir (§3).
- Gerçek zamanlı: v1'de açık sekmede 10–15 sn'de bir yoklama (§4.7).

### 4.7 Teknoloji kararı: Rust / Go

- **Karar: iş mantığı TypeScript'te kalır (Astro API rotaları + Neon/Drizzle). Rust yok.**
- **Neden:** puanın tek kapısı (`awardPoints`) ve tüm ekonomi korumaları TypeScript'te. İkinci bir dil bu kapıyı ikiye böler (ledger tutarlılığı riski), şemayı iki kez tanımlatır ve ayrı deploy getirir. Bu ölçekte darboğaz dil değil; sorgular, index'ler ve atomiklik.
- **Go'nun uyumlu olduğu tek yer: gerçek zamanlı katman.** DM ve CLAUDE.md'de bekleyen "canlı quiz odası (PIN, WebSocket)" ortak bir WebSocket katmanı ister. Vercel fonksiyonları kalıcı WebSocket sunucusu tutmaz (Faz 0'da güncel durumu doğrula). ADR şu seçenekleri karşılaştırsın:
  - (a) yoklama (v1 varsayılanı),
  - (b) yönetilen servis (Ably, Pusher vb.),
  - (c) ayrı barındırılan küçük bir Go relay: yalnız mesaj iletir, DB'ye yazmaz, puan mantığı taşımaz, kimliği Clerk JWT'siyle doğrular.
  (c) ancak ölçülmüş bir ihtiyaçla seçilir.

### 4.8 Veri modeli farkı (taslak; Faz 0'da doğrula ve ADR'de kesinleştir)

- **Yeni tablolar:** `course_enrollments` (user, course, joined_at, activated_at, completed_at; unique user + course) · `course_resources` · `course_ratings` · `invite_codes` · `invite_visits` · `invite_attributions` (unique hedef + davetli) · `pending_points` (user, reason, ref_id, delta, status: pending · confirmed · expired, due_at; unique user + reason + ref_id) · `event_staff` (role: host · scanner) · `event_ratings` · `conversations` · `conversation_members` (last_read_at) · `messages` · `blocks` · `reports`.
- **Yeni kolonlar:** `courses` (slug, summary, cover_url, level, est_minutes) · `comments` (course_item_id, accepted_at) · `likes` (comment_id; unique user + comment) · `events` (slug, ends_at, kind, il, capacity, rsvp_closes_at, cover_url, checkin_secret) · `event_rsvps` (checked_in_at, checkin_method, ticket_token_hash) · `users` (map_visible, map_consent_at, dm_policy, flagged_at).
- **Enum genişlemeleri:** `points_ledger.reason` (§4.2'deki yeni kodlar) · `clubs.kind`.
- **Şema yöntemi:** `drizzle-kit push`; canlıya yeni unique index'ler `drizzle/canli-index-uygula.sql` deseniyle uygulanır (önce çift-kayıt ön kontrolü).

### 4.9 Ölçüm

- **Davet hunisi:** kart üretimi → görüntülenme → katılım → aktivasyon; kanal (QR / bağlantı) ve kart formatı kırılımıyla. **K-faktörü:** üye başına aktive olan yeni katılımcı.
- **Kurs:** katılım → aktivasyon → tamamlama. **Etkinlik:** kayıt → giriş.
- **Ekonomi sağlığı:** aktif üye başına haftalık basılan puan; puanın kaynağa göre dağılımı. **Davet kaynaklı pay %40'ı geçerse ekonomi davet çiftliğine kayıyor demektir.** Kırpılan ve düşen bekleyen puan oranları. Faz 5'te `/uye/admin`'e ekonomi kartı.

## 5. Kabul kriterleri (her biri otomatik teste dönüşür)

Ekonomi kuralları `economy.ts`'te saf fonksiyonlardır ve tablo güdümlü birim testleriyle doğrulanır. Auth'lu akış testleri için `@clerk/testing` Faz 1'de kurulur (CLAUDE.md'de bekleyen iş); QR akış testleri buna dayanır.

**Kurslar**
- AC-1: Misafir `/kurslar` ve `/kurslar/[slug]` sayfalarını görür; kurs URL'leri sitemap'tedir; ikinci öğe giriş ister.
- AC-2: `/dersler` ve `/egitim/[id]` 301 ile yeni adreslere gider.
- AC-3: Kendi kursunu bitiren ne `course_completed` ne de `course_learner_*` puanı alır.
- AC-4: Kursu `öğe sayısı × 60 sn`'den kısa sürede bitiren öğrenene ve üreticisine tamamlama puanı yazılmaz; ilerleme kaydedilir.

**Davet**
- AC-5: Giriş yapmamış biri QR'ı okutur → karşılama sayfası → Clerk girişi → ek dokunuş olmadan kursa katılmıştır; iki tarafta da "bekleyen" görünür. İlk öğe tamamlanınca davetli +10, davet eden +15 kesinleşir.
- AC-6: Instagram'ın uygulama içi tarayıcısında aynı akış e-posta koduyla tamamlanır.
- AC-7: Kursa zaten kayıtlı biri ya da kendi kodunu okutan için davet puanı yazılmaz.
- AC-8: Davetli 14 gün içinde aktive olmazsa bekleyen puan düşer.
- AC-9: Başka bir kursun davet çerezi varken farklı bir kursa katılım atıf üretmez.
- AC-10: A→B (platform daveti), B→C (kurs daveti): C aktive olunca B +15, A +5 alır. C'nin davet ettiği D aktive olunca A'ya puan yazılmaz (3. seviye yok). A, C için ikinci kez 2. seviye puanı alamaz.
- AC-11: Haftalık davet tavanı dolunca puan kırpılır ve gerekçe panoda görünür; `referral_activated` tavandan etkilenmez.
- AC-12: `/D/7KQ2MXA` ile `/d/7kq2mxa` aynı daveti açar.

**Ekonomi**
- AC-13: Aynı olay iki kez işlenir (çift tıklama, cron tekrarı) → ledger'da tek satır.
- AC-14: Bekleyen puan seviye hesabına girmez; kesinleşince girer.

**Etkinlik**
- AC-15: RSVP puan üretmez; doğrulanmış girişte katılımcıya +10 yazılır.
- AC-16: Aynı bilet ikinci kez okutulur → "Zaten giriş yaptı (saat)"; yeni puan yok.
- AC-17: Dönen QR'ın 2 dakika önceki ekran görüntüsü reddedilir.
- AC-18: Bağlantı yokken okutulan 30 bilet, bağlantı gelince bir kez ve çiftsiz işlenir.
- AC-19: Kayıt olup gelmeyen davetlinin davet edenine ait bekleyen puan etkinlik bitince düşer.
- AC-20: Düzenleyen, kendi etkinliğine gelen davetlisi için davet puanı almaz.

**Harita ve mesaj**
- AC-21: Haritada görünmeyi açmamış üye hiçbir harita yanıtında bireysel olarak yer almaz.
- AC-22: B, A'yı engellerse A, B'ye mesaj atamaz ve B'yi haritada görmez.
- AC-23: Ayarı "ortak topluluk ya da karşılıklı takip" olan üyeye, bu koşulu sağlamayan biri yeni konuşma başlatamaz.
- AC-24: `javascript:` bağlantılı bir mesaj güvenli biçimde, tıklanamaz olarak gösterilir.

**Genel**
- AC-25: `gate.spec.ts`, `check-build-output.mjs` ve `js-budget.spec.ts` yeşil kalır.

## 6. Kapsam dışı

Ücretli kurs ve ödeme · puan satın alma ya da paraya çevirme · video barındırma (YouTube gömme kalır) · grup sohbeti · native uygulama · sertifika · kitap davet kartının sunucuya taşınması · ortak kurs üreticileri · Türkiye dışı harita · yeni sayfaların İngilizce sürümü (topluluk sayfalarının TR-only olması mevcut bilinçli karar).

## 7. Açık kararlar (varsayılanla ilerle; Faz 0 sonunda Yusuf'a sor)

1. **Kurslar = Dersler'in yeniden adlandırılması mı?** Varsayılan: evet; tek kavram, 301 yönlendirme.
2. **Topluluklarımız = Kulüpler mi?** Varsayılan: evet; tür listesi genişler, URL'ler değişmez. Alternatif: kulüpler ayrı kalır, Topluluklarımız kurumsal toplulukların filtreli görünümü olur.
3. **Mevcut `referral_joined` haftalık davet tavanına girsin mi?** Varsayılan: evet (bkz. §3).
4. **RSVP puanı kaldırılsın mı?** Varsayılan: evet, Faz 3'te giriş doğrulamasıyla birlikte.
5. **Puan ileride paraya ya da fiziksel ödüle bağlanacak mı?** Varsayılan: hayır. Bağlanırsa 2. seviye kapatılır ve hukuki görüş alınır (§2.4).
6. **Harita için il düzeyi yeterli mi?** Varsayılan: evet.

## 8. Fazlar

**Faz 0 — Keşif ve tasarım (kod yok).** Çıktılar:
- `docs/adr/0001-kurs-davet-etkinlik-harita.md`: veri modeli farkının kesin hâli, neon-http altında atomiklik stratejisi, kart/QR üretim yolu (çalışma zamanında font paketleme dahil), gerçek zamanlı katman seçimi ve maliyeti.
- `CONTEXT.md` için terim ekleri (taslak).
- Faz bazlı GitHub Issue planı: dikey dilimler ve kabul kriterleriyle. Issue'ları oluşturmadan önce onay al.
- Bu belgeyle çelişen ya da riskli bulduğun noktalar; en fazla 7 soru, her birinde önerdiğin varsayılanla.

| Faz | Kapsam | Sonraki faza geçmeden bak |
|---|---|---|
| 1 | Kurslar: sekme ve 301'ler, herkese açık SSR/SEO, yeni kurs alanları, katılım ve kurs aktivasyonu, üretici puanları, asgari süre, soru-cevap ve en iyi cevap, kaynak önerisi, değerlendirme, şikâyet; `@clerk/testing` | Kurs açan üye sayısı, katılım → aktivasyon |
| 2 | Davet kartı + QR + `/d/{kod}` + karşılama sayfası; 1. seviye atıf; bekleyen puan; davet tavanı; uygulama içi tarayıcı desteği; Davetlerim | Davet hunisi, K-faktörü |
| 3 | Topluluklarımız; etkinlik alanları ve sayfası; etkinlik kartı; bilet, görevli tarayıcısı, dönen QR; etkinlik puanları; RSVP puanının kaldırılması; değerlendirme | Kayıt → giriş oranı |
| 4 | Harita: görünürlük rızası, popover'da üye ızgarası, filtreler; DM; engelle ve şikâyet; bağlantı protokol beyaz listesi | Haritada görünme oranı, DM şikâyetleri |
| 5 | 2. seviye davet; canlılık havuzu; ekonomi kartı; gelişmiş suistimal raporu | Davet kaynaklı pay, puan enflasyonu |

**Her fazın bitti tanımı**
- `npm run qa` yeşil (postbuild dahil; `astro build` tek başına yetmez).
- Yeni frenler `economy.ts`'te saf fonksiyon ve birim testli; yeni akışlar e2e testli; fazın kabul kriterleri otomatik testte.
- Şema değişikliği push'landı; canlıya gereken index'ler `canli-index-uygula.sql`'de.
- `npm run seed:demo` yeni verileri kapsıyor (idempotent).
- `CLAUDE.md` (yeni mimari kararlar), `CONTEXT.md` ve `PROGRESS.md` güncel; `graphify update .` çalıştırıldı.
- Yusuf'a özet, ekran görüntüleri ve "nasıl denerim" listesi verildi. Sonra **dur ve onay bekle.**
