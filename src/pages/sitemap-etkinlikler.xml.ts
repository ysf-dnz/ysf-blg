/**
 * Dinamik SSR sitemap: herkese açık etkinlikler (onaylı topluluğun ya da site geneli).
 * @astrojs/sitemap yalnız statik yollu rotaları ekler; [slug] sayfaları buradan listelenir.
 */
import type { APIRoute } from "astro";
import { eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { etkinlikGorunurMu } from "@/lib/etkinlik.ts";
import { R } from "@/lib/routes.ts";

export const prerender = false;

export const GET: APIRoute = async ({ site, url }) => {
  const kok = (site ?? url).origin;
  const [etkinlikler, kulupler] = await Promise.all([
    db.query.events.findMany({
      where: isNotNull(schema.events.slug),
      columns: { slug: true, clubId: true },
    }),
    db.query.clubs.findMany({ where: eq(schema.clubs.status, "approved"), columns: { id: true, status: true } }),
  ]);
  const onayli = new Map(kulupler.map((k) => [k.id, k]));
  const satirlar = etkinlikler
    .filter((e) => etkinlikGorunurMu(e, e.clubId ? onayli.get(e.clubId) : null))
    .map((e) => `<url><loc>${kok}${R.etkinlik(e.slug!)}</loc></url>`)
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${kok}${R.etkinlikler}</loc></url>${satirlar}</urlset>`;
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
};
