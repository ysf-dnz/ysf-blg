import { describe, expect, it } from "vitest";
import { PUAN } from "@/lib/points.ts";
import { canManage, canManageGlobal } from "@/lib/permissions.ts";

describe("puan ekonomisi değişmezleri", () => {
  it("kitap açma maliyeti tek yazı ödülünden büyük (emek gerektirir)", () => {
    expect(PUAN.bookUnlockCost).toBeGreaterThan(PUAN.postApproved);
  });
  it("2 yazı bir kitabı açar (ulaşılabilir hedef)", () => {
    expect(PUAN.welcome + 2 * PUAN.postApproved).toBeGreaterThanOrEqual(
      PUAN.bookUnlockCost,
    );
  });
  it("davet aktivasyonu katılımdan değerli (kalabalık değil katkı)", () => {
    expect(PUAN.referralActivated).toBeGreaterThan(PUAN.referralJoined);
  });
  it("beğeni 1 puandır (Skool kuralı, enflasyon yok)", () => {
    expect(PUAN.likeReceived).toBe(1);
  });
  it("kampanya çarpanı üretimi teşvik eder (>1)", () => {
    expect(PUAN.campaignMultiplier).toBeGreaterThan(1);
  });
});

describe("yetki matrisi (saf kurallar)", () => {
  it("başkan ve mod yönetir, üye yönetemez", () => {
    expect(canManage("president")).toBe(true);
    expect(canManage("mod")).toBe(true);
    expect(canManage("member")).toBe(false);
    expect(canManage(null)).toBe(false);
  });
  it("site-geneli: yalnız rep ve admin", () => {
    const uye = (role: "member" | "rep" | "admin") => ({ role }) as never;
    expect(canManageGlobal(uye("admin"))).toBe(true);
    expect(canManageGlobal(uye("rep"))).toBe(true);
    expect(canManageGlobal(uye("member"))).toBe(false);
    expect(canManageGlobal(null)).toBe(false);
  });
});
