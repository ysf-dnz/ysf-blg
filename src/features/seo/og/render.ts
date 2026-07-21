/**
 * satori + resvg ile OG image üretimi (build-time, 1200×630 PNG).
 * Fraunces başlık + Inter meta; marka renkleri; girih köşe süsü.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

// Build bundle'ı dist/ altından çalışır; fontlar proje kökünden okunur
const fontDir = join(process.cwd(), "src/features/seo/og/fonts");

const fonts = Promise.all([
  readFile(join(fontDir, "fraunces-600.ttf")),
  readFile(join(fontDir, "inter-400.ttf")),
  readFile(join(fontDir, "inter-700.ttf")),
]);

const KATEGORI_RENK: Record<string, string> = {
  ai: "#7c5cff",
  yazilim: "#3fb8bc",
  girisimcilik: "#d97706",
  egitim: "#2563eb",
  kisisel: "#db2777",
};

export interface OgInput {
  title: string;
  category?: string;
  categoryLabel?: string;
}

export async function renderOgImage(input: OgInput): Promise<Buffer> {
  const [fraunces, inter, interBold] = await fonts;
  const accent = KATEGORI_RENK[input.category ?? ""] ?? "#3fb8bc";

  const tree = {
      type: "div",
      props: {
        style: {
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          backgroundColor: "#0a2b33",
          backgroundImage:
            "radial-gradient(circle at 90% -10%, #1a7d8655, transparent 60%)",
          color: "#fdfcfa",
          fontFamily: "Inter",
        },
        children: [
          input.categoryLabel
            ? {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignSelf: "flex-start",
                    padding: "8px 20px",
                    borderRadius: "999px",
                    backgroundColor: accent,
                    color: "#ffffff",
                    fontSize: "24px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "2px",
                  },
                  children: input.categoryLabel,
                },
              }
            : { type: "div", props: { children: "" } },
          {
            type: "div",
            props: {
              style: {
                fontFamily: "Fraunces",
                fontSize: input.title.length > 60 ? "56px" : "68px",
                fontWeight: 600,
                lineHeight: 1.15,
                maxWidth: "1000px",
              },
              children: input.title,
            },
          },
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "28px",
                color: "#93a5a8",
              },
              children: [
                { type: "div", props: { children: "Yusuf Deniz" } },
                {
                  type: "div",
                  props: {
                    style: { color: accent, fontWeight: 700 },
                    children: "yusufdeniz.dev",
                  },
                },
              ],
            },
          },
        ],
      },
    };

  const svg = await satori(
    // satori düz nesne ağacı kabul eder; ReactNode tipine dönüştürülür
    tree as unknown as Parameters<typeof satori>[0],
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Fraunces", data: fraunces, weight: 600, style: "normal" },
        { name: "Inter", data: inter, weight: 400, style: "normal" },
        { name: "Inter", data: interBold, weight: 700, style: "normal" },
      ],
    },
  );

  return new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
  })
    .render()
    .asPng();
}
