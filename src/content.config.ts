import { defineCollection, z } from "astro:content";
import { glob, file } from "astro/loaders";
import { CATEGORIES, KAYNAK_TURLERI } from "./lib/types.ts";
import { modulSchema } from "./features/modules/schema.ts";
import kutuphanem from "./data/kutuphanem.json";
import booksOverrides from "./data/books-overrides.json";
import bookTitlesTr from "./data/book-titles-tr.json";
import booksManual from "./data/books-manual.json";

const notebookIds = new Set(kutuphanem.notebooks.map((n) => n.id));

// id'ler uzantısız tutulur: tr/merhaba-dunya, hakkimda.tr
const stripExt = ({ entry }: { entry: string }) => entry.replace(/\.mdx$/, "");

const posts = defineCollection({
  loader: glob({
    pattern: "**/*.mdx",
    base: "./src/content/posts",
    generateId: stripExt,
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      category: z.enum(CATEGORIES),
      tags: z.array(z.string()).default([]),
      cover: image().optional(),
      draft: z.boolean().default(false),
      lang: z.enum(["tr", "en"]),
      translationOf: z.string().optional(),
      kaynaklar: z
        .array(
          z.object({
            baslik: z.string(),
            url: z.string().url(),
            tur: z.enum(KAYNAK_TURLERI).optional(),
          }),
        )
        .optional(),
      kutuphaneNode: z
        .string()
        .uuid()
        .optional()
        .superRefine((id, ctx) => {
          // Kırık yazı↔defter bağı build'i kırar
          if (id && !notebookIds.has(id)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `kutuphaneNode "${id}" kutuphanem.json'da yok — npm run sync:kutuphanem çalıştırın veya id'yi düzeltin`,
            });
          }
        }),
    }),
});

const singletons = defineCollection({
  loader: glob({
    pattern: "*.mdx",
    base: "./src/content/singletons",
    generateId: stripExt,
  }),
  schema: z.object({
    title: z.string(),
    lang: z.enum(["tr", "en"]),
  }),
});

const stories = defineCollection({
  loader: glob({
    pattern: "*.yaml",
    base: "./src/content/stories",
    generateId: ({ entry }) => entry.replace(/\.yaml$/, ""),
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1),
      cover: image(),
      ringColor: z.string().optional(),
      targetUrl: z.string().url(),
      targetType: z.enum([
        "internal",
        "medium",
        "youtube",
        "instagram",
        "external",
      ]),
      // slides varsa site içi story viewer açılır; yoksa doğrudan targetUrl
      slides: z
        .array(
          z.object({
            image: image().optional(),
            title: z.string().optional(),
            text: z.string().optional(),
            durationMs: z.number().int().positive().default(5000),
            cta: z
              .object({ label: z.string(), url: z.string().url() })
              .optional(),
          }),
        )
        .optional(),
      publishedAt: z.coerce.date(),
      expiresAt: z.coerce.date().optional(),
      pinned: z.boolean().default(false),
      order: z.number().default(0),
    }),
});

const libraryCategories = defineCollection({
  loader: file("src/data/kutuphanem.json", {
    parser: (text) => JSON.parse(text).categories,
  }),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    full: z.string().optional(),
    color: z.string(),
    notebookCount: z.number().int().nonnegative(),
  }),
});

const libraryNotebooks = defineCollection({
  loader: file("src/data/kutuphanem.json", {
    parser: (text) => JSON.parse(text).notebooks,
  }),
  schema: z.object({
    id: z.string().uuid(),
    name: z.string(),
    nameEn: z.string().optional(),
    category: z.string(),
    color: z.string(),
    sourceCount: z.number().int().nonnegative(),
    shared: z.boolean(),
    notebookUrl: z.string().url(),
  }),
});

