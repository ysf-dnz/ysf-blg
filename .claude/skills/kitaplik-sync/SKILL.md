---
name: kitaplik-sync
description: Google Drive'daki kitapları (PDF/EPUB) tarayıp blogun kitap rafı verisini ve kapaklarını günceller. Kullanıcı "kitaplığı senkronla", "Drive kitaplarını güncelle", "kitap rafını yenile" dediğinde tetikle.
---

# Kitaplık Senkronu (Google Drive → books.json)

Vercel build'in Drive erişimi yoktur; senkron her zaman bu skill ile lokalde
yapılır ve çıktı (veri + kapaklar) repoya commit edilir.

Kök klasör: `1WVA5lPQDIWy-bNZvGGyNT6hifjpTDocF` (link-paylaşımlı).

## Adımlar

1. **Rekürsif tara** — Google Drive MCP `search_files` ile
   `parentId = '<klasörId>'` sorgusunu kökten başlayarak çalıştır;
   `nextPageToken` ile sayfalamayı bitir. Dönen öğelerden:
   - `application/vnd.google-apps.folder` → kuyruğa ekle (klasör adını hatırla)
   - `application/pdf` ve `application/epub+zip` → kitap listesine ekle
   Her kitabın kategorisi, içinde bulunduğu alt klasörün adıdır
   (kök klasördekiler `genel`).

2. **Ham veriyi yaz** — `src/data/books-raw.json`:

   ```json
   {
     "books": [
       {
         "id": "<driveFileId>",
         "fileName": "<dosya adı, olduğu gibi>",
         "format": "pdf",
         "driveUrl": "<viewUrl>",
         "sizeBytes": 12345,
         "category": "<alt klasör adı veya genel>"
       }
     ]
   }
   ```

   Başlık/yazar temizliği script'te yapılır (`scripts/lib/book-title.ts`) —
   dosya adını DEĞİŞTİRMEDEN aktar.

3. **Kapakları indir** — her kitap için (yalnızca
   `src/assets/book-covers/<id>.jpg` yoksa):

   ```bash
   curl -sL "https://drive.google.com/thumbnail?id=<id>&sz=w640" -o src/assets/book-covers/<id>.jpg
   ```

   Dönen dosya HTML/boşsa (EPUB'larda olur) sil — kapaksız fallback var.
   `file` komutuyla gerçekten görüntü olduğunu doğrula.

4. **Doğrula ve yayınla** — `npm run sync:kitaplik`. Script normalize eder,
   kapakları bağlar, kitapları `src/data/kutuphanem.json` defterleriyle fuzzy
   eşleştirir (`notebookId`) ve `src/data/books.json`'a yazar. Eşleşmeyenleri
   raporlar.

5. **Küratörlük** — gizleme/sıralama/defter düzeltmesi
   `src/data/books-overrides.json` üzerinden (admin panelindeki "Kitap Rafı
   Küratörlüğü"); `books.json`'ı elle düzenleme (sonraki senkron ezer).

6. Değişiklikleri özetle: kaç kitap/kategori/kapak, kaç defter eşleşmesi.
