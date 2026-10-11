/**
 * GET /api/uye/etkinlik-qr?e={eventId} — dönen QR'ın O ANKİ penceresi, SVG olarak (F3-05).
 * Yalnız etkinliğin görevlisi (host/scanner/admin): imza sırrı sunucuda kalır, ekran sayfası
 * bu görseli 30 sn'de bir yeniler. Önbelleklenmez.
 */
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { renderSVG } from "uqr";
import { db, schema } from "@/db/client.ts";
import { okutabilirMi } from "@/lib/etkinlik.ts";
import { donenPencere, donenQrIcerigi, donenToken } from "@/lib/etkinlik-kural.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { siteKok } from "@/lib/urls.ts";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  const eventId = Number(context.url.searchParams.get("e")) || 0;
  const e = eventId ? await db.query.events.findFirst({ where: eq(schema.events.id, eventId) }) : undefined;
  if (!e || !(await okutabilirMi(e, member))) return new Response("Bulunamadı", { status: 404 });
  const icerik = donenQrIcerigi(siteKok(context.site, context.url), e.id, donenToken(e.id, donenPencere()));
  return new Response(renderSVG(icerik, { ecc: "M", border: 3 }), {
    headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "no-store" },
  });
};
