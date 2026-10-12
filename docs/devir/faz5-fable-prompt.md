Bu repoda (/Users/macbook/Downloads/ysf-blog) kıdemli full-stack mühendissin; Faz 5'i önceki ajandan (Opus) devralıyorsun. Bu metinde "ben" = Yusuf (depo sahibi, bu mesajı yapıştıran). Tarihler 2026-10-12 itibarıyladır: bugünün tarihini `date` ile al, farklıysa raporunun başına yaz.

ÖNCE OKU
1. `docs/devir/faz5-fable-devir.md` — §0 ve §1'in TAMAMI (neden devir + öncelik sırasıyla ipuçları). §2 (düzeltme commit'inin incelemesi + "kanıtlayan en küçük test" tarifleri), §3 (ilk incelemenin 23 bulgusunun akıbeti) ve §4 (kural ↔ kod ↔ test haritası, 125 kural) başvurudur: üstünde çalıştığın alanın kısmını oku.
2. `CLAUDE.md` ("Ekonomi — Faz 5", "Topluluk motoru", "Kurslar — Faz 1"deki awardPoints / pending_points kuralları), `PROGRESS.md` (en üstteki "🔁 FABLE'A DEVİR" ve "💠 FAZ 5 TAMAM" blokları; aşağıdaki "🔁 OPUS'A DEVİR" ESKİ bir devirdir, görev değildir), `docs/assumptions.md` #61–#66, `docs/adr/0001-kurs-davet-etkinlik-harita.md` (K1, K2, §7), `docs/prd/kurs-topluluk-ekosistemi.md` (§4.2, §4.3, AC-10).
Kod soruları için önce `graphify query`. Bu prompt ile PROGRESS.md / CLAUDE.md çelişirse BU PROMPT geçerlidir.

DURUM
- `main` = 7fd5416, CANLIDA (Faz 1–4 + Faz 4 eksikler). Faz 5 `faz5-ekonomi` dalında: yerel, push'lanmadı, main'e MERGE EDİLMEDİ ve bu hâliyle merge'e hazır DEĞİL. Çalışma ağacı bu dalda (`git log --oneline 7fd5416..HEAD`): 0598606 zemin · 8b89c16 F5-01 · e5b9d74 F5-02 · 3b2ab93 F5-04 · 3dab8d5 F5-03 · a3e464a testler · 09fc098 inceleme düzeltmeleri · cb1d541 belgeler · en üstte devir belgeleri (yalnız belge; kaynak satır numaraları cb1d541'deki koda göredir).
- `.claude/launch.json`'daki commit'siz değişiklik benim; `graphify-out/cache/last_query_stamp` her `graphify query`'de değişir. İkisine de dokunma, commit'leme.
- Canlı DB'de Faz 5'ten yalnız `users.flagged_at` kolonu var (ek, nullable; canlıdaki kod kullanmıyor); işaretli hesap yok. Demo veride tek ek satır: Zeynep → Elif platform daveti (`referrals`).
- Faz 5: 2. seviye davet (`invite_second_level`), canlılık havuzu (`vitality_pool`, haftalık cron), ekonomi kartı (`/uye/admin`), suistimal işareti (`users.flagged_at` + günlük tarama + admin kuyruğu).
- Son koddaki kanıt: `astro check` 0 hata · birim 459 · build + bekçi geçti · entegrasyon 67/67 gerçek Neon (Faz 5: 12) · e2e 87/87 (`--workers=2`). Tek komutla `npm run qa` Faz 5 ağacında yeşil görülmedi: e2e bu makinede 4 işçiyle bellek baskısından `page.goto` zaman aşımı veriyor (önceki fazlarda sakin makinede yeşildi; sorun yük). `npm run qa` entegrasyon testlerini koşmaz (`POSTGRES_URL_TEST` yoksa atlanır).
- GitHub: #38–#41 (F5-01…F5-04) açık; #42 (Faz 5 kararları + elle doğrulama), #37, #31, #24 benim elle yapacağım işler: üzerlerinde çalışma, bitmelerini bekleme, son raporda tek satırla hatırlat. Issue kapatma, yorum yazma, etiket değiştirme.

