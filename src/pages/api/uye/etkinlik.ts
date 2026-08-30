/** POST /api/uye/etkinlik — etkinlik aç (rep/admin) ve RSVP (+10 puan). */
import type { APIRoute } from "astro";
import { awardPoints } from "@/lib/rewards.ts";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember, pointBalance } from "@/lib/member.ts";
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
      // Öncelikli koltuk: bakiye yetiyorsa puan düşülür, ⭐ ile listelenir
      let priority = false;
      if (oncelikli) {
        const bakiye = await pointBalance(member.id);
        priority = bakiye >= PUAN.prioritySeatCost;
      }
      const [inserted] = await db
        .insert(schema.eventRsvps)
        .values({ eventId, userId: member.id, priority })
        .onConflictDoNothing()
        .returning();
      if (inserted) {
        await awardPoints({
          userId: member.id,
          delta: PUAN.eventAttended,
          reason: "event_attended",
          refId: String(eventId),
        });
        if (priority) {
          await awardPoints({
            userId: member.id,
            delta: -PUAN.prioritySeatCost,
            reason: "spend_priority",
            refId: String(eventId),
          });
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
