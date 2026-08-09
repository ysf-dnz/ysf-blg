# ysf-blog — "Bilgi Ödüldür" 📚

> Kitaplar burada satılmaz — **emekle açılır**. Oku → üret → paylaş → puan kazan → yeni bilgi hazinesinin kilidini aç.

Yusuf Deniz'in kişisel blogu + üyelikli **öğrenme topluluğu platformu**. Medium'un editörü, Skool'un topluluk mekanikleri, Kahoot'un quiz enerjisi ve Jira'nın görev panosu — tek çatıda, Türkçe.

## Ne var?

| Alan | Özellik |
|---|---|
| 📖 **Kütüphane** | 884 kitap (statik, aranabilir); erişim kapısı server island'da. Kitap sayfasında NotebookLM'den üretilen 💎 değer notu, sorularla analiz, bölüm bölüm Türkçe özet |
| 🗝️ **Bilgi Hazinesi** | Kayıtta 5 kitap seç: ilki hediye, kalanları yazdıkça kazandığın puanla aç (konfeti dahil) |
| ✍️ **Topluluk** | Medium tarzı editör (seçimde biçim çubuğu, otosave, herkese açık/üyelere özel), admin onaylı yayın, takip, beğeni (+1 puan yazara), Skool tarzı feed |
| 🏛️ **Kulüpler** | Üniversite/lise/şehir toplulukları; ortak kitaplık, kampanya + Kanban görev panosu (backlog→üstlenildi→incelemede→tamamlandı), haftalık ödül bütçesi |
| 🧠 **Quiz** | Kahoot tarzı süre sayaçlı sorular; doğru cevap istemciye gitmez, puan = doğruluk × hız |
| 🎓 **Dersler** | YouTube videosu + üye yazısı + quiz **karışık müfredat**; video barındırılmaz |
| 🗺️ **Harita** | 81 il, kulüp pinleri + üye kümeleri (sıfır bağımlılık SVG) |
| 🏆 **Oyunlaştırma** | points_ledger tek gerçek kaynak; Skool seviye eşikleri (1-9), liderlik (7g/30g/tüm), rozetler, flair mağazası, kitap hediye etme, davet zinciri (ref kodu + canvas davet kartı) |

## Stack

**Astro 5** (server-mode, Vercel) · **Tailwind v4** · **Clerk** (Google girişi) · **Neon Postgres + Drizzle** · Keystatic (yerel admin) · Pagefind · NotebookLM MCP (değer notu üretimi)

## Kurulum

```bash
npm install
vercel link && vercel env pull   # Clerk + Neon env'leri (entegrasyonlar Vercel'de kurulu)
npm run dev
```

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run qa` | Kalite kapısı: type-check + 90 birim test + build + çıktı bekçisi + e2e |
| `npm run seed:demo` | 5 demo üye + kulüp + kampanya + quiz + kurs + etkinlik (idempotent) |
| `npm run admin` | Keystatic admin → /keystatic |
| `npm run build` | Üretim build + Pagefind + llms.txt |
| `npm test` / `npm run test:e2e` | Vitest / Playwright (e2e dev server'a koşar) |
| `node --env-file=.env.local node_modules/.bin/drizzle-kit push` | Şema → Neon |

## Belgeler

- **[CLAUDE.md](CLAUDE.md)** — mimari anayasa: kritik kararlar, sayfa haritası, tuzaklar
- **[PROGRESS.md](PROGRESS.md)** — durum, QStash kararı, risk kaydı, operasyon runbook'u

## Mimari özet

- Kitap sayfaları **statik** (SEO + hız); erişim kapısı/dinamik her şey `OkumaKapisi` **server island**'ında. Misafir DOM'unda Drive linki bulunmaz (e2e bekçili).
- **Puan tek gerçek kaynak**: `points_ledger` (harcamalar negatif). Ekonomi korumaları `src/lib/economy.ts`: beğeni çiftliği freni, kulüp haftalık görev tavanı.
- Üye markdown'ı HTML-escape'li (XSS), quiz puanlama sunucuda, tüm API'ler form-POST + redirect deseni.
