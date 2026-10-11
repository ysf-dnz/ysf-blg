/**
 * /d/[kod] ve /d/q/[kod] ortak akışı (PRD §4.3): kodu çöz → ziyareti kaydet
 * (IP/UA hash'li, 30 gün) → IP 60/dk freni → ysf_ref + ysf_davet çerezleri →
 * hedefin (kurs ya da etkinlik) karşılama sayfasına 302 (?d= kodu taşır; bot çerez
 * taşımaz, OG kart buradan bulunur).
 */
import type { AstroGlobal } from "astro";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { davetCereziKur, davetCoz, kisaHash, kodNormalize } from "@/lib/davet.ts";
import { R } from "@/lib/routes.ts";
import { belgeGezintisiMi } from "@/lib/urls.ts";

export const DAKIKADA_ISTEK = 60;

export async function karsila(Astro: AstroGlobal, kanal: "qr" | "link"): Promise<Response> {
  // Yalnız üst düzey gezinme: <img src="/d/KOD"> gibi alt-kaynak istekleri çerezleri EZEMEZ
  // (atıf hırsızlığı) ve ziyaret sayılmaz. Başlığı olmayan eski tarayıcılar geçer.
  if (!belgeGezintisiMi(Astro.request)) return new Response(null, { status: 204 });
  const hedef = await davetCoz(Astro.params.kod ?? "");
  if (!hedef) {
    // Kod tanınıyor ama hedefi geçersizse (biten etkinlik, yayından kalkan kurs) türüne göre liste
    const code = kodNormalize(Astro.params.kod ?? "");
    const kod = code
      ? await db.query.inviteCodes.findFirst({ where: eq(schema.inviteCodes.code, code), columns: { targetType: true } })
      : undefined;
    return Astro.redirect(`${kod?.targetType === "event" ? R.etkinlikler : R.kurslar}?davet=gecersiz`);
  }

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

  // Platform daveti (mevcut akış: kayıtta referral_joined) + hedef daveti (kurs/etkinlik)
  Astro.cookies.set("ysf_ref", hedef.davetEden.handle, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });
  davetCereziKur(Astro.cookies, hedef, import.meta.env.PROD);
  const sayfa = "kurs" in hedef ? R.kurs(hedef.kurs.slug) : R.etkinlik(hedef.etkinlik.slug);
  return Astro.redirect(`${sayfa}?d=${hedef.kod.code}`);
}
