/**
 * Kurs daveti — gerçek DB (Faz 2): atıflı katılım, bekleyen → kesinleşme (AC-5),
 * kendi kodu (AC-7), hedef uyuşmazlığı (AC-9), 14 gün düşme (AC-8), davet tavanı (AC-11).
 * Yalnız POSTGRES_URL_TEST ile koşar; kendi geçici üyelerini/kursunu açar ve temizler.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import type { AstroCookies } from "astro";

const URL = process.env.POSTGRES_URL_TEST;
const cerez = (deger: string | null) =>
  ({ get: () => (deger ? { value: deger } : undefined), delete: () => {} }) as unknown as AstroCookies;

describe.skipIf(!URL)("kurs daveti — gerçek DB", { timeout: 120_000 }, () => {
  type Db = typeof import("@/db/client.ts");
  type Dv = typeof import("@/lib/davet.ts");
  type Rw = typeof import("@/lib/rewards.ts");
  let db: Db["db"], schema: Db["schema"], dv: Dv, rw: Rw;
  const uyeler: number[] = [];
  let kursId = 0;
  const t = Date.now().toString(36);

  async function uye(ad: string, gunOnce = 2) {
    const [u] = await db
      .insert(schema.users)
      .values({ clerkId: `demo_itest_dv_${ad}_${t}`, handle: `itest-${ad}-${t}`, name: `Itest ${ad}`, createdAt: new Date(Date.now() - gunOnce * 864e5) })
      .returning();
    uyeler.push(u!.id);
    return u!;
  }

  beforeAll(async () => {
    process.env.POSTGRES_URL = URL;
    ({ db, schema } = await import("@/db/client.ts"));
    dv = await import("@/lib/davet.ts");
    rw = await import("@/lib/rewards.ts");
  });
  afterAll(async () => {
    if (uyeler.length === 0) return;
    if (kursId) {
      const kodlar = await db.query.inviteCodes.findMany({ where: eq(schema.inviteCodes.targetId, kursId) });
      if (kodlar.length) await db.delete(schema.inviteVisits).where(inArray(schema.inviteVisits.inviteCodeId, kodlar.map((k) => k.id)));
      await db.delete(schema.inviteCodes).where(eq(schema.inviteCodes.targetId, kursId));
      await db.delete(schema.courseProgress).where(eq(schema.courseProgress.courseId, kursId));
      await db.delete(schema.courseEnrollments).where(eq(schema.courseEnrollments.courseId, kursId));
      await db.delete(schema.courseItems).where(eq(schema.courseItems.courseId, kursId));
      await db.delete(schema.courses).where(eq(schema.courses.id, kursId));
    }
    for (const tbl of [schema.pendingPoints, schema.notifications, schema.badges, schema.bookAccess, schema.pointsLedger])
      await db.delete(tbl).where(inArray(tbl.userId, uyeler));
    await db.delete(schema.users).where(inArray(schema.users.id, uyeler));
  });

  const ledger = async (userId: number, reason: string, refId: string) =>
    db.query.pointsLedger.findMany({
      where: and(eq(schema.pointsLedger.userId, userId), eq(schema.pointsLedger.reason, reason as never), eq(schema.pointsLedger.refId, refId)),
    });

  it("davet kodu üretimi idempotent, 7 karakter Crockford; hedef çözümü", async () => {
    const uretici = await uye("uretici");
    const [kurs] = await db
      .insert(schema.courses)
      .values({ slug: `itest-davet-${t}`, title: "Itest Davet Kursu", createdBy: uretici.id, status: "published" })
      .returning();
    kursId = kurs!.id;
    await db.insert(schema.courseItems).values({ courseId: kursId, order: 0, kind: "youtube", title: "v", youtubeId: "446E-r0rXHI" });
    const k1 = await dv.davetKoduUret(uretici.id, kursId);
    const k2 = await dv.davetKoduUret(uretici.id, kursId);
    expect(k1.id).toBe(k2.id);
    expect(dv.kodNormalize(k1.code)).toBe(k1.code);
    const hedef = await dv.davetHedefi(k1.code.toLowerCase());
    expect(hedef?.kurs.id).toBe(kursId);
    expect(hedef?.davetEden.id).toBe(uretici.id);
  });

  it("AC-5: atıflı katılım iki bekleyen açar; aktivasyon bir kez kesinleştirir", async () => {
    const [uretici] = uyeler;
    const kod = await dv.davetKoduUret(uretici!, kursId);
    const davetli = await uye("davetli");
    const kurs = (await db.query.courses.findFirst({ where: eq(schema.courses.id, kursId) }))!;
    const k = await dv.kursaKatil(davetli, kurs, cerez(`course:${kursId}:${kod.id}`));
    expect(k).toMatchObject({ yeni: true, davetli: true });
    const katilim = (await db.query.courseEnrollments.findFirst({
      where: and(eq(schema.courseEnrollments.userId, davetli.id), eq(schema.courseEnrollments.courseId, kursId)),
    }))!;
    expect(katilim.inviteCodeId).toBe(kod.id);
    const bekleyenler = await db.query.pendingPoints.findMany({ where: inArray(schema.pendingPoints.userId, [davetli.id, uretici!]) });
    const b = bekleyenler.filter((x) => x.refId === `course:${kursId}` || x.refId === `course:${kursId}:u:${davetli.id}`);
    expect(b.map((x) => x.status)).toEqual(["pending", "pending"]);
    expect(b.every((x) => x.expiresAt && x.expiresAt.getTime() - Date.now() > 13 * 864e5)).toBe(true);
    // Ledger henüz boş (AC-14)
    expect((await ledger(davetli.id, "course_invite_welcome", `course:${kursId}`)).length).toBe(0);
    // Aktivasyon → kesinleşir (hesap 2 günlük, genç değil)
    await dv.davetAktivasyonu(katilim, kurs, davetli);
    await dv.davetAktivasyonu(katilim, kurs, davetli); // idempotent
    expect((await ledger(davetli.id, "course_invite_welcome", `course:${kursId}`)).map((r) => r.delta)).toEqual([10]);
    expect((await ledger(uretici!, "course_invite_activated", `course:${kursId}:u:${davetli.id}`)).map((r) => r.delta)).toEqual([15]);
    const kesin = await db.query.pendingPoints.findMany({ where: and(eq(schema.pendingPoints.userId, davetli.id), eq(schema.pendingPoints.refId, `course:${kursId}`)) });
    expect(kesin[0]?.status).toBe("confirmed");
    expect(kesin[0]?.yazilan).toBe(10);
  });

  it("AC-7: kendi koduyla katılan atıf almaz; AC-9: başka kursun çerezi atıf üretmez", async () => {
    const kendi = await uye("kendi");
    const kurs = (await db.query.courses.findFirst({ where: eq(schema.courses.id, kursId) }))!;
    const kendiKod = await dv.davetKoduUret(kendi.id, kursId);
    const k = await dv.kursaKatil(kendi, kurs, cerez(`course:${kursId}:${kendiKod.id}`));
    expect(k).toMatchObject({ yeni: true, davetli: false });
    const baska = await uye("baska");
    const [uretici] = uyeler;
    const kod = await dv.davetKoduUret(uretici!, kursId);
    const k2 = await dv.kursaKatil(baska, kurs, cerez(`course:${kursId + 999999}:${kod.id}`));
    expect(k2).toMatchObject({ yeni: true, davetli: false });
    const kat = await db.query.courseEnrollments.findFirst({ where: and(eq(schema.courseEnrollments.userId, baska.id), eq(schema.courseEnrollments.courseId, kursId)) });
    expect(kat?.inviteCodeId).toBeNull();
  });

  it("AC-8: 14 gün içinde aktivasyon gelmezse bekleyen düşer, ledger'a girmez", async () => {
    const [uretici] = uyeler;
    const kod = await dv.davetKoduUret(uretici!, kursId);
    const gec = await uye("gec");
    const kurs = (await db.query.courses.findFirst({ where: eq(schema.courses.id, kursId) }))!;
    await dv.kursaKatil(gec, kurs, cerez(`course:${kursId}:${kod.id}`));
    await db
      .update(schema.pendingPoints)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(and(eq(schema.pendingPoints.userId, gec.id), eq(schema.pendingPoints.refId, `course:${kursId}`)));
    expect((await rw.bekleyenleriIsle(new Date(), gec.id)).dusen).toBe(1);
    expect((await ledger(gec.id, "course_invite_welcome", `course:${kursId}`)).length).toBe(0);
  });

  it("AC-11: davet tavanı 300/7 gün tüm davet reason'larını birlikte sayar", async () => {
    const [uretici] = uyeler;
    let toplam = 0;
    for (const r of await db.query.pointsLedger.findMany({ where: and(eq(schema.pointsLedger.userId, uretici!), inArray(schema.pointsLedger.reason, rw.DAVET_REASONLARI)) }))
      toplam += r.delta;
    for (let i = 0; i < 40; i++) {
      const n = await rw.awardPoints({ userId: uretici!, delta: 15, reason: "course_invite_activated", refId: `course:${kursId}:u:tavan${i}` });
      toplam += n;
      if (n === 0) break;
    }
    expect(toplam).toBe(300);
    expect(await rw.awardPoints({ userId: uretici!, delta: 25, reason: "referral_joined", refId: `itest-ref-${t}` })).toBe(0);
    // Tavana GİRMEYEN reason yine yazılır
    expect(await rw.awardPoints({ userId: uretici!, delta: 50, reason: "course_launched", refId: `course:${kursId}` })).toBe(50);
  });
});
