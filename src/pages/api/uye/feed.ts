/**
 * POST /api/uye/feed — kısa gönderi, yorum ve beğeni.
 * Skool kuralı: beğeni alan +1 puan; beğeni kalıcı (geri alınamaz),
 * kendi gönderini beğenemezsin, gönderi başına 1 beğeni (unique index).
 */
import type { APIRoute } from "astro";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { PUAN } from "@/lib/points.ts";
import { likePuaniVerilirMi } from "@/lib/economy.ts";

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
    const feedPostId = Number(form.get("feedPostId") ?? 0);
    const body = String(form.get("body") ?? "").trim();
    if (feedPostId && body && body.length <= 1000) {
      await db.insert(schema.comments).values({
        userId: member.id,
        feedPostId,
        body,
      });
    }
  }

  if (action === "like") {
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
        const bugun = new Date();
        bugun.setHours(0, 0, 0, 0);
        const [sayi] = await db
          .select({ c: sql<number>`count(*)` })
          .from(schema.likes)
          .innerJoin(
            schema.feedPosts,
            eq(schema.likes.feedPostId, schema.feedPosts.id),
          )
          .where(
            and(
              eq(schema.likes.userId, member.id),
              eq(schema.feedPosts.userId, post.userId),
              gte(schema.likes.createdAt, bugun),
            ),
          );
        // inserted dahil sayıldı → daha önceki puanlı sayı = c - 1
        if (likePuaniVerilirMi(Number(sayi?.c ?? 1) - 1)) {
          await db.insert(schema.pointsLedger).values({
            userId: post.userId,
            delta: PUAN.likeReceived,
            reason: "like_received",
            refId: String(feedPostId),
          });
        }
      }
    }
  }

  return context.redirect("/topluluk");
};
