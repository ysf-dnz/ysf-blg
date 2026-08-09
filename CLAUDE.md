# ysf-blog — "Bilgi Ödüldür" Topluluk Platformu

Kişisel blog + üyelikli öğrenme topluluğu. **Kitaplar satılmaz, emekle açılır**:
oku → üret (yazı/quiz/görev) → puan kazan → yeni kitap aç. Medium (editör,
takip, beğeni) + Skool (feed, seviye, harita, classroom) + Kahoot (süreli quiz)
+ Jira (kulüp Kanban'ı) desenleri tek platformda.

## Stack
- **Astro 5** server-mode (Vercel adapter) + Tailwind v4 (`src/styles/global.css` @theme; `motion.css` animasyon kütüphanesi — reveal/stagger/ticker `src/features/motion/init.ts`)
- **Clerk** auth (`@clerk/astro`; Google girişi; TR yereli). DİKKAT: Clerk `PUBLIC_CLERK_PUBLISHABLE_KEY` bekler, Vercel entegrasyonu `NEXT_PUBLIC_*` verir → eşleme `.env` dosyasında ve Vercel env'lerinde. `vercel env pull` yalnız `.env.local`'ı ezer.
- **Neon Postgres + Drizzle** (`src/db/schema.ts` ~25 tablo; `db` istemcisi TEMBEL Proxy — birim testler env istemez). Şema değişikliği: `node --env-file=.env.local node_modules/.bin/drizzle-kit push`
- İçerik: Keystatic (yalnız `npm run admin`), 884 kitap `src/data/books.json` (id = Drive fileId), Pagefind arama (server-mode'da `dist/client` indexlenir — postbuild)

## Kritik mimari kararlar
- **Kitap sayfaları STATİK** (884 sayfa, getStaticPaths, aranabilir). Dinamik her şey `src/features/library/OkumaKapisi.astro` **server island**'ında (`server:defer`): erişim kapısı, quiz/kampanya köprüleri, panel modülleri (yalnız erişene — sızıntı testi bekçi), beslenen yazılar+beğeni, paylaşım/davet kartı.
- **Misafir DOM'unda Drive iframe/link OLMAMALI** — `tests/e2e/gate.spec.ts` bekçi. Abonelik/İndirme Planları KALDIRILDI.
- **Puan tek gerçek kaynak**: `points_ledger` (harcamalar negatif). Katsayılar `src/lib/points.ts`; korumalar `src/lib/economy.ts` (beğeni: aynı kişiden günde 5 puanlı; kulüp görev ödülü haftalık 1000 tavan — otomatik kırpılır). Seviyeler `src/lib/levels.ts` (Skool eşikleri 1-9, toplam KAZANILANDAN).
- **Bilgi Hazinesi onboarding**: `/uye/hosgeldin` → 5 kitap seç (İLKİ hediye, `learning_list`); `/uye` panosunda kilitli hazine çubukları; kilit `/api/uye/kitap-ac` (200p) → `?acildi=1` konfeti+indirme bandı.
- Yetkiler `src/lib/permissions.ts` (admin her kulüpte başkan). Admin bootstrap: `OWNER_EMAILS` member.ts (sn.yusufdeniz@gmail.com ilk girişte admin).
- Rotalar `src/lib/routes.ts`; topluluk 8 sayfası `ToplulukLayout` sekme çubuğunda; N+1 yardımcıları `src/lib/social.ts`, `books-lookup.ts`.

## Sayfa haritası (hepsi SSR, prerender=false; içerik sayfaları statik)
`/topluluk` feed+sağ ray · `/topluluk/[slug]` yazı (beğeni; members-only blur) · `/u/[handle]` profil (takip, flair, sosyal linkler) · `/gundem` kampanyalar+oylama · `/kampanya/[id]` Kanban (backlog→üstlenildi→incelemede→tamamlandı; 7 gün bayat→backlog; bütçe rozeti) · `/kulupler` `/kulup/[slug]` (Pano·Kitaplık·Etkinlik·Üyeler) `/kulup-kur` · `/dersler` `/egitim/[id]` (YouTube+yazı+quiz karışık müfredat) · `/kitap/[id]/quiz` (Kahoot; doğru cevap istemciye GİTMEZ) · `/lider` `/etkinlikler` (⭐öncelikli koltuk) `/uyeler` `/harita` (81 il SVG) `/aramiza-katil` · `/uye/{,hosgeldin,yaz,profil,magaza,admin,quiz-olustur,egitim-olustur}`
API: `src/pages/api/uye/*` (form-POST + redirect deseni; hız sınırı feed'de)

## Komutlar
- `npm run qa` — kalite kapısı: check + 90 birim + build + çıktı-bekçisi + e2e
- `npm run seed:demo` — 5 demo üye + kulüp + kampanya + quiz + kurs + etkinlik (idempotent; `demo_` clerkId). Demo: /kulup/odtu-yz-okuma-demo, /u/elif-celik
- e2e **dev server'a** koşar (Vercel adapter `astro preview` desteklemez — kanıtlı). Tuzaklar: `details.first()` mobil menüyü bulur (`details[id^='kat-']` kullan); tema toggle startViewTransition'la asenkron; uzun dev oturumu EMFILE/`504 Outdated Optimize Dep` üretir → sunucu restart + `rm -rf node_modules/.vite`.
- Değer notları: `src/data/deger-notlari.json` (NotebookLM MCP `notebook_query` ile üretim; 884 için batch iş BEKLİYOR — nb-sor.py hattı)

## Bekleyenler / sonraki adımlar
- Commit + Vercel deploy hiç yapılmadı (tüm iş local + Neon canlı)
- Canlı quiz odası (PIN, WebSocket), e-posta bildirimleri (Resend), moderasyon araçları, streak
- Auth'lu e2e (@clerk/testing), 884 kitaba toplu değer notu üretimi
