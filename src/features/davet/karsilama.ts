/**
 * /d/[kod] ve /d/q/[kod] ortak akışı (PRD §4.3): kodu çöz → ziyareti kaydet
 * (IP/UA hash'li, 30 gün) → IP 60/dk freni → ysf_ref + ysf_davet çerezleri →
 * kursun karşılama sayfasına 302 (?d= kodu taşır; bot çerez taşımaz, OG kart
 * buradan bulunur).
 */
import type { AstroGlobal } from "astro";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { davetCereziKur, davetHedefi, kisaHash } from "@/lib/davet.ts";
import { R } from "@/lib/routes.ts";

export const DAKIKADA_ISTEK = 60;

export async function karsila(Astro: AstroGlobal, kanal: "qr" | "link"): Promise<Response> {
  const hedef = await davetHedefi(Astro.params.kod ?? "");
  if (!hedef) return Astro.redirect(`${R.kurslar}?davet=gecersiz`);

  let ip = "0.0.0.0";
  try {
    ip = Astro.clientAddress;
  } catch {
    /* statik önizleme/dev: adres yok */
  }
  const ipHash = kisaHash(ip);
  const [son] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.inviteVisits)
    .where(
      and(
        eq(schema.inviteVisits.ipHash, ipHash),
        gte(schema.inviteVisits.createdAt, new Date(Date.now() - 60_000)),
      ),
    );
  if (Number(son?.n ?? 0) >= DAKIKADA_ISTEK)
    return new Response("Çok hızlı — bir dakika sonra tekrar dene.", { status: 429 });

  await db.insert(schema.inviteVisits).values({
    inviteCodeId: hedef.kod.id,
    ipHash,
    uaHash: kisaHash(Astro.request.headers.get("user-agent") ?? ""),
    kanal,
  });

  // Platform daveti (mevcut akış: kayıtta referral_joined) + kurs daveti
  Astro.cookies.set("ysf_ref", hedef.davetEden.handle, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });
  davetCereziKur(Astro.cookies, hedef, import.meta.env.PROD);
  return Astro.redirect(`${R.kurs(hedef.kurs.slug)}?d=${hedef.kod.code}`);
}
