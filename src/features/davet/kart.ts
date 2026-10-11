/**
 * Davet kartı (PRD §4.3, ADR 0001 K3): satori ağacı → resvg PNG. Çalışma zamanında
 * koşar (api/kart). Marka: OG hattının fontları/renkleri (seo/og/render.ts).
 * Düzen: kapak → başlık → vaat → meta → "{Ad} seni davet ediyor" → en altta QR + kısa link.
 */
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { ogFontlari } from "@/features/seo/og/render.ts";

export type KartFormat = "story" | "kare" | "og";
export const KART_BOYUT: Record<KartFormat, [number, number]> = {
  story: [1080, 1920],
  kare: [1080, 1080],
  og: [1200, 630],
};

export interface KartGirdi {
  format: KartFormat;
  baslik: string;
  vaat?: string | null;
  meta: string[];
  davetEden: { ad: string; avatarUrl?: string | null };
  not?: string | null;
  kapakUrl?: string | null;
  /** uqr renderSVG çıktısı */
  qrSvg: string;
  /** Protokolsüz, elle yazılabilir: host/d/kod */
  kisaLink: string;
}

const RENK = { zemin: "#0a2b33", metin: "#fdfcfa", soluk: "#93a5a8", vurgu: "#3fb8bc", kart: "#123b44" };
const GORSEL_TIP = /^image\/(png|jpeg|gif|webp|avif|svg\+xml)/;

/** Dış görseli data-URI'ye çevirir; 3 sn / hata / görsel olmayan yanıt → null (kart görselsiz üretilir) */
async function dataUri(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const tip = r.headers.get("content-type") ?? "";
    if (!r.ok || !GORSEL_TIP.test(tip)) return null;
    return `data:${tip.split(";")[0]};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

type Agac = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, children?: unknown): Agac => ({
  type,
  props: { style: { display: "flex", ...style }, ...(children === undefined ? {} : { children }) },
});
// Inter/Fraunces Latin Extended: Türkçe tam, emoji yok → tofu yerine düşürülür (🚀 notta görüldü)
const temiz = (s: string) => s.replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, "").replace(/\s+/g, " ").trim();
const yazi = (metin: string, style: Record<string, unknown>) =>
  el("div", { textOverflow: "ellipsis", ...style }, temiz(metin));

export async function renderDavetKarti(g: KartGirdi): Promise<Buffer> {
  const [w, h] = KART_BOYUT[g.format];
  const og = g.format === "og";
  // Ölçek: story 1080 geniş sütun; kare aynı genişlik, kısa boy; og yatay üç sütun
  const k = og ? 0.78 : g.format === "kare" ? 0.78 : 1;
  const px = (n: number) => `${Math.round(n * k)}px`;
  const [kapak, avatar] = await Promise.all([dataUri(g.kapakUrl), dataUri(g.davetEden.avatarUrl)]);
  const qr = `data:image/svg+xml;base64,${Buffer.from(g.qrSvg).toString("base64")}`;

  const kapakKutu = kapak
    ? el("img", { width: og ? "300px" : "100%", height: og ? "100%" : px(g.format === "kare" ? 220 : 560), objectFit: "cover", borderRadius: px(28) }, undefined)
    : null;
  if (kapakKutu) kapakKutu.props.src = kapak;

  const metinler = [
    yazi(g.baslik, { fontFamily: "Fraunces", fontWeight: 600, fontSize: px(og ? 60 : 72), lineHeight: 1.1, color: RENK.metin, lineClamp: g.format === "kare" ? 2 : 3 }),
    g.vaat ? yazi(g.vaat, { fontSize: px(36), lineHeight: 1.3, color: RENK.soluk, lineClamp: 2 }) : null,
    g.meta.length
      ? el("div", { gap: px(14), flexWrap: "wrap" }, g.meta.map((m) =>
          yazi(m, { padding: `${px(8)} ${px(20)}`, borderRadius: "999px", backgroundColor: RENK.kart, color: RENK.vurgu, fontSize: px(28), fontWeight: 700 }),
        ))
      : null,
    el("div", { gap: px(20), alignItems: "center" }, [
      avatar
        ? { type: "img", props: { src: avatar, style: { width: px(84), height: px(84), borderRadius: "999px", objectFit: "cover" } } }
        : el("div", { width: px(84), height: px(84), borderRadius: "999px", backgroundColor: RENK.vurgu, color: RENK.zemin, fontSize: px(40), fontWeight: 700, alignItems: "center", justifyContent: "center" }, temiz(g.davetEden.ad).slice(0, 1).toLocaleUpperCase("tr")),
      el("div", { flexDirection: "column", gap: px(6), flex: 1 }, [
        yazi(`${g.davetEden.ad} seni davet ediyor`, { fontSize: px(32), fontWeight: 700, color: RENK.metin, lineClamp: 1 }),
        g.not && temiz(g.not) ? yazi(`“${temiz(g.not)}”`, { fontSize: px(28), color: RENK.soluk, lineClamp: 2 }) : null,
      ].filter(Boolean)),
    ]),
  ].filter(Boolean);

  const qrBoy = og ? 220 : g.format === "kare" ? 260 : 440;
  const qrKutu = el("div", { flexDirection: "column", alignItems: "center", gap: px(16) }, [
    { type: "img", props: { src: qr, style: { width: `${qrBoy}px`, height: `${qrBoy}px`, borderRadius: px(24), backgroundColor: "#ffffff" } } },
    yazi(g.kisaLink, { fontSize: og ? "26px" : px(40), fontWeight: 700, color: RENK.vurgu, letterSpacing: "1px" }),
    yazi("Tara, hemen katıl", { fontSize: og ? "22px" : px(30), color: RENK.soluk }),
  ]);

  const kok = {
    width: `${w}px`,
    height: `${h}px`,
    padding: px(og ? 56 : 72),
    gap: px(og ? 40 : 36),
    backgroundColor: RENK.zemin,
    backgroundImage: "radial-gradient(circle at 90% -10%, #1a7d8655, transparent 60%)",
    color: RENK.metin,
    fontFamily: "Inter",
  };
  // og: kapak solda, metin ortada, QR sağda küçük; story/kare: tek sütun, QR en altta
  const agac = og
    ? el("div", { ...kok, flexDirection: "row", alignItems: "center" }, [
        kapakKutu,
        el("div", { flexDirection: "column", gap: px(24), flex: 1 }, metinler),
        qrKutu,
      ].filter(Boolean))
    : el("div", { ...kok, flexDirection: "column", justifyContent: "space-between" }, [
        el("div", { flexDirection: "column", gap: px(32) }, [kapakKutu, ...metinler].filter(Boolean)),
        qrKutu,
      ]);

  const svg = await satori(agac as unknown as Parameters<typeof satori>[0], {
    width: w,
    height: h,
    fonts: await ogFontlari(),
  });
  return new Resvg(svg, { fitTo: { mode: "width", value: w } }).render().asPng();
}
