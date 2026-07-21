---
name: kitap-analiz
description: Bir kitabın 12 soruluk "suyunu çıkarma" analizini NotebookLM'den üretip kitap detay sayfasının çekmecelerini doldurur. Kullanıcı "şu kitabı analiz et", "kitabın suyunu çıkar", "çekmeceleri doldur" dediğinde tetikle.
---

# Kitap Analizi (NotebookLM → books-qa)

Kitap detay sayfalarındaki (`/kutuphane/kitap/<id>`) çekmece soru-cevapları
`src/content/books-qa/<driveId>.yaml` dosyalarından gelir. Bu skill bir kitap
için o dosyayı üretir.

## Sabit soru seti (4 katman × 3 soru)

1. **Hızlı Bakış**
   - Bu kitap tek cümlede ne iddia ediyor?
   - Yazar hangi yaygın inanışın yanlış olduğunu söylüyor? (Kitabın "düşmanı" kim?)
   - Bu kitabı okumasam kaçıracağım en değerli 3 fikir ne?
2. **Derinleştirme**
   - Kitabın omurgası olan zihinsel model/framework nedir, nasıl özetlenir?
   - Yazarın en güçlü argümanı ve en zayıf/tartışmalı iddiası hangisi?
   - Kitaptaki hangi kavramlar birbirine bağlı?
3. **Uygulama**
   - Bu kitabı okuduktan sonra yarın sabah farklı yapacağım ilk şey ne olmalı?
   - Kitaptaki fikirleri kendi projeme (ör. bir yazılım ürünü) uygularsam neye benzer?
   - Yazar benim şu anki yaklaşımıma baksa neyi eleştirirdi?
4. **Eleştiri ve Bağlam**
   - Bu kitap hangi kitaplarla kavga eder, hangileriyle aynı safta durur?
   - Kitap yazıldığından bu yana hangi iddiaları eskidi, hangileri hâlâ geçerli?
   - Bu kitabın 80/20'si ne — sadece hangi bölümler okunsa yeter?

## Adımlar

1. **Kitabı bul** — `src/data/books.json` içinde başlığa göre ara (fuzzy).
   `notebookId` alanı doluysa onu kullan; boşsa `src/data/kutuphanem.json`
   defterlerinde kitap adını ara, yine yoksa kullanıcıya sor
   ("bu kitabın defteri hangisi / defter açayım mı?").

2. **NotebookLM'i sorgula** — `notebooklm` skill'i ile defteri aç; 12 soruyu
   (yukarıdaki sırayla, gerekirse 3-4 soru/istek gruplayarak) sor. Cevaplar
   YALNIZCA defter kaynaklarından gelsin; defterde karşılığı olmayan soru için
   cevap uydurma — o soruyu dosyadan çıkar.

3. **YAML'ı yaz** — `src/content/books-qa/<driveId>.yaml`:

   ```yaml
   bookId: "<driveFileId>"
   guncellenme: 2026-07-21
   bolumler:
     - baslik: "Hızlı Bakış"
       sorular:
         - soru: "Bu kitap tek cümlede ne iddia ediyor?"
           cevap: |
             Markdown destekli cevap...
   ```

   Cevaplar Türkçe, 2-6 cümle, markdown serbest (liste/vurgu olur).

4. **Doğrula** — `npm run build` (veya `npx astro sync`) şemadan geçir;
   dev server'da `/kutuphane/kitap/<id>` sayfasında çekmeceleri kontrol et.
