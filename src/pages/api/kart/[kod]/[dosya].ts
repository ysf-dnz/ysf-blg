/**
 * GET /api/kart/{kod}/{story|kare|og}.png | a6.pdf — davet kartı (PRD §4.3, ADR K3.4).
 * Public: kart zaten paylaşılmak için var; kişisel veri yok (ad + not davet edenin seçimi).
 * CDN'de 1 yıl cache; `?v=` yalnız cache-bust (kartSurumu), burada okunmaz.
 * Kapak/avatar fetch'i kart.ts'te 3 sn ile sınırlı; yine de patlarsa görselsiz kart.
 */
import type { APIRoute } from "astro";
import { eq, sql } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { renderSVG } from "uqr";
import { db, schema } from "@/db/client.ts";
import { getBookMap } from "@/lib/books-lookup.ts";
import { davetHedefi, qrIcerigi } from "@/lib/davet.ts";
import { siteKok } from "@/lib/urls.ts";
import { type KartFormat, type KartGirdi, renderDavetKartiDetay } from "@/features/davet/kart.ts";

export const prerender = false;

const SEVIYE_AD = { baslangic: "Başlangıç", orta: "Orta", ileri: "İleri" } as const;
/** A6 PDF'e story PNG'si gömülür (A6 oranı 0.71, story 0.56 → kareden daha az boşluk) */
const DOSYA: Record<string, KartFormat> = { "story.png": "story", "kare.png": "kare", "og.png": "og", "a6.pdf": "story" };
const A6 = [298, 420] as const;

export const GET: APIRoute = async ({ params, site, url }) => {
  const dosya = params.dosya ?? "";
  // hasOwn: "constructor"/"__proto__" gibi prototip anahtarları format sayılmasın (500 yerine 404)
  const format = Object.hasOwn(DOSYA, dosya) ? DOSYA[dosya] : undefined;
  const hedef = format ? await davetHedefi(params.kod ?? "") : null;
  if (!format || !hedef) return new Response("Kart bulunamadı", { status: 404 });
  const { kod, kurs, davetEden } = hedef;

  const kok = siteKok(site, url);
  const [[{ n }], kitapKapak] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(schema.courseItems).where(eq(schema.courseItems.courseId, kurs.id)),
    kurs.coverUrl || !kurs.bookId ? null : getBookMap().then((m) => m.get(kurs.bookId!)?.cover),
  ]);
  const kapak = kurs.coverUrl ?? kitapKapak;

  const girdi: KartGirdi = {
    format,
    baslik: kurs.title,
    vaat: kurs.summary,
    // ⏱ emoji fontlarda yok (Inter/Fraunces) → düz "N dk"
    meta: [kurs.level && SEVIYE_AD[kurs.level], kurs.estMinutes && `${kurs.estMinutes} dk`, Number(n) > 0 && `${n} öğe`].filter(
      (m): m is string => !!m,
    ),
    davetEden: { ad: davetEden.name, avatarUrl: davetEden.avatarUrl },
    not: kod.note,
    kapakUrl: kapak && URL.canParse(kapak, kok) ? new URL(kapak, kok).toString() : null,
    qrSvg: renderSVG(qrIcerigi(kok, kod.code), { ecc: "M", border: 4 }),
    kisaLink: `${new URL(kok).host}/d/${kod.code.toLowerCase()}`,
  };

  let png: Buffer;
  let eksik = false; // kapak/avatar getirilemedi ya da yedek kart → kısa cache (1 yıl kapaksız kalmasın)
  try {
    ({ png, eksik } = await renderDavetKartiDetay(girdi));
  } catch {
    // Bozuk görsel verisi satori'yi düşürürse 500 yerine görselsiz kart
    ({ png } = await renderDavetKartiDetay({ ...girdi, kapakUrl: null, davetEden: { ad: davetEden.name } }));
    eksik = true;
  }

  let govde: BodyInit = new Uint8Array(png);
  if (format === "story" && params.dosya === "a6.pdf") {
    const pdf = await PDFDocument.create();
    const sayfa = pdf.addPage([...A6]);
    const img = await pdf.embedPng(png);
    const { width, height } = img.scaleToFit(...A6);
    sayfa.drawImage(img, { x: (A6[0] - width) / 2, y: (A6[1] - height) / 2, width, height });
    govde = new Uint8Array(await pdf.save()); // kopya: pdf-lib ArrayBufferLike döner, BodyInit ArrayBuffer ister
  }

  return new Response(govde, {
    headers: {
      "content-type": params.dosya === "a6.pdf" ? "application/pdf" : "image/png",
      // İçerik değişimi ?v= ile; 1 gün CDN (yayından kalkan/iptal edilen kart en çok 1 gün yaşar),
      // görsel eksikse 10 dk (geçici fetch hatası kalıcılaşmasın). Purge yok.
      "cache-control": eksik
        ? "public, s-maxage=600, stale-while-revalidate=600"
        : "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
};
