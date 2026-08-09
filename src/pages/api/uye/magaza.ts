/** POST /api/uye/magaza — flair satın alma (50 puan). */
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember, pointBalance } from "@/lib/member.ts";
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
  if ((await pointBalance(member.id)) < PUAN.flairCost)
    return context.redirect("/uye/magaza?durum=yetersiz");

  await db.insert(schema.pointsLedger).values({
    userId: member.id,
    delta: -PUAN.flairCost,
    reason: "spend_flair",
    refId: flair,
  });
  await db
    .update(schema.users)
    .set({ flair })
    .where(eq(schema.users.id, member.id));
  return context.redirect("/uye/magaza?durum=ok");
};
