/**
 * Keystatic admin paneli şeması.
 *
 * Çalıştırma: ASTRO_KEYSTATIC=1 npm run dev  →  http://localhost:4321/keystatic
 * (kısayol: npm run admin)
 *
 * local mode: değişiklikler doğrudan çalışma dizinindeki dosyalara yazılır.
 * GitHub mode'a geçiş README'de anlatılır.
 */
import { config, collection, singleton, fields } from "@keystatic/core";
import kutuphanem from "./src/data/kutuphanem.json";
import bookCategories from "./src/data/book-categories.json";

const bookCategoryOptions = [
  { label: "— otomatik (başlıktan) —", value: "" },
  ...bookCategories.kategoriler.map((k) => ({ label: k.ad, value: k.key })),
];

/**
 * Modüler pencereler: sıralama sürükle-bırak ile değişir (blocks alanı bunu
 * hazır verir). Aynı blok seti proje detayları, kitap ek pencereleri ve
 * ana sayfada kullanılır.
 */
const modulBlocks = (label: string) =>
  fields.blocks(
    {
      halka: {
        label: "Yuvarlak pencere (halka)",
        itemLabel: (props) => `⭕ ${props.fields.baslik.value || "halka"}`,
        schema: fields.object({
          baslik: fields.text({
            label: "Başlık",
            validation: { isRequired: true },
          }),
          kapak: fields.image({
            label: "Kapak görseli",
            directory: "public/moduller",
            publicPath: "/moduller/",
            validation: { isRequired: true },
          }),
          ringColor: fields.text({
            label: "Halka rengi (hex)",
            description: "Boşsa marka rengi. Örn: #d97706",
          }),
          hedefUrl: fields.text({
            label: "Hedef URL",
            description: "Site içi yol (/yazilar/...) ya da tam URL.",
            validation: { isRequired: true },
          }),
          hedefTip: fields.select({
            label: "Hedef türü",
            options: [
              { label: "Site içi", value: "internal" },
              { label: "Medium", value: "medium" },
              { label: "YouTube", value: "youtube" },
              { label: "Instagram", value: "instagram" },
              { label: "Diğer", value: "external" },
            ],
            defaultValue: "external",
          }),
        }),
      },
      drivePdf: {
        label: "Drive PDF penceresi",
        itemLabel: (props) =>
          `📄 ${props.fields.baslik.value || props.fields.dosyaId.value || "PDF"}`,
        schema: fields.object({
          baslik: fields.text({ label: "Başlık (opsiyonel)" }),
          dosyaId: fields.text({
            label: "Drive dosya id'si veya linki",
            description:
              "Dosya Drive'da link-paylaşımlı olmalı; site içinde gömülü açılır.",
            validation: { isRequired: true },
          }),
        }),
      },
      driveJpeg: {
        label: "Drive görsel (JPEG) penceresi",
        itemLabel: (props) =>
          `🖼 ${props.fields.baslik.value || props.fields.dosyaId.value || "görsel"}`,
        schema: fields.object({
          baslik: fields.text({ label: "Başlık (opsiyonel)" }),
          dosyaId: fields.text({
            label: "Drive dosya id'si veya linki",
            description: "Link-paylaşımlı görsel; indirme olmadan gösterilir.",
            validation: { isRequired: true },
          }),
          genislik: fields.integer({
            label: "Genişlik (px)",
            defaultValue: 1600,
          }),
        }),
      },
      youtube: {
        label: "YouTube penceresi",
        itemLabel: (props) =>
          `▶️ ${props.fields.baslik.value || props.fields.url.value || "video"}`,
        schema: fields.object({
          baslik: fields.text({ label: "Başlık (opsiyonel)" }),
          url: fields.text({
            label: "Video URL'si veya id'si",
            validation: { isRequired: true },
          }),
        }),
      },
      spotify: {
        label: "Spotify penceresi",
        itemLabel: (props) =>
          `🎧 ${props.fields.baslik.value || props.fields.url.value || "spotify"}`,
        schema: fields.object({
          baslik: fields.text({ label: "Başlık (opsiyonel)" }),
          url: fields.text({
            label: "Spotify linki",
            description: "Şarkı, albüm, çalma listesi veya bölüm linki.",
            validation: { isRequired: true },
          }),
        }),
      },
    },
    {
      label,
      description: "Pencereleri sürükleyerek sıralayabilirsiniz.",
    },
  );