NEDEN SEN
1. İnceleme düzeltmeleri commit'i `09fc098` incelenmeden dala girdi. Sonradan iki mercekle bakıldı: 11 bulgu, 10'u çürütmeden geçti (6 doğrulandı, 4 kısmen; yüksek yok, biri orta). Çoğu puan motorunda: `puanOlayi`, `bekleyeniKesinlestir`, `bekleyenleriIsle`.
2. 125 kuralın 35'i güçlü testle kilitli, 35'i zayıf, 55'i testsiz (00a95a4 anının sayımı; Fable 2026-10-12 kilitlemeleri sonrası yeniden sayılmadı). Faz 5 kurallarını sınayan hiçbir test rotadan geçmiyor: entegrasyon lib fonksiyonlarını doğrudan çağırıyor; `api/uye/admin.ts`'in `flag_*` dalları ve `api/cron/gunluk.ts` hiçbir testte koşmuyor.
3. Kök çözümler şema / üye oluşturma yolu / mevcut ekonomi kararı istiyor.
4. Entegrasyon takımının bir koşumu 3 dosyada kırmızıydı (11 başarısız + 7 atlanan); hata metni yakalanmadı, sonraki iki koşum 67/67. CLAUDE.md'deki "Neon soğuk başlangıcı" açıklaması KANITSIZ bir hipotezdir.
Devir belgesindeki hiçbir iddia TEST koşturularak doğrulanmadı; hepsi kod okuması. Tek istisna §1 C1 (sezon kapanmıyor): canlıda salt-okunur SELECT ile görüldü.

GÖREV — TESTLERE GÖRE İNCELEME
Kodu okuyup fikir yürütme: her iddiayı testle kanıtla ya da çürüt, sonra (izinliyse) düzelt. Maddenin türünü belgeden oku:
 (1) HATA iddiası: istenen davranışı test olarak yaz, HEAD'de KIRMIZI gör, düzelt, yeşile çevir. İlk koşumda yeşilse iddiayı "çürütüldü" diye kapat, testi bekçi olarak bırak.
 (2) KARAKTERİZASYON tarifi (belgede "geçerse kanıtlanır" yazanlar: §2.5, §2.7 TEST 1, §2.9): HEAD'de YEŞİL = iddia kanıtlandı. Karar bekleyen maddelerde yalnız bugünkü davranışı sabitleyen yeşil testi commit'le, istenen davranışı `it.todo` ile not et. Dalda kırmızı test bırakma.
 (3) TEST BOŞLUĞU (kod doğru, kural testsiz: A4 ve 5. adımın tamamı): test HEAD'de YEŞİL olmalı; kanıt mutasyondur.
Mutasyon denetimi (her kilitlediğin kural için): önce düzeltmeyi commit'le; sonra kuralı elle boz, testin kırıldığını GÖR, `git checkout -- <yalnız bozduğun tek dosya>` ile geri al, `git diff --stat`'ın temiz olduğunu gör, testi yeniden yeşil koş. Kırılmıyorsa test zayıftır; güçlendir.
 - Yalnız İŞ KURALI karşılaştırmasını boz (eşik, `>=`, `is null`, sabit). Sorguyu test verisine daraltan parçaya ASLA dokunma: `bekleyenleriIsle`'nin `userId`'si, `suistimalTara`'nın `davetciId`'si, `canlilikHavuzuDagit`'in `kursIdleri`'si, `bekleyenleriDusur`'un `user_id` koşulu, id eşitlikleri, `status = 'pending'`. Her mutasyondan önce kendine sor: "bozuk hâl test satırları dışında hangi satıra dokunabilir?" Cevap gerçek üye ise o mutasyonu koşturma.
 - `src/` altında geri alınmamış mutasyon varken dev sunucusu, e2e ya da build başlatma.
Madde başına commit (`git add <adını tek tek yazdığın dosyalar>`). Devir belgesinde ilgili satırı "kapandı / kilitlendi / çürütüldü (commit, test dosya:satır)" diye işaretle.

