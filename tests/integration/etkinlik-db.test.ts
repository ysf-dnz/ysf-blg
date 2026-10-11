/**
 * Etkinlik — gerçek DB (Faz 3): kapasite yarışı, kayıt kapanışı, ⭐ koltuk, görevli sınırı.
 * Yalnız POSTGRES_URL_TEST ile koşar; kendi geçici üyelerini/etkinliklerini açar ve temizler:
 *   POSTGRES_URL_TEST="$(node --env-file=.env.local -p process.env.POSTGRES_URL)" npx vitest run tests/integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";

const URL = process.env.POSTGRES_URL_TEST;
const SAAT = 3600e3;

describe.skipIf(!URL)("etkinlik — gerçek DB", { timeout: 180_000 }, () => {
  type Db = typeof import("@/db/client.ts");
  type Ev = typeof import("@/lib/etkinlik.ts");
  type Rw = typeof import("@/lib/rewards.ts");
  let db: Db["db"], schema: Db["schema"], ev: Ev, rw: Rw;
  const uyeler: number[] = [];
  const etkinlikler: number[] = [];
  const t = Date.now().toString(36);

  async function uye(ad: string, gunOnce = 2) {
    const [u] = await db
      .insert(schema.users)
      .values({ clerkId: `demo_itest_ev_${ad}_${t}`, handle: `itest-ev-${ad}-${t}`, name: `Itest ${ad}`, createdAt: new Date(Date.now() - gunOnce * 864e5) })
      .returning();
    uyeler.push(u!.id);
    return u!;
  }
  /** baslangic/bitis: şimdiye göre saat farkı */
  async function etkinlik(acanId: number, ek: Partial<typeof schema.events.$inferInsert> & { baslangic?: number; bitis?: number } = {}) {
    const { baslangic = -1, bitis = 3, ...alanlar } = ek;
    const [e] = await db
      .insert(schema.events)
      .values({
        slug: `itest-ev-${t}-${etkinlikler.length}`,
        title: `Itest Etkinlik ${etkinlikler.length}`,
        startsAt: new Date(Date.now() + baslangic * SAAT),
        endsAt: new Date(Date.now() + bitis * SAAT),
        createdBy: acanId,
        ...alanlar,
      })
      .returning();
    etkinlikler.push(e!.id);
    await ev.gorevliEkle(e!, acanId, "host");
    return e!;
  }
  const ledger = async (userId: number, reason: string, refId: string) =>
    db.query.pointsLedger.findMany({
      where: and(eq(schema.pointsLedger.userId, userId), eq(schema.pointsLedger.reason, reason as never), eq(schema.pointsLedger.refId, refId)),
    });
  const kayitlar = (eventId: number) =>
    db.query.eventRsvps.findMany({ where: eq(schema.eventRsvps.eventId, eventId) });

  beforeAll(async () => {
    process.env.POSTGRES_URL = URL;
    ({ db, schema } = await import("@/db/client.ts"));
    ev = await import("@/lib/etkinlik.ts");
    rw = await import("@/lib/rewards.ts");
  });
  afterAll(async () => {
    if (etkinlikler.length) {
      await db.delete(schema.ratings).where(inArray(schema.ratings.eventId, etkinlikler));
      await db.delete(schema.eventStaff).where(inArray(schema.eventStaff.eventId, etkinlikler));
      const kodlar = await db.query.inviteCodes.findMany({
        where: and(eq(schema.inviteCodes.targetType, "event"), inArray(schema.inviteCodes.targetId, etkinlikler)),
      });
      if (kodlar.length) {
        await db.delete(schema.inviteVisits).where(inArray(schema.inviteVisits.inviteCodeId, kodlar.map((k) => k.id)));
        await db.delete(schema.inviteCodes).where(inArray(schema.inviteCodes.id, kodlar.map((k) => k.id)));
      }
      await db.delete(schema.eventRsvps).where(inArray(schema.eventRsvps.eventId, etkinlikler));
      await db
        .delete(schema.cronRuns)
        .where(and(inArray(schema.cronRuns.job, ["etkinlik-host", "etkinlik-degerlendirme"]), inArray(schema.cronRuns.periodKey, etkinlikler.map(String))));
      await db.delete(schema.events).where(inArray(schema.events.id, etkinlikler));
    }
    if (uyeler.length === 0) return;
    for (const tbl of [schema.pendingPoints, schema.notifications, schema.badges, schema.bookAccess, schema.pointsLedger])
      await db.delete(tbl).where(inArray(tbl.userId, uyeler));
    await db.delete(schema.users).where(inArray(schema.users.id, uyeler));
  });

  /* ---------------- F3-02: kayıt ---------------- */

  it("kapasite: 8 paralel kayıt, kontenjan 3 → TAM 3 kayıt (kilitsiz tek SQL N kez aşardı)", async () => {
    const acan = await uye("kap-acan");
    const e = await etkinlik(acan.id, { capacity: 3 });
    const adaylar = await Promise.all(Array.from({ length: 8 }, (_, i) => uye(`kap-${i}`)));
    const sonuclar = await Promise.all(adaylar.map((u) => ev.kayitOl(u, e)));
    expect(sonuclar.filter((s) => s.durum === "yeni")).toHaveLength(3);
    expect(sonuclar.filter((s) => s.durum === "dolu")).toHaveLength(5);
    expect(await kayitlar(e.id)).toHaveLength(3);
    // Dolduktan sonra yeni aday da giremez; kayıtlı olan tekrar denerse "zaten"
    expect((await ev.kayitOl(await uye("kap-gec"), e)).durum).toBe("dolu");
    const kayitli = adaylar[sonuclar.findIndex((s) => s.durum === "yeni")]!;
    expect((await ev.kayitOl(kayitli, e)).durum).toBe("zaten");
    expect(await kayitlar(e.id)).toHaveLength(3);
  });

  it("kayıt kapanışı geçtiyse ve etkinlik bittiyse kayıt alınmaz; kontenjansız etkinlik sınırsız", async () => {
    const acan = await uye("kpn-acan");
    const kapali = await etkinlik(acan.id, { baslangic: 2, bitis: 4, rsvpClosesAt: new Date(Date.now() - 60e3) });
    expect((await ev.kayitOl(await uye("kpn-1"), kapali)).durum).toBe("kapali");
    const bitmis = await etkinlik(acan.id, { baslangic: -5, bitis: -3 });
    expect((await ev.kayitOl(await uye("kpn-2"), bitmis)).durum).toBe("kapali");
    // Bitişi girilmemiş eski kayıt: başlangıç + 2 saat sayılır
    const eski = await etkinlik(acan.id, { baslangic: -1, endsAt: null });
    expect((await ev.kayitOl(await uye("kpn-3"), eski)).durum).toBe("yeni");
    const eskiBitmis = await etkinlik(acan.id, { baslangic: -3, endsAt: null });
    expect((await ev.kayitOl(await uye("kpn-4"), eskiBitmis)).durum).toBe("kapali");
    expect(await kayitlar(kapali.id)).toHaveLength(0);
  });

  it("⭐ öncelikli koltuk: bakiye yetmezse kayıt olur ama ⭐ olmaz; yeterse 25 puan kesilir (tek kez)", async () => {
    const acan = await uye("onc-acan");
    const e = await etkinlik(acan.id);
    const fakir = await uye("onc-fakir");
    const f = await ev.kayitOl(fakir, e, { oncelik: true });
    expect(f).toMatchObject({ durum: "yeni", oncelikli: false });
    expect(await ledger(fakir.id, "spend_priority", String(e.id))).toHaveLength(0);

    const zengin = await uye("onc-zengin");
    await rw.awardPoints({ userId: zengin.id, delta: 40, reason: "welcome", refId: `itest:${t}` });
    const z = await ev.kayitOl(zengin, e, { oncelik: true });
    expect(z).toMatchObject({ durum: "yeni", oncelikli: true });
    expect((await ledger(zengin.id, "spend_priority", String(e.id))).map((l) => l.delta)).toEqual([-25]);
    // Tekrar deneme ikinci kez kesmez
    expect((await ev.kayitOl(zengin, e, { oncelik: true })).durum).toBe("zaten");
    expect(await ledger(zengin.id, "spend_priority", String(e.id))).toHaveLength(1);
    const satir = (await kayitlar(e.id)).find((r) => r.userId === zengin.id);
    expect(satir?.priority).toBe(true);
  });

  it("görevliler: açan + en çok 3 ortak düzenleyen; görevli (scanner) sınırsız; açan çıkarılamaz", async () => {
    const acan = await uye("gor-acan");
    const e = await etkinlik(acan.id);
    const ortaklar = await Promise.all(Array.from({ length: 4 }, (_, i) => uye(`gor-h${i}`)));
    const eklenen = [];
    for (const o of ortaklar) eklenen.push(await ev.gorevliEkle(e, o.id, "host"));
    expect(eklenen).toEqual([true, true, true, false]);
    expect(await ev.gorevliEkle(e, ortaklar[3]!.id, "scanner")).toBe(true);
    expect((await ev.hostIdleri(e)).sort()).toEqual([acan.id, ...ortaklar.slice(0, 3).map((o) => o.id)].sort());
    expect(await ev.gorevliRol(e, ortaklar[3]!.id)).toBe("scanner");
    expect(await ev.gorevliRol(e, (await uye("gor-yabanci")).id)).toBeNull();
    await ev.gorevliSil(e, acan.id);
    expect(await ev.gorevliRol(e, acan.id)).toBe("host");
    await ev.gorevliSil(e, ortaklar[0]!.id);
    expect(await ev.gorevliRol(e, ortaklar[0]!.id)).toBeNull();
    // Yer açıldı → 4. ortak artık host olabilir mi? Önce scanner satırı var → rol değişmez (silip eklenir)
    expect(await ev.gorevliEkle(e, ortaklar[3]!.id, "host")).toBe(false);
  });

  it("slug'sız eski etkinliğe ilk çağrıda slug atanır, ikinci çağrı aynı slug'ı döner", async () => {
    const acan = await uye("slug-acan");
    const [e] = await db
      .insert(schema.events)
      .values({ title: "Itest Slug'sız Çay Sohbeti", startsAt: new Date(Date.now() + SAAT), createdBy: acan.id })
      .returning();
    etkinlikler.push(e!.id);
    expect(e!.slug).toBeNull();
    const s1 = await ev.slugGaranti(e!);
    expect(s1).toMatch(/^itest-slug-siz-cay-sohbeti-[0-9a-f]{6}$/);
    expect(await ev.slugGaranti(e!)).toBe(s1);
    expect((await ev.etkinlikBul(String(e!.id)))?.id).toBe(e!.id);
    expect((await ev.etkinlikBul(s1))?.id).toBe(e!.id);
  });
});
