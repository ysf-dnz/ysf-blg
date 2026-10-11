# Bilgi Ödüldür

Kişisel blog + üyelikli okuma topluluğu. Kitaplar satılmaz, emekle açılır: oku → üret → puan kazan → kitap aç. Bu sözlük, projede konuşulan dilin tek kaynağıdır.

## Language

### Büyüme

**Mıknatıs**:
Üye olmayanların görebildiği, merak uyandırıp üyeliğe çeken herhangi bir içerik birimi (kart görseli, özet, değer notu, quiz vitrini).
_Avoid_: reklam, tanıtım materyali

**Kampanya kodu**:
Bir mıknatısın hangi kayıtları getirdiğini izlemek için paylaşım linkine eklenen kısa kod.
_Avoid_: UTM

**Kaynak**:
Bir üyenin platforma geliş yolu: bir kampanya kodu, bir davet, ya da bilinmiyor.
_Avoid_: trafik kaynağı, acquisition channel

**Karşılama sayfası**:
Sosyal medyadan ya da bir davetten gelen misafirin indiği, tek işi üyeliğe ya da bir kursa/etkinliğe katılıma ikna etmek olan sayfa.
_Avoid_: landing page

**Davet** (platform daveti):
Bir üyenin kişisel linkiyle platforma yeni üye getirmesi. İki aşaması vardır: katılım (yeni üye kaydoldu) ve aktivasyon (yeni üyenin ilk yazısı onaylandı). Bir kursa ya da etkinliğe çağırma için bkz. *Kurs daveti*, *Etkinlik daveti*.
_Avoid_: referral

### Kütüphane

**Değer notu**:
Bir kitabın okuyana ne katacağını anlatan, site sahibinin ürettiği kısa merak metni.
_Avoid_: özet (özet ayrı bir şeydir: bölüm bölüm içerik anlatımı)

**Tanıtılabilir kitap**:
Tanıtım yüzeylerinde (kart, sosyal önizleme, vitrin) gösterilmesine açıkça izin verilmiş kitap. Varsayılan: hiçbir kitap tanıtılabilir değildir.

**Açık Raf**:
Kütüphanenin telif-temiz (açık lisanslı ya da kamu malı) kitaplardan oluşan alt kümesi.

### Kurs ve etkinlik

**Kurs**:
Üyelerin oluşturduğu; YouTube videosu, üye yazısı ve quiz'den kurulu, herkese açık sayfası olan müfredat. Eski "ders/eğitim"in tek kavram altında devamıdır (`courses`). Blog kategorisi "eğitim" bundan ayrıdır.
_Avoid_: ders, eğitim, classroom

**Kurs öğesi**:
Kursun müfredatındaki tek birim: bir YouTube videosu, bir üye yazısı ya da bir quiz (`course_items`). Arayüzde "ilk öğeye başla", "öğeyi tamamla".
_Avoid_: ders, modül, lesson

**Kısa vaat**:
Kurs kartında görünen, ≤140 karakterlik "bu kurs sana ne katar" cümlesi (`courses.summary`). "Özet" ayrı bir şeydir (bölüm bölüm içerik anlatımı).
_Avoid_: özet, açıklama, summary

**Kurs daveti** / **Etkinlik daveti**:
Kursa katılmış bir üyenin ya da üreticinin (etkinlikte kayıtlı üyenin ya da düzenleyenin), kişiye ve hedefe özel davet koduyla başkasını o kursa ya da etkinliğe çağırması. Platform davetinden ayrıdır: hedefi bir kurs ya da etkinliktir, puanı kurs aktivasyonunda ya da giriş doğrulamasında kesinleşir.
_Avoid_: referral, davet linki (platform daveti için ayrılmıştır)

**Davet kodu**:
Bir (davet eden, hedef) çifti için üretilen 7 karakterlik Crockford Base32 kod; `/d/{kod}` bağlantısının ve QR'ın içeriğidir. Kişisel veri taşımaz.
_Avoid_: token, ref kodu

**Davet kartı**:
Bir kurs ya da etkinlik için, davet edenin adı ve kişisel notuyla sunucuda üretilen paylaşım görseli; en altında davet QR'ı vardır. Hikâye, kare, A6 PDF ve OG biçimleri aynı şablondan çıkar.
_Avoid_: poster, afiş, OG görseli (yalnız biçimlerinden biridir)

**Kurs aktivasyonu**:
Katılımcının kursta ilk öğeyi tamamlaması. Davet puanlarının kesinleştiği andır; "katılım" (Kursa katıl) ve "bitirme" (tüm öğeler) ile karıştırılmaz. Platform davetindeki "aktivasyon" (ilk yazı onayı) ayrı bir kavramdır.
_Avoid_: activation, onboarding

**Bekleyen puan**:
Henüz ledger'a girmemiş, bir koşula (kurs aktivasyonu, giriş doğrulaması, hesap yaşı, etkinlik bitimi) bağlı puan vaadi. Seviyeye sayılmaz; koşul gerçekleşince `awardPoints` ile kesinleşir, süresi dolarsa düşer, tavana çarparsa kırpılır ve gerekçesi panoda görünür.
_Avoid_: pending, askıda puan, provizyon

