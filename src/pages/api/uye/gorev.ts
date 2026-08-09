/** POST /api/uye/gorev — Kanban görev akışı: create/claim/submit/approve/reopen. */
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { canManage, canManageGlobal, clubRoleOf } from "@/lib/permissions.ts";
import { PUAN } from "@/lib/points.ts";
import { gorevOdulKirp } from "@/lib/economy.ts";
import { gte, inArray, sql, and as andOp } from "drizzle-orm";

export const prerender = false;

/** Kulübün (veya site-geneli null kulübün) son 7 günde dağıttığı görev puanı */
export async function haftalikGorevHarcamasi(
  clubId: number | null,
): Promise<number> {
  const kampanyalar = await db.query.campaigns.findMany({
    where: clubId
      ? eq(schema.campaigns.clubId, clubId)
      : sql`${schema.campaigns.clubId} is null`,
  });
  if (kampanyalar.length === 0) return 0;
  const gorevler = await db.query.campaignTasks.findMany({
    where: inArray(
      schema.campaignTasks.campaignId,
      kampanyalar.map((c) => c.id),
    ),
  });
  if (gorevler.length === 0) return 0;
  const [row] = await db
    .select({ t: sql<number>`coalesce(sum(${schema.pointsLedger.delta}), 0)` })
    .from(schema.pointsLedger)
    .where(
      andOp(
        eq(schema.pointsLedger.reason, "task_done"),
        inArray(
          schema.pointsLedger.refId,
          gorevler.map((g) => String(g.id)),
        ),
        gte(schema.pointsLedger.createdAt, new Date(Date.now() - 7 * 864e5)),
      ),
    );
  return Number(row?.t ?? 0);
}

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });

  const form = await context.request.formData();
  const action = String(form.get("action") ?? "");

  if (action === "create") {
    const campaignId = Number(form.get("campaignId") ?? 0);
    const campaign = await db.query.campaigns.findFirst({
      where: eq(schema.campaigns.id, campaignId),
    });
    if (!campaign) return new Response("Kampanya yok", { status: 404 });
    const yonetici = campaign.clubId
      ? canManage(await clubRoleOf(member, campaign.clubId))
      : canManageGlobal(member) || member.id === campaign.ownerId;
    if (!yonetici) return new Response("Yetkisiz", { status: 403 });

    const title = String(form.get("title") ?? "").trim();
    if (!title) return new Response("Başlık gerekli", { status: 400 });
    await db.insert(schema.campaignTasks).values({
      campaignId,
      title,
      kind: String(form.get("kind") ?? "yazi") as never,
      rewardPoints: Math.min(Math.max(Number(form.get("rewardPoints") ?? PUAN.taskDefault), 10), 500),
    });
    return context.redirect(`/kampanya/${campaignId}`);
  }

  const taskId = Number(form.get("taskId") ?? 0);
  const task = await db.query.campaignTasks.findFirst({
    where: eq(schema.campaignTasks.id, taskId),
  });
  if (!task) return new Response("Görev yok", { status: 404 });
  const campaign = (await db.query.campaigns.findFirst({
    where: eq(schema.campaigns.id, task.campaignId),
  }))!;
  const yonetici = campaign.clubId
    ? canManage(await clubRoleOf(member, campaign.clubId))
    : canManageGlobal(member) || member.id === campaign.ownerId;
  const geri = () => context.redirect(`/kampanya/${task.campaignId}`);

  if (action === "claim" && task.status === "backlog") {
    await db
      .update(schema.campaignTasks)
      .set({ status: "claimed", assigneeId: member.id, claimedAt: new Date() })
      .where(eq(schema.campaignTasks.id, task.id));
  }

  if (action === "submit" && task.status === "claimed" && task.assigneeId === member.id) {
    const url = String(form.get("url") ?? "").trim();
    if (!/^https?:\/\//.test(url)) return new Response("Geçersiz link", { status: 400 });
    await db
      .update(schema.campaignTasks)
      .set({ status: "review", submissionUrl: url })
      .where(eq(schema.campaignTasks.id, task.id));
  }

  if (action === "approve" && task.status === "review" && yonetici && task.assigneeId) {
    await db
      .update(schema.campaignTasks)
      .set({ status: "done" })
      .where(eq(schema.campaignTasks.id, task.id));
    // Kampanya çarpanı: gündem kitabıyla ilgili üretim ×1.5
    const istenen = Math.round(task.rewardPoints * PUAN.campaignMultiplier);
    // Haftalık kulüp bütçesi: bu kulübün kampanyalarında son 7 günde
    // dağıtılan task_done toplamına göre ödül otomatik kırpılır.
    const buHafta = await haftalikGorevHarcamasi(campaign.clubId);
    const { verilecek, kirpildi } = gorevOdulKirp(istenen, buHafta);
    if (verilecek > 0) {
      await db.insert(schema.pointsLedger).values({
        userId: task.assigneeId,
        delta: verilecek,
        reason: "task_done",
        refId: String(task.id),
      });
    }
    await db.insert(schema.notifications).values({
      userId: task.assigneeId,
      kind: "task",
      body: kirpildi
        ? `"${task.title}" onaylandı ✅ +${verilecek} puan (kulübün haftalık ödül bütçesi dolduğu için kırpıldı; hafta başında yenilenir)`
        : `"${task.title}" görevi onaylandı ✅ +${verilecek} puan`,
      href: `/kampanya/${task.campaignId}`,
    });
  }

  if (action === "reopen" && task.status === "review" && yonetici) {
    await db
      .update(schema.campaignTasks)
      .set({ status: "claimed" })
      .where(eq(schema.campaignTasks.id, task.id));
    if (task.assigneeId) {
      await db.insert(schema.notifications).values({
        userId: task.assigneeId,
        kind: "task",
        body: `"${task.title}" görevi düzenleme için geri gönderildi.`,
        href: `/kampanya/${task.campaignId}`,
      });
    }
  }

  return geri();
};
