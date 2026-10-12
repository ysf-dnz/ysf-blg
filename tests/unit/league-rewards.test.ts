/** Lig normalizasyonu + streak geçişi + sezon yardımcıları (saf fonksiyonlar). */
import { describe, expect, it } from "vitest";
import { ayPenceresi, normalizeSkor, sezonAdi } from "@/lib/league.ts";
import { UNLOCKS, gunKey, sonrakiStreak } from "@/lib/rewards.ts";

describe("normalizeSkor", () => {
  it("üye başına adil kıyas: ham ÷ √üye", () => {
    expect(normalizeSkor(1000, 4)).toBe(500);
    expect(normalizeSkor(1000, 100)).toBe(100);
  });
  it("küçük kulüp büyüğe ezilmez: aynı kişi-başı katkıda küçük öne geçebilir", () => {
    // 5 üye × 100p = 500 → 224 ; 50 üye × 100p = 5000 → 707 (büyük yine önde ama ham farkı 10x değil ~3x)
    expect(normalizeSkor(500, 5)).toBeLessThan(normalizeSkor(5000, 50));
    expect(normalizeSkor(5000, 50) / normalizeSkor(500, 5)).toBeCloseTo(3.16, 1);
  });
  it("boş kulüp sıfır", () => {
    expect(normalizeSkor(0, 0)).toBe(0);
  });
});

describe("sonrakiStreak", () => {
  const gun = (s: string) => new Date(`${s}T12:00:00`);
  it("ilk aktivite 1 başlatır", () => {
    expect(sonrakiStreak(0, null, gun("2026-08-09"))).toEqual({
      count: 1,
      day: "2026-08-09",
      ilerledi: true,
    });
  });
  it("dün aktifse +1", () => {
    expect(sonrakiStreak(3, "2026-08-08", gun("2026-08-09")).count).toBe(4);
  });
  it("bugün zaten aktifse ilerlemez (idempotent)", () => {
    const g = sonrakiStreak(5, "2026-08-09", gun("2026-08-09"));
    expect(g.count).toBe(5);
    expect(g.ilerledi).toBe(false);
  });
  it("gün kaçınca 1'e döner", () => {
    expect(sonrakiStreak(12, "2026-08-05", gun("2026-08-09")).count).toBe(1);
  });
  it("ay sınırında dün doğru hesaplanır", () => {
    expect(sonrakiStreak(2, "2026-07-31", gun("2026-08-01")).count).toBe(3);
  });
});

describe("sezon yardımcıları", () => {
  it("ay penceresi TR takviminde ayın 1'i 00:00 (+03:00) → sonraki ayın 1'i; makine saat diliminden bağımsız (Vercel UTC)", () => {
    const { start, end } = ayPenceresi(new Date("2026-08-09T10:00:00Z"));
    expect(start.toISOString()).toBe("2026-07-31T21:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-31T21:00:00.000Z");
    // TR'de 1 Kasım 01:30 ama UTC'de hâlâ 31 Ekim: pencere KASIM (eski yerel hesap Vercel'de Ekim diyordu)
    const kasim = ayPenceresi(new Date("2026-10-31T22:30:00Z"));
    expect(kasim.start.toISOString()).toBe("2026-10-31T21:00:00.000Z");
    expect(kasim.end.toISOString()).toBe("2026-11-30T21:00:00.000Z");
    expect(ayPenceresi(new Date("2026-12-15T12:00:00Z")).end.toISOString()).toBe("2026-12-31T21:00:00.000Z"); // yıl devri
  });
  it("sezon adı Türkçe ay içerir ve TR takvimine göre (UTC 31 Ekim gecesi → Kasım)", () => {
    expect(sezonAdi(new Date("2026-08-09"))).toContain("Ağustos");
    expect(sezonAdi(new Date("2026-10-31T22:30:00Z"))).toContain("Kasım");
  });
  it("gunKey yerel YYYY-MM-DD üretir", () => {
    expect(gunKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
  it("seviye açılımları 3/5/7'de tanımlı", () => {
    expect(Object.keys(UNLOCKS).map(Number).sort()).toEqual([3, 5, 7]);
  });
});
