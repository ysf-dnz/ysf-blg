---
name: kitaplik-sync
description: Google Drive'daki kitapları (PDF/EPUB) tarayıp blogun kitap rafı verisini günceller. Kullanıcı "kitaplığı senkronla", "Drive kitaplarını güncelle", "kitap rafını yenile" dediğinde tetikle.
---

# Kitaplık Senkronu (Google Drive → books.json)

Vercel build'in Drive erişimi yoktur; senkron her zaman bu skill ile lokalde
yapılır ve çıktı repoya commit edilir.

## Adımlar

1. **Drive'ı tara** — Google Drive MCP araçlarıyla kitap dosyalarını listele:
   - `search_files` ile `mimeType='application/pdf'` ve EPUB
     (`application/epub+zip`) dosyalarını ara. Kullanıcının belirttiği klasör
     varsa (ör. "Kitaplar") önce klasörü bulup `'<folderId>' in parents`
     sorgusu kullan.
   - Her dosya için `get_file_metadata` ile `id`, `name`, `size`,
     `webViewLink`, `thumbnailLink` al.

2. **Ham veriyi yaz** — `src/data/books-raw.json` dosyasına şu şemayla yaz:

   ```json
   {
     "books": [
       {
         "id": "<driveFileId>",
         "title": "<dosya adından uzantısız, temizlenmiş başlık>",
         "author": "<başlıktan çıkarılabiliyorsa yazar, yoksa alanı atla>",
         "format": "pdf",
         "coverUrl": "<thumbnailLink varsa>",
         "driveUrl": "<webViewLink>",
         "sizeBytes": 12345,
         "category": "<varsa Drive klasör adı>"
       }
     ]
   }
   ```

   Başlık temizliği: uzantıyı at, `_`/`-` → boşluk, "Yazar - Başlık" kalıbı
   varsa yazar ve başlığı ayır.

3. **Doğrula ve yayınla** — `npm run sync:kitaplik` çalıştır. Script ham
   veriyi doğrular, normalize eder ve `src/data/books.json`'a yazar.
   Hata verirse ham veriyi düzeltip tekrar dene.

4. **Küratörlük** — Kitap gizleme/sıralama/kapak değiştirme istekleri
   `src/data/books-overrides.json` üzerinden yapılır; `books.json`'ı elle
   düzenleme (bir sonraki senkron ezer).

5. Değişiklikleri özetle: kaç kitap eklendi/çıktı, hangi kategoriler.
