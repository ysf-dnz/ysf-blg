/** POST /api/uye/gorev — Kanban görev akışı: create/claim/submit/approve/reopen. */
import type { APIRoute } from "astro";
import { awardPoints, sayacRozetleri } from "@/lib/rewards.ts";
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
    const dueAtRaw = String(form.get("dueAt") ?? "");
    const dueAt = dueAtRaw ? new Date(`${dueAtRaw}T23:59:59`) : null;
    // Grup hedefi: yalnız kampanyanın kulübüne ait bir grup olabilir
    let groupId = Number(form.get("groupId") ?? 0) || null;
    if (groupId && campaign.clubId) {
      const grup = await db.query.clubGroups.findFirst({
        where: andOp(
          eq(schema.clubGroups.id, groupId),
          eq(schema.clubGroups.clubId, campaign.clubId),
        ),
      });
      if (!grup) groupId = null;
    } else {
      groupId = null;
    }
    await db.insert(schema.campaignTasks).values({
      campaignId,
      title,
      kind: String(form.get("kind") ?? "yazi") as never,
      rewardPoints: Math.min(Math.max(Number(form.get("rewardPoints") ?? PUAN.taskDefault), 10), 500),
      dueAt: dueAt && !isNaN(dueAt.getTime()) ? dueAt : null,
      groupId,
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
    // Kulüp kampanyasının görevini yalnız o kulübün üyesi üstlenebilir
    if (campaign.clubId && !(await clubRoleOf(member, campaign.clubId))) {
      const club = await db.query.clubs.findFirst({
        where: eq(schema.clubs.id, campaign.clubId),
      });
      return context.redirect(`/kulup/${club?.slug ?? ""}?katil=1`);
    }
    if (campaign.status === "done")
      return new Response("Kampanya kapandı", { status: 400 });
    // Grup hedefli görev: ilk 48 saat yalnız o grubun üyelerine açık
    if (task.groupId && campaign.clubId) {
      const uyelik = await db.query.clubMembers.findFirst({
        where: andOp(
          eq(schema.clubMembers.clubId, campaign.clubId),
          eq(schema.clubMembers.userId, member.id),
        ),
      });
      const grupDisi = uyelik?.groupId !== task.groupId;
      const taze = task.createdAt.getTime() > Date.now() - 48 * 36e5;
      if (grupDisi && taze)
        return context.redirect(`/kampanya/${task.campaignId}?grup=1`);
    }
    // Hoarding önleme: aynı anda en fazla 2 üstlenilmiş görev
    const [aktif] = await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.campaignTasks)
      .where(
        andOp(
          eq(schema.campaignTasks.assigneeId, member.id),
          eq(schema.campaignTasks.status, "claimed"),
        ),
      );
    if (Number(aktif?.n ?? 0) >= 2)
      return context.redirect(`/kampanya/${task.campaignId}?limit=1`);
    // Atomik claim: WHERE status='backlog' — yarışta ikinci istek boş döner
    const kapildi = await db
      .update(schema.campaignTasks)
      .set({ status: "claimed", assigneeId: member.id, claimedAt: new Date() })
      .where(
        andOp(
          eq(schema.campaignTasks.id, task.id),
          eq(schema.campaignTasks.status, "backlog"),
        ),
      )
      .returning({ id: schema.campaignTasks.id });
    if (kapildi.length === 0)
      return context.redirect(`/kampanya/${task.campaignId}?kapildi=1`);
    // Yöneticiye haber ver (kampanya sahibi)
    if (campaign.ownerId !== member.id) {
      await db.insert(schema.notifications).values({
        userId: campaign.ownerId,
        kind: "task",
        body: `@${member.handle} "${task.title}" görevini üstlendi 🔨`,
        href: `/kampanya/${task.campaignId}`,
      });
    }
  }

  // Yönetici backlog'daki görevi doğrudan bir kulüp üyesine atar
  if (action === "assign" && task.status === "backlog" && yonetici) {
    const assigneeId = Number(form.get("assigneeId") ?? 0);
    const hedef = await db.query.users.findFirst({
      where: eq(schema.users.id, assigneeId),
    });
    const uygun =
      hedef &&
      (!campaign.clubId || (await clubRoleOf(hedef, campaign.clubId)) !== null);
    if (uygun) {
      await db
        .update(schema.campaignTasks)
        .set({ status: "claimed", assigneeId, claimedAt: new Date() })
        .where(
          andOp(
            eq(schema.campaignTasks.id, task.id),
            eq(schema.campaignTasks.status, "backlog"),
          ),
        );
      await db.insert(schema.notifications).values({
        userId: assigneeId,
        kind: "task",
        body: `"${task.title}" görevi sana atandı 🎯 (+${task.rewardPoints}p taban ödül)`,
        href: `/kampanya/${task.campaignId}`,
      });
    }
  }

  if (action === "submit" && task.status === "claimed" && task.assigneeId === member.id) {
    const url = String(form.get("url") ?? "").trim();
    if (!/^https?:\/\//.test(url)) return new Response("Geçersiz link", { status: 400 });
    await db
      .update(schema.campaignTasks)
      .set({ status: "review", submissionUrl: url })
      .where(eq(schema.campaignTasks.id, task.id));
    if (campaign.ownerId !== member.id) {
      await db.insert(schema.notifications).values({
        userId: campaign.ownerId,
        kind: "task",
        body: `@${member.handle} "${task.title}" görevini teslim etti 🔍 — incelemen bekleniyor`,
        href: `/kampanya/${task.campaignId}`,
      });
    }
  }

  if (action === "approve" && task.status === "review" && yonetici && task.assigneeId) {
    // ATOMİK onay (claim ile aynı desen): status guard WHERE'de. Eskiden
    // update yalnız id ile filtreliydi ve koşul isteğin başında okunan bayat
    // snapshot'a dayanıyordu → çift tık / paralel onay çift ödül yazıyordu.
    const onaylandi = await db
      .update(schema.campaignTasks)
      .set({ status: "done" })
      .where(
        andOp(eq(schema.campaignTasks.id, task.id), eq(schema.campaignTasks.status, "review")),
      )
      .returning({ id: schema.campaignTasks.id });
    if (onaylandi.length === 0) {
      return context.redirect(`/kampanya/${task.campaignId}`);
    }
    // Kampanya çarpanı: gündem kitabıyla ilgili üretim ×1.5
    const istenen = Math.round(task.rewardPoints * PUAN.campaignMultiplier);
    // Haftalık kulüp bütçesi: bu kulübün kampanyalarında son 7 günde
    // dağıtılan task_done toplamına göre ödül otomatik kırpılır.
    const buHafta = await haftalikGorevHarcamasi(campaign.clubId);
    const { verilecek, kirpildi } = gorevOdulKirp(istenen, buHafta);
    if (verilecek > 0) {
      await awardPoints({
        userId: task.assigneeId,
        delta: verilecek,
        reason: "task_done",
        refId: String(task.id),
      });
      await sayacRozetleri(task.assigneeId, "task_done");
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