SIRA
0) Başlangıç denetimi. `git status`, `.git/MERGE_HEAD`, açık `vi` / `git` süreci, başka çalışan Claude oturumu, 4321'i dinleyen süreç. Beklenmeyen bir şey bulursan HİÇBİRİNE dokunma (tamamlama, `--abort`, süreç öldürme yok): DUR ve bana yaz.
1) `09fc098`'i kendi gözünle baştan sona oku (`git show 09fc098`; salt okuma): iki ajanın bakmadığı ya da yanlış gördüğü yer olabilir. Özellikle `tutulanBekleyenSql`, `puanOlayi`'deki alıcı okuması, `tavanIcin('vitality_pool')` penceresi, `ikinciSeviye` sıra koşulu, `suistimalTara` CTE'leri. Bulduğunu devir belgesine "yeni bulgu" diye ekle.
2) Test altyapısı (tek commit, kırmızı koşum üretmeden ÖNCE): beş `tests/integration/*-db.test.ts` dosyasının `afterAll`'ına açık süre ver (bugün varsayılan 10 sn) ve her entegrasyon koşumundan sonra, kırmızı dahil, canlıda artık kalmadığını SELECT ile doğrula (aşağıda "Canlı veri").
3) Puan motoru (§1 A, §2):
   - A2 hayalet bekleyen: düzeltme YALNIZ `puanOlayi`'nin bekleyen dalında (ledger'da aynı üye + reason + refId varsa bekleyen açma). `egitim.ts`'teki `>=` BİLİNÇLİ, `===`'e daraltma: işaret kalkınca "+50 sıradaki aktivasyonda yazılır" telafisi (varsayım #65) buna dayanıyor.
   - A4 2. seviyede "ilk aktivasyon" sırası: üretim hatası değil test boşluğu. Önce iki kurslu testi yaz (§2.6 B; üst davetçiler FARKLI olsun, `davetleAktive` yardımcısını kullanma), sonra yardımcıdaki iki satırın yerini değiştir. `<` → `<=` neredeyse eşdeğer mutanttır; peşine düşme.
   - A3 (`course_launched` "Suistimal" kararından sonra da bekler) ve A1 ("Temiz" sonrası toplu kesinleşmede tavana sıkışma; kanıtlı kayıp yolu üretici günlük tavanı, kaybeden aklanan hesap değil ALICI): yalnız test; iki düzeltme adayı da mevcut kuralla çarpışıyor (§2.5, §2.1–2.2), düzeltmeyi sor.
4) Suistimal taraması (§1 B):
   - B2: `suistimalTara()` cron'un ilk adımı ve `try/catch` dışında (öbür adımların bir kısmı da öyle). Yalnız `try/catch` + rapora hata alanı ekle; taramanın SIRASINI değiştirme. Parametresiz yol canlıda koşturularak kanıtlanmaz: CTE'leri salt-okur bir aday sorgusuna ayır, parametresiz SELECT'in fırlatmadığını sına, UPDATE yalnız `davetciId` ile koşsun.
   - B1 (ziyaret penceresi 48 saat, atıf çerezi 30 gün), B4 (yoğun pencere dışındaki hesaplar da işaretleniyor), B5 (kaçış yönü): yalnız test + sayılarla bugünkü davranış; kimin işaretleneceğini belirleyen koşullara cevabım gelmeden dokunma.
