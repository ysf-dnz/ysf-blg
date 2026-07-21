---
name: yazi-taslagi
description: Bir NotebookLM defterinden blog yazısı taslağı üretir. Kullanıcı "şu defterden yazı taslağı çıkar", "defterden yazı üret", "X defteri hakkında taslak" dediğinde tetikle.
---

# Defterden Yazı Taslağı (NotebookLM → MDX)

Kullanıcının NotebookLM kütüphanesi `src/data/kutuphanem.json`'da indekslidir
(438+ defter). Bu skill bir defteri sorgulayıp kaynakları hazır, şemaya uygun
bir MDX taslağı üretir.

## Adımlar

1. **Defteri bul** — Kullanıcının verdiği ada göre `src/data/kutuphanem.json`
   içindeki `notebooks[]` dizisinde ara (ad eşleşmesi esnek olsun: küçük
   harf, Türkçe karakter normalize). Birden fazla aday varsa kullanıcıya sor.
   Defterin `id`, `name`, `category`, `notebookUrl` alanlarını al.

2. **Defteri sorgula** — Kullanıcının `notebooklm` skill'i varsa onunla
   defteri aç ve şunları iste: ana temalar, önemli kavramlar, dikkat çekici
   alıntılar, defterdeki kaynakların listesi (başlık + tür). Skill yoksa
   kullanıcıdan defter özetini yapıştırmasını iste.

3. **Taslağı üret** — `src/content/posts/tr/<slug>.mdx` oluştur
   (slug: başlıktan `src/lib/slugs.ts` kurallarıyla). Frontmatter şeması
   `src/content.config.ts`'teki posts koleksiyonuna birebir uymalı:

   ```yaml
   ---
   title: "<yazı başlığı önerisi>"
   description: "<2-3 cümlelik özet — GEO için alıntılanabilir>"
   pubDate: <bugün>
   category: "<ai|yazilim|girisimcilik|egitim|kisisel — defter kategorisinden öner>"
   tags: [<defter temalarından 3-5 etiket>]
   draft: true
   lang: "tr"
   kutuphaneNode: "<defter id'si>"
   kaynaklar:
     - baslik: "<defter adı>"
       url: "<notebookUrl>"
       tur: "notebooklm"
     # + defterdeki kaynaklar (kitap/makale/video türleriyle)
   ---
   ```

4. **Gövde iskeleti** — H2 başlıklarla bölüm iskeleti + her bölümde
   defter içeriğinden 1-2 taslak paragraf. Uygun yerlerde blog MDX
   bileşenlerini kullan: `<Callout>`, `<YouTube>`, `<D3Chart>`.

5. **Doğrula** — `npm run build` (veya `npx astro check`) ile şemadan
   geçtiğini doğrula. `draft: true` kaldığını, yayının kullanıcı kararı
   olduğunu hatırlat.