**Davet tavanı**:
Bir üyenin davet kaynaklı puanlardan (platform daveti katılımı, kurs daveti, etkinlik daveti, 2. seviye) kayan 7 günde kazanabileceği en fazla puan (300). Aşan kısım sessizce kırpılır.
_Avoid_: limit, cap, ceza

**Giriş doğrulaması**:
Etkinliğe gelen üyenin biletinin görevlice okutulması ya da dönen QR'ı kendi okutmasıyla fiziksel katılımının kaydedilmesi. Katılım puanı yalnız buradan doğar; kayıt (RSVP) puan üretmez. Arayüz metninde "geldi" kullanılır ("Zaten geldi (09:41)"): "giriş" kelimesi Clerk'in "Giriş yap"ıyla (oturum açma) karışır.
_Avoid_: check-in, yoklama, giriş yaptı (oturum açmayla karışır)

**Etkinlik kaydı**:
Üyenin bir etkinlikte yerini ayırması (`event_rsvps`; arayüzde "Yerimi ayır", "Kayıtlısın"). Kontenjan ve kayıt kapanışı burada uygulanır. Puan üretmez; puan *giriş doğrulaması*ndan doğar.
_Avoid_: RSVP, katılım (kursa katılımla karışır), katılıyorum

**Bilet**:
Etkinliğe kayıtlı üyenin kişisel giriş QR'ı (içerik `/T/{token}`, iniş sayfası `/t/q/{token}`; "Biletlerim"de durur); yalnız görevli okutur. Davet QR'ından farklıdır: bilet giriş doğrular, davet QR'ı kayıt yaptırır.
_Avoid_: ticket, QR kod (hangi QR olduğunu belirt)

**Giriş penceresi**:
Giriş doğrulamasının yazılabildiği aralık: kapı açılışından (başlangıçtan 60 dakika önce) etkinlik bitişine kadar. Bitişten sonra giriş yazılmaz; gelmeyen davetlinin bekleyen puanı o anda düşer.
_Avoid_: check-in süresi

**Dönen QR**:
Kalabalık etkinliklerde girişteki ekranda 30 saniyede bir yenilenen, katılımcının kendi telefonuyla okuttuğu giriş QR'ı (içerik `/C/{etkinlik}/{token}`, iniş sayfası `/c/q/…`; `{etkinlik}` = etkinlik id'si, davet koduyla ilgisi yoktur). Kayıtsız gelen üyeyi kontenjan varsa kaydeder. Biletin alternatifidir, varsayılan değildir.
_Avoid_: dinamik QR, canlı QR

**Düzenleyen**:
Etkinliği açan üye ve eklediği en fazla 3 ortak düzenleyen (`event_staff.role = host`). *Düzenleyen payı* aralarında eşit bölünür; kendi etkinliklerinde giriş ve davet puanı almazlar, etkinliklerini değerlendiremezler.
_Avoid_: organizatör, host (kodda kalır, arayüzde kullanılmaz)

**Düzenleyen payı**:
Etkinlik bitişinden 48 saat sonra, girişi doğrulanan katılımcı başına 5 puanın (ilk 100 katılımcı) düzenleyenlere dağıtılması; iyi değerlendirilen etkinlikte ayrıca 50. Bekleyen puan satırı yoktur: panodaki "≈" tahmini canlı giriş sayımıdır.
_Avoid_: host puanı, organizasyon bonusu

**Görevli**:
Etkinlik girişinde bilet okutan üye (`event_staff.role = scanner`). Düzenleyen payı almaz; katılımcı olarak geldiyse katılım ve davet puanını herkes gibi alır.
_Avoid_: scanner, staff

**Topluluk**:
Mevcut kulüp kavramının genel adı: üniversite, lise, şehir, vakıf, dernek ya da kurum çatısında bir araya gelen üye grubu (`clubs`). URL'lerde "kulup" kalır.
_Avoid_: grup (kulüp içi alt birim için ayrılmıştır), community

**Topluluk lideri**:
Topluluğun başkanı ya da moderatörü; etkinlik ve kurs açar, görevli atar (`canManage`).
_Avoid_: admin (site yöneticisi için ayrılmıştır), organizatör

**Ek kaynak**:
Bir katılımcının kursa önerdiği, üretici onaylayınca önerenin adıyla listelenen bağlantı + not. "Kaynak" (üyenin geliş yolu) ile karıştırılmaz.
_Avoid_: kaynak önerisi, link

**Canlılık havuzu**:
Yayındaki bir kursun son 7 gündeki ilerleme, tamamlama, beğeni ve ek kaynak hareketinden hesaplanan, her pazartesi üretici, katkıcılar ve davet edenler arasında dağıtılan haftalık puan havuzu (en fazla 100).
_Avoid_: bonus havuzu, airdrop
