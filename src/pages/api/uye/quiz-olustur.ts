/** POST /api/uye/quiz-olustur — soru seti kaydet (admin/Sv7+: yayında, üye: onayda). */
import type { APIRoute } from "astro";
import { db, schema } from "@/db/client.ts";
import { earnedPoints, getOrCreateMember } from "@/lib/member.ts";
import { levelFor } from "@/lib/levels.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });

  const form = await context.request.formData();
  const bookId = String(form.get("bookId") ?? "");
  const title = String(form.get("title") ?? "").trim();
  if (!bookId || !title) return new Response("Eksik alan", { status: 400 });

  // q_N_* alanlarını topla
  const questions: {
    question: string;
    options: string[];
    correctIndex: number;
    durationSec: number;
  }[] = [];
  for (let i = 0; i < 50; i++) {
    const text = form.get(`q_${i}_text`);
    if (text === null) continue;
    const options = [0, 1, 2, 3].map((o) =>
      String(form.get(`q_${i}_opt_${o}`) ?? "").trim(),
    );
    if (!String(text).trim() || options.some((o) => !o)) continue;
    questions.push({
      question: String(text).trim(),
      options,
      correctIndex: Number(form.get(`q_${i}_correct`) ?? 0),
      durationSec: Math.min(Math.max(Number(form.get(`q_${i}_sec`) ?? 20), 5), 60),
    });
  }
  if (questions.length < 3)
    return new Response("En az 3 geçerli soru gerekli", { status: 400 });

  const [quiz] = await db
    .insert(schema.quizzes)
    .values({
      bookId,
      title,
      createdBy: member.id,
      // Seviye 7+ güvenilir üretici: onaysız yayın
      status:
        member.role === "admin" || levelFor(await earnedPoints(member.id)) >= 7
          ? "published"
          : "pending",
    })
    .returning();

  await db.insert(schema.quizQuestions).values(
    questions.map((q, i) => ({
      quizId: quiz!.id,
      question: q.question,
      options: JSON.stringify(q.options),
      correctIndex: q.correctIndex,
      durationSec: q.durationSec,
      order: i,
    })),
  );

  return context.redirect(`/kitap/${bookId}/quiz`);
};
