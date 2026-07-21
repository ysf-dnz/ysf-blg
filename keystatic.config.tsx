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
      Sayfalar: ["hakkimdaTr", "hakkimdaEn"],
      Kütüphane: ["booksOverrides"],
    },
  },
  collections: {
    postsTr: postCollection("tr", "Yazılar (TR)"),
    postsEn: postCollection("en", "Posts (EN)"),
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
            hidden: fields.checkbox({ label: "Gizle", defaultValue: false }),
            order: fields.integer({ label: "Sıra" }),
            coverUrl: fields.url({ label: "Kapak URL (özel)" }),
          }),
          {
            label: "Kitap ayarları",
            itemLabel: (item) => item.fields.id.value || "kitap",
          },
        ),
      },
    }),
  },
});
