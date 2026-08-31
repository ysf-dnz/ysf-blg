/**
 * POST /api/uye/quiz — quiz cevaplarını sunucuda puanlar.
 * Puan = doğruluk × hız; yalnızca ilk denemede points_ledger'a yazılır.
 */
import type { APIRoute } from "astro";
import { awardPoints } from "@/lib/rewards.ts";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { PUAN } from "@/lib/points.ts";
import { scoreQuiz } from "@/lib/quiz-score.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });

  // Gövde İSTEMCİDEN gelir: her alan runtime'da doğrulanır (TypeScript cast'i
  // koruma değildir). Doğrulanmayan `ms` tek istekte keyfi puan bastırıyordu.
  const body = (await context.request.json().catch(() => null)) as {
    quizId?: unknown;
    answers?: unknown;
  } | null;
  const quizId = Number(body?.quizId);
  if (!Number.isInteger(quizId) || quizId <= 0)
    return new Response("Geçersiz quiz", { status: 400 });
  const answers = (Array.isArray(body?.answers) ? body.answers : [])
    .map((a) => a as { id?: unknown; answer?: unknown; ms?: unknown })
    .map((a) => ({
      id: Number(a.id),
      answer: a.answer === null || a.answer === undefined ? null : Number(a.answer),
      ms: Number(a.ms),
    }))
    .filter((a) => Number.isInteger(a.id));

  // Quiz'in kendisi denetlenir: yayında olmalı ve kendi quiz'in olmamalı.
  // (Eskiden yalnız quizQuestions quizId ile çekiliyordu; üye kendi 'pending'
  // quiz'ini kurup cevaplarını bildiği için sınırsız puan basabiliyordu.)
  const quiz = await db.query.quizzes.findFirst({
    where: eq(schema.quizzes.id, quizId),
  });
  if (!quiz) return new Response("Quiz yok", { status: 404 });
  if (quiz.status !== "published")
    return new Response("Quiz yayında değil", { status: 403 });

  const questions = await db.query.quizQuestions.findMany({
    where: eq(schema.quizQuestions.quizId, quizId),
  });
  if (questions.length === 0) return new Response("Quiz yok", { status: 404 });

  const { correctCount, points } = scoreQuiz(questions, answers, PUAN.quizMax);

  const prev = await db.query.quizAttempts.findFirst({
    where: and(
      eq(schema.quizAttempts.quizId, quizId),
      eq(schema.quizAttempts.userId, member.id),
    ),
  });
  await db.insert(schema.quizAttempts).values({
    quizId,
    userId: member.id,
    score: points,
    correctCount,
    totalCount: questions.length,
  });
  const totalCount = questions.length;

  // Kendi ürettiğin quiz'den puan kazanılmaz (üretim ödülü ayrıca verilir).
  const kendiQuizi = quiz.createdBy === member.id;
  let awarded = prev || kendiQuizi ? 0 : points;
  if (awarded > 0) {
    // awardPoints idempotenttir: paralel iki ilk-deneme isteği tek ödül yazar
    const yazildi = await awardPoints({
      userId: member.id,
      delta: awarded,
      reason: "quiz",
      refId: String(quizId),
    });
    if (!yazildi) awarded = 0;
  }

  return Response.json({
    correctCount,
    totalCount,
    points: awarded,
  });
};
