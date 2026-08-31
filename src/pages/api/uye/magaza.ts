/** POST /api/uye/magaza — flair satın alma (50 puan). */
import type { APIRoute } from "astro";
import { spendPoints } from "@/lib/rewards.ts";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { PUAN } from "@/lib/points.ts";

export const prerender = false;

export const FLAIRLER = ["🔥", "📚", "🚀", "🧠", "🌟", "🦉"] as const;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });

  const form = await context.request.formData();
  const flair = String(form.get("flair") ?? "");
  if (!FLAIRLER.includes(flair as never))
    return new Response("Geçersiz flair", { status: 400 });

  if (member.flair === flair) return context.redirect("/uye/magaza");

  // Daha önce satın alınmış bir süsü tekrar takmak bedavadır.
  const sahip = await db.query.pointsLedger.findFirst({
    where: and(
      eq(schema.pointsLedger.userId, member.id),
      eq(schema.pointsLedger.reason, "spend_flair"),
      eq(schema.pointsLedger.refId, flair),
    ),
  });
  if (!sahip) {
    // Atomik harcama: bakiye koşulu INSERT içinde (yarışta çift kesinti yok)
    const kesildi = await spendPoints({
      userId: member.id,
      cost: PUAN.flairCost,
      reason: "spend_flair",
      refId: flair,
    });
    if (!kesildi) return context.redirect("/uye/magaza?durum=yetersiz");
  }

  await db
    .update(schema.users)
    .set({ flair })
    .where(eq(schema.users.id, member.id));
  return context.redirect("/uye/magaza?durum=ok");
};
