/** POST /api/uye/davet — davet kartı kişisel notu (≤80). Kod yoksa üretir. */
import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { davetKoduUret } from "@/lib/davet.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { R } from "@/lib/routes.ts";
import { guvenliYol } from "@/lib/urls.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });
  const form = await context.request.formData();
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
  const note = String(form.get("note") ?? "").trim().replace(/\s+/g, " ").slice(0, 80) || null;
  await db.update(schema.inviteCodes).set({ note }).where(eq(schema.inviteCodes.id, kod.id));
  return context.redirect(guvenliYol(form, `${R.kurs(kurs.slug)}#davet`));
};
