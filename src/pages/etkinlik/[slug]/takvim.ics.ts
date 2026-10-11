/** GET /etkinlik/[slug]/takvim.ics — takvime ekle (RFC 5545). Görünürlük etkinlik sayfasıyla aynı. */
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { etkinlikBul, etkinlikGorunurMu } from "@/lib/etkinlik.ts";
import { icsUret } from "@/lib/etkinlik-kural.ts";
import { R } from "@/lib/routes.ts";
import { siteKok } from "@/lib/urls.ts";

export const prerender = false;

export const GET: APIRoute = async ({ params, site, url }) => {
  const e = await etkinlikBul(params.slug ?? "");
  const kulup = e?.clubId ? await db.query.clubs.findFirst({ where: eq(schema.clubs.id, e.clubId) }) : null;
  if (!e || !e.slug || !etkinlikGorunurMu(e, kulup)) return new Response("Etkinlik bulunamadı", { status: 404 });
  return new Response(icsUret(e, `${siteKok(site, url)}${R.etkinlik(e.slug)}`), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="etkinlik-${e.id}.ics"`,
      "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
};
