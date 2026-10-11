# Varsayımlar

PRD §0.6: geri dönüşü pahalı olmayan belirsizliklerde makul varsayım burada kayıtlıdır. Yusuf itiraz ederse ilgili issue güncellenir.

| # | Tarih | Varsayım | Gerekçe | Etkilediği |
|---|---|---|---|---|
| 1 | 2026-10-11 | Puan paraya ya da fiziksel ödüle bağlanmaz (PRD §7.5 varsayılanı). Bağlanırsa F5-01 (2. seviye) kapatılır ve hukuki görüş alınır (6502/80). | PRD §2.4 | F5-01 |
| 2 | 2026-10-11 | Harita il düzeyinde kalır; ilçe + harita kütüphanesi değerlendirilmedi. | PRD §7.6; mevcut SVG sıfır bağımlılık | F4-02 |
| 3 | 2026-10-11 | AC-21 yalnız harita yanıtlarıyla sınırlı: şehir `/uyeler` ve profilde zaten herkese açık. | `uyeler.astro:20,30,72`, `u/[handle].astro:104` | F4-02 |
| 4 | 2026-10-11 | DM gövdesi düz metin + yalnız https otomatik link; markdown yok. | `markdown.ts`'te protokol beyaz listesi yok; feed zaten düz metin | F4-03 |
| 5 | 2026-10-11 | Kurs OG görseli Faz 1'de kapak, Faz 2'de dinamik kart. | Runtime satori hattı Faz 2'de kurulur; aynı hattı iki kez kurmamak için | F1-04, F2-05 |
| 6 | 2026-10-11 | Günlük tavanlar (üretici 100, kaynak 3) TR günü (`gunBaslangici`); davet tavanı kayan 7 gün (mevcut tavanlarla aynı). | `rewards.ts gunBaslangici`; `egitim.ts:40` | F1-06, F2-04 |
| 7 | 2026-10-11 | Clerk production geçişi Faz 2 canlıya çıkmadan; production kullanıcıları sıfırdan başlar, canlıdaki 6 üyenin satırları yeni Clerk id'leriyle elle eşlenir, puanlar korunur. | CLAUDE.md Clerk notu | F2-H |
| 8 | 2026-10-11 | Soru-cevap düz (iş parçacıksız); `comments`'e `parent_id` eklenmez. | En az şema | F1-07 |
| 9 | 2026-10-11 | `comments` üç nullable hedef için DB CHECK yok; kodda doğrulanır (mevcut yaklaşım). | `schema.ts:170-171` | F1-07 |
| 10 | 2026-10-11 | Bilet ve dönen QR token'ları HMAC türetilmiş (kolonsuz); sızan bilet RSVP silinerek iptal edilir. | ADR K6 | F3-04, F3-05 |
| 11 | 2026-10-11 | AC-6 (Instagram uygulama içi tarayıcısı) elle test edilir; otomatik yol yok. | Playwright'ta UA taklidi akışın Google engelini üretmez | F2-02 |
| 12 | 2026-10-11 | Davet hunisinde "kart üretimi" adımı ve "kart formatı" kırılımı ölçülmez; yalnız kanal (QR / bağlantı) ölçülür. | QR her formatta aynı, kart CDN önbelleğinde; format kırılımı teknik olarak ayrıştırılamaz | F2-06 |
| 13 | 2026-10-11 | `event_hosted` ve `event_well_rated` için bekleyen satır tutulmaz; kaynak `event_rsvps.checked_in_at` ve `ratings` canlı sayımı, dağıtım 48 s / 7 g cron'unda. Pano host'a tahmini bekleyeni canlı sayımdan gösterir. | Upsert/birikim ve "host sonradan eklendi" sorunlarını sıfırlar (ADR K2) | F3-06 |
| 14 | 2026-10-11 | Davet tavanı `course_invite_welcome`'ı da kapsar (PRD §4.2 `course_invite_*`); `event_invite_welcome` kapsamaz (PRD listesinde yok). | PRD metni birebir | F2-04 |
