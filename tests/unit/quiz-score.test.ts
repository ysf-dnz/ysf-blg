import { describe, expect, it } from "vitest";
import { scoreQuiz } from "@/lib/quiz-score.ts";

const soru = (id: number) => ({ id, correctIndex: 1, durationSec: 20 });
const MAX = 50;

describe("scoreQuiz", () => {
  it("tamamı doğru + anında cevap → tam puan", () => {
    const qs = [soru(1), soru(2)];
    const r = scoreQuiz(qs, qs.map((q) => ({ id: q.id, answer: 1, ms: 0 })), MAX);
    expect(r).toEqual({ correctCount: 2, totalCount: 2, points: MAX });
  });

  it("tamamı yanlış → 0 puan", () => {
    const qs = [soru(1), soru(2)];
    const r = scoreQuiz(qs, qs.map((q) => ({ id: q.id, answer: 0, ms: 0 })), MAX);
    expect(r).toEqual({ correctCount: 0, totalCount: 2, points: 0 });
  });

  it("cevapsız (süre doldu, answer:null) yanlış sayılır", () => {
    const r = scoreQuiz([soru(1)], [{ id: 1, answer: null, ms: 20000 }], MAX);
    expect(r.correctCount).toBe(0);
    expect(r.points).toBe(0);
  });

  it("hız bonusu monoton: hızlı cevap yavaştan çok puan", () => {
    const hizli = scoreQuiz([soru(1)], [{ id: 1, answer: 1, ms: 1000 }], MAX);
    const yavas = scoreQuiz([soru(1)], [{ id: 1, answer: 1, ms: 19000 }], MAX);
    expect(hizli.points).toBeGreaterThan(yavas.points);
  });

  it("süre aşımıyla doğru cevap yine taban puanın altına inmez (0.5 taban)", () => {
    const r = scoreQuiz([soru(1)], [{ id: 1, answer: 1, ms: 999999 }], MAX);
    expect(r.points).toBe(MAX / 2);
  });

  it("boş soru listesi 0 döner (bölme hatası yok)", () => {
    expect(scoreQuiz([], [], MAX)).toEqual({
      correctCount: 0,
      totalCount: 0,
      points: 0,
    });
  });

  it("eşleşmeyen cevap id'leri yok sayılır", () => {
    const r = scoreQuiz([soru(1)], [{ id: 99, answer: 1, ms: 0 }], MAX);
    expect(r.correctCount).toBe(0);
  });
});
