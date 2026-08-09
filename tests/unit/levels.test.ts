import { describe, expect, it } from "vitest";
import { LEVEL_THRESHOLDS, levelFor, pointsToNextLevel } from "@/lib/levels.ts";

describe("levelFor — Skool eşikleri, sınır değerler", () => {
  it("0 puan Seviye 1", () => expect(levelFor(0)).toBe(1));
  it("eşiğin 1 altı önceki seviyede kalır (4 → Sv1)", () =>
    expect(levelFor(4)).toBe(1));
  it("tam eşik seviyeyi atlar (5 → Sv2)", () => expect(levelFor(5)).toBe(2));
  it("20 → Sv3, 19 → Sv2", () => {
    expect(levelFor(20)).toBe(3);
    expect(levelFor(19)).toBe(2);
  });
  it("son eşik: 33015 → Sv9; üstü de Sv9", () => {
    expect(levelFor(33015)).toBe(9);
    expect(levelFor(1_000_000)).toBe(9);
  });
  it("negatif girdi Sv1'de kalır", () => expect(levelFor(-50)).toBe(1));
});

describe("pointsToNextLevel", () => {
  it("0 puanla sonraki seviyeye 5 kaldı", () =>
    expect(pointsToNextLevel(0)).toBe(5));
  it("eşiğe tam oturunca bir sonraki eşiğe bakar (5 → 15 kaldı)", () =>
    expect(pointsToNextLevel(5)).toBe(20 - 5));
  it("son seviyede null", () => expect(pointsToNextLevel(33015)).toBeNull());
  it("eşikler kesin artan", () => {
    for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
      expect(LEVEL_THRESHOLDS[i]!).toBeGreaterThan(LEVEL_THRESHOLDS[i - 1]!);
    }
  });
});
