/** POST /api/uye/davet — davet kartı kişisel notu (≤80), kurs ya da etkinlik. Kod yoksa üretir. */
import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { davetKoduUret } from "@/lib/davet.ts";
import { etkinlikBitis, etkinlikGorunurMu, gorevliRol, slugGaranti } from "@/lib/etkinlik.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { R } from "@/lib/routes.ts";
import { guvenliYol } from "@/lib/urls.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });
  const form = await context.request.formData();
  const note = String(form.get("note") ?? "").trim().replace(/\s+/g, " ").slice(0, 80) || null;

  const eventId = Number(form.get("eventId") ?? 0);
  if (eventId) {
    const e = await db.query.events.findFirst({ where: eq(schema.events.id, eventId) });
    const kulup = e?.clubId ? await db.query.clubs.findFirst({ where: eq(schema.clubs.id, e.clubId) }) : null;
    if (!e || !etkinlikGorunurMu(e, kulup) || new Date() > etkinlikBitis(e))
      return new Response("Etkinlik yok ya da sona erdi", { status: 404 });
    // PRD §4.3: kartı yalnız etkinliğe kayıtlı üye ya da düzenleyen üretir (UI'daki kural API'de de)
    const kayitli =
      (await gorevliRol(e, member.id)) === "host" ||
      !!(await db.query.eventRsvps.findFirst({
        where: and(eq(schema.eventRsvps.eventId, e.id), eq(schema.eventRsvps.userId, member.id)),
      }));
    if (!kayitli) return new Response("Önce etkinliğe kaydol", { status: 403 });
    const kod = await davetKoduUret(member.id, e.id, "event");
    await db.update(schema.inviteCodes).set({ note }).where(eq(schema.inviteCodes.id, kod.id));
    return context.redirect(guvenliYol(form, `${R.etkinlik(await slugGaranti(e))}#davet`));
  }

  const courseId = Number(form.get("courseId") ?? 0);
  const kurs = courseId
    ? await db.query.courses.findFirst({ where: eq(schema.courses.id, courseId) })
    : undefined;
  if (!kurs || kurs.status !== "published") return new Response("Kurs yok", { status: 404 });
  // PRD §4.3: kartı yalnız kursa katılmış üye ya da üretici üretir (UI'daki kural API'de de)
  const katilim =
    kurs.createdBy === member.id
      ? true
      : await db.query.courseEnrollments.findFirst({
          where: and(eq(schema.courseEnrollments.userId, member.id), eq(schema.courseEnrollments.courseId, kurs.id)),
        });
  if (!katilim) return new Response("Önce kursa katıl", { status: 403 });
  const kod = await davetKoduUret(member.id, kurs.id);
  await db.update(schema.inviteCodes).set({ note }).where(eq(schema.inviteCodes.id, kod.id));
  return context.redirect(guvenliYol(form, `${R.kurs(kurs.slug)}#davet`));
};