const books = defineCollection({
  loader: file("src/data/books.json", {
    // Katmanlar: Drive sync + elle eklenenler → küratörlük ezmesi → TR başlık
    parser: (text) => {
      const raw = JSON.parse(text).books as { id: string }[];
      const manual = booksManual.books as { id: string }[];
      const overrideList = booksOverrides.overrides as {
        id: string;
        hidden?: boolean;
        order?: number;
        notebookId?: string;
        titleTr?: string;
      }[];
      const overrides = new Map(overrideList.map((o) => [o.id, o] as const));
      const titlesTr = bookTitlesTr as Record<string, string>;
      return [...raw, ...manual]
        .map((b) => {
          const o = overrides.get(b.id) ?? {};
          // Keystatic boş select/text'i "" yazar; boş değerler ezmesin
          const temiz = Object.fromEntries(
            Object.entries(o).filter(([, v]) => v !== "" && v !== undefined),
          );
          return {
            ...b,
            titleTr: titlesTr[b.id] ?? (b as { titleTr?: string }).titleTr,
            ...temiz,
          };
        })
        .filter((b) => !("hidden" in b && b.hidden));
    },
  }),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    titleTr: z.string().optional(),
    author: z.string().optional(),
    format: z.enum(["pdf", "epub"]),
    // public/book-covers altında önceden küçültülmüş jpeg (sync üretir)
    cover: z.string().startsWith("/book-covers/").optional(),
      driveUrl: z.string().url(),
      sizeBytes: z.number().optional(),
      category: z.string().optional(),
      notebookId: z.string().uuid().optional(),
      order: z.number().optional(),
    }),
});

const booksQa = defineCollection({
  loader: glob({
    pattern: "*.yaml",
    base: "./src/content/books-qa",
    generateId: ({ entry }) => entry.replace(/\.yaml$/, ""),
  }),
  schema: z.object({
    bookId: z.string(),
    guncellenme: z.coerce.date(),
    bolumler: z
      .array(
        z.object({
          baslik: z.string(),
          sorular: z.array(
            z.object({
              soru: z.string(),
              cevap: z.string(), // markdown
            }),
          ),
        }),
      )
      .default([]),
    // NotebookLM'den bölüm bölüm Türkçe yeniden anlatım (kitap-ozet skill'i üretir)
    ozet: z
      .array(
        z.object({
          baslik: z.string(),
          icerik: z.string(), // markdown
        }),
      )
      .optional(),
  }),
});

const projeler = defineCollection({
  loader: glob({
    pattern: "*.yaml",
    base: "./src/content/projeler",
    generateId: ({ entry }) => entry.replace(/\.yaml$/, ""),
  }),
  schema: ({ image }) =>
    z.object({
      ad: z.string().min(1),
      aciklama: z.string().min(1),
      kapak: image().optional(),
      etiketler: z.array(z.string()).default([]),
      url: z.string().url().optional(),
      repoUrl: z.string().url().optional(),
      durum: z.enum(["aktif", "tamamlandi", "arsiv"]).default("aktif"),
      tarih: z.coerce.date(),
      order: z.number().default(0),
      oneCikan: z.boolean().default(false),
      icerik: z.string().optional(), // markdown gövde
      moduller: modulSchema,
    }),
});

// Kitap detay sayfasına panelden eklenen ek pencereler (id = Drive dosya id'si)
const bookExtras = defineCollection({
  loader: glob({
    pattern: "*.yaml",
    base: "./src/content/book-extras",
    generateId: ({ entry }) => entry.replace(/\.yaml$/, ""),
  }),
  schema: z.object({
    bookId: z.string(),
    moduller: modulSchema,
  }),
});

// Ana sayfa modülleri + footer sosyal linkleri (panelden yönetilir)
const siteConfig = defineCollection({
  loader: glob({
    pattern: "*.yaml",
    base: "./src/content/site",
    generateId: ({ entry }) => entry.replace(/\.yaml$/, ""),
  }),
  schema: z.object({
    moduller: modulSchema.optional(),
    // Kitap detay sayfası bölüm sırası (kitap-sayfa.yaml); listede olmayan
    // bölüm sayfada hiç görünmez
    sira: z
      .array(z.enum(["sorular", "ozet", "oku", "moduller", "planlar", "sohbet"]))
      .optional(),
    linkler: z
      .array(
        z.object({
          platform: z.enum([
            "github",
            "x",
            "linkedin",
            "instagram",
            "youtube",
            "medium",
            "mail",
            "rss",
            "website",
          ]),
          url: z.string().min(1),
          etiket: z.string().optional(),
        }),
      )
      .optional(),
  }),
});

export const collections = {
  posts,
  singletons,
  stories,
  libraryCategories,
  libraryNotebooks,
  books,
  booksQa,
  projeler,
  bookExtras,
  siteConfig,
};
