/** POST /api/uye/admin — yazı/başvuru onay-red (yalnızca admin). */
import type { APIRoute } from "astro";
import { awardPoints, awardBadge, revokePoints, sayacRozetleri } from "@/lib/rewards.ts";
import { and, eq, inArray, like, or } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { activateReferralIfFirstPost, getOrCreateMember } from "@/lib/member.ts";
import { PUAN } from "@/lib/points.ts";
import { R } from "@/lib/routes.ts";

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

  // Kurs onayı (F1-01): pending kurs hiç yayınlanamıyordu — onay yolu yoktu
  const courseId = Number(form.get("courseId") ?? 0);
  if ((action === "course_approve" || action === "course_reject") && courseId) {
    const approved = action === "course_approve";
    const [kurs] = await db
      .update(schema.courses)
      .set({ status: approved ? "published" : "rejected" })
      .where(and(eq(schema.courses.id, courseId), eq(schema.courses.status, "pending")))
      .returning();
    if (kurs) {
      await db.insert(schema.notifications).values({
        userId: kurs.createdBy,
        kind: "course",
        body: approved
          ? `"${kurs.title}" kursun yayında 🎓 Davet et, ilk 3 katılımcı aktive olunca +${PUAN.courseLaunched}.`
          : `"${kurs.title}" kursun için düzenleme gerekiyor — en az ${3} geçerli öğe ve kendi yazıların.`,
        href: approved ? R.kurs(kurs.slug) : R.uye.egitimOlustur,
      });
    }
  }

  // Şikâyet kuyruğu (F1-10): kaldır (course → rejected + course_launched iadesi;
  // comment → gizli kalır) ya da geri aç (course → published; comment → görünür).
  const reportTarget = String(form.get("reportTarget") ?? "");
  const reportTargetId = Number(form.get("reportTargetId") ?? 0);
  // Üye/mesaj şikâyetinde (F4-04) içerik etkisi yok: yalnız kuyruk kaydı kapanır (çözüldü / reddedildi).
  const SIKAYET_TURLERI = ["course", "comment", "user", "message"] as const;
  if (
    (action === "report_remove" || action === "report_restore") &&
    reportTargetId &&
    (SIKAYET_TURLERI as readonly string[]).includes(reportTarget)
  ) {
    const kaldir = action === "report_remove";
    if (reportTarget === "course") {
      // Durum kapısı: "geri aç" yalnız gizleneni yayına döndürür (pending/rejected
      // kurs şikâyet kuyruğu üzerinden onay atlayamaz); "kaldır" yalnız yayında/gizli
      const [kurs] = await db
        .update(schema.courses)
        .set({ status: kaldir ? "rejected" : "published" })
        .where(
          and(
            eq(schema.courses.id, reportTargetId),
            kaldir
              ? inArray(schema.courses.status, ["published", "hidden"])
              : eq(schema.courses.status, "hidden"),
          ),
        )
        .returning();
      if (kurs && kaldir) {
        // İade: negatif admin_adjust; seviye düşmez, bakiye düşer (ADR 0001 K5).
        // Üreticinin bu kursa bağlı BEKLEYEN puanları da düşer (kesinleşmesin).
        await revokePoints({ userId: kurs.createdBy, reason: "course_launched", refId: `course:${kurs.id}` });
        await db
          .update(schema.pendingPoints)
          .set({ status: "expired", resolvedAt: new Date() })
          .where(
            and(
              eq(schema.pendingPoints.userId, kurs.createdBy),
              eq(schema.pendingPoints.status, "pending"),
              or(
                eq(schema.pendingPoints.refId, `course:${kurs.id}`),
                like(schema.pendingPoints.refId, `course:${kurs.id}:%`),
              ),
            ),
          );
        await db.insert(schema.notifications).values({
          userId: kurs.createdBy,
          kind: "course",
          body: `"${kurs.title}" kursun şikâyetler üzerine kaldırıldı; açılış puanı iade alındı.`,
          href: R.uye.panel,
        });
      }
    } else if (reportTarget === "comment") {
      await db
        .update(schema.comments)
        .set({ hiddenAt: kaldir ? new Date() : null })
        .where(eq(schema.comments.id, reportTargetId));
    }
    await db
      .update(schema.reports)
      .set({ status: kaldir ? "resolved" : "dismissed" })
      .where(
        and(
          eq(schema.reports.targetType, reportTarget as (typeof SIKAYET_TURLERI)[number]),
          eq(schema.reports.targetId, reportTargetId),
          eq(schema.reports.status, "open"),
        ),
      );
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
