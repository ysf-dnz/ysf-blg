# Fikir havuzu (kapsam dışı)

PRD §0.7: belgede olmayan fikirler burada bekler; hiçbiri onaysız uygulanmaz.

| # | Tarih | Fikir | Neden şimdi değil |
|---|---|---|---|
| 1 | 2026-10-11 | Kitap sayfasındaki istemci canvas davet kartını (`OkumaKapisi.astro` 🎴) sunucu satori hattına taşımak; tek şablon ailesi. | PRD §4.3 açıkça kapsam dışı bıraktı; Faz 2 hattı oturduktan sonra küçük iş. |
| 2 | 2026-10-11 | Ana sayfayı SSR yapıp `?ref=` çerezini sunucuda kurmak. | CLAUDE.md "kitap/içerik sayfaları statik" kararı; 3 satırlık istemci hotfix'i (F1-00) yeter. |
| 3 | 2026-10-11 | Kazanılan-puan formülünü "delta>0 OR reason='admin_adjust'" yaparak iadenin seviyeyi düşürmesi. | 10 ayrı sorguda formül değişikliği; Faz 5 ekonomi kartında ihtiyaç ölçülürse. |
| 4 | 2026-10-11 | `pg_advisory_xact_lock(user_id)` ile toplam-tabanlı tavanların yarışını tamamen kapatmak. | ADR K1.5: tavan en fazla bir ödül aşılabilir; ölçümde görünürse. |
| 5 | 2026-10-11 | Haftalık tavanlar için ortak `since` yardımcısı yerine tüm tavanları `cron_runs` dönem anahtarıyla takvim haftasına bağlamak. | Mevcut tavanlar kayan 7 gün; iki sistem karışır. |
| 6 | 2026-10-11 | Kulüp adı gibi kullanıcı metinleri için merkezi uzunluk/karakter doğrulayıcısı. | Faz 4 güvenlik önkoşulunda (F4-01) yalnız kulüp adı yapılır. |
| 7 | 2026-10-11 | `events.club_id` ve `campaign_id`'ye FK eklemek. | Mevcut veride yetim kontrolü gerekir; F3-02'de isteğe bağlı. |
| 8 | 2026-10-11 | `@lhci/cli` ile LCP bütçesini `npm run qa`'ya bağlamak (PRD §4.3 performans ölçütü). | Kurulu ama bağlı değil; ayrı iş. |
| 9 | 2026-10-11 | PostToolUse/Stop hook ile `graphify update .` otomasyonu. | Bugün yalnız elle; CLAUDE.md talimatı yeter. |
| 10 | 2026-10-11 | Etkinlik kaydını iptal etme (kontenjanlı etkinlikte gelmeyecek üye yerini bıraksın) ve bekleme listesi. | PRD'de yok; Faz 3'te kayıt tek yönlü. |
| 11 | 2026-10-11 | Görevli tarayıcısına JS QR çözücü (iOS Safari'de `BarcodeDetector` yok) ya da PWA + native kamera. | Faz 3'te sistem kamerası akışı + elle kod (assumptions #27); gerçek cihaz ölçümüne göre. |
| 12 | 2026-10-11 | Etkinlik şikâyeti / moderasyonu (`reports.target_type += event`) ve `events.status` (iptal, taslak). | Bugün görünürlük topluluğun onayına bağlı (assumptions #26). |
| 13 | 2026-10-11 | Çevrimdışı okutmada tarama anını (istemci saati) güvenli biçimde taşıyıp bitişten sonra senkron olan girişleri kabul etmek. | Bugün bitişten sonra giriş yazılmaz (assumptions #21). |
| 14 | 2026-10-12 | ~~Harita ızgarasında üye başına "ortak topluluk / ortak kurs" rozeti (PRD §4.6)~~ — **yapıldı** (Faz 4 eksikler: `ortakBaglar`, iki gruplu sorgu, yalnız bakanın kendi üyeliklerinden). | — |
| 15 | 2026-10-12 | ~~Konuşmada canlı "Görüldü"~~ — **yapıldı** (yoklama yanıtında `gorulenSon`). | — |
| 16 | 2026-10-12 | ~~Reddedilen şikâyetin yeniden açılabilmesi~~ — **yapıldı** (Faz 4 incelemesi: kapanmış üye/mesaj şikâyeti yeniden açılır; index değişmedi). Kurs/yorumda hâlâ açılmaz. | — |
| 17 | 2026-10-12 | "Ortak topluluk" bağını sıkılaştırma: topluluktan ayrılma aksiyonu, günlük katılım sınırı, gönderenin üyelik yaşı (24 saat / 7 gün) ya da topluluk bağıyla açılan yeni konuşmalara daha düşük günlük tavan. | Onaylı topluluğa tek tıkla katılan, o topluluktaki herkese (3 yanıtsız mesajla sınırlı) yazabilir — PRD §4.6 tanımı; karar Yusuf'ta (assumptions #50). |
| 18 | 2026-10-12 | `club_members(user_id)` index'i (ortak topluluk EXISTS'i ve harita topluluk filtresi). | Bugünkü ölçekte tablo taraması önemsiz. |
| 19 | 2026-10-12 | Engellenenler listesi sayfası; engelin karşılıklı takibi de kaldırması. | Bugün engel profil ya da konuşmadan tek tek yönetilir. |
| 20 | 2026-10-12 | ~~Bildirimlerin okundu yazımını POST'a taşımak~~ — **yapıldı** (`POST /api/uye/bildirim`, e2e testli). | — |
| 21 | 2026-10-12 | Etkinlik kaydında da kurs sayfasındaki `data-niyet` deseni (girişten dönüşte ek dokunuşsuz "Yerimi ayır"). | Bugün iki dokunuş (assumptions #37). |
| 22 | 2026-10-12 | ~~Gizlilik ayarlarını profil formundan ayırmak~~ — **yapıldı** (`action=gizlilik`, ayrı form ve yazım). | — |
| 23 | 2026-10-12 | Harita il popup'ında 24'ten fazla görünen üye için sayfalama / "tümünü gör". | Sıra artık rıza anına değil seviyeye göre (Faz 4 eksikler); 24'ten fazlası hâlâ yalnız "+N üye daha". `/uyeler?q=<il>` rızasızları da listelediği için bağlanmadı. |
| 24 | 2026-10-12 | Suistimal kuyruğunda davetçi başına toplu "Temiz" (konferans gibi sahte pozitif kümelerde tek tık) ve işaret kanıtının (kaç hesap, hangi imza) gösterimi. | Bugün hesap başına tek tek; ölçek küçük (assumptions #64). |
| 25 | 2026-10-12 | İşaretli hesabın yeni konuşma başlatamaması (mesaj şikâyetinin daha güçlü yaptırımı) ve haritada görünmemesi. | `mesajGonder` WHERE'i ile `dmKarar` birlikte değişmeli; Faz 5 kapsamı lider/lig + bekleyen. |
| 26 | 2026-10-12 | Suistimal taramasını katılım anına taşımak (davetle kayıt / kursa katılımda tek SQL) ve `/?ref=` platform bağlantılarına da ziyaret imzası yazmak. | Bugün günlük cron + yalnız `/d/` kodlu davetler (assumptions #64). |
| 27 | 2026-10-12 | Ekonomi kartında reason kodları yerine Türkçe etiket, haftalık eğilim (önceki 7 güne göre) ve canlılık havuzunun kurs kırılımı. | Kart yalnız admin'e; ham kod yeterli. |

