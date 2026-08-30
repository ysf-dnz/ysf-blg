/**
 * POST /api/uye/egitim — eğitim oluştur veya öğe tamamla.
 * YouTube linkinden video ID çıkarılır; kurs "yayında" başlar
 * (kulüpsüzlerde site vitrini admin onayına tabidir → pending).
 */
import type { APIRoute } from "astro";
import { awardPoints } from "@/lib/rewards.ts";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { earnedPoints, getOrCreateMember } from "@/lib/member.ts";
import { levelFor } from "@/lib/levels.ts";

export const prerender = false;

function parseYoutubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  return m?.[1] ?? null;
}

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });

  const form = await context.request.formData();
  const action = String(form.get("action") ?? "create");

  if (action === "complete") {
    const itemId = Number(form.get("itemId") ?? 0);
    const item = await db.query.courseItems.findFirst({
      where: eq(schema.courseItems.id, itemId),
    });
    if (item) {
      const [ins] = await db
        .insert(schema.courseProgress)
        .values({ userId: member.id, courseId: item.courseId, itemId: item.id })
        .onConflictDoNothing()
        .returning();
      if (ins) {
        // Eğitim tamamlandı mı? Bitirene küçük kutlama puanı (öğe başına değil)
        const [total] = await db
          .select({ c: sql<number>`count(*)` })
          .from(schema.courseItems)
          .where(eq(schema.courseItems.courseId, item.courseId));
        const [done] = await db
          .select({ c: sql<number>`count(*)` })
          .from(schema.courseProgress)
          .where(
            and(
              eq(schema.courseProgress.courseId, item.courseId),
              eq(schema.courseProgress.userId, member.id),
            ),
          );
        if (Number(done?.c) === Number(total?.c)) {
          await awardPoints({
            userId: member.id,
            delta: 25,
            reason: "quiz", // ders bitirme ödülü (küçük)
            refId: `course:${item.courseId}`,
          });
          await db.insert(schema.notifications).values({
            userId: member.id,
            kind: "course",
            body: "Bir eğitimi tamamladın 🎓 +25 puan",
            href: `/egitim/${item.courseId}`,
          });
        }
      }
    }
    return context.redirect(`/egitim/${item?.courseId ?? ""}`);
  }

  // create
  const title = String(form.get("title") ?? "").trim();
  if (!title) return new Response("Başlık gerekli", { status: 400 });
  const clubId = Number(form.get("clubId") ?? 0) || null;

  type Item = { kind: "youtube" | "yazi" | "quiz"; title: string; ref: string };
  const items: Item[] = [];
  for (let i = 0; i < 100; i++) {
    const kind = form.get(`i_${i}_kind`);
    if (kind === null) continue;
    items.push({
      kind: String(kind) as Item["kind"],
      title: String(form.get(`i_${i}_title`) ?? "").trim(),
      ref: String(form.get(`i_${i}_url`) ?? form.get(`i_${i}_ref`) ?? "").trim(),
    });
  }
  if (items.length === 0)
    return new Response("En az bir müfredat öğesi ekle", { status: 400 });

  const [course] = await db
    .insert(schema.courses)
    .values({
      clubId,
      bookId: String(form.get("bookId") ?? "") || null,
      title,
      description: String(form.get("description") ?? "") || null,
      // Seviye 7+ güvenilir üretici: onaysız yayın
      status:
        clubId || member.role === "admin" || levelFor(await earnedPoints(member.id)) >= 7
          ? "published"
          : "pending",
      createdBy: member.id,
    })
    .returning();

  let order = 0;
  for (const it of items) {
    if (it.kind === "youtube") {
      const vid = parseYoutubeId(it.ref);
      if (!vid) continue;
      await db.insert(schema.courseItems).values({
        courseId: course!.id,
        order: order++,
        kind: "youtube",
        title: it.title || `Video ${order}`,
        youtubeId: vid,
      });
    } else if (it.kind === "yazi") {
      const post = await db.query.memberPosts.findFirst({
        where: and(
          eq(schema.memberPosts.id, Number(it.ref)),
          eq(schema.memberPosts.status, "published"),
        ),
      });
      if (!post) continue;
      await db.insert(schema.courseItems).values({
        courseId: course!.id,
        order: order++,
        kind: "yazi",
        title: post.title,
        memberPostId: post.id,
      });
    } else if (it.kind === "quiz") {
      const quiz = await db.query.quizzes.findFirst({
        where: eq(schema.quizzes.id, Number(it.ref)),
      });
      if (!quiz) continue;
      await db.insert(schema.courseItems).values({
        courseId: course!.id,
        order: order++,
        kind: "quiz",
        title: quiz.title,
        quizId: quiz.id,
      });
    }
  }

  return context.redirect(`/egitim/${course!.id}`);
};
