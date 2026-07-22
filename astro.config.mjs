// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import { transformerNotationHighlight } from "@shikijs/transformers";

const SITE = process.env.SITE_URL ?? "https://yusufdeniz.dev";

// Keystatic yalnızca ASTRO_KEYSTATIC=1 iken (lokal admin oturumu) yüklenir;
// production build'e admin çıkmaz.
const keystaticEnabled = process.env.ASTRO_KEYSTATIC === "1";
const adminIntegrations = keystaticEnabled
  ? [
      (await import("@astrojs/react")).default(),
      (await import("@keystatic/astro")).default(),
    ]
  : [];

export default defineConfig({
  site: SITE,
  output: "static",
  // webAnalytics: Vercel'e deploy edilince ziyaretçi istatistikleri otomatik
  // toplanır (vercel.com → proje → Analytics); lokalde etkisizdir
  adapter: vercel({ webAnalytics: { enabled: true } }),
  trailingSlash: "never",
  i18n: {
    defaultLocale: "tr",
    locales: ["tr", "en"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: "tr",
        locales: { tr: "tr", en: "en" },
      },
    }),
    ...adminIntegrations,
  ],
  vite: {
    plugins: [tailwindcss()],
    ...(keystaticEnabled && {
      // Keystatic'in admin sayfası CJS bağımlılıklarıyla (lodash) birlikte
      // ön-paketlenmeli; yoksa tarayıcıda hydration hatası verir
      optimizeDeps: {
        include: ["@keystatic/astro/ui", "@keystatic/core/ui", "lodash/debounce"],
      },
    }),
  },
  markdown: {
    shikiConfig: {
      themes: { light: "github-light", dark: "github-dark" },
      transformers: [
        transformerNotationHighlight(),
        {
          // ```ts title="dosya.ts" → <pre data-title="dosya.ts"> (CSS başlık çizer)
          name: "meta-title",
          pre(node) {
            const meta = this.options.meta?.__raw ?? "";
            const match = meta.match(/title="([^"]+)"/);
            if (match) node.properties["data-title"] = match[1];
          },
        },
      ],
    },
  },
});
