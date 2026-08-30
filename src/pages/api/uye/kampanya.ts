/** POST /api/uye/kampanya — kampanya aç (kulüp yöneticisi veya rep/admin). */
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { canManage, canManageGlobal, clubRoleOf } from "@/lib/permissions.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });

  const form = await context.request.formData();

  // Kampanyayı kapat: yönetici (kulüp) veya sahip/rep (site-geneli)
  if (String(form.get("action") ?? "") === "close") {
    const id = Number(form.get("campaignId") ?? 0);
    const campaign = await db.query.campaigns.findFirst({
      where: eq(schema.campaigns.id, id),
    });
    if (!campaign) return new Response("Kampanya yok", { status: 404 });
    const yonetici = campaign.clubId
      ? canManage(await clubRoleOf(member, campaign.clubId))
      : canManageGlobal(member) || member.id === campaign.ownerId;
    if (!yonetici) return new Response("Yetkisiz", { status: 403 });
    await db
      .update(schema.campaigns)
      .set({ status: "done", endsAt: new Date() })
      .where(eq(schema.campaigns.id, id));
    return context.redirect(`/kampanya/${id}`);
  }

  const clubId = Number(form.get("clubId") ?? 0) || null;
  const title = String(form.get("title") ?? "").trim();
  const bookId = String(form.get("bookId") ?? "");
  if (!title || !bookId) return new Response("Eksik alan", { status: 400 });

  const yetkili = clubId
    ? canManage(await clubRoleOf(member, clubId))
    : canManageGlobal(member);
  if (!yetkili) return new Response("Yetkisiz", { status: 403 });

  const [c] = await db
    .insert(schema.campaigns)
    .values({ clubId, bookId, title, ownerId: member.id, status: "active" })
    .returning();
  return context.redirect(`/kampanya/${c!.id}`);
};
