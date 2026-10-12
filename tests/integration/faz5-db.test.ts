/**
 * Faz 5 — gerçek DB: 2. seviye davet (AC-10), canlılık havuzu (kişi başına tek satır, idempotent),
 * suistimal taraması + işaretli hesabın lig / bekleyen etkisi, ekonomi kartı tek SQL'i.
 * Yalnız POSTGRES_URL_TEST ile koşar; kendi geçici üyelerini / kurslarını açar ve temizler.
 * Havuz ve tarama yalnız test verisine daraltılır (kursIdleri / davetciId): canlı kurslar ödenmez.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, ne } from "drizzle-orm";
import type { AstroCookies } from "astro";

const URL = process.env.POSTGRES_URL_TEST;
const cerez = (deger: string) =>
  ({ get: () => ({ value: deger }), delete: () => {} }) as unknown as AstroCookies;

describe.skipIf(!URL)("faz 5 ekonomi — gerçek DB", { timeout: 180_000 }, () => {
  type Db = typeof import("@/db/client.ts");
  let db: Db["db"], schema: Db["schema"];
  let dv: typeof import("@/lib/davet.ts");
  let rw: typeof import("@/lib/rewards.ts");
  let ek: typeof import("@/lib/ekonomi.ts");
  let ec: typeof import("@/lib/economy.ts");
  let lg: typeof import("@/lib/league.ts");
  let cr: typeof import("@/lib/cron.ts");
  type Uye = Db["schema"]["users"]["$inferSelect"];
  type Kurs = Db["schema"]["courses"]["$inferSelect"];
  const uyeler: number[] = [];
  const kurslar: number[] = [];
  let kulupId = 0;
  // Testler sırayla koşar ve bu kayıtları paylaşır (Promise.all sırası uyeler[] dizisinde garanti değil)
  let uretici: Uye, a: Uye, b: Uye, c: Uye, ana: Kurs, davetci: Uye;
  const kuklalar: Uye[] = [];
  const t = Date.now().toString(36);

  async function uye(ad: string, gunOnce = 2): Promise<Uye> {
    const [u] = await db
      .insert(schema.users)
      .values({ clerkId: `demo_itest_f5_${ad}_${t}`, handle: `itest-f5-${ad}-${t}`, name: `Itest ${ad}`, createdAt: new Date(Date.now() - gunOnce * 864e5) })
      .returning();
    uyeler.push(u!.id);
    return u!;
  }
  async function kurs(ad: string, ureticiId: number, oge = 1): Promise<{ kurs: Kurs; ogeler: number[] }> {
    const [k] = await db
      .insert(schema.courses)
      .values({ slug: `itest-f5-${ad}-${t}`, title: `Itest F5 ${ad}`, createdBy: ureticiId, status: "published" })
      .returning();
    kurslar.push(k!.id);
    const ogeler = await db
      .insert(schema.courseItems)
      .values(Array.from({ length: oge }, (_, i) => ({ courseId: k!.id, order: i, kind: "youtube" as const, title: `v${i}`, youtubeId: "446E-r0rXHI" })))
      .returning({ id: schema.courseItems.id });
    return { kurs: k!, ogeler: ogeler.map((o) => o.id) };
  }
  /** Davet koduyla katıl + ilk öğe aktivasyonunun davet ödülleri (egitim.ts `complete` sırası) */
  async function davetleAktive(davetli: Uye, k: Kurs, davetEdenId: number) {
    const kod = await dv.davetKoduUret(davetEdenId, k.id);
    await dv.kursaKatil(davetli, k, cerez(`course:${k.id}:${kod.id}`));
    const katilim = (await db.query.courseEnrollments.findFirst({
      where: and(eq(schema.courseEnrollments.userId, davetli.id), eq(schema.courseEnrollments.courseId, k.id)),
    }))!;
    // Üretim sırası (egitim.ts `complete`): ÖNCE activated_at yazılır, SONRA davet ödülleri — ikinciSeviye bu
    // katılımın aktivasyon anını DB'den okur; ters sıra onu now() yedeğine düşürüyordu (devir §2.6)
    await db.update(schema.courseEnrollments).set({ activatedAt: new Date() }).where(eq(schema.courseEnrollments.id, katilim.id));
    await dv.davetAktivasyonu(katilim, k, davetli);
  }
  const ledger = async (userId: number, reason: string, refId?: string) =>
    (
      await db.query.pointsLedger.findMany({
        where: and(eq(schema.pointsLedger.userId, userId), eq(schema.pointsLedger.reason, reason as never)),
      })
    ).filter((r) => refId === undefined || r.refId === refId);

  beforeAll(async () => {
    process.env.POSTGRES_URL = URL;
    ({ db, schema } = await import("@/db/client.ts"));
    dv = await import("@/lib/davet.ts");
    rw = await import("@/lib/rewards.ts");
    ek = await import("@/lib/ekonomi.ts");
    ec = await import("@/lib/economy.ts");
    lg = await import("@/lib/league.ts");
    cr = await import("@/lib/cron.ts");
  });

  afterAll(async () => {
    if (uyeler.length === 0) return;
    if (kulupId) {
      await db.delete(schema.clubMembers).where(eq(schema.clubMembers.clubId, kulupId));
      await db.delete(schema.clubs).where(eq(schema.clubs.id, kulupId));
    }
    if (kurslar.length) {
      // Tür filtresi ŞART: aynı sayısal id'li (gerçek) etkinliğin davet kodları silinmesin
      const kursKodu = and(eq(schema.inviteCodes.targetType, "course"), inArray(schema.inviteCodes.targetId, kurslar));
      const kodlar = await db.query.inviteCodes.findMany({ where: kursKodu });
      if (kodlar.length) await db.delete(schema.inviteVisits).where(inArray(schema.inviteVisits.inviteCodeId, kodlar.map((k) => k.id)));
      const ogeler = await db.query.courseItems.findMany({ where: inArray(schema.courseItems.courseId, kurslar) });
      const yorumlar = ogeler.length
        ? await db.query.comments.findMany({ where: inArray(schema.comments.courseItemId, ogeler.map((o) => o.id)) })
        : [];
      if (yorumlar.length) {
        await db.delete(schema.likes).where(inArray(schema.likes.commentId, yorumlar.map((y) => y.id)));
        await db.delete(schema.comments).where(inArray(schema.comments.id, yorumlar.map((y) => y.id)));
      }
      await db.delete(schema.courseResources).where(inArray(schema.courseResources.courseId, kurslar));
      await db.delete(schema.courseProgress).where(inArray(schema.courseProgress.courseId, kurslar));
      await db.delete(schema.courseEnrollments).where(inArray(schema.courseEnrollments.courseId, kurslar));
      await db.delete(schema.inviteCodes).where(kursKodu);
      await db.delete(schema.courseItems).where(inArray(schema.courseItems.courseId, kurslar));
      await db.delete(schema.courses).where(inArray(schema.courses.id, kurslar));
    }
    await db.delete(schema.referrals).where(inArray(schema.referrals.invitedId, uyeler));
    await db
      .delete(schema.cronRuns)
      .where(and(eq(schema.cronRuns.job, ek.SUISTIMAL_TEMIZ), inArray(schema.cronRuns.periodKey, uyeler.map(String))));
    for (const tbl of [schema.pendingPoints, schema.notifications, schema.badges, schema.bookAccess, schema.pointsLedger])
      await db.delete(tbl).where(inArray(tbl.userId, uyeler));
    await db.delete(schema.users).where(inArray(schema.users.id, uyeler));
  }, 60_000);

  /* ---------------- F5-01: 2. seviye davet ---------------- */

  it("AC-10: A→B (platform), B→C (kurs): C aktive → B +15, A +5; yeniden çağrı tek satır", async () => {
    [uretici, a, b, c] = await Promise.all([uye("uretici"), uye("a"), uye("b"), uye("c")]);
    const k = (ana = (await kurs("ana", uretici.id)).kurs);
    await db.insert(schema.referrals).values([
      { inviterId: a.id, invitedId: b.id },
      { inviterId: b.id, invitedId: c.id },
    ]);
    await davetleAktive(c, k, b.id);
    const katilim = (await db.query.courseEnrollments.findFirst({
      where: and(eq(schema.courseEnrollments.userId, c.id), eq(schema.courseEnrollments.courseId, k.id)),
    }))!;
    await dv.davetAktivasyonu(katilim, k, c); // idempotent (AC-13)
    expect((await ledger(b.id, "course_invite_activated")).map((r) => r.delta)).toEqual([15]);
    const ikinci = await ledger(a.id, "invite_second_level");
    expect(ikinci.map((r) => [r.delta, r.refId])).toEqual([[5, `u:${c.id}`]]);
  });

  it("AC-10: 3. seviye yok — C'nin davetlisi D aktive olunca A'ya satır yazılmaz (B alır)", async () => {
    const d = await uye("d");
    await davetleAktive(d, ana, c.id);
    expect((await ledger(c.id, "course_invite_activated")).map((r) => r.delta)).toEqual([15]);
    expect((await ledger(b.id, "invite_second_level")).map((r) => r.refId)).toEqual([`u:${d.id}`]);
    expect((await ledger(a.id, "invite_second_level")).length).toBe(1); // yalnız C'den gelen
  });

  it("AC-10: C ikinci bir kursta aktive olunca A ikinci kez almaz; aktif üye davetle gelince 2. seviye yok", async () => {
    const { kurs: k2 } = await kurs("ikinci", uretici.id);
    await davetleAktive(c, k2, b.id);
    expect((await ledger(a.id, "invite_second_level")).length).toBe(1);
    // Daha önce başka kursta aktive olmuş üye (F): B'nin davetiyle gelir, B +15 alır, A almaz
    const f = await uye("f");
    await db.insert(schema.courseEnrollments).values({ userId: f.id, courseId: k2.id, activatedAt: new Date() });
    await davetleAktive(f, ana, b.id);
    expect((await ledger(b.id, "course_invite_activated", `course:${ana.id}:u:${f.id}`)).length).toBe(1);
    expect((await ledger(a.id, "invite_second_level", `u:${f.id}`)).length).toBe(0);
  });

  it("kendine puan yok: davetli, davet edenin platform davetçisiyse 2. seviye yazılmaz", async () => {
    const [x, y] = await Promise.all([uye("x"), uye("y")]);
    await db.insert(schema.referrals).values({ inviterId: y.id, invitedId: x.id });
    await davetleAktive(y, ana, x.id); // Y, kendi getirdiği X'in davetiyle katılıyor
    expect((await ledger(x.id, "course_invite_activated")).length).toBe(1);
    expect((await ledger(y.id, "invite_second_level")).length).toBe(0);
  });

  it("genç davetli: 2. seviye bekleyene yazılır (ledger boş), olgunlaşınca bir kez kesinleşir", async () => {
    const genc = await uye("genc", 0);
    await davetleAktive(genc, ana, b.id);
    expect((await ledger(a.id, "invite_second_level", `u:${genc.id}`)).length).toBe(0);
    const bek = await db.query.pendingPoints.findFirst({
      where: and(eq(schema.pendingPoints.userId, a.id), eq(schema.pendingPoints.refId, `u:${genc.id}`)),
    });
    expect(bek).toMatchObject({ status: "pending", delta: 5, reason: "invite_second_level" });
    expect(bek!.maturesAt!.getTime()).toBeGreaterThan(Date.now());
    // Geriye dönük dağıtım yok: aktivasyon dışında hiçbir yol (bekleyen işleme) yeni 2. seviye satırı açmaz
    await rw.bekleyenleriIsle(new Date(), a.id);
    expect((await ledger(a.id, "invite_second_level")).length).toBe(1);
    await rw.bekleyenleriIsle(new Date(Date.now() + 25 * 3600e3), a.id);
    await rw.bekleyenleriIsle(new Date(Date.now() + 25 * 3600e3), a.id);
    expect((await ledger(a.id, "invite_second_level", `u:${genc.id}`)).map((r) => r.delta)).toEqual([5]);
  });

  it("AC-10: iki kursta aktivasyon — yalnız ERKEN aktivasyonun zinciri 2. seviye öder (üst davetçiler FARKLI; geç istek önce işlenir)", async () => {
    const [p2, a2, b2, g, e, z] = await Promise.all([uye("p2"), uye("a2"), uye("b2"), uye("g"), uye("e"), uye("z")]);
    const [{ kurs: k1 }, { kurs: k2 }] = [await kurs("ik1", p2.id), await kurs("ik2", p2.id)];
    await db.insert(schema.referrals).values([
      { inviterId: a2.id, invitedId: b2.id }, // a2 → b2 (platform); b2 z'yi k1'e davet eder
      { inviterId: g.id, invitedId: e.id }, // g → e (platform); e z'yi k2'ye davet eder
    ]);
    const [kod1, kod2] = [await dv.davetKoduUret(b2.id, k1.id), await dv.davetKoduUret(e.id, k2.id)];
    await dv.kursaKatil(z, k1, cerez(`course:${k1.id}:${kod1.id}`));
    await dv.kursaKatil(z, k2, cerez(`course:${k2.id}:${kod2.id}`));
    const katilim = async (k: Kurs) =>
      (await db.query.courseEnrollments.findFirst({ where: and(eq(schema.courseEnrollments.userId, z.id), eq(schema.courseEnrollments.courseId, k.id)) }))!;
    const [kt1, kt2] = [await katilim(k1), await katilim(k2)];
    // Eşzamanlı iki isteğin ikisi de aktivasyonu yazmış: k1 erken, k2 geç
    await db.update(schema.courseEnrollments).set({ activatedAt: new Date(Date.now() - 2000) }).where(eq(schema.courseEnrollments.id, kt1.id));
    await db.update(schema.courseEnrollments).set({ activatedAt: new Date(Date.now() - 1000) }).where(eq(schema.courseEnrollments.id, kt2.id));
    // Önce GEÇ olanın ödülleri işlenir: "ilk" aktivasyon işlem sırasına değil aktivasyon ANINA göre
    await dv.davetAktivasyonu(kt2, k2, z);
    await dv.davetAktivasyonu(kt1, k1, z);
    expect((await ledger(a2.id, "invite_second_level")).map((r) => [r.delta, r.refId])).toEqual([[5, `u:${z.id}`]]);
    expect((await ledger(g.id, "invite_second_level")).length).toBe(0);
    expect(await db.query.pendingPoints.findFirst({ where: and(eq(schema.pendingPoints.userId, g.id), eq(schema.pendingPoints.refId, `u:${z.id}`)) })).toBeUndefined();
    // Davet edenlerin kendi +15'i iki kursta da yazılır (2. seviye kuralı onları etkilemez)
    expect((await ledger(b2.id, "course_invite_activated")).length + (await ledger(e.id, "course_invite_activated")).length).toBe(2);
  });

  /* ---------------- F5-02: canlılık havuzu ---------------- */

  it("havuz: V=11,5 → 38 puan 50/30/20; üretici + davetçi aynı kişi TEK satır; ikinci koşum no-op", async () => {
    const hafta = ec.isoHafta(new Date(Date.now() - 21 * 864e5));
    const an = (gun: number, dk = 0) => new Date(hafta.baslangic.getTime() + gun * 864e5 + dk * 60e3);
    const [p, vd, ...u] = await Promise.all([uye("vp"), uye("vd"), ...[1, 2, 3, 4, 5, 6].map((i) => uye(`v${i}`))]);
    const { kurs: k, ogeler } = await kurs("canli", p!.id, 2);
    const [kodD, kodP] = [await dv.davetKoduUret(vd!.id, k.id), await dv.davetKoduUret(p!.id, k.id)];
    await db.insert(schema.courseEnrollments).values(
      u.map((x, i) => ({
        userId: x.id,
        courseId: k.id,
        joinedAt: an(-1),
        activatedAt: an(1),
        // u5 bitirdi (asgari süre: 2 öğe × 60 sn fazlasıyla geçti); u1 davetçinin, u2 üreticinin davetlisi
        completedAt: i === 4 ? an(2) : null,
        inviteCodeId: i === 0 ? kodD.id : i === 1 ? kodP.id : null,
      })),
    );
    await db.insert(schema.courseProgress).values(u.map((x, i) => ({ userId: x.id, courseId: k.id, itemId: ogeler[0]!, completedAt: an(1, i) })));
    const [yorum] = await db
      .insert(schema.comments)
      .values({ userId: u[2]!.id, courseItemId: ogeler[0]!, body: "itest cevap", createdAt: an(1) })
      .returning();
    await db.insert(schema.likes).values([
      { userId: u[3]!.id, commentId: yorum!.id, createdAt: an(2) },
      { userId: u[2]!.id, commentId: yorum!.id, createdAt: an(2) }, // kendi beğenisi sayılmaz
    ]);
    await db.insert(schema.courseResources).values({ courseId: k.id, userId: u[5]!.id, url: "https://example.com/itest", status: "accepted", acceptedAt: an(3) });
    // SAYILMAYANLAR (inceleme): üreticinin kendi kaynağı (otomatik kabul) ve kendi yorumu; işaretli hesabın
    // ilerlemesi, beğenisi ve davetliliği. Hiçbiri V'yi (11,5) ve payları değiştirmemeli.
    const isaretli = await uye("vf");
    await db.update(schema.users).set({ flaggedAt: new Date() }).where(eq(schema.users.id, isaretli.id));
    await db.insert(schema.courseResources).values(
      [1, 2, 3, 4, 5].map((i) => ({ courseId: k.id, userId: p!.id, url: `https://example.com/uretici-${i}`, status: "accepted" as const, acceptedAt: an(3) })),
    );
    const [ureticiYorumu] = await db.insert(schema.comments).values({ userId: p!.id, courseItemId: ogeler[0]!, body: "itest üretici", createdAt: an(1) }).returning();
    await db.insert(schema.likes).values([
      { userId: u[3]!.id, commentId: ureticiYorumu!.id, createdAt: an(2) },
      { userId: isaretli.id, commentId: yorum!.id, createdAt: an(2) },
    ]);
    await db.insert(schema.courseEnrollments).values({ userId: isaretli.id, courseId: k.id, joinedAt: an(-1), activatedAt: an(1), inviteCodeId: kodD.id });
    await db.insert(schema.courseProgress).values({ userId: isaretli.id, courseId: k.id, itemId: ogeler[0]!, completedAt: an(1, 30) });

    expect(ec.havuz(ec.canlilikV({ ilerleyen: 6, tamamlama: 1, begeniliYorum: 1, kaynak: 1 }))).toBe(38);
    expect(await ek.canlilikHavuzuDagit(hafta, [k.id])).toEqual({ kurs: 1, puan: 38 });
    const ref = `course:${k.id}:${hafta.etiket}`;
    // Üretici 20 (yarı + dilim artığı) + davet diliminden 3 + dilim içi artık 1 = 24, TEK satır
    expect((await ledger(p!.id, "vitality_pool")).map((r) => [r.delta, r.refId])).toEqual([[24, ref]]);
    expect((await ledger(vd!.id, "vitality_pool")).map((r) => r.delta)).toEqual([3]);
    expect((await ledger(u[2]!.id, "vitality_pool")).map((r) => r.delta)).toEqual([11]);
    // Cron yeniden koşarsa (kilit geri verildi) çift ödeme yok
    expect(await ek.canlilikHavuzuDagit(hafta, [k.id])).toEqual({ kurs: 1, puan: 0 });
    expect((await ledger(p!.id, "vitality_pool")).length).toBe(1);
    // Kişi başı haftalık tavan (kurs sayısıyla çarpılmasın): 200 − bu haftaki 3
    expect(await rw.awardPoints({ userId: vd!.id, delta: 500, reason: "vitality_pool", refId: `itest-tavan-${t}` })).toBe(197);
    // Hareketsiz hafta: V < 10 → havuz yok
    expect(await ek.canlilikHavuzuDagit(ec.isoHafta(new Date(Date.now() - 70 * 864e5)), [k.id])).toEqual({ kurs: 0, puan: 0 });
  });

  /* ---------------- F5-04: suistimal işareti ---------------- */

  it("tarama: eşik altı ve dağınık IP işaretlemez; kodla 24 saatte 5 yeni hesap + tek IP'den 5 ziyaret → işaret", async () => {
    davetci = await uye("sx", 30);
    const kod = await dv.davetKoduUret(davetci.id, ana.id);
    const ziyaret = (ip: string) => db.insert(schema.inviteVisits).values({ inviteCodeId: kod.id, ipHash: `itest-${ip}-${t}`, uaHash: "itest-ua", kanal: "link" });
    const kukla = async (i: number) => {
      const k = await uye(`sk${i}`, 0);
      await db.insert(schema.referrals).values({ inviterId: davetci.id, invitedId: k.id });
      await db.insert(schema.courseEnrollments).values({ userId: k.id, courseId: ana.id, inviteCodeId: kod.id });
      await ziyaret("kukla");
      return k;
    };
    for (const i of [1, 2, 3, 4]) kuklalar.push(await kukla(i));
    expect(await ek.suistimalTara(davetci.id)).toEqual([]);
    kuklalar.push(await kukla(5));
    // Başka IP'lerden gelen ziyaret (gerçek davetliler, davet edenin kendi tıklaması ya da üçüncü kişinin
    // curl döngüsü) yalnız IP EKLER: 5 hesap, 3 farklı IP (yarıyı geçer) → işaret yok
    for (const ip of ["a", "b"]) for (let i = 0; i < 6; i++) await ziyaret(ip);
    expect(await ek.suistimalTara(davetci.id)).toEqual([]);
    await db.delete(schema.inviteVisits).where(and(eq(schema.inviteVisits.inviteCodeId, kod.id), ne(schema.inviteVisits.ipHash, `itest-kukla-${t}`)));
    const isaretlenen = await ek.suistimalTara(davetci.id);
    expect(isaretlenen.map((r) => r.id).sort()).toEqual(kuklalar.map((k) => k.id).sort());
    expect(isaretlenen.every((r) => r.inviter_id === davetci.id)).toBe(true);
    const sonra = await db.query.users.findMany({ where: inArray(schema.users.id, kuklalar.map((k) => k.id)) });
    expect(sonra.every((k) => k.flaggedAt)).toBe(true);
    expect((await db.query.users.findFirst({ where: eq(schema.users.id, davetci.id) }))!.flaggedAt).toBeNull();
    expect(await ek.suistimalTara(davetci.id)).toEqual([]); // idempotent
  });

  it("işaretli KAYNAK ve ALICI: bekleyen olgunlaşmaz; işaret kalkınca kesinleşir", async () => {
    const [k1, k2] = kuklalar;
    const kursId = ana.id;
    const gecmis = new Date(Date.now() - 1000);
    // Kaynağı işaretli (refId sonu u:{k1}) davet puanı + işaretli alıcının kendi karşılama puanı
    await rw.bekleyenYaz({ userId: davetci.id, delta: 15, reason: "course_invite_activated", refId: `course:${kursId}:u:${k1!.id}`, maturesAt: gecmis });
    await rw.bekleyenYaz({ userId: k2!.id, delta: 10, reason: "course_invite_welcome", refId: `course:${kursId}`, maturesAt: gecmis });
    // Olgun (24 saatten yaşlı) ama işaretli hesaptan doğan olay da ledger'a değil bekleyene gider
    expect(
      await rw.puanOlayi({ userId: davetci.id, delta: 5, reason: "course_learner_activated", refId: `course:${kursId}:u:${k2!.id}`, kaynakOlusturulma: new Date(Date.now() - 30 * 864e5), kaynakIsaretli: true }),
    ).toBe(0);
    // ALICI işaretliyse olay, kaynak temiz ve yaşlı olsa da bekleyene gider (yaptırım kaynağın yaşına bağlı değil)
    expect(
      await rw.puanOlayi({ userId: k2!.id, delta: 7, reason: "answer_accepted", refId: `yorum:itest-${t}`, kaynakOlusturulma: new Date(Date.now() - 30 * 864e5) }),
    ).toBe(0);
    expect((await ledger(k2!.id, "answer_accepted")).length).toBe(0);
    expect(await rw.bekleyenleriIsle(new Date(), davetci.id)).toMatchObject({ kesinlesen: 0 });
    expect(await rw.bekleyenleriIsle(new Date(), k2!.id)).toMatchObject({ kesinlesen: 0 });
    expect((await ledger(davetci.id, "course_invite_activated")).length).toBe(0);

    const kuyruk = await ek.isaretliHesaplar();
    expect(kuyruk.find((r) => r.id === k2!.id)).toMatchObject({ davet_eden: davetci.handle, tutulan: 10 + 5 + 7 });

    await db.update(schema.users).set({ flaggedAt: null }).where(eq(schema.users.id, k1!.id));
    expect(await rw.bekleyenleriIsle(new Date(), davetci.id)).toMatchObject({ kesinlesen: 1 }); // k2 kaynaklı satır hâlâ bekler
    expect((await ledger(davetci.id, "course_invite_activated")).map((r) => r.delta)).toEqual([15]);
    expect((await ledger(davetci.id, "course_learner_activated")).length).toBe(0);
  });

  it("admin 'temiz' dediği hesabı tarama yeniden işaretlemez; işaretsiz bırakılan yeniden işaretlenir", async () => {
    const [k1, , k3] = kuklalar;
    // admin.ts flag_clear ile aynı iki adım
    await db.update(schema.users).set({ flaggedAt: null }).where(eq(schema.users.id, k3!.id));
    await cr.birKez(ek.SUISTIMAL_TEMIZ, String(k3!.id));
    const yeniden = await ek.suistimalTara(davetci.id);
    expect(yeniden.map((r) => r.id)).toEqual([k1!.id]); // önceki testte işareti (kayıtsız) kaldırılan
    expect((await db.query.users.findFirst({ where: eq(schema.users.id, k3!.id) }))!.flaggedAt).toBeNull();
  });

  it("işaretli üye lig sıralamasında görünmez", async () => {
    const isaretli = kuklalar[1];
    const temiz = await uye("lig");
    const [kulup] = await db
      .insert(schema.clubs)
      .values({ slug: `itest-f5-${t}`, name: "Itest F5 Kulübü", kind: "sehir", place: "Itest", il: "Ardahan", presidentId: temiz.id, status: "pending" })
      .returning();
    kulupId = kulup!.id;
    await db.insert(schema.clubMembers).values([
      { clubId: kulupId, userId: temiz.id, role: "president" },
      { clubId: kulupId, userId: isaretli!.id },
    ]);
    await rw.awardPoints({ userId: temiz.id, delta: 30, reason: "quiz", refId: `itest-lig-${t}` });
    await rw.awardPoints({ userId: isaretli!.id, delta: 90, reason: "quiz", refId: `itest-lig-${t}` });
    const pencere = [new Date(Date.now() - 864e5), new Date(Date.now() + 864e5)] as const;
    expect((await lg.kulupIciSiralama(kulupId, ...pencere)).map((r) => [r.userId, r.total])).toEqual([[temiz.id, 30]]);
    await db.update(schema.users).set({ flaggedAt: null }).where(eq(schema.users.id, isaretli!.id));
    expect((await lg.kulupIciSiralama(kulupId, ...pencere)).map((r) => r.userId)).toEqual([isaretli!.id, temiz.id]);
  });

  it("course_launched bekleyeni: işaretsiz aktif katılımcı eşiğin altındaysa bekler; admin 'suistimal' deyince düşer", async () => {
    const [k1, , , k4, k5] = kuklalar; // k1 (yeniden), k4, k5 işaretli
    const { kurs: kl } = await kurs("acilis", davetci.id);
    await db.insert(schema.courseEnrollments).values([k1!, k4!, k5!].map((k) => ({ userId: k.id, courseId: kl.id, activatedAt: new Date() })));
    const gecmis = new Date(Date.now() - 1000);
    await rw.bekleyenYaz({ userId: davetci.id, delta: 50, reason: "course_launched", refId: `course:${kl.id}`, maturesAt: gecmis });
    await rw.bekleyenleriIsle(new Date(), davetci.id);
    expect((await ledger(davetci.id, "course_launched")).length).toBe(0); // üç aktif katılımcının üçü de işaretli
    // Admin "Suistimal": k5'e ait ve ondan doğan bekleyenler düşer, işaret kalır
    await rw.bekleyenYaz({ userId: davetci.id, delta: 15, reason: "course_invite_activated", refId: `course:${kl.id}:u:${k5!.id}`, maturesAt: gecmis });
    await rw.bekleyenYaz({ userId: k5!.id, delta: 10, reason: "course_invite_welcome", refId: `course:${kl.id}`, maturesAt: gecmis });
    expect(await ek.bekleyenleriDusur(k5!.id)).toBe(2);
    expect((await db.query.users.findFirst({ where: eq(schema.users.id, k5!.id) }))!.flaggedAt).not.toBeNull();
    // İşaretler kalkınca (admin "Temiz") açılış puanı kesinleşir; düşürülen davet puanı GERİ GELMEZ
    await db.update(schema.users).set({ flaggedAt: null }).where(inArray(schema.users.id, [k1!.id, k4!.id, k5!.id]));
    await rw.bekleyenleriIsle(new Date(), davetci.id);
    expect((await ledger(davetci.id, "course_launched")).map((r) => r.delta)).toEqual([50]);
    expect((await ledger(davetci.id, "course_invite_activated", `course:${kl.id}:u:${k5!.id}`)).length).toBe(0);
  });

  it("hayalet bekleyen yok: ledger'da ÖDENMİŞ anahtar için işaretli alıcı ya da genç kaynak yeni bekleyen AÇMAZ (devir A2)", async () => {
    const [u, g] = await Promise.all([uye("hayalet"), uye("hayalet2")]);
    const yasli = new Date(Date.now() - 30 * 864e5);
    // (1) 09fc098'in alıcı-işaretli yolu: açılış 3 yaşlı hesapla ödenmiş; üretici sonradan işaretlenir ("Haklı");
    // 4. aktivasyon aynı anahtarı yeniden gönderir (egitim.ts `>=` bilinçli) → bekleyen açılmamalı
    const ref = `course:itest-hayalet-${t}`;
    expect(await rw.puanOlayi({ userId: u.id, delta: 50, reason: "course_launched", refId: ref, kaynakOlusturulma: yasli })).toBe(50);
    await db.update(schema.users).set({ flaggedAt: new Date() }).where(eq(schema.users.id, u.id));
    expect(await rw.puanOlayi({ userId: u.id, delta: 50, reason: "course_launched", refId: ref, kaynakOlusturulma: yasli })).toBe(0);
    expect(await db.query.pendingPoints.findMany({ where: and(eq(schema.pendingPoints.userId, u.id), eq(schema.pendingPoints.reason, "course_launched")) })).toEqual([]);
    expect((await ek.isaretliHesaplar()).find((r) => r.id === u.id)).toMatchObject({ tutulan: 0 }); // kuyrukta sahte "tutulan +50" yok
    expect((await ledger(u.id, "course_launched")).map((r) => r.delta)).toEqual([50]);
    await db.update(schema.users).set({ flaggedAt: null }).where(eq(schema.users.id, u.id));
    // (2) Faz 1'den beri var olan genç-kaynak yolu: ödenmiş açılıştan sonra 24 saatten genç 4. katılımcı
    const ref2 = `course:itest-hayalet2-${t}`;
    expect(await rw.awardPoints({ userId: g.id, delta: 50, reason: "course_launched", refId: ref2 })).toBe(50);
    expect(await rw.puanOlayi({ userId: g.id, delta: 50, reason: "course_launched", refId: ref2, kaynakOlusturulma: new Date() })).toBe(0);
    expect(await db.query.pendingPoints.findMany({ where: and(eq(schema.pendingPoints.userId, g.id), eq(schema.pendingPoints.refId, ref2)) })).toEqual([]);
    expect((await ledger(g.id, "course_launched")).length).toBe(1); // çift ödeme yok
  });

  it("A3 (karakterizasyon): işaretli 3. katılımcıya 'Suistimal' dense course_launched satırı süresiz pending kalır, kuyruk görmez; tek doğal çıkış 3. temiz katılımcı", async () => {
    const [ta, tb, tx, up] = await Promise.all([uye("ta", 30), uye("tb", 30), uye("tx", 0), uye("tup", 30)]);
    const { kurs: kt } = await kurs("takili", up.id);
    await db.insert(schema.courseEnrollments).values([ta, tb, tx].map((k) => ({ userId: k.id, courseId: kt.id, activatedAt: new Date() })));
    const ref = `course:${kt.id}`;
    // Gerçek yazım yolu: 3. katılımcı genç → bekleyen (expiresAt null doğar)
    expect(await rw.puanOlayi({ userId: up.id, delta: 50, reason: "course_launched", refId: ref, kaynakOlusturulma: tx.createdAt })).toBe(0);
    await db.update(schema.users).set({ flaggedAt: new Date() }).where(eq(schema.users.id, tx.id)); // ertesi sabah tarama
    await rw.bekleyenleriIsle(new Date(Date.now() + 365 * 864e5), up.id);
    expect((await ledger(up.id, "course_launched", ref)).length).toBe(0); // tutma çalışıyor: işaretsiz aktif 2 < 3
    expect((await ek.isaretliHesaplar()).find((r) => r.id === tx.id)).toMatchObject({ tutulan: 0 }); // kuyruk satırı görmez (refId'de u: yok)
    expect(await ek.bekleyenleriDusur(tx.id)).toBe(0); // admin "Suistimal" satıra dokunmaz
    expect(
      await db.query.pendingPoints.findFirst({ where: and(eq(schema.pendingPoints.userId, up.id), eq(schema.pendingPoints.reason, "course_launched"), eq(schema.pendingPoints.refId, ref)) }),
    ).toMatchObject({ status: "pending", expiresAt: null }); // bir yıl sonraki işlemeden sonra da pending: süresiz
    // Tek doğal çıkış: 3. temiz katılımcı aktive olur → sayı 3'e çıkar, satır kesinleşir
    const td = await uye("td", 30);
    await db.insert(schema.courseEnrollments).values({ userId: td.id, courseId: kt.id, activatedAt: new Date() });
    // matures_at = genç hesabın açılışı + 24 s: olgunlaşma da gerekir (devir tarifindeki `new Date()` erken — bir gün sonra)
    await rw.bekleyenleriIsle(new Date(Date.now() + 2 * 864e5), up.id);
    expect((await ledger(up.id, "course_launched", ref)).map((r) => r.delta)).toEqual([50]);
    await db.update(schema.users).set({ flaggedAt: null }).where(eq(schema.users.id, tx.id));
  });
  it.todo("A3 karar (#42): 'Suistimal' sonrası takılı course_launched satırının akıbeti — düşür + genç aktivasyonda yeniden aç, ya da etiket; ikisi de mevcut kuralla çarpışıyor (devir §2.5)");

  it("A1 (karakterizasyon): 'Temiz' sonrası toplu kesinleşme kesinleşme ANININ günlük tavanına sıkışır — 3 × 50 tutulan → 100 yazılır, bir satır confirmed / yazilan 0", async () => {
    const [p, s] = await Promise.all([uye("tp", 30), uye("ts", 30)]);
    await db.update(schema.users).set({ flaggedAt: new Date() }).where(eq(schema.users.id, s.id));
    // Üç ayrı günün olayı (her biri tek başına günlük 100'ün altında): işaretli kaynak → tutulur
    for (const i of [1, 2, 3])
      expect(
        await rw.puanOlayi({ userId: p.id, delta: 50, reason: "course_learner_completed", refId: `course:${900000 + i}:u:${s.id}`, kaynakOlusturulma: s.createdAt, kaynakIsaretli: true }),
      ).toBe(0);
    expect(await rw.bekleyenleriIsle(new Date(), p.id)).toMatchObject({ kesinlesen: 0 });
    await db.update(schema.users).set({ flaggedAt: null }).where(eq(schema.users.id, s.id)); // admin "Temiz"
    expect(await rw.bekleyenleriIsle(new Date(), p.id)).toMatchObject({ kesinlesen: 3 });
    const satirlar = await db.query.pendingPoints.findMany({ where: and(eq(schema.pendingPoints.userId, p.id), eq(schema.pendingPoints.reason, "course_learner_completed")) });
    expect(satirlar.map((r) => r.status)).toEqual(["confirmed", "confirmed", "confirmed"]);
    expect(satirlar.map((r) => r.yazilan).sort()).toEqual([0, 50, 50]); // üçüncü satır tavana takıldı, puansız kapandı
    expect((await ledger(p.id, "course_learner_completed")).reduce((t, r) => t + r.delta, 0)).toBe(100); // işaret olmasaydı 150
  });
  it.todo("A1 karar (#42): tutulan satır tavana takılınca pending kalsın mı / pencere olay tarihinden mi kurulsun — ADR K2 'kırpılan geri kazanılmaz' ve etkinlik-db:463-472 ile çarpışır (devir §2.1–2.2)");

  /* ---------------- F5-03: ekonomi kartı ---------------- */

  it("ekonomi kartı: tek satır, sayısal alanlar, test verisi sayılır", async () => {
    const k = await ek.ekonomiKarti();
    for (const alan of ["basilan", "aktif", "davet", "kesinlesen", "kirpilan", "dusen", "bekleyen", "kursKatilim", "kursAktif", "kursBiten", "etkinlikKayit", "etkinlikGiris"] as const)
      expect(k[alan], alan).toEqual(expect.any(Number));
    expect(k.kaynaklar.find((r) => r.reason === "vitality_pool")!.puan).toBeGreaterThanOrEqual(38);
    expect(k.kaynaklar.map((r) => r.puan)).toEqual([...k.kaynaklar.map((r) => r.puan)].sort((x, y) => y - x));
    expect(k.kaynaklar.reduce((s, r) => s + r.puan, 0)).toBe(k.basilan);
    expect(k.davet).toBeGreaterThanOrEqual(15 + 5); // bu koşumun davet puanları
    expect(k.davet).toBeLessThanOrEqual(k.basilan);
    expect(k.kursKatilim).toBeGreaterThanOrEqual(k.kursAktif);
    expect(k.kesinlesen).toBeGreaterThanOrEqual(k.kirpilan);
    const o = ec.ekonomiOzeti(k);
    expect(o.davetPayi).toBeGreaterThan(0);
    expect(o.davetPayi).toBeLessThanOrEqual(1);
  });
});