const notebookOptions = [
  { label: "— defter yok —", value: "" },
  ...kutuphanem.notebooks
    .map((n) => ({ label: n.name, value: n.id }))
    .sort((a, b) => a.label.localeCompare(b.label, "tr")),
];

const kategoriOptions = [
  { label: "Yapay Zekâ", value: "ai" },
  { label: "Yazılım", value: "yazilim" },
  { label: "Girişimcilik", value: "girisimcilik" },
  { label: "Eğitim", value: "egitim" },
  { label: "Kişisel", value: "kisisel" },
] as const;

const kaynakTuruOptions = [
  { label: "NotebookLM defteri", value: "notebooklm" },
  { label: "Kitap", value: "kitap" },
  { label: "Makale", value: "makale" },
  { label: "Video", value: "video" },
] as const;

function postCollection(lang: "tr" | "en", label: string) {
  return collection({
    label,
    slugField: "title",
    path: `src/content/posts/${lang}/*`,
    entryLayout: "content",
    format: { contentField: "content" },
    schema: {
      title: fields.slug({ name: { label: "Başlık" } }),
      description: fields.text({
        label: "Özet (description)",
        description: "2-3 cümle; SEO ve AI alıntılanabilirliği için kritik.",
        multiline: true,
        validation: { isRequired: true },
      }),
      pubDate: fields.date({
        label: "Yayın tarihi",
        validation: { isRequired: true },
      }),
      updatedDate: fields.date({ label: "Güncelleme tarihi" }),
      category: fields.select({
        label: "Kategori",
        options: [...kategoriOptions],
        defaultValue: "yazilim",
      }),
      tags: fields.array(fields.text({ label: "Etiket" }), {
        label: "Etiketler",
        itemLabel: (item) => item.value || "etiket",
      }),
      cover: fields.image({
        label: "Kapak görseli",
        directory: "src/assets/covers",
        publicPath: "../../../assets/covers/",
      }),
      draft: fields.checkbox({ label: "Taslak", defaultValue: true }),
      lang: fields.select({
        label: "Dil",
        options: [
          { label: "Türkçe", value: "tr" },
          { label: "English", value: "en" },
        ],
        defaultValue: lang,
      }),
      translationOf: fields.text({
        label: "Çevirisi olduğu yazının slug'ı",
        description: "Diğer dildeki karşılığın slug'ı (varsa).",
      }),
      kutuphaneNode: fields.select({
        label: "NotebookLM defteri",
        description: "Bu yazının beslendiği kutuphanem defteri.",
        options: notebookOptions,
        defaultValue: "",
      }),
      kaynaklar: fields.array(
        fields.object({
          baslik: fields.text({ label: "Başlık", validation: { isRequired: true } }),
          url: fields.url({ label: "URL", validation: { isRequired: true } }),
          tur: fields.select({
            label: "Tür",
            options: [...kaynakTuruOptions],
            defaultValue: "makale",
          }),
        }),
        {
          label: "Kaynaklar",
          itemLabel: (item) => item.fields.baslik.value || "kaynak",
        },
      ),
      content: fields.mdx({
        label: "İçerik",
        options: {
          image: {
            directory: "src/assets/posts",
            publicPath: "../../../assets/posts/",
          },
        },
        components: {},
      }),
    },
  });
}

function hakkimdaSingleton(lang: "tr" | "en", label: string) {
  return singleton({
    label,
    path: `src/content/singletons/hakkimda.${lang}`,
    format: { contentField: "content" },
    schema: {
      title: fields.text({ label: "Başlık", validation: { isRequired: true } }),
      lang: fields.select({
        label: "Dil",
        options: [
          { label: "Türkçe", value: "tr" },
          { label: "English", value: "en" },
        ],
        defaultValue: lang,
      }),
      projeler: fields.array(
        fields.object({
          ad: fields.text({ label: "Ad", validation: { isRequired: true } }),
          aciklama: fields.text({
            label: "Açıklama",
            validation: { isRequired: true },
          }),
          url: fields.url({ label: "URL" }),
        }),
        {
          label: "Projeler",
          itemLabel: (item) => item.fields.ad.value || "proje",
        },
      ),
      content: fields.mdx({ label: "Bio" }),
    },
  });
}

