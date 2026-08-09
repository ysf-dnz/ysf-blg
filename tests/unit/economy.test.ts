import { describe, expect, it } from "vitest";
import {
  GUNLUK_BEGENI_PUAN_SINIRI,
  KULUP_HAFTALIK_TAVAN,
  gorevOdulKirp,
  likePuaniVerilirMi,
} from "@/lib/economy.ts";

describe("beğeni çiftliği freni", () => {
  it("sınırın altı puan üretir (4. beğeni → evet)", () => {
    expect(likePuaniVerilirMi(4)).toBe(true);
  });
  it("sınır ve üstü puan üretmez (5. → hayır)", () => {
    expect(likePuaniVerilirMi(5)).toBe(false);
    expect(likePuaniVerilirMi(99)).toBe(false);
  });
  it("sınır sabiti 5 (Skool dengesi)", () => {
    expect(GUNLUK_BEGENI_PUAN_SINIRI).toBe(5);
  });
});

describe("kulüp haftalık görev ödülü kırpma", () => {
  it("bütçe yeterliyse tam öder", () => {
    expect(gorevOdulKirp(75, 900, 1000)).toEqual({ verilecek: 75, kirpildi: false });
  });
  it("bütçeyi aşan istek kalan bütçeye kırpılır", () => {
    expect(gorevOdulKirp(150, 900, 1000)).toEqual({ verilecek: 100, kirpildi: true });
  });
  it("bütçe bittiyse 0 verir", () => {
    expect(gorevOdulKirp(75, 1000, 1000)).toEqual({ verilecek: 0, kirpildi: true });
    expect(gorevOdulKirp(75, 1500, 1000)).toEqual({ verilecek: 0, kirpildi: true });
  });
  it("negatif istek 0'a sabitlenir", () => {
    expect(gorevOdulKirp(-50, 0, 1000).verilecek).toBe(0);
  });
  it("varsayılan tavan 1000", () => {
    expect(KULUP_HAFTALIK_TAVAN).toBe(1000);
  });
});
