/**
 * POST /api/uye/quiz — quiz cevaplarını sunucuda puanlar.
 * Puan = doğruluk × hız; yalnızca ilk denemede points_ledger'a yazılır.
 */
import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { PUAN } from "@/lib/points.ts";
import { scoreQuiz } from "@/lib/quiz-score.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });

  const body = (await context.request.json()) as {
    quizId: number;
    answers: { id: number; answer: number | null; ms: number }[];
  };
  const questions = await db.query.quizQuestions.findMany({
    where: eq(schema.quizQuestions.quizId, body.quizId),
  });
  if (questions.length === 0) return new Response("Quiz yok", { status: 404 });

  const { correctCount, points } = scoreQuiz(questions, body.answers, PUAN.quizMax);

  const prev = await db.query.quizAttempts.findFirst({
    where: and(
      eq(schema.quizAttempts.quizId, body.quizId),
      eq(schema.quizAttempts.userId, member.id),
    ),
  });
  await db.insert(schema.quizAttempts).values({
    quizId: body.quizId,
    userId: member.id,
    score: points,
    correctCount,
    totalCount: questions.length,
  });
  const totalCount = questions.length;

  const awarded = prev ? 0 : points;
  if (awarded > 0) {
    await db.insert(schema.pointsLedger).values({
      userId: member.id,
      delta: awarded,
      reason: "quiz",
      refId: String(body.quizId),
    });
  }

  return Response.json({
    correctCount,
    totalCount,
    points: awarded,
  });
};
