/**
 * Gerçek DB entegrasyon testi (F1-11): tavan SQL'i, idempotency, bekleyen
 * kesinleşme sırası ve iade — saf fonksiyon değil, Postgres davranışı.
 * YALNIZ POSTGRES_URL_TEST tanımlıysa koşar (ayrı Neon branch önerilir):
 *   POSTGRES_URL_TEST="$(node --env-file=.env.local -p process.env.POSTGRES_URL)" npx vitest run tests/integration
 * Kendi geçici üyesini açar ve temizler (clerk_id demo_itest_*).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

const URL = process.env.POSTGRES_URL_TEST;

// Uzak Neon: paralel 30 insert + streak/seviye yan etkileri 5 sn'yi aşar
describe.skipIf(!URL)("ekonomi — gerçek DB", { timeout: 90_000 }, () => {
  type Db = typeof import("@/db/client.ts");
  type Rw = typeof import("@/lib/rewards.ts");
  let db: Db["db"], schema: Db["schema"], rw: Rw, userId: number;

  beforeAll(async () => {
    process.env.POSTGRES_URL = URL;
    ({ db, schema } = await import("@/db/client.ts"));
    rw = await import("@/lib/rewards.ts");
    const [u] = await db
      .insert(schema.users)
      .values({ clerkId: `demo_itest_${Date.now()}`, handle: `itest-${Date.now().toString(36)}`, name: "Itest" })
      .returning();
    userId = u!.id;
  }, 60_000);
  afterAll(async () => {
    if (!userId) return;
    await db.delete(schema.pendingPoints).where(eq(schema.pendingPoints.userId, userId));
    await db.delete(schema.notifications).where(eq(schema.notifications.userId, userId));
    await db.delete(schema.badges).where(eq(schema.badges.userId, userId));
    await db.delete(schema.bookAccess).where(eq(schema.bookAccess.userId, userId));
    await db.delete(schema.pointsLedger).where(eq(schema.pointsLedger.userId, userId));
    await db.delete(schema.users).where(eq(schema.users.id, userId));
  }, 60_000);

  const ledger = async (reason: string, refId: string) =>
    db.query.pointsLedger.findMany({
      where: and(
        eq(schema.pointsLedger.userId, userId),
        eq(schema.pointsLedger.reason, reason as never),
        eq(schema.pointsLedger.refId, refId),
      ),
    });

  it("AC-13: aynı (reason, refId) iki kez → tek satır, ikinci çağrı 0", async () => {
    const a = await rw.awardPoints({ userId, delta: 50, reason: "course_launched", refId: "course:itest" });
    const b = await rw.awardPoints({ userId, delta: 50, reason: "course_launched", refId: "course:itest" });
    expect(a).toBe(50);
    expect(b).toBe(0);
    expect((await ledger("course_launched", "course:itest")).length).toBe(1);
  });

  it("K2: genç hesaptan olay → bekleyen (ledger boş); olgunlaşınca bir kez kesinleşir", async () => {
    const n = await rw.puanOlayi({
      userId,
      delta: 7,
      reason: "answer_accepted",
      refId: "yorum:itest-genc",
      kaynakOlusturulma: new Date(),
      note: "test",
    });
    expect(n).toBe(0);
    expect((await ledger("answer_accepted", "yorum:itest-genc")).length).toBe(0);
    const [b] = await db.query.pendingPoints.findMany({
      where: and(eq(schema.pendingPoints.userId, userId), eq(schema.pendingPoints.refId, "yorum:itest-genc")),
    });
    expect(b?.status).toBe("pending");
    expect(b?.maturesAt).toBeTruthy();
    // olgunlaştır → ilk koşum kesinleştirir, ikincisi no-op
    await db
      .update(schema.pendingPoints)
      .set({ maturesAt: new Date(Date.now() - 1000) })
      .where(eq(schema.pendingPoints.id, b!.id));
    expect((await rw.bekleyenleriIsle(new Date(), userId)).kesinlesen).toBe(1);
    expect((await rw.bekleyenleriIsle(new Date(), userId)).kesinlesen).toBe(0);
    expect((await ledger("answer_accepted", "yorum:itest-genc")).length).toBe(1);
    const [son] = await db.query.pendingPoints.findMany({ where: eq(schema.pendingPoints.id, b!.id) });
    expect(son?.status).toBe("confirmed");
    expect(son?.yazilan).toBe(7);
  });

  it("K2 onarım: ledger yazılmış ama status pending kalmışsa ikinci koşum çift yazmaz, yazilan'ı ledger'dan okur", async () => {
    await rw.awardPoints({ userId, delta: 9, reason: "answer_accepted", refId: "yorum:itest-yarim" });
    await rw.bekleyenYaz({ userId, delta: 9, reason: "answer_accepted", refId: "yorum:itest-yarim", maturesAt: new Date(Date.now() - 1000) });
    const r = await rw.bekleyenleriIsle(new Date(), userId);
    expect(r.kesinlesen).toBe(1);
    expect((await ledger("answer_accepted", "yorum:itest-yarim")).length).toBe(1);
    const [son] = await db.query.pendingPoints.findMany({
      where: and(eq(schema.pendingPoints.userId, userId), eq(schema.pendingPoints.refId, "yorum:itest-yarim")),
    });
    expect(son?.status).toBe("confirmed");
    expect(son?.yazilan).toBe(9);
  });

  it("süresi dolan bekleyen düşer, ledger'a girmez", async () => {
    await rw.bekleyenYaz({ userId, delta: 15, reason: "resource_accepted", refId: "kaynak:itest-dusen", expiresAt: new Date(Date.now() - 1000) });
    expect((await rw.bekleyenleriIsle(new Date(), userId)).dusen).toBe(1);
    expect((await ledger("resource_accepted", "kaynak:itest-dusen")).length).toBe(0);
  });

  it("K1.3 kırpma: tavan 25, 10'luk üç ödül → 10, 10, 5; dördüncü 0", async () => {
    const tavan = { reasons: ["quiz" as const], since: new Date(0), limit: 25 };
    const n = [] as number[];
    for (let i = 0; i < 4; i++)
      n.push(await rw.awardPoints({ userId, delta: 10, reason: "quiz", refId: `itest-kirp-${i}`, tavan }));
    expect(n).toEqual([10, 10, 5, 0]);
  });

  it("AC-11/K1.5: 30 paralel ödül, günlük üretici tavanı 100 → toplam TAM 100 (danışma kilidi)", async () => {
    const sonuclar = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        rw.awardPoints({ userId, delta: 5, reason: "course_learner_activated", refId: `course:itest:u:${i}` }),
      ),
    );
    const toplam = sonuclar.reduce((t, x) => t + x, 0);
    expect(toplam).toBe(100); // pg_advisory_xact_lock + INSERT…SELECT aynı transaction'da (ADR K1.5)
  });

  it("K5 iade: bir kez yazılır, bakiye düşer, kazanılan (seviye tabanı) değişmez", async () => {
    const once = await rw.awardPoints({ userId, delta: 50, reason: "course_launched", refId: "course:itest-iade" });
    expect(once).toBe(50);
    expect(await rw.revokePoints({ userId, reason: "course_launched", refId: "course:itest-iade" })).toBe(true);
    expect(await rw.revokePoints({ userId, reason: "course_launched", refId: "course:itest-iade" })).toBe(false);
    const iade = await ledger("admin_adjust", "iade:course_launched:course:itest-iade");
    expect(iade.length).toBe(1);
    expect(iade[0]!.delta).toBe(-50);
  });
});
