/** POST /api/uye/admin — yazı/başvuru onay-red (yalnızca admin). */
import type { APIRoute } from "astro";
import { awardPoints, awardBadge, sayacRozetleri } from "@/lib/rewards.ts";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { activateReferralIfFirstPost, getOrCreateMember } from "@/lib/member.ts";
import { PUAN } from "@/lib/points.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member || member.role !== "admin")
    return new Response("Yetkisiz", { status: 403 });

  const form = await context.request.formData();
  const action = String(form.get("action") ?? "");
  const postId = Number(form.get("postId") ?? 0);
  const appId = Number(form.get("appId") ?? 0);

  if ((action === "approve" || action === "reject") && postId) {
    const post = await db.query.memberPosts.findFirst({
      where: eq(schema.memberPosts.id, postId),
    });
    if (post && post.status === "pending") {
      if (action === "approve") {
        await db
          .update(schema.memberPosts)
          .set({ status: "published", publishedAt: new Date() })
          .where(eq(schema.memberPosts.id, post.id));
        await awardPoints({
          userId: post.userId,
          delta: PUAN.postApproved,
          reason: "post_approved",
          refId: String(post.id),
        });
        await db.insert(schema.notifications).values({
          userId: post.userId,
          kind: "post",
          body: `"${post.title}" yayınlandı 🎉 +${PUAN.postApproved} puan`,
          href: `/topluluk/${post.slug}`,
        });
        await activateReferralIfFirstPost(post.userId);
        await awardBadge(post.userId, "ilk-yazi", "İlk yazın yayında ✍️ Rozetin hazır!");
      } else {
        await db
          .update(schema.memberPosts)
          .set({ status: "rejected" })
          .where(eq(schema.memberPosts.id, post.id));
        await db.insert(schema.notifications).values({
          userId: post.userId,
          kind: "post",
          body: `"${post.title}" için düzenleme gerekiyor — tekrar gönderebilirsin.`,
          href: "/uye/yaz",
        });
      }
    }
  }

  const clubId = Number(form.get("clubId") ?? 0);
  if ((action === "club_approve" || action === "club_reject") && clubId) {
    const club = await db.query.clubs.findFirst({
      where: eq(schema.clubs.id, clubId),
    });
    if (club && club.status === "pending") {
      const approved = action === "club_approve";
      await db
        .update(schema.clubs)
        .set({ status: approved ? "approved" : "archived" })
        .where(eq(schema.clubs.id, club.id));
      if (approved) {
        await db
          .update(schema.users)
          .set({ role: "rep" })
          .where(eq(schema.users.id, club.presidentId));
        await db.insert(schema.notifications).values({
          userId: club.presidentId,
          kind: "club",
          body: `"${club.name}" kulübün onaylandı 🏛️ Panon hazır — ilk kampanyanı aç!`,
          href: `/kulup/${club.slug}`,
        });
        await awardBadge(club.presidentId, "kulup-kurucu", `"${club.name}" ile Kulüp Kurucu rozetini kazandın 🏛️`);
      }
    }
  }

  const quizId = Number(form.get("quizId") ?? 0);
  if ((action === "quiz_approve" || action === "quiz_reject") && quizId) {
    const quiz = await db.query.quizzes.findFirst({
      where: eq(schema.quizzes.id, quizId),
    });
    if (quiz && quiz.status === "pending") {
      const approved = action === "quiz_approve";
      await db
        .update(schema.quizzes)
        .set({ status: approved ? "published" : "rejected" })
        .where(eq(schema.quizzes.id, quiz.id));
      if (approved && quiz.createdBy) {
        await awardPoints({
          userId: quiz.createdBy,
          delta: PUAN.quizSetApproved,
          reason: "quiz_set_approved",
          refId: String(quiz.id),
        });
        await db.insert(schema.notifications).values({
          userId: quiz.createdBy,
          kind: "quiz",
          body: `"${quiz.title}" quiz'in yayınlandı 🧠 +${PUAN.quizSetApproved} puan — kitap ödülün için admin'le iletişime geç.`,
          href: `/kitap/${quiz.bookId}/quiz`,
        });
        await sayacRozetleri(quiz.createdBy, "quiz_set_approved");
      }
    }
  }

  if ((action === "app_approve" || action === "app_reject") && appId) {
    const app = await db.query.applications.findFirst({
      where: eq(schema.applications.id, appId),
    });
    if (app && app.status === "pending") {
      const approved = action === "app_approve";
      await db
        .update(schema.applications)
        .set({ status: approved ? "approved" : "rejected" })
        .where(eq(schema.applications.id, app.id));
      if (approved) {
        await db
          .update(schema.users)
          .set({ role: "rep" })
          .where(eq(schema.users.id, app.userId));
        await db.insert(schema.notifications).values({
          userId: app.userId,
          kind: "rep",
          body: `${app.place} temsilciliğin onaylandı 🏛️ Davetlerin artık ×1.5 puan!`,
        });
      }
    }
  }

  return context.redirect("/uye/admin");
};
