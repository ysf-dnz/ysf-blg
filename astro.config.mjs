// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import clerk from "@clerk/astro";
import { trTR } from "@clerk/localizations";
import { loadEnv } from "vite";

// Clerk env'leri Vercel entegrasyonundan NEXT_PUBLIC_* adıyla gelir;
// astro.config process.env'e .env dosyalarını yüklemez → loadEnv gerekir.
const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
import tailwindcss from "@tailwindcss/vite";
import { transformerNotationHighlight } from "@shikijs/transformers";

const SITE = process.env.SITE_URL ?? "https://yusufdeniz.dev";

// Keystatic admin paneli. Lokalde ASTRO_KEYSTATIC=1 (npm run admin) ile,
// canlıda KEYSTATIC_GITHUB_CLIENT_ID tanımlıysa yüklenir.
// Canlıda depolama GitHub modudur (keystatic.config.tsx): giriş GitHub ile
// yapılır ve YALNIZCA repoya yazma yetkisi olan kişi panele girebilir —
// anahtarlar Vercel env'inde yoksa panel hiç derlenmez (kazara açılmaz).
const keystaticEnabled =
  process.env.ASTRO_KEYSTATIC === "1" ||
  Boolean(process.env.KEYSTATIC_GITHUB_CLIENT_ID);
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
  adapter: vercel({
    webAnalytics: { enabled: true },
    // Davet kartı çalışma zamanında üretilir (satori + resvg); fontlar fonksiyon
    // paketine girmeli — render.ts process.cwd()/src/... yolundan okur (ADR 0001 K3.1)
    includeFiles: [
      "src/features/seo/og/fonts/fraunces-600.ttf",
      "src/features/seo/og/fonts/inter-400.ttf",
      "src/features/seo/og/fonts/inter-700.ttf",
    ],
  }),
  security: {
    // Astro 5.14+ X-Forwarded-Host'a yalnız bu listedekiler için güvenir.
    // Liste TANIMSIZKEN Vercel'de Astro kendini iç host (localhost) sanır:
    // Astro.url.origin bozulur (davet linki "localhost" çıktı) ve CSRF
    // checkOrigin GERÇEK form POST'larını bile 403'ler (onboarding kırıldı).
    allowedDomains: [
      { hostname: "yusufdeniz.com", protocol: "https" },
      { hostname: "www.yusufdeniz.com", protocol: "https" },
      { hostname: "**.vercel.app", protocol: "https" },
    ],
  },
  trailingSlash: "never",
  // Yönlendirmeler adapter çıktısına rota olarak yazılır (Vercel harf duyarlı,
  // middleware'e ulaşmayan yollar burada çözülür — ADR 0001 K3.3).
  // Dinamik hedef yalnız VAR OLAN bir rota anahtarıyla birebir eşleşirse çalışır;
  // query taşıyamaz.
  redirects: {
    "/dersler": { status: 301, destination: "/kurslar" },
    // QR içeriği büyük harf (alfanümerik mod); Astro yönlendiricisi harf duyarlı → açık 301.
    // Hedef VAR OLAN rota anahtarı olmalı (query taşıyamaz). DİKKAT: Vercel kenarı bu deseni
    // harf DUYARSIZ eşleştirir (/d/kod da buraya düşer) → hedef, kaynağın küçük harfli hâliyle
    // ASLA aynı yol olmamalı ("/T/[x]" → "/t/[x]" canlıda sonsuz döngü); kanal davetKanali'nden.
    "/D/[kod]": { status: 301, destination: "/d/q/[kod]" },
  },
  i18n: {
    defaultLocale: "tr",
    locales: ["tr", "en"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [
    // Clerk env adları Vercel entegrasyonundan NEXT_PUBLIC_* olarak gelir.
    // secretKey BURAYA VERİLMEZ: @clerk/astro entegrasyon opsiyonlarını
    // injectScript ile tarayıcıya serileştirir (JSON.stringify) — buraya
    // konan sır client bundle'ına açık metin iner. Sunucu tarafı
    // CLERK_SECRET_KEY'i kendisi env'den okur.
    clerk({
      localization: trTR,
      publishableKey:
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
        env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    }),
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: "tr",
        locales: { tr: "tr", en: "en" },
      },
      // Statik yollu SSR sayfalar da sitemap'e girer; üye alanı girmesin
      // (/uyeler herkese açık, kalır). Dinamik [slug] sayfaları girmez →
      // kurslar ve etkinlikler için SSR sitemap'ler ayrıca listelenir (F1-04, F3-02).
      filter: (page) => !/\/uye(\/|$)/.test(new URL(page).pathname),
      customSitemaps: [`${SITE}/sitemap-kurslar.xml`, `${SITE}/sitemap-etkinlikler.xml`],
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
