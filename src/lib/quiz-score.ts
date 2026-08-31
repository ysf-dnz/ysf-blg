/** Quiz puanlama — saf fonksiyon (birim test edilir; API bunu çağırır). */

export interface ScoreQuestion {
  id: number;
  correctIndex: number;
  durationSec: number;
}
export interface ScoreAnswer {
  id: number;
  answer: number | null;
  ms: number;
}

export interface ScoreResult {
  correctCount: number;
  totalCount: number;
  /** 0..maxPoints — doğruluk × hız */
  points: number;
}

export function scoreQuiz(
  questions: ScoreQuestion[],
  answers: ScoreAnswer[],
  maxPoints: number,
): ScoreResult {
  let raw = 0;
  let correctCount = 0;
  for (const q of questions) {
    const a = answers.find((x) => x.id === q.id);
    if (!a || a.answer !== q.correctIndex) continue;
    correctCount++;
    // hız bonusu: 0.5 taban + 0.5 × kalan süre oranı.
    // ms İSTEMCİDEN gelir → [0, süre] aralığına sıkıştırılır ve speed iki
    // taraftan kırpılır; aksi halde negatif ms speed'i sınırsız büyütüp
    // tek istekte keyfi puan bastırır.
    const sure = Math.max(1, q.durationSec) * 1000;
    const ms = Number.isFinite(a.ms) ? Math.min(Math.max(a.ms, 0), sure) : sure;
    const speed = Math.min(1, Math.max(0, 1 - ms / sure));
    raw += 0.5 + 0.5 * speed;
  }
  const points =
    questions.length === 0
      ? 0
      : Math.min(maxPoints, Math.max(0, Math.round((raw / questions.length) * maxPoints)));
  return { correctCount, totalCount: questions.length, points };
}
