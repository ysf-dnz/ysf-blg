# Faz 5 → Fable devri (2026-10-12)

Dal `faz5-ekonomi` (yerel, push'lanmadı; main = `7fd5416`). Faz 5'in tamamı: `git diff 7fd5416..HEAD`. Kaynak satır numaraları `cb1d541`'deki koda göredir (sonraki commit yalnız belge ekler). Yapıştırılacak prompt: `docs/devir/faz5-fable-prompt.md`.

Bu belge üç salt-okunur workflow'un çıktısıdır: ilk düşman inceleme (18 ajan), devir haritası (18 ajan), prompt denetimi (3 ajan). **Buradaki hiçbir iddia TEST koşturularak doğrulanmadı: hepsi kod okumasıdır** ("doğrulandı" = bağımsız çürütücü kodda engelleyen bir kontrol bulamadı). Tek istisna §1 C1'in canlı satırları: 2026-10-12'de salt-okunur SELECT ile görüldü. Görev, bu iddiaları ÖNCE testle kanıtlamak ya da çürütmek, sonra (izinliyse) kodu düzeltmektir. §0–§1 elle yazıldı ve prompt denetiminden sonra düzeltildi; §2–§4 ajan çıktısından üretildi.

## 0. Neden devir

1. **İnceleme düzeltmeleri commit'i `09fc098` hiç incelenmeden dala girdi** (ilk inceleme yalnız `7fd5416..a3e464a` aralığını gördü). Sonradan iki mercekle bakıldı: 11 bulgu, 10'u çürütmeden geçti — 6 doğrulandı, 4 kısmen, yüksek yok, biri orta (§2). Çoğu puan motoruna (`puanOlayi`, `bekleyeniKesinlestir`, `bekleyenleriIsle`) dokunuyor.
2. **Kural ↔ test haritası: 125 kuralın 35'i güçlü testle kilitli, 35'i zayıf, 55'i testsiz** (§4; sayım 00a95a4 anının — Fable'ın kilitleme commit'leri sonrası yeniden sayılmadı, akıbet §1 durum satırlarında). Faz 5 kurallarını sınayan hiçbir test rotadan geçmiyor: entegrasyon lib fonksiyonlarını doğrudan çağırıyor; e2e `kurs.spec` `egitim.ts`'in katıl / tamamla yolunu, `ekonomi.spec` `/lider`'i koşturuyor ama Faz 5 dallarını (işaretli kaynak, eşik sayımı, yayın kapısı) sınamıyor; `admin.ts`'in `flag_*` dalları ve `gunluk.ts` hiçbir testte koşmuyor. `npm run qa` entegrasyon testlerini KOŞMAZ (`POSTGRES_URL_TEST` yoksa atlanır).
3. **Kök çözümler şema / üye oluşturma yolu / mevcut ekonomi kararı istiyor** (GitHub #42): kayıt anında hesap imzası, `referral_joined`'ın bekleyene alınması.
4. **Açıklanmamış kırmızı**: entegrasyon takımının bir koşumu 3 dosyada kırmızıydı (11 başarısız + 7 atlanan), hata metni yakalanmadı; sonraki iki koşum 67/67. CLAUDE.md ve PROGRESS'teki "Neon soğuk başlangıcı + `beforeAll` 10 sn" açıklaması KANITSIZ bir hipotezdir.

## 1. Öncelik sırasıyla ipuçları

Test tarifleri §2'de ("Kanıtlayan en küçük test") ve §4'te ("Not"). Tariflerin bir kısmı karakterizasyondur: "geçerse kanıtlanır" yazıyorsa HEAD'de YEŞİL beklenir.

**A — Puan motoru**
- **A1 · Toplu kesinleşmede tavana sıkışma** (iki bulgu: kısmen / orta ve kısmen / düşük; §2.1–2.2). İşaretle tutulan bekleyenler "Temiz" sonrası AYNI koşumda kesinleşir; tavan kesinleşme ANININ penceresinden kurulur (`bekleyeniKesinlestir` → `awardPoints` → `tavanIcin`). Günlere yayılarak tamamı yazılacak puan tek günün tavanına takılıp `confirmed` + `yazilan = 0` ile yanar. Kanıtlı kayıp yolu üretici günlük tavanı (100); kaybeden çoğunlukla aklanan hesap DEĞİL, hiç işaretlenmemiş ALICI'dır (üretici / davet eden). `vitality_pool` (200) varyantı mekanik olarak doğru ama kuramsal (çok haftalık tutma ister); davet tavanında net kayıp gösterilemedi. ADR K2 "kırpılan geri kazanılmaz" der → karar. → **Durum (Fable 2026-10-12):** **karakterize edildi (bugünkü davranış sabit, kanıtlandı: 3 × 50 tutulan → 100 yazılır, bir satır confirmed/yazilan 0) — karar #42** · `04eeb04` · tests/integration/faz5-db.test.ts:486 (+ it.todo :502) · mutant (tavan ×10) kırmızı
- **A2 · Hayalet bekleyen** (doğrulandı / düşük, iki bulgu; §2.4, §2.8). `puanOlayi`'nin bekleyen dalı ledger'a bakmaz: `course_launched` +50 zaten ödenmişken kaynak genç ya da ALICI işaretliyse yeni bir "+50 bekleyen" açılır; sonra `yazilan = 50` ile `confirmed` olur ama puan gelmez. Genç kaynak yolu Faz 1'den beri var; `09fc098` alıcı-işaretli dalı ekleyerek genişletti (admin kuyruğunda sahte "tutulan +50"). **Düzeltme yalnız `puanOlayi`'de** (ledger'da aynı üye + reason + refId varsa bekleyen açma). `egitim.ts`'in `course_launched`'ı eşikten sonraki her aktivasyonda yeniden göndermesi (`>=`) BİLİNÇLİDİR: işaret kalkınca "+50 sıradaki aktivasyonda yazılır" telafisi (varsayım #65) buna dayanır — `===`'e daraltma. → **Durum (Fable 2026-10-12):** **kapandı** · `1019837` · src/lib/rewards.ts puanOlayi bekleyen dalında ledger kontrolü · tests/integration/faz5-db.test.ts:440 (HEAD'de kırmızıydı) · mutant kırmızı · rota düzeyinde de: rota-db.test.ts:264 'hayalet yok'
- **A3 · `course_launched` "Suistimal" kararından sonra da bekler** (doğrulandı / düşük; §2.5). Satır düşmez (refId'de `u:` yok, `bekleyenleriDusur` görmez). Süresiz değil; dört çıkış var: yeni temiz aktivasyon, "Temiz" ile işaretsiz aktif sayısının 3'e çıkması, kursun şikâyetle kaldırılması, üreticinin kendisine "Suistimal". Kapanmayan durum: "X suistimal, işaret kalır, yeni katılımcı yok". İki düzeltme adayı da mevcut kuralla çarpışır (satırı düşürmek sonraki genç aktivasyonda +50'yi hiç yazdırmaz; etiketi "3 katılımcı bekliyor" yapmak işareti sezdirir) → yalnız karakterizasyon testi, düzeltme karar. → **Durum (Fable 2026-10-12):** **karakterize edildi (kanıtlandı: satır süresiz pending, kuyruk görmez, bekleyenleriDusur dokunmaz; tek doğal çıkış 3. temiz katılımcı + olgunlaşma) — karar #42** · `04eeb04` · faz5-db.test.ts:461 (+ it.todo :484) · tarifteki 5. adım `new Date()` erken: satır genç hesabın açılışı + 24 s'te olgunlaşır · mutant (eşik 3 → 0) kırmızı
- **A4 · 2. seviyede "ilk aktivasyon" sırası ayırt edici testle kilitli değil** (doğrulandı / düşük; üretim hatası DEĞİL, test boşluğu; §2.6). `09fc098`'in asıl dalı (alt sorgu dolu) yalnız ilk testin yinelenen çağrısında koşuyor ve orada davetlinin başka katılımı olmadığı için hiçbir satıra karşı sınanmıyor. Eski hatalı hâl (`isNotNull` + `ne`), kıyas yönünün ters çevrilmesi ya da kıyasın silinmesi bütün testlerden sağ çıkar. `<` → `<=` neredeyse eşdeğer mutanttır. Yeni testte üst davetçiler FARKLI olmalı; aynı testle "farklı üst davetçilerde dar pencerede çift +5" ihtimali de değerlendirilmeli (§4.1). → **Durum (Fable 2026-10-12):** **kilitlendi** · `6574f58` · faz5-db.test.ts:185 (iki kurs, farklı üst davetçiler, geç istek önce) + davetleAktive yardımcısı üretim sırasına alındı (:54) · HEAD'de yeşil (test boşluğu) · mutantlar (kıyas silindi; yön ters) kırmızı

**B — Suistimal taraması**
- **B1 · Ziyaret penceresi 48 saat, atıf çerezi 30 gün** (doğrulandı / düşük; §2.3). Bağlantıya günler önce tıklayıp sonradan kaydolan gerçek davetlilerin ziyaret satırı pencere dışında kalır; o sırada davet edenin kendi 5 tıklaması "tek IP, az ağ" koşulunu tutturur → gerçek davetliler işaretlenir. Pencereyi 30 güne açmak tek-IP koşulunu gevşetir ve varsayım #64'ü değiştirir → karar. → **Durum (Fable 2026-10-12):** **karakterize edildi (kanıtlandı: 3 gün önce tıklayan 5 gerçek davetli + 5 kendi tıklaması → bugün işaretlenir) — karar #42** · `5a111a4` · faz5-db.test.ts:325 (+ it.todo :335) · mutant (ip penceresi 48 s → 4800 s) kırmızı
- **B2 · Tarama cron'un ilk adımı ve `try/catch` dışında** (kısmen / düşük; §2.7). `aktifSezon` ve `ozelLigleriKapat` çağrıları da korumasız; `09fc098`'in farkı etki alanı (tarama fırlatırsa 5–8. adımlar yerine 1–8. adımlar koşmaz). Parametresiz (tüm davetçiler) hâli hiçbir testte çalışmadı. **Canlı DB'de parametresiz ÇAĞIRMA** (tüm gerçek üyelerde UPDATE koşar): CTE'leri salt-okur bir aday sorgusuna ayırıp parametresiz SELECT'i sına, UPDATE yalnız `davetciId` ile koşsun. Aynı bulgunun ayakta kalan yarısı: tarama 0. adımda olduğu için aynı koşumda işaretlenen hesap tek-atış özel lig kapanışında birincilikten düşer ve "Temiz" geri getirmez; C1 onarılırsa aynısı sezon ilk 10 için de doğar. → **Durum (Fable 2026-10-12):** **kapandı (try/catch + `rapor.suistimalHata` + `console.error`; sıra değişmedi)** · `006d3d5` + `e615ff5` (aday CTE `distinct on`, UPDATE hedefinde `flagged_at is null`; tekilleştirme testi `286ba27`) · src/pages/api/cron/gunluk.ts; src/lib/ekonomi.ts `suistimalCte()` tek kaynak → `suistimalAdaylari()` salt okur + `suistimalTara()` UPDATE · tests/unit/cron-gunluk.test.ts:102 (fırlatınca 200 + hata alanı + 1–8 koşar), :69 adım sırası, :87 CANLILIK kapısı · faz5-db.test.ts:273 aday kümesi == işaretlenen küme, :304 parametresiz SELECT fırlatmaz · mutant (try/catch sökük) kırmızı · AÇIK: aynı koşumda işaretlenenin özel lig birinciliğinden düşmesi (§2.7 TEST 2) yazılmadı — `ozelLigleriKapat` modül içi ve filtresiz, önce `league.ts`'e `ligId` parametresiyle taşınmalı
- **B3 · `09fc098` `referrals`'ı taramanın bağ kümesinden çıkardı**: kodsuz platform daveti (`/?ref=`) çiftliği artık hiç görünmüyor; `referral_joined` +25 kayıt anında ledger'a yazılıyor (işaretle tutulamaz). Karar #42. → **Durum (Fable 2026-10-12):** **karar #42** · kod değişmedi
- **B4 · İşaretlenen küme**: şüpheli davetçinin son 48 saatte kodla katılan TÜM yeni hesapları (yoğun 24 saatlik pencerenin dışındakiler dahil). Hedef davranış tanımlı değil → karar. → **Durum (Fable 2026-10-12):** **karakterize edildi (kanıtlandı: 48 saatteki tüm yeni hesaplar, 40 saatlik dahil; 50 saatlik dışarıda; rep işaretlenmez ama sayılır) — karar #42** · `5a111a4` · faz5-db.test.ts:337 (+ it.todo :347) · mutantlar (role, 48 s → 72 s) kırmızı
- **B5 · Kaçış yönü** (açık; hesap imzası kararına bağlı): `?d=KOD`'u doğrudan açan ya da `ysf_davet` çerezini elle kuran çiftlik ziyaret satırı bırakmaz, tarama görmez; günde 4 hesap eşiğin altında kalır. Kuyruk: "Suistimal" denen hesap listeden çıkmıyor ("incelendi" durumu yok), limit 100, kanıt gösterilmiyor (ideas #24). → **Durum (Fable 2026-10-12):** **karakterize edildi (kanıtlandı: ziyaretsiz 5 hesap görünmez; günde 4 eşiğin altında) — karar #42 (hesap imzası)** · `5a111a4` · faz5-db.test.ts:349 (+ it.todo :359) · mutant (yoğun pencere 24 s → 48 s) kırmızı

**C — Faz 5'in ortaya çıkardığı, Faz 5'ten ESKİ hatalar** (bu devirde `src/` değişikliği yok; yalnız kanıtlayan test + rapor)
- **C1 · Sezon hiç kapanmıyor.** Kod: `league.ts aktifSezon()` yalnız `status = 'active'` ∧ `ends_at > şimdi` olan sezonu döndürür; `gunluk.ts` aynı sezona `if (sezon.endsAt <= new Date())` diye sorar → dal hiç çalışmaz. Canlı (2026-10-12, salt-okunur): `select id, name, status, ends_at, champion_club_id from seasons` → 3 satır (Ağustos, Eylül, Ekim 2026), üçü de `active`, `champion_club_id` boş; `select job, count(*) from cron_runs group by job` → `sezon-kapat` satırı yok. "İlk 10'a dönem sonu kitap ödülü" ve şampiyon rozeti iki aydır dağıtılmadı. Düzeltme canlıya geriye dönük ödül yazar → karar. Test: §2.7 TEST 1 (kendi `itest-` sezon satırı); `sezonKapat` gerçek sezonla ÇAĞRILMAZ. → **Durum (Fable 2026-10-12):** **kanıtlandı (src değişmedi)** · `1208b56` · faz5-db.test.ts:615 (`aktifSezon` bayat sezonu döndürmez, bayat `active` kalır) + tests/unit/cron-gunluk.test.ts:115 (sezon-kapat kilidi yalnız bitişi geçmiş sezonda alınır) · karar it.todo :629
- **C2 · Onay bekleyen topluluğun başkanı kampanya açıp görev ödülü onaylayabiliyor** (tek ajan; çürütülmedi). `api/uye/kampanya.ts` kampanyayı kulüp rolüyle açar; ödülü yazan onay `api/uye/gorev.ts`'te (`approve` → `task_done`); hiçbirinde `clubs.status` sorulmuyor, `permissions.ts clubRoleOf` de bakmıyor. Kurs ve etkinlikte kapatılan açığın üçüncü kopyası; kulüp başına haftalık 1000 görev bütçesiyle sınırlı. Test iki rotayı zincirlemeli. → **Durum (Fable 2026-10-12):** **kanıtlandı (src değişmedi)** · `52f0d7b` · tests/integration/rota-db.test.ts:208 (pending itest kulübü: kampanya → görev → üstlen → teslim → onay → task_done 30) · karar it.todo :238
- **C3 · İşaretle tutulamayan, KAYNAĞI BAŞKA HESAP olan ödül yolları**: `like_received` (beğenenin işaretine bakılmaz), `event_hosted` / `event_well_rated` (`etkinlik.ts girisSayisi` işaretli girişi sayar; pay doğrudan `awardPoints`), `task_done`, `referral_joined` / `referral_activated`. İşaretli üyenin KENDİ doğrudan puanlarının yazılması BİLİNÇLİDİR (#65): dokunma. `answer_accepted` / `resource_accepted` ve davet edenin işaretlenmemesi ilk incelemede bilinçli tasarım diye çürütüldü (§3). Tam liste: §4.3, kural 12. → **Durum (Fable 2026-10-12):** **karakterize edildi (bugünkü davranış) — karar #42** · `1208b56` · faz5-db.test.ts:631 (işaretli beğenen → like_received yazılır), tests/integration/etkinlik-db.test.ts:196 (işaretli giriş `hostPayHesabi`'na sayılır) · karar it.todo :638

**D — Küçük ama gerçek**
- **D1 · Gizlilik** (doğrulandı / düşük; §2.9): panoda tutulan satır "inceleniyor" + kaynak adını taşıyan not birlikte, işaretin KİMDE olduğunu üçüncü kişiye söyler (davet edenin davetlilerinden yalnız birinin satırı tutulursa). `/uyeler`'de sona düşme ve lig üye sayısı aynı sınıftan sızıntı → karar. → **Durum (Fable 2026-10-12):** **karakterize edildi (kanıtlandı: tutulan satırın notu ve bildirimi davetlinin adını taşır) — karar #42** · `952904d` · faz5-db.test.ts:504 (+ it.todo :542) · e2e auth.spec.ts:23 panoda 'inceleniyor' (işaret/suistimal kelimesi yok)
- **D2 · Bayat arayüz metni** (çürütmeye gitmedi): `uye/egitim-olustur.astro` hâlâ "Kulüp kursları … doğrudan yayınlanır" diyor; `onayliKulupMu` sonrası onay bekleyen toplulukta yanlış. → **Durum (Fable 2026-10-12):** **kapandı** · `aa4dc91` · src/pages/uye/egitim-olustur.astro:120
- **D3 · Bildirim dalı**: davetli hem genç hem işaretliyse davet edene "24 saatlik olunca kesinleşir" yazılır; işaret kalkana dek kesinleşmez. → **Durum (Fable 2026-10-12):** **kapandı** · `e9cbbff` · src/lib/davet.ts bildirim dalı `hesapGencMi && !davetli.flaggedAt` · faz5-db.test.ts:640 (HEAD'de kırmızıydı) · mutant kırmızı · Y1 (alıcı varyantı) da kapandı: `72f2126` `isaretliMi(kod.inviterId)`, faz5-db.test.ts Y1 testi (HEAD'de kırmızıydı), mutant kırmızı
- **D4 · Havuz telafisi yalnız SON tamamlanan haftaya bakar**: cron 8. adıma bir TR haftası boyunca (7 koşumun hiçbirinde) ulaşamazsa — ör. B2: tarama her gün fırlatırsa — önceki hafta hiç ödenmez. Tek bir günün atlanması ertesi gün telafi edilir. → **Durum (Fable 2026-10-12):** **karakterize edildi (kanıtlandı: bütün hafta kaçırılan W43 hiç denenmez) — karar #42** · `887d00b` · tests/unit/cron-gunluk.test.ts:94 (+ it.todo :100)

**E — Test altyapısı**
- **E1** (kısmen / düşük; §2.10): `tests/integration/*-db.test.ts` `afterAll`'ları varsayılan 10 sn kanca süresinde (gerçek süre ölçülmedi). Kanca kesilirse son silmeler atlanır (referrals, cron_runs, bekleyen / bildirim / ledger, users) → test üyeleri ve ledger satırları kalır. Yayında "Itest F5" kursu, bekleyen kulüp ve işaretli kuklalar süreç test ORTASINDA ölürse kalır; koşum başında süpürücü yok. → **Durum (Fable 2026-10-12):** **kapandı** · `7b1152b` · beş `afterAll` + ekonomi-db `beforeAll` 60 sn · `scripts/itest-artik-kontrol.mjs` (salt okur; her koşumdan sonra çalıştırıldı, hep 0 artık, admin listesi değişmedi)
- **E2** Entegrasyonun açıklanmamış kırmızı koşumu (§0.4): yeniden üret (Neon 5+ dk boştayken beş dosya birlikte), çıktıyı süzmeden kaydet, `beforeAll` sürelerini ölç. "Yeniden koş" deyip geçme. → **Durum (Fable 2026-10-12):** yeniden üretme denemesi: §5
- **E3** (Fable: 2 işçiyle tam koşum 90/90, 8,5 dk, tekrar yok; 4 işçi denenmedi) Bu makinede 4 işçili e2e bellek baskısıyla yük ortalamasını 50–60'a çıkarıp `page.goto` zaman aşımı veriyor; kanıtlar `--workers=2` ile alındı. Tek komutla `npm run qa` Faz 5 ağacında yeşil görülmedi (önceki fazlarda sakin makinede yeşildi). → **Durum (Fable 2026-10-12):** faz sonu e2e: §5
- **E4** Admin ekranları (ekonomi kartı sayfada, suistimal kuyruğu, "Haklı (üyeyi işaretle)") hiç tarayıcıda denenmedi. Tarayıcıda deneme Yusuf'un işidir (#42 "Elle doğrulama"). Ajanın kapsamı: `api/uye/admin.ts` rota testi (admin satırı açmadan, `getOrCreateMember` taklidiyle), kuyruğu bileşene çıkarıp AstroContainer testi, admin olmayan üyeyle negatif e2e. Hiçbir hesaba admin verilmez, tarayıcıda admin oturumu açılmaz. → **Durum (Fable 2026-10-12):** **kısmen** · rota testleri `4fa849d` (rota-db.test.ts:131 403 + satır değişmez, :146 flag_clear, :165 flag_confirm kapısı, :188 'Haklı' — admin satırı açılmadan, getOrCreateMember kısmi mock) · admin olmayan e2e `b692aaa` (auth.spec.ts:14 → /uye, kuyruk yok) · YAPILMADI: kuyruğun bileşene çıkarılıp AstroContainer testi; admin HEDEFİN işaretlenmemesi (admin satırı açılmaz)

**F — Yusuf'un kararı**
- #42'de kayıtlı: hesap imzası kolonu · `referral_joined` 24 saat bekleyen · eşikler (5 / 200 / ilk hafta W42) · havuzda beğeneni katılımcıyla sınırlama · işaretli üyenin mesaj kısıtı · "Suistimal" kararında ledger iadesi.
- Bu devirle doğan (#42'ye yorum olarak eklendi): A1 tavan davranışı · A3 · B1 · B4 · B2'de tarama fırlatınca hangi adımlar koşsun · C1'in geriye dönük ödülü · C2'nin kapatılması · C3'te sayımdan işaretliyi dışlama · D1 · D4 · ara halka (davet eden) işaretliyse 2. seviye · `CANLILIK_ILK_HAFTA` (merge 19 Ekim 06:00 TR cron'undan sonraya kalırsa sabit güncellenmeli).

## 2. Düzeltme commit'i `09fc098` incelemesi

11 bulgu (2 mercek); şiddete göre ilk 10'u çürütmeden geçti. Sıra: iddia edilen şiddet.

### 2.1 · Tutulan bekleyenler toplu kesinleşince tek günün / haftanın tavanına sıkışıyor: "Temiz" denen hesabın puanı sessizce yanıyor

**Durum (Fable):** A1 — karakterize edildi, karar #42 (`04eeb04`, faz5-db.test.ts:486).

- **Yer:** `src/lib/rewards.ts:448` · mercek: dogruluk · iddia edilen: orta · **hüküm: kismen / dusuk**
- **Senaryo:** (a) Varsayım #64-b'nin kabul ettiği kampüs Wi-Fi yanlış pozitifi (docs/assumptions.md:71): 25 öğrenci işaretlenir; 5 gün boyunca günde 5 aktivasyon (+5) ve 5 bitirme (+10) olur → üreticide 375 puan tutulur (refId sonu u:{öğrenci}). Admin 25'ine "Temiz" der → sonraki cron hepsini aynı TR gününde kesinleştirir → 100 yazılır, 275 puan confirmed / yazilan=0 ile yanar. İşaret olmasaydı günde 75 < 100 olduğu için tamamı yazılırdı. (b) Canlılık: üretici 3 pazartesi işaretli kalır, her hafta 80 pay bekleyene gider → "Temiz" sonrası 80 + 80 + 40 yazılır, 40 yanar; iki kurslu üreticide 480'in 280'i yanar. (c) Sıra bağımlılığı: işaret pazar kalkar; üye pazartesi 00:00 TR'den önce /uye açarsa (src/pages/uye/index.astro:28) eski pay eski haftaya yazılır; açmazsa pazartesi cron'unda 5. adım (src/pages/api/cron/gunluk.ts:195) eski payı YENİ haftaya yazar ve 8. adımdaki yeni haftanın payını (gunluk.ts:218) kırpar.
- **Önerilen düzeltme (inceleyici):** En az kod: bekleyeniKesinlestir'de awardPoints 0 döndüyse ve ledger'da o anahtar yoksa (tavan dolu; ledgerDeltaSql rewards.ts:408-411 ile ayırt edilir) tutulmuş satırı (matures_at 24 saatten eski) confirmed yapma, pending bırak: pencere boşaldıkça yazılır, ADR'nin tekil kırpma kuralı değişmez. vitality_pool penceresini yazım anından değil refId'deki hafta etiketinden türet. Bir entegrasyon testi ekle: 3 tutulan satır × 50, günlük tavan 100 → "Temiz" sonrası toplam 150 yazılmalı.

**Çürütücünün gerekçesi**

Çürütülemedi: çekirdek mekanizma kodda aynen var. Üç yan iddia abartılı ya da yanlış, önerilen düzeltme de mevcut bir kuralla çelişiyor. Hiçbir test çalıştırılmadı (salt okunur); hepsi kod okumasından. Yollar /Users/macbook/Downloads/ysf-blog köküne göre.

DOĞRULANAN ZİNCİR
- src/lib/rewards.ts:447-453 — bekleyeniKesinlestir awardPoints'e tavan vermiyor; rewards.ts:336 `opts.tavan ?? tavanIcin(reason)` ile pencere KESİNLEŞME anından kuruluyor.
- rewards.ts:38-42 üretici tavanı `gunBaslangici()` (bugün), rewards.ts:57 davet `yediGunOnce()`, rewards.ts:68 canlılık `isoHafta(new Date()).baslangic`. Üçü de argümansız, yani "şimdi".
- rewards.ts:346-353 — tavan doluysa INSERT hiç yazmaz, awardPoints 0 döner.
- rewards.ts:454-461 — 0 dönse de satır `confirmed` olur; `yazilan` ledger'dan okunur, satır yoksa 0. rewards.ts:546 yalnız `pending` seçtiği için bir daha denenmez.
- rewards.ts:488-505 (09fc098) — alıcı ya da kaynak işaretliyse her puanOlayi bekleyene gider, `expiresAt: null`. src/lib/ekonomi.ts:120-127 havuz payı da bu yoldan.
- src/pages/api/uye/egitim.ts:162-170 ve 100-108 — üretici puanları `course:{id}:u:{öğrenci}` refId'si ve `kaynakIsaretli` ile puanOlayi'den geçiyor.
- rewards.ts:541-552 — işaret kalkınca birikenin tamamı tek döngüde kesinleşir (ORDER BY yok: hangi satırın yazılacağı belirsiz).
- Araya giren kontrol yok: src/pages/api/uye/admin.ts:199-202 flag_clear yalnız `flaggedAt: null` + cron_runs yazar. Kesinleştirmenin iki çağıranı var: src/pages/api/cron/gunluk.ts:195 (günde bir kez) ve src/pages/uye/index.astro:28.
- Belgelenen niyetle çelişiyor: docs/assumptions.md:72 "Temiz işareti kaldırır (tutulan puan kesinleşir)"; src/pages/uye/admin.astro:142 "serbest bırakır"; ekonomi.ts:276-278 tutulanı kırpmasız `sum(p.delta)` gösterir.
- Test boşluğu doğru: tests/integration/faz5-db.test.ts:294-296 tek satır (15), :344-346 tavansız course_launched; :236 tavanı yazım haftasına sabitliyor.
- Senaryo (c) sırası doğru: gunluk.ts:195 (5. adım) gunluk.ts:218'den (8. adım) önce; serbest kalan eski pay yeni haftanın penceresine yazılır.

ABARTILI / YANLIŞ KISIMLAR
1. "Sessizce" alıcı için yanlış: src/pages/uye/index.astro:97-103 son 7 günün kırpılanlarını (en çok 20) listeler, :531 "+0 yazıldı / +N (tavan dolu, kırpıldı)" yazar; ekonomi.ts:176 admin kartında `kirpilan` sayar. Sessiz olan: bildirim yok, admin "Temiz" anında uyarılmaz. admin.ts:15-267'de elle puan verme eylemi de yok, kayıp arayüzden telafi edilemez.
2. Başlıktaki "Temiz denen hesabın puanı" (a)'da yanlış taraf: kaybeden, hiç işaretlenmemiş üretici (egitim.ts:163 `userId: kurs.createdBy`).
3. (a)'daki kayıp karşı-olgusala göre abartılı: genç hesaptan gelen puan işaret olmasa da bekleyene gider ve toplu kesinleşir (rewards.ts:488-499, docs/adr/0001-kurs-davet-etkinlik-harita.md:108). Sınıfın ilk gün patlaması zaten 100'e kırpılır. İşarete atfedilebilir kayıp yalnız sonraki günlere yayılan olaylardır.
4. (b)'nin "haftada 80 pay"ı pratikte ulaşılamaz: src/lib/economy.ts:180-182 havuz = min(100, round(15·ln(1+V))); üretici tabanı %50 (economy.ts:203-206). 80 için havuz ≈ 100, yani V ≈ 759 gerekir. Testteki V=11,5 kursta üretici 24 aldı (faz5-db.test.ts:225-229); bu ölçekte 200 tavanı ~9 hafta tutulmayla aşılır. (b) ve (c) mekanik olarak doğru, büyüklük olarak kuramsal.
5. Tek satırın kırpılması bilinçli tasarım: ADR :109 "Kırpılan kısım geri kazanılmaz". Yeni olan yalnız çok günlük tutmanın birikimi.

ÖNERİLEN DÜZELTMEYE İTİRAZ (karar Yusuf'ta)
- "Tavan doluysa pending bırak, pencere boşalınca yazılır" Faz 3'ün bilinçli kuralıyla gerilimli: tests/integration/etkinlik-db.test.ts:463-472 tavana takılan ödülün pencere boşalınca ÖDENMEMESİNİ sabitliyor.
- "matures_at 24 saatten eski" sezgisi kırılgan: havuz satırında matures_at 1970'tir (ekonomi.ts:125 `new Date(0)`), cron bir gün atlarsa sıradan genç-hesap satırı da "tutulmuş" sayılır.
- Tavanı kısmen aşan satır (rewards.ts:346 `least`) öneride de kırpılıp `confirmed` olur.

ŞİDDET: düşük. Eksik ödeme yönünde, sömürülemez, tavanla sınırlı, alıcıya panoda görünür; tetik için yanlış pozitif işaret + çok günlük tutma + pencere tavanını aşan birikim gerekir. Kabul edilmiş yanlış pozitif (docs/assumptions.md:71, #64-b ortak Wi-Fi) sık yaşanırsa orta sayılır.

BAKILMAYAN: test koşulmadı; vercel.json cron saati açılmadı (gunluk.ts:2 başlığına dayanıldı); ortak Wi-Fi'da sınıfın gerçekten işaretlenme sıklığı ölçülmedi.

**Kanıtlayan en küçük test**

Dosya: tests/integration/faz5-db.test.ts — "işaretli KAYNAK ve ALICI" testinden (satır 271-298) sonra tek yeni `it`. Gerçek Neon ister (POSTGRES_URL_TEST + CRON_SECRET); birim testle kanıtlanamaz, tavan SQL'in içinde (src/lib/rewards.ts:346-353).

Kurulum (mevcut `uye()` ve `ledger()` yardımcılarıyla; kurs gerekmez):
1. `const [p, s] = await Promise.all([uye("tp"), uye("ts")])` — p üretici (alıcı), s kaynak.
2. s'yi işaretle: `db.update(schema.users).set({ flaggedAt: new Date() })`.
3. gun ∈ [3, 2, 1] için: `rw.bekleyenYaz({ userId: p.id, delta: 50, reason: "course_learner_completed", refId: \`course:${900000 + gun}:u:${s.id}\`, maturesAt: new Date(Date.now() - gun * 864e5) })`. İsteğe bağlı sadakat: aynı satırın `pending_points.created_at`'ini de gun gün geriye çek (her gün 50 < 100, işaretsiz olsa tamamı yazılırdı).
4. Tutma: `rw.bekleyenleriIsle(new Date(), p.id)` → `{ kesinlesen: 0 }`; `ek.isaretliHesaplar()` içinde s için `tutulan: 150`.
5. Admin "Temiz" eşleniği: s'nin `flaggedAt`'ini null yap, sonra `rw.bekleyenleriIsle(new Date(), p.id)` → `{ kesinlesen: 3 }`.

Belirleyici beklenti:
- `ledger(p.id, "course_learner_completed")` delta toplamı `toBe(150)`.
- Bugün 100 gelip KIRMIZI olursa bulgu kanıtlanmıştır; 150 gelip yeşil olursa çürümüştür.
- Kalıcılık kanıtı: p'nin üç pending_points satırından biri `{ status: "confirmed", yazilan: 0 }` ve o refId için ledger satırı yok.

İsteğe bağlı (b) eki, aynı `it` içinde: işaretli alıcı r'ye üç `vitality_pool` bekleyeni (delta 80, refId `course:1:2026-W39` / `W40` / `W41`, maturesAt geçmiş); işaret kalkınca ledger toplamı 240 yerine 200, bir satır `yazilan: 40 < delta: 80`.

Notlar:
- Düzeltmeden önce beklenti kararı verilmeli: "aynı gün 150" mi, "bugün 100 + kalan pencere boşalınca" mı. İkincisi tests/integration/etkinlik-db.test.ts:463-472'deki kuralla birlikte düşünülmeli; ertesi gün `vi.setSystemTime` ile sınanabilir (tavanın `since`'i JS saatinden gelir, rewards.ts:40).
- Test 00:00 TR sınırına denk gelirse yanlış yeşil verebilir.
- Geçici üyeler `uyeler[]` üzerinden afterAll'da temizlenir (faz5-db.test.ts:112-114). Dev ortamı canlı DB'ye bağlı olduğu için başka veriye dokunulmamalı.

### 2.2 · "Temiz" sonrası tutulan puanlar toplu kesinleşiyor; Faz 1–3 tavanları kesinleşme ANINA göre uygulandığı için aklanan üyenin puanı kalıcı kırpılıyor

**Durum (Fable):** A1 ile aynı test; kanıtlı kayıp yolu üretici günlük tavanı (100), kaybeden ALICI.

- **Yer:** `src/lib/rewards.ts:447` · mercek: gerileme · iddia edilen: orta · **hüküm: kismen / orta**
- **Senaryo:** Belgelenen sahte pozitif sınıfı (aynı Wi-Fi'dan kalabalık, docs/assumptions.md:71 madde b): düzenleyen O'nun kurs davetiyle 30 öğrenci katılır, ertesi sabah tarama 30'unu işaretler (src/lib/ekonomi.ts:237-240). Öğrenciler iki haftaya yayılarak ilk öğeyi bitirir (haftada 15 x 15 = 225, tavanın altında); her aktivasyon O'nun course_invite_activated +15'ini bekleyene yazar (src/lib/davet.ts:287-295) ve kaynak işaretli olduğu için tutulur (src/lib/rewards.ts:93-94). Admin 30 hesabı aynı gün "Temiz" yapar (src/pages/api/uye/admin.ts:199-202); O /uye'yi açınca 30 satır birden kesinleşir (src/pages/uye/index.astro:28): 20 satır (300) yazılır, 10 satır (150 puan) yazilan=0 "kırpıldı" olarak kapanır. İşaret olmasaydı O 450 alırdı. Aynı kalıp işaretli üreticide günlük 100 tavanıyla (5 gün x 15 aktivasyon x 5 = 375 -> 100) ve işaretli alıcının birikmiş havuz paylarında (src/lib/ekonomi.ts:120-127 -> haftalık 200) geçerli.
- **Önerilen düzeltme (inceleyici):** En küçük düzeltme src/lib/rewards.ts:454-461'de: satır tutulmuşsa (maturesAt bugünden eski) ve awardPoints tavan yüzünden 0 yazdıysa (ledger'da satır yok) confirmed yapma, pending bırak — pencere açıldıkça sonraki koşumda yazılır. Bilinçli sınır olarak kalacaksa src/pages/uye/admin.astro:142 metnine ve varsayım #65'e "tavan kesinleşme anında uygulanır; toplu Temiz kırpar" yaz. Entegrasyon testi: 3 güne yayılmış tutulan üretici satırları + işaret kaldır -> toplam yazılan.

**Çürütücünün gerekçesi**

Mekanizma gerçek ve hiçbir kontrol engellemiyor; ama başlık senaryosunun kayıp hesabı ve "hiçbir belgede yok" iddiası yanlış. Gerçek kayıp yolu bulgunun ikincil örneği olan üretici günlük tavanı. Hiçbir test ya da sorgu çalıştırılmadı; hepsi kod okumasıyla.

DOĞRULANAN ZİNCİR
1. Tutma: puanOlayi alıcı ya da kaynak işaretliyse ledger yerine bekleyene yazar (src/lib/rewards.ts:484-505). Çağıranlar kaynağı geçiyor: src/pages/api/uye/egitim.ts:100-108 ve :162-170, src/lib/davet.ts:287-295, src/lib/ekonomi.ts:120-127.
2. Olgunlaşmama: bekleyenleriIsle tutulan satırı seçmez (rewards.ts:541-551, koşul :93-100).
3. Toplu çıkış: flag_clear yalnız flagged_at=NULL ve cron_runs kaydı yazar, kademelendirme yok (src/pages/api/uye/admin.ts:199-202). Sonraki pano görüntülemesi (src/pages/uye/index.astro:28) ya da günlük cron (src/pages/api/cron/gunluk.ts:195) LIMIT ve ORDER BY olmadan tek döngüde hepsini kesinleştirir (rewards.ts:541-552).
4. Pencere kesinleşme anında: tavan çağrı anında kurulur (rewards.ts:336; since değerleri :40, :48, :57, :68). Toplam points_ledger.created_at üzerinden sayılır (:348-351), INSERT created_at vermez, kolon defaultNow (src/db/schema.ts:109). Olay tarihi hiçbir yerde kullanılmıyor.
5. Kalıcılık: tavan doluysa INSERT satır yazmaz (rewards.ts:353), bekleyen yine confirmed ve yazilan=0 olur (:454-461). bekleyenleriIsle yalnız pending seçer (:546), puanOlayi upsert'i status='pending' şartlı (:503); yeniden deneme yolu yok. Pozitif telafi aracı da yok: admin_adjust yalnız negatif iade (rewards.ts:392-399, admin.ts:139).
6. Test boşluğu: tests/integration/faz5-db.test.ts:271-298 tek 15'lik satırla, :330-348 tek 50'lik satırla sınıyor; tavanı aşan toplu çıkış hiç sınanmıyor.

KANITLI KAYIP YOLU (üretici günlük 100)
O kursun üreticisiyse 30 işaretli öğrencinin +5 aktivasyon ve +10 bitirme satırları (egitim.ts:162-170, :100-108; refId sonu u:{id}) tutulur. İki haftaya yayılmış 450 puan (gün başına 100'ün altında) çıkış günü 100'e iner; 350 puan yazilan=0 ile kapanır. Bu tavanın reason'ları yalnız course_learner_* (rewards.ts:36-42), davet havuzuyla etkileşmez. Havuz varyantı da mekanik olarak doğru (ekonomi.ts:120-127, rewards.ts:67-68), ama çok haftalık tutma ve 200'ü aşan pay ister.

ÇÜRÜTÜLEN KISIMLAR
a) Başlık senaryosu (450 yerine 300, 150 kayıp) tutmuyor. Tarama yalnız 48 saatten genç ve /d/ ziyareti bırakan hesapları işaretler (ekonomi.ts:223, :228-231). /d/ karşılaması her ziyaretçiye ysf_ref yazar (src/features/davet/karsilama.ts:57), kayıtta O'ya referral_joined +25 doğrudan ledger'a gider (src/lib/member.ts:77-97) ve bu AYNI davet havuzundadır (rewards.ts:51-57, :75-82). 30 kayıt havuzu kayıt günü doldurur (12 x 25 = 300). İşaret olmasaydı ilk 7 günün aktivasyonları zaten 0'a kırpılıp kapanırdı (rewards.ts:507-527); O aktivasyonlardan yaklaşık 225 alırdı, 450 değil. İşaretli dünyada çıkış kayıtlardan 7 gün sonraysa 300 yazılır: bu senaryoda net kayıp yok. Davet tavanında gerçek kayıp ancak alıcı ya da kaynak şikâyet yoluyla işaretliyken oluşur (admin.ts:167-183).
b) "Kırpma hiçbir belgede yok" yanlış: docs/adr/0001-kurs-davet-etkinlik-harita.md:109 "Kırpılan kısım geri kazanılmaz" der, schema.ts:844 aynı kuralı taşır. Pano 7 gün "tavan dolu, kırpıldı" gösterir (uye/index.astro:103, :531), admin kartı kırpılanı sayar (ekonomi.ts:176). Belgede olmayan yalnız tutma ile toplu çıkışın etkileşimi: src/pages/uye/admin.astro:142, docs/assumptions.md:72 ve CLAUDE.md:96-97 koşulsuz "serbest bırakır / kesinleşir" diyor.
c) Önerilen düzeltme riskli. Kırpılanın sonradan ödenmemesi bilinçli kural (tests/integration/etkinlik-db.test.ts:454-467, ADR :109). Satırda "tutulmuştu" bilgisi yok; "maturesAt bugünden eski" ölçütü ertesi gün cron'unun kesinleştirdiği sıradan genç hesap satırlarını da yakalar (src/lib/economy.ts:52-54, gunluk.ts:195) ve günlük tavanı damlama kuyruğuna çevirir. Ayrıca kesinlesen sayısı yanlış çıkar (rewards.ts:558) ve pano her görüntülemede takılı satır başına yeniden dener (rewards.ts:335, :342). Düzeltme yapılacaksa yalnız tutulmuş satıra daraltılmalı; yoksa admin metni ve varsayım #65'e sınır olarak yazılmalı. Karar Yusuf'ta.

ŞİDDET: orta. Suistimal ya da fazla basım yok, eksik ödeme var. Ama kalıcı, admin vaadiyle çelişiyor ve belgelenen sahte pozitif sınıfına (aynı Wi-Fi'dan sınıf, assumptions.md:71 madde b) denk geliyor. Küçük kümede ve tek güne sığan etkinlikte kayıp sıfır. Dal main'e girmedi, canlı etki henüz yok.

DOĞRULANMADI: SQL davranışları (regex, least/where) çalıştırılarak denenmedi; gerçek bir sınıfın etkinliği kaç güne yayacağı kullanım varsayımı.

**Kanıtlayan en küçük test**

Dosya: tests/integration/faz5-db.test.ts, mevcut describe içine yeni bir it (satır 298'deki testten sonra). Gerçek Neon ister (POSTGRES_URL_TEST); CRON_SECRET gerekmez. Mevcut uye() ve ledger() yardımcıları ile afterAll temizliği yeterli.

Kurulum:
1. const [p, s] = await Promise.all([uye("tp", 30), uye("ts", 30)]) — ikisi de 30 günlük, genç hesap freni devre dışı; p taze olduğu için bugün course_learner_* ledger'ı boş.
2. s işaretlenir: db.update(schema.users).set({ flaggedAt: new Date() }).where(eq(schema.users.id, s.id)).
3. Üç kez rw.puanOlayi({ userId: p.id, delta: 50, reason: "course_learner_completed", refId: `course:${900000 + i}:u:${s.id}`, kaynakOlusturulma: s.createdAt, kaynakIsaretli: true }). Her biri 0 dönmeli. Üç ayrı günün olayını temsil eder: her biri günlük 100 tavanının altında.
4. expect(await rw.bekleyenleriIsle(new Date(), p.id)).toMatchObject({ kesinlesen: 0 }) — tutuluyor.
5. İşaret kaldırılır (admin.ts flag_clear'ın ilk adımı), sonra await rw.bekleyenleriIsle(new Date(), p.id).

Beklenti (istenen davranış olarak yazılır): p'nin hiçbir pending_points satırı { status: "confirmed", yazilan: 0 } olarak kapanmamalı.

Sonuç okuması:
- Bugünkü kodda ledger toplamı 100 ve yazilan dizisi sıralı [0, 50, 50], üçü de confirmed çıkarsa test kırmızı olur ve bulgu KANITLANIR.
- Üç satır da tam yazılırsa (toplam 150) ya da üçüncü satır pending kalırsa bulgu ÇÜRÜR.

Dikkat: aynı gerçek günde toplam 150 beklentisi doğru bir düzeltmeyle bile tutmaz; kesin ölçüt toplam değil satırın durumu.

Düzeltme sözleşmesi için isteğe bağlı ikinci aşama: vi.useFakeTimers({ toFake: ["Date"] }) ve vi.setSystemTime(Date.now() + 864e5) ile JS saatini bir gün ilerlet (gunBaslangici JS'te hesaplanır: rewards.ts:593-595; ledger created_at DB saatidir), bekleyenleriIsle'yi yeniden çağır, toplam 150 bekle. Sahte Date'in neon-http ile sorunsuz çalıştığı doğrulanmadı.

Karar "bilinçli sınır" olursa aynı test [0, 50, 50] beklentisiyle karakterizasyon testi olarak kalır.

### 2.3 · Tarama: IP kanıtı son 48 saatin ziyaretinden, atıf çerezi 30 gün — ziyaret satırı eksik olan gerçek davetliler "az ağ" sayılıp işaretleniyor

**Durum (Fable):** B1 — tarifteki test yazıldı, HEAD'de 5 davetli işaretleniyor (kanıtlandı); ziyaretler pencereye alınınca [] (neden sabit). Karar #42 (`5a111a4`, faz5-db.test.ts:325).

- **Yer:** `src/lib/ekonomi.ts:230` · mercek: dogruluk · iddia edilen: dusuk · **hüküm: dogrulandi / dusuk**
- **Senaryo:** Eğitmen cuma bağlantıyı paylaşır; 8 öğrenci cuma tıklar (8 farklı IP, ziyaretler cuma tarihli). Salı günü derste hesap açıp siteye doğrudan girerek katılırlar (çerez duruyor, yeni ziyaret satırı yok). Eğitmen pazartesi-salı kendi bağlantısını 5 kez açmıştır. Çarşamba 06:00 taraması: son 48 saatte kodla katılan yeni hesap = 8; ziyaret penceresinde tek IP var (eğitmen, n = 5) → 5 ≥ 5 ve 1 × 2 ≤ 8 → 8 gerçek öğrenci işaretlenir. Lider tablosundan düşerler, kendi puanları ve onlardan doğan üretici / davet puanları tutulur; admin tek tek "Temiz" dese bile birinci bulgudaki kırpma devreye girer.
- **Önerilen düzeltme (inceleyici):** ip CTE'sindeki 48 saat filtresini kaldır: ziyaretler zaten 30 gün saklanıyor (src/pages/api/cron/gunluk.ts:199-205), filtre kalkınca eksik IP yalnız ?d=KOD yedeğine iner. Saf eşlenik suistimalMi ve varsayım #64 birlikte güncellenmeli. Teste "ziyareti 3 gün önce, hesabı bugün" olan 5 davetli + davet edenin 5 tıklaması → işaret yok senaryosu eklenmeli.

**Çürütücünün gerekçesi**

Çekirdek iddia ve senaryo kod okumasıyla doğrulandı; engelleyen başka kontrol, index ya da çağrı sırası bulamadım. Hiçbir şey çalıştırılmadı (salt okunur kural): SQL davranışı okumayla çıkarıldı.

KANIT ZİNCİRİ
1. Yeni hesap `users.created_at > now() - 48 saat` ile seçilir; bağ yalnız `course_enrollments` / `event_rsvps.invite_code_id` üzerinden kurulur. Hesapla ziyaret arasında hiçbir bağ yok — src/lib/ekonomi.ts:214-223.
2. IP kanıtı yalnız son 48 saatin `invite_visits` satırlarından kurulur (filtre :230); davetçinin tüm kodları birlikte sayılır — ekonomi.ts:227-231.
3. Karar `max(i.n) >= 5 and count(*) * 2 <= y.hesap` — ekonomi.ts:233-235; saf eşleniği src/lib/economy.ts:300-302. Ziyareti pencere dışında kalan ya da hiç olmayan davetli `hesap`'ı artırır, `count(*)`'ı artırmaz.
4. Çerez 30 gün yaşar — src/lib/davet.ts:173, 183. Katılım yalnız çereze bakar: kurs davet.ts:223-238 (çağıran src/pages/api/uye/egitim.ts:126), etkinlik src/lib/etkinlik.ts:184-200.
5. Ziyaret satırını yazan tek yer src/features/davet/karsilama.ts:49-54 (src içinde başka insert yok). Tekilleştirme ve oturum kontrolü yok, yalnız 60/dk IP freni var (karsilama.ts:37-47); davet edenin kendi tıklaması da satır yazar. `kisaHash` gün tuzu taşımaz (davet.ts:53-56), aynı IP günler arası aynı hash'i verir.
6. `/d/` sonrası tarayıcının indiği adres zaten `…?d=KOD`'dur (karsilama.ts:64). Bu adresle dönen ya da onu ileten kişi ziyaret satırı bırakmadan çerez alır — src/pages/kurslar/[slug].astro:54-55, src/pages/etkinlik/[slug].astro:82-83. "Ziyaretsiz gerçek davetli" köşe durum değil, olağan dönüş yolu.
7. UPDATE yalnız `flagged_at is null`, `role = 'member'` ve temiz kaydı yok koşullarına bakar — ekonomi.ts:237-240. Cron 03:00 UTC = 06:00 TR (vercel.json:6), tarama en başta koşar (src/pages/api/cron/gunluk.ts:164).
8. Senaryo aritmetiği: çarşamba 06:00'da yeni = 8, 24 saatlik pencere = 8, `yogun.hesap` = 8 (ekonomi.ts:225-226). `ip` tek satırdır (eğitmen, n = 5); cuma ziyaretleri :230 ile dışarıda kalır. 5 ≥ 5 ve 1 × 2 ≤ 8 olduğundan 8 hesap işaretlenir. Birim testi bu girdiyi zaten şüpheli sayıyor: tests/unit/faz5-ekonomi.test.ts:168 ([5, 5, 1, true]).
9. Sonuçlar: işaretli üye liderde görünmez (src/pages/lider.astro:24), lig dışıdır (src/lib/league.ts:60-66), kendi puan olayları bekleyene gider (src/lib/rewards.ts:488), ondan doğan davet puanı tutulur (davet.ts:284, 293; rewards.ts:93-94, 549). Geri alınabilir: src/pages/api/uye/admin.ts:199-202 + ekonomi.ts:240.
10. Yorum ve belge eksik: ekonomi.ts:200-201 ve economy.ts:296-297 "kendi tıklamaları yalnız IP ekler, işaretletemez" der; bu yalnız davetlilerin ziyareti pencere içindeyse doğru. docs/assumptions.md:71 "Son 48 saate bakar" der ve (c)'de yalnız `?d=KOD` yedeğini sayar; 48 saat ↔ 30 gün uyumsuzluğu orada da CLAUDE.md:97'de de yok.
11. Test boşluğu: tests/integration/faz5-db.test.ts:246-252 her kuklanın hesabını (gunOnce = 0, :248) ve ziyaretini (:251, created_at varsayılan now) aynı anda yazar. Ziyareti eski ya da eksik davetli sınanmıyor.

BULGUDAKİ DÜZELTİLMESİ GEREKEN YAN İDDİALAR
a) "Eski imza kuralında tersiydi" yanlış. Eski kural (`git show 09fc098`, ekonomi.ts eski `imza` CTE: `i.n >= ESIK and i.n * 2 >= i.toplam`) aynı senaryoda n = 5, toplam = 5 ile yine işaretlerdi. 48 saat filtresi 09fc098'de değişmedi (diff'te bağlam satırı): kusur ilk sürümden beri var; 09fc098 yalnız "işaretletemez" vaadini ekledi.
b) "Temiz dese bile birinci bulgudaki kırpma devreye girer" doğrulanmadı; o bulgu bana verilmedi. Bu senaryonun sayılarıyla tek başına tavan kırpması doğmuyor: 8 × 15 + 8 × 10 = 200 < 300 (src/lib/points.ts:77, 79, 81).
c) Senaryonun en zayıf halkası "aynı IP'den 48 saatte 5 ziyaret". `belgeGezintisiMi` başlıksız isteği geçirir (src/lib/urls.ts:21-24) ve `karsila` bot ayırmaz (karsilama.ts:19, 49-54); bağlantı önizleme istekleri de satır yazabilir. Hangi uygulamanın hangi IP'den çektiği doğrulanmadı.
d) Önerilen düzeltme senaryoyu kapatır (9 IP × 2 > 8) ve 30 günlük saklamayla uyumlu (gunluk.ts:199-205). Bedeli: `max(n) >= 5` 30 günde hemen her aktif davetçide sağlanır, son 30 günde hesap / 2'den fazla farklı IP'den ziyaret almış çiftçi de kaçar. `suistimalMi` zaman içermez (economy.ts:300-302): fonksiyon değişmez, yalnız yorumlar, varsayım #64 ve CLAUDE.md:97 güncellenir.

ŞİDDET: düşük. Sahte pozitif, veri kaybı yok, admin kuyruğundan geri alınır. İşaretli üyeye neden söylenmez (davet.ts:303).

**Kanıtlayan en küçük test**

Dosya: tests/integration/faz5-db.test.ts, mevcut tarama testlerinden sonra yeni bir `it` (gerçek Neon, POSTGRES_URL_TEST gerekir). Saf birim testi yetmez: `suistimalMi` zaman içermez, pencereyi SQL belirler.

Kurulum (kendi kendine yeten, `-t` ile tek başına koşabilsin; dosyadaki `uye` / `kurs` yardımcılarıyla):
1. `const d2 = await uye("sy", 30)` (davet eden) ve `const { kurs: k } = await kurs("sy", (await uye("syu")).id)`; `const kod = await dv.davetKoduUret(d2.id, k.id)`.
2. 5 davetli: `uye("sg" + i, 0)` (hesap bugün) + `courseEnrollments` satırı `{ userId, courseId: k.id, inviteCodeId: kod.id }`.
3. Her davetli için ayrı IP'den, 3 gün önce tarihli ziyaret: `inviteVisits` `{ inviteCodeId: kod.id, ipHash: "itest-g" + i + "-" + t, uaHash: "itest-ua", kanal: "link", createdAt: new Date(Date.now() - 3 * 864e5) }`.
4. Davet edenin 5 tıklaması: aynı `ipHash` ("itest-davetci-" + t), `createdAt` varsayılan (now), 5 satır.

Beklenti: `expect(await ek.suistimalTara(d2.id)).toEqual([])`.

Yorum: HEAD cb1d541'de kırmızıysa (5 davetlinin id'si dönerse) iddia kanıtlanır: yeni = 5, 48 saatlik pencerede tek IP n = 5, 1 × 2 ≤ 5. Yeşilse iddia çürür. ip CTE'sindeki 48 saat filtresi (src/lib/ekonomi.ts:230) kalkınca 6 IP × 2 > 5 olur ve test yeşile döner.

İsteğe bağlı kontrol (nedeni sabitler): aynı kurulumda eski 5 ziyaretin `createdAt`'ini now yapıp yeniden tara → mevcut kodda da `[]` dönmeli.

Dikkat: test canlı Neon'a yazar. `suistimalTara(d2.id)` daraltması şart (yalnız test davetçisi). Temizlik mevcut `afterAll` ile olur: üyeler `uyeler[]`, kurs `kurslar[]`, ziyaretler kurs kodları üzerinden silinir.

### 2.4 · puanOlayi bekleyen dalı ledger'a bakmıyor: ödenmiş course_launched için hayalet "+50 bekleyen" açılıyor

**Durum (Fable):** A2 — kapandı (`1019837`): puanOlayi bekleyen dalı ledger'a bakar; test HEAD'de kırmızıydı (faz5-db.test.ts:440).

- **Yer:** `src/lib/rewards.ts:488` · mercek: dogruluk · iddia edilen: dusuk · **hüküm: dogrulandi / dusuk**
- **Senaryo:** Kurs 3 eski hesapla açıldı, üretici +50 aldı (ledger'da satır var, pending yok). 4. katılımcı 24 saatten genç bir hesap (davetle gelen yeni üye — olağan akış) → üreticinin panosunda "+50 · … kesinleşir (hesap yaşı 24 s)" görünür (src/pages/uye/index.astro:122-126). Ertesi gün bekleyeniKesinlestir awardPoints'ten 0 alır ve satırı yazilan=50 ile confirmed yapar (rewards.ts:454-461): puan gelmez, vaat edilen +50 kaybolur, ekonomi kartında "kesinleşen" bir artar. Üretici işaretliyse aynı satır admin kuyruğunda gerçek olmayan "tutulan bekleyen +50" olarak görünür ve "Suistimal (bekleyeni düşür)" düğmesini çıkarır (ekonomi.ts:276-278, src/pages/uye/admin.astro:154-161).
- **Önerilen düzeltme (inceleyici):** puanOlayi'nin bekleyen dalında INSERT'ten önce ledger'da aynı anahtar varsa 0 dön (ledgerDeltaSql hazır: rewards.ts:408-411) — tek koşul. Test: ödenmiş anahtarla genç kaynaklı puanOlayi çağrısı pending satırı açmamalı.

**Çürütücünün gerekçesi**

Çürütülemedi; ana senaryo kod okumasıyla uçtan uca doğrulandı (hiçbir şey çalıştırılmadı). İki yan iddia daha dar çıktı.

ZİNCİR (hepsi doğrulandı)
1. Yeniden gönderim: src/pages/api/uye/egitim.ts:161 her yeni aktivasyonda (akt && üretici değil) girer; :174-188 sayımı yapar; :189 koşulu `n >= KURS_ACILIS_ESIGI` (eşik 3: src/lib/points.ts:85, egitim.ts:28) — eşitlik değil. Eşik aşıldıktan sonraki HER aktivasyon :190-197'de course_launched'ı aynı refId `course:{id}` ile yeniden yollar.
2. Kaynak yaşı en genç katılımcıdan: egitim.ts:177 `max(users.created_at)`, :195 `kaynakOlusturulma`. 4. katılımcı 24 saatten gençse hesapGencMi true (src/lib/economy.ts:47-50).
3. Bekleyen dalı ledger'a bakmıyor: src/lib/rewards.ts:488-505 doğrudan pending INSERT yapar, 0 döner. Tek koruma pending_points unique index'i (src/db/schema.ts:868) + `setWhere status='pending'` (rewards.ts:500-504); ledger kontrolü yok.
4. İlk ödeme doğrudansa çakışacak pending satırı yok: 3 eski hesapla rewards.ts:507-512 awardPoints'e gider; course_launched tavansız (tavanIcin default: rewards.ts:69-70; tests/unit/kurs-ekonomi.test.ts:68) → düz insert (rewards.ts:360-370). Ardından :513-527 UPDATE'i satır bulamaz. Sonraki genç çağrı YENİ pending satırı açar.
5. Çift ödeme yok: points_ledger_idem_idx (schema.ts:119-121) + onConflictDoNothing (rewards.ts:368); tests/integration/ekonomi-db.test.ts:48-54 aynı anahtarın ikinci çağrısının 0 döndüğünü zaten sınıyor.
6. Gösterim: src/pages/uye/index.astro:92-96 pending satırları listeler, :104 toplam başlığa (+50) katar, :122-126 ve :519 "+50 · {tarih} kesinleşir (hesap yaşı 24 s)" yazar. :28'deki tembel bekleyenleriIsle yalnız olgunlaşanı işler (rewards.ts:547), olgunlaşmadan önce satır görünür.
7. Kesinleşme: olgunlaşma = genç hesabın açılışı + 24 s (rewards.ts:489, economy.ts:52-54). Cron (src/pages/api/cron/gunluk.ts:195) ya da pano (index.astro:28) → bekleyeniKesinlestir: awardPoints 0 (idem), satır `confirmed`, yazilan = ledger'daki 50 (rewards.ts:447-461, :408-411). Puan gelmez. yazilan == delta olduğu için "kırpıldı" listesine de düşmez (index.astro:103) → satır sessizce kaybolur.
8. İşaretli alıcı (09fc098'de eklendi, git show ile doğrulandı): rewards.ts:484-488. Ödenmiş üretici sonradan işaretlenirse sonraki her aktivasyon hayalet satır açar; isaretliHesaplar bunu `tutulan`'a toplar (src/lib/ekonomi.ts:276-278); src/pages/uye/admin.astro:154 "tutulan bekleyen +50", :159-161 "Suistimal (bekleyeni düşür)" düğmesi çıkar. Düğme yalnız hayaleti düşürür (src/pages/api/uye/admin.ts:205-210, ekonomi.ts:247-255), gerçek puan kaybı yok.
9. Faz 1'den beri var: `git show 7fd5416:src/pages/api/uye/egitim.ts` :179-187 aynı koşul; `git show 7fd5416:src/lib/rewards.ts` :457 yalnız hesapGencMi dalı.

ENGEL ARANDI, BULUNAMADI
- tutulanBekleyenSql (rewards.ts:93-100) yalnız olgunlaşmayı tutar, açılışı engellemez; senaryoda işaretsiz aktif 4 ≥ 3 olduğundan tutmaz da.
- Diğer puanOlayi çağrıları tek atışlık kapılı: egitim.ts:100 (bitirme geçişi), :162 (akt); src/lib/davet.ts:278, :287, :346, :378; src/lib/etkinlik.ts:324 (yalnız girişi yazan istek, etkinlik.ts:352). Yeniden gönderilen tek olay course_launched.
- Mevcut testlerde "ödenmiş anahtar + genç/işaretli puanOlayi" yok (tests/integration/ekonomi-db.test.ts:56-83, tests/integration/faz5-db.test.ts:271-298, :330-346).

DARALTMALAR
(a) Kurs başına EN ÇOK BİR hayalet: satır confirmed/expired olunca sonraki genç çağrılar unique index + setWhere ile no-op (schema.ts:868, rewards.ts:500-504). İlk ödeme bekleyenden geldiyse (ilk üçten biri gençti) hayalet hiç oluşmaz.
(b) Havuz yeniden koşumu kalıp olarak doğru (ekonomi.ts:120-127) ama fiilen çok dar: cron haftayı kilitler (gunluk.ts:218), ikinci koşum yalnız ilk koşum hata fırlatıp kilidi geri verirse olur (src/lib/cron.ts:28-35) ve arada alıcı işaretlenmiş olmalı.
(c) "Ekonomi kartında kesinleşen bir artar" SQL düzeyinde doğru (ekonomi.ts:175) ama kart bu sayıyı göstermez: yalnız kırpılan/düşen oranlarının paydasıdır (economy.ts:280-281, src/features/admin/EkonomiKarti.astro:47) → oranlar hafif düşük görünür; "Bekleyen puan satırı" olgunlaşana dek +1 (ekonomi.ts:178, EkonomiKarti.astro:46).

ŞİDDET: düşük. Puan bütünlüğü bozulmuyor; etki ≤ 24 saatlik yanlış "+50 bekleyen" vaadi, hafif sapan oranlar, admin kuyruğunda sahte tutulan tutar. Akış olağan (açılmış kursa yeni kayıt olmuş üyenin katılması).

ÖNERİLEN DÜZELTME makul: bekleyen dalında (rewards.ts:488) ledger'da aynı (user, reason, ref) varsa 0 dön. Diğer çağıranları bozmaz: davetBitirme önce bekleyenYaz sonra puanOlayi çağırır, o anda ledger boştur (davet.ts:371-386). Kontrol ile INSERT atomik değil; yarışta en kötü sonuç bugünkü hayalet satır.

DOĞRULANMADI: egitim.ts:195 `new Date(aktif!.enGenc)` — sürücünün ham `max(timestamp)` için döndürdüğü biçim okunmadı; saat dilimsiz dizeyse yerel saat olarak ayrıştırılır (Vercel UTC'de doğru, TR makinesinde 3 saat kayar). Bulguyu değiştirmez, yalnız API düzeyinde yazılacak bir testi etkiler. Test, dev sunucusu ya da DB sorgusu çalıştırılmadı (salt okunur kural).

**Kanıtlayan en küçük test**

Dosya: tests/integration/ekonomi-db.test.ts — mevcut describe bloğuna tek `it` (hazır geçici üye `userId`, `rw`, `ledger` yardımcıları ve afterAll temizliği kullanılır: satır 19-46; yeni kurulum gerekmez). Gerçek Neon, yalnız POSTGRES_URL_TEST ile koşar.

Ad: "ödenmiş anahtarla genç kaynaklı puanOlayi bekleyen satır AÇMAZ"

Kurulum ve beklenti:
1. `const ref = "course:itest-hayalet"` — sayısal OLMAYAN refId: gerçek kursa dokunmaz, tutulanBekleyenSql'in `^course:[0-9]{1,9}$` dalına girmez; AC-13 testinin "course:itest" anahtarıyla çakışmaz.
2. `expect(await rw.awardPoints({ userId, delta: 50, reason: "course_launched", refId: ref })).toBe(50)` — ilk ödeme doğrudan ledger'a, pending satırı yok.
3. `expect(await rw.puanOlayi({ userId, delta: 50, reason: "course_launched", refId: ref, kaynakOlusturulma: new Date() })).toBe(0)` — genç kaynak (4. katılımcının eşleniği).
4. ASIL BEKLENTİ: `db.query.pendingPoints.findMany({ where: and(eq(pendingPoints.userId, userId), eq(pendingPoints.refId, ref)) })` → `toEqual([])`.
5. `expect((await ledger("course_launched", ref)).length).toBe(1)` — çift ödeme yok.

Bugünkü kodda 4. adım KIRMIZI olmalı (1 satır: status "pending", delta 50) → iddia kanıtlanır. Yeşil çıkarsa iddia çürür. rewards.ts:488 dalına ledger ön kontrolü eklenince yeşile döner.

İsteğe bağlı ikinci beklenti (aynı test, 09fc098'in işaretli alıcı yolu): geçici üyeye `flaggedAt: new Date()` yaz → aynı çağrıyı `kaynakOlusturulma: new Date(Date.now() - 30 * 864e5)` ile yap → yine pending satırı yok → `flaggedAt: null` geri al. Dikkat: dev = canlı DB; geçici `demo_itest_` üyesi birkaç saniye admin kuyruğunda görünür.

API rotası (egitim.ts:189) çağrılmaz: yeniden gönderim koşulu kod okumasıyla kesin; kök hata puanOlayi'de ve lib düzeyinde tek çağrıyla kanıtlanır.

### 2.5 · course_launched tutması: "Suistimal" kararından sonra satır süresiz bekler; admin kuyruğu onu görmez

**Durum (Fable):** A3 — karakterize edildi (`04eeb04`, faz5-db.test.ts:461); tarifteki 5. adım `new Date()` erken — olgunlaşma (genç hesabın açılışı + 24 s) gerekir. Karar #42.

- **Yer:** `src/lib/rewards.ts:95` · mercek: dogruluk · iddia edilen: dusuk · **hüküm: dogrulandi / dusuk**
- **Senaryo:** Kursta A ve B (eski, temiz) ile X (genç) aktive olur → course_launched +50 bekleyene yazılır (src/pages/api/uye/egitim.ts:189-197). Ertesi sabah tarama X'i işaretler → satır tutulur. Admin X'i suistimal sayar: X'in tutulanı varsa "Suistimal" yalnız X'in satırlarını düşürür, yoksa düğme hiç çıkmaz. Üreticinin +50'si pending kalır: panoda süresiz "+50 · inceleniyor" (src/pages/uye/index.astro:122-126), bekleyen toplamı ve ekonomi kartındaki "bekleyen" sayısı şişer. 4. bir katılımcı aktive olmadıkça hiçbir yol satırı kapatmaz.
- **Önerilen düzeltme (inceleyici):** En az kod: panoda bu satırı "inceleniyor" yerine "koşul bekliyor (3 katılımcı)" diye etiketle ve testte işaretin kaldığı durumu sabitle. Satırı "Suistimal"de düşürmek tek başına yetmez: expired satır, sonraki genç aktivasyonda puanOlayi'nin upsert'ini (setWhere status = 'pending', rewards.ts:500-504) boşa düşürür ve açılış puanı hiç yazılmaz; o yol seçilirse expired satırın yeniden açılması da gerekir.

**Çürütücünün gerekçesi**

Çürütemedim: zincirin her halkası kodda duruyor, araya giren başka bir kontrol / süre / index yok. Yalnız kod okumasıyla doğrulandı (test ve DB sorgusu ÇALIŞTIRILMADI).

DOĞRULANAN ADIMLAR
1) Satırın doğuşu: 3. aktivasyonda işaretsiz aktif sayısı >= 3 ise puanOlayi, kaynak yaşı = en genç işaretsiz katılımcı (src/pages/api/uye/egitim.ts:174-197). Genç ise ledger'a değil bekleyene yazılır, maturesAt = açılış + 24 s (src/lib/rewards.ts:488-505; src/lib/economy.ts:48-54). Insert expiresAt vermez, upsert null yazar (rewards.ts:492-502); kolon nullable ve varsayılansız (src/db/schema.ts:863).
2) Tutma: bekleyenleriIsle olgunları `not tutulanBekleyenSql` ile seçer (rewards.ts:541-551); OR dalı course_launched + `course:{id}` için işaretsiz aktif (üretici hariç) < 3 ise satırı dışlar (rewards.ts:95-100). Bu dal 09fc098 ile geldi (git show 09fc098 -- src/lib/rewards.ts), ilk incelemenin görmediği commit.
3) Düşme yok: tek süre yolu `expires_at < simdi` (rewards.ts:553-557); NULL hiç eşleşmez.
4) "Suistimal" satıra dokunmaz: flag_confirm yalnız bekleyenleriDusur(X) çağırır (src/pages/api/uye/admin.ts:205-211); yüklem `user_id = X or refId sonu u:X` (src/lib/ekonomi.ts:250-252). course_launched'da user_id = üretici, refId = `course:{id}` (egitim.ts:191-194) → eşleşmez.
5) Kuyruk görmez: tutulan aynı yüklemle toplanır (ekonomi.ts:276-278); düğme yalnız tutulan > 0 iken çizilir (src/pages/uye/admin.astro:159-161). Kuyruk yalnız işaretli hesapları listeler (ekonomi.ts:280) — tarama davetçiyi/üreticiyi işaretlemez (ekonomi.ts:237-239; test satırı tests/integration/faz5-db.test.ts:267).
6) Görünen etki: maturesAt geçmişte → "inceleniyor" (src/pages/uye/index.astro:122-126), satır listede ve toplamda (index.astro:92-104, 513-519); ekonomi kartı "bekleyen" tüm pending satırları sayar (ekonomi.ts:178).
7) Test boşluğu: 330'daki test "suistimal deyince düşer" der ama düşen 2 satır davet satırlarıdır (faz5-db.test.ts:339-341); course_launched ancak üç işaret de kaldırılınca kesinleşir (344-346). İşaret kalırken satırın son durumu hiç assert edilmiyor.
8) Belge: varsayım #65 yalnız ters yönü shortcut diye yazar (docs/assumptions.md:72; PROGRESS.md:16 "Bilinçli kalanlar" da aynı). rewards.ts:90 yorumu "İşaret kalkınca kendiliğinden kesinleşir" der; işaretin KALDIĞI durum hiçbir yerde tanımlı değil.

SENARYO OLUŞABİLİR Mİ: Evet. İşaret iki yoldan gelir: tarama (X'in kümesi: aynı davetçinin koduyla 24 s'te >= 5 yeni hesap + tek IP'den >= 5 ziyaret + farklı IP <= hesap/2 — ekonomi.ts:214-240) ya da "Haklı" şikâyet (admin.ts:167-183). Cron'da tarama bekleyenden önce koşar (src/pages/api/cron/gunluk.ts:164 → 195). Zaman penceresi dar: işaret, maturesAt'tan sonraki ilk işlemeden önce gelmeli (üreticinin panosu da tembel işler — index.astro:28). Daha tipik hâli bulgudakinden de yaygın: üretici kendi kuklalarıyla eşiği doldurur, tarama kuklaları işaretler, admin her birine "Suistimal" der → üreticinin +50'si pending kalır (330'daki testin kurduğu durumun ta kendisi).

BULGUDAKİ ABARTI (düzeltme): "4. katılımcı aktive olmadıkça hiçbir yol kapatmaz" tam doğru değil; dört çıkış var: (a) yeni temiz aktivasyon (egitim.ts:189-197; yaşlıysa rewards.ts:507-527 satırı confirmed yapar), (b) "Temiz" ile sayının yeniden 3'e çıkması (admin.ts:199-202) — TÜM işaretlerin kalkması gerekmez, 3'e ulaşmak yeter, (c) kursun şikâyetle kaldırılması `course:{id}` bekleyenini düşürür (admin.ts:138-154), (d) ÜRETİCİNİN kendisi işaretlenip "Suistimal" denirse user_id eşleşir ve düşer (ekonomi.ts:252). Hiçbiri "X suistimal, işaret kalır, kurs yayında, yeni katılımcı yok" son durumunu kapatmaz; kurs hidden/rejected olursa (a) da kapanır (egitim.ts:142-143).

ŞİDDET: düşük doğru. Yanlış puan basılmaz, puan kaybolmaz; 3. temiz katılımcı gelince satır kendiliğinden doğru sonuca yakınsar. Zarar: yanıltıcı etiket ("inceleniyor" — admin kararını vermiş, incelenen bir şey yok), panoda şişen bekleyen toplamı (kurs başına +50), kartta +1 satır, admin için çıkışsızlık.

ÖNERİLEN DÜZELTMEDEKİ UYARI DA DOĞRU: pending_points unique index'i status içermez (schema.ts:868); expired satırda upsert `setWhere status='pending'` yüzünden no-op olur ve 0 döner (rewards.ts:500-505) → satır "Suistimal"de düşürülürse sonraki GENÇ aktivasyonda açılış puanı hiç yazılmaz (yaşlı kaynakta awardPoints yine yazar: rewards.ts:507-512). Aynı tuzak bugün (d) yolunda zaten var: üreticiye "Suistimal" → sonra "Temiz" → genç 3. katılımcı = +50 kaybolur (yalnız kod okuması, doğrulanmadı).

Etiket düzeltmesine not: panoda geçmiş maturesAt'lı course_launched satırı ya üretici işaretli ya sayı < 3 demektir (index.astro:28 diğerlerini render'dan önce kesinleştirir); "3 katılımcı bekliyor" yazmak üreticiye bir katılımcısının sayılmadığını sezdirir — #65'teki "işaretin kimde olduğu söylenmez" ilkesiyle gerilim, karar Yusuf'ta.

DOĞRULANMADI: regex / ::int / parametreli eşiğin Postgres'te fiilen çalıştığı (yalnız okundu; PROGRESS.md:18 entegrasyonun 67/67 geçtiğini söylüyor); canlı DB'de böyle takılı satır olup olmadığı (sorgu yasak).

**Kanıtlayan en küçük test**

Dosya: tests/integration/faz5-db.test.ts — 330'daki testin hemen altına tek yeni `it` (aynı describe; mevcut uye / kurs / ledger yardımcıları ve `davetci` kullanılır; yalnız POSTGRES_URL_TEST ile koşar, kendi kayıtlarını afterAll temizler).

Kurulum (bulgudaki senaryonun birebiri):
- `const ta = await uye("ta", 30), tb = await uye("tb", 30), tx = await uye("tx", 0);` (iki eski temiz + bir genç)
- `const { kurs: kt } = await kurs("takili", davetci.id);`
- courseEnrollments'a üçü için `activatedAt: new Date()` satırı.
- GERÇEK yazım yolu: `expect(await rw.puanOlayi({ userId: davetci.id, delta: 50, reason: "course_launched", refId: \`course:${kt.id}\`, kaynakOlusturulma: tx.createdAt })).toBe(0);` (genç kaynak → bekleyen; expiresAt'ın null doğduğunu da bu yol kanıtlar)
- tx'i işaretle: `db.update(schema.users).set({ flaggedAt: new Date() }).where(eq(schema.users.id, tx.id))`.
- `const yilSonra = new Date(Date.now() + 365 * 864e5);`

Beklentiler (dördü de geçerse bulgu KANITLANIR; 1 ya da 4 düşerse ÇÜRÜR):
1. `await rw.bekleyenleriIsle(yilSonra, davetci.id);` sonra `expect((await ledger(davetci.id, "course_launched", \`course:${kt.id}\`)).length).toBe(0)` — tutma çalışıyor. (ledger'a refId ver: davetci'nin önceki testten `kl` kursu için course_launched satırı var.)
2. `expect((await ek.isaretliHesaplar()).find((r) => r.id === tx.id)).toMatchObject({ tutulan: 0 })` — kuyruk satırı görmüyor, admin.astro:159 düğmeyi çizmez.
3. `expect(await ek.bekleyenleriDusur(tx.id)).toBe(0)` — "Suistimal" satıra dokunmuyor.
4. Satırı doğrudan oku (`db.query.pendingPoints.findFirst` — userId = davetci.id, reason = "course_launched", refId = `course:${kt.id}`) → `toMatchObject({ status: "pending", expiresAt: null })` — bir yıl sonraki işleme koşumundan SONRA hâlâ pending: süresiz bekleme. (kesinlesen/dusen sayılarına değil SATIRA bak: davetci'nin önceki testlerden başka bekleyenleri var.)
5. (Çıkışı sabitle) `const td = await uye("td", 30);` + aktive katılım → `await rw.bekleyenleriIsle(new Date(), davetci.id)` → `ledger(...)` deltaları `[50]` — tek doğal çıkış 3. temiz katılımcı.

Düzeltme "Suistimal"de satırı düşürme yönünde seçilirse aynı teste 6. adım: satır expired iken `rw.puanOlayi({ ...aynı anahtar, kaynakOlusturulma: new Date() })` → satır yeniden pending olmalı; bugünkü kodda rewards.ts:500-504 yüzünden KIRMIZI kalır (açılış puanı kaybı tuzağı).

Koşum (bir sonraki oturumda, Yusuf'un onayıyla — dev = canlı Neon): `CRON_SECRET="$(node --env-file=.env.local -p process.env.CRON_SECRET)" POSTGRES_URL_TEST="$(node --env-file=.env.local -p process.env.POSTGRES_URL)" npx vitest run tests/integration/faz5-db.test.ts`. İlk koşum Neon soğuk başlangıcında kırmızı verebilir; yeniden koş.

Atlanan: pano etiketi (src/pages/uye/index.astro:122-129) .astro frontmatter'ında, saf fonksiyona çıkarılmadan birim testi yazılamaz — etiket değişirse `bekleyenZaman`'ı lib'e taşıyıp tek birim testi yeter.

### 2.6 · 2. seviye "ilk aktivasyon" sırası üretim yolunda sınanmıyor: test yardımcısı davetAktivasyonu'nu aktivasyondan ÖNCE çağırıyor

**Durum (Fable):** A4 — (A) yardımcı düzeltildi, (B) iki kurslu test yazıldı; HEAD'de yeşil, kıyas silinince / yönü dönünce kırmızı (`6574f58`, faz5-db.test.ts:185).

- **Yer:** `tests/integration/faz5-db.test.ts:61` · mercek: dogruluk · iddia edilen: dusuk · **hüküm: dogrulandi / dusuk**
- **Senaryo:** (1) Yedek dal, test makinesinin saatiyle yazılmış activated_at'i (faz5-db.test.ts:150, new Date()) veritabanının now()'ıyla kıyaslar: makine saati Neon'dan araya giren sorguların süresinden fazla ilerideyse F "daha önce aktive olmamış" sayılır, A'ya u:F satırı yazılır ve :153 beklentisi kırmızıya döner (saat farkı doğrulanmadı). (2) Asıl dalda bir regresyon (yanlış katilimId, < yerine <=) bütün testler yeşilken çıkar: davetlinin ikinci kursunda üst davetçiye ikinci +5 yazılır ya da ilk +5 hiç ödenmez.
- **Önerilen düzeltme (inceleyici):** Yardımcıda iki satırın yerini değiştir (önce activatedAt, sonra davetAktivasyonu) ve bir test ekle: aynı davetlinin iki kursunda activated_at t1 < t2 → yalnız t1'in davet zinciri öder. now() yedeği o zaman gereksizleşir. Kapsam notu: salt okunur inceleme — test, sorgu ya da build çalıştırılmadı. Neon oturum saat diliminin UTC olduğu ve Vercel işlev süresi sınırı (vercel.json'da maxDuration yok; havuz döngüsü yarıda kesilirse cron kilidi tüketilmiş kalır) doğrulanmadı.

**Çürütücünün gerekçesi**

Çürütülemedi: iddianın çekirdeği (test açığı) satır satır doğru. Üretim hatası yok; ikincil senaryolarda iki düzeltme var. Salt okunur inceleme: test/sorgu çalıştırılmadı.

DOĞRULANAN ADIMLAR
1. Üretim sırası: activated_at önce yazılır (src/pages/api/uye/egitim.ts:154-160, `isNull` koşullu UPDATE … RETURNING), davetAktivasyonu yalnız o satır döndüyse çağrılır (egitim.ts:208 `if (akt)`). Başka üretim çağıranı yok: grep'te src/scripts içinde tek çağrı egitim.ts:208; seed doğrudan satır yazar (scripts/seed-demo.ts:361-363).
2. Yeni koşul bu katılımın activated_at'ini alt sorguyla okur, NULL ise now() (src/lib/davet.ts:342); katilimId davet.ts:308'den gelir. Koşul 09fc098'de eklendi (önceki hâl `isNotNull(activatedAt)` + `ne(courseId)`; `git show 09fc098 -- src/lib/davet.ts`).
3. Test yardımcısı ters sırada: tests/integration/faz5-db.test.ts:61 davetAktivasyonu, :62 activatedAt yazımı; :54 yorumu "egitim.ts complete sırası" der. kursaKatil katılımı activatedAt'siz açar (davet.ts:236-240) → :61 anında alt sorgu NULL → coalesce → now(). Yardımcı a3e464a'da da aynıydı (eski koşul bu katılımın activated_at'ine bakmadığı için o zaman zararsızdı); 09fc098 koşulu değiştirdi ama yardımcıya dokunmadı.
4. Yedek dal üretimde erişilemez: tek çağıran `akt` kapılı (egitim.ts:208) ve src'de course_enrollments silen / activated_at'i NULL'a çeviren yol yok (grep: silme yalnız scripts/seed-demo.ts:57,77).
5. Asıl dal testte yalnız :127-130'daki yeniden çağrıda koşar; o anda C'nin başka katılımı yok → `ne(courseId)` (davet.ts:341) tek satırı da dışlar, kıyas hiçbir satıra karşı değerlendirilmez. tests/integration/davet-db.test.ts:96-97 de davetAktivasyonu çağırır ama davet edenin referrals kaydı yok → davet.ts:331-332'de erken döner. e2e'de referrals / invite_second_level kurulumu yok (grep boş).
6. "Eşzamanlı iki kursta hak yanmıyor" (09fc098 commit mesajı; CLAUDE.md:94, PROGRESS.md:14) için test yok: 09fc098'in faz5-db.test.ts diff'inde AC-10 bölümüne (:117-179) dokunan hunk yok (ilk hunk @@ -207); birim test yalnız sabit/tavan (tests/unit/faz5-ekonomi.test.ts:21-23).

BULGUYU GÜÇLENDİREN EK
- :147 beklentisi ("C ikinci kursta, A ikinci kez almaz") "ilk aktivasyon" koşulunu HİÇ sınamıyor: aynı alıcı + reason + refId `u:{C}` (davet.ts:350) points_ledger_idem_idx (src/db/schema.ts:119-121) ve pending_points_idx (schema.ts:868) ile zaten tek satır; koşul tümden silinse de yeşil kalır. Koşulu gerçekten sınayan tek beklenti :153 (F) ve o da yedek daldan geçiyor.

DÜZELTMELER (bulgunun senaryo kısmı)
- (2) "üst davetçiye ikinci +5": AYNI üst davetçiye ikinci satır yukarıdaki iki unique index yüzünden yazılamaz; fazla ödeme yalnız FARKLI bir üst davetçiye gidebilir (davetlinin ikinci kursuna başka zincirden davet). Tavan: (üst davetçi, davetli) çifti başına +5 ve 300/7g davet tavanı (src/lib/rewards.ts:49-56). `<` → `<=` örneği gerçek bir regresyon değil (yalnız eşit zaman damgasında fark eder). Genel iddia yine geçerli: örn. alt sorguda yanlış kolon (joined_at) ya da kıyasın kaldırılması, farklı üst davetçili durumda bütün testler yeşilken çıkar.
- (1) Saat kayması mekanizması doğru ama kanıtsız: activated_at `timestamp` (tz'siz, schema.ts:668), :150 istemci saatiyle yazar, yedek dal DB now() ile kıyaslar; F testi ancak test makinesi saati Neon'dan araya giren ~15 ardışık HTTP sorgusunun süresinden fazla ilerideyse kırmızı olur. Kayma büyüklüğü ve Neon oturum saat dilimi (UTC) doğrulanmadı; belgeler testin yeşil koştuğunu söylüyor.

ASIL DAL (okuyarak): doğru. t1≠t2 iken tam bir istek öder, ikisi birden yanmaz; kıyasın iki yanı aynı oturum saat dilimiyle çevrilir. Kuramsal çift ödeme (eşit ms, ya da bir isteğin sayımı diğerinin yazımından önce koşarsa) yalnız farklı üst davetçilere ve çok dar pencerede; doğrulanmadı.

ÖNERİLEN DÜZELTME GEÇERLİ: :61 ile :62'nin yeri değişince F testi asıl dala girer (iki zaman damgası da istemci saati, saat kayması bağımlılığı kalkar). now() yedeğini silmek şart değil: kalırsa yanlış çağrıda temkinli (ödemez) davranır, silinirse izinli (öder) olur — bırakılması daha güvenli.

**Kanıtlayan en küçük test**

Dosya: tests/integration/faz5-db.test.ts (gerçek Neon, POSTGRES_URL_TEST; mevcut uye()/kurs()/cerez()/ledger() yardımcılarıyla). İki adım, önce (B) yazılır.

(A) Yardımcı düzeltmesi: davetleAktive içinde :61 ile :62'nin yerini değiştir (önce activatedAt UPDATE, sonra dv.davetAktivasyonu) — üretim sırası (egitim.ts:154-160 → :208). Mevcut AC-10 beklentileri aynen yeşil kalmalı (:153 artık asıl daldan geçer).

(B) Yeni test "AC-10: iki kursta aktivasyon — yalnız ERKEN aktivasyonun zinciri öder (farklı üst davetçiler)":
Kurulum: 5 taze üye (hepsi uye() varsayılanı 2 günlük, işaretsiz): a2, b2, g, e, z; referrals: a2→b2 ve g→e. Mevcut `uretici` ile iki kurs K1, K2. z, K1'e b2'nin koduyla, K2'ye e'nin koduyla katılır (dv.davetKoduUret + dv.kursaKatil(z, K, cerez(`course:${K.id}:${kod.id}`))). davetleAktive KULLANILMAZ: iki katılımın activated_at'i AÇIK tarihlerle ve iki davetAktivasyonu çağrısından ÖNCE yazılır: K1 = new Date(Date.now() - 2000), K2 = new Date(Date.now() - 1000) (eşzamanlı iki isteğin ikisi de yazmış hâli). Sonra önce GEÇ olan çağrılır: dv.davetAktivasyonu(katilimK2, K2, z), ardından dv.davetAktivasyonu(katilimK1, K1, z).
Beklenti: ledger(a2.id, "invite_second_level") → [[5, `u:${z.id}`]] (delta, refId); ledger(g.id, "invite_second_level") → uzunluk 0; ayrıca pendingPoints'te g için `u:${z.id}` satırı yok.
Neyi kanıtlar: (i) asıl dal gerçek bir satıra karşı kıyaslanır; (ii) commit iddiası: 09fc098 öncesi koşulda (isNotNull + ne) iki çağrı da birbirini görür, a2 0 alır → test kırmızı; şimdiki kodda yeşil; (iii) farklı üst davetçiler şart — aynı üst davetçide idem index çift ödemeyi maskeler; kıyas yönü ters / yanlış katilimId / yanlış kolon regresyonlarında g satır alır ya da a2 alamaz → kırmızı.

Yardımcının yedek dala bağlı olduğunun bağımsız kanıtı (isteğe bağlı, yalnız yerelde mutasyon): davet.ts:342'de now() yerine '-infinity'::timestamptz konunca (A) uygulanmadan önce :153 kırmızıya, (A) uygulandıktan sonra yeşile dönmeli.

### 2.7 · Tarama cron'un en başında: aynı koşumda otomatik işaretlenen hesap tek-atış sezon / özel lig kapanışından kalıcı düşüyor, "Temiz" geri getirmiyor; tarama ayrıca korumasız

**Durum (Fable):** TEST 1 yeşil → sezon kısmı çürütüldü, C1 kanıtlandı (`1208b56`, faz5-db.test.ts:615). try/catch + `suistimalHata` eklendi (`006d3d5`). TEST 2 (özel lig) yazılmadı: `ozelLigleriKapat` modül içi ve filtresiz.

- **Yer:** `src/pages/api/cron/gunluk.ts:164` · mercek: gerileme · iddia edilen: dusuk · **hüküm: kismen / dusuk**
- **Senaryo:** Canlıda 16 üye var (drizzle/canli-index-uygula.sql:176), yani puan kazanan hemen herkes sezon ilk 10'unda. 30 Eylül akşamı bir topluluk buluşmasında 6 yeni üye aynı Wi-Fi'dan davet QR'ıyla katılır (her ziyaret IP hash'iyle ayrı satır: src/features/davet/karsilama.ts:36-54). 1 Ekim 06:00 koşumu: adım 0 altısını işaretler (src/lib/ekonomi.ts:214-241: 6 hesap, tek IP'den 6 ziyaret, 1 farklı IP), adım 2 Eylül sezonunu kapatır: altısı ilk 10'dan ve kulüplerinin skorundan düşer, hazine kitabı başkasına açılır (gunluk.ts:81-82). Admin 2 Ekim'de "Temiz" der: işaret kalkar, sezon ödülü / şampiyon kulüp / lig birincisi değişmez.
- **Önerilen düzeltme (inceleyici):** Karar Yusuf'ta; en ucuz iki adım: (1) kapanış raporuna işaret yüzünden dışlananları ekle (rapor.sezonDisi) ki "Temiz" sonrası elle telafi edilebilsin ve bu sınırı varsayım #64/#65'e yaz; (2) suistimalTara çağrısını try/catch'e al, hatayı rapor.suistimalHata olarak döndür (etkinlikSonrasiIsle'nin içeride yakalama deseni: gunluk.ts:208-212). Şampiyon rozetinde de isaretsizler süzgecini kullan.

**Çürütücünün gerekçesi**

Kök: /Users/macbook/Downloads/ysf-blog (HEAD cb1d541). Yalnız kod okuma + git; hiçbir şey çalıştırılmadı.

ÖZET: Bulgunun merkezindeki senaryo (1 Ekim koşumunda Eylül sezonu kapanır, altı hesap ilk 10'dan ve kulüp skorundan düşer) OLUŞAMAZ, çünkü sezon kapanış dalına fiilen hiç girilmiyor. Geriye üç doğru ama dar parça kalıyor: özel lig birinciliği, taramanın etki alanı, belge boşluğu.

1) ÇÜRÜTÜLEN — sezon ilk 10, şampiyon kulüp, Ek 2 (şampiyon rozeti)
- src/lib/league.ts:46-51 `aktifSezon()` yalnız `status='active' AND ends_at > simdi` olan sezonu döndürür; yoksa league.ts:52-57 bitişi gelecek ayın 1'i olan yeni sezon ekler (ayPenceresi league.ts:36-40). Yani dönen sezonun bitişi HER ZAMAN gelecektedir.
- src/pages/api/cron/gunluk.ts:172-173 kapanış koşulu `sezon.endsAt <= new Date()`: yalnız aktifSezon'un DB turu sırasında (milisaniyeler) sezon biterse doğru olur. Cron 03:00 UTC (vercel.json schedule "0 3 * * *"), sezon bitişi ay başı 00:00.
- 1 Ekim 03:00 UTC'de Eylül sezonu (bitiş <= şimdi) seçilmez, Ekim sezonu açılır/döner, gunluk.ts:173 yanlış → `sezonKapat` (gunluk.ts:39-92) çağrılmaz, `sezon-kapat` kilidi (gunluk.ts:174) hiç alınmaz.
- Zaman kodlaması tutarlı: node_modules/drizzle-orm/pg-core/columns/timestamp.js:31 ve :35 (UTC okuma/yazma), neon-http/driver.js:25.
- Faz 5'e özgü değil: aktifSezon 821b53d'den beri değişmedi (git log -L46,58:src/lib/league.ts tek commit), koşul da aynı (821b53d gunluk.ts:163-164). src/lib/cron.ts:20-21 yorumu da "aktifSezon bayat sezonu seçmez" diyor.
- Sonuç: süzgeç gunluk.ts:74, şampiyon hesabı league.ts:105-122 ve rozet döngüsü gunluk.ts:47-59 kodda var ama erişilemez dalda. Ek 2 kod düzeyinde doğru (gunluk.ts:48-50 clubMembers süzülmüyor), pratikte koşmuyor; rozet puansız (src/lib/rewards.ts:147-166).
- Doğrulanmadı: canlı DB'de `seasons.status='closed'` satırı var mı (sorgu yasak). Kod okumasına göre olmamalı; bu, bulgudan bağımsız ve daha büyük bir Faz 5 öncesi hata (sezon ödülleri hiç dağıtılmıyor; src/pages/lider.astro:74-80 "geçen sezon şampiyonu" hiç görünmez). Sezon kapanışı onarılırsa bulgunun sezon kısmı CANLANIR.

2) DOĞRULANAN ama dar — özel lig birincisi
- `ozelLigleriKapat` erişilebilir: gunluk.ts:124-129 (`status='active' AND ends_at < now`), çağrı gunluk.ts:192.
- Kilit çıplak `birKez` (gunluk.ts:131; cron.ts:9-16 geri vermez), sıralama `isaretsizler` üzerinden (league.ts:135-139), `status='closed'` + `winnerId` yazılır (gunluk.ts:134-137), rozet gunluk.ts:138-144.
- "Temiz" yalnız `flaggedAt=null` + temiz kaydı (src/pages/api/uye/admin.ts:199-202); kapanmış lig bir daha seçilmez → geri gelmez. İddia doğru.
- Darlık: aynı-koşum etkisi için <= 48 saatlik hesabın (src/lib/ekonomi.ts:223) o gün biten bir ligde lider olması gerekir; ödül rozet + winnerId + serbest metin (schema.ts clubLeagues rewardNote), puan yok.
- "Gerileme" çerçevesi zayıf: geri dönüşsüzlük 09fc098'e özgü değil. Önceki gün taramayla ya da şikâyetle (admin.ts:178-182) işaretlenen hesap için 3b2ab93'ten beri aynı (isaretsizler orada eklendi). 09fc098 yalnız "aynı koşum" dilimini ekledi ve bu BİLİNÇLİ: yorum gunluk.ts:161-162, PROGRESS.md:14 ("tarama sezon kapanışından sonra koşuyordu" düşük bulgu olarak kapatıldı), docs/assumptions.md:71.

3) DOĞRULANAN — sıra değişikliği ve sahte pozitif tetikleyicisi
- 09fc098 taramayı 5a'dan (a3e464a gunluk.ts:188-190) adım 0'a aldı (gunluk.ts:161-165).
- 6 hesap + tek IP'den 6 ziyaret işaretlenir: src/lib/economy.ts:291 (eşik 5), :300-302; ekonomi.ts:224-236. Ziyaret her seferinde ayrı satır (src/features/davet/karsilama.ts:49-54; schema.ts:822-836 tekillik yok). Önkoşul: hesaplar kodla kursa/etkinliğe bağlanmış olmalı (ekonomi.ts:214-218).
- 16 üye: drizzle/canli-index-uygula.sql:176.

4) DOĞRULANAN — belge boşluğu
- PROGRESS.md:16 ve docs/assumptions.md:71 (b), :72 çareyi "Temiz" diye yazıyor ("tutulan puan kesinleşir"); tek-atış kapanışların geri gelmediği hiçbir yerde yazılı değil.

5) KISMEN — Ek 1 (tarama korumasız)
- Doğru: çağrı çıplak (gunluk.ts:164), GET'te try yok (gunluk.ts:148-225); hata 1-8'i durdurur, ayın kitabı yalnız ayın 1'inde denenir (gunluk.ts:183).
- Ama yeni değil ve taramaya özgü değil: a3e464a'da 5a da çıplaktı (eski gunluk.ts:190); `birKezCalistir` hatayı yeniden fırlatır (cron.ts:31-35); `aktifSezon` (gunluk.ts:172) ve `ozelLigleriKapat` (gunluk.ts:192) de çıplak. Adım 1 patlasa da ayın kitabı aynı şekilde atlanır. 09fc098'in farkı yalnız etki alanı: 5-8 yerine 1-8.
- Olasılık düşük: filtresiz sorgu test edilenden yalnız bir AND ile ayrılır (ekonomi.ts:211, :223); sözdizimi/tip hatası tests/integration/faz5-db.test.ts:255-268'de çıkardı; veriye bağlı hata üretecek ifade yok. Filtresiz hâlin canlıda koştuğu: doğrulanmadı.

HÜKÜM: kısmen. Gerçek şiddet düşük: kalan etki puansız bir rozet/winnerId, çok dar bir çakışmada; tarama hatası düşük olasılıklı sağlamlık konusu. Önerilen düzeltmelerden try/catch ve belge notu ucuz ve yerinde; "rapor.sezonDisi" ise sezon kapanışı çalışmadığı için bugün karşılıksız.

Kontrol edilmeyenler: canlı DB durumu (kapalı sezon, biten özel lig var mı), cron ucunun 09fc098 sonrası gerçek koşumu, Vercel'in başarısız cron'u yeniden denemediği (depoda kanıt yok).

**Kanıtlayan en küçük test**

Dosya: tests/integration/faz5-db.test.ts, mevcut describe içinde, "işaretli üye lig sıralamasında görünmez" testinden (satır 310-328) sonra. `lg`, `db`, `schema`, `t`, `eq` zaten hazır (satır 8, 22, 32, 78). Kod değişikliği gerektirmez.

TEST 1 (belirleyici, en küçük) — "aktifSezon bitmiş sezonu döndürmez: cron'un sezon-kapat dalına girilemez"
Kurulum: `seasons` tablosuna tek satır ekle: `{ name: 'itest-bayat-' + t, startsAt: now - 40 gün, endsAt: now - 1 saat }` (status varsayılan 'active'); id'yi sakla.
Çağrı: `const s = await lg.aktifSezon()`.
Beklenti:
 (a) `s.id` bayat satırın id'si DEĞİL;
 (b) `s.endsAt.getTime() > Date.now()` — yani gunluk.ts:173 koşulu `sezon.endsAt <= new Date()` yanlış, `sezonKapat` çağrılmaz;
 (c) bayat satır yeniden okununca `status` hâlâ 'active' (kimse kapatmıyor).
Temizlik: `finally` içinde bayat satırı id ile sil.
Yorum: bugünkü kodda YEŞİL beklenir → bulgunun sezon ilk 10 / şampiyon kulüp / şampiyon rozeti kısmı çürütülmüş olur ve "sezon hiç kapanmıyor" ayrı hatası belgelenir. KIRMIZI çıkarsa (bayat sezon dönüyorsa) bulgunun sezon senaryosu canlıdır.
Canlı DB yan etkisi: bir satır yazılıp silinir; içinde bulunulan ayın sezonu yoksa aktifSezon onu ekler (normal sayfa davranışı, league.ts:52-57). lider.astro yalnız 'closed' okur (satır 77), bayat satır görünmez.

TEST 2 (hayatta kalan kısım; küçük bir önkoşul ister) — "özel lig kapanışı: işaretli lider birincilikten düşer, 'Temiz' geri getirmez"
Önkoşul: `ozelLigleriKapat` gunluk.ts'te modül-içi ve filtresiz (gunluk.ts:123-146); testten çağırmak canlıdaki gerçek ligleri kapatır. Önce `src/lib/league.ts`'e `ozelLigleriKapat(yalnizLigId?: number)` olarak taşınmalı (suistimalTara(davetciId) / canlilikHavuzuDagit(hafta, kursIdleri) deseni).
Kurulum: aynı testteki itest kulübü (temiz 30p, işaretli kukla 90p ve `flaggedAt` dolu) + `club_leagues` satırı `{ clubId: kulupId, startsAt: now - 1 gün, endsAt: now - 1 sn, createdBy: temiz.id }`.
Adımlar ve beklenti: `ozelLigleriKapat(lig.id)` → lig `status='closed'`, `winnerId = temiz.id`. Sonra admin.ts flag_clear'ın iki adımı (`flaggedAt = null` + `cr.birKez(ek.SUISTIMAL_TEMIZ, id)`) → yeniden `ozelLigleriKapat(lig.id)` → `winnerId` hâlâ `temiz.id`, kuklada `lig-birincisi` rozeti yok.
Temizlik: `club_leagues` satırı ve `cron_runs(job='ozel-lig', period_key=lig.id)` silinir (rozet/bildirim afterAll'da üye bazında zaten siliniyor, satır 112-113).

İsteğe bağlı Ek 1 testi (cron ucunu canlı DB'de çağırmadan): yok — GET'i çağırmak tüm işleri koşturur; try/catch düzeltmesi yapılırsa `suistimalTara`'yı mock'layıp fırlatan birim testiyle `rapor.suistimalHata` alanı sınanabilir.

### 2.8 · course_launched için puanOlayi eşikten sonraki HER aktivasyonda çağrılıyor; alıcı işaretliyse ledger'da +50 varken hayalet bekleyen açılıyor ve admin kuyruğunu yanıltıyor

**Durum (Fable):** A2 ile kapandı (`1019837`): işaretli alıcı yolu da aynı testte (faz5-db.test.ts:440, ilk durum).

- **Yer:** `src/pages/api/uye/egitim.ts:189` · mercek: gerileme · iddia edilen: dusuk · **hüküm: dogrulandi / dusuk**
- **Senaryo:** Üretici Ü'nün kursu 3 yaşlı hesapla açılmış: +50 doğrudan ledger'da, bekleyen satır hiç açılmamış. Ü bir mesaj şikâyetinde "Haklı" ile işaretlenir (src/pages/api/uye/admin.ts:167-182). 4. katılımcı ilk öğeyi bitirir -> bekleyene (Ü, course_launched, course:{id}, +50) yazılır. Sonuç: suistimal kuyruğunda "tutulan bekleyen +50" ve "Suistimal (bekleyeni düşür)" düğmesi çıkar (src/lib/ekonomi.ts:276-278; src/pages/uye/admin.astro:154, :159-160), Ü'nün panosunda "Bekleyen puan +50 · inceleniyor" görünür (src/pages/uye/index.astro:104, :125). "Temiz" -> awardPoints 0 (idem), satır yazilan=50 ile confirmed olur (src/lib/rewards.ts:447-461): ekonomi kartında "kesinleşen" +1, yeni puan yok (src/lib/ekonomi.ts:175). Admin var olmayan bir tutulan puana bakarak karar verir.
- **Önerilen düzeltme (inceleyici):** puanOlayi'nin bekleyen dalına tek koşul (src/lib/rewards.ts:488-505): ledger'da aynı (user, reason, ref) satırı varsa bekleyen açma (INSERT ... WHERE NOT EXISTS) — genç hesap yolundaki eski hayaleti de kapatır. Çağrıyı "sayı tam eşiğe eşitken" diye daraltma: işaret kalkınca "sıradaki aktivasyonda yazılır" telafisi (PROGRESS.md:16) buna dayanıyor.

**Çürütücünün gerekçesi**

Çürütülemedi: çekirdek mekanizma satır satır doğru. Hiçbir şey çalıştırılmadı; hüküm yalnız kod okumaya dayanıyor. Bulgunun üç ayrıntısı düzeltilmeli (aşağıda).

DOĞRULANAN ZİNCİR
1. Çağrı her aktivasyonda yinelenir: açılış çağrısı `if (akt && kurs.createdBy !== member.id)` içinde ve koşul `>=` (src/pages/api/uye/egitim.ts:161, :189-197). "Daha önce yazıldı mı" kontrolü yok.
2. Hayaletsiz başlangıç: 3 yaşlı hesapla açılışta alıcı işaretsiz, `kaynakIsaretli` verilmiyor, `hesapGencMi` false → `awardPoints` +50 yazar (src/lib/rewards.ts:488, :507-512). `course_launched` için tavan yok (rewards.ts:69-70). Sondaki UPDATE yalnız var olan pending satırı kapatır (rewards.ts:513-527) → bekleyen satır hiç oluşmaz.
3. İşaret: üye/mesaj şikâyetinde "Haklı" `flaggedAt` yazar, admin hariç (src/pages/api/uye/admin.ts:167-182).
4. Hayalet: `puanOlayi` alıcının `flaggedAt`'ini okur (rewards.ts:484-487), doluysa ledger'a bakmadan `pending_points`'e INSERT eder (rewards.ts:488-505). Engelleyen tek şey `pending_points_idx` (src/db/schema.ts:868); ledger'ın idem index'i ayrı tabloda (schema.ts:119-121). Satır yoksa çakışma olmaz, +50 pending yazılır.
5. Görünürlük: kuyruk `tutulan`'ı alıcının tüm pending delta'larından toplar (src/lib/ekonomi.ts:276-278), ekran bunu ve düğmeyi gösterir (src/pages/uye/admin.astro:154, :159-160). Pano satırı listeler, toplar, olgunsa "inceleniyor" yazar (src/pages/uye/index.astro:92-96, :104, :122-125, :513, :519). İşaret sürdükçe satır kesinleşmez (rewards.ts:93-94, :549; index.astro:28).
6. "Temiz": yalnız işareti kaldırır (admin.ts:199-202). Sonraki pano ziyareti ya da cron (index.astro:28; src/pages/api/cron/gunluk.ts:195) `bekleyeniKesinlestir`'i koşar: `awardPoints` idem'den 0 döner (rewards.ts:360-372), `yazilan` ledger'dan 50 okunur, status confirmed olur (rewards.ts:447-461). Kartta "kesinleşen" +1 (ekonomi.ts:159-160, :175), kırpılan sayılmaz (ekonomi.ts:176), yeni puan yok.
7. Gerileme incelenmemiş commit'ten: alıcı kontrolünü `09fc098` ekledi (`git show 09fc098 -- src/lib/rewards.ts`: `if (opts.kaynakIsaretli || hesapGencMi(...))` → `alici?.flaggedAt || ...`). Açılış çağrısı `kaynakIsaretli` geçmediği için (egitim.ts:190-197) a3e464a'da bu yol yoktu.
8. Genç kaynak yolundaki eş hayalet Faz 5 öncesinde de var: `git show 7fd5416:src/lib/rewards.ts` satır 457-474 aynı ledger-kontrolsüz INSERT; bugün de duruyor (rewards.ts:488). "Faz 1'den beri" kısmı commit bazında doğrulanmadı (dayanak PROGRESS.md:118).
9. Test boşluğu: `puanOlayi`'yi "ledger satırı varken" çağıran test yok. Var olanlar: tests/integration/ekonomi-db.test.ts:57 ve tests/integration/faz5-db.test.ts:280, :284 (ledger boş); faz5-db.test.ts:330-348 bekleyeni `bekleyenYaz` ile elle açıyor.
10. Önerilen düzeltmenin kısıtı doğru: `>=` daraltılırsa "sıradaki aktivasyonda yazılır" telafisi kırılır (PROGRESS.md:16; docs/assumptions.md:72).

BULGUDAKİ DÜZELTMELER
a. Görünen tutar +50 değil +55. Aynı istekte `course_learner_activated` da işaretli Ü'ye gittiği için gerçek bir +5 bekleyen açılır (egitim.ts:162-170 → rewards.ts:488). "Suistimal" düğmesi hayalet olmasa da çıkardı; hayaletin etkisi tutarı 5'ten 55'e şişirmek.
b. "Üretici yaşlıysa" yanlış ifade: yaş freni en genç aktif katılımcıya bakar (egitim.ts:177, :195).
c. "Diğer çağıranlar etkilenmiyor" tam değil. `vitality_pool` çağrısı (ekonomi.ts:120-127) iş yarıda patlarsa kilit geri verildiği için (src/lib/cron.ts:29-35; gunluk.ts:218) aynı hafta yeniden koşar; arada işaretlenen ödenmiş alıcıya aynı hayalet açılır. Dar kenar durumu, yalnız okumayla saptandı. Diğerleri gerçekten tek atış: egitim.ts:154-161, :227-237; src/lib/davet.ts:335-345; src/lib/etkinlik.ts:324.

ŞİDDET: düşük kalır. Ledger'a hiçbir şey yazılmaz ya da silinmez. Hayalet (üye, kurs) başına en çok bir kez oluşur: confirmed/expired satır çakışmada `setWhere status='pending'` yüzünden yeniden açılmaz (rewards.ts:500-504). "Suistimal" yalnız pending satırı düşürür (ekonomi.ts:247-256). Zarar bilgilendirme düzeyinde: admin şişmiş tutar görür, üye gelmeyecek +50'yi "inceleniyor" diye görür, kart sayaçları 1 kayar (src/lib/economy.ts:280-281). Çok kurslu üreticide kurs başına +50 birikir.

**Kanıtlayan en küçük test**

Dosya: tests/integration/faz5-db.test.ts — satır 348'deki `course_launched bekleyeni` testinden hemen sonra tek bir `it`. Gerçek Neon ister (`POSTGRES_URL_TEST`; CLAUDE.md'deki komutla), yalnız kendi geçici üyesine dokunur. Rota ya da kurs gerekmez; `puanOlayi` refId'yi doğrulamaz.

Kurulum (var olan `uye()` ve `ledger()` yardımcılarıyla, satır 34 ve 64):
1. `const u = await uye("hayalet")` — 2 günlük, işaretsiz.
2. `const ref = \`course:itest-hayalet-${t}\``; `const yasli = new Date(Date.now() - 30 * 864e5)`.
3. Açılış (3. aktivasyonun eşi): `expect(await rw.puanOlayi({ userId: u.id, delta: 50, reason: "course_launched", refId: ref, kaynakOlusturulma: yasli })).toBe(50)`.
4. Admin "Haklı": `await db.update(schema.users).set({ flaggedAt: new Date() }).where(eq(schema.users.id, u.id))`.
5. 4. aktivasyonun çağrısı: aynı `puanOlayi` → `.toBe(0)`.

Beklentiler (istenen davranış; bugün KIRMIZI olması bulgunun kanıtıdır):
- `db.query.pendingPoints.findMany({ where: and(eq(userId, u.id), eq(reason, "course_launched")) })` → `[]`. Bugün 1 satır: status `pending`, delta 50.
- `(await ek.isaretliHesaplar()).find((r) => r.id === u.id)!.tutulan` → `0`. Bugün 50.
- `(await ledger(u.id, "course_launched")).map((r) => r.delta)` → `[50]`. Bugün de geçer; puan basılmadığını sabitler.

Aynı `it` içinde ikinci durum (Faz 5 öncesi genç kaynak yolu): işaretsiz ikinci bir üye, önce `awardPoints` ile +50, sonra `puanOlayi(..., kaynakOlusturulma: new Date())` → pending satır `[]` beklenir. Bugün 1 satır.

Temizlik ek kod istemez: `uye()` id'yi `uyeler[]`'e ekler, `afterAll` `pending_points` ve `points_ledger`'ı siler (satır 112-113).

Düzeltme sonrası (`puanOlayi` bekleyen dalında ledger'da aynı user/reason/ref varsa INSERT etme) test yeşile döner. faz5-db.test.ts:271-298 ve ekonomi-db.test.ts:56-80 yeşil kalmalı: ikisinde de ledger boşken bekleyen açılıyor.

Bu test mekanizmayı kanıtlar. Rotanın çağrıyı her aktivasyonda yaptığı egitim.ts:189'daki `>=` okumasına dayanır; rota düzeyi kanıt auth'lu e2e ister, en küçük test değildir.

### 2.9 · "inceleniyor" etiketi ilgisiz satırda çıkmıyor (varsayım çürüdü) ama kaynak adını taşıyan notla birlikte işaretin kimde olduğunu üçüncü kişiye söylüyor

**Durum (Fable):** D1 — tarif yazıldı, HEAD'de geçti (kanıtlandı: not ve bildirim X'in adını taşır) (`952904d`, faz5-db.test.ts:504). Karar #42.

- **Yer:** `src/pages/uye/index.astro:125` · mercek: gerileme · iddia edilen: dusuk · **hüküm: dogrulandi / dusuk**
- **Senaryo:** D'nin 6 davetlisinden yalnız X işaretli (şikâyet "Haklı": src/pages/api/uye/admin.ts:167-182). Altısı da ilk öğeyi bitirir: beş satır anında +15 yazılır, D'nin panosunda tek satır kalır: 'X "Kurs" kursunda ilk öğeyi bitirince · +15 · inceleniyor'; bildirim 'X ... aktive oldu, Puan bekleyende' der. İşaretli olan D olsaydı bütün satırları tutulurdu; tek satırın tutulması X'i ele verir. D, X'in incelemede olduğunu öğrenir.
- **Önerilen düzeltme (inceleyici):** Tutulan satırda notu gösterme (genel metin, örn. "bir davet / kurs puanı") ya da etiketi genç hesap bekleyeniyle aynı nötr metne indir (index.astro:122-129); bildirimde davetli adını "puan bekleyende" ile aynı cümlede kullanma (davet.ts:302-304). Kabul edilecekse #65'i "alıcıya söylenmez; kaynak adı davet edene / üreticiye görünür" diye düzelt.

**Çürütücünün gerekçesi**

Kod okumasıyla doğrulandı; hiçbir şey çalıştırılmadı. Senaryoyu engelleyen bir kontrol, index ya da tavan bulamadım.

1) Asıl sorulan risk gerçekten çürük ("etiket ilgisiz satırda çıkar"):
- Pano listeden önce bekleyenleriIsle(now, member.id) koşturur (src/pages/uye/index.astro:28; liste :92-96).
- O fonksiyon olgunlaşmış ve tutulmayan her satırı kesinleştirir; awardPoints 0 dönse de status confirmed olur (src/lib/rewards.ts:447-462, 541-552).
- Geçmiş matures_at yalnız işaret dallarında yazılır (rewards.ts:488-498); genç hesapta olgunlaşma anı gelecektedir (src/lib/economy.ts:48-54).
- course_launched tetiği ile tutma aynı sayımı kullanır (src/pages/api/uye/egitim.ts:174-189 ve rewards.ts:95-100; eşik aynı sabit: egitim.ts:28, src/lib/points.ts:85).
- Faz 5 öncesi tetik yalnız işaret koşulu eksiğiyle aynıydı (git show 7fd5416:src/pages/api/uye/egitim.ts:165-179), uygulamada katılım silen yol yok (yalnız scripts/seed-demo.ts:57, :77). Mevcut bekleyenler işaret olmadan tutulmaz.

2) Sızıntı senaryosu oluşuyor:
- Katılımda davet edene davetlinin adıyla bekleyen açılır (src/lib/davet.ts:255-262).
- İşaretli X ilk öğeyi bitirince egitim.ts:208 davetAktivasyonu'nu çağırır; o da kaynakIsaretli ile puanOlayi'ye gider (davet.ts:287-295).
- Upsert yalnız matures_at / expires_at'i değiştirir, not kalır (rewards.ts:500-504). X 24 saatten yaşlıysa matures_at geçmiştedir (economy.ts:52-54).
- bekleyenleriIsle bu satırı atlar (rewards.ts:93-94, :549), liste çeker ve 'X "Kurs" kursunda ilk öğeyi bitirince · +15 · inceleniyor' basar (index.astro:122-125, :518-519).
- İşaretsiz ve yaşlı beş davetli doğrudan ledger'a gider (rewards.ts:507-512); tavan 300/7 gün, 5×15=75 (rewards.ts:57, points.ts:81).
- Alıcı işaretli olsaydı bütün satırları tutulurdu (rewards.ts:484-488); tek tutulan satır X'i gösterir.
- Bildirim de adıyla ayrışır: "+15 puan" (davet.ts:299) karşısında "Puan bekleyende; kesinleşince yazılır." (davet.ts:302-304). Bu metin incelenmemiş 09fc098 commit'iyle geldi.
- İşaret yolu doğru: src/pages/api/uye/admin.ts:167-182. Varsayım metni doğru: docs/assumptions.md:72.

3) Bulgunun eksik bıraktığı — kitle davet edenle sınırlı değil:
- Kurs üreticisi de X'in adıyla tutulan satır görür (egitim.ts:104-107, :166-169).
- Etkinlik davetinde aynı (src/lib/etkinlik.ts:228, :324-331); orada tutulunca bildirim hiç gitmez (etkinlik.ts:334).
- 2. seviyede üst davetçi de görür (davet.ts:350-353).

Şiddeti düşük tutan kısıtlar:
- X hem işaretli hem 24 saatten gençse bildirim "hesap 24 saatlik olunca kesinleşir" der (davet.ts:300-301); etiket ancak 24 saat sonra çıkar.
- İşaret zaten herkesçe sezilebilir: /uyeler işaretliyi puanından bağımsız sona atar (src/pages/uyeler.astro:38), lider tablosu hiç göstermez (src/pages/lider.astro:24). İkisi de aynı #65 kararı; etiketin eklediği bilgi küçük.
- Puan / ekonomi etkisi yok; yalnız moderasyon durumu akrana görünüyor.

Önerilen kod düzeltmesi kanalı kapatmaz: tutmanın kendisi sinyaldir. Her davetli katılımda adıyla bildirilir (davet.ts:263-267), beşi "+15" bildirimi alır, altıncı elemeyle bulunur. Tutarlı en küçük çözüm bulgunun son seçeneği: #65'teki "(işaretin kimde olduğu söylenmez)" ifadesini düzeltmek. Not / etiket nötrleştirmesi yalnız açık ifadeyi yumuşatır.

Doğrulanmadı: panonun gerçek HTML çıktısı (etiket index.astro'daki satır içi fonksiyondan okundu); canlı DB'de işaretli üye ya da tutulan satır olup olmadığı; /uyeler'in misafire açıklığı (sayfada giriş kontrolü yok: uyeler.astro:8-39, middleware okunmadı).

**Kanıtlayan en küçük test**

Dosya: tests/integration/faz5-db.test.ts'e tek bir `it` (gerçek Neon, POSTGRES_URL_TEST). Mevcut `uye`, `kurs`, `davetleAktive`, `ledger` yardımcıları kullanılır; temizlik afterAll'da hazır.

Kurulum:
- Taze davet eden D (dosyadaki `davetci` değil: önceki testlerden tavan ve bekleyen kalıntısı taşır), üretici U, yayında kurs K.
- İki davetli: temiz T ve X; ikisi de varsayılan 2 günlük hesap. Altı davetli gerekmez.
- X için `update users set flagged_at = now()`, ardından satırı YENİDEN oku: davetAktivasyonu işareti DB'den değil verilen nesneden okur (src/lib/davet.ts:293).
- `davetleAktive(T, K, D.id)` ve `davetleAktive(isaretliX, K, D.id)`; sonra `rw.bekleyenleriIsle(new Date(), D.id)`.

Beklenti (bugün GEÇERSE iddia kanıtlanır):
1. `ledger(D.id, "course_invite_activated")` tek satır: refId `course:{K}:u:{T}`, delta 15.
2. D'nin pending_points'inde status='pending' tek satır: refId `course:{K}:u:{X}`, matures_at < now, expires_at null, note X.name içerir. Pano bu satırı "inceleniyor" diye etiketler (src/pages/uye/index.astro:122-125).
3. bekleyenleriIsle sonucu `{ kesinlesen: 0 }`; satır hâlâ pending.
4. D'nin notifications satırlarından biri T.name ve "+15 puan", diğeri X.name ve "Puan bekleyende" içerir.

Çürütme: 2. satır yoksa ya da confirmed ise, veya note / bildirim X'in adını taşımıyorsa bulgu düşer.

Sonrası: kod düzeltmesi seçilirse 2 ve 4'teki "X.name içerir" beklentileri "içermez"e çevrilir (kırmızı → yeşil). Yalnız #65 metni düzeltilecekse test karakterizasyon olarak kalır. Etiketin kendisini sınamak için bekleyenZaman'ı (index.astro:122-129) saf fonksiyona çıkarmak gerekir; bu kanıt için şart değil.

### 2.10 · faz5-db.test.ts temizliği varsayılan 10 sn kanca süresine bağlı; yarıda kalırsa canlıda işaretli kukla, yayında test kursu ve cron_runs kaydı kalıyor; global-teardown artık her koşumda canlıya yazıyor

**Durum (Fable):** E1 — afterAll'lar 60 sn, artık kontrol betiği (`7b1152b`). Süre ölçümü ve soğuk koşum: §5.

- **Yer:** `tests/integration/faz5-db.test.ts:82` · mercek: gerileme · iddia edilen: dusuk · **hüküm: kismen / dusuk**
- **Senaryo:** Neon soğuk başlangıcında (ilk koşum kırmızısı kayıtlı: PROGRESS.md:18) temizlik 10 sn'yi aşar -> kanca zaman aşımı, kalan DELETE'ler atılmaz. Canlıda kalır: işaretli kuklalar (faz5-db.test.ts:213, :262-266) canlı suistimal kuyruğunda (src/lib/ekonomi.ts:279-282), status published dört "Itest F5" kursu (faz5-db.test.ts:45) canlı /kurslar ve sitemap'te, test üyelerinin ledger satırları canlı /lider'de, suistimal-temiz kaydı (faz5-db.test.ts:304), onay bekleyen kulüp (faz5-db.test.ts:313-317) — bir sonraki seed:demo'ya kadar; cron_runs kaydı ondan sonra da. İkinci durum: Yusuf kuyruğu elle denemek için demo Elif'i işaretlemişken (PROGRESS.md:19 yolu) herhangi bir npx playwright test koşumu işareti sessizce siler (global-teardown.ts:13).
- **Önerilen düzeltme (inceleyici):** afterAll(async () => {...}, 60_000) ver (ya da vitest.config'e hookTimeout); beforeAll'da clerk_id like 'demo_itest_f5_%' artığını süpür; seed temizle()'ye cron_runs job='suistimal-temiz' silmesini ekle; ekonomi.spec UPDATE'lerine and clerk_id like 'demo%' koy.

**Çürütücünün gerekçesi**

Yapısal iddialar doğru, ama tetikleyici senaryo (soğuk başlangıç -> temizlik 10 sn'yi aşar) kanıtsız ve mekanizması zayıf; global-teardown kısmı abartılı. Hiçbir test/sorgu çalıştırılmadı (salt okunur).

DOĞRULANANLAR
- Kanca süresi 10 sn: afterAll süre argümanı almıyor (tests/integration/faz5-db.test.ts:82, kapanış :115). describe'ın 180 sn'si yalnız testlere gider (faz5-db.test.ts:15; node_modules/@vitest/runner/dist/chunk-hooks.js:606 ve :908 testTimeout okur). Kanca kendi argümanı yoksa hookTimeout alır (chunk-hooks.js:2084-2085, :2144); varsayılan 1e4 (node_modules/vitest/dist/chunks/coverage.DfSpMS-b.js:3922). vitest.config.ts:5-9'da hookTimeout yok; package.json:15 "vitest run" bayraksız.
- Temizlik ardışık Neon HTTP çağrısı (sürücü neon-http: src/db/client.ts:2, :13).
- Koşum başında süpürücü yok: beforeAll yalnız import yapar (faz5-db.test.ts:71-80). Süreç öldürülürse artık kalır.
- Artığın görünürlüğü: suistimal kuyruğu filtresiz (src/lib/ekonomi.ts:279-282; src/pages/uye/admin.astro:125); /kurslar ve sitemap yalnız status=published süzer (src/pages/kurslar/index.astro:28; src/pages/sitemap-kurslar.xml.ts:15); dört yayınlı kurs (faz5-db.test.ts:45, :121, :145, :187, :332); lider ilk 20'de demo/itest filtresi yok (src/pages/lider.astro:47).
- seed:demo artığı süpürür ama cron_runs'a dokunmaz (scripts/seed-demo.ts:50-52, :49-147). FK sırası faz5 artığı için okundu, takılma görmedim (seed-demo.ts:56-66, :67-82, :97-112, :139-146).
- ekonomi.spec UPDATE'leri clerk_id koşulsuz (tests/e2e/ekonomi.spec.ts:14, :20, :23).

ÇÜRÜYEN / ZAYIFLAYAN KISIMLAR
1. Soğuk başlangıç afterAll'ı vurmaz: ilk DB çağrısı ilk testin içinde (faz5-db.test.ts:120), 180 sn bütçeyle; afterAll'a gelindiğinde Neon sıcaktır. PROGRESS.md:18'deki kırmızı koşum afterAll'a değil "başka dosyalardaki beforeAll atlaması"na işaret ediyor; "7 atlanan" sayısı beforeAll'da DB insert'i yapan ekonomi-db ile örtüşüyor (tests/integration/ekonomi-db.test.ts:19-28) — bu eşleştirme çıkarım, doğrulanmadı.
2. Aşıma karşı kanıt: aynı 12 testli dosyayla 2. ve 3. koşum 67/67 ve "canlı DB'de artık yok" (PROGRESS.md:18). Kanca zaman aşımı sessiz değil, suite'i kırmızı yapar (chunk-hooks.js:1737-1745). Gerçek süre ölçülmedi — doğrulanmadı.
3. Çağrı sayısı 23 değil 22 (faz5-db.test.ts:85-114).
4. "Kalan DELETE'ler atılmaz" kesin değil: withTimeout yalnız promise'i reddeder, fonksiyon işçi süreci kapanana kadar sürer (chunk-hooks.js:1863-1875; afterAll'da onTimeout yok :2144). İşçinin ne zaman kapandığı doğrulanmadı.
5. Artık listesi zaman aşımı senaryosuyla uyuşmuyor: kulüp ilk iki çağrıda, kurslar 14. çağrıda silinir (faz5-db.test.ts:85-86, :106); geriye son 8 çağrı kalır (:108-114: referrals, cron_runs, bekleyen/bildirim/rozet/erişim/ledger, users). Yeşil koşum sonunda kuklaların hepsi işaretsiz (:303, :326, :344); işaretli kalan tek hesap "vf" (:213). Yayında kurs + bekleyen kulüp + işaretli kuklalar ancak süreç ölümünde kalır.
6. Gerileme değil: afterAll a3e464a'da birebir aynıydı (ilk incelemenin gördüğü aralık); 09fc098 kancaya dokunmadı. Aynı desen dört eski dosyada da var (ekonomi-db.test.ts:29, davet-db.test.ts:38, etkinlik-db.test.ts:70, mesaj-db.test.ts:81). Faz 5'in farkı: 22 çağrı (önceki en uzun etkinlik-db 15) ve daha görünür artık.
7. cron_runs artığı zararsız: period_key silinmiş bir users.id (faz5-db.test.ts:304); kayıt yalnız u.id::text eşleşmesiyle okunur (src/lib/ekonomi.ts:240); serial id yeniden kullanılmaz.
8. global-teardown "artık her koşumda canlıya yazıyor" abartılı: CLERK_SECRET_KEY varken E2E_CLERK_ID her koşumda kurulur (tests/e2e/global-setup.ts:11-12, :24), yani teardown zaten her koşumda reports DELETE'i atıyordu (global-teardown.ts:15-18). Yeni olan tek, demo satıra daraltılmış idempotent UPDATE (global-teardown.ts:13); bilinçli tasarım (:11-12). Elle işaretlenen Elif'in silinmesi doğru (ayrıca ekonomi.spec.ts:14) ama yalnız elle deneme sürtünmesi.
9. ekonomi.spec'in koşulsuz UPDATE'i gerçek üyeye ancak demo Elif yokken aynı handle alınırsa değer (handle tekil: src/db/schema.ts:54) — teorik.

SONUÇ: gerçek üye verisi ya da puanı etkilenmiyor; risk canlı DB'de test artığı (admin kuyruğunda sahte satır, liderde test üyesi, süreç ölümünde katalogda test kursu), seed:demo ile geri alınır. Önerilen düzeltmelerden değerli olanlar: afterAll'a açık süre ve koşum başında demo_itest_f5_% süpürücüsü. cron_runs silmesi ve ekonomi.spec koşulu kozmetik sertleştirme.

Bakmadıklarım: Neon gecikmesi ve işçi kapanış zamanlaması ölçülmedi; teardown'ın SIGINT'te koşup koşmadığı doğrulanmadı.

**Kanıtlayan en küçük test**

Dosya: tests/integration/faz5-db.test.ts (gerçek Neon; CLAUDE.md'deki komutla, POSTGRES_URL_TEST + CRON_SECRET). Yeni test dosyası gerekmez.

Kurulum:
1. afterAll gövdesini `async function temizle()` içine taşı.
2. afterAll'ı açık süreyle çağır ve süreyi ölç: `afterAll(async () => { const t0 = performance.now(); await temizle(); const ms = performance.now() - t0; console.log("faz5 temizlik ms", ms); expect(ms).toBeLessThan(10_000); }, 60_000)`. Beklenti temizlik BİTTİKTEN sonra koşar; kırmızı olsa da artık bırakmaz.
3. beforeAll'a (açık süre 60_000; DB çağrısı 10 sn kancasına takılmasın) salt-okur artık sayımı ekle: `users where clerk_id like 'demo\_itest\_f5\_%'` ve `courses where slug like 'itest-f5-%'` sayıları 0 olmalı. Bu, önceki koşumların fiilen artık bırakıp bırakmadığını gösterir.

Koşum (üç kez): (a) Neon 5+ dk boştayken tek dosya, (b) hemen ardından sıcak tek dosya, (c) `npx vitest run tests/integration` ile beş dosya paralel.

Karar:
- Herhangi bir koşumda ms >= 10_000 ya da beforeAll sayımı > 0 -> iddia DOĞRULANDI (varsayılan 10 sn'de temizlik kesilirdi / geçmişte artık kalmış).
- Üç koşumda da ms rahat altındaysa (ör. < 5_000) ve sayım 0 ise -> "soğuk başlangıçta 10 sn aşılır" tetikleyicisi bu ortamda ÇÜRÜDÜ; geriye yalnız süreç-ölümü yolu kalır, onu beforeAll süpürücüsü kapatır.

DB'siz ek bekçi (yapısal kısım; bugün 5 dosyada kırmızı olur): tests/unit/entegrasyon-kanca.test.ts — tests/integration/*-db.test.ts kaynaklarını oku; her `afterAll(` çağrısının sayısal süre argümanı taşıdığını YA DA vitest.config.ts'te hookTimeout bulunduğunu doğrula. Aynı dosyada tests/e2e/*.ts içindeki her `update users set flagged_at` ifadesinin `clerk_id like 'demo%'` içerdiğini de denetle (bugün ekonomi.spec.ts:14, :20, :23'te kırmızı).

### 2.x · (çürütmeye gitmedi) onayliKulupMu mevcut kulüp kursu akışını bozmuyor; onay bekleyen toplulukta arayüz hâlâ eski kuralı söylüyor

**Durum (Fable):** D2 — metin düzeltildi (`aa4dc91`); onayliKulupMu rota testiyle kilitli (`4fa849d`, rota-db.test.ts:283).

- **Yer:** `src/pages/uye/egitim-olustur.astro:120` · iddia edilen: dusuk
- **İddia:** Onaylı kulübün başkanı / mod'u, admin ve Sv7 için sonuç aynı: clubId yalnız yönettiğin kulüpte kabul edilir (src/pages/api/uye/egitim.ts:376-381), onaylıysa ya da admin / Sv7 ise published (egitim.ts:47-51, :440-443). Seed kursları API'den geçmeden yazıyor (scripts/seed-demo.ts:327), e2e'de kulüp kursu açan ya da yayin=1 bekleyen test yok (tests/e2e altında eşleşme yok) — bozulan beklenti bulunmadı. Değişen tek yol onay bekleyen topluluk ve orada arayüz eski kuralı söylüyor: form "Kulüp kursları, admin ve Seviye 7+ üreticiler doğrudan yayınlanır" diyor (src/pages/uye/egitim-olustur.astro:120), "Topluluk kursu oluştur" düğmesi kulüp durumuna bakmadan açık (src/pages/kulup/[slug].astro:322-325; etkinlik formu aynı sayfada onay koşuluna bağlı: :345). — Bu mercekte temiz çıkanlar (bulgu değil): bekleyenleriIsle'nin db.select'i aynı satır biçimini döndürür, tarihler kolon çözücüsünden geçer (src/lib/rewards.ts:541-552; önceki fazların testleri aynı fonksiyonu kullanıyor: tests/integration/ekonomi-db.test.ts:77-100, tests/integration/etkinlik-db.test.ts:256-390); KURS_ACILIS_ESIGI yalnız egitim.ts içinde kullanılıyor, değer 3 (egitim.ts:28, :189; src/lib/points.ts:85); uyeler.astro sıralaması tek tablolu sorguda geçerli (src/pages/uyeler.astro:38); davetBitirme'nin önce bekleyenYaz sonra puanOlayi sırası işaretli yolda da tutarlı — upsert aynı satıra maturesAt yazar (src/lib/davet.ts:371-386; src/lib/rewards.ts:500-504); girisOdulleri ve ikinciSeviye n > 0 değilse sessiz kalıyor (src/lib/etkinlik.ts:324-341; src/lib/davet.ts:346-360). Hiçbir test, sorgu ya da sunucu çalıştırılmadı (salt okunur); SQL davranışları yalnız okumayla değerlendirildi.
- **Senaryo:** Onay bekleyen topluluğun başkanı Kurslar sekmesindeki düğmeden kurs açar; form "doğrudan yayınlanır" der. Kayıt pending olur, ?onay=1 bandı çıkar (src/pages/api/uye/egitim.ts:451; src/pages/kurslar/[slug].astro:233-234) ve kurs topluluğun Kurslar sekmesinde görünmez (src/pages/kulup/[slug].astro:88-93). Başkan kursun neden yayınlanmadığını arayüzden anlayamaz.
- **Öneri:** Metni "Onaylı topluluk kursları, admin ve Seviye 7+ ..." yap (egitim-olustur.astro:120); düğmenin yanına onay bekleyen toplulukta "topluluk onaylanınca doğrudan yayınlanır, şimdilik admin onayına gider" notu koy ya da etkinlik formundaki koşulu kullan (kulup/[slug].astro:345).

### 2.y · Fable'ın bağımsız okuması (2026-10-12; `git show 09fc098` baştan sona, yalnız okuma)

Özellikle bakılan yerler: `tutulanBekleyenSql`, `puanOlayi` alıcı okuması, `tavanIcin('vitality_pool')` penceresi, `ikinciSeviye` sıra koşulu, `suistimalTara` CTE'leri, `bekleyenleriDusur`, `flag_confirm`, `onayliKulupMu`, sayfa sorgularına eklenen süzgeçler. **Yüksek ya da orta yeni bulgu yok**; §2.1–2.10 ile örtüşmeyen iki küçük not:

- **Y1 · D3'ün alıcı varyantı** (`src/lib/davet.ts:300-305`): bildirim dalı `hesapGencMi(davetli.createdAt)`'yi `bekliyorMu`'dan ÖNCE sorar. Davetli 24 saatten gençken satır işaret yüzünden tutuluyorsa — davetli işaretli (D3) YA DA alıcı (davet eden) işaretli — davet edene "Puan hesap 24 saatlik olunca kesinleşir" yazılır; satır işaret kalkana dek kesinleşmez. Alıcı varyantında `puanOlayi`'nin okuduğu alıcı işareti bu dalda bilinmiyor; D3 düzeltmesi yalnız davetli işaretini kapatır. → **Durum (Fable):** kapandı (`72f2126`, faz5-db.test.ts Y1).
- **Y2 · "Temiz" kalıcı muafiyet**: `flag_clear` işaretin hangi yoldan geldiğine bakmadan `cron_runs('suistimal-temiz', userId)` yazar (`src/pages/api/uye/admin.ts:199-202`). Şikâyetle ("Haklı") işaretlenip temizlenen hesap ileride gerçek bir çiftlik dalgasında taramaca BİR DAHA işaretlenmez (`src/lib/ekonomi.ts:240`). #64 yalnız "tarama yeniden işaretlemez" der; şikâyet yolundan gelen işaret için bu muafiyet istenmiş mi → karar. Sömürü yolu dar (önce şikâyet edilip aklanmak gerekir).

Okunup TEMİZ bulunanlar (bulgu değil): `tutulanBekleyenSql` `not (A or B)` parantezli; regex'in `(?:^|:)` grubu yakalamaz (entegrasyon bunu koşturuyor); `course_launched` dalının sayımı `egitim.ts:174-189` ile aynı koşulları kullanır (üretici hariç, işaretsiz, aktive). `puanOlayi` alıcı yoksa `undefined?.flaggedAt` → eski yol; `onConflictDoUpdate … setWhere status='pending'` confirmed/expired satırı yeniden açmaz (hayalet en çok 1). `vitality_pool` penceresi `isoHafta(new Date()).baslangic` → `toISOString()::timestamp`, UTC duvar saatiyle `created_at` ile uyumlu. `ikinciSeviye` alt sorgusu `katilim.id`'nin `activated_at`'ini DB'den yeniden okur (egitim.ts aktivasyonu bu çağrıdan önce yazar), NULL `activated_at`'li katılım sayılmaz. `suistimalTara` `bag` UNION'ı aynı (üye, davetçi) çiftini tekilleştirir; iki davetçinin koduyla gelen üye iki davetçide de sayılır; `role='member'` dışı (rep/admin) işaretlenmez ama `hesap` sayımına girer. `isaretsizKazananSql` WHERE'de, `flagged_at is not null` ORDER BY'da (Drizzle tablo adını yalnız seçim listesinde atar).

## 3. İlk incelemenin 23 bulgusunun akıbeti

Aynı kök nedenin kopyaları birleştirildi: 14 tekil bulgu — kapandı 6, kısmen 5, karar bekliyor 2, açık 1.

### [kapandi] Canlılık V'si üreticinin kendi (otomatik kabul edilen) kaynağını sayıyor; vitality_pool kişi başı tavansız; onay bekleyen topluluğun kursu doğrudan yayınlanıyor [motor #1 + suistimal #1]

- **İlk şiddet:** yuksek (motor) / kritik (suistimal) · **çürütme:** doğrulandı x2 (çürüt:2 motor, çürüt:1 suistimal) — gerçek şiddet yüksek (kritik değil)
- **HEAD'de kanıt:** Kaynak sayımı üreticiyi dışlıyor: src/lib/ekonomi.ts:68-70 (`r.user_id <> c.created_by`). Üreticinin kendi yorumu da V'den çıkarıldı: ekonomi.ts:65 — çürüt:1 bunu ÖNERMEMİŞTİ ('yolu kapatmıyor, meşru sinyali siliyor'); yine de uygulandı ve docs/assumptions.md:69 (#62) buna göre yazıldı. Kişi başı haftalık tavan 200: src/lib/rewards.ts:65-68 + src/lib/points.ts:86-88. Onaylı topluluk şartı: src/pages/api/uye/egitim.ts:47-51 ve :438-443 (varsayım #66, assumptions.md:73). Kapanmayan, belgeli kalıntı: 2 hesaplı çiftlik (kukla kaynak önerir / yorum yazar, üretici kabul eder / beğenir → V) — PROGRESS.md:16 'Bilinçli kalanlar'; tavan DEĞERİ Yusuf'ta (PROGRESS.md:15 (c)). Doğrulanmadı: düzeltmeden önce bekleyen toplulukla yayınlanmış kurs canlı DB'de duruyor mu (sorgu yasak; geriye dönük temizlik kodu yok).
- **Kilitleyen test:** Üretici kaynağı KİLİTLİ: tests/integration/faz5-db.test.ts:214-216 + :226 (5 üretici kaynağı sayılsa V 21,5 → havuz 47 olurdu; 38 bekleniyor). Tavan KİLİTLİ: tests/unit/faz5-ekonomi.test.ts:27-35 + faz5-db.test.ts:236. Üretici yorumu dışlaması (ekonomi.ts:65) KİLİTLİ DEĞİL: veri var (faz5-db.test.ts:217-219) ama filtre kalksa V 12 olur ve round(15·ln 13) yine 38 çıkar (elle hesap; çalıştırılmadı). onayliKulupMu: YOK (hiçbir test API rotasını çağırmıyor).

### [kismen] Suistimal taramasının imzası hesaba değil kimliksiz /d/ ziyaretine bağlı: üçüncü kişi ya da davet edenin kendi tıklamaları gerçek davetlileri toplu işaretletebiliyor [güvenlik #1 + suistimal #2]

- **İlk şiddet:** yuksek (güvenlik) / yuksek (suistimal) · **çürütme:** doğrulandı x2 (çürüt:5 güvenlik, çürüt:3 suistimal) — gerçek şiddet orta; kök düzeltme şema gerektirir denmişti
- **HEAD'de kanıt:** Uygulanan, çürüt:3'ün şemasız azaltması ('az ağ, çok hesap'): src/lib/ekonomi.ts:224-236 (IP başına gruplama; `max(i.n) >= 5 and count(*) * 2 <= y.hesap`), saf eşlenik src/lib/economy.ts:300-302. `/d/` üzerinden kendi ağından gelen gerçek davetliler artık dışarıdan eklenen ziyaretle işaretletilemez. AÇIK: (1) UPDATE hâlâ şüpheli davetçinin 48 saatlik TÜM yeni hesaplarını işaretliyor, imza–hesap bağı yok (ekonomi.ts:237-241); (2) ziyaret satırı bırakmadan bağlanan gerçek davetliler (`?d=KOD` yedeği: src/pages/kurslar/[slug].astro:51-55; 48 saatten eski ziyaret de aynı sınıf — kod okuması) farklı IP saymaz → tek IP'den 5 GET yine işaretletir; 'tek IP'den >= 5 ziyaret' koşulu hâlâ dışarıdan sağlanabilir (ekonomi.ts:235; kodun kendi notu ekonomi.ts:203-205); (3) aynı ağdan gerçek kalabalık sahte pozitif (docs/assumptions.md:71 (b)); (4) admin kuyruğu kanıt göstermiyor, toplu 'Temiz' yok, limit 100 (ekonomi.ts:270-283; docs/ideas.md:30). KARAR BEKLEYEN kök çözüm (kayıt anında hesap imzası): assumptions.md:71 (#64), PROGRESS.md:15 (a). GitHub #42'nin gövdesi doğrulanmadı (gh çağrılmadı; kaynak PROGRESS.md).
- **Kilitleyen test:** tests/integration/faz5-db.test.ts:243-269 (özellikle :257-260: başka iki IP'den 12 ziyaret işaretletmiyor); tests/unit/faz5-ekonomi.test.ts:165-180 (satır 171-173: kendi tıklaması / curl döngüsü). Açık kalan (1) ve (2) için test YOK.

### [karar-bekliyor] Platform daveti (?ref=) çiftliği taramada imza üretmiyor; referral_joined kayıt anında doğrudan ledger'a yazılıyor; UA değiştirme, 48 saat bekletme ve imzasız ysf_davet çerezi taramayı düşürüyor [suistimal #3]

- **İlk şiddet:** yuksek · **çürütme:** doğrulandı (çürüt:4) — gerçek şiddet orta; Faz 5 gerilemesi değil, davet tavanı (300/7g) ile sınırlı
- **HEAD'de kanıt:** Kod kapanmadı: referral_joined hâlâ doğrudan awardPoints, refId `String(member.id)` (işaretle tutulamaz) — src/lib/member.ts:91-97; `?ref=` ziyaret satırı yazmıyor (src/middleware.ts:14, src/layouts/Base.astro:95). 09fc098 ayrıca `referrals`'ı taramanın `bag` CTE'sinden ÇIKARDI (src/lib/ekonomi.ts:214-217) → platform daveti kümesi artık 'yoğun' sayımına da girmiyor. Alt maddeler: UA değiştirerek kaçış kapandı (IP'ye göre gruplama, ekonomi.ts:231) ama IP dağıtan çiftlik aynı sınıfta açık; 48 saat penceresi / günde 4 hesap eşik altı (ekonomi.ts:223, src/lib/economy.ts:291) ve düz metin `ysf_davet` çerezi (src/lib/davet.ts:172-191; elle kurulursa ziyaret satırı oluşmaz, tarama görmez) AÇIK. Karara bırakıldı: docs/assumptions.md:71 (#64 bilinen sınır (a),(c) + 'kök çözüm'), PROGRESS.md:15 (a),(b): hesap imzası + referral_joined'ın puanOlayi ile 24 saat bekleyene yazılması.
- **Kilitleyen test:** YOK (kapanmadı; ziyaretsiz platform çiftliği hiçbir testte yok)

### [kapandi] puanOlayi alıcının işaretine bakmıyor: işaretli ALICININ bekleyeni, kaynak temiz ve 24 saatten yaşlıysa olay yolunda doğrudan kesinleşiyor [güvenlik #2 + motor #3 + sql #2 + suistimal #5'in (1) maddesi]

- **İlk şiddet:** orta (güvenlik), orta (motor), dusuk (sql); suistimal #5 bütünü orta · **çürütme:** doğrulandı x2 (çürüt:13 güvenlik, çürüt:7 motor) — gerçek şiddet düşük; sql kopyası çürütülmedi; suistimal #5(1) için çürüt:10 'bilinçli karar, uygulanmamalı' dedi — düzeltme yine de uygulandı, varsayım #65 buna göre yazıldı
- **HEAD'de kanıt:** src/lib/rewards.ts:484-488 (alıcının flagged_at'i okunur; doluysa bekleyen dalı), tutma rewards.ts:93-94 + :549. Kapsam bilinçli genişledi: işaretli alıcıya giden TÜM puanOlayi puanları (üretici puanları, 2. seviye, havuz payı) tutulur — docs/assumptions.md:72 (#65). Çağıranlar değişmedi.
- **Kilitleyen test:** tests/integration/faz5-db.test.ts:282-288 (işaretli alıcı + 30 günlük temiz kaynak → 0 döner, ledger boş, kesinlesen 0) ve :292 (kuyrukta tutulan 10+5+7). Eksik: bulgudaki tam senaryo (önceden açılmış 14 günlük davet bekleyeni + olay) ve bu satırın işaret kalkınca kesinleşmesi ayrıca sınanmıyor (:294-296 başka satırı sınıyor).

### [kapandi] Canlılık havuzu işaretli hesabın beğenisini (V + %30 katkı ağırlığı) ve davetliliğini (%20 davet ağırlığı) sayıyor; işaretli alıcıya pay doğrudan ledger'a yazılıyor [güvenlik #3 + motor #4 + sql #1 + suistimal #4'ün işaret yarısı]

- **İlk şiddet:** orta x4 (güvenlik, motor, sql, suistimal) · **çürütme:** doğrulandı x2 (çürüt:8 motor, çürüt:12 sql) — gerçek düşük; kısmen x2 (çürüt:14 güvenlik, çürüt:9 suistimal) — gerçek düşük ('işaretli alıcıya doğrudan ödeme' ve 'tavansızlık' belgeli karar sayılmıştı)
- **HEAD'de kanıt:** Üç okuma sorgusuna işaret süzgeci: src/lib/ekonomi.ts:61-67 (begenili: `lu.flagged_at is null`), :89-96 (katkı ağırlığı), :98-106 (davet ağırlığı: `ku.flagged_at is null`). İşaretli alıcının payı artık puanOlayi ile bekleyene: ekonomi.ts:119-127 — çürütücüler bunu Yusuf'un kararı saymıştı; varsayım #62 'pay ALIR' yerine 'bekleyene yazılır' oldu (docs/assumptions.md:69). Kişi başı tavan: src/lib/rewards.ts:67-68. Bilinen bedel: işaret sonradan kalkarsa o haftanın ağırlığı geriye dönük ödenmez (hafta kilidi src/pages/api/cron/gunluk.ts:218).
- **Kilitleyen test:** Davet ağırlığı KİLİTLİ: tests/integration/faz5-db.test.ts:222-223 + :230 (işaretli davetli sayılsa davetçi 3 değil 4 alırdı). Beğeni süzgeçleri (ekonomi.ts:66 ve :94) KİLİTLİ DEĞİL: veri var (faz5-db.test.ts:220) ama o yorum zaten işaretsiz üyeden beğenili ve tek katkıcı var → süzgeç kalksa da V 11,5 ve pay 11 aynı kalır (elle hesap; çalıştırılmadı). İşaretli alıcının HAVUZ payının bekleyene gitmesi: havuza özel test YOK (genel dal faz5-db.test.ts:282-288).

### [karar-bekliyor] Havuz katkı ağırlığı ham beğeni satırı sayısı; beğenenin kursa katılmış olması aranmıyor — işaretlenmemiş tek kukla %30 dilimi yönlendirir [suistimal #4'ün işaret dışı yarısı]

- **İlk şiddet:** orta (suistimal #4 bütünü) · **çürütme:** kısmen (çürüt:9) — gerçek düşük; 'beğeneni katılımcıyla sınırla / farklı beğenen say' PRD §4.2 tanımını değiştirdiği için ürün kararı sayıldı
- **HEAD'de kanıt:** Ağırlık hâlâ beğeni satırı `count(*)`, katılım şartı yok: src/lib/ekonomi.ts:89-96. Karar kaydı: docs/assumptions.md:69 son cümle (#62), PROGRESS.md:15 (d). Sınırlayan: kurs başına 100 (src/lib/economy.ts:178-181) + kişi başı 200 (src/lib/rewards.ts:67-68).
- **Kilitleyen test:** YOK (kapanmadı)

### [kismen] course_launched bekleyeni (refId'de kaynak yok) onu doğuran hesaplar sonradan işaretlense de olgunlaşıp +50 yazıyor; ters yönde işaret kalkınca eşik yeniden değerlendirilmiyor [güvenlik #5 + motor #2 + sql #3 + suistimal #5'in (3) maddesi]

- **İlk şiddet:** dusuk (güvenlik), orta (motor), dusuk (sql); suistimal #5 bütünü orta · **çürütme:** doğrulandı (çürüt:6 motor) — gerçek düşük; suistimal #5 içinde çekirdek olarak doğrulandı (çürüt:10: kısmen, düşük); güvenlik ve sql kopyaları çürütülmedi
- **HEAD'de kanıt:** İleri yön KAPANDI (çürüt:6'nın 'A' düzeltmesi): src/lib/rewards.ts:93-100 (tutulanBekleyenSql'in course_launched dalı: işaretsiz aktif katılımcı < 3 ise olgunlaşmaz) + :549; eşik sabiti lib'e taşındı (src/lib/points.ts:84-85). Ters yön AÇIK (çürüt:6'nın 'B'si uygulanmadı): eşik hâlâ yalnız aktivasyon isteğinde ve işaretliyi dışlayarak sayılıyor (src/pages/api/uye/egitim.ts:174-189); eşik işaretli hesap yüzünden tutmadıysa 'Temiz' sonrası +50 kendiliğinden yazılmaz, sıradaki aktivasyonu bekler — belgeli shortcut: docs/assumptions.md:72 (#65), PROGRESS.md:16. Ayrıca: admin kuyruğundaki `tutulan` bu satırı saymıyor (src/lib/ekonomi.ts:276-278); 24 saatten yaşlı, henüz işaretlenmemiş hesaplarla doğrudan yazılan +50 geri alınmaz (işaret geriye dönük değil).
- **Kilitleyen test:** tests/integration/faz5-db.test.ts:330-337 (üç aktif katılımcının üçü işaretli → yazılmaz) ve :344-346 (işaretler kalkınca +50). Ters yön için test YOK; üretim yolu (egitim.ts `complete`) testte çağrılmıyor — bekleyen satır bekleyenYaz ile elle kuruluyor (:335).

### [kismen] İşaretli (ve 24 saatten yaşlı) davetli aktive olunca davet edene 'Haftalık davet puanı tavanın dolu; puan yazılmadı' bildirimi gidiyor; puan aslında bekleyende [güvenlik #6 + motor #5]

- **İlk şiddet:** dusuk x2 (güvenlik, motor) · **çürütme:** çürütülmedi (çürütmeye gitmedi; çürüt:7 ve çürüt:13 yan not olarak aynı yanlış metni doğruladı)
- **HEAD'de kanıt:** Yaşlı + tutulan (işaretli kaynak ya da alıcı) durumda metin artık nötr: src/lib/davet.ts:300-305 + bekliyorMu davet.ts:311-323 ('Puan bekleyende; kesinleşince yazılır.'). AÇIK kalan (motor bulgusunun son cümlesi): davetli hem genç hem işaretliyse dal sırası gereği hâlâ 'Puan hesap 24 saatlik olunca kesinleşir' yazılıyor (davet.ts:300-301); puan ise işaret kalkana dek bekler.
- **Kilitleyen test:** YOK (hiçbir test bildirim gövdesini doğrulamıyor)

### [kapandi] ikinciSeviye'de 'ilk aktivasyon' kontrolü geç ve sırasız okunuyor: eşzamanlı iki kurs aktivasyonunda 2. seviye (+5) hiç yazılmıyor [motor #6]

- **İlk şiddet:** dusuk · **çürütme:** çürütülmedi (çürütmeye gitmedi)
- **HEAD'de kanıt:** 'İlk' artık aktivasyon anına göre: src/lib/davet.ts:330-345 (yalnız bu katılımdan ÖNCE aktive olmuş başka kurs varsa döner) → iki istek birden hakkı yakamaz. Düzeltmenin incelenmemiş yan riski (kod okuması; doğrulanmadı): inceleyicinin önerdiği eşitlik kırıcı (küçük enrollment id) yok ve activated_at commit sırasından değil uygulama saatinden yazılıyor (src/pages/api/uye/egitim.ts:154-160) → dar bir pencerede iki istek de 'önceki yok' görebilir; üst davetçiler farklıysa iki ayrı +5 yazılabilir (aynı kişiyse idem index tutar). İlk incelemede 'çift ödeme yönü yok' denmişti; bu, düzeltme sonrası yeniden değerlendirilmeli.
- **Kilitleyen test:** YOK. Sıralı durum tests/integration/faz5-db.test.ts:144-154'te var, ama yardımcı davetleAktive aktivasyon anını davetAktivasyonu'ndan SONRA yazıyor (faz5-db.test.ts:61-62) → sorgu `coalesce(..., now())` yedeğine düşüyor; yeni `activated_at <` karşılaştırması ve eşzamanlı senaryo sınanmıyor.

### [kapandi] ekonomi.spec.ts canlı DB'deki demo üyeyi işaretliyor; işaret kalırsa test kendini onaramıyor, global-teardown temizlemiyor; ?t=7 / ?t=30 beklentisi boşuna geçebiliyor [güvenlik #4]

- **İlk şiddet:** orta · **çürütme:** çürütülmedi (çürütmeye gitmedi)
- **HEAD'de kanıt:** tests/e2e/ekonomi.spec.ts:13-14 (ön koşuldan ÖNCE işareti temizler), :15-18 ve :21 (yalnız işaretlemeden önce göründüğü sekmeler sınanır), tests/e2e/global-teardown.ts:9-13 (teardown'da temizlik, E2E_CLERK_ID şartından önce). Kalan (belgeli): test yine canlı DB'deki demo üyeyi birkaç saniye işaretliyor — docs/assumptions.md:72 son cümle.
- **Kilitleyen test:** Düzeltme testin kendisi (ekonomi.spec.ts:14-21, global-teardown.ts:13); ayrı bekçi YOK. Zaman aşımı / yarıda kesilme senaryosu çalıştırılarak doğrulanmadı.

### [kapandi] Cron'da suistimal taraması sezon ve özel lig kapanışından SONRA koşuyor; yeni kukla kümesi kapanış ödüllerine giriyor [sql #4]

- **İlk şiddet:** dusuk · **çürütme:** çürütülmedi (çürütmeye gitmedi)
- **HEAD'de kanıt:** src/pages/api/cron/gunluk.ts:161-165 (tarama 0. adım), sezon kapanışı :171-180, özel lig :192, bekleyenler :195. Kalan (belgeli): günlük tarama — küme iki cron arasında tamamlanırsa ilk hesaplar kaçar (docs/assumptions.md:71 (d)).
- **Kilitleyen test:** YOK (cron ucu hiçbir testte çağrılmıyor; sıra yalnız kod okumasıyla doğrulandı)

### [kismen] Puan toplamıyla sıralayan üç sorgu işaret filtresi almadı: /uyeler, kulüp grup katkı sıralaması, harita il içi sırası [sql #5]

- **İlk şiddet:** dusuk · **çürütme:** çürütülmedi (çürütmeye gitmedi)
- **HEAD'de kanıt:** /uyeler: işaretli dizinde kalır, sıranın sonuna düşer — src/pages/uyeler.astro:37-38. Kulüp grup katkısı: src/pages/kulup/[slug].astro:156 (isaretsizKazananSql, src/lib/social.ts:12-13). Harita il içi sırası DEĞİŞMEDİ: src/lib/harita.ts:99-108 filtresiz getEarnedMap — bilinçli bırakıldı ('harita sırası etkilenmez', docs/assumptions.md:72; haritada görünmeme fikri docs/ideas.md:31).
- **Kilitleyen test:** YOK (tests/e2e/flows.spec.ts:70 /uyeler'i yalnız arama için açıyor; grup katkı sorgusu sayfa içinde, testsiz)

### [kismen] Suistimal kuyruğunun tek çıkışı 'Temiz': tutulan puanı düşürecek eylem yok, tutulan bekleyen hiç düşmüyor, kuyruk kanıt göstermiyor, limit 100 [suistimal #6]

- **İlk şiddet:** orta · **çürütme:** kısmen (çürüt:11) — gerçek düşük: mekanik doğru, senaryo sayıları ve 'puan sızıntısı' iddiası abartılı; eksik olan 'onay' durumu
- **HEAD'de kanıt:** 'Suistimal (bekleyeni düşür)' eklendi: src/pages/api/uye/admin.ts:203-211, src/lib/ekonomi.ts:246-256, düğme src/pages/uye/admin.astro:159-161 (işaret kalır; hesaba ait + ondan doğan pending → expired). AÇIK: kuyruk satırı imza kanıtını / davet bağının türünü göstermiyor ve `davet_eden` yalnız referrals'tan okunuyor (ekonomi.ts:270-283; docs/ideas.md:30); limit 100 (ekonomi.ts:282); onaylanan hesap kuyruktan çıkmıyor — tutulan 0 olunca düğme gizleniyor ama 'incelendi' durumu yok (admin.astro:159); tutulan bekleyenin kendiliğinden düşmesi yok (src/lib/rewards.ts:500-504, expiresAt null). KARAR BEKLEYEN: ledger'a yazılmış puanın (ör. referral_joined +25) geri alınması — docs/assumptions.md:72, PROGRESS.md:15 (f).
- **Kilitleyen test:** tests/integration/faz5-db.test.ts:338-342 ve :347 (bekleyenleriDusur: 2 satır düşer, işaret kalır, düşen puan geri gelmez). API dalı flag_confirm ('yalnız işaretli hesapta' kapısı, admin.ts:205-211) ve admin ekranı testsiz (PROGRESS.md:16 'admin ekranları e2e'siz').

### [acik] İşaret yalnız puanOlayi bekleyenlerini tutuyor: işaretli kukladan doğan like_received ve event_hosted doğrudan akıyor; tarama davet edeni işaretlemiyor [suistimal #5'in (2) ve (4) maddeleri; (1) ve (3) yukarıdaki satırlarda]

- **İlk şiddet:** orta (suistimal #5 bütünü) · **çürütme:** kısmen (çürüt:10) — gerçek düşük: beğeni ve event_hosted 'doğru ama küçük / belgelenen kapsam dışı, karar gerektirir'; davet edenin işaretlenmemesi ve answer/resource_accepted iddiaları ÇÜRÜTÜLDÜ (bilinçli tasarım)
- **HEAD'de kanıt:** Değişmedi: begeniPuaniVer beğenenin işaretine bakmıyor (src/lib/rewards.ts:607-660); girisSayisi işaretli girişi event_hosted'a sayıyor (src/lib/etkinlik.ts:478-491, ödeme :512). İkisi ne kodda kapatıldı ne karar listesine yazıldı: docs/assumptions.md:72 tutulanları 'puanOlayi'den geçen her puan' diye sınırlıyor, PROGRESS.md:15 (a)–(f) bunları içermiyor. referral_joined kolu ayrı satırda karar bekliyor (#42 (b)). Davet edenin işaretlenmemesi bilinçli (src/lib/ekonomi.ts:237-239). [İnceleme notu — bulgu değil] Bu çalışma salt okunur yapıldı: test, build, DB sorgusu, gh çağrısı YOK; hesaplar elle. İzin verilen tek `graphify query` çağrısı izlenen graphify-out/cache/last_query_stamp dosyasını değiştirdi (git status'ta M); başka dosyaya dokunulmadı. Kaynak: 23 ham bulgu = güvenlik 6 + motor 6 + suistimal 6 + sql 5; 14 hüküm = 10 doğrulandı + 4 kısmen; 9 bulgu çürütmeye gitmedi.
- **Kilitleyen test:** YOK (açık). Bilinçli 'davetçi işaretsiz kalır' davranışı kilitli: tests/integration/faz5-db.test.ts:267.

## 4. Kural ↔ kod ↔ test haritası

125 kural: güçlü 35, zayıf 35, testsiz 55. "Güçlü" = kural bozulursa test kesin kırılır (entegrasyon satırları yalnız `POSTGRES_URL_TEST` verilince bekçidir). Mutasyon sütunu kod okumasıyla çıkarıldı; hiçbiri koşturulmadı.

### 4.1 · F5-01 · 2. seviye davet — 25 kural (güçlü 10, zayıf 4, testsiz 11)

**1. [YOK] 'İlk' aktivasyon ANINA göre sıralanır: yalnız BU katılımın activated_at'inden KESİN önce (`<`) aktive olmuş başka kurslar sayılır; iki kursta eşzamanlı aktivasyonda hak yanmaz (09fc098 düzeltmesi).**

- Kod: `src/lib/davet.ts:342 (`activated_at < coalesce((select k.activated_at … id = katilimId), now())`)`
- Test: YOK
- Mutasyon: HAYATTA KALIR: satır 342 → `isNotNull(activatedAt)` (09fc098 ÖNCESİ hatalı hâl) yapılırsa faz5-db'nin 5 testi de geçer; `<`→`<=` ve alt sorgunun silinip yalnız `< now()` kalması da hayatta kalır. Neden: hiçbir test, davetlinin DAHA SONRA aktive olmuş başka kursu varken çağırmıyor; yardımcı `davetleAktive` activatedAt'i davetAktivasyonu'ndan SONRA yazıyor (faz5-db:61-62) → üretimdeki dal (alt sorgu dolu) rakip katılımla hiç koşmuyor.
- Not: İncelenmemiş commit'in (09fc098) 2. seviye değişikliği tamamen testsiz. EN KÜÇÜK TEST (faz5-db): yeni davetli c2'yi B'nin koduyla X ve Y kurslarına kat; ÇAĞRIDAN ÖNCE X.activated_at=T, Y.activated_at=T+1sn yaz (egitim.ts sırası); `davetAktivasyonu(katilimX, X, c2)` → a'da [[5,'u:c2']] (eski kodda Y aktif göründüğü için 0 → kırmızı); ardından `davetAktivasyonu(katilimY…)` → hâlâ 1 satır. İNCELEME İPUCU (doğrulanmadı): X ve Y FARKLI davet edenlerden (üst davetçileri A1≠A2) ise ve activated_at aynı ms'ye düşerse / lambda saatleri kayıksa (activated_at uygulama saati egitim.ts:156, yedek DB now()) iki istek de 0 sayar → A1 ve A2'ye ayrı ayrı +5 (idem anahtarı user_id içerir) → 'davetli başına 1' delinir.

**2. [YOK] Aynı kursun katılımı 'önceki aktivasyon' sayılmaz (`course_id <> kurs.id`).**

- Kod: `src/lib/davet.ts:341`
- Test: YOK
- Mutasyon: HAYATTA KALIR (eşdeğer mutant): satır 341 silinse de davranış değişmez — (user, course) unique (schema.ts:674) olduğundan tek aday kendi satırıdır ve satır 342'deki kesin `<` kendi activated_at'ini zaten eler; testte ayrıca activated_at NULL (yardımcı sonra yazıyor).
- Not: Koşul bugün gereksiz; ama 342'de `<`→`<=` yapılırsa tek koruma bu olur. İlk test 'aktivasyon anına göre' satırındaki testtir; ona `<=` mutasyonunu öldürecek eşit-zaman vakası eklenirse bu satır da anlam kazanır. İncelemede: ya koşulu sil ya da neden durduğunu yorumla.

**3. [YOK] İşaretli (flagged_at) davetli: ikinciSeviye `kaynakIsaretli: !!davetli.flaggedAt` geçirir → 2. seviye bekleyene yazılır (welcome ve activated için de aynı bayrak).**

- Kod: `src/lib/davet.ts:352 (ayrıca :284, :293) ; src/lib/rewards.ts:488`
- Test: YOK (faz5-db.test.ts:279-281 puanOlayi'yi doğrudan `kaynakIsaretli: true` ile çağırır — çağıranın bayrağı GEÇİRDİĞİNİ sınamaz)
- Mutasyon: HAYATTA KALIR: davet.ts:352 (ya da :284 / :293) silinirse hiçbir test kırılmaz — işaretli, 24 saatten yaşlı davetlinin aktivasyonu üst davetçiye anında +5 yazar.
- Not: EN KÜÇÜK TEST (faz5-db): 2 günlük davetli aç, `flagged_at = now()` yap ve üye satırını YENİDEN oku (Member.flaggedAt dolu olsun), `davetleAktive(isaretli, ana, b.id)` → `ledger(a,'invite_second_level','u:{id}')` 0 + pending_points(a, invite_second_level, u:{id}) status='pending'; `ledger(b,'course_invite_activated', …)` da 0. egitim.ts:168 ve :106'daki aynı bayrak da testsiz (rota hiç çağrılmıyor).

**4. [YOK] Davet tavanının penceresi KAYAN 7 gündür (TR günü ya da takvim haftası değil).**

- Kod: `src/lib/rewards.ts:57 (`since: yediGunOnce()`), :25-27`
- Test: YOK (tests/unit/etkinlik.test.ts:106 yalnız event_hosted penceresini, kurs-ekonomi.test.ts:59-61 yalnız yediGunOnce farkını sınar)
- Mutasyon: HAYATTA KALIR: rewards.ts:57 `yediGunOnce()`→`gunBaslangici()` yapılırsa davet tavanı günlük 300'e döner; unit faz5-ekonomi:23-25 `since`'e bakmaz, davet-db.test.ts:134-148 tüm satırları aynı dakikada yazar → hiçbiri kırılmaz.
- Not: EN KÜÇÜK TEST (birim, faz5-ekonomi.test.ts:23 yanına): `expect(Math.abs(tavanIcin('invite_second_level')!.since.getTime() - (Date.now() - 7*864e5))).toBeLessThan(5000)`. İsteğe bağlı entegrasyon: created_at'i 8 gün geri çekilmiş 300'lük satır tavana SAYILMAZ, 6 günlük sayılır.

**5. [YOK] 2. seviye yalnız kurs davetinde işler; etkinlik girişi (girisOdulleri) üst davetçiye hiçbir şey yazmaz.**

- Kod: `src/lib/etkinlik.ts:301-345 (ikinciSeviye çağrısı yok) ; src/lib/davet.ts:330 (export edilmemiş, tek çağıran :308)`
- Test: YOK
- Mutasyon: HAYATTA KALIR: girisOdulleri'ne (etkinlik.ts:324 sonrası) `invite_second_level` yazımı eklense hiçbir test kırılmaz — etkinlik-db.test.ts hiç `referrals` kurmuyor (grep: 0 eşleşme).
- Not: PRD prd:112, issue planı :129. EN KÜÇÜK TEST (etkinlik-db 'davetli girişi' testine, :315): referrals {inviter: A, invited: davetEden} ekle → giriş sonrası `pointsLedger` ve `pendingPoints`'te (A, invite_second_level) 0 satır.

**6. [YOK] Davet puanları (2. seviye dahil) yalnız aktivasyonu YAZAN istekte tetiklenir: UPDATE … WHERE activated_at IS NULL RETURNING satır döndürdüyse (`akt`); sonraki öğe tamamlamaları / tekrar gönderim tetiklemez.**

- Kod: `src/pages/api/uye/egitim.ts:147-160, :208`
- Test: YOK (entegrasyon lib'i doğrudan çağırır; e2e tests/e2e/kurs.spec.ts:14-34 DAVETSİZ katılımı tamamlar → davet.ts:273'te erken döner)
- Mutasyon: HAYATTA KALIR: egitim.ts:208 `if (akt)` silinirse puanlar idem'le korunur ama her öğe tamamlamada davet edene 'Haftalık davet puanı tavanın dolu; puan yazılmadı' bildirimi (davet.ts:305) düşer — kırılan test yok. egitim.ts:158 `isNull(activatedAt)` silinirse activated_at her öğede ileri kayar ('ilk aktivasyon' sıralaması bozulur) — kırılan test yok.
- Not: EN KÜÇÜK TEST (yeni tests/integration/egitim-rota-db.test.ts): `vi.mock('@/lib/member.ts')` ile getOrCreateMember'ı test üyesine sabitle; `POST({ request: new Request(url,{method:'POST',body:FormData(action=complete,itemId)}), cookies, redirect, locals })`'u gerçek DB ile 2 öğe için iki kez çağır → davet edenin notifications sayısı 1, activated_at ilk çağrıdan sonra DEĞİŞMEZ, a'da tek 2. seviye satırı. Alternatif: complete dalını lib fonksiyonuna çıkarıp onu sına.

**7. [YOK] Çağrı sırası: önce activated_at yazılır, sonra üretici puanı / course_launched, sonra davetAktivasyonu (welcome → activated → bildirim → ikinciSeviye). ikinciSeviye activated_at'i DB'den okur; birincil davet puanı 0 (tavan/bekleyen) olsa da çağrılır.**

- Kod: `src/pages/api/uye/egitim.ts:154-160 → :161-205 → :208 ; src/lib/davet.ts:278, :287, :296, :308`
- Test: YOK
- Mutasyon: HAYATTA KALIR: egitim.ts:208 satırı 154'ün ÖNÜNE taşınırsa (aktivasyon yazılmadan davet ödülü; `akt` yerine `ins`) hiçbir test kırılmaz. Test yardımcısı zaten TERS sırada: faz5-db.test.ts:61 davetAktivasyonu, :62 activatedAt — yorumu ('egitim.ts complete sırası', :54) yanlış.
- Not: İLK İŞ: `davetleAktive` yardımcısında :61 ile :62'yi yer değiştir (önce activated_at, sonra davetAktivasyonu) → mevcut 5 test üretim sırasını ve alt sorgunun dolu dalını koşar; F vakasındaki saat varsayımı da kalkar. Sonra rota testi (önceki satır). Ayrıca: davet.ts:296'daki bildirim insert'i hata verirse ikinciSeviye hiç koşmaz (hak sessizce kaybolur; aktivasyon tekrar yazılmayacağı için telafi yok) — doğrulanmadı: kabul edilen risk mi.

**8. [YOK] Davet süresi: katılımdan 14 günden fazla sonra gelen aktivasyonda hiçbir davet puanı yazılmaz — 2. seviye dahil (erken dönüş ikinciSeviye'den önce).**

- Kod: `src/lib/davet.ts:273, :59-61 ; src/lib/points.ts:83`
- Test: YOK (davet-db.test.ts:120-132 AC-8 bekleyenin expires_at ile düşmesini sınar; davetAktivasyonu'nu süre dolduktan sonra ÇAĞIRMAZ; davetSuresiDoldu tests/unit/davet.test.ts:4 import listesinde yok)
- Mutasyon: HAYATTA KALIR: davet.ts:273'te `|| davetSuresiDoldu(katilim)` silinirse ya da :60'ta `>`→`>=` / `864e5`→`3600e3` yapılırsa hiçbir test kırılmaz; 15. günde aktive olan davetli üst davetçiye +5, davet edene +15 yazdırır.
- Not: EN KÜÇÜK TESTLER: (birim) `davetSuresiDoldu({joinedAt: new Date(T-14*864e5)}, T)` false, 1 ms sonrası true; (entegrasyon) katilim.joinedAt'i 15 gün geri çek → davetAktivasyonu → b ve a ledger + bekleyen boş. Not: süre dolduğunda davetlinin 'ilk aktivasyon' hakkı da yanar (sonraki davetli kursunda 2. seviye yok) — PRD'de açık değil, doğrulanmadı.

**9. [YOK] 2. seviye bildirimi: yalnız ledger'a gerçekten yazıldıysa (n > 0) üst davetçiye gider; metin '… +{n} puan (2. seviye davet)', bağlantı kurs sayfası. Bekleyen / tavan / idem durumunda bildirim YOK.**

- Kod: `src/lib/davet.ts:355-360`
- Test: YOK (hiçbir test notifications gövdesini okumaz; yalnız temizlikte silinir — faz5-db.test.ts:112)
- Mutasyon: HAYATTA KALIR: davet.ts:355 `if (n > 0)` silinirse (genç/işaretli/idem'de '+0 puan (2. seviye davet)' bildirimi) ya da metin / alıcı (`ust.inviterId`→`davetEdenId`) değişirse hiçbir test kırılmaz.
- Not: EN KÜÇÜK TEST (faz5-db AC-10 testinin sonuna): `notifications where userId = a.id` → tam 1 satır, body `+5 puan (2. seviye davet)` ve davetlinin adını içerir; yeniden çağrıdan (:130) sonra hâlâ 1. Genç davetli testine: a'ya yeni bildirim yok. Kesinleşme anında (bekleyeniKesinlestir) hiç bildirim yok — üst davetçi bekleyen 2. seviyeyi yalnız panoda görür; doğrulanmadı: bilinçli mi.

**10. [YOK] Davet edene aktivasyon bildirimi 4 dallıdır: n>0 → '+{n} puan' (n<15 ise '(haftalık davet tavanına kırpıldı)'); n=0 ve davetli genç → '24 saatlik olunca kesinleşir'; n=0 ve bekleyen satır duruyor → 'Puan bekleyende; kesinleşince yazılır' (neden söylenmez); aksi → 'tavanın dolu; puan yazılmadı'.**

- Kod: `src/lib/davet.ts:296-307`
- Test: YOK
- Mutasyon: HAYATTA KALIR: dalların sırası değişse, `n < PUAN.inviteActivated` eki silinse ya da :302 hep false dönse (işaretli tutmada yeniden 'tavan dolu' denir — 09fc098'in düzelttiği hata) hiçbir test kırılmaz.
- Not: EN KÜÇÜK TEST (tek it, 4 davetli): (a) normal → body '+15 puan'; (b) genç → '24 saatlik'; (c) yaşlı + işaretli davetli → 'bekleyende' VE 'tavan' içermez; (d) davet edenin tavanı önceden 300 → 'tavanın dolu'. İNCELEME İPUCU: genç + işaretli davetlide dal sırası (:300 hesapGencMi önce) '24 saatlik olunca kesinleşir' der ama işaret kalkana dek kesinleşmez — yanıltıcı metin; doğrulanmadı: 'neden söylenmez' ilkesiyle bilinçli olabilir.

**11. [YOK] bekliyorMu: (alıcı, reason, refId) için status='pending' bekleyen satır varsa true — puanOlayi 0 döndüğünde 'tutuluyor' ile 'tavana takıldı'yı ayırır.**

- Kod: `src/lib/davet.ts:312-323 (çağrı :302)`
- Test: YOK
- Mutasyon: HAYATTA KALIR: davet.ts:318 `eq(status, 'pending')` silinirse tavan-dolu durumunda (puanOlayi kursaKatil'in bekleyenini yazilan=0 ile 'confirmed' kapatır, rewards.ts:513-527) satır yine bulunur → yanlışlıkla 'Puan bekleyende' denir; kırılan test yok. reason / refId koşulları silinse de aynı.
- Not: Önceki satırdaki testin (c) ve (d) vakaları bu fonksiyonun iki sonucunu da öldürür — ayrı test gerekmez. Fonksiyon modül-özel (export yok): yalnız davetAktivasyonu üzerinden sınanabilir. KONTROL EDİLMEYENLER: testler / DB sorguları çalıştırılmadı; 'canlı veride aktive katılım var' ve saat kayması yarışı gibi çalışma zamanı iddiaları 'doğrulanmadı' olarak işaretlendi; F5-02/03/04'ün kendi kuralları bu haritanın dışında.

**12. [ZAYIF] İşaretli KAYNAĞIN bekleyeni olgunlaşsa da kesinleşmez; kaynak refId sonundaki `u:{id}`'den çıkarılır ve 2. seviyenin ÇIPLAK `u:{id}` biçimi de (`^` kolu) tanınır.**

- Kod: `src/lib/rewards.ts:93-94 (regex `(?:^\|:)u:([0-9]{1,9})$`), :549 ; kopyası src/lib/ekonomi.ts:278`
- Test: tests/integration/faz5-db.test.ts:276, :280, :287-297 (yalnız `course:X:u:Y` biçimi)
- Mutasyon: HAYATTA KALIR: rewards.ts:94'te `(?:^|:)u:`→`:u:` yapılırsa `u:123` refId'li 2. seviye bekleyeni işaretli davetliye rağmen olgunlaşır; hiçbir test kırılmaz (faz5-db:176-178 işaretsiz yolda aynı sonucu verir; :287-297 `course:…:u:` biçimini kullanır).
- Not: EN KÜÇÜK TEST: önceki satırdaki testin devamı — `bekleyenleriIsle(now+25s, a.id)` → `kesinlesen: 0`, ledger boş; `flagged_at = null` → tekrar işle → ledger [5]. Aynı test ekonomi.ts:278 `tutulan` toplamının çıplak biçimi saydığını da (isaretliHesaplar) sınayabilir. Regex iki yerde kopya: biri değişirse diğeri sessizce ayrışır.

**13. [ZAYIF] Tavan 2. seviyeye SQL'de uygulanır: kalan < 5 ise kırpılır, tavan doluysa hiç yazılmaz (ve bildirim gitmez); kırpmanın gerekçesi panoda görünmelidir (PRD §4.2).**

- Kod: `src/lib/rewards.ts:336-358 ; src/lib/davet.ts:346-355`
- Test: tests/integration/davet-db.test.ts:134-148 (tavan SQL'i yalnız course_invite_activated / referral_joined ile)
- Mutasyon: HAYATTA KALIR: ikinciSeviye puanOlayi yerine tavansız yazsa (ör. awardPoints'e geniş `tavan` verilse) faz5-db:133 yine 5 görür; 2. seviyenin havuza SAYILDIĞI ya da kırpıldığı hiçbir uçtan uca testte yok. (Yapılandırma mutasyonları önceki satırdaki birim testine takılır.)
- Not: EN KÜÇÜK TEST (faz5-db): a'ya son 7 gün içinde 298 puanlık `referral_joined` satırı ekle → yeni davetliyle davetleAktive → `ledger(a,'invite_second_level')` son delta 2; 300 doluyken → 0 satır ve a'ya 2. seviye bildirimi yok. GEREKSİNİM FARKI (doğrulanmadı: bilinçli mi): ikinciSeviye önce bekleyen satır AÇMAZ (davetBitirme davet.ts:370-377 açar) → anında yolda tavana takılan 2. seviye panodaki 'kırpıldı' listesinde (uye/index.astro:97-103, pending_points confirmed & yazilan<delta) hiç görünmez; yalnız genç-davetli yolunda görünür.

**14. [ZAYIF] Atıfsız katılım ya da kendi koduyla katılım: davetAktivasyonu erken döner (`!inviteCodeId`, `!kod`, `kod.inviterId === davetli.id`) → 2. seviye yok.**

- Kod: `src/lib/davet.ts:273, :277 (asıl kapı kursaKatil :234)`
- Test: tests/integration/davet-db.test.ts:105-118 (yalnız kursaKatil'in atıf yazmadığını sınar)
- Mutasyon: HAYATTA KALIR: davet.ts:277'de `|| kod.inviterId === davetli.id` silinirse hiçbir test kırılmaz (kursaKatil :234 atfı zaten yazmadığı için dal testte ulaşılmaz — savunma kodu). `!katilim.inviteCodeId` silinirse findFirst boş döner, `!kod` yakalar (eşdeğer).
- Not: EN KÜÇÜK TEST: course_enrollments'a doğrudan `inviteCodeId = davetlinin KENDİ kodu` olan satır yaz (kapıyı atla) → davetAktivasyonu → davetli ve üst davetçide 0 satır. Düşük öncelik (çift kapı).

**15. [ZAYIF] Geriye dönük dağıtım yok: tetik yalnız aktivasyonu yazan istek (davetAktivasyonu ← egitim.ts:208); cron, bekleyen işleme, onarım ya da betik ikinciSeviye'yi çağırmaz; tarih sabiti yok.**

- Kod: `src/lib/davet.ts:308 (tek çağıran) ; src/pages/api/uye/egitim.ts:208 (tek çağıran) ; src/pages/api/cron/gunluk.ts:195 (yalnız bekleyenleriIsle)`
- Test: tests/integration/faz5-db.test.ts:173-175
- Mutasyon: HAYATTA KALIR: cron'a ya da başka bir uca `davetAktivasyonu` / geriye dönük tarama eklense hiçbir test kırılmaz. Mevcut beklenti (:174-175 'bekleyenleriIsle yeni satır açmaz') hiçbir makul mutasyonda kırılmaz — hep geçer.
- Not: Kural YAPIYLA sağlanıyor (varsayım #61, CLAUDE.md 'başka bir yoldan çağırma'); bekçisi yok. EN KÜÇÜK TEST (birim, tests/unit/istek-freni.test.ts deseni — kaynak dosya taraması): `davetAktivasyonu(` yalnız src/pages/api/uye/egitim.ts'te, `ikinciSeviye(` yalnız src/lib/davet.ts'te, `invite_second_level` literal'i yalnız davet.ts / rewards.ts / schema.ts'te geçsin. scripts/seed-demo.ts:497-498 yalnız referrals satırı ekler, ledger yazmaz (okundu).

**16. [güçlü] 2. seviye davet puanı +5'tir (PUAN.inviteSecondLevel) ve ikinciSeviye bu sabiti yazar.**

- Kod: `src/lib/points.ts:90 ; src/lib/davet.ts:348`
- Test: tests/unit/faz5-ekonomi.test.ts:21 (sabit) ; tests/integration/faz5-db.test.ts:132-133 (ledger delta 5)
- Mutasyon: points.ts:90 `5`→`10` → unit faz5-ekonomi:21 kırmızı (faz5-db:133, :171, :178 de). davet.ts:348 `PUAN.inviteSecondLevel`→`PUAN.inviteActivated` → YALNIZ faz5-db:133 kırmızı; birim testi kırılmaz.
- Not: GENEL: tests/integration/* `describe.skipIf(!POSTGRES_URL_TEST)` (faz5-db.test.ts:15; vitest.config include'da ama env yoksa atlanır) → `npm run qa` (package.json:20) entegrasyonu KOŞMAZ. Aşağıda 'guclu' denen entegrasyon satırları yalnız env verilince bekçidir. Bu haritada hiçbir test çalıştırılmadı (salt okunur); mutasyon sonuçları kod okumasıyla çıkarıldı.

**17. [güçlü] Satır üst davetçiye (ust.inviterId), reason `invite_second_level`, refId `u:{davetli.id}` ile yazılır (kurs id'si refId'de YOK).**

- Kod: `src/lib/davet.ts:346-350`
- Test: tests/integration/faz5-db.test.ts:132-133
- Mutasyon: davet.ts:350 refId → `course:${kurs.id}:u:${davetli.id}` → faz5-db:133 kırmızı. davet.ts:347 `ust.inviterId`→`davetEdenId` → :133 kırmızı (a'nın ledger'ı boş kalır).
- Not: ADR tablosu docs/adr/0001-kurs-davet-etkinlik-harita.md:283 ile birebir. Birim testi refId biçimini sınamaz (yalnız entegrasyon).

**18. [güçlü] Üst davetçi = davet EDENİN `referrals` kaydındaki davetçisi (invited_id = davet eden); kayıt yoksa 2. seviye yazılmaz. referrals.status (joined/activated) filtrelenmez.**

- Kod: `src/lib/davet.ts:331-332 (`!ust`) ; şema src/db/schema.ts:291-296 (invited_id unique)`
- Test: tests/integration/faz5-db.test.ts:119-134 (pozitif; b→c satırı yanlış aramayı ayırt eder) ; tests/integration/davet-db.test.ts:96 (üst davetçisiz yol — yalnız çökmeme)
- Mutasyon: davet.ts:331 `invitedId, davetEdenId`→`invitedId, davetli.id` → ust = b→c, puan b'ye gider → faz5-db:133 kırmızı. `!ust ||` silinirse davet-db:96'da TypeError → kırmızı. ANCAK 'üst davetçi yoksa hiçbir invite_second_level satırı / bekleyeni oluşmaz' açık beklentisi yok.
- Not: Zayıf nokta: status filtresi olmadığı hiçbir testte sabitlenmemiş (PRD §4.3 docs/prd/kurs-topluluk-ekosistemi.md:156 'mevcut referrals kaydı' der — filtre yok doğru görünüyor; doğrulanmadı: 'joined' ama hiç aktive olmamış platform davetinin sayılması bilinçli mi). En küçük ek test: davet-db AC-5 sonuna `pointsLedger/pendingPoints where reason='invite_second_level' and refId=u:{davetli}` → 0 satır.

**19. [güçlü] Kendine puan yok: üst davetçi davetlinin kendisiyse (davetli, kendi getirdiği üyenin davetiyle katılıyorsa) 2. seviye yazılmaz.**

- Kod: `src/lib/davet.ts:332 (`ust.inviterId === davetli.id`)`
- Test: tests/integration/faz5-db.test.ts:156-162
- Mutasyon: davet.ts:332'de `|| ust.inviterId === davetli.id` silinirse y'ye (u:{y}) satır yazılır → faz5-db:161 kırmızı.
- Not: Test yalnız ledger'a bakar; y 2 günlük (genç değil) olduğu için bekleyene kaçma ihtimali yok — yeterli. Bekleyen tablosu için de `toBe(0)` eklemek ucuz.

**20. [güçlü] Tek sıçrama: 3. seviye yok — yalnız davet edenin doğrudan platform davetçisi alır (ikinciSeviye tek referrals sorgusu, özyineleme yok).**

- Kod: `src/lib/davet.ts:330-332 (yapısal)`
- Test: tests/integration/faz5-db.test.ts:136-142
- Mutasyon: ikinciSeviye'ye ikinci sıçrama eklenirse (ust'ün davetçisine de yaz) D'nin aktivasyonunda a'ya u:{d} satırı düşer → faz5-db:141 (`length 1`) kırmızı. Mevcut satırlarda tek satır mutasyonuyla 3. seviye üretilemez.
- Not: AC-10 (docs/prd/kurs-topluluk-ekosistemi.md:240) karşılanıyor. :141 yalnız ledger sayar; a'ya bekleyen (pending) açılmadığı sınanmıyor (d 2 günlük olduğundan pratikte fark yok).

**21. [güçlü] Davetli başına 1: aynı (üst davetçi, u:{davetli}) ikinci kez yazılmaz (ledger idem index + ON CONFLICT DO NOTHING); davetAktivasyonu yeniden çağrılsa da tek satır.**

- Kod: `src/lib/davet.ts:350 ; src/lib/rewards.ts:342-357 ; src/db/schema.ts:119-121`
- Test: tests/integration/faz5-db.test.ts:130-133, :147
- Mutasyon: refId'ye kurs eklenirse (satır 350) :133 kırmızı. rewards.ts:354 `on conflict do nothing` silinirse ikinci çağrı unique ihlaliyle patlar → :130 kırmızı.
- Not: Tekillik (ÜST DAVETÇİ, davetli) çifti başınadır, davetli başına global değil: aynı davetli iki FARKLI üst davetçiye satır üretebilir mi → bkz. 'aktivasyon anına göre' satırı (dar yarış, doğrulanmadı). PRD 'davetli başına bir kez' (prd:46) der.

**22. [güçlü] Yalnız davetlinin İLK kurs aktivasyonunda: davetlinin bu katılımdan önce aktive olmuş başka kursu varsa (count > 0) 2. seviye yazılmaz (davet eden +15'ini yine alır).**

- Kod: `src/lib/davet.ts:335-345`
- Test: tests/integration/faz5-db.test.ts:144-154
- Mutasyon: davet.ts:345 silinirse: C'nin ikinci kursu idem'le zaten yutulur (:147 GEÇER) ama F için a'ya u:{f} yazılır → :153 kırmızı. `> 0`→`> 1` → :153 kırmızı. davet.ts:340 `eq(userId, davetli.id)` silinirse başka üyelerin aktivasyonları sayılır → :133 kırmızı (doğrulanmadı: canlı veride aktive katılım bulunmasına bağlı).
- Not: Bekçi yalnız F vakası (:149-153); C vakası (:145-147) bu kuralı SINAMAZ (idem yeter). F vakası istemci saati ≤ DB saati varsayar: f.k2.activatedAt = JS `new Date()` (:150), karşılaştırma DB `now()` (yardımcı activatedAt'i sonra yazdığı için coalesce yedeği) → yerel saat ilerideyse yalancı kırmızı. Varsayım #61 (docs/assumptions.md:68).

**23. [güçlü] Genç davetli (hesap < 24 s): 2. seviye ledger'a DEĞİL bekleyene (matures_at = davetlinin açılışı + 24 s) yazılır; olgunlaşınca bir kez kesinleşir. Yaş ölçütü DAVETLİnin yaşıdır.**

- Kod: `src/lib/davet.ts:351 ; src/lib/rewards.ts:488-505, :536-552`
- Test: tests/integration/faz5-db.test.ts:164-179
- Mutasyon: davet.ts:351 `davetli.createdAt`→`new Date(0)` → doğrudan ledger'a yazılır → faz5-db:167 kırmızı. rewards.ts:488'de `hesapGencMi(...)` silinirse :167 kırmızı. rewards.ts:498 `maturesAt: olgun` silinirse :172 kırmızı.
- Not: PRD tablosu 'Anında' der (prd:99); bekleyene yazım bilinçli fark (varsayım #61). Test bekleyenin `note` metnini (davet.ts:353) ve a'ya bildirim GİTMEDİĞİNİ sınamıyor.

**24. [güçlü] ALICI (üst davetçi) işaretliyse puan, kaynak temiz ve yaşlı olsa da bekleyene yazılır.**

- Kod: `src/lib/rewards.ts:484-488`
- Test: tests/integration/faz5-db.test.ts:282-286, :288
- Mutasyon: rewards.ts:488'de `alici?.flaggedAt ||` silinirse puanOlayi 7 döner → faz5-db:285 (`toBe(0)`) ve :286 kırmızı.
- Not: puanOlayi düzeyinde sınanır (reason answer_accepted); 2. seviyeye özgü uçtan uca vaka yok ama kod yolu ortak. Yan etki: alıcı işaretliyken bekleyen satır `expiresAt: null` yapılır (rewards.ts:502) — 14 günlük düşme süresi kalkar; doğrulanmadı: bilinçli mi.

**25. [güçlü] `invite_second_level` davet tavanına girer: tavanIcin davet havuzunu (DAVET_REASONLARI, limit 300) döndürür ve reason DAVET_REASONLARI / DAVET_KAYNAKLI listelerindedir.**

- Kod: `src/lib/rewards.ts:55-57, :75-82, :85 ; src/lib/points.ts:81`
- Test: tests/unit/faz5-ekonomi.test.ts:20-26
- Mutasyon: rewards.ts:55 `case` silinirse → unit :24 kırmızı. rewards.ts:80 listeden silinirse → unit :22 kırmızı. points.ts:81 `300`→`500`: unit KIRILMAZ (sabitle karşılaştırıyor), yalnız davet-db.test.ts:144 (`toBe(300)`, entegrasyon) kırılır.
- Not: Yan tüketiciler testsiz: pano 'Davetlerim' kazanç/bekleyen toplamı artık 2. seviyeyi de sayar (src/pages/uye/index.astro:134, :182, :190) ve ekonomi kartı davet payı (ekonomi.ts:152, DAVET_KAYNAKLI) — faz5-db:359 `>= 20` canlı veride hep geçebilir. DAVET_KAYNAKLI'dan 2. seviye çıkarılsa kırılan test yok. En küçük: unit'e `expect(DAVET_KAYNAKLI).toContain('invite_second_level')`.

### 4.2 · F5-02 · Canlılık havuzu — 25 kural (güçlü 9, zayıf 7, testsiz 9)

**1. [YOK] Havuz yalnız yayındaki (status = 'published') kurslar için hesaplanır.**

- Kod: `src/lib/ekonomi.ts:71-72`
- Test: YOK
- Mutasyon: ekonomi.ts:72 `c.status = 'published'` silinirse HAYATTA KALIR: tek entegrasyon testi (faz5-db.test.ts:187) yalnız yayınlı tek kursla ve kursIdleri filtresiyle koşuyor.
- Not: draft / pending / rejected / hidden kurs (schema.ts:605-607) havuz almamalı (PRD 'yayındaki her kurs'; varsayım #66). En küçük test: aynı hareketliliğe sahip ikinci kursu `status: 'hidden'` (ve 'pending') aç, `canlilikHavuzuDagit(hafta, [id])` → `{kurs:0, puan:0}`, üreticide vitality_pool satırı yok. Durum KOŞUM anında okunur (hafta içinde yayındaydı, pazartesiden önce gizlendi → ödenmez): istenen bu mu, karara bağlanmalı.

**2. [YOK] Birden çok canlı kurs aynı koşumda dağıtılırken katkı ve davet ağırlıkları kurs bazında ayrılır (bir kursun beğenisi / davetlisi başka kursun payını etkilemez).**

- Kod: `src/lib/ekonomi.ts:38-40,85-117`
- Test: YOK
- Mutasyon: ekonomi.ts:111 `.filter((r) => r.course_id === kursId)` silinirse HAYATTA KALIR (testte tek kurs var; tüm ağırlık satırları zaten o kursun). Üretimde kullanılan kursIdleri'siz dal (:38-40, boş `yalniz`) hiçbir testte koşmuyor.
- Not: Cron tüm yayınlı kursları tek seferde dağıtır (gunluk.ts:218 ikinci argümansız). En küçük test: aynı haftada iki test kursu (üretici aynı kişi; k1'de katkıcı X, k2'de katkıcı Y), `canlilikHavuzuDagit(hafta, [k1.id, k2.id])` → `{kurs: 2}`; X yalnız `course:{k1}:…`, Y yalnız `course:{k2}:…` satırı alır; üretici iki ayrı refId'li iki satır alır. Aynı teste kişi başı 200 tavanının döngü içinden kırpması da eklenebilir.

**3. [YOK] Tamamlama sayımına işaretli hesabın tamamlaması ve asgari süreden (öğe sayısı × 60 sn, katılımdan itibaren) kısa tamamlama girmez.**

- Kod: `src/lib/ekonomi.ts:56-60`
- Test: YOK (yalnız pozitif vaka faz5-db.test.ts:196; saf eşlenik asgariSureGectiMi tests/unit/kurs-ekonomi.test.ts:27 bu SQL'i sınamaz)
- Mutasyon: ekonomi.ts:57 `u.flagged_at is null` silinirse HAYATTA KALIR (işaretli test hesabının completedAt'i yok, faz5-db.test.ts:222). ekonomi.ts:59-60 asgari süre koşulu silinirse ya da `>=`→`>` / 60→1 yapılırsa HAYATTA KALIR (tek tamamlayan 3 gün sonra bitirmiş: joinedAt an(-1), completedAt an(2)).
- Not: Tamamlama V'nin en ağır kalemi (×3). En küçük test: tabanı yuvarlamaya duyarlı ayrı kurs (10 ilerleyen → V 10 → havuz 36; +0,5 bile 37 yapar) üzerine (a) işaretli hesaba hafta içi completedAt, (b) joinedAt = an(2), completedAt = an(2) + 119 sn (2 öğe) ekle → 36 kalmalı; (c) sınır: tam 120 sn sayılır (V 13 → 40). Öğe sayısı koşum anındaki sayıdır (sonradan öğe eklenirse geçmiş tamamlama elenebilir) — doğrulanmadı.

**4. [YOK] Gizlenmiş (hidden_at dolu) yorum V'ye ve katkıcı ağırlığına sayılmaz.**

- Kod: `src/lib/ekonomi.ts:65,93`
- Test: YOK
- Mutasyon: ekonomi.ts:65 ya da :93'te `y.hidden_at is null` silinirse HAYATTA KALIR (testte gizlenmiş yorum yok).
- Not: Şikâyetle gizlenen yorum havuza ve yazarına pay taşımamalı. En küçük test: beğeni almış, hiddenAt dolu yorum ekle → yazarında vitality_pool satırı yok; V = 10 tabanlı kursta havuz 36. Gizlilik koşum anında okunur (hafta içinde beğenilip sonradan gizlenen sayılmaz).

**5. [YOK] Davet diliminde yalnız O HAFTA ilerleme kaydeden davetliler ağırlık taşır; kendi koduyla katılım sayılmaz.**

- Kod: `src/lib/ekonomi.ts:102-105`
- Test: YOK
- Mutasyon: ekonomi.ts:103-105 `exists (… course_progress o hafta …)` silinirse HAYATTA KALIR (iki davetlinin de o hafta ilerlemesi var). :102 `d.inviter_id <> k.user_id` silinirse HAYATTA KALIR (kendi koduyla katılım satırı yok).
- Not: PRD: '%20 o hafta AKTİF olan davetlilerin davet edenleri' (prd:120). exists kalkarsa geçmişte davetle katılmış ama o hafta hiçbir şey yapmamış herkes ağırlık olur. En küçük test: davetçinin koduyla katılmış, ilerlemesi yalnız ÖNCEKİ haftada olan (ya da hiç olmayan) ikinci bir davetli ekle → davetçi yine 3 almalı (sayılırsa 4). Kendi kodu: kursaKatil kodu zaten boşaltır (davet.ts:234) → SQL koşulu savunma; testi isteğe bağlı.

**6. [YOK] İşaretli alıcının havuz payı ledger'a değil bekleyene yazılır (işaret kalkana dek olgunlaşmaz); bildirim yalnız gerçekten yazılan pay > 0 ise ve bir kez gönderilir.**

- Kod: `src/lib/ekonomi.ts:118-136 · src/lib/rewards.ts:484-505`
- Test: YOK (alıcı işareti başka reason ile genel puanOlayi'de: faz5-db.test.ts:283-286; havuz yolunda yok)
- Mutasyon: ekonomi.ts:120 `puanOlayi` → `awardPoints` (09fc098 öncesi hâl) HAYATTA KALIR: havuz testindeki üç alıcının (üretici, davetçi, katkıcı) hiçbiri işaretli değil. ekonomi.ts:130-135 bildirim insert'i silinirse ya da :128 `if (n <= 0) continue` kaldırılıp her koşumda bildirim atılırsa HAYATTA KALIR (bildirim hiç okunmuyor; afterAll yalnız siliyor).
- Not: En küçük test: havuz testinde davetçiyi (ya da ikinci bir katkıcıyı) dağıtımdan önce işaretle → ledger'da vitality_pool yok; pending_points'te reason vitality_pool, refId `course:{id}:{hafta}`, delta = pay, status pending; dönen `puan` o pay kadar eksik; işareti kaldır + bekleyenleriIsle → tek ledger satırı. Bildirim: ilk koşumdan sonra alıcı başına 1 `kind='course'` satırı, ikinci koşumdan sonra hâlâ 1. Notlar: matures_at = 1970-01-02 (ekonomi.ts:125) → pano 'inceleniyor' gösterir (src/pages/uye/index.astro:123-125). İşaret kalkınca kesinleşmede tavan penceresi KESİNLEŞME haftasıdır (birkaç haftanın tutulan payı aynı hafta 200'e kırpılabilir) — doğrulanmadı.

**7. [YOK] Cron, CANLILIK_ILK_HAFTA ('2026-W42') öncesindeki haftalar için havuz dağıtmaz.**

- Kod: `src/pages/api/cron/gunluk.ts:216-217 · src/lib/points.ts:107-108`
- Test: YOK
- Mutasyon: gunluk.ts:217 `if (hafta.etiket >= CANLILIK_ILK_HAFTA)` silinirse (ya da `>=` → `>`, ya da points.ts:108 '2026-W42' → '2026-W40') HAYATTA KALIR: hiçbir test cron ucunu çağırmıyor ve CANLILIK_ILK_HAFTA hiçbir testte geçmiyor.
- Not: Kapı kalkarsa merge günü ilk cron açılıştan önceki W41'i öder. Sabit takvime bağlı ve dal merge edilmedi: merge 26 Ekim'den sonra olursa ilk koşum, özelliğin canlıda OLMADIĞI son haftayı öder ('açılıştan önceki haftalar ödenmez' ihlali) → merge anında sabit güncellenmeli. En küçük test (DB'siz unit; vi.mock + vi.setSystemTime): gunluk.ts'in içe aktardığı db / cron / ekonomi / etkinlik / league / rewards modüllerini taklit edip GET'i x-cron-secret ile çağır: 2026-10-12T06:00+03:00 → canlilikHavuzuDagit ÇAĞRILMAZ; 2026-10-19T06:00+03:00 → birKezCalistir('canlilik-havuzu', '2026-W42') ve canlilikHavuzuDagit(hafta) ikinci argümansız; 2027-01-04 → '2026-W53'; 2027-01-11 → '2027-W01'; sırsız istek 401. Gerçek DB'yle GET ÇAĞIRMA: diğer adımlar canlı veride koşar.

**8. [YOK] Havuz her hafta için en fazla bir kez dağıtılır: cron_runs kilidi (job 'canlilik-havuzu', periodKey = hafta etiketi); iş hata fırlatırsa kilit geri verilir.**

- Kod: `src/pages/api/cron/gunluk.ts:218-219 · src/lib/cron.ts:9-37`
- Test: YOK (faz5-db.test.ts:232-233 lib'i iki kez çağırır: kilidi değil ledger idem'ini sınar; birKezCalistir'in tutması yalnız etkinlik işiyle etkinlik-db.test.ts:585-586'da, 'patlarsa geri ver' dalı hiçbir testte yok)
- Mutasyon: gunluk.ts:218 `birKezCalistir('canlilik-havuzu', hafta.etiket, …)` yerine doğrudan `canlilikHavuzuDagit(hafta)`: HAYATTA KALIR. cron.ts:31-36 catch bloğu (kilidi sil) kaldırılırsa HAYATTA KALIR.
- Not: Kilitsiz hâlde her gün yeniden hesaplanır: sonradan işareti kalkan / yeni yayınlanan kurs için ek satırlar yazılır, dağıtılan toplam havuzu aşar. ŞÜPHE: kilit işten ÖNCE alınıp yalnız fırlatılan hatada geri veriliyor; fonksiyon süre sınırında öldürülürse (alıcı başına ~8 sıralı HTTP sorgusu; astro.config.mjs:38-47'de maxDuration yok — Vercel sınırı doğrulanmadı) catch koşmaz, kilit tüketilmiş kalır ve kalan alıcılar o hafta HİÇ ödenmez. En küçük test: (a) entegrasyonda atılabilir iş adıyla `birKezCalistir('itest-kilit', t, fn)` → iki çağrıda fn bir kez; fırlatan fn'den sonra üçüncü çağrı yeniden koşar; cron_runs temizlenir. TUZAK: testte GERÇEK 'canlilik-havuzu' anahtarını KULLANMA (dev = canlı DB: gerçek haftanın kilidi tükenir, üyeler ödenmez). (b) satır 23'teki taklitli GET testinde birKezCalistir undefined dönünce rapor.canlilikHavuzu yok.

**9. [YOK] Telafi: cron bir gün atlanırsa aynı hafta içindeki sonraki koşum son tamamlanan haftayı öder; geriye doğru yalnız BİR hafta bakılır (birden fazla hafta atlanırsa eskiler ödenmez).**

- Kod: `src/pages/api/cron/gunluk.ts:158-220 (özellikle :214-216) · src/lib/economy.ts:247-249 · vercel.json (0 3 * * *)`
- Test: YOK (saf sonTamamlananHafta yalnız pazartesi sabahı / pazar gecesi: tests/unit/faz5-ekonomi.test.ts:110-113)
- Mutasyon: Davranış sabitlenmemiş: gunluk.ts:216'ya 'yalnız pazartesi koş' şartı eklenip telafi tümden kaldırılsa ya da kilitsiz eski haftaları geri dolduran bir döngü eklense hiçbir test kırılmaz → HAYATTA KALIR.
- Not: KODUN BUGÜNKÜ DAVRANIŞI: yalnız SON tamamlanan hafta denenir; atlanan gün Pzt–Paz 06:00 TR koşumlarında telafi edilir. Cron TAM BİR HAFTA (7 koşum) başarısız olursa o haftanın havuzu KALICI kaybolur — geri doldurma, uyarı, rapor alanı yok; N hafta atlanırsa yalnız sonuncusu ödenir. Gerçekçi tetikleyiciler: (1) 8. adım EN SONDA ve önceki adımlar try/catch'siz (gunluk.ts:164-206): suistimalTara, sezon kapanışı, özel lig ya da bekleyenleriIsle her gün patlarsa havuza sıra gelmez; (2) CRON_SECRET uyumsuzluğu (her gün 401, :155-156); (3) merge gecikmesi. Havuz kendi içinde yarıda patlarsa kilit geri verilir, ertesi gün ödenmemişler tamamlanır (idem); pazar da patlarsa kalanlar kaybolur. Geç telafide V koşum anındaki işaret / gizlilik / yayın durumuyla hesaplanır. En küçük test: (a) unit — sonTamamlananHafta('2026-10-25T23:59:59+03:00') = W42, ('2026-10-26T00:00:00+03:00') = W43 (telafi penceresinin ucu); (b) satır 23'teki taklitli GET testinde suistimalTara fırlatınca canlilikHavuzuDagit'in çağrılmadığını göster — önce beklenen davranış (adım yalıtımı mı, bilinçli mi) karara bağlanmalı; (c) çok hafta atlamada beklenen (kayıp mı, geri doldurma mı) Yusuf kararı: varsayım #62 (docs/assumptions.md:69) yalnız 'ertesi gün telafi' der.

**10. [ZAYIF] Kurs başına haftalık havuz en fazla 100'dür (HAVUZ_TAVAN).**

- Kod: `src/lib/economy.ts:178-181`
- Test: tests/unit/faz5-ekonomi.test.ts:56-57
- Mutasyon: `Math.min(HAVUZ_TAVAN, …)` kaldırılırsa havuz(1000) 104 olur → :56 kırılır. AMA sabit 100 → 90 yapılırsa HAYATTA KALIR: beklenti sabitin kendisi (`[1000, HAVUZ_TAVAN]`), havuz(100)=69 tavanın altında, oran testi (:60-62) 90/36=2,5 < 3 geçer; entegrasyon 38'de kalır.
- Not: PRD 'kurs başına haftada en fazla 100' (prd:105, :119). En küçük test (unit): `expect(HAVUZ_TAVAN).toBe(100)` + `expect(havuz(1000)).toBe(100)` literal. HAVUZ_ESIK için aynı sorun yok (36 beklentisi eşiği 10'a sabitliyor).

**11. [ZAYIF] Payı 0 çıkan kişi, 0 ağırlıklı hak sahibi ve toplamı 0 olan havuz sonuca girmez (0 puanlık satır yazılmaz).**

- Kod: `src/lib/economy.ts:198,200,212`
- Test: tests/unit/faz5-ekonomi.test.ts:78-79,84-90
- Mutasyon: Tek tek HAYATTA KALIR: :200 `if (n > 0)` silinirse '0 ağırlık' vakasını :212 filtresi zaten eliyor; :212 silinirse :200 eliyor; :198 erken dönüş silinirse bütün paylar 0 çıkıp yine boş dönüyor. Yalnız :200 ve :212 birlikte silinirse :78 kırılır. 'Pozitif ağırlık ama floor → 0' durumu hiçbir vakada yok; :88'deki `every(v > 0)` seçilen ağırlıklarla her zaman doğru.
- Not: Etki: guard kalkarsa puanOlayi delta 0 ile çağrılır, awardPoints tavansız dala düşer (rewards.ts:338 `delta > 0` şartı) ve 0 puanlık ledger satırı yazar. En küçük test (unit): 7'lik davet dilimine 8 davetçi — `havuzDagit(36, 1, new Map(), new Map([[2,1],[3,1],[4,1],[5,1],[6,1],[7,1],[8,1],[9,1]]))` → `{1: 26}` (19 + dilim artığı 7; katkı dilimi sahipsiz) ve sonuçta 0 değerli anahtar yok.

**12. [ZAYIF] Sayım birimleri: ilerleyen = hafta içinde ilerleme kaydeden FARKLI katılımcı (üretici hariç); beğenili = FARKLI yorum; katkıcı ağırlığı = aldığı geçerli beğeni sayısı; davet eden ağırlığı = aktif davetli sayısı.**

- Kod: `src/lib/ekonomi.ts:53-54,61,90,99`
- Test: tests/integration/faz5-db.test.ts:200,205-208,226,229-231
- Mutasyon: ekonomi.ts:53 `count(distinct p.user_id)` → `count(*)`: HAYATTA KALIR (her katılımcının tek ilerleme satırı var). :61 `count(distinct y.id)` → `count(*)`: HAYATTA KALIR (filtrelerden sonra yoruma tek geçerli beğeni kalıyor). :90 ve :99 `count(*)::int as n` → `1`: HAYATTA KALIR (üretici dışı tek katkıcı; her davetçinin tek aktif davetlisi). :54 `p.user_id <> c.created_by` silinirse HAYATTA KALIR (üreticinin ilerleme satırı yok).
- Not: Üretici kendi kursuna katılamaz (davet.ts:221) ve `complete` katılım ister (egitim.ts:144-145) → :54 savunma amaçlı; tamamlama alt sorgusunda eşi yok (asimetri, zararsız). En küçük test: bir katılımcıya aynı hafta ikinci öğe ilerlemesi + aynı yoruma ikinci geçerli beğeni ekle; ikinci bir katkıcı ekle (yorumuna 1 geçerli beğeni) → 11'lik dilim 7/3 bölünmeli, üretici 25. Dikkat: V 11,5 → 12 olur ama havuz yine 38 (yuvarlama).

**13. [ZAYIF] Üreticinin kendi yorumu (beğeni alsa da) V'ye sayılmaz.**

- Kod: `src/lib/ekonomi.ts:65`
- Test: tests/integration/faz5-db.test.ts:217-219,226
- Mutasyon: ekonomi.ts:65 `y.user_id <> c.created_by` silinirse HAYATTA KALIR: beğenili 2 → V 12 → 15·ln 13 = 38,47 → 38; beklenen de 38 (V 11,5 → 37,89 → 38). Test yorumu 'V'yi (11,5) değiştirmemeli' diyor ama V hiçbir yerde doğrulanmıyor.
- Not: 09fc098'in 'kendi yorumu V'ye sayılmaz' düzeltmesi fiilen testsiz (pay tarafı havuzDagit filtresiyle ayrıca korunuyor — satır 3). En küçük test: V = 10 tabanlı kursa (10 ilerleyen → 36) üreticinin beğeni almış yorumunu ekle → 36 kalmalı (sayılırsa 37). Alternatif: canlilikHavuzuDagit kurs başına V döndürsün (kod değişikliği).

**14. [ZAYIF] Yorum yazarının kendi beğenisi ve işaretli hesabın beğenisi ne V'ye ne katkıcı ağırlığına sayılır.**

- Kod: `src/lib/ekonomi.ts:66,93-94`
- Test: tests/integration/faz5-db.test.ts:207,220,226,231
- Mutasyon: ekonomi.ts:66'da `l.user_id <> y.user_id` ya da `lu.flagged_at is null` silinirse HAYATTA KALIR (aynı yorum başka üyenin geçerli beğenisiyle zaten sayılıyor; distinct yorum = 1). :93 ya da :94 silinirse HAYATTA KALIR (yazarın ağırlığı 1 → 2 olur ama üretici dışı tek katkıcı olduğundan 11'lik dilimin tamamını yine alır).
- Not: Sayılmayan beğeniler zaten sayılan bir yoruma eklendiği için ayırt edici değil; 09fc098'in 'işaretli hesabın beğenisi' düzeltmesi testsiz. En küçük test: (a) yalnız kendi beğenisi olan yorum, (b) yalnız işaretli hesabın beğendiği yorum ekle (yazarları farklı katılımcılar) → o yazarlarda vitality_pool satırı OLMAMALI (ağırlık sorgusu) ve V = 10 tabanlı kursta havuz 36 kalmalı (V sorgusu). Ayrıca işaretli YAZARIN temiz hesaptan beğeni alan yorumu V'ye sayılır (yalnız beğenenin işaretine bakılıyor; payı bekleyene gider) — beklenen bu mu, doğrulanmadı.

**15. [ZAYIF] Sayımlar yalnız hafta penceresindeki [pazartesi 00:00 TR, sonraki pazartesi 00:00 TR) olayları kapsar; pencere SQL'e UTC duvar saatine çevrilerek geçer.**

- Kod: `src/lib/ekonomi.ts:36-37,55,58,67,70,95,105`
- Test: tests/integration/faz5-db.test.ts:184-185,238
- Mutasyon: Herhangi bir alt sorguda `>= b` → `> b` ya da `< e` → `<= e`: HAYATTA KALIR (tüm satırlar hafta ortasında: an(1)…an(3)). Tek bir alt sorgunun alt ya da üst sınırı tümden silinirse de HAYATTA KALIR (70 gün önceki hafta testinde tek kalemle V ≤ 6 < 10). :36-37'de toISOString yerine TR yerel saat dizesi (3 saat kayma) HAYATTA KALIR. Yalnız tüm alt sorguların üst sınırı birlikte silinirse :238 kırılır.
- Not: TR gece yarısı sınırı yalnız saf isoHafta'da sınanıyor; DB tarafında sınır satırı yok. En küçük test: 10 katılımcılı kursta ilerlemeleri tam `hafta.baslangic` anına yaz (sayılır → 36); iki ek katılımcıyı `baslangic - 1 ms` ve tam `hafta.bitis` anına yaz (sayılmaz; sayılırsa V 11 / 12 → 37). Aynısı beğeni created_at, accepted_at ve katılım completed_at için birer satır. Neon oturum saat diliminin UTC olduğu varsayımı doğrulanmadı (yerleşik `toISOString()::timestamp` deseni).

**16. [ZAYIF] vitality_pool tavanının penceresi içinde bulunulan TR haftasının başıdır (kayan 7 gün değil): önceki haftanın dağıtımı bu haftanın tavanını tüketmez.**

- Kod: `src/lib/rewards.ts:66-68,351`
- Test: tests/unit/faz5-ekonomi.test.ts:34
- Mutasyon: rewards.ts:68 `isoHafta(new Date()).baslangic` → `yediGunOnce()` ya da `new Date(0)`: unit :34 kırılır (aynı ifadeyle eşitlik). AMA davranış sınanmıyor: entegrasyon :236'da tek satır şimdi yazılmış; rewards.ts:351 `created_at >= since` → `>` HAYATTA KALIR ve pencere sınırının iki yanında satır yok.
- Not: PROGRESS tuzak (4): kayan 7 günde geçen pazartesinin satırı birkaç saniye farkla pencereye girip çıkar. En küçük test (entegrasyon): üyeye createdAt = `isoHafta(now).baslangic - 1 sn` olan 200'lük vitality_pool satırını doğrudan yaz (seed/test istisnası), sonra awardPoints(delta 50) → 50 yazılmalı; createdAt = baslangic olan satırla → 0. Unit :34 pazartesi 00:00 TR'de iki `new Date()` arası teorik olarak kırılgan (ihmal edilebilir).

**17. [güçlü] Canlılık V = 1×ilerleyen + 3×tamamlama + 0,5×beğenili yorum + 2×kabul edilen kaynak; V < 10 ise havuz 0, değilse round(15·ln(1+V)).**

- Kod: `src/lib/economy.ts:172-182`
- Test: tests/unit/faz5-ekonomi.test.ts:39-62
- Mutasyon: economy.ts:173'te 3→2 ya da 2→1: V(4,1,2,1)=10 vakası (test :43) 9 verir; 0.5→1: V(0,0,1,0)=0.5 (:45) kırılır. economy.ts:181'de `<`→`<=`: havuz(10)=36 (:53) 0 olur; HAVUZ_ESIK 10→9: havuz(9.5)=0 (:52) 35 olur; 15→14 ya da round→floor: havuz(10)=36 ve havuz(46)=58 (:53-54) kırılır.
- Not: Saf fonksiyon; PRD §4.2 (docs/prd/kurs-topluluk-ekosistemi.md:118-119) ile birebir. V'nin SQL'den doğru beslendiğini bu test göstermez (aşağıdaki sayım satırları). GENEL SINIR: bu haritadaki tüm 'kırılır / hayatta kalır' hükümleri test ÇALIŞTIRILMADAN (salt okunur kural) kod okuma + elle hesapla verildi.

**18. [güçlü] Havuz %50 üretici / %30 katkıcılar / %20 davet edenler bölünür; paylar aşağı yuvarlanır, dilim ve yuvarlama artıkları üreticiye yazılır; hak sahibi olmayan dilim dağıtılmaz; üretici katkıcı diliminden pay almaz (davet diliminden alabilir).**

- Kod: `src/lib/economy.ts:191-225`
- Test: tests/unit/faz5-ekonomi.test.ts:65-91
- Mutasyon: economy.ts:203 `*3`→`*4`: 'katkıcılar beğeni payına göre' (:72) kırılır; :204 `*2`→`*3`: 'davet edenler' (:75); :206 yerine floor(toplam/2): 'dilim yuvarlama artığı üreticiye' (:77, 19 beklenir); :217 floor→round ya da :221 `uretici += dilim - dagitilan` silinirse 'dilim içi artık üreticiye' (:73, 52 beklenir); :214 `continue` yerine dilimi üreticiye aktarmak: 'hak sahibi yok' (:71, {1:50}); :208 üretici filtresi silinirse 'üretici katkıcı diliminden pay almaz' (:74) + entegrasyon faz5-db.test.ts:231 (katkıcı 11 yerine 5).
- Not: Toplam korunumu (:84-90) yalnız iki dilim de doluyken sınanıyor. Üreticinin davet diliminden alması unit :76 ve entegrasyon :229 (=24) ile sabit; varsayım #62 ile uyumlu.

**19. [güçlü] Pay kişi başına TEK vitality_pool satırıdır: aynı kişinin birden çok dilimdeki payı toplanır; refId `course:{id}:{YYYY-Www}`; hesap yaşı freni uygulanmaz (kaynak epoch).**

- Kod: `src/lib/economy.ts:199-201 · src/lib/ekonomi.ts:118-127 · src/db/schema.ts:119-121`
- Test: tests/unit/faz5-ekonomi.test.ts:76 · tests/integration/faz5-db.test.ts:226-231
- Mutasyon: economy.ts:200 `(paylar.get(id) ?? 0) + n` → `n` (üstüne yaz): unit :76 ({1:64, 2:36}) kırılır; entegrasyon :229'da üretici 24 yerine 21. ekonomi.ts:124 refId'den hafta etiketi çıkarılırsa :229 (`[[24, ref]]`) kırılır. ekonomi.ts:125 `new Date(0)` → `new Date()`: tüm paylar bekleyene gider, :226 `{kurs:1, puan:38}` kırılır.
- Not: refId yalnız üreticinin satırında doğrulanıyor; davetçi ve katkıcıda yalnız delta.

**20. [güçlü] Hafta TR saatli (UTC+3) ISO haftasıdır: pazartesi 00:00 TR başlar, ISO yılı haftanın perşembesine göre, etiket YYYY-Www; dağıtılacak hafta içinde bulunulandan bir öncekidir.**

- Kod: `src/lib/economy.ts:228-249`
- Test: tests/unit/faz5-ekonomi.test.ts:93-114
- Mutasyon: TR_OFSET_MS 3→0: '2026-10-12T00:00+03:00 → W42' ve '2026-10-11T21:30Z → W42' (:95, :97) kırılır; :233 `(getUTCDay()+6)%7` → `getUTCDay()`: :95 W41 verir; :235 perşembe kaydırması silinirse '2024-12-30 → 2025-W01' (:100); :240 padStart silinirse '2026-W01' (:98); :238 `- TR_OFSET_MS` silinirse pencere testi (:104-108); :248 `- 1` silinirse 'pazartesi sabahı bir önceki hafta' (:111) W43 verir.
- Not: Yıl sınırı yalnız isoHafta'da sınanıyor (W53 / W01). sonTamamlananHafta'nın yıl sınırı bileşimi (4 Oca 2027 pzt → 2026-W53, 11 Oca → 2027-W01) ve cron'daki dize karşılaştırması ('2027-W01' >= '2026-W42') doğrudan sınanmıyor — iki satırlık it.each yeter. Türkiye sabit UTC+3 varsayımı.

**21. [güçlü] İşaretli (flagged_at) hesabın ilerlemesi V'ye sayılmaz.**

- Kod: `src/lib/ekonomi.ts:53-55`
- Test: tests/integration/faz5-db.test.ts:212-213,223,226
- Mutasyon: ekonomi.ts:54 `u.flagged_at is null` silinirse ilerleyen 7 → V 12,5 → round(15·ln 13,5) = 39; `toEqual({kurs:1, puan:38})` (:226) kırılır.
- Not: İşaret KOŞUM anında okunur: hafta içinde temiz olup pazartesiden önce işaretlenen sayılmaz; işareti sonradan kalkan için geriye dönük ödeme olmaz (kilit tüketilmiş).

**22. [güçlü] Üreticinin kendi eklediği (otomatik kabul edilen) kaynak V'ye sayılmaz; yalnız hafta içinde kabul edilen kaynak sayılır.**

- Kod: `src/lib/ekonomi.ts:68-70 (otomatik kabul: src/pages/api/uye/egitim.ts:306-307)`
- Test: tests/integration/faz5-db.test.ts:209,214-216,226
- Mutasyon: ekonomi.ts:69 `r.user_id <> c.created_by` silinirse kaynak 6 → V 21,5 → havuz 47; :226 kırılır. `r.status = 'accepted'` silinirse HAYATTA KALIR ama pratikte eşdeğer mutant (reddedilende accepted_at NULL — egitim.ts:323-324).
- Not: ŞÜPHE / gereksinimle fark: İŞARETLİ hesabın önerip üreticinin kabul ettiği kaynak SAYILIR (alt sorguda users join'i yok). Varsayım #62 'işaretli hesabın ilerlemesi, tamamlaması, beğenisi ve davetliliği' der, kaynağı anmaz; CLAUDE.md 'işaret havuz sayımlarını etkiler' der. PROGRESS 'bilinçli kalanlar'daki 2 hesaplı kaynak çiftliği, kukla işaretlendikten SONRA da V üretmeye devam eder. Önce beklenen davranışı karara bağla, sonra işaretli hesaba kabul edilmiş kaynak ekleyen testi yaz.

**23. [güçlü] Davet dilimi ağırlığına işaretli davetli sayılmaz.**

- Kod: `src/lib/ekonomi.ts:98-106`
- Test: tests/integration/faz5-db.test.ts:197,222-223,229-230
- Mutasyon: ekonomi.ts:102 `ku.flagged_at is null` silinirse davetçinin ağırlığı 2, üreticininki 1 → 7'lik dilim 4/2 bölünür, artık 1: davetçi 3 yerine 4 (:230), üretici 24 yerine 23 (:229) → kırılır.
- Not: Davet edenin kendisi işaretliyse sayımdan düşmez; payı bekleyene gider (satır 20).

**24. [güçlü] V < 10 olan kurs dağıtıma girmez (hiç canlı kurs yoksa {0,0}); aynı hafta ikinci kez dağıtılırsa ledger idempotency'si çift ödemeyi önler (lib düzeyi).**

- Kod: `src/lib/ekonomi.ts:75-83,120-129 · src/lib/rewards.ts:342-358`
- Test: tests/integration/faz5-db.test.ts:233-234,238
- Mutasyon: ekonomi.ts:82 `.filter((k) => k.toplam > 0)` silinirse hareketsiz hafta `{kurs:1, …}` döner → :238 kırılır. rewards.ts:354 `on conflict do nothing` silinirse ikinci koşum unique ihlaliyle patlar → :233 kırılır.
- Not: Bu LIB düzeyindeki idempotency'dir; cron kilidi (satır 24) ayrı ve testsiz. İkinci koşumda yalnız üreticinin satır sayısı ve toplam `puan: 0` doğrulanıyor; bildirimin çoğalmadığı doğrulanmıyor (satır 20).

**25. [güçlü] vitality_pool kişi başına haftalık 200 puanla sınırlıdır (yalnız vitality_pool toplamı; aşan kısım kırpılır); davet tavanına (300) girmez.**

- Kod: `src/lib/rewards.ts:65-68,75-85 · src/lib/points.ts:86-88`
- Test: tests/unit/faz5-ekonomi.test.ts:27-33 · tests/integration/faz5-db.test.ts:236
- Mutasyon: rewards.ts:67-68 `case "vitality_pool"` silinirse tavanIcin undefined → unit :31-32 ve entegrasyon :236 (197 yerine 500) kırılır. points.ts:88 200 → 300: :236 297 verir (unit :32 sabitin kendisiyle karşılaştırdığından tek başına yakalamaz). DAVET_REASONLARI'na 'vitality_pool' eklenirse unit :28 kırılır.
- Not: Tavan, havuz DÖNGÜSÜ içinden değil awardPoints doğrudan çağrılarak sınanıyor (zincir puanOlayi → awardPoints → tavanIcin aynı olduğundan kabul edilebilir). Çok kurslu üreticide kırpma (5 kurs × 50 → 200) ve dönen `puan`ın kırpılmış toplam olduğu uçtan uca yok → satır 8'deki iki kurslu teste eklenebilir. 200 değeri PRD'de yok (varsayım #62, karar Yusuf'ta).

### 4.3 · F5-04 · İşaretin bekleyene etkisi (motor) — 25 kural (güçlü 7, zayıf 6, testsiz 12)

**1. [YOK] Olgunlaştırmanın iki giriş noktası aynı tutma filtresinden geçer: günlük cron (userId'siz, günde bir kez, suistimal taramasından SONRA) ve /uye panosu (yalnız o alıcının satırları; işaretli üye kendi panosunu açarak tutulanı kesinleştiremez).**

- Kod: `src/pages/api/cron/gunluk.ts:164-165, :195; src/pages/uye/index.astro:28; src/lib/rewards.ts:540-551`
- Test: YOK (cron ucu ve sayfa çağrılmıyor; hiçbir test bekleyenleriIsle'yi userId'siz çağırmıyor). Lib'in userId'li varyantı: tests/integration/faz5-db.test.ts:287-288. Pano yalnız render: tests/e2e/kurs.spec.ts:42-48
- Mutasyon: (a) gunluk.ts:164-165 bloğu :195'in altına taşınırsa (tarama bekleyenden sonra) HAYATTA KALIR. (b) rewards.ts:549 `userId ? sql`not …` : undefined` yapılırsa (tutma yalnız panoda, cron hepsini kesinleştirir) HAYATTA KALIR — en tehlikeli hayatta kalan.
- Not: Canlı DB'de bekleyenleriIsle() userId'siz ÇAĞIRMA (tüm üyeleri işler). Güvenli en küçük testler: (1) kaynak-metin bekçisi (tests/unit/istek-freni.test.ts tarzı): gunluk.ts'te `suistimalTara(` indeksi < `bekleyenleriIsle(` indeksi; (2) vi.mock('@/db/client.ts') ile where SQL'ini yakala, userId'li ve userId'siz iki çağrıda da `flagged_at` içerdiğini doğrula; ya da ayrı Neon dalında gerçek koşum.

**2. [YOK] Pano etiketi: pending satırın matures_at'i geçmişteyse 'inceleniyor' (işaretin kimde olduğu söylenmez); gelecekteyse '{tarih} kesinleşir (hesap yaşı 24 s)'; matures_at yok + expires_at varsa 'son gün {tarih}'; ikisi de yoksa 'koşul bekliyor'.**

- Kod: `src/pages/uye/index.astro:122-129 (liste :92-96, render :516-519)`
- Test: YOK (tests/e2e/kurs.spec.ts:104 yalnız 'Bekleyen puan' başlığını arar; testlerde 'inceleniyor' metni hiç geçmiyor)
- Mutasyon: uye/index.astro:124 `<` → `>` yapılırsa ya da :124-125 dalı silinirse HAYATTA KALIR.
- Not: Etiket yalnız :28'deki bekleyenleriIsle önce koştuğu için doğru (olgun + tutulmayan her şey o anda kesinleşmiş olur); bu sıra bağımlılığını da sınayan yok. En küçük test: bekleyenZaman'ı saf fonksiyona çıkar (ör. lib/economy.ts bekleyenEtiketi(b, simdi)) ve 4 dal + eşitlik sınırı için birim test yaz; e2e alternatifi canlı DB'de test üyesine kaynağı işaretli pending satır yazmayı gerektirir (riskli).

**3. [YOK] Kurs motoru çağrı yerleri (üretici puanları): course_learner_activated ve course_learner_completed puanOlayi'ye kaynakIsaretli = !!öğrenen.flaggedAt ile gider; refId `course:K:u:{öğrenen}`.**

- Kod: `src/pages/api/uye/egitim.ts:162-170, :100-108`
- Test: YOK (POST rotası hiçbir entegrasyon testinde çağrılmıyor; tests/e2e/kurs.spec.ts:14-34 rotayı işaretsiz test üyesiyle sürer, puan iddiası yok)
- Mutasyon: egitim.ts:168 ya da :106 satırı silinirse (bayrak geçilmez) işaretli yaşlı öğrenenin aktivasyonu/bitirmesi üreticiye anında +5/+10 yazar → HAYATTA KALIR.
- Not: faz5-db.test.ts:280 bu rotayı değil puanOlayi'yi elle kaynakIsaretli:true ile çağırıyor. En küçük test: POST'u '@/pages/api/uye/egitim.ts'ten içe aktar; sahte context {locals:{auth:()=>({userId: clerkId}), currentUser}, request: FormData(action=complete,itemId), cookies, redirect} ile işaretli 2 günlük üye olarak çağır → ledger(uretici,'course_learner_activated', ref) boş, pending satır status 'pending' (rota vitest'te bu şekilde çağrılabilir mi doğrulanmadı). İşaret istek başındaki getOrCreateMember anlık görüntüsünden okunur.

**4. [YOK] course_launched eşik sayımı (rota): yalnız işaretsiz, aktive, üretici dışı katılımcılar sayılır; sayı >= 3 ise puanOlayi çağrılır (kaynakIsaretli GEÇİLMEZ; hesap yaşı = işaretsizlerin en genci).**

- Kod: `src/pages/api/uye/egitim.ts:174-197`
- Test: YOK (rota çağrılmıyor). SQL eşleniği ayrı sınanıyor: tests/integration/faz5-db.test.ts:330-346
- Mutasyon: egitim.ts:186 `isNull(schema.users.flaggedAt)` silinirse 3 işaretli kukla aktive olunca üreticiye anında +50 yazılır (kaynaklar yaşlıysa) → HAYATTA KALIR. egitim.ts:189 `>=` → `>` de HAYATTA KALIR.
- Not: Sayım koşulları rewards.ts:96-99 ile elle eşlenik (iki kopya, bağlayan test yok). En küçük test: rota üzerinden 2 temiz + 1 işaretli (hepsi 2 günlük) aktivasyon → ledger(uretici,'course_launched') boş VE pending satır yok; 3. temiz aktivasyonda [50].

**5. [YOK] Eşik işaretli hesap yüzünden tutmadıysa course_launched için bekleyen satır HİÇ açılmaz; işaret kalkınca kendiliğinden yazılmaz, ancak sıradaki aktivasyonda yazılır (belgelenmiş kısayol).**

- Kod: `src/pages/api/uye/egitim.ts:189 (çağrı yalnız eşik tutunca); src/lib/rewards.ts:88-90 (yorum)`
- Test: YOK
- Mutasyon: Davranışı kilitleyen test yok: eşik altındayken bekleyen satır açacak bir değişiklik de, mevcut 'hiç açmama' da HAYATTA KALIR.
- Not: Gereksinimle fark: rewards.ts:90 yorumu 'İşaret kalkınca kendiliğinden kesinleşir' der; bu yalnız ZATEN açılmış satır için doğru. Kısayol docs/assumptions.md:72 (#65) ve PROGRESS.md:16'da kayıtlı ama kodda `shortcut:` yorumu yok. Haksız işaretlenen 3. katılımcı temizlenip kursa yeni aktivasyon gelmezse üretici +50'yi hiç almaz. Önce karakterizasyon testi yaz (2 temiz + 1 işaretli aktive → işaret kalk → bekleyenleriIsle → ledger hâlâ boş), sonra davranışı Yusuf'a sor.

**6. [YOK] davetAktivasyonu çağrı yerleri: course_invite_welcome (alıcı = davetli) ve course_invite_activated (alıcı = davet eden, refId `course:K:u:{davetli}`) kaynakIsaretli = !!davetli.flaggedAt ile gider.**

- Kod: `src/lib/davet.ts:278-295`
- Test: İşaretli davetliyle YOK. İşaretsiz yol: tests/integration/davet-db.test.ts:96-102, tests/integration/faz5-db.test.ts:126-131
- Mutasyon: davet.ts:293 silinirse işaretli yaşlı davetlinin aktivasyonu davet edene anında +15 yazar → HAYATTA KALIR. davet.ts:284'ü silmek eşdeğer mutanttır (alıcı = davetli, puanOlayi alıcı dalı zaten yakalar) — yalnız Member nesnesi DB'den bayatsa fark eder.
- Not: faz5-db'deki kuklalar doğrudan insert ile kayıtlı; davetAktivasyonu hiçbir testte işaretli üyeyle çağrılmıyor. En küçük test: 2 günlük üyeyi işaretle, SATIRI YENİDEN OKU, davetleAktive(isaretli, ana, b.id) → ledger(b,'course_invite_activated', ref) boş, ledger(isaretli,'course_invite_welcome') boş, iki pending satır status 'pending'; işaret kalkınca iki bekleyenleriIsle → [15] ve [10].

**7. [YOK] Tutulan puanda davet edene 'tavan dolu' yerine nötr bildirim gider: n=0 ∧ davetli genç değil ∧ aynı (user, reason, ref) için pending satır varsa 'Puan bekleyende; kesinleşince yazılır'.**

- Kod: `src/lib/davet.ts:296-307, :312-323`
- Test: YOK (hiçbir test bildirim gövdesini okumuyor)
- Mutasyon: davet.ts:302-305'te bekliyorMu dalı silinip eski 'Haftalık davet puanı tavanın dolu' metnine dönülürse HAYATTA KALIR.
- Not: Genç VE işaretli davetlide 'hesap 24 saatlik olunca kesinleşir' denir (davet.ts:300-301) — işareti gizler ama 24 saat sonra kesinleşmez; bilinçli mi doğrulanmadı. En küçük test: yukarıdaki işaretli davetAktivasyonu testinde notifications(userId=b) son gövdesi /Puan bekleyende/ ve /tavan/ içermez; tavanı dolu temiz davet edende /tavanın dolu/.

**8. [YOK] ikinciSeviye: invite_second_level üst davetçiye refId `u:{davetli}` ve kaynakIsaretli = !!davetli.flaggedAt ile yazılır; ARA halka (davet eden B) işaretliyse puan tutulmaz.**

- Kod: `src/lib/davet.ts:330-354`
- Test: İşaretli davetliyle YOK. Genç davetli: tests/integration/faz5-db.test.ts:164-179; işaretsiz: :119-134
- Mutasyon: davet.ts:352 silinirse işaretli yaşlı davetlinin ilk aktivasyonu üst davetçiye anında +5 yazar → HAYATTA KALIR.
- Not: Gereksinimle olası fark: A→B→C zincirinde B işaretli, C temiz ve yaşlıysa A +5'i anında alır (B'nin kendi +15'i alıcı dalıyla tutulur). 'Ondan doğan' B'yi kapsıyor mu belirsiz (docs/assumptions.md:72) — karar gerekir. En küçük test: işaretli (yeniden okunmuş) c2 ile davetleAktive(c2, ana, b.id) → ledger(a,'invite_second_level', `u:${c2.id}`) boş + pending; ayrı testte B işaretli/C temiz → bugünkü davranışı (A [5]) sabitle.

**9. [YOK] davetBitirme: önce bekleyenYaz (matures/expires yok), sonra puanOlayi(course_invite_completed, refId `course:K:u:{davetli}`, kaynakIsaretli); işaretli davetlide satır pending kalır ve matures_at dolar.**

- Kod: `src/lib/davet.ts:364-387`
- Test: YOK (davetBitirme hiçbir testte çağrılmıyor — işaretli ya da işaretsiz)
- Mutasyon: davet.ts:384 silinirse ya da fonksiyonun tamamı no-op yapılırsa HAYATTA KALIR.
- Not: En küçük test: davetle katılmış katılımla dv.davetBitirme(katilim, kurs, davetli) → temiz davetlide ledger(eden,'course_invite_completed', ref)=[10] ve pending {confirmed, yazilan:10}; işaretli (yeniden okunmuş) davetlide ledger boş, pending {status:'pending', maturesAt dolu}; işaret kalkınca bekleyenleriIsle → [10].

**10. [YOK] Etkinlik girisOdulleri: event_invite_attended davet edene kaynakIsaretli = taze okunan davetli.flaggedAt ile gider (refId `event:E:u:{davetli}`); davetlinin KENDİ event_attended ve event_invite_welcome puanları doğrudan yazılır.**

- Kod: `src/lib/etkinlik.ts:304-331`
- Test: İşaretli davetliyle YOK. İşaretsiz: tests/integration/etkinlik-db.test.ts:315-334; genç: :336-355
- Mutasyon: etkinlik.ts:330 silinirse işaretli yaşlı davetlinin girişi davet edene anında +10 yazar → HAYATTA KALIR.
- Not: Burada işaret DB'den taze okunur (etkinlik.ts:322), test nesneyi yeniden okumak zorunda değil. En küçük test (etkinlik-db): :315 testinin kopyası, girişten önce davetliyi işaretle → girisYap puan 15 (kendi puanları), ledger(eden,'event_invite_attended', ref) boş, bekleyen {status:'pending', expiresAt:null}; bekleyenleriIsle(bitiş+1 sn) → {kesinlesen:0, dusen:0}; işaret kalkınca kesinleşir.

**11. [YOK] Canlılık havuzu payı puanOlayi ile yazılır ama kaynakIsaretli GEÇİLMEZ ve hesap yaşı freni yoktur (kaynakOlusturulma = epoch): yalnız ALICI işaretliyse pay bekleyene gider; refId `course:K:{hafta}` kaynak taşımaz.**

- Kod: `src/lib/ekonomi.ts:118-127`
- Test: YOK (tests/integration/faz5-db.test.ts:183-239'da işaretli hesap pay ALICISI değil; yalnız sayımdan dışlanıyor)
- Mutasyon: ekonomi.ts:120'de puanOlayi → awardPoints yapılırsa (işaretli alıcı payı anında alır) havuz testi aynı sonucu verir → HAYATTA KALIR.
- Not: Görev tanımı ekonomi.ts'i 'kaynakIsaretli geçen çağrı yeri' sayıyor; kodda bayrak yok — tutma yalnız alıcı dalından. İşaretli yorum YAZARI katkıcı ağırlığından dışlanmaz (ekonomi.ts:90-96 yalnız beğeneni süzer), payı bekleyene düşer. En küçük test: havuz testinde dağıtımdan önce katkıcı u[2]'yi işaretle → ledger(u[2],'vitality_pool') boş, pending {delta:11, status:'pending'}, dönen puan 27; işaret kalkınca bekleyenleriIsle → [11] (haftalık tavan penceresi kesinleşme anına göre, rewards.ts:67-68).

**12. [YOK] puanOlayi'den GEÇMEYEN doğrudan awardPoints çağrıları işaretle tutulamaz (tam liste); yeni bir doğrudan çağrı eklendiğinde uyaran bekçi yok.**

- Kod: `welcome src/lib/member.ts:70 · referral_joined member.ts:92 · referral_activated member.ts:124 · post_approved src/pages/api/uye/admin.ts:35 · quiz_set_approved admin.ts:225 · quiz src/pages/api/uye/quiz.ts:74 · task_done src/pages/api/uye/gorev.ts:231 · course_completed src/pages/api/uye/egitim.ts:87 · answer_accepted egitim.ts:261 · resource_accepted egitim.ts:333 · event_attended src/lib/etkinlik.ts:304 · event_invite_welcome etkinlik.ts:315 · event_hosted etkinlik.ts:512 · event_well_rated etkinlik.ts:536 · streak_bonus src/lib/rewards.ts:298, :306 · like_received rewards.ts:654`
- Test: YOK
- Mutasyon: Herhangi bir puanOlayi çağrısı awardPoints'e çevrilirse (ör. etkinlik.ts:324) ya da kaynağı başka hesap olan yeni bir doğrudan awardPoints eklenirse yapısal olarak yakalayan test yok → HAYATTA KALIR.
- Not: Tutulabilenler (puanOlayi): course_learner_activated, course_learner_completed, course_launched, course_invite_welcome, course_invite_activated, course_invite_completed, invite_second_level, event_invite_attended, vitality_pool. Enum'da olup hiç yazılmayan: rep_bonus, season_reward, level_reward; admin_adjust yalnız revokePoints (negatif). Doğrudan listede KAYNAĞI ayrı hesap olanlar ('ondan doğan' ama tutulamaz): referral_joined ve referral_activated (kaynak davetli; #42'de karar bekliyor), answer_accepted ve resource_accepted (kaynak üretici), like_received (kaynak beğenen), task_done (kaynak onaylayan), event_hosted / event_well_rated (kaynak katılımcı girişleri — girisSayisi etkinlik.ts:478-490 işaretliyi DIŞLAMIYOR; CLAUDE.md:96'daki 'eşiği sayarken işaretliyi dışla' kuralıyla çelişiyor olabilir, karar doğrulanmadı). En küçük bekçi: src altında `awardPoints(` çağrı yerlerini tarayıp dosya→reason izin listesiyle karşılaştıran birim test. Kontrol edilmeyenler: hiçbir test koşturulmadı (salt okunur) — tüm 'kırılır / hayatta kalır' hükümleri kod okumasına dayanır; admin.ts flag_clear / flag_confirm rotaları ve lider/lig tarafı bu haritanın dışında.

**13. [ZAYIF] puanOlayi işaretli/genç dalı bekleyeni upsert eder: matures_at = kaynak açılışı + 24 s, expires_at NULL'a çekilir, yalnız status='pending' satır güncellenir; aynı (user, reason, ref) için confirmed/expired satır varsa olay sessizce 0 döner (ne ledger ne yeni bekleyen).**

- Kod: `src/lib/rewards.ts:489-505`
- Test: Genç yol: tests/integration/etkinlik-db.test.ts:348-350, tests/integration/faz5-db.test.ts:168-172. İşaretli yol: yalnız dolaylı (faz5-db.test.ts:292 toplam).
- Mutasyon: (a) rewards.ts:502 `expiresAt: null` silinirse etkinlik-db.test.ts:349 kırılır (genç yol, aynı satır). (b) rewards.ts:503 setWhere silinirse HAYATTA KALIR: hiçbir test confirmed/expired satır varken işaretli/genç olay tetiklemiyor. (c) İşaretli hesapta kursaKatil'in açtığı 14 günlük satırın expires_at'inin NULL'a çekilmesi hiç sınanmıyor.
- Not: En küçük test (faz5-db): 2 günlük davetli + çerezli kursaKatil → users.flaggedAt=now → satırı YENİDEN OKU (davetli.flaggedAt Member nesnesinden okunur, DB'den değil) → davetAktivasyonu → davet edenin `course:K:u:D` satırı {status:'pending', expiresAt:null, maturesAt<=şimdi}; bekleyenleriIsle(now+15 gün) → {kesinlesen:0, dusen:0}. İkinci test: status='expired' satır varken puanOlayi(kaynakIsaretli:true) → satır expired kalır, ledger boş (bilinçli mi doğrulanmadı; course_launched çok-atışlı olduğu için önemli).

**14. [ZAYIF] refId ayrıştırması `(?:^|:)u:([0-9]{1,9})$`: `course:K:u:N`, `event:E:u:N` ve çıplak `u:N` (invite_second_level) kaynağı verir; `course:K`, `course:K:2026-W42` (vitality_pool), `yorum:…` vermez; 10+ haneli sayı eşleşmez (int taşması yok).**

- Kod: `src/lib/rewards.ts:94 (kopyaları: src/lib/ekonomi.ts:252, :278)`
- Test: tests/integration/faz5-db.test.ts:276, :287 (yalnız `course:K:u:N`); bekleyenleriDusur kopyası :339-341
- Mutasyon: rewards.ts:94'te `(?:^|:)u:` → `:u:` yapılırsa çıplak `u:N` eşleşmez, işaretli davetlinin 2. seviye puanı olgunlaşır → HAYATTA KALIR (tutma testinde `u:N` ve `event:E:u:N` biçimi yok). `{1,9}` → `+` de HAYATTA KALIR.
- Not: Aynı regex üç yerde elle kopyalanmış (rewards.ts:94, ekonomi.ts:252, ekonomi.ts:278); birbirine bağlayan test yok. En küçük test: işaretli X için bekleyenYaz(a, invite_second_level, `u:${X}`, maturesAt geçmiş) + bekleyenYaz(b, event_invite_attended, `event:1:u:${X}`, geçmiş) → bekleyenleriIsle → kesinlesen 0; negatif: temiz alıcıya `course:${k}:2026-W42` (vitality_pool) → kesinleşir. Postgres substring'in yakalamayan grubu saymadığı yalnız geçen testin dolaylı kanıtına dayanıyor (doğrulanmadı).

**15. [ZAYIF] course_launched tutmanın sınır ve sayım koşulları: tam 2 işaretsiz aktif → tutulur, 3 → serbest; aktive olmamış katılım (activated_at NULL) ve üreticinin kendi katılımı sayılmaz; eşik PUAN.courseLaunchThreshold.**

- Kod: `src/lib/rewards.ts:96-100; src/lib/points.ts:85`
- Test: tests/integration/faz5-db.test.ts:333-337, :344-346 (yalnız 0 ve 3 değerleri)
- Mutasyon: rewards.ts:100 `< ${PUAN.courseLaunchThreshold}` → `< 1` ya da `< 2`: 0'da tutulur, 3'te serbest → HAYATTA KALIR. rewards.ts:99 `k.activated_at is not null` silinirse HAYATTA KALIR (testteki tüm katılımlar aktive). `k.user_id <> c.created_by` silinirse HAYATTA KALIR (üretici kendi kursuna kayıtlı değil).
- Not: En küçük test: kursa 2 temiz aktif + 1 işaretli aktif + 1 temiz aktive-OLMAMIŞ katılım + üreticinin kendi aktif katılımı → course_launched bekleyeni (maturesAt geçmiş) bekleyenleriIsle'de kesinleşmez; üçüncü temiz katılım aktive edilince kesinleşir.

**16. [ZAYIF] İşaret kalkınca kesinleşme (ALICI) ve puanOlayi'nin KENDİ yazdığı tutulan satırın uçtan uca serbest kalması: işareti kalkan alıcının satırları ve kaynakIsaretli ile yazılmış satır ledger'a geçer.**

- Kod: `src/lib/rewards.ts:488-505, 541-552`
- Test: Doğrudan iddia YOK. Dolaylı: tests/integration/faz5-db.test.ts:326 k2'nin işaretini kaldırıyor ama k2 için bekleyenleriIsle çağrılmıyor; :336 davetçinin `u:k2` satırını kesinleştiriyor ama ledger'ı iddia edilmiyor.
- Mutasyon: İşaretli dalda yazılan satırın matures_at'i NULL bırakılırsa (rewards.ts:498, yalnız işaretli için) satır hiç olgunlaşmaz → HAYATTA KALIR (hiçbir test puanOlayi'nin yazdığı tutulan satırın sonradan ledger'a geçtiğini iddia etmiyor).
- Not: En küçük test (mevcut teste 4 satır): k2 işareti kalkınca bekleyenleriIsle(now, k2.id) → kesinlesen 2, ledger(k2,'answer_accepted')=[7], ledger(k2,'course_invite_welcome')=[10]; bekleyenleriIsle(now, davetci.id) → ledger(davetci,'course_learner_activated', `course:${ana}:u:${k2}`)=[5].

**17. [ZAYIF] Düşme süresi işaretliyken de işler: süresi dolan (expires_at < şimdi) pending satır, alıcı/kaynak işaretli olsa da 'expired' olur — düşürme sorgusunda tutma filtresi YOK.**

- Kod: `src/lib/rewards.ts:553-558`
- Test: Yalnız işaretsiz hesaplarla: tests/integration/ekonomi-db.test.ts:98-102, tests/integration/davet-db.test.ts:120-132, tests/integration/etkinlik-db.test.ts:246-260
- Mutasyon: rewards.ts:556 koşuluna `sql`not ${tutulanBekleyenSql}`` eklenirse (işaretlinin süresi de donar) HAYATTA KALIR: hiçbir testte işaretli hesaba ait expires_at'li satır yok.
- Not: En küçük test: işaretli kullanıcıya bekleyenYaz({expiresAt: geçmiş, maturesAt yok}) ve temiz alıcıya `…:u:${işaretli}` refId'li expiresAt geçmiş satır → bekleyenleriIsle → {dusen: 1} her biri, ledger boş. Gereksinim: docs/assumptions.md:72 (#65 'düşme süresi işler').

**18. [ZAYIF] Kesinleşme sırası (ADR K2): ÖNCE awardPoints (idempotent), SONRA status='confirmed'; yazilan = n>0 ? n : ledger'daki delta; update yalnız status='pending' satıra. Faz 5 bu sırayı değiştirmedi.**

- Kod: `src/lib/rewards.ts:447-463 (bekleyeniKesinlestir), :507-528 (puanOlayi doğrudan yol)`
- Test: tests/integration/ekonomi-db.test.ts:85-96 (onarım), :56-83; tests/integration/etkinlik-db.test.ts:327
- Mutasyon: rewards.ts:458 `n > 0 ? n : ledgerDeltaSql(...)` → `n` yapılırsa ekonomi-db.test.ts:95 `yazilan 9` kırılır (onarım guclu). AMA status update'i awardPoints'in önüne alınırsa (sıra ters) çökme enjekte eden test olmadığı için HAYATTA KALIR.
- Not: `git diff 7fd5416..HEAD -- src/lib/rewards.ts` 447-463'e dokunmuyor (yalnız bekleyenleriIsle sorgusu findMany → select().from() oldu); ADR notu docs/adr/0001-kurs-davet-etkinlik-harita.md:244 'sıra değişmedi' diyor. En küçük sıra testi: gerçek bir pending satırı al, bekleyeniKesinlestir({...satir, userId: var olmayan id}) çağır → points_ledger FK hatası fırlar (expect rejects) → gerçek satırın status'u hâlâ 'pending' olmalı; sıra ters olsaydı 'confirmed' kalırdı (koşturulmadı, doğrulanmadı).

**19. [güçlü] puanOlayi: ALICI (opts.userId) işaretliyse — kaynak temiz ve 24 saatten yaşlı olsa da — puan ledger'a değil bekleyene yazılır ve 0 döner; alıcının işareti her çağrıda DB'den taze okunur.**

- Kod: `src/lib/rewards.ts:484-488`
- Test: tests/integration/faz5-db.test.ts:282-286 (+ :292 tutulan toplamındaki 7)
- Mutasyon: rewards.ts:488'de `alici?.flaggedAt ||` silinirse awardPoints(answer_accepted, 7) yazılır ve 7 döner → faz5-db.test.ts:285 `toBe(0)` ve :286 kırılır.
- Not: Yalnız lib çağrısı ve yalnız POSTGRES_URL_TEST ile koşar (describe.skipIf, faz5-db.test.ts:15) — `npm run qa` kapısında bu satırdaki tüm 'guclu' hükümler ATLANIR. Alıcı dalını gerçek bir çağrı yeri üzerinden (vitality_pool payı, course_launched üreticisi) sınayan test yok; bkz. ilgili satırlar.

**20. [güçlü] puanOlayi: çağıran kaynakIsaretli=true geçerse kaynak 24 saatten yaşlı olsa da puan bekleyene yazılır, 0 döner (yaptırım hesap yaşına bağlı değil).**

- Kod: `src/lib/rewards.ts:480-481, 488`
- Test: tests/integration/faz5-db.test.ts:278-281, :297 (+ :292 toplamındaki 5)
- Mutasyon: rewards.ts:488'de `opts.kaynakIsaretli ||` silinirse awardPoints(course_learner_activated, 5) yazılır → faz5-db.test.ts:281 `toBe(0)` kırılır.
- Not: Bayrak yalnız 'bekleyene yaz' der; TUTMA refId'ye bağlıdır (tutulanBekleyenSql). kaynakIsaretli=true + refId sonu u:{id} olmayan bir çağrı (alıcı temizse) ilk bekleyenleriIsle'de kesinleşir — bu tutarsızlığı yakalayan test yok.

**21. [güçlü] bekleyenleriIsle: işaretli ALICININ olgunlaşmış bekleyeni kesinleşmez (tutulanBekleyenSql alıcı dalı: f.id = pending_points.user_id).**

- Kod: `src/lib/rewards.ts:93-94, 541-551`
- Test: tests/integration/faz5-db.test.ts:277, :288
- Mutasyon: rewards.ts:94'te `f.id = pending_points.user_id or` silinirse k2'nin iki satırı (welcome 10, answer_accepted 7) kesinleşir → faz5-db.test.ts:288 `kesinlesen: 0` kırılır.
- Not: Lib doğrudan çağrılıyor; pano (uye/index.astro:28) ve cron (gunluk.ts:195) üzerinden sınanmış sayılmaz.

**22. [güçlü] bekleyenleriIsle: alıcı temiz olsa da işaretli KAYNAĞIN (refId sonu u:{id}) bekleyeni kesinleşmez.**

- Kod: `src/lib/rewards.ts:94, 549`
- Test: tests/integration/faz5-db.test.ts:276, :287, :289
- Mutasyon: rewards.ts:94'te `or f.id = substring(...)::int` silinirse davetçinin `u:k1` ve `u:k2` satırları kesinleşir → faz5-db.test.ts:287 `kesinlesen: 0` ve :289 kırılır.
- Not: Yalnız `course:K:u:N` biçimi sınanıyor; diğer refId biçimleri için bir sonraki satıra bak.

**23. [güçlü] course_launched tutma: reason='course_launched' ∧ refId `^course:N$` ∧ kursun İŞARETSİZ aktif katılımcısı < 3 ise bekleyen kesinleşmez (refId'de kaynak olmadığı için ayrı dal).**

- Kod: `src/lib/rewards.ts:95-100`
- Test: tests/integration/faz5-db.test.ts:330-337 (3 aktifin 3'ü işaretli → bekler), :344-346 (işaretler kalkınca [50])
- Mutasyon: `or (pending_points.reason = 'course_launched' …)` dalı silinirse ya da rewards.ts:99'da `and u.flagged_at is null` silinirse satır hemen kesinleşir → faz5-db.test.ts:337 `length 0` kırılır. `<` → `<=` yapılırsa 3 işaretsizde de tutulur → :346 `[50]` kırılır.
- Not: Admin 'Suistimal' (bekleyenleriDusur, ekonomi.ts:250-252) bu satırı DÜŞÜRMEZ (refId'de u: yok, alıcı üretici): işaret kalırsa üreticinin course_launched bekleyeni expires_at'siz sonsuza dek pending kalır — sınayan test yok, bilinçli mi doğrulanmadı.

**24. [güçlü] İşaret kalkınca kesinleşme (KAYNAK): kaynağın flagged_at'i NULL olunca tutulan satır bir sonraki bekleyenleriIsle'de kesinleşir; hâlâ işaretli başka kaynağın satırı beklemeye devam eder.**

- Kod: `src/lib/rewards.ts:93-94, 549-552`
- Test: tests/integration/faz5-db.test.ts:294-297
- Mutasyon: rewards.ts:93'te `f.flagged_at is not null` → `true` (işarete bakmadan her kaynağı tut) yapılırsa işaret kalksa da kesinleşmez → faz5-db.test.ts:295 `kesinlesen: 1` ve :296 `[15]` kırılır.
- Not: Kesinleşme admin 'Temiz' anında DEĞİL (admin.ts:200 bekleyenleriIsle çağırmaz): sonraki günlük cron ya da alıcının /uye ziyareti. Rota üzerinden sınanmıyor.

**25. [güçlü] awardPoints işarete bakmaz: işaretli üyenin doğrudan puanları (quiz, kurs bitirme, etkinlik girişi…) ledger'a yazılır — kullanıcı engellenmez, yalnız sıralamada görünmez.**

- Kod: `src/lib/rewards.ts:328-380`
- Test: tests/integration/faz5-db.test.ts:322-327 (işaretliyken yazılan 90, işaret kalkınca sıralamada görünür)
- Mutasyon: awardPoints'e 'alıcı işaretliyse yazma' koşulu eklenirse işaret kalktıktan sonraki sıralama [temiz] olur → faz5-db.test.ts:327 `[isaretli, temiz]` kırılır.
- Not: Gereksinim: docs/assumptions.md:72 (#65 'KENDİ doğrudan puanları yazılmaya devam eder').

### 4.4 · F5-04 · Suistimal taraması + admin — 25 kural (güçlü 5, zayıf 10, testsiz 10)

**1. [YOK] 24 saat penceresi: hesap sayısı, aynı davetçiye bağlı hesapların AÇILIŞ anına göre 24 saatlik kayan penceredeki en yüksek sayımdır.**

- Kod: `src/lib/ekonomi.ts:219-222 (`range between interval '24 hours' preceding and current row`)`
- Test: YOK
- Mutasyon: `interval '24 hours'` -> `'48 hours'` yapılırsa ya da çerçeve tümden silinirse HAYATTA KALIR: tüm kuklalar `uye(..., 0)` ile aynı saniyelerde açılıyor (faz5-db.test.ts:248, :37).
- Not: En küçük test: 5 kukla, 3'ü createdAt = 30 saat önce, 2'si şimdi; tek IP'den 5 ziyaret -> boş. Sonra eski 3'ü 20 saat önceye çek -> işaret. Dikkat: pencere users.created_at üzerinden (katılım anı joined_at DEĞİL) — 'kodla katılan / 24 s' ifadesiyle birebir aynı şey değil; RANGE iki ucu dahil eder (tam 24 saat arayla açılan da sayılır).

**2. [YOK] 48 saat geriye bakış: yalnız son 48 saatte açılan hesaplar ve son 48 saatteki ziyaretler değerlendirilir.**

- Kod: `src/lib/ekonomi.ts:223 (hesap), :230 (ziyaret)`
- Test: YOK
- Mutasyon: ekonomi.ts:223 `u.created_at > now() - interval '48 hours'` ya da :230 ziyaret filtresi silinirse / '30 days' yapılırsa HAYATTA KALIR (testte ne eski kukla ne eski ziyaret var).
- Not: İki en küçük test: (a) 5 kukla createdAt ~50 saat önce + 5 taze ziyaret -> boş; (b) 5 taze kukla + createdAt'i 3 gün önce olan 5 ziyaret -> boş. Kodda telafi yok: cron iki gün üst üste atlanırsa küme hiç taranmaz. Varsayılan `uye()` tam 48 saat önce açar (:37) — ms farkıyla dışarıda kalması tesadüf, iddia değil.

**3. [YOK] Yalnız `member` rolündeki hesap taramayla işaretlenir (rep ve admin işaretlenmez).**

- Kod: `src/lib/ekonomi.ts:239 (`u.role = 'member'`)`
- Test: YOK
- Mutasyon: `and u.role = 'member'` silinirse HAYATTA KALIR (tüm kuklalar varsayılan roldedir).
- Not: En küçük test: 5 kukladan birini `role: "rep"` yap -> dönen liste 4 hesap, rep'in flagged_at'i NULL (rep eşik sayımında kalır). Tutarsızlık: şikâyet yolu yalnız admin'i dışlar (src/pages/api/uye/admin.ts:182) -> rep şikâyetle işaretlenir, taramayla işaretlenmez; bilinçli olduğu belgelerde yazmıyor.

**4. [YOK] Davetçinin kodlarına son 48 saatte hiç ziyaret satırı yoksa hesap sayısı ne olursa olsun işaret yok (ip ile INNER JOIN).**

- Kod: `src/lib/ekonomi.ts:233; ziyaret yazmayan yedek yol: src/pages/kurslar/[slug].astro:45-55, src/pages/etkinlik/[slug].astro:75-83`
- Test: YOK
- Mutasyon: `join ip` -> `left join ip` + coalesce (ziyaretsiz kümeyi de işaretle) ya da tersi HAYATTA KALIR.
- Not: Belgeli sınır (docs/assumptions.md #64 c; ekonomi.ts:203-204) ama testle sabit değil ve belgede yalnız sahte-pozitif yönüyle anlatılıyor: bağlantıyı `/d/KOD` yerine doğrudan `...?d=KOD` ile açan çiftlik HİÇ ziyaret bırakmaz -> tarama görmez (kaçış yolu). En küçük test: 5 kukla + 0 ziyaret -> boş (bilinen açığı sabitler; kök çözüm #42 gelince bilinçli değişir).

**5. [YOK] Günlük cron taramayı HER ŞEYDEN önce, kilitsiz ve parametresiz (tüm davetçiler) çalıştırır; işaretlenen varsa sayısı rapora yazılır.**

- Kod: `src/pages/api/cron/gunluk.ts:161-165 (yetki :152-156)`
- Test: YOK (hiçbir test /api/cron/gunluk çağırmıyor; entegrasyon yalnız `suistimalTara(davetci.id)` çağırır)
- Mutasyon: gunluk.ts:164 silinirse ya da 5. adımın (:195 bekleyenleriIsle) arkasına taşınırsa HAYATTA KALIR. :155 yetki kontrolü silinirse de HAYATTA KALIR (401 yalnız elle curl ile doğrulanmış).
- Not: En küçük testler: (a) kaynak bekçisi (tests/unit/istek-freni.test.ts deseni): GET gövdesi İÇİNDE `suistimalTara(` konumu < `birKezCalistir("bayat-gorev"`, `aktifSezon(`, `ozelLigleriKapat(`, `bekleyenleriIsle(` konumları (dosya başındaki import ve fonksiyon tanımlarını sayma); (b) misafir e2e: sırsız `GET /api/cron/gunluk` -> 401 (DB'ye dokunmaz). Risk: :164 try/catch'siz — tarama SQL'i hata verirse sezon kapanışı, bekleyenler ve havuz o koşumda hiç çalışmaz. Parametresiz yol (`yalniz` boş) hiçbir testte koşmuyor.

**6. [YOK] Admin ucu yalnız admin: üye değilse ya da rolü admin değilse 403, hiçbir aksiyon çalışmaz.**

- Kod: `src/pages/api/uye/admin.ts:16-18`
- Test: YOK (hiçbir test /api/uye/admin'e POST atmıyor)
- Mutasyon: admin.ts:17-18 silinirse HAYATTA KALIR -> her üye flag_clear / flag_confirm / report_remove çalıştırabilir.
- Not: En küçük test (auth e2e; test üyesi admin değil, istek reddedildiği için canlı DB'de güvenli): `page.request.post("/api/uye/admin", { form: { action: "flag_clear", userId: <demo id> } })` -> 403 ve gövde 'Yetkisiz' (Astro köken kontrolünün 403'üyle karışmasın diye gövdeyi de iddia et); ardından hedefin flagged_at'i değişmemiş. Misafir için beklenti doğrulanmadı (Clerk middleware'i önce yönlendirebilir).

**7. [YOK] Üye şikâyetinde 'Haklı' (report_remove) şikâyet edilen üyeyi işaretler; 'Reddet' (report_restore) işaretlemez; admin işaretlenmez; mevcut işaret anı ezilmez; temiz kaydına bakılmaz.**

- Kod: `src/pages/api/uye/admin.ts:117-122, :167-183 (:182 `isNull(flaggedAt)`, `ne(role, "admin")`)`
- Test: YOK
- Mutasyon: admin.ts:167 `else if (kaldir)` -> `else` (reddedilen şikâyet de işaretler), :182'den `ne(role,"admin")` ya da `isNull(flaggedAt)` silinmesi, ya da bloğun tümünün silinmesi HAYATTA KALIR.
- Not: En küçük test: bloğu `src/lib/sikayet.ts`'e `sikayetYaptirimi(tur, hedefId)` olarak çıkar; entegrasyon: üye -> flagged_at dolu; admin rolü -> NULL; önceden işaretli -> flagged_at aynı değer. Kod notu: açık bir şikâyet kaydının VAR olduğu doğrulanmıyor (:117-121 yalnız tür + id) -> admin elle POST ile herhangi bir üyeyi işaretleyebilir (yalnız admin; düşük risk).

**8. [YOK] Mesaj şikâyetinde 'Haklı' mesajın GÖNDERENİNİ işaretler; mesaj bulunamazsa kimse işaretlenmez.**

- Kod: `src/pages/api/uye/admin.ts:169-178`
- Test: YOK
- Mutasyon: admin.ts:175 `senderId` -> `recipientId` yapılırsa HAYATTA KALIR — şikâyet EDEN (mağdur) işaretlenir, liderlikten düşer, bekleyenleri tutulur.
- Not: En küçük test (bir önceki satırdaki lib fonksiyonuyla): mesaj A->B, hedef = mesaj id -> A.flagged_at dolu, B NULL; olmayan mesaj id -> hiçbir üye değişmez. Mesaj id'si aynı sayısal id'li ÜYEYLE karışmamalı: tür dalı :170'te açık, testte id'leri bilerek çakıştır.

**9. [YOK] /uye/admin yalnız admin'e açılır (değilse /uye'ye yönlendirir); kuyruk formu `userId` + `flag_clear` gönderir, `flag_confirm` düğmesi yalnız tutulan > 0 iken görünür.**

- Kod: `src/pages/uye/admin.astro:14-15, :125, :137-168 (:157-163); şikâyet düğmeleri :341-344`
- Test: YOK (tests/e2e/ekonomi.spec.ts:6-7 admin ekranının sınanmadığını açıkça yazar)
- Mutasyon: admin.astro:15 silinirse HAYATTA KALIR (ekonomi kartı, kuyruk ve onay bekleyen yazı içerikleri her üyeye açılır). :158 `name="userId"` başka ada dönerse iki düğme de sessizce no-op olur (admin.ts:198 `flagUserId = 0`) ve HAYATTA KALIR. :159 `u.tutulan > 0` koşulu silinirse HAYATTA KALIR.
- Not: En küçük testler: (a) auth e2e (salt okunur, canlıda güvenli): test üyesi `/uye/admin` -> son URL `/uye`, `[data-suistimal-kuyrugu]` yok; (b) kuyruğu `src/features/admin/SuistimalKuyrugu.astro`'ya çıkar, tests/component/ekonomi-karti.test.ts deseniyle AstroContainer: `name="userId" value="42"` var, tutulan 0 iken `flag_confirm` yok, > 0 iken var.

**10. [YOK] Geçerli her belge gezintisi bir invite_visits satırı yazar (ip_hash = HMAC(clientAddress), ua_hash, kanal); aynı IP'den son 60 sn'de 60 ve üzeri ziyaret varsa 429 döner ve satır yazılmaz.**

- Kod: `src/features/davet/karsilama.ts:30-36, :37-47, :49-54 (hash: src/lib/davet.ts:53-56)`
- Test: Satır yazımı ve 429 için YOK; yalnız hash kararlılığı: tests/unit/davet.test.ts:71-76
- Mutasyon: karsilama.ts:49-54 (insert) silinirse HAYATTA KALIR — e2e yalnız 302 + çerez bakar (davet.spec.ts:8-13) -> taramanın TEK kanıt kaynağı sessizce kurur, kimse işaretlenmez. :32 `Astro.clientAddress` sabit değere dönerse (tüm ziyaretler tek IP) HAYATTA KALIR -> 5 gerçek davetlisi olan herkesin davetlileri işaretlenir. :46 `>=` -> `>` ya da frenin silinmesi HAYATTA KALIR.
- Not: En küçük test (misafir e2e; bu spec zaten her koşumda ziyaret yazıyor): `/d/DEM07KQ` öncesi / sonrası `select count(*) from invite_visits where invite_code_id = ...` -> +1; `sec-fetch-dest: image` isteğinde +0; son satırın ip_hash'i 32 hex. Doğrulanmadı: Vercel'de `Astro.clientAddress` gerçek istemci IP'si mi — :33 catch'ine düşerse hepsi '0.0.0.0' tek IP'ye çöker ve tarama sahte pozitif üretir. Tekilleştirme yok: tek kişi sayfayı 5 kez yenileyerek 'tek IP >= 5' koşulunu tek başına sağlar. KAPSAM NOTU: salt okunur çalışıldı — hiçbir test, sorgu ya da sunucu koşturulmadı; 'kırılır / hayatta kalır' hükümleri kod ve test okumasından türetildi, koşumla doğrulanmadı. İşaretin lider / lig / puanOlayi / havuz etkileri (league.ts, social.ts, rewards.ts) bu alanın dışında bırakıldı.

**11. [ZAYIF] Hesap eşiği: bir davetçinin koduyla katılan yeni hesap sayısı (24 s penceresindeki en yüksek sayım) SUISTIMAL_ESIK'ten (5) azsa davetçi şüpheli sayılmaz.**

- Kod: `src/lib/ekonomi.ts:224-226 (sabit: src/lib/economy.ts:291)`
- Test: tests/integration/faz5-db.test.ts:254-255 (4 kukla -> bos), :262-263 (5 kukla -> isaret); saf: tests/unit/faz5-ekonomi.test.ts:169
- Mutasyon: ekonomi.ts:226 `having max(pencere) >= ESIK` silinir ya da `>= 4` yapılırsa HAYATTA KALIR: :255'teki eşik-altı durumda 4 hesap VE tek IP'den yalnız 4 ziyaret var; sonucu boş bırakan aslında IP koşulu (:235 `max(i.n) >= 5`). `>` yapılırsa (6 gerekir) :263 kırılır; sabit 4'e inerse :255 kırılır (iki eşik yalnız BİRLİKTE sabitlenmiş).
- Not: En küçük test: faz5-db.test.ts:254'ten hemen sonra tek satır `await ziyaret("kukla")` ekle (4 hesap + tek IP'den 5 ziyaret) -> :255 hâlâ boş beklemeli. Sonraki iddialar değişmez (kukla IP'si 6 ziyaret olur).

**12. [ZAYIF] Tek IP eşiği: davetçinin kodlarına aynı ip_hash'ten son 48 saatte en az 5 ziyaret gelmemişse işaret yok.**

- Kod: `src/lib/ekonomi.ts:227-231, :235 (`max(i.n) >= ESIK`)`
- Test: SQL için YOK; yalnız saf eşlenik: tests/unit/faz5-ekonomi.test.ts:170
- Mutasyon: ekonomi.ts:235'ten `max(i.n) >= ESIK and` silinirse HAYATTA KALIR: faz5-db.test.ts:255 hesap eşiğinden (4 hesap yogun'a girmez), :260 farklı-IP koşulundan (3 IP x 2 > 5) boş döner, :263 zaten işaretler. `>= 4` de hayatta kalır. Yalnız `> 5` :263'ü kırar (tam 5 ziyaret).
- Not: En küçük test: 5 kukla ama aynı IP'den 4 ziyaret (5. kukla ziyaret satırı yazmadan katılır) -> boş; 5. ziyaret eklenince işaret. Koşul silinirse '5 hesap + toplam 1 ziyaret' de işaretlenir (4 gerçek davetli `?d=` ile, 1'i `/d/` ile gelmiş) -> sahte pozitif.

**13. [ZAYIF] Bağ tanımı: hesap, davetçinin kurs YA DA etkinlik davet koduyla katılmış olmalı; aynı (hesap, davetçi) çifti bir kez sayılır (union); hesabın kendi kodu sayılmaz; platform daveti (referrals) bağ DEĞİLDİR.**

- Kod: `src/lib/ekonomi.ts:214-218, :223 (`b.inviter_id <> u.id`)`
- Test: Yalnız kurs dalı: tests/integration/faz5-db.test.ts:250
- Mutasyon: ekonomi.ts:216-217 (etkinlik dalı) silinirse, `union` -> `union all` yapılırsa, `b.inviter_id <> u.id` silinirse ya da `referrals` bağa geri eklenirse HAYATTA KALIR (test :249'da referrals satırını zaten yazıyor). Yalnız :215 (kurs dalı) silinirse :263 kırılır.
- Not: En küçük testler: (a) 5 kukla `event_rsvps.invite_code_id` ile -> işaret; (b) 3 kukla aynı davetçinin iki ayrı kurs koduyla 2'şer katılım (6 satır) + tek IP'den 5 ziyaret -> boş (union all olsa 6 sayardı); (c) yalnız referrals satırı olan, kodla katılmamış 5 kukla -> boş (09fc098'de bağdan çıkarıldı). Kendi kodu dalı normal akışta erişilmez (src/lib/davet.ts:234, src/lib/etkinlik.ts:195 kodu katılımda düşürür) — derinlemesine savunma.

**14. [ZAYIF] İşaretlenen küme: şüpheli davetçinin son 48 saatte kodla katılan TÜM yeni hesapları (yoğun 24 s penceresinin dışındakiler dahil); davetçinin kendisi işaretlenmez.**

- Kod: `src/lib/ekonomi.ts:237-241 (`from yeni y join supheli s`)`
- Test: tests/integration/faz5-db.test.ts:262-264 (küme = 5 kukla), :267 (davetçi NULL)
- Mutasyon: `u.id = y.id` -> `u.id = y.inviter_id` olursa :263 ve :267 kırılır (güçlü kısım). Kümeyi yalnız yoğun penceredeki hesaplara daraltan bir değişiklik HAYATTA KALIR: testte pencere dışı hesap yok.
- Not: Gereksinimle belirsizlik: belgeler 'o hesaplar işaretlenir' der (docs/assumptions.md #64, ekonomi.ts:197-199); kod, 5 kukladan 30 saat sonra aynı kodla gelen gerçek üyeyi de işaretler. En küçük test: 5 kukla (şimdi) + 1 hesap 30 saat önce -> beklenen sayı (6 mı 5 mi) önce Yusuf'a sorulmalı, sonra sabitlenmeli. Çiftliğin sahibi (davetçi) hiç işaretlenmez; yalnız kaynağı işaretli bekleyenleri tutulur.

**15. [ZAYIF] suistimalMi(yeniHesap, enCokIpZiyaret, farkliIp), SQL'in (yogun + supheli HAVING) kararıyla aynı kararı verir.**

- Kod: `src/lib/economy.ts:300-302 <-> src/lib/ekonomi.ts:226, :235`
- Test: tests/unit/faz5-ekonomi.test.ts:165-179 (yalnız saf); eşitliği sınayan test YOK
- Mutasyon: Yalnız SQL'de `<=` -> `<`, `* 2` -> `* 3` (ya da :226 / :235 eşiklerinden biri gevşetilirse) birim testleri geçer; entegrasyon yalnız `* 2`'nin silinmesini yakalar -> çoğu HAYATTA KALIR. Aynı mutasyonlar saf fonksiyonda unit :168-176 ile yakalanır.
- Not: Satır satır: (1) `yeniHesap >= ESIK` <-> :226 `max(pencere) >= ESIK` AYNI; (2) `enCokIpZiyaret >= ESIK` <-> :235 `max(i.n) >= ESIK` AYNI; (3) `farkliIp * 2 <= yeniHesap` <-> :235 `count(*) * 2 <= y.hesap` AYNI. Karar çekirdeği özdeş, aynı sabit. Saf fonksiyonun MODELLEMEDİĞİ girdiler: 24 s penceresi / 48 s bakış, union ve kendi kodu, yalnız member, temiz kaydı, flagged_at is null, işaretlenen kümenin `yeniHesap`tan büyük olabilmesi. Ziyaretsiz davetçi: SQL'de satır yok, safta enCok=0 -> false (aynı sonuç). Safta (farkliIp=0, enCok>=5) true döner; SQL'de erişilemez. En küçük test: entegrasyonda her senaryodan sonra üç girdiyi DB'den say, `suistimalMi(...) === (sonuç boş değil)` iddia et (mesaj-db'deki dmKarar eşitliği deseni).

**16. [ZAYIF] Admin 'Temiz' (flag_clear): flagged_at = NULL yapılır VE cron_runs('suistimal-temiz', userId) kaydı yazılır.**

- Kod: `src/pages/api/uye/admin.ts:198-202`
- Test: Yalnız eşlenik: tests/integration/faz5-db.test.ts:302-304 aynı iki adımı ELLE tekrarlar, rotayı çağırmaz
- Mutasyon: admin.ts:201 (`birKez`) ya da :200 (update) silinirse HAYATTA KALIR.
- Not: En küçük test: iki adımı `src/lib/ekonomi.ts`'e `isaretiKaldir(userId)` olarak çıkar; rota ve test (:303-304 yerine) aynı fonksiyonu çağırsın. Kod notları: hesabın işaretli olduğuna bakılmaz -> herhangi bir id'ye önceden kalıcı tarama bağışıklığı yazılabilir; şikâyet kaynaklı işaret de aynı düğmeyle kalkar ve hesap taramaya bağışık olur (belgede yalnız tersi yazıyor: admin.ts:196-197).

**17. [ZAYIF] Admin 'Suistimal' (flag_confirm): YALNIZ hâlâ işaretli hesapta bekleyenler düşürülür; işaret kalır.**

- Kod: `src/pages/api/uye/admin.ts:205-211`
- Test: Lib kısmı: tests/integration/faz5-db.test.ts:341-342; 'işaretli mi' kapısı için YOK
- Mutasyon: admin.ts:210 `if (hesap?.flaggedAt)` silinirse HAYATTA KALIR (yanlış ya da bayat id ile temiz üyenin bekleyeni düşer).
- Not: En küçük test: kapıyı `bekleyenleriDusur` SQL'ine taşı (`and exists (select 1 from users where id = $1 and flagged_at is not null)`) ve entegrasyonda temiz üye için 0 döndüğünü, satırların pending kaldığını iddia et. Kontrol ile düşürme iki ayrı sorgu (oku-sonra-yaz; tek admin, düşük risk).

**18. [ZAYIF] bekleyenleriDusur yalnız status='pending' satırlara dokunur; kaynak eşleşmesi refId SONUNDAKİ `u:{id}` ile yapılır.**

- Kod: `src/lib/ekonomi.ts:251-252`
- Test: YOK (çağrı anında k5'in confirmed / expired satırı yok)
- Mutasyon: ekonomi.ts:251 `status = 'pending'` silinirse HAYATTA KALIR: kesinleşmiş satırlar 'expired' olur, resolved_at ezilir -> ekonomi kartının düşen / kesinleşen oranları bozulur (ledger etkilenmez).
- Not: En küçük test: çağrıdan önce k5'e ait bir satırı `confirmed` yap -> dönüş yine 2, o satır `confirmed` ve resolved_at aynı. Aynı regex üç yerde kopya: ekonomi.ts:252, :278 ve src/lib/rewards.ts:94 — biri değişirse 'tutulan', 'olgunlaşmayan' ve 'düşen' kümeleri ayrışır; hiçbir test üçünün aynı kümeyi seçtiğini iddia etmiyor.

**19. [ZAYIF] Suistimal kuyruğu yalnız flagged_at dolu hesapları, işaret anına göre yeniden eskiye, en çok 100 satır döndürür; saatler TR (+3).**

- Kod: `src/lib/ekonomi.ts:259-285 (:272-273, :280-282)`
- Test: tests/integration/faz5-db.test.ts:291-292 (yalnız k2 satırı aranıyor)
- Mutasyon: ekonomi.ts:280 `where u.flagged_at is not null` silinirse muhtemelen HAYATTA KALIR (k2 hâlâ listede; yalnız `desc` sıralamada NULL'lar öne geçip 100 sınırı k2'yi keserse kırılır — canlı DB üye sayısına bağlı, doğrulanmadı). `limit 100`, `order by`, `+ interval '3 hours'` değişiklikleri HAYATTA KALIR.
- Not: En küçük test: aynı yerde `expect(kuyruk.find((r) => r.id === davetci.id)).toBeUndefined()` ve `kuyruk.every((r) => r.isaret)`; `acilis` için `/^\d\d\.\d\d \d\d:\d\d$/`. Başlıktaki sayı 100'de doyar (src/pages/uye/admin.astro:138).

**20. [ZAYIF] Kuyruk satırında tutulan = hesaba ait + ondan doğan bekleyen toplamı; 'davet eden' platform davetçisidir (referrals).**

- Kod: `src/lib/ekonomi.ts:274-278`
- Test: tests/integration/faz5-db.test.ts:291-292 (`davet_eden: davetci.handle, tutulan: 22`)
- Mutasyon: ekonomi.ts:278'de iki daldan biri silinirse 22 yerine 5 ya da 17 -> :292 kırılır (güçlü kısım). `p.status = 'pending'` silinirse HAYATTA KALIR. `davet_eden`: test :249'da referrals satırını ELLE yazdığı için geçiyor.
- Not: Gereksinimle fark (09fc098 sonrası, incelenmemiş): tarama bağdan `referrals`'ı çıkardı (ekonomi.ts:214-218 yalnız invite_codes) ama kuyruk hâlâ `referrals`'tan okuyor -> `?d=` ile ya da ysf_ref çerezi olmadan kaydolan kuklada 'davet eden' boş; başka bir platform davetçisi varsa YANLIŞ kişi görünür, işareti tetikleyen kod sahibi gösterilmez. En küçük test: referrals satırı OLMAYAN kukla -> beklenen `davet_eden` = kod sahibi (bugün null döner -> kırmızı -> sonra SQL düzeltilir).

**21. [güçlü] Az ağ, çok hesap: ziyaret eden FARKLI IP sayısı x 2, hesap sayısını geçiyorsa işaret yok (dışarıdan eklenen ziyaret yalnız IP ekler).**

- Kod: `src/lib/ekonomi.ts:232-235 (`count(*) * 2 <= y.hesap`)`
- Test: tests/integration/faz5-db.test.ts:257-260 (5 hesap, 3 IP -> bos), :261-263 (1 IP -> isaret); saf: tests/unit/faz5-ekonomi.test.ts:171-176
- Mutasyon: `count(*) * 2` -> `count(*)` yapılırsa ya da koşul silinirse faz5-db.test.ts:260 kırılır (3 <= 5 -> işaretler). SINIR: `<=` -> `<` HAYATTA KALIR — 5 hesapla eşitlik oluşamaz (tek sayı); eşitlik yalnız saf testte (unit :175, [6,6,3]).
- Not: Sınır için en küçük test: 6 kukla + 3 IP (biri >= 5 ziyaret) -> işaret; 4. IP eklenince boş. `count(*)` davetçinin TÜM kodlarının 48 saatteki tüm IP'lerini sayar; hesapların 24 s penceresiyle ilişkilendirilmez.

**22. [güçlü] Idempotent: zaten işaretli hesap yeniden yazılmaz; ikinci tarama boş döner, ilk işaret anı korunur.**

- Kod: `src/lib/ekonomi.ts:237-239 (`u.flagged_at is null`)`
- Test: tests/integration/faz5-db.test.ts:268
- Mutasyon: `u.flagged_at is null` silinirse ikinci çağrı 5 satır döndürür -> faz5-db.test.ts:268 kırılır.
- Not: flagged_at değerinin değişmediği ayrıca iddia edilmiyor; dönüşün boş olması yeterli kanıt.

**23. [güçlü] Admin'in 'temiz' kaydı (cron_runs job='suistimal-temiz', period_key=userId) olan hesap yeniden işaretlenmez; temiz ve zaten işaretli hesaplar eşik sayımında KALIR (kümedeki diğerleri yine işaretlenir).**

- Kod: `src/lib/ekonomi.ts:240, :193`
- Test: tests/integration/faz5-db.test.ts:300-308
- Mutasyon: `not exists (... cron_runs ...)` silinirse k3 yeniden işaretlenir -> :306 ([k1] beklenir) ve :307 kırılır. `yeni` CTE'sine `flagged_at is null` ya da temiz filtresi eklenirse sayım 2'ye düşer, k1 işaretlenmez -> :306 kırılır.
- Not: Yalnız lib düzeyi: kaydı YAZAN rota kodu ayrı satırda (flag_clear). Bağışıklık süresizdir (kayıt hiç silinmez). `u.id::text` <-> `String(flagUserId)` eşleşmesi yalnız bu testte.

**24. [güçlü] bekleyenleriDusur: hesaba AİT (user_id) ve ondan DOĞAN (refId sonu `u:{id}`) bekleyen satırlar 'expired' olur ve geri gelmez.**

- Kod: `src/lib/ekonomi.ts:247-256 (:252)`
- Test: tests/integration/faz5-db.test.ts:339-342, :343-347
- Mutasyon: ekonomi.ts:252'de `user_id = X` ya da `substring(...)::int = X` dalı silinirse dönüş 1 olur -> :341 (2 beklenir) kırılır. Düşen satırın işaret kalkınca kesinleşmediği :347'de.
- Not: `course_launched` (refId `course:{id}`, `u:` yok) bekleyeni düşürülmez; :346 bunu dolaylı sınar (işaretler kalkınca +50 yazılır). Yalnız lib düzeyi — rota kapısı ayrı satırda.

**25. [güçlü] Alt-kaynak isteği (sec-fetch-dest document değil) ve çözülemeyen kod ziyaret satırı YAZMAZ, çerez kurmaz.**

- Kod: `src/features/davet/karsilama.ts:19, :20-28`
- Test: tests/e2e/davet.spec.ts:24-27 (204, set-cookie yok), :33-38; saf: tests/unit/istek-freni.test.ts:7-18
- Mutasyon: karsilama.ts:19 silinirse davet.spec.ts:26 kırılır (204 beklenir, 302 gelir). :21 geçersiz-kod dalı silinirse `hedef.kod.id` null hatası -> davet.spec.ts:35 (302 beklenir, 500 gelir) kırılır.
- Not: Satırın OLUŞMADIĞI doğrudan sayılmıyor; erken dönüş insert'ten önce olduğu için yapısal olarak garantili. Başlıksız istek (curl, eski tarayıcı) geçer -> üçüncü kişi ziyaret ekleyebilir; tarama kuralı bunu 'yalnız IP ekler' diye tolere ediyor.

### 4.5 · F5-04 sıralamalar · F5-03 ekonomi kartı · yayın kapısı — 25 kural (güçlü 4, zayıf 8, testsiz 13)

**1. [YOK] Liderlik penceresi: t=7 son 7 gün (varsayılan), t=30 son 30 gün, diğer her değer tüm zamanlar; yalnız delta > 0 satırlar; toplam azalan, ilk 20.**

- Kod: `src/pages/lider.astro:15`
- Test: YOK
- Mutasyon: HAYATTA KALIR: 18. satırda 7*864e5 -> 70*864e5, 25. satırdaki since koşulu silinse, 46'da desc kalksa ya da 47'de limit(20) -> limit(200) olsa hiçbir test kırılmaz (ekonomi.spec yalnız Elif bağlantısının var/yok olduğuna bakar).
- Not: En küçük test: entegrasyon tercih edilir. Sorguyu lib/league.ts içine bireyselSiralama(since, limit) olarak taşı; faz5-db testinde geçici üyeye doğrudan ledger insert ile createdAt = now-8g (+40), now-31g (+50), now (+30) ve bir negatif satır yaz; since=7g -> 30, since=30g -> 70, null -> 120 bekle. Şüphe (Faz 5 öncesi): 174. satır seviyeyi dönem toplamından hesaplıyor (levelFor(r.total)); 7 günlük sekmede üyenin gerçek seviyesi değil 7 günlük puanının seviyesi yazıyor.

**2. [YOK] Üniversite takım tablosu: işaretli üyenin puanı toplama ve üye sayısına girmez; yalnız university dolu üyeler; sekmeden bağımsız tüm zamanlar; ilk 10.**

- Kod: `src/pages/lider.astro:58`
- Test: YOK
- Mutasyon: HAYATTA KALIR: 58. satırdan isNull(schema.users.flaggedAt) silinse hiçbir test kırılmaz. ekonomi.spec yalnız '/u/elif-celik' bağlantısını arar; üniversite satırında handle yok.
- Not: PRD 4.2 'liderlik hesaplarında görünmez' ve varsayım #65 üniversite tablosunu açıkça sayıyor; testsiz. En küçük test (ekonomi.spec, aynı işaret penceresi): Elif seed'de tek Boğaziçili demo üye (scripts/seed-demo.ts:163). İşaretlemeden önce '🎓 Üniversiteler' başlığından SONRAKİ HTML'de 'Boğaziçi' satırının '{toplam} p · {n} üye' değerini oku; işaretlenince toplam Elif'in puanı kadar ve n bir düşmeli (ya da satır kaybolmalı). 'Boğaziçi' Elif'in kendi satırında da geçtiği için aside'a daraltmak şart; canlıda gerçek Boğaziçili üye olabilir, o yüzden mutlak değil FARK sınanmalı.

**3. [YOK] Kulüpler ligi (kulupSiralamasi): yalnız approved kulüpler; işaretli üyenin puanı ham toplama VE karekök-üye paydasına girmez; normalized = round(raw / sqrt(n)), n = 0 ise 0; normalized azalan.**

- Kod: `src/lib/league.ts:100`
- Test: YOK
- Mutasyon: HAYATTA KALIR: 105. satırdaki isaretsizler(...) sarmalayıcısı kaldırılsa hiçbir test kırılmaz. faz5-db.test.ts:310 yalnız kulupIciSiralama çağırır ve test kulübü status:'pending' (satır 315) olduğundan kulupSiralamasi'na zaten giremez. 122. satırda Math.sqrt kaldırılsa da kırılmaz: league-rewards.test.ts:6 normalizeSkor'u sınar ama kulupSiralamasi normalizeSkor'u ÇAĞIRMAZ (formül kopya).
- Not: F5-04'ün 'lig' yarısı (kulüp skoru + payda) tamamen testsiz; çağıranlar lider.astro:73, kulup/[slug].astro:127, gunluk.ts:40 (şampiyon seçimi). En küçük test: (a) e2e ekonomi.spec: /lider?t=lig içinde demo ODTÜ kulübü satırı '{n} üye · ham {x}p' (lider.astro:146); Elif üye (seed-demo.ts:259) işaretlenince n bir azalmalı, ham düşmeli. (b) entegrasyon: faz5 lig testinde kulübü try/finally içinde kısa süre approved yapıp sonucu clubId ile süz -> memberCount 1, raw 30, normalized 30 (dev = canlı: kulüp saniyelerce /lider ve /kulupler'de görünür). 122. satır normalizeSkor'u çağırmalı. Gözlem: lig satırındaki üye sayısı işaretliyi düşer, kulüp sayfasındaki members.length düşmez (kulup/[slug].astro:183) -> iki sayı kıyaslanınca işaretli üye varlığı anlaşılır; 'işaret söylenmez' ilkesiyle sürtüşüyor, karar gerekir.

**4. [YOK] Sezon kapanışı ilk 10 ödülü: sezon penceresi [startsAt, endsAt) içindeki pozitif puan toplamı, işaretli hariç (isaretsizKazananSql), azalan, ilk 10 -> hazineKitabiAc('reward') + bildirim.**

- Kod: `src/pages/api/cron/gunluk.ts:62`
- Test: YOK
- Mutasyon: HAYATTA KALIR: 74. satır (isaretsizKazananSql) silinse, limit(10) -> limit(100) olsa ya da social.ts:13'te 'is not null' -> 'is null' yapılsa hiçbir test kırılmaz. Cron ucu ve sezonKapat hiçbir testte çağrılmıyor (sezonKapat export değil).
- Not: Bu sorgu Faz 5 ekiyle hiç ÇALIŞTIRILMADI; ilk gerçek koşum merge sonrası ay başı cron'u. Ayrıca 72-73. satırlar ham sql içine Date nesnesi geçiriyor; CLAUDE.md'nin kendi kuralı '${d.toISOString()}::timestamp yaz' diyor. Kayma olup olmadığı doğrulanmadı (Faz 5 öncesi kod). En küçük test: ilk-10 sorgusunu lib/league.ts'e sezonIlkOn(start, end, limit) olarak çıkar; faz5 lig testinde temiz 30p + işaretli 90p ile dar pencere (now-5sn, now+5sn) ver -> sonuçta işaretli id YOK, temiz VAR. UYARI: sezonKapat'ı ya da cron ucunu testte ÇAĞIRMA; dev = canlı DB, gerçek sezonu kapatır, rozet ve kitap dağıtır.

**5. [YOK] Sezon şampiyonu rozeti: şampiyon kulübün TÜM üyelerine 'sezon-sampiyonu' rozeti ve bildirim verilir; işaret süzgeci YOK.**

- Kod: `src/pages/api/cron/gunluk.ts:47`
- Test: YOK
- Mutasyon: HAYATTA KALIR: 48-50. satırlardaki clubMembers sorgusuna işaret filtresi eklense de çıkarılsa da hiçbir test fark etmez.
- Not: GEREKSİNİMLE FARK ADAYI: şampiyon isaretsizler'den geçen skorla seçilir (işaretli katkı vermez) ama rozet filtresiz üye listesine dağıtılır; işaretli üye ödül alır. Varsayım #65'in sayım listesinde (lig puanı/paydası, kulüp içi, özel lig, grup katkısı, sezon ilk 10) bu yok; bilinçli mi unutulmuş mu belgede yazmıyor. Karar rozet ödül sayılırsa: isaretsizler'i export edip 48. satırı ondan geçir. Test: kapanışın rozet kısmı lib'e çıkarılınca entegrasyon.

**6. [YOK] Cron sırası: suistimal taraması her şeyden ÖNCE koşar (sezon / özel lig kapanışından ve bekleyenlerden önce), kilitsiz ve her koşumda.**

- Kod: `src/pages/api/cron/gunluk.ts:164`
- Test: YOK
- Mutasyon: HAYATTA KALIR: 164-165. satırlar 4. adımdan sonraya (09fc098 öncesi yerine) taşınsa hiçbir test kırılmaz.
- Not: 09fc098 ile geldi; incelenmedi, testsiz. En küçük test: kaynak-metin bekçisi (tests/unit/istek-freni.test.ts deseni): gunluk.ts metninde GET gövdesi içinde 'suistimalTara(' indeksinin 'sezonKapat(', 'ozelLigleriKapat(' ve 'bekleyenleriIsle(' çağrılarından küçük olduğunu doğrula. Ucu canlı DB'de koşturma.

**7. [YOK] Kulüp grup katkı sıralaması (/kulup/[slug]?t=uyeler): yalnız grup varsa ve sekme uyeler ise; son 30 gün pozitif puan, işaretli hariç; grupsuz üye sayılmaz; azalan; birinciye kupa yalnız toplam > 0.**

- Kod: `src/pages/kulup/[slug].astro:143`
- Test: YOK
- Mutasyon: HAYATTA KALIR: 156. satır (isaretsizKazananSql) silinse kırılmaz. Hiçbir e2e ?t=uyeler açmıyor; bu SQL duman testinden bile geçmiyor (topluluklar.spec.ts:37 yalnız kurslar ve bilinmeyen sekme).
- Not: 09fc098 ile geldi; incelenmedi. En küçük test (ekonomi.spec): /kulup/odtu-yz-okuma-demo?t=uyeler -> 'Roman Takımı' yalnız Elif (seed-demo.ts:511-516) '{N}p/30g', N > 0; işaretlenince '0p/30g'. Seed 30 günden eskiyse N zaten 0 olur: ön koşulu sert doğrula. Aynı sayfanın ?t=lig sekmesi de eklenebilir (kulüp içi katkı listesinde Elif kaybolur; sayfa bağı 129. satır).

**8. [YOK] /uyeler dizini: işaretli üye listede kalır ama sıralamanın sonuna düşer; sonra kazanılan puan azalan; ilk 60.**

- Kod: `src/pages/uyeler.astro:38`
- Test: YOK
- Mutasyon: HAYATTA KALIR: 38. satırdaki ilk sıralama terimi silinse ya da 'is not null' -> 'is null' (işaretliler başa) yapılsa kırılmaz. flows.spec.ts:66 yalnız ?q=Elif tek sonuçta puanı sınar; sıra etkisiz.
- Not: 09fc098 ile geldi; incelenmedi. En küçük test (ekonomi.spec): /uyeler?q=İstanbul -> Elif (460p) ve Mehmet (50p) aynı şehirde (seed-demo.ts:160, 163). Önce Elif bağlantısı Mehmet'ten ÖNCE, işaretlenince SONRA ve Elif hâlâ sayfada. Yalnız iki demo bağlantının göreli sırasına bak (canlıda başka İstanbullu üyeler var). ŞÜPHE: yüksek puanlı üyenin 0 puanlıların arkasında durması işaretin KİMDE olduğunu herkese gösterir; varsayım #65 'işaretin kimde olduğu söylenmez' diyor. Ayrıca 60'tan çok üyede işaretli üye aramasız dizinden fiilen düşer (limit 60).

**9. [YOK] Ekonomi kartı ve suistimal kuyruğu yalnız admin'e: /uye/admin role admin değilse /uye'ye yönlendirir; ekonomiKarti ve isaretliHesaplar yalnız bu sayfadan çağrılır.**

- Kod: `src/pages/uye/admin.astro:15`
- Test: YOK
- Mutasyon: HAYATTA KALIR: 15. satır silinse hiçbir test kırılmaz; kart ekonomi sayılarını, kuyruk işaretli üyelerin adını, handle'ını ve davet edenini her girişli üyeye gösterir.
- Not: CLAUDE.md 'admin sayfası e2e ile sınanamaz' diyor; bu POZİTİF yol için doğru, NEGATİF yol sınanabilir ve sınanmamış. En küçük test: auth e2e (test üyesi admin değil): page.goto('/uye/admin') -> URL /uye; [data-ekonomi-karti] ve [data-suistimal-kuyrugu] sayısı 0. Misafir projesinde request.get('/uye/admin', { maxRedirects: 0 }) -> 30x. Aynı kapı POST /api/uye/admin flag_clear / flag_confirm için de sınanmalı (başka ajanın alanı olabilir).

**10. [YOK] Yayın kapısı: kurs oluşturulurken status = published yalnız (ONAYLI kulübün kursu ya da admin ya da Sv7+) ise, aksi pending. onayliKulupMu: clubId yoksa false, kulüp yoksa false, yalnız status 'approved' ise true. clubId yalnız yönetilen kulüp için kabul edilir.**

- Kod: `src/pages/api/uye/egitim.ts:440`
- Test: YOK
- Mutasyon: HAYATTA KALIR: 441. satırda '(await onayliKulupMu(clubId))' -> 'clubId' (09fc098 öncesi hâl) yapılsa ya da 50'de 'approved' -> 'pending' olsa hiçbir test kırılmaz. kurs.spec'te oluşturma testi yok; entegrasyon API rotasını çağırmıyor; onayliKulupMu export değil.
- Not: 09fc098'in YÜKSEK bulgu düzeltmesinin bir ayağı; incelenmedi ve testsiz (varsayım #66). En küçük test: auth e2e (kurs.spec): test içinde SQL ile test üyesi başkanı olan PENDING kulüp aç (clubs + club_members role president) -> page.request.post('/api/uye/egitim', form: title, clubId, i_0..i_2 kind=youtube + 11 karakterlik id) -> yönlendirme '?onay=1' ve DB'de status 'pending'; kulübü approved yap -> aynı POST -> '?yayin=1'; finally'de kurs, öğeler ve kulübü sil. Ön koşul SERT doğrulanmalı: test üyesi admin değil ve kazanılanı < 2015 (Sv7 eşiği, lib/levels.ts:5); aksi halde her iki durumda published döner ve kural sınanmaz. Daha ucuz ama rota bağını sınamayan seçenek: onayliKulupMu'yu lib'e taşı, faz5-db.test.ts:313'teki pending kulüple false / approved -> true / null -> false / olmayan id -> false. Yan gözlem: işaretli üye Sv7+ ise onaysız yayın hakkını korur (egitim.ts:441, quiz-olustur.ts:50).

**11. [YOK] KOMŞU AÇIK (alan dışı, aynı sınıf; kural kodda YOK): onay bekleyen topluluğun başkanı kampanya açıp görev ödülü onaylayabiliyor; kulüp onayı hiçbir adımda sorulmuyor.**

- Kod: `src/pages/api/uye/kampanya.ts:39`
- Test: YOK
- Mutasyon: HAYATTA KALIR (kural yok): kampanya.ts:39-46 ve gorev.ts:210'a club.status kontrolü eklense de çıkarılsa da hiçbir test fark etmez.
- Not: Kod okumasıyla; uçtan uca ÇALIŞTIRILMADI (doğrulanmadı). Zincir: her üye başvuruyla anında başkan olur (api/uye/kulup.ts:33-49) -> kampanya.ts yalnız canManage(clubRoleOf) bakar -> görev ödülü 500'e kadar (gorev.ts:86) -> görevi kendine atar (gorev.ts:166-173, üyelik yeter) -> teslim eder (193) -> kendi onaylar (210: onaylayan ile üstlenen farklı olmalı koşulu yok) -> task_done +min(ödül x 1,5, kulübün haftalık 1000'i) (226-236). Bütçe KULÜP başına ve task_done'da kişi tavanı yok (tavanIcin varsayılanı undefined, lib/rewards.ts:69) -> kulüp sayısıyla çarpılır; varsayım #66 ve Faz 3 #38 ile birebir aynı desen. Başvuru sayısına sınır görmedim (yalnız kulup.ts:18-50 okundu). En küçük test: auth e2e ya da entegrasyon: pending kulüple POST /api/uye/kampanya -> 403 beklenir (bugün yönlendirme döner, test kırmızı başlar).

**12. [YOK] İşaret süzgeci ALMAMIŞ ödül yolu: event_hosted / event_well_rated düzenleyen payı işaretli hesabın girişini sayar ve pay doğrudan awardPoints ile yazılır (işaretli düzenleyen de alır).**

- Kod: `src/lib/etkinlik.ts:478`
- Test: YOK
- Mutasyon: HAYATTA KALIR (kural yok): girisSayisi'na (478-491) users.flagged_at is null eklense de eklenmese de hiçbir test fark etmez; etkinlik-db testlerinde işaretli hesap yok.
- Not: CLAUDE.md'nin kendi kuralı: 'refId'de u:{kaynak} taşımayan reason işaretle tutulamaz -> eşiği sayarken işaretliyi dışla'. course_launched ve canlılık havuzunda uygulanmış, event_hosted (refId event:{id}, etkinlik.ts:512) için uygulanmamış; varsayım #65 bunu ne dahil ne hariç sayıyor. Kukla hesap girişi fiziksel okutma gerektirdiği için risk düşük, ama dönen QR ile uzaktan mümkün. En küçük test: etkinlik-db 'düzenleyen payı' testine bir işaretli katılımcı ekle; katilimci sayısı o hesabı saymamalı (bugün sayar).

**13. [YOK] Depo geneli tarama sonucu: points_ledger toplamıyla SIRALAMA / ÖDÜL yapan sorgular ve işaret durumu.**

- Kod: `src/lib/harita.ts:99`
- Test: YOK
- Mutasyon: HAYATTA KALIR: aşağıdaki süzgeçsiz yerlerin hiçbirinde işaret davranışını sabitleyen test yok (ne 'etkilenmez' ne 'etkilenir' yönünde).
- Not: SÜZGEÇLİ (doğrulandı): lider.astro:24 ve :58; league.ts:105 ve :135; gunluk.ts:74; topluluk/index.astro:53; kulup/[slug].astro:156; uyeler.astro:38 (sona atar). SÜZGEÇSİZ: (a) harita il içi sıra getEarnedMap ile (harita.ts:99-109) -> BİLİNÇLİ, varsayım #65 'harita sırası etkilenmez'; (b) sezon şampiyonu rozeti (gunluk.ts:47, ayrı satır); (c) event_hosted (ayrı satır); (d) /kurslar 'popüler / en çok bitirilen / en canlı' sıralaması işaretli hesapların katılım ve ilerlemesini sayar (kurslar/index.astro:116-121; dosyada flagged hiç geçmiyor, sayım sorguları okunmadı); (e) şikâyette Sv4+ ağırlığı işaretli hesabı da sayar -> kukla Sv4 hesaplarla otomatik gizleme (api/uye/sikayet.ts:66-71); (f) Sv7 onaysız yayın (egitim.ts:441). SIRALAMA OLMAYAN kişisel toplamlar (sorun değil): member.ts:141 ve :151, rewards.ts:237, uye/index.astro:180, gorev.ts:32, mesaj.ts:55. BAKILMAYANLAR: hiçbir test, sorgu ya da sunucu çalıştırılmadı (salt okunur); tüm mutasyon sonuçları kod okumasına dayanır. Neon sürücüsünün ham sql'de Date parametresini nasıl kodladığı doğrulanmadı. Oturum başında enjekte edilen CLAUDE.md kopyasında 'Ekonomi — Faz 5' bölümü yoktu; daldaki dosyadan (CLAUDE.md:92) okundu.

**14. [ZAYIF] Lig puan penceresi (pozitifPuanlar): yalnız delta > 0; pencere yarı açık [start, end).**

- Kod: `src/lib/league.ts:75`
- Test: tests/integration/faz5-db.test.ts:324
- Mutasyon: HAYATTA KALIR: 90. satırda gt(delta, 0) silinse, 91'de gte -> gt ya da 92'de lt -> lte olsa kırılmaz; testte negatif satır ve pencere dışı satır yok, pencere artı eksi 1 gün.
- Not: En küçük test: aynı teste temiz üyeye (i) createdAt = pencere başından 1 sn önce +40 doğrudan ledger insert, (ii) bir negatif satır (spendPoints ya da revokePoints) ekle; toplam yine 30 kalmalı.

**15. [ZAYIF] Özel lig kapanışı: bitişi geçmiş aktif lig için birKez('ozel-lig', id) kilidi; birinci = kulupIciSiralama(..., 1)[0]; toplamı 0 ise kazanan yok; işaretli üye birinci olamaz; 'lig-birincisi' rozeti.**

- Kod: `src/pages/api/cron/gunluk.ts:123`
- Test: YOK
- Mutasyon: HAYATTA KALIR: 132. satırda kulupIciSiralama yerine filtresiz bir sorgu konsa ya da 133'te '?.total ?' koşulu silinse (0 puanlı üye birinci) kırılmaz. Yalnız lib eşdeğeri sınanıyor (faz5-db.test.ts:310).
- Not: En küçük test: ozelLigleriKapat'ı lib'e çıkarıp (ligId parametreli) faz5 lig testine ekle: test kulübünde bitmiş özel lig -> winnerId temiz üye, işaretli üyede rozet yok. Kilit satırı cron_runs'ta kalır; afterAll'da sil.

**16. [ZAYIF] Akış mini liderliği (/topluluk sağ ray 'Bu hafta'): son 7 gün pozitif puan, işaretli hariç, azalan, ilk 5.**

- Kod: `src/pages/topluluk/index.astro:46`
- Test: tests/e2e/community.spec.ts:4
- Mutasyon: HAYATTA KALIR: 53. satırdan 'and ${isaretsizKazananSql}' silinse ya da social.ts:13'te koşul ters çevrilse kırılmaz. community.spec yalnız sayfanın açıldığını sınar (SQL sözdizimi duman testi), içerik sınamaz.
- Not: En küçük test (ekonomi.spec, aynı işaret penceresi): 'Bu hafta' bloğuna data-mini-lider niteliği ekle (Elif akış gönderilerinde de geçer; blok daraltılmadan beklenti anlamsız). Önce blokta '/u/elif-celik' VAR (seed 7 günden eskiyse sert hata: npm run seed:demo), işaretlenince YOK. isaretsizKazananSql düz metin 'points_ledger' adına bağlı (social.ts:12); üç kullanım da takma adsız çekirdek select, doğru.

**17. [ZAYIF] Ekonomi kartı basilan / aktif: son 7 gün (created_at > now() - 7 gün) delta > 0 satırların toplamı; aktif = bu satırlardaki farklı user_id sayısı.**

- Kod: `src/lib/ekonomi.ts:155`
- Test: tests/integration/faz5-db.test.ts:352
- Mutasyon: HAYATTA KALIR: 157. satırda '7 days' -> '70 days' ya da 171'de distinct kaldırılsa hiçbir beklenti kırılmaz; 'delta > 0' silinse de büyük olasılıkla kırılmaz (veriye bağlı). Test yalnız tip (expect.any(Number)) ve aynı CTE'den türeyen iç tutarlılığı (kaynaklar toplamı = basilan) sınar; canlı DB'de mutlak değer sınanamıyor.
- Not: En küçük test = FARK testi: once = ekonomiKarti(); taze test üyesine awardPoints +13 quiz, +7 referral_activated, +11 event_invite_welcome; bir negatif satır (-5); doğrudan ledger insert +17 createdAt = now-8g; sonra = ekonomiKarti(). Beklenti: basilan farkı 31, aktif farkı 1, davet farkı 18. Aynı anda canlıda gerçek puan yazılırsa oynar: bir kez yeniden dene ya da alt/üst sınırla.

**18. [ZAYIF] Ekonomi kartı davet payı sayacı: reason DAVET_KAYNAKLI içindeyse (davet tavanı listesi + referral_activated + event_invite_welcome; vitality_pool hariç).**

- Kod: `src/lib/ekonomi.ts:172`
- Test: tests/integration/faz5-db.test.ts:359
- Mutasyon: HAYATTA KALIR: 172. satırdaki 'where reason in (...)' tamamen silinse davet = basilan olur; '>= 20', '<= basilan' ve davetPayi '<= 1' beklentilerinin hepsi geçer. rewards.ts:85'ten 'referral_activated' ya da 'event_invite_welcome' çıkarılsa da kırılmaz; liste içeriği için tek beklenti 'vitality_pool yok' (tests/unit/faz5-ekonomi.test.ts:29).
- Not: PRD 4.9'un tek sayısal eşiği (%40) bu sayıya bağlı ve süzgeci fiilen testsiz. En küçük: birim testte expect(DAVET_KAYNAKLI).toEqual([...DAVET_REASONLARI, 'referral_activated', 'event_invite_welcome']) + bir önceki satırdaki fark testi (quiz'in 13'ü davete GİRMEMELİ).

**19. [ZAYIF] Ekonomi kartı bekleyen sayaçları: son 7 günde resolved_at olanlardan kesinlesen = confirmed; kirpilan = confirmed ve yazilan < delta; dusen = expired; bekleyen = şu an pending SATIR sayısı (tüm zamanlar, işaretle tutulanlar dahil).**

- Kod: `src/lib/ekonomi.ts:175`
- Test: tests/integration/faz5-db.test.ts:362
- Mutasyon: HAYATTA KALIR: 176. satırda 'yazilan < delta' -> 'yazilan <= delta' (her kesinleşen kırpılmış sayılır) kırılmaz; tek beklenti 'kesinlesen >= kirpilan' alt küme totolojisi. 160'ta '7 days' değişse ya da 178'de 'pending' filtresi kalksa da kırılmaz.
- Not: En küçük = fark testi: test üyesine bekleyenYaz ile 3 satır (maturesAt geçmiş): biri tavansız reason (tam yazılır), biri tavanı önceden awardPoints ile doldurulmuş reason (ör. answer_accepted günlük tavan) -> yazilan < delta, biri expiresAt geçmiş; bekleyenleriIsle(now, userId) sonrası kesinlesen +2, kirpilan +1, dusen +1. TANIM SORUSU (Yusuf): admin 'Suistimal' kararıyla düşürülenler de expired + resolved_at yazıyor (ekonomi.ts:250, api/uye/admin.ts:144) -> 'düşen oranı' doğal süre aşımıyla yaptırımı karıştırıyor; varsayım #63 bunu söylemiyor.

**20. [ZAYIF] Ekonomi kartı hunileri (son 30 gün): kurs = joined_at son 30 günde olan katılımlar, aktif = activated_at dolu, biten = completed_at dolu (ne zaman olduğuna bakılmaz); etkinlik = bitişi (coalesce(ends_at, starts_at + 2 saat)) son 30 gün içinde VE geçmişte olan etkinliklerin kayıtları, giriş = checked_in_at dolu.**

- Kod: `src/lib/ekonomi.ts:161`
- Test: tests/integration/faz5-db.test.ts:361
- Mutasyon: HAYATTA KALIR: 163. satırda '30 days' -> '7 days', 180-181 yer değiştirse, 167'de üst sınır 'and now()' kalksa ya da '2 hours' -> '20 hours' olsa kırılmaz. Kurs için tek beklenti 'kursKatilim >= kursAktif' (count(kolon) <= count(*) totolojisi); etkinlik hunisinde yalnız tip sınanıyor.
- Not: En küçük = fark testi: (kurs) test kursuna 3 katılım: A joined now + activated, B joined now + activated + completed, C joined now-31g + activated -> katilim +2, aktif +2, biten +1. (etkinlik) test üyesinin kulüpsüz etkinliği bitiş now-1g + 2 kayıt (1'i girişli) ve gelecekte bir etkinlik + 1 kayıt -> kayit +2, giris +1. Tanım notu: işaretli hesaplar, yayından kalkmış kurslar ve elle girişler hunilere dahil; belgede yazmıyor.

**21. [ZAYIF] EkonomiKarti bileşeni: uyarı bandı yalnız davetUyari iken; yüzde = round(x * 100); kaynak listesi boşsa hiç çizilmez; boş haftada NaN / Infinity yok; kutular doğru alanı gösterir.**

- Kod: `src/features/admin/EkonomiKarti.astro:22`
- Test: tests/component/ekonomi-karti.test.ts:26
- Mutasyon: Güçlü kısım: 23. satırdaki o.davetUyari koşulu silinirse :37 kırılır; 55'teki uzunluk koşulu silinirse :45 kırılır. HAYATTA KALIR kısım: 46'da kart.bekleyen yerine kart.dusen yazılsa, 47'de kırpılan / düşen yer değiştirse ya da 51-52'de huni sayıları karışsa kırılmaz (fixture'daki 7, %20, %33, '20 katılım', '40 kayıt' için beklenti yok).
- Not: En küçük: aynı fixture ile üç toMatch ekle: /kırpılan %20 · düşen %33/, /20<\/strong> katılım → 10 aktivasyon \(%50\) → 5 tamamlama \(%25\)/, /40<\/strong> kayıt → 30 giriş \(%75\)/ ve bekleyen kutusu için dd'ye data-bekleyen ekleyip '>7<' bekle. Kozmetik: 0,396 pay '%40' yazar ama uyarı çıkmaz (yuvarlama ile eşik ayrı).

**22. [güçlü] Bireysel liderlik tablosunda (7 gün / 30 gün / tüm zamanlar) işaretli (flagged_at dolu) üye görünmez.**

- Kod: `src/pages/lider.astro:24`
- Test: tests/e2e/ekonomi.spec.ts:9
- Mutasyon: 24. satırdaki conds dizisinden isNull(schema.users.flaggedAt) silinirse ekonomi.spec.ts:21 (not.toContain('/u/elif-celik')) kırılır. Üç sekme aynı conds dizisini paylaştığı için 'all' sekmesinin sınanması yeter.
- Not: Kısıtlar: (1) POSTGRES_URL yoksa test.skip ile sessizce atlanır (ekonomi.spec.ts:10). (2) 7 ve 30 sekmeleri yalnız Elif o sekmede görünüyorsa sınanır; seed eskiyse yalnız 'all'. (3) Test demo üyeyi CANLI DB'de saniyelerce işaretler. Yeni e2e beklentileri eklerken hepsini TEK işaret penceresine koy (aşağıdaki satırların çoğu aynı try/finally içine sığar).

**23. [güçlü] Kulüp içi sıralama (kulupIciSiralama + isaretsizler): işaretli üyelik listeden çıkar (boş liste ve işaretlisiz liste aynen döner); pencere içi pozitif puan; azalan; limit (varsayılan 10).**

- Kod: `src/lib/league.ts:61`
- Test: tests/integration/faz5-db.test.ts:310
- Mutasyon: 135. satırda isaretsizler kaldırılırsa ya da 66'da isNotNull -> isNull yapılırsa faz5-db.test.ts:325 kırılır ([[temiz, 30]] beklenir; işaretlinin 90'ı gelir). 153'te sıralama ters çevrilirse :327 kırılır. Kaçak: 154'te slice(0, limit) silinse kırılmaz (testte 2 üye).
- Not: Lib fonksiyonu doğrudan sınanıyor; sayfa (kulup/[slug].astro:129, 139) ve cron (gunluk.ts:132) bağları sınanmış sayılmaz.

**24. [güçlü] Ekonomi kartı kaynak dağılımı: reason bazında toplam, puan azalan JSON dizisi; boşsa []; sürücü string döndürürse JSON.parse; tüm sayılar int.**

- Kod: `src/lib/ekonomi.ts:173`
- Test: tests/integration/faz5-db.test.ts:356
- Mutasyon: 174. satırda gruplama bozulursa :356 (vitality_pool >= 38) ya da :358 (toplam = basilan) kırılır; bir sayımdan '::int' silinirse :355 (expect.any(Number)) kırılır; tırnaklı takma ad ('kursKatilim') yanlış yazılırsa yine :355. 'order by puan desc' silinirse :357 büyük olasılıkla kırılır (json_agg sırası garanti değil; kesin değil).
- Not: Lib fonksiyonu doğrudan çağrılıyor; /uye/admin sayfasındaki bağ (uye/admin.astro:125) sınanmış sayılmaz.

**25. [güçlü] ekonomiOzeti: uyeBasina = round(basilan / aktif); davetPayi = davet / basilan; davetUyari eşik DAHİL (>= 0,40); kirpilanOran = kirpilan / kesinlesen; dusenOran = dusen / (kesinlesen + dusen); kurs oranları KATILIMA göre; payda 0 ise 0.**

- Kod: `src/lib/economy.ts:274`
- Test: tests/unit/faz5-ekonomi.test.ts:116
- Mutasyon: 279. satırda '>=' -> '>' yapılırsa :142-149 (400 / 1000 -> true) kırılır; 283'te payda kursAktif yapılırsa :130-141 kırılır; 272'de sıfır koruması kalkarsa :150-162 kırılır. Tek kaçak: 277'de Math.round silinse kırılmaz (1000 / 8 tam bölünüyor) -> fixture'a basilan 1001 ekle.
- Not: GEREKSİNİMLE FARK: PRD 4.9 '%40'ı GEÇERSE' der (kesin büyük); kod ve varsayım #63 '>= %40'. Bilinçli sapma ama Yusuf onayı kayıtlı değil. Saf eşlenik testi; SQL sayılarını sınamaz.

## 5. Fable çalışma kaydı (2026-10-12, dal `faz5-ekonomi`, `cb1d541..HEAD`)

Yöntem: her iddia önce test (HEAD'de kırmızı → düzelt → yeşil; karakterizasyon tarifleri HEAD'de yeşil = kanıt), kilitlenen her kural için mutasyon denetimi (kural elle bozuldu → test kırmızı → `git checkout -- <tek dosya>` → yeniden yeşil). Tüm entegrasyon koşumları canlı Neon'da (POSTGRES_URL_TEST = POSTGRES_URL; Neon branch'i verilmedi), her koşumdan sonra `node --env-file=.env.local scripts/itest-artik-kontrol.mjs` → hep 0 artık, admin listesi değişmedi (tek admin, id 12).

**Kapanan (kod değişti):** A2 hayalet bekleyen (`1019837`) · B2 tarama try/catch + aday sorgusu ayrımı (`006d3d5`) · D2 bayat metin (`aa4dc91`) · D3 genç+işaretli bildirim (`e9cbbff`) · E1 kanca süreleri + artık betiği (`7b1152b`) · A4 test yardımcısı sırası (`6574f58`).
**Kilitlenen (kod doğruydu, test yoktu):** A4 2. seviye sırası · admin yetki kapısı, flag_clear, flag_confirm işaret kapısı, "Haklı" (üye/rep/mesaj göndereni) · egitim davet zinciri, açılış eşiği işaretliyi saymaz, onayliKulupMu · kaynakIsaretli çağrı yerleri (davet +15, 2. seviye, bitirme, etkinlik girişi) · havuz sayımları (yayın, asgari süre, gizli yorum, üretici yorumu/kaynağı, işaretli katkıcı payı bekleyene) · kulupSiralamasi (puan + √üye) · tarama role='member' · cron adım sırası / CANLILIK kapısı / hafta kilidi / 401 · /uyeler sırası, üniversite tablosu, akış "Bu hafta", admin yönlendirmesi, pano "inceleniyor" (e2e, mutasyonsuz).
**Karakterize edilen (bugünkü davranış sabit, karar #42):** A1, A3, B1, B4, B5, C3 (beğeni + etkinlik), D1, D4.
**Kanıtlanan eski hatalar (src değişmedi):** C1 sezon kapanmıyor, C2 onay bekleyen topluluk görev ödülü.
**Çürütülen:** yok (devir iddialarının hepsi doğrulandı; §2.7'nin sezon senaryosu zaten belgede çürütülmüştü, TEST 1 bunu kanıtladı).

**Mutasyon denetimi (her biri kırmızı, geri alma `git diff --stat` temiz, yeniden yeşil):** A2 ledger kontrolü · A4 kıyas silindi / yönü ters · A3 tutma eşiği 3→0 · A1 tavan ×10 · B2 try/catch sökük · B1 ip penceresi 48 s→4800 s · B4 role, 48 s→72 s · B5 yoğun pencere 24 s→48 s · admin kapısı · flag_confirm kapısı · eşikte işaretli dışlaması · onayliKulupMu eski kural · kaynakIsaretli ×3 (davet +15, 2. seviye, bitirme) + etkinlik girişi · havuz ×6 (yayın, asgari süre, gizli yorum, üretici yorumu, üretici kaynağı, puanOlayi→awardPoints) · kulupSiralamasi isaretsizler · D3 `&& !flaggedAt`. **Eşdeğer mutant (hayatta kaldı, hata değil):** `davetAktivasyonu`'nun karşılama çağrısındaki `kaynakIsaretli` — alıcı davetlinin kendisi, `puanOlayi` 09fc098'den beri alıcı işaretini okuyor → argüman gereksiz. **Mutasyonsuz:** e2e sayfa kuralları (src'de mutant varken dev sunucusu/e2e kuralı).

**E2 — açıklanmamış kırmızı koşum:** yeniden üretilemedi. Neon 5 dk 25 sn boştayken 6 dosya birlikte: 90/90 (9 todo), `beforeAll` süreleri soğukta 1,4–2,1 sn (en uzun ekonomi-db, kullanıcı insert'i dahil) — 10 sn kanca eşiğinin çok altında; "soğuk başlangıç" hipotezi bu ölçümle ZAYIFLADI, kanıtlanmadı da. Ham günlük: oturum scratchpad'inde `entegrasyon-soguk-153807.log`.

**Yapılmayanlar / sınırlar:** §2.7 TEST 2 (özel lig birinciliğinden düşme — `ozelLigleriKapat` modül içi ve filtresiz; `league.ts`'e `ligId` parametresiyle taşınmalı) · suistimal kuyruğunun bileşene çıkarılıp AstroContainer testi · admin HEDEFİN işaretlenmemesi (admin satırı açılmaz) · e2e kurallarında mutasyon · `/uye/admin` ekranlarının tarayıcıda denenmesi (#42, Yusuf) · `suistimalHata` dolu iken 5/8. adımların koşması (karar).

**Faz sonu düşman inceleme (`cb1d541..16bb837`; 4 mercek + fix incelemesi + 3 çürütücü, hepsi salt okur).** Kod gerilemesi yok. Bulguların akıbeti: *doğruluk* — tarama fırlatınca bekleyen koşar (karar #42; `/uye` aynı sızıntıyı zaten yapıyor), rota A2 beklentisi boştu (**kapandı**: genç 5. katılımcı), aday CTE çift satır + EPQ (**kapandı**: `distinct on` + hedefte `flagged_at is null`), Y1 (**kapandı**), artık betiği sahipsiz `cron_runs` (**bilgi satırı**; seed:demo artığı meşru). *Suistimal* — **C2b** başkan kendi görevini üstlenip onaylıyor, tek pending kulüp haftada 1000, kulüp sayısıyla çarpılır, `task_done` kişi tavansız ve işaretle tutulamaz (ESKİ; karakterize `e615ff5` rota-db.test.ts, karar #42 — çürütücü: "tek kulüp bile yeter"); cron 200 + hata yalnız JSON (**`console.error` eklendi**); e2e kuklası yarıda kalırsa (**teardown süpürmesi**); rota testinin yayında itest kursu (rota `published` ister — tasarım); `like_received` latent (not; isteğe bağlı tip daraltma `Exclude<Reason,"like_received">`). *SQL/yarış* — `puanOlayi` kontrol + INSERT ayrı ifade (kozmetik, doğrulanmış; not), C1 testinin `aktifSezon` yazımı (**çürütüldü**: üretim davranışı). *Gerileme* — `ekonomi.spec` paralel çakışma (**`default` kip**), `/uyeler` 60 sınırı (**ön koşul**), belge bayatlıkları (**güncellendi**: PROGRESS, CLAUDE, assumptions #65/#67, bu belge).

**Düzeltme yolu:** worktree `faz5-fable-fix` (4 commit, ayrı incelendi) → `faz5-ekonomi`'ye cherry-pick (`e615ff5`, `286ba27`, `09329c4`, `72f2126`; `git merge` kullanılmadı) → yeni kilitler mutasyonla kırmızı görüldü (`distinct on`, `isaretliMi`, ledger ön kontrolü/rota x5) → `astro check` 0, birim 466, rota-db 9 + faz5-db 28 yeşil, artık 0.
