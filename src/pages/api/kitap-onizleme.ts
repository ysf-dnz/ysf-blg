/**
 * GET /api/kitap-onizleme?bookId=... — misafir teaser: kitabın İLK 10 SAYFASI.
 *
 * Amaç: kilitli/misafir kullanıcı kitabın içeriğini KISMEN görsün (eski
 * gömülü-Drive deneyiminin güvenli hâli). Tam metin yine kilit ardında.
 *
 * Bilinçli olarak PUBLIC (auth yok): teaser zaten herkese gösterilmek için
 * var. Kaynak PDF Drive'dan kimliksiz çekilir, pdf-lib ile ilk N sayfa yeni
 * bir belgeye kopyalanır. Yanıt CDN'de agresif cache'lenir → kitap başına
 * ağır iş yalnız İLK istekte koşar.
 *
 * Statik kitap sayfasına Drive linki SIZDIRMAZ: istemci yalnız bu ucu görür
 * (check-build-output + gate.spec bekçileriyle uyumlu).
 */
import type { APIRoute } from "astro";
import { getEntry } from "astro:content";
import { PDFDocument } from "pdf-lib";

export const prerender = false;

const ONIZLEME_SAYFA = 10;
/** Bellek/süre koruması: kaynak bundan büyükse önizleme üretme (ölçüm: p95≈42MB) */
const MAX_KAYNAK_BAYT = 45 * 1024 * 1024;

export const GET: APIRoute = async (context) => {
  const bookId = context.url.searchParams.get("bookId") ?? "";
  if (!/^[\w-]{10,}$/.test(bookId))
    return new Response("Geçersiz kitap", { status: 400 });

  const kitap = await getEntry("books", bookId);
  if (!kitap || kitap.data.format !== "pdf")
    return new Response("Bu kitap için önizleme yok", { status: 404 });

  const kaynak = await fetch(
    `https://drive.usercontent.google.com/download?id=${bookId}&export=download`,
  ).catch(() => null);
  if (!kaynak?.ok) return new Response("Kaynağa ulaşılamadı", { status: 502 });

  const boyut = Number(kaynak.headers.get("content-length") ?? 0);
  if (boyut > MAX_KAYNAK_BAYT) {
    kaynak.body?.cancel();
    return new Response("Bu kitap için önizleme sunulamıyor", { status: 404 });
  }

  try {
    const ham = await kaynak.arrayBuffer();
    const tam = await PDFDocument.load(ham, { ignoreEncryption: true });
    const on = await PDFDocument.create();
    const adet = Math.min(ONIZLEME_SAYFA, tam.getPageCount());
    const sayfalar = await on.copyPages(
      tam,
      Array.from({ length: adet }, (_, i) => i),
    );
    for (const s of sayfalar) on.addPage(s);
    const cikti = await on.save();

    return new Response(new Uint8Array(cikti), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'inline; filename="onizleme.pdf"',
        // Kitap içeriği değişmez → CDN'de 1 yıl; üretim maliyeti tek seferlik
        "cache-control": "public, s-maxage=31536000, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Önizleme üretilemedi", { status: 500 });
  }
};
