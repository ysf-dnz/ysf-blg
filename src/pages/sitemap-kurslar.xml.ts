/**
 * Dinamik SSR sitemap: yayındaki kurslar. @astrojs/sitemap yalnız statik
 * yollu rotaları ekler; [slug] sayfaları buradan (customSitemaps) listelenir.
 */
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { R } from "@/lib/routes.ts";

export const prerender = false;

export const GET: APIRoute = async ({ site, url }) => {
  const kok = (site ?? url).origin;
  const kurslar = await db.query.courses.findMany({
    where: eq(schema.courses.status, "published"),
    columns: { slug: true, createdAt: true },
  });
  const satirlar = kurslar
    .map(
      (k) =>
        `<url><loc>${kok}${R.kurs(k.slug)}</loc><lastmod>${k.createdAt.toISOString().slice(0, 10)}</lastmod></url>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${kok}${R.kurslar}</loc></url>${satirlar}</urlset>`;
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
};
