/** POST /api/uye/etkinlik — etkinlik aç (rep/admin) ve RSVP (+10 puan). */
import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { awardPoints, spendPoints } from "@/lib/rewards.ts";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { canManage, clubRoleOf } from "@/lib/permissions.ts";
import { PUAN } from "@/lib/points.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });

  const form = await context.request.formData();
  const action = String(form.get("action") ?? "create");

  if (action === "rsvp") {
    const eventId = Number(form.get("eventId") ?? 0);
    const oncelikli = form.get("priority") === "1";
    if (eventId) {
      // RSVP tekilliği DB'de (event_rsvps unique) — ödül yalnız gerçekten
      // yeni satır yazıldığında verilir.
      const [inserted] = await db
        .insert(schema.eventRsvps)
        .values({ eventId, userId: member.id, priority: false })
        .onConflictDoNothing()
        .returning();
      if (inserted) {
        await awardPoints({
          userId: member.id,
          delta: PUAN.eventAttended,
          reason: "event_attended",
          refId: String(eventId),
        });
        // Öncelikli koltuk: ÖNCE atomik kesinti, koltuk ancak kesinti
        // gerçekleştiyse ⭐ olur (eskiden bayat bakiye okumasıyla veriliyordu)
        if (oncelikli) {
          const kesildi = await spendPoints({
            userId: member.id,
            cost: PUAN.prioritySeatCost,
            reason: "spend_priority",
            refId: String(eventId),
          });
          if (kesildi) {
            await db
              .update(schema.eventRsvps)
              .set({ priority: true })
              .where(
                and(
                  eq(schema.eventRsvps.eventId, eventId),
                  eq(schema.eventRsvps.userId, member.id),
                ),
              );
          }
        }
      }
    }
    return context.redirect("/etkinlikler");
  }

  // Oluşturma: kulüp etkinliğinde kulüp yöneticisi, global'de rep/admin
  const clubId = Number(form.get("clubId") ?? 0) || null;
  const yetkili = clubId
    ? canManage(await clubRoleOf(member, clubId))
    : member.role !== "member";
  if (!yetkili) return new Response("Yetkisiz", { status: 403 });
  const title = String(form.get("title") ?? "").trim();
  const startsAt = new Date(String(form.get("startsAt") ?? ""));
  if (!title || isNaN(startsAt.getTime()))
    return new Response("Eksik alan", { status: 400 });
  await db.insert(schema.events).values({
    title,
    startsAt,
    clubId,
    location: String(form.get("location") ?? "") || null,
    description: String(form.get("description") ?? "") || null,
    createdBy: member.id,
  });
  return context.redirect(clubId ? context.request.headers.get("referer") || "/etkinlikler" : "/etkinlikler");
};
