import { describe, expect, it } from "vitest";
import {
  HESAP_YASI_SAAT,
  OGE_ASGARI_SN,
  asgariSureGectiMi,
  hesapGencMi,
  olgunlasmaAni,
} from "@/lib/economy.ts";
import { PUAN } from "@/lib/points.ts";
import { tavanIcin, yediGunOnce } from "@/lib/rewards.ts";

const T0 = new Date("2026-10-11T12:00:00+03:00");
const sn = (n: number) => new Date(T0.getTime() + n * 1000);

describe("kurs tamamlama asgari süresi (öğe × 60 sn)", () => {
  it.each([
    // öğe, katılımdan beri geçen sn, beklenen
    [3, 179, false],
    [3, 180, true],
    [1, 59, false],
    [1, 60, true],
    [10, 599, false],
    [10, 600, true],
    [0, 0, true],
  ])("%i öğe, %i sn geçti → %s", (oge, gecen, beklenen) => {
    const joinedAt = T0;
    expect(asgariSureGectiMi(oge, joinedAt, sn(gecen))).toBe(beklenen);
  });
  it("sabit 60 sn", () => expect(OGE_ASGARI_SN).toBe(60));
});

describe("hesap yaşı freni (24 saat)", () => {
  const saat = (n: number) => new Date(T0.getTime() - n * 3600 * 1000);
  it.each([
    [0, true],
    [23.99, true],
    [24, false],
    [48, false],
  ])("%s saatlik hesap genç mi → %s", (yas, beklenen) => {
    expect(hesapGencMi(saat(yas), T0)).toBe(beklenen);
  });
  it("olgunlaşma anı = açılış + 24 s", () => {
    expect(olgunlasmaAni(saat(3)).getTime() - saat(3).getTime()).toBe(HESAP_YASI_SAAT * 3600 * 1000);
  });
});

describe("reason → tavan eşlemesi (awardPoints içinde otomatik)", () => {
  it("üretici puanları tek günlük havuzda 100", () => {
    const t = tavanIcin("course_learner_activated")!;
    expect(t.limit).toBe(PUAN.courseProducerDailyCap);
    expect(t.reasons).toEqual(["course_learner_activated", "course_learner_completed"]);
    expect(tavanIcin("course_learner_completed")!.limit).toBe(PUAN.courseProducerDailyCap);
  });
  it("ek kaynak günde 3 × 15", () => {
    expect(tavanIcin("resource_accepted")!.limit).toBe(PUAN.resourceDailyCap);
    expect(PUAN.resourceDailyCap).toBe(3 * PUAN.resourceAccepted);
  });
  it("kurs bitirme kayan 7 günde 100", () => {
    const t = tavanIcin("course_completed")!;
    expect(t.limit).toBe(PUAN.courseWeeklyCap);
    expect(T0.getTime() - yediGunOnce(T0).getTime()).toBe(7 * 864e5);
  });
  it("en iyi cevap günde 3 × 10 (kukla hesap çiftliği freni)", () => {
    expect(tavanIcin("answer_accepted")!.limit).toBe(PUAN.answerDailyCap);
    expect(PUAN.answerDailyCap).toBe(3 * PUAN.answerAccepted);
  });
  it("tavansız reason'lar undefined (idem index tek koruma)", () => {
    expect(tavanIcin("course_launched")).toBeUndefined();
    expect(tavanIcin("welcome")).toBeUndefined();
  });
  it("ekonomi oranı: tek öğrenciden üreticiye en çok 15 + açılış payı", () => {
    expect(PUAN.courseLearnerActivated + PUAN.courseLearnerCompleted).toBeLessThanOrEqual(15);
    expect(PUAN.courseLaunched).toBe(50);
    // Davetli bir öğrencinin kendi kazancı (25) üreticiye kazandırdığından (15) fazla
    expect(PUAN.courseCompleted).toBeGreaterThan(PUAN.courseLearnerActivated + PUAN.courseLearnerCompleted);
  });
});
