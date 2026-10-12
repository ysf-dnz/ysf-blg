/**
 * Sezon kapanışı — gerçek DB: ödüller ÖNCE, `closed` EN SONDA (merge incelemesi #1). hazineKitabiAc ilk üyede
 * fırlatırsa sezon `active` kalır, bitenSezonlar yine listeler; ikinci koşum kalan ödülleri verir, kimse iki kez almaz.
 * rewards.ts kısmi vi.mock (yalnız bu dosya). Yalnız POSTGRES_URL_TEST; 2021 pencereli itest sezonu, kendi kayıtlarını siler.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, like } from "drizzle-orm";

const URL = process.env.POSTGRES_URL_TEST;
const h = vi.hoisted(() => ({ patlat: 0, cagri: 0 }));
vi.mock("@/lib/rewards.ts", async (orig) => {
  const m = await orig<typeof import("@/lib/rewards.ts")>();
  return {
    ...m,
    hazineKitabiAc: async (...a: Parameters<typeof m.hazineKitabiAc>) => {
      h.cagri++;
      if (h.patlat > 0) {
        h.patlat--;
        throw new Error("itest: hazine patladı");
      }
      return m.hazineKitabiAc(...a);
    },
  };
});

describe.skipIf(!URL)("sezon kapanışı yarıda kalırsa — gerçek DB", { timeout: 120_000 }, () => {
  type Db = typeof import("@/db/client.ts");
  let db: Db["db"], schema: Db["schema"];
  let lg: typeof import("@/lib/league.ts");
  const t = Date.now().toString(36);
  const uyeler: number[] = [];
  const ad = `itest-sezon-yarim-${t}`;

  beforeAll(async () => {
    process.env.POSTGRES_URL = URL;
    ({ db, schema } = await import("@/db/client.ts"));
    lg = await import("@/lib/league.ts");
  });

  afterAll(async () => {
    if (!uyeler.length) return;
    await db.delete(schema.cronRuns).where(and(eq(schema.cronRuns.job, "sezon-ilk10"), like(schema.cronRuns.periodKey, `${ad}:%`)));
    await db.delete(schema.seasons).where(eq(schema.seasons.name, ad));
    for (const tbl of [schema.notifications, schema.badges, schema.bookAccess, schema.pointsLedger])
      await db.delete(tbl).where(inArray(tbl.userId, uyeler));
    await db.delete(schema.users).where(inArray(schema.users.id, uyeler));
  }, 60_000);

  it("ilk üyede fırlatır → sezon ACTIVE kalır ve bitenSezonlar listeler; ikinci koşum tamamlar; üçüncü koşum kimseye ikinci bildirim vermez", async () => {
    const yap = async (k: string, puan: number) => {
      const [u] = await db
        .insert(schema.users)
        .values({ clerkId: `demo_itest_sz_${k}_${t}`, handle: `itest-sz-${k}-${t}`, name: `Itest Sezon ${k}`, createdAt: new Date(Date.now() - 30 * 864e5) })
        .returning();
      uyeler.push(u!.id);
      await db.insert(schema.pointsLedger).values({ userId: u!.id, delta: puan, reason: "quiz", refId: `itest-szy-${k}-${t}`, createdAt: new Date("2021-03-10T00:00:00Z") });
      return u!;
    };
    const [birinci, ikinci] = await Promise.all([yap("a", 300), yap("b", 100)]);
    const [sezon] = await db
      .insert(schema.seasons)
      .values({ name: ad, startsAt: new Date("2021-03-01T00:00:00Z"), endsAt: new Date("2021-04-01T00:00:00Z") })
      .returning();
    const bildirim = async (id: number) =>
      (await db.query.notifications.findMany({ where: and(eq(schema.notifications.userId, id), eq(schema.notifications.kind, "season")) })).length;
    const kilit = async (id: number) =>
      db.query.cronRuns.findFirst({ where: and(eq(schema.cronRuns.job, "sezon-ilk10"), eq(schema.cronRuns.periodKey, `${ad}:${id}`)) });

    h.patlat = 1; // en yüksek puanlı (birinci) ilk sırada: onun hazine açılışı patlar
    await expect(lg.sezonKapat(sezon!)).rejects.toThrow("itest: hazine patladı");
    expect((await db.query.seasons.findFirst({ where: eq(schema.seasons.id, sezon!.id) }))!.status).toBe("active"); // closed yazılMAdı
    expect((await lg.bitenSezonlar()).some((s) => s.id === sezon!.id)).toBe(true); // ertesi gün yine listede
    expect(await kilit(birinci.id)).toBeUndefined(); // birKezCalistir kilidi geri verdi
    expect([await bildirim(birinci.id), await bildirim(ikinci.id)]).toEqual([0, 0]);

    expect(await lg.sezonKapat(sezon!)).toEqual({ sampiyonKulupId: null, ilk10: 2 }); // telafi koşumu
    expect((await db.query.seasons.findFirst({ where: eq(schema.seasons.id, sezon!.id) }))!.status).toBe("closed");
    expect([await bildirim(birinci.id), await bildirim(ikinci.id)]).toEqual([1, 1]);
    expect(await kilit(birinci.id)).toBeDefined();

    const onceki = h.cagri;
    await db.update(schema.seasons).set({ status: "active" }).where(eq(schema.seasons.id, sezon!.id)); // yarışta çift tetik benzetimi
    expect(await lg.sezonKapat(sezon!)).toEqual({ sampiyonKulupId: null, ilk10: 2 });
    expect(h.cagri).toBe(onceki); // kilitli: hazineKitabiAc bir daha çağrılmadı (idempotent değil, ikinci kitap verirdi)
    expect([await bildirim(birinci.id), await bildirim(ikinci.id)]).toEqual([1, 1]);
  });
});
