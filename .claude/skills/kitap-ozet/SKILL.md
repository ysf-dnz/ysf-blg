---
name: kitap-ozet
description: Bir kitabın bölüm bölüm Türkçe yeniden anlatımını NotebookLM'den üretip kitap sayfasına "Türkçe Özet" olarak ekler. Kullanıcı "şu kitabın özetini çıkar", "kitabı yeniden anlat", "Türkçe özet ekle" dediğinde tetikle.
---

# Kitap Özeti (NotebookLM → books-qa ozet alanı)

Kitap detay sayfasındaki "Türkçe Özet" bölümü, `src/content/books-qa/<driveId>.yaml`
dosyasının `ozet:` dizisinden gelir. Bu skill o diziyi NotebookLM'den üretir.

Ön koşul: kitabın `notebookId`'si dolu olmalı (`src/data/books.json`).
Not: notebooklm skill'inin günlük ~50 sorgu limiti vardır; kitap başına
~6 sorgu gerekir (1 yapı + 5 parça) → günde en fazla ~8 kitap.

## Adım 1 — Yapı çıkarımı

`notebooklm` skill'i ile deftere şu soruyu sor (birebir):

> Bu kitabın tam yapısını çıkar: Tüm bölüm (chapter) başlıklarını sırayla
> listele ve her bölümün yanına 2-3 cümlelik Türkçe içerik tanımı yaz.
> Ayrıca kitabı 5 mantıksal parçaya böl (örneğin: Bölüm 1-4 = Parça A gibi).
> Bu parçalama, sonraki adımlarda derinlemesine inceleme için kullanılacak.

Dönen yapıyı ilk özet bölümü olarak kaydet: `baslik: "Kitabın Yapısı"`.

## Adım 2 — Parça parça yeniden anlatım (5 sorgu)

Her parça için şu şablonla sor ( [Parça X: Bölüm a-b] kısmını Adım 1'deki
parçalamayla doldur):

> Şimdi [Parça A: Bölüm 1-4] üzerinde çalışacağız. Görevin ÖZET yazmak DEĞİL;
> bu bölümleri Türkçe olarak YENİDEN ANLATMAK. Kurallar:
> 1. Her bölümü ayrı başlık altında ele al ve her bölüm için EN AZ 800-1000
>    kelime yaz. Kısa yazma — atladığın her fikir kayıp demektir.
> 2. Yazarın kurduğu argüman zincirini adım adım takip et: hangi iddiayı
>    ortaya atıyor, hangi kanıtı/örneği veriyor, hangi sonuca bağlıyor.
> 3. Kitaptaki TÜM örnekleri, vaka analizlerini, anekdotları ve verileri
>    dahil et. Örnek atlama.
> 4. Önemli kavramların İngilizce orijinalini parantez içinde koru:
>    "çıpalama etkisi (anchoring effect)" gibi.
> 5. Ton samimi ve akıcı olsun — bir arkadaşına kitabı heyecanla anlatır
>    gibi, ama ciddiyeti bozmadan. Zor ve soyut meselelerde günlük hayattan
>    anlaşılır bir analoji ekle, sonra asıl kavrama geri bağlan.
> 6. Her bölümün sonunda "Bu bölümün özü" diye 2-3 cümlelik damıtılmış
>    çıkarım ver.
> Cevabın maksimum uzunlukta olsun. Yer kalmazsa nerede kaldığını belirt.

Cevap yarım kalmışsa aynı deftere "kaldığın yerden devam et: [son cümle]"
diyerek tamamla ve metinleri birleştir.

## Adım 3 — YAML'a yaz

`src/content/books-qa/<driveId>.yaml` dosyasına (varsa mevcut `bolumler`
korunarak) ekle:

```yaml
ozet:
  - baslik: "Kitabın Yapısı"
    icerik: |
      ...markdown...
  - baslik: "Parça A: Bölüm 1-4 — <tema>"
    icerik: |
      ...
```

Kurallar: kaynak numaralarını (1, 2 gibi çıplak satırlar) temizle; metni
markdown başlıklarla (`###`) bölümle; NotebookLM'in soruya değil başka temaya
cevap verdiği olur — içerik yine kitaptan geliyorsa uygun parçaya yerleştir,
alakasızsa soruyu bir kez yeniden dene.

## Adım 4 — Doğrula

`npx astro sync` şema kontrolü; dev server'da `/kutuphane/kitap/<id>`
sayfasında "Türkçe Özet" çekmecelerini kontrol et.