export default config({
  storage: { kind: "local" },
  ui: {
    brand: { name: "ysf-blog admin" },
    navigation: {
      İçerik: ["postsTr", "postsEn", "stories"],
      Projeler: ["projeler"],
      Sayfalar: ["hakkimdaTr", "hakkimdaEn", "anaSayfa"],
      Kütüphane: [
        "booksOverrides",
        "booksManual",
        "bookExtras",
        "bookCategories",
        "kitapSayfa",
      ],
      Ayarlar: ["sosyal"],
    },
  },
  collections: {
    postsTr: postCollection("tr", "Yazılar (TR)"),
    postsEn: postCollection("en", "Posts (EN)"),
    projeler: collection({
      label: "Projeler",
      slugField: "ad",
      path: "src/content/projeler/*",
      format: { data: "yaml" },
      schema: {
        ad: fields.slug({ name: { label: "Proje adı" } }),
        aciklama: fields.text({
          label: "Kısa açıklama",
          multiline: true,
          validation: { isRequired: true },
        }),
        kapak: fields.image({
          label: "Kapak görseli",
          directory: "src/assets/projeler",
          publicPath: "../../assets/projeler/",
        }),
        etiketler: fields.array(fields.text({ label: "Etiket" }), {
          label: "Etiketler",
          itemLabel: (item) => item.value || "etiket",
        }),
        url: fields.url({ label: "Canlı site URL'si" }),
        repoUrl: fields.url({ label: "Kaynak kod URL'si" }),
        durum: fields.select({
          label: "Durum",
          options: [
            { label: "Aktif", value: "aktif" },
            { label: "Tamamlandı", value: "tamamlandi" },
            { label: "Arşiv", value: "arsiv" },
          ],
          defaultValue: "aktif",
        }),
        tarih: fields.date({
          label: "Tarih",
          validation: { isRequired: true },
        }),
        order: fields.integer({ label: "Sıra", defaultValue: 0 }),
        oneCikan: fields.checkbox({
          label: "Öne çıkan (Hakkımda sayfasında görünür)",
          defaultValue: false,
        }),
        icerik: fields.text({
          label: "Detay metni (markdown)",
          multiline: true,
        }),
        moduller: modulBlocks("Modüler pencereler"),
      },
    }),
    bookExtras: collection({
      label: "Kitap Ek Pencereleri",
      slugField: "not",
      path: "src/content/book-extras/*",
      format: { data: "yaml" },
      schema: {
        not: fields.slug({
          name: {
            label: "Etiket (dosya adı)",
            description: "Kısa bir hatırlatma adı; örn. kitabın adı.",
          },
        }),
        bookId: fields.text({
          label: "Drive dosya id'si (kitap)",
          description:
            "Kitap detay sayfasının URL'sindeki id: /kutuphane/kitap/<id>",
          validation: { isRequired: true },
        }),
        moduller: modulBlocks("Modüler pencereler"),
      },
    }),
    stories: collection({
      label: "Hikâyeler",
      slugField: "title",
      path: "src/content/stories/*",
      format: { data: "yaml" },
      schema: {
        title: fields.slug({ name: { label: "Başlık" } }),
        cover: fields.image({
          label: "Halka görseli",
          directory: "src/assets/stories",
          publicPath: "../../assets/stories/",
          validation: { isRequired: true },
        }),
        ringColor: fields.text({
          label: "Halka rengi (hex)",
          description: "Boş bırakılırsa marka rengi kullanılır. Örn: #d97706",
        }),
        targetUrl: fields.url({
          label: "Hedef URL",
          description: "Slide yoksa tıklanınca doğrudan buraya gider.",
          validation: { isRequired: true },
        }),
        targetType: fields.select({
          label: "Hedef türü",
          options: [
            { label: "Site içi yazı", value: "internal" },
            { label: "Medium", value: "medium" },
            { label: "YouTube", value: "youtube" },
            { label: "Instagram", value: "instagram" },
            { label: "Diğer", value: "external" },
          ],
          defaultValue: "external",
        }),
        publishedAt: fields.date({
          label: "Yayın tarihi",
          validation: { isRequired: true },
        }),
        expiresAt: fields.date({
          label: "Bitiş tarihi",
          description: "Boşsa hikâye süresiz görünür.",
        }),
        pinned: fields.checkbox({ label: "Sabitle", defaultValue: false }),
        order: fields.integer({ label: "Sıra", defaultValue: 0 }),
        slides: fields.array(
          fields.object({
            image: fields.image({
              label: "Görsel",
              directory: "src/assets/stories",
              publicPath: "../../assets/stories/",
            }),
            title: fields.text({ label: "Başlık" }),
            text: fields.text({ label: "Metin", multiline: true }),
            durationMs: fields.integer({
              label: "Süre (ms)",
              defaultValue: 5000,
            }),
            cta: fields.object({
              label: fields.text({ label: "Buton yazısı" }),
              url: fields.url({ label: "Buton URL" }),
            }),
          }),
          {
            label: "Slide'lar (boşsa doğrudan link)",
            itemLabel: (item) => item.fields.title.value || "slide",
          },
        ),
      },
    }),
  },
  singletons: {
    hakkimdaTr: hakkimdaSingleton("tr", "Hakkımda (TR)"),
    hakkimdaEn: hakkimdaSingleton("en", "About (EN)"),
    booksOverrides: singleton({
      label: "Kitap Rafı Küratörlüğü",
      path: "src/data/books-overrides",
      format: { data: "json" },
      schema: {
        _aciklama: fields.text({
          label: "Açıklama",
          defaultValue:
            "Kitap rafı küratörlüğü: id eşleşen kayıtların alanlarını ezer.",
        }),
        overrides: fields.array(
          fields.object({
            id: fields.text({
              label: "Drive dosya id'si",
              validation: { isRequired: true },
            }),
            hidden: fields.checkbox({
              label: "Gizle (raftan kaldır)",
              defaultValue: false,
            }),
            order: fields.integer({ label: "Sıra" }),
            titleTr: fields.text({
              label: "Türkçe başlık (elle düzeltme)",
              description: "Boşsa otomatik çeviri katmanı kullanılır.",
            }),
            notebookId: fields.select({
              label: "NotebookLM defteri (elle düzeltme)",
              options: notebookOptions,
              defaultValue: "",
            }),
          }),
          {
            label: "Kitap ayarları",
            itemLabel: (item) => item.fields.id.value || "kitap",
          },
        ),
      },
    }),
    booksManual: singleton({
      label: "Elle Kitap Ekle",
      path: "src/data/books-manual",
      format: { data: "json" },
      schema: {
        _aciklama: fields.text({
          label: "Açıklama",
          defaultValue:
            "Panelden elle eklenen kitaplar; Drive sync'ine dokunmaz. Keystatic → Kütüphane → Elle Kitap Ekle.",
        }),
        books: fields.array(
          fields.object({
            id: fields.text({
              label: "Drive dosya id'si",
              description:
                "Kitabın Drive linkindeki id (file/d/<id>). Detay sayfası ve gömülü okuma bu id'yle çalışır.",
              validation: { isRequired: true },
            }),
            title: fields.text({
              label: "Orijinal başlık",
              validation: { isRequired: true },
            }),
            titleTr: fields.text({ label: "Türkçe başlık" }),
            author: fields.text({ label: "Yazar" }),
            format: fields.select({
              label: "Format",
              options: [
                { label: "PDF", value: "pdf" },
                { label: "EPUB", value: "epub" },
              ],
              defaultValue: "pdf",
            }),
            cover: fields.image({
              label: "Kapak",
              directory: "public/book-covers",
              publicPath: "/book-covers/",
            }),
            driveUrl: fields.url({
              label: "Drive linki",
              validation: { isRequired: true },
            }),
            category: fields.select({
              label: "Kategori",
              options: bookCategoryOptions,
              defaultValue: "",
            }),
            notebookId: fields.select({
              label: "NotebookLM defteri",
              options: notebookOptions,
              defaultValue: "",
            }),
          }),
          {
            label: "Kitaplar",
            itemLabel: (item) =>
              item.fields.titleTr.value || item.fields.title.value || "kitap",
          },
        ),
      },
    }),
    bookCategories: singleton({
      label: "Kitap Kategorileri",
      path: "src/data/book-categories",
      format: { data: "json" },
      schema: {
        kategoriler: fields.array(
          fields.object({
            key: fields.text({
              label: "Anahtar (slug)",
              description: "Küçük harf, tire; örn: yapay-zeka",
              validation: { isRequired: true },
            }),
            ad: fields.text({
              label: "Görünen ad",
              validation: { isRequired: true },
            }),
            renk: fields.text({
              label: "Renk (hex)",
              validation: { isRequired: true },
            }),
            oncelik: fields.integer({
              label: "Eşleşme önceliği",
              description: "Küçük sayı önce denenir; 99 = eşleşme kuralı yok.",
              defaultValue: 50,
            }),
            anahtarKelimeler: fields.array(fields.text({ label: "Kelime" }), {
              label: "Anahtar kelimeler (regex parçaları)",
              itemLabel: (item) => item.value || "kelime",
            }),
          }),
          {
            label: "Kategoriler (dizi sırası = rafta görünüm sırası)",
            itemLabel: (item) => item.fields.ad.value || "kategori",
          },
        ),
      },
    }),
    kitapSayfa: singleton({
      label: "Kitap Sayfası Düzeni",
      path: "src/content/site/kitap-sayfa",
      format: { data: "yaml" },
      schema: {
        sira: fields.array(
          fields.select({
            label: "Bölüm",
            options: [
              { label: "Sorularla Bu Kitap (çekmeceler)", value: "sorular" },
              { label: "Türkçe Özet", value: "ozet" },
              { label: "Kitabı Oku (Drive)", value: "oku" },
              { label: "Ek pencereler (modüller)", value: "moduller" },
              { label: "İndirme Planları", value: "planlar" },
              { label: "Kitapla Sohbet", value: "sohbet" },
            ],
            defaultValue: "sorular",
          }),
          {
            label:
              "Bölüm sırası — sürükleyerek değiştirin; listeden çıkarılan bölüm sayfada görünmez",
            itemLabel: (item) => item.value,
          },
        ),
      },
    }),
    anaSayfa: singleton({
      label: "Ana Sayfa Modülleri",
      path: "src/content/site/ana-sayfa",
      format: { data: "yaml" },
      schema: {
        moduller: modulBlocks("Ana sayfa pencereleri"),
      },
    }),
    sosyal: singleton({
      label: "Sosyal Medya",
      path: "src/content/site/sosyal",
      format: { data: "yaml" },
      schema: {
        linkler: fields.array(
          fields.object({
            platform: fields.select({
              label: "Platform",
              options: [
                { label: "GitHub", value: "github" },
                { label: "X (Twitter)", value: "x" },
                { label: "LinkedIn", value: "linkedin" },
                { label: "Instagram", value: "instagram" },
                { label: "YouTube", value: "youtube" },
                { label: "Medium", value: "medium" },
                { label: "E-posta", value: "mail" },
                { label: "RSS", value: "rss" },
                { label: "Web sitesi", value: "website" },
              ],
              defaultValue: "website",
            }),
            url: fields.text({
              label: "URL",
              description: "E-posta için mailto:adres yazın.",
              validation: { isRequired: true },
            }),
            etiket: fields.text({ label: "Özel etiket (opsiyonel)" }),
          }),
          {
            label: "Linkler (footer'da bu sırayla görünür)",
            itemLabel: (item) => item.fields.platform.value || "link",
          },
        ),
      },
    }),
  },
});