5) Testsiz kurallar (§4; önce "YOK", sonra "ZAYIF"; her biri mutasyonla kilitlenir). Öncelik:
   - Yetki kapıları: admin OLMAYAN üyeyle `POST /api/uye/admin` (`flag_clear`) → 403 ve hedefin `flagged_at`'i değişmedi; `/uye/admin` → `/uye`; taramada `role = 'member'`.
   - Lib düzeyi (rota gerekmez): `kaynakIsaretli` çağrı yerleri (`davetAktivasyonu`, `ikinciSeviye`, `davetBitirme`, etkinlik `girisOdulleri`, havuz), havuz sayımları (yayında kurs, asgari süre, gizli yorum), `kulupSiralamasi`.
   - Rotalar: `api/uye/admin.ts` (`flag_clear`, `flag_confirm`, şikâyette "Haklı" → işaret, admin işaretlenmez, mesajda gönderen), `api/uye/egitim.ts` (aktivasyon → `davetAktivasyonu` sırası, `course_launched` eşik sayımı, `onayliKulupMu`). Rotanın `POST`'unu içe aktar, sahte `context` ver: `locals.auth()` `{ userId: <geçici üyenin clerk_id'si> }` döndürsün, üye satırı testte ÖNCEDEN açılmış olsun (yoksa `getOrCreateMember` canlıda yeni üye + karşılama puanı yazar), `cookies.get` boş dönsün. Forma yalnız BU testin eklediği kayıtların id'lerini ver. Admin gerektiren dallarda admin satırı AÇMA: `getOrCreateMember`'ı kısmi `vi.mock` ile sahte admin nesnesi döndürecek biçimde taklit et.
   - `api/cron/gunluk.ts` kuralları (adım sırası, adım yalıtımı, `CANLILIK_ILK_HAFTA` kapısı, hafta kilidi) YALNIZ DB'siz sınanır: db ve bütün iş fonksiyonları `vi.mock` ile sahte, `vi.setSystemTime` ile tarih; ya da kaynak-metin bekçisi (`tests/unit/istek-freni.test.ts` deseni).
   - Sayfa sorguları: lider üniversite tablosu, akış mini liderliği, kulüp grup katkısı, `/uyeler` sırası, panodaki "inceleniyor". Admin ekranları: admin olmayan üyeyle negatif e2e + suistimal kuyruğunu bileşene çıkarıp AstroContainer testi. Admin girişli e2e YOK; tarayıcıda admin doğrulaması benim işim (#42).
6) Faz 5'ten ESKİ hatalar (§1 C) — `src/` değişikliği YOK, yalnız kanıtlayan test + rapor:
   - C1 sezon hiç kapanmıyor: testi YALNIZ §2.7 TEST 1'dir (kendi eklediğin `itest-` sezon satırı, aynı testin `finally`'sinde silinir). `sezonKapat`'ı çağırma, gerçek bir `seasons` satırıyla yazan hiçbir fonksiyon çağırma.
   - C2 onay bekleyen topluluğun kampanya / görev ödülü zinciri: yalnız kendi açtığın `pending` itest kulübü ve geçici üyelerle; açtığını `finally`'de sil.
   - C3 işaretle tutulamayan, KAYNAĞI BAŞKA HESAP olan ödül yolları (`like_received`, `event_hosted` / `event_well_rated`). İşaretli üyenin KENDİ doğrudan puanlarının yazılması BİLİNÇLİ (#65): dokunma.
7) Küçükler (§1 D): D2 (bayat arayüz metni) ve D3 (genç + işaretli davetlide bildirim dalı) düzeltilebilir. D1 (panodaki not işaretin kimde olduğunu sezdiriyor) ve D4 (havuz telafisi yalnız son tamamlanan haftaya bakar): yalnız test, düzeltmeyi sor. Açıklanmamış kırmızı entegrasyon koşumunu yeniden üretmeyi dene: Neon 5+ dk boştayken beş dosyayı birlikte koş, çıktıyı SÜZMEDEN kaydet, `beforeAll` sürelerini ölç.
8) Faz sonu:
   - 1–7. adımların commit'leri `faz5-ekonomi`'de kalır. Sonra `cb1d541..HEAD` aralığı için düşman inceleme (4 mercek: doğruluk, suistimal, SQL / yarış, gerileme; bulgu başına çürütücü). Her alt ajana AYNEN ver: "SALT OKUNUR — dosya düzenleme / oluşturma, test, dev sunucusu, build, drizzle-kit, seed, node betiği, DB sorgusu YOK; yalnız git / gh okuma, graphify query ve dosya okuma."
   - İncelemenin BULDUKLARINI düzelten commit'i dala doğrudan ekleme: ayrı worktree + ayrı dalda hazırla, onu da incelet, sonra dala al. Worktree'de `.env.local` ve `node_modules` yok (entegrasyon sessizce ATLANIR, dev sunucusu kalkmaz): orada yalnız düzenle ve commit'le; build, entegrasyon ve e2e'yi ANA dizinde koş.
   - Kanıt: `npx astro check`, `npx vitest run`, `npm run build` + `node scripts/check-build-output.mjs`, entegrasyon (çıktıda atlanan 0 olmalı), e2e. `PROGRESS.md` + `CLAUDE.md` + `docs/assumptions.md` + devir belgesi güncel, `graphify update .`.
   - Rapor ver ve DUR.

BANA SORULACAKLAR
İlk mesajında tek soru sor ve cevabı beklemeden 1. adıma (salt okuma) başla: "Mutasyon döngüsü için canlıdan dallanmış bir Neon branch'inin bağlantı dizesini `POSTGRES_URL_TEST` olarak verir misin?" Verirsem entegrasyon ve mutasyon koşumlarının tamamı o branch'te koşar. Vermezsem canlıda: tek testi `npx vitest run <dosya> -t '<ad>'` ile koş (beş dosyayı birden yalnız 2. adımda, 7. adımdaki yeniden üretmede ve faz sonunda), yeni testlerde kuralın gerektirmediği yerde yayında kurs ya da onaylı kulüp açma.
Geri kalan soruları faz sonu raporunda TEK numaralı blokta sor; her birinde test kanıtı + önerin + gerekçen olsun. Aşağıdakilerin hiçbirine cevabım gelmeden kod yazma; ilgili adımda yalnız kanıtlayan testi bırak. Genel bir "evet / tamam / devam" hiçbir maddeyi onaylamaz: yalnız numarasıyla onayladığım madde onaylıdır.
- Kayıt anında hesap imzası (`users`'a kısa ömürlü nullable ip hash + `getOrCreateMember`): tarama kimliksiz ziyaret yerine hesabın kendi imzasına dayanır; `/?ref=` çiftliği ve B5 kaçışları da görünür. Şema + üye oluşturma yolu + kişisel veri.
- `referral_joined`'ın `puanOlayi` ile 24 saat bekleyene yazılması (bugün kayıt anında +25, işaretle tutulamıyor).
- A1 (tavan kesinleşme anına göre mi), A3, B1, B4, D1, D4; ara halka (davet eden) işaretliyse 2. seviye; B2'de tarama fırlatırsa bekleyen ve havuz adımları koşsun mu.
- C1'in geriye dönük ödülü (Ağustos, Eylül) ve onarılınca aynı koşumda işaretlenenlerin sezon ödülünden düşmesi; C2'nin kapatılması; C3'te sayımdan işaretliyi dışlama.
- Değerler: `SUISTIMAL_ESIK` 5 · `vitalityWeeklyCap` 200 (PRD'de yok) · `CANLILIK_ILK_HAFTA` 2026-W42. Bu sabit takvime bağlı: merge 19 Ekim 2026 06:00 TR cron'undan sonraya kalırsa ilk koşum, Faz 5 canlıda değilken geçen haftayı öder. Sabiti kendin değiştirme; raporda merge tarihine göre yeni değeri öner.
- Havuzda beğeneni kursa katılmış üyeyle sınırlama; işaretli üyenin yeni konuşma başlatamaması; "Suistimal" kararında ledger iadesi.
- Şema değişikliği gerektiren HER düzeltme.
İşi yarıda kesip hemen yazmanı gerektiren durumlar: (1) başlangıç denetiminde beklenmeyen git durumu ya da başka oturum, (2) canlıda kendi açmadığın artık, işaretli hesap ya da fazladan `role = 'admin'` satırı, (3) entegrasyon ya da e2e'nin nedenini açıklayamadığın ikinci kırmızı koşumu.

BİLİNÇLİ, DÜZELTME (test yazarsan bugünkü davranışı sabitle)
2 hesaplı havuz çiftliği (kişi tavanıyla sınırlı) · aynı ağdan gerçek kalabalığın taramada sahte pozitifi (kuyrukta "Temiz") · `course_launched`'ın işaret kalkınca sıradaki aktivasyonda yazılması · harita sırasının işaretten etkilenmemesi · davet edenin kendisinin işaretlenmemesi · `answer_accepted` / `resource_accepted`.

CANLI VERİ (dev = CANLI Neon; "yerelde" diye bir ayrım yok)
- Filtresiz toplu işi ASLA çağırma: `suistimalTara()` (`davetciId`'siz: gerçek üyeleri işaretler), `canlilikHavuzuDagit(hafta)` (`kursIdleri`'siz: gerçek üreticilere puan yazar), `bekleyenleriIsle()` (`userId`'siz), `etkinlikSonrasiIsle()`, `ozelLigleriKapat()`, `sezonKapat()`. Daraltma argümanı `undefined` / `0` ise sorgu TÜM canlı veriye koşar: çağrıdan önce id'nin dolu olduğunu doğrula.
- `/api/cron/gunluk`'u `curl` ile çağırma ve `GET`'ini gerçek DB'ye karşı testten içe aktarıp çağırma (ikisi aynı şey: bütün adımlar canlıda koşar).
- Gerçek `cron_runs` anahtarını (`canlilik-havuzu` + gerçek hafta, `bekleyen`, `sezon-kapat`, `ozel-lig`) testte kullanma; atılabilir ad kullan.
- Var olan hiçbir `users` satırının `role`'ünü değiştirme, `OWNER_EMAILS`'e dokunma, gerçek bir hesap OLARAK oturum açma (Playwright'ta `clerk.signIn` yalnız mevcut test üyesiyle; Clerk Backend API ile kullanıcı / oturum üretme).
- Her test kendi geçici kayıtlarını açar ve aynı testin `finally`'sinde / `afterAll`'da siler; silme deseni yalnız `clerk_id like 'demo_itest_%'` ve kendi `itest-` slug'ların. Her entegrasyon koşumundan sonra SELECT ile doğrula: `itest-%` üye / kurs / kulüp / sezon yok, `flagged_at` dolu hesap yok, `cron_runs`'ta `suistimal-temiz` artığı yok, `role = 'admin'` listesi koşum öncesiyle aynı.
- `db`'ye dokunan her yeni test `tests/integration/` altında ve `describe.skipIf(!process.env.POSTGRES_URL_TEST)` kapısıyla yazılır; `tests/unit` ve `tests/component` altındaki test `@/db/client.ts`'i ya `vi.mock` ile sahteler ya hiç içe aktarmaz.
- Şema: onaysız şema değişikliği YOK. `drizzle-kit push`'u yalnız önizleme için çalıştır (`node --env-file=.env.local node_modules/.bin/drizzle-kit push --strict --verbose < /dev/null`: TTY yokken ifadeleri basıp durur); uygulayan push'u ben "push et" demeden çalıştırma.

KOMUTLAR VE KURALLAR
- Entegrasyon: `CRON_SECRET="$(node --env-file=.env.local -p process.env.CRON_SECRET)" POSTGRES_URL_TEST="$(node --env-file=.env.local -p process.env.POSTGRES_URL)" npx vitest run tests/integration`
- e2e: `rm -rf node_modules/.vite` sonra `npx playwright test --workers=2`. 4321'i dinleyen süreç bu oturumda senin başlattığın sunucu değilse öldürme: DUR ve bana yaz. e2e koşarken `src`'ye dokunma, workflow / alt ajan koşturma.
- Puan yalnız `awardPoints` / `spendPoints` / `begeniPuaniVer` / `puanOlayi` ile; her YENİ reason refId taşır (ADR §7; mevcut istisna `welcome`); tavanlar `tavanIcin`'de; bekleyen ÖNCE ledger SONRA status. neon-http interaktif transaction desteklemez: tek SQL ya da `db.batch` + danışma kilidi.
- GET durum değiştirmez; hata yanıtı düz metin değil yönlendirme + bayrak; işaret üyeye söylenmez. `suistimalMi` ↔ `suistimalTara` ve `dmKarar` ↔ `mesajGonder` saf eşleniktir: biri değişirse öbürü de değişir.
- Git: `git add -A`, `git commit -a`, `git stash`, `git restore .`, `git checkout .`, `git clean`, `git reset --hard` ve cb1d541 ile öncesini yeniden yazan `--amend` / rebase YASAK.
- Benden o eylemin ADIYLA açık onay gelmeden YAPMA: `git merge`, `git push` (dal push'u dahil: Vercel preview üretir), `vercel` CLI'nin yazan komutları, `gh issue close / comment / edit`, `gh pr create`, `npm run seed:demo`, uygulayan `drizzle-kit push`, canlı veriye geriye dönük yazım, kendi geçici test kayıtların dışındaki herhangi bir canlı satıra INSERT / UPDATE / DELETE.
Türkçe, kısa, kanıtlı (dosya:satır) raporla; cevabı "atlananlar + risk" satırıyla bitir.
