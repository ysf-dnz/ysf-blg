/**
 * POST /api/uye/feed — kısa gönderi, yorum ve beğeni.
 * Skool kuralı: beğeni alan +1 puan; beğeni kalıcı (geri alınamaz),
 * kendi gönderini beğenemezsin, gönderi başına 1 beğeni (unique index).
 */
import type { APIRoute } from "astro";
import { begeniPuaniVer } from "@/lib/rewards.ts";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { R } from "@/lib/routes.ts";

/** Yalnız yoldan ibaret güvenli geri dönüş (open redirect yok) */
function geriDon(form: FormData, varsayilan: string): string {
  const n = String(form.get("next") ?? "");
  return n.startsWith("/") && !n.startsWith("//") ? n : varsayilan;
}

/** Basit hız sınırı: aynı üyeden son 30 sn'de gönderi/yorum varsa reddet. */
async function sonSaniyelerdeVarMi(userId: number): Promise<boolean> {
  const esik = new Date(Date.now() - 30_000);
  const [p] = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.feedPosts)
    .where(and(eq(schema.feedPosts.userId, userId), gte(schema.feedPosts.createdAt, esik)));
  if (Number(p?.c) > 0) return true;
  const [c] = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.comments)
    .where(and(eq(schema.comments.userId, userId), gte(schema.comments.createdAt, esik)));
  return Number(c?.c) > 0;
}

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });

  const form = await context.request.formData();
  const action = String(form.get("action") ?? "");

  if (action === "post" || action === "comment") {
    if (await sonSaniyelerdeVarMi(member.id)) {
      return new Response("Çok hızlısın — 30 saniye sonra tekrar dene.", {
        status: 429,
      });
    }
  }

  if (action === "post") {
    const body = String(form.get("body") ?? "").trim();
    const category = String(form.get("category") ?? "ilerleme") as
      | "soru"
      | "kaynak"
      | "ilerleme"
      | "duyuru";
    const bookId = String(form.get("bookId") ?? "") || null;
    if (body && body.length <= 2000) {
      await db.insert(schema.feedPosts).values({
        userId: member.id,
        body,
        category,
        bookId,
      });
    }
  }

  if (action === "comment") {
    const feedPostId = Number(form.get("feedPostId") ?? 0) || null;
    // Kurs öğesi altı soru-cevap (F1-07): aynı tablo, aynı hız sınırı, 3. hedef
    const courseItemId = Number(form.get("courseItemId") ?? 0) || null;
    const body = String(form.get("body") ?? "").trim();
    if (courseItemId && body && body.length <= 1000) {
      const [yorum] = await db
        .insert(schema.comments)
        .values({ userId: member.id, courseItemId, body })
        .returning();
      const oge = await db.query.courseItems.findFirst({
        where: eq(schema.courseItems.id, courseItemId),
      });
      const kurs = oge
        ? await db.query.courses.findFirst({ where: eq(schema.courses.id, oge.courseId) })
        : null;
      if (yorum && kurs && kurs.createdBy !== member.id) {
        await db.insert(schema.notifications).values({
          userId: kurs.createdBy,
          kind: "comment",
          body: `${member.name} kursunda soru-cevap yazdı 💬 "${body.slice(0, 60)}${body.length > 60 ? "…" : ""}"`,
          href: R.kurs(kurs.slug),
        });
      }
    } else if (feedPostId && body && body.length <= 1000) {
      await db.insert(schema.comments).values({
        userId: member.id,
        feedPostId,
        body,
      });
      // Gönderi sahibine haber ver: yorum bildirim üretmiyordu, bu yüzden
      // kimse yanıtından haberdar olmuyor ve konuşma ölüyordu.
      const gonderi = await db.query.feedPosts.findFirst({
        where: eq(schema.feedPosts.id, feedPostId),
      });
      if (gonderi && gonderi.userId !== member.id) {
        await db.insert(schema.notifications).values({
          userId: gonderi.userId,
          kind: "comment",
          body: `${member.name} gönderine yorum yaptı 💬 "${body.slice(0, 60)}${body.length > 60 ? "…" : ""}"`,
          href: "/topluluk",
        });
      }
    }
  }

  if (action === "like" && Number(form.get("commentId") ?? 0)) {
    // Kurs cevabına beğeni: aynı günlük fren, refId yorum:{id} (feed id'leriyle karışmaz)
    const commentId = Number(form.get("commentId"));
    const yorum = await db.query.comments.findFirst({
      where: eq(schema.comments.id, commentId),
    });
    if (yorum && yorum.userId !== member.id && !yorum.hiddenAt) {
      const [inserted] = await db
        .insert(schema.likes)
        .values({ userId: member.id, commentId })
        .onConflictDoNothing()
        .returning();
      if (inserted)
        await begeniPuaniVer({
          begenenId: member.id,
          yazarId: yorum.userId,
          refId: `yorum:${commentId}`,
        });
    }
  } else if (action === "like") {
    const feedPostId = Number(form.get("feedPostId") ?? 0);
    const post = await db.query.feedPosts.findFirst({
      where: eq(schema.feedPosts.id, feedPostId),
    });
    if (post && post.userId !== member.id) {
      const [inserted] = await db
        .insert(schema.likes)
        .values({ userId: member.id, feedPostId })
        .onConflictDoNothing()
        .returning();
      if (inserted) {
        // Çiftlik freni: aynı beğenenden aynı yazara bugün ≥5 beğeni
        // varsa beğeni KALIR ama puan üretmez (sessiz koruma).
        // Sayaç feed + üye yazısı beğenilerini BİRLİKTE sayar (ortak kapı).
        await begeniPuaniVer({
          begenenId: member.id,
          yazarId: post.userId,
          refId: String(feedPostId),
        });
      }
    }
  }

  return context.redirect(geriDon(form, "/topluluk"));
};
