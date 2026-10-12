/**
 * Rota düzeyi — gerçek DB: api/uye/admin.ts (yetki kapısı; flag_clear / flag_confirm; "Haklı" → işaret) ve
 * api/uye/egitim.ts (davetle katıl → ilk öğe → davet zinciri; course_launched eşiği işaretliyi saymaz;
 * onay bekleyen topluluğun kursu yayınlanmaz). Rotanın POST'u sahte context ile çağrılır: locals.auth()
 * geçici üyenin clerk_id'sini döner (satır ÖNCEDEN açılır — getOrCreateMember yeni üye + karşılama yazmasın),
 * çerezler isteğe bağlı, redirect 303. Admin dalları: getOrCreateMember kısmi vi.mock ile sahte admin
 * NESNESİ döner — DB'de admin satırı AÇILMAZ. Yalnız POSTGRES_URL_TEST ile koşar; kendi kayıtlarını siler.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, like, or } from "drizzle-orm";
import { PUAN } from "@/lib/points.ts";

const URL = process.env.POSTGRES_URL_TEST;
const h = vi.hoisted(() => ({ adminMi: false }));
vi.mock("@/lib/member.ts", async (orig) => {
  const m = await orig<typeof import("@/lib/member.ts")>();
  return {
    ...m,
    getOrCreateMember: async (ctx: Parameters<typeof m.getOrCreateMember>[0]) => {
      const u = await m.getOrCreateMember(ctx);
      return u && h.adminMi ? { ...u, role: "admin" as const } : u;
    },
  };
});

describe.skipIf(!URL)("rotalar — gerçek DB", { timeout: 180_000 }, () => {
  type Db = typeof import("@/db/client.ts");
  let db: Db["db"], schema: Db["schema"];
  let dv: typeof import("@/lib/davet.ts");
  let rw: typeof import("@/lib/rewards.ts");
  let ek: typeof import("@/lib/ekonomi.ts");
  let admin: typeof import("@/pages/api/uye/admin.ts");
  let egitim: typeof import("@/pages/api/uye/egitim.ts");
  let member: typeof import("@/lib/member.ts");
  let kampanya: typeof import("@/pages/api/uye/kampanya.ts");
  let gorev: typeof import("@/pages/api/uye/gorev.ts");
  type Uye = Db["schema"]["users"]["$inferSelect"];
  const uyeler: number[] = [];
  const kurslar: number[] = [];
  const kulupler: number[] = [];
  const t = Date.now().toString(36);
  const VIDEO = "https://www.youtube.com/watch?v=446E-r0rXHI";

  async function uye(ad: string, gunOnce = 30): Promise<Uye> {
    const [u] = await db
      .insert(schema.users)
      .values({ clerkId: `demo_itest_rt_${ad}_${t}`, handle: `itest-rt-${ad}-${t}`, name: `Itest ${ad}`, createdAt: new Date(Date.now() - gunOnce * 864e5) })
      .returning();
    uyeler.push(u!.id);
    return u!;
  }
  async function kurs(ad: string, ureticiId: number) {
    const [k] = await db
      .insert(schema.courses)
      .values({ slug: `itest-rt-${ad}-${t}`, title: `Itest RT ${ad}`, createdBy: ureticiId, status: "published" })
      .returning();
    kurslar.push(k!.id);
    const [oge] = await db
      .insert(schema.courseItems)
      .values({ courseId: k!.id, order: 0, kind: "youtube", title: "v0", youtubeId: "446E-r0rXHI" })
      .returning({ id: schema.courseItems.id });
    return { kurs: k!, ogeId: oge!.id };
  }
  /** Rotanın POST'u için sahte Astro bağlamı */
  const baglam = (u: Uye, form: Record<string, string>, cerezler: Record<string, string> = {}) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(form)) fd.set(k, v);
    return {
      locals: { auth: () => ({ userId: u.clerkId }), currentUser: async () => null },
      cookies: { get: (ad: string) => (cerezler[ad] ? { value: cerezler[ad] } : undefined), delete() {} },
      request: new Request("http://localhost/api/uye/x", { method: "POST", body: fd }),
      redirect: (yol: string) => new Response(null, { status: 303, headers: { location: yol } }),
    } as never;
  };
  const kullanici = (id: number) => db.query.users.findFirst({ where: eq(schema.users.id, id) });
  const ledger = async (userId: number, reason: string, refId?: string) =>
    (await db.query.pointsLedger.findMany({ where: and(eq(schema.pointsLedger.userId, userId), eq(schema.pointsLedger.reason, reason as never)) })).filter(
      (r) => refId === undefined || r.refId === refId,
    );
  const bekleyen = (userId: number, reason: string, refId: string) =>
    db.query.pendingPoints.findFirst({ where: and(eq(schema.pendingPoints.userId, userId), eq(schema.pendingPoints.reason, reason), eq(schema.pendingPoints.refId, refId)) });
  const katilim = (userId: number, courseId: number) =>
    db.query.courseEnrollments.findFirst({ where: and(eq(schema.courseEnrollments.userId, userId), eq(schema.courseEnrollments.courseId, courseId)) });

  beforeAll(async () => {
    process.env.POSTGRES_URL = URL;
    ({ db, schema } = await import("@/db/client.ts"));
    dv = await import("@/lib/davet.ts");
    rw = await import("@/lib/rewards.ts");
    ek = await import("@/lib/ekonomi.ts");
    admin = await import("@/pages/api/uye/admin.ts");
    egitim = await import("@/pages/api/uye/egitim.ts");
    member = await import("@/lib/member.ts");
    kampanya = await import("@/pages/api/uye/kampanya.ts");
    gorev = await import("@/pages/api/uye/gorev.ts");
  }, 60_000);

  afterAll(async () => {
    h.adminMi = false;
    if (uyeler.length === 0) return;
    // Rotanın açtığı kurslar (slug rastgele sonekli) + elle açılanlar
    const rotaKurslari = await db.query.courses.findMany({ where: inArray(schema.courses.createdBy, uyeler), columns: { id: true } });
    const tumKurslar = [...new Set([...kurslar, ...rotaKurslari.map((k) => k.id)])];
    if (tumKurslar.length) {
      const kursKodu = and(eq(schema.inviteCodes.targetType, "course"), inArray(schema.inviteCodes.targetId, tumKurslar));
      const kodlar = await db.query.inviteCodes.findMany({ where: kursKodu });
      if (kodlar.length) await db.delete(schema.inviteVisits).where(inArray(schema.inviteVisits.inviteCodeId, kodlar.map((k) => k.id)));
      await db.delete(schema.courseProgress).where(inArray(schema.courseProgress.courseId, tumKurslar));
      await db.delete(schema.courseEnrollments).where(inArray(schema.courseEnrollments.courseId, tumKurslar));
      await db.delete(schema.inviteCodes).where(kursKodu);
      await db.delete(schema.courseItems).where(inArray(schema.courseItems.courseId, tumKurslar));
      await db.delete(schema.courses).where(inArray(schema.courses.id, tumKurslar));
    }
    if (kulupler.length) {
      const kampanyalar = await db.query.campaigns.findMany({ where: inArray(schema.campaigns.clubId, kulupler), columns: { id: true } });
      if (kampanyalar.length) {
        await db.delete(schema.campaignTasks).where(inArray(schema.campaignTasks.campaignId, kampanyalar.map((k) => k.id)));
        await db.delete(schema.campaigns).where(inArray(schema.campaigns.id, kampanyalar.map((k) => k.id)));
      }
      await db.delete(schema.clubMembers).where(inArray(schema.clubMembers.clubId, kulupler));
      await db.delete(schema.clubs).where(inArray(schema.clubs.id, kulupler));
    }
    await db.delete(schema.messages).where(or(inArray(schema.messages.senderId, uyeler), inArray(schema.messages.recipientId, uyeler)));
    await db.delete(schema.referrals).where(or(inArray(schema.referrals.invitedId, uyeler), inArray(schema.referrals.inviterId, uyeler)));
    await db.delete(schema.cronRuns).where(and(eq(schema.cronRuns.job, ek.SUISTIMAL_TEMIZ), inArray(schema.cronRuns.periodKey, uyeler.map(String))));
    for (const tbl of [schema.pendingPoints, schema.notifications, schema.badges, schema.bookAccess, schema.pointsLedger])
      await db.delete(tbl).where(inArray(tbl.userId, uyeler));
    await db.delete(schema.users).where(inArray(schema.users.id, uyeler));
  }, 60_000);

  /* ---------------- api/uye/admin.ts ---------------- */

  it("yetki kapısı: admin OLMAYAN üye flag_clear / flag_confirm / report_remove → 403, hiçbir satır değişmez", async () => {
    const [uyeX, hedef, temiz] = await Promise.all([uye("x"), uye("hedef"), uye("temiz")]);
    await db.update(schema.users).set({ flaggedAt: new Date() }).where(eq(schema.users.id, hedef.id));
    await rw.bekleyenYaz({ userId: hedef.id, delta: 10, reason: "course_invite_welcome", refId: `course:itest-rt-${t}`, maturesAt: new Date() });
    h.adminMi = false;
    expect((await admin.POST(baglam(uyeX, { action: "flag_clear", userId: String(hedef.id) }))).status).toBe(403);
    expect((await admin.POST(baglam(uyeX, { action: "flag_confirm", userId: String(hedef.id) }))).status).toBe(403);
    expect((await admin.POST(baglam(uyeX, { action: "report_remove", reportTarget: "user", reportTargetId: String(temiz.id) }))).status).toBe(403);
    expect((await kullanici(hedef.id))!.flaggedAt).not.toBeNull();
    expect((await kullanici(temiz.id))!.flaggedAt).toBeNull();
    expect((await bekleyen(hedef.id, "course_invite_welcome", `course:itest-rt-${t}`))!.status).toBe("pending");
    expect(await db.query.cronRuns.findFirst({ where: and(eq(schema.cronRuns.job, ek.SUISTIMAL_TEMIZ), eq(schema.cronRuns.periodKey, String(hedef.id))) })).toBeUndefined();
    // Hazırlık: sonraki testlerde hedef işaretli kalır
  });

  it("admin flag_clear: işaret kalkar, suistimal-temiz kaydı yazılır (tarama yeniden işaretlemez); tutulan bekleyen sonraki işlemede kesinleşir", async () => {
    const [yonetici, hedef] = await Promise.all([uye("y1"), uye("h1")]);
    await db.update(schema.users).set({ flaggedAt: new Date() }).where(eq(schema.users.id, hedef.id));
    await rw.bekleyenYaz({ userId: hedef.id, delta: 10, reason: "course_invite_welcome", refId: `course:itest-rt-h1-${t}`, maturesAt: new Date(Date.now() - 1000) });
    expect(await rw.bekleyenleriIsle(new Date(), hedef.id)).toMatchObject({ kesinlesen: 0 }); // işaretliyken tutulur
    h.adminMi = true;
    try {
      const r = await admin.POST(baglam(yonetici, { action: "flag_clear", userId: String(hedef.id) }));
      expect(r.status).toBe(303);
      expect(r.headers.get("location")).toBe("/uye/admin");
    } finally {
      h.adminMi = false;
    }
    expect((await kullanici(hedef.id))!.flaggedAt).toBeNull();
    expect(await db.query.cronRuns.findFirst({ where: and(eq(schema.cronRuns.job, ek.SUISTIMAL_TEMIZ), eq(schema.cronRuns.periodKey, String(hedef.id))) })).toBeDefined();
    expect(await rw.bekleyenleriIsle(new Date(), hedef.id)).toMatchObject({ kesinlesen: 1 });
    expect((await ledger(hedef.id, "course_invite_welcome")).map((r) => r.delta)).toEqual([10]);
  });

  it("admin flag_confirm: YALNIZ işaretli hesapta — işaretsiz hedefin bekleyeni düşmez; işaretli hedefin kendi + ondan doğan bekleyenleri düşer, işaret kalır", async () => {
    const [yonetici, temiz, isaretli, alici] = await Promise.all([uye("y2"), uye("t2"), uye("i2"), uye("a2")]);
    await db.update(schema.users).set({ flaggedAt: new Date() }).where(eq(schema.users.id, isaretli.id));
    const ref = `course:itest-rt-2-${t}`;
    await rw.bekleyenYaz({ userId: temiz.id, delta: 10, reason: "course_invite_welcome", refId: ref, maturesAt: new Date() });
    await rw.bekleyenYaz({ userId: isaretli.id, delta: 10, reason: "course_invite_welcome", refId: ref, maturesAt: new Date() });
    await rw.bekleyenYaz({ userId: alici.id, delta: 15, reason: "course_invite_activated", refId: `${ref}:u:${isaretli.id}`, maturesAt: new Date() });
    await rw.bekleyenYaz({ userId: alici.id, delta: 15, reason: "course_invite_activated", refId: `${ref}:u:${temiz.id}`, maturesAt: new Date() });
    h.adminMi = true;
    try {
      expect((await admin.POST(baglam(yonetici, { action: "flag_confirm", userId: String(temiz.id) }))).status).toBe(303); // işaretsiz: kapı
      expect((await bekleyen(temiz.id, "course_invite_welcome", ref))!.status).toBe("pending");
      expect((await bekleyen(alici.id, "course_invite_activated", `${ref}:u:${temiz.id}`))!.status).toBe("pending");
      expect((await admin.POST(baglam(yonetici, { action: "flag_confirm", userId: String(isaretli.id) }))).status).toBe(303);
    } finally {
      h.adminMi = false;
    }
    expect((await bekleyen(isaretli.id, "course_invite_welcome", ref))!.status).toBe("expired");
    expect((await bekleyen(alici.id, "course_invite_activated", `${ref}:u:${isaretli.id}`))!.status).toBe("expired");
    expect((await bekleyen(alici.id, "course_invite_activated", `${ref}:u:${temiz.id}`))!.status).toBe("pending"); // başkasının kaynağı dokunulmaz
    expect((await kullanici(isaretli.id))!.flaggedAt).not.toBeNull(); // işaret KALIR
  });

  it("admin 'Haklı' (report_remove): üye şikâyetinde hedef işaretlenir (rep rolü dahil); mesaj şikâyetinde GÖNDEREN işaretlenir; alıcı değişmez", async () => {
    const [yonetici, hedef, rep, gonderen, alici] = await Promise.all([uye("y3"), uye("h3"), uye("r3"), uye("g3"), uye("al3")]);
    await db.update(schema.users).set({ role: "rep" }).where(eq(schema.users.id, rep.id));
    const [mesaj] = await db.insert(schema.messages).values({ senderId: gonderen.id, recipientId: alici.id, body: "itest" }).returning();
    h.adminMi = true;
    try {
      for (const [tur, id] of [["user", hedef.id], ["user", rep.id], ["message", mesaj!.id]] as const)
        expect((await admin.POST(baglam(yonetici, { action: "report_remove", reportTarget: tur, reportTargetId: String(id) }))).status).toBe(303);
    } finally {
      h.adminMi = false;
    }
    expect((await kullanici(hedef.id))!.flaggedAt).not.toBeNull();
    expect((await kullanici(rep.id))!.flaggedAt).not.toBeNull();
    expect((await kullanici(gonderen.id))!.flaggedAt).not.toBeNull();
    expect((await kullanici(alici.id))!.flaggedAt).toBeNull();
    expect((await kullanici(yonetici.id))!.flaggedAt).toBeNull();
  });

  /* ---------------- getOrCreateMember: platform daveti ---------------- */

  it("referral_joined (kapandı): davetle kayıt → davet edene +25 ANINDA değil 24 saat bekleyene (refId u:{yeni}); yeni hesap işaretlenirse tutulur; olgunlaşınca bir kez kesinleşir", async () => {
    const davetEden = await uye("rj-d");
    const clerkId = `demo_itest_rt_yeni_${t}`;
    const ctx = {
      locals: {
        auth: () => ({ userId: clerkId }),
        currentUser: async () => ({ fullName: "Itest Yeni", username: null, primaryEmailAddress: { emailAddress: "itest-yeni@example.com" }, imageUrl: null }),
      },
      cookies: { get: (ad: string) => (ad === "ysf_ref" ? { value: davetEden.handle } : undefined), delete() {} },
    } as never;
    const yeni = (await member.getOrCreateMember(ctx))!;
    uyeler.push(yeni.id);
    expect(yeni.clerkId).toBe(clerkId);
    expect(await db.query.referrals.findFirst({ where: and(eq(schema.referrals.inviterId, davetEden.id), eq(schema.referrals.invitedId, yeni.id)) })).toBeDefined();
    expect(await ledger(davetEden.id, "referral_joined")).toHaveLength(0); // anında değil
    const b = await bekleyen(davetEden.id, "referral_joined", `u:${yeni.id}`);
    expect(b).toMatchObject({ status: "pending", delta: PUAN.referralJoined });
    expect(b!.maturesAt!.getTime()).toBeGreaterThan(Date.now() + 23 * 3600e3);
    expect(await rw.bekleyenleriIsle(new Date(), davetEden.id)).toMatchObject({ kesinlesen: 0 }); // henüz olgun değil
    // Ertesi sabah tarama / "Haklı" yeni hesabı işaretlerse satır tutulur (refId sonu u:{yeni})
    await db.update(schema.users).set({ flaggedAt: new Date() }).where(eq(schema.users.id, yeni.id));
    expect(await rw.bekleyenleriIsle(new Date(Date.now() + 25 * 3600e3), davetEden.id)).toMatchObject({ kesinlesen: 0 });
    await db.update(schema.users).set({ flaggedAt: null }).where(eq(schema.users.id, yeni.id));
    expect(await rw.bekleyenleriIsle(new Date(Date.now() + 25 * 3600e3), davetEden.id)).toMatchObject({ kesinlesen: 1 });
    expect((await ledger(davetEden.id, "referral_joined", `u:${yeni.id}`)).map((r) => r.delta)).toEqual([PUAN.referralJoined]);
    expect((await ledger(yeni.id, "welcome")).map((r) => r.delta)).toEqual([PUAN.welcome]); // yeni üyenin karşılaması değişmedi
  });

  /* ---------------- api/uye/kampanya.ts + gorev.ts (C2) ---------------- */

  it("C2 (kapandı): onay bekleyen toplulukta kampanya açılamaz (403); topluluk onaylanınca zincir çalışır ve ÜYEYE task_done yazılır", async () => {
    const [baskan, uyeK] = await Promise.all([uye("c2-b"), uye("c2-u")]);
    const [kulup] = await db
      .insert(schema.clubs)
      .values({ slug: `itest-rt-c2-${t}`, name: "Itest RT C2", kind: "sehir", place: "Itest", il: "Ardahan", presidentId: baskan.id, status: "pending" })
      .returning();
    kulupler.push(kulup!.id);
    await db.insert(schema.clubMembers).values([
      { clubId: kulup!.id, userId: baskan.id, role: "president" },
      { clubId: kulup!.id, userId: uyeK.id },
    ]);
    const kampanyaAc = () => kampanya.POST(baglam(baskan, { clubId: String(kulup!.id), title: "Itest C2 kampanya", bookId: "itest-kitap" }));
    expect((await kampanyaAc()).status).toBe(403); // onay bekleyen topluluk
    expect(await db.query.campaigns.findFirst({ where: eq(schema.campaigns.clubId, kulup!.id) })).toBeUndefined();
    h.adminMi = true; // admin her kulüpte başkan: onay bekleyen toplulukta da açabilir (kurs / etkinlik kuralıyla aynı)
    try {
      expect((await kampanyaAc()).status).toBe(303);
    } finally {
      h.adminMi = false;
    }
    await db.update(schema.clubs).set({ status: "approved" }).where(eq(schema.clubs.id, kulup!.id));
    const r1 = await kampanyaAc();
    expect(r1.status).toBe(303);
    const kampanyaId = Number(r1.headers.get("location")!.split("/").pop());
    expect((await gorev.POST(baglam(baskan, { action: "create", campaignId: String(kampanyaId), title: "Itest görev", rewardPoints: "20" }))).status).toBe(303);
    const task = (await db.query.campaignTasks.findFirst({ where: eq(schema.campaignTasks.campaignId, kampanyaId) }))!;
    for (const [kim, form] of [
      [uyeK, { action: "claim", taskId: String(task.id) }],
      [uyeK, { action: "submit", taskId: String(task.id), url: "https://example.com/itest-c2" }],
      [baskan, { action: "approve", taskId: String(task.id) }],
    ] as const) {
      const r = await gorev.POST(baglam(kim, form));
      expect(r.status, form.action).toBe(303);
      expect(r.headers.get("location"), form.action).toBe(`/kampanya/${kampanyaId}`);
    }
    expect((await db.query.campaignTasks.findFirst({ where: eq(schema.campaignTasks.id, task.id) }))!.status).toBe("done");
    expect((await ledger(uyeK.id, "task_done", String(task.id))).map((r) => r.delta)).toEqual([Math.round(20 * PUAN.campaignMultiplier)]);
  });

  it("C2b (kapandı): başkan KENDİ görevini onaylayamaz (görev review'da kalır, ledger boş); mod onaylayınca yazılır, kişi başı 7 günlük görev tavanı kırpar", async () => {
    const [baskan, mod] = await Promise.all([uye("c2b"), uye("c2b-m")]);
    const [kulup] = await db
      .insert(schema.clubs)
      .values({ slug: `itest-rt-c2b-${t}`, name: "Itest RT C2b", kind: "sehir", place: "Itest", il: "Ardahan", presidentId: baskan.id, status: "approved" })
      .returning();
    kulupler.push(kulup!.id);
    await db.insert(schema.clubMembers).values([
      { clubId: kulup!.id, userId: baskan.id, role: "president" },
      { clubId: kulup!.id, userId: mod.id, role: "mod" },
    ]);
    const r1 = await kampanya.POST(baglam(baskan, { clubId: String(kulup!.id), title: "Itest C2b kampanya", bookId: "itest-kitap" }));
    const kampanyaId = Number(r1.headers.get("location")!.split("/").pop());
    expect((await gorev.POST(baglam(baskan, { action: "create", campaignId: String(kampanyaId), title: "Itest kendi görevi", rewardPoints: "500" }))).status).toBe(303);
    const task = (await db.query.campaignTasks.findFirst({ where: eq(schema.campaignTasks.campaignId, kampanyaId) }))!;
    const adimlar: Record<string, string>[] = [
      { action: "claim", taskId: String(task.id) },
      { action: "submit", taskId: String(task.id), url: "https://example.com/itest-c2b" },
      { action: "approve", taskId: String(task.id) }, // kendine onay: sessizce geri döner
    ];
    for (const form of adimlar)
      expect((await gorev.POST(baglam(baskan, form))).headers.get("location"), form.action).toBe(`/kampanya/${kampanyaId}`);
    expect((await db.query.campaignTasks.findFirst({ where: eq(schema.campaignTasks.id, task.id) }))!.status).toBe("review");
    expect((await ledger(baskan.id, "task_done")).length).toBe(0);
    // Mod (atanan değil) onaylar → yazılır; kişi başı kayan 7 gün tavanı 1000: 750 + ikinci görevde kalan 250
    expect((await gorev.POST(baglam(mod, { action: "approve", taskId: String(task.id) }))).status).toBe(303);
    expect((await ledger(baskan.id, "task_done", String(task.id))).map((r) => r.delta)).toEqual([Math.round(500 * PUAN.campaignMultiplier)]);
    expect(await rw.awardPoints({ userId: baskan.id, delta: 750, reason: "task_done", refId: `itest-rt-c2b-2-${t}` })).toBe(PUAN.taskWeeklyCap - 750);
    expect(await rw.awardPoints({ userId: baskan.id, delta: 10, reason: "task_done", refId: `itest-rt-c2b-3-${t}` })).toBe(0);
  });

  /* ---------------- api/uye/egitim.ts ---------------- */

  it("davetle katıl → ilk öğe (rota): aktivasyon yazılır, davet eden +15, üst davetçi +5, davetli +10, üretici +5; ikinci tamamlama idempotent", async () => {
    const [uretici, ust, davetEden, davetli] = await Promise.all([uye("ur"), uye("ust"), uye("de"), uye("dl")]);
    await db.insert(schema.referrals).values({ inviterId: ust.id, invitedId: davetEden.id });
    const { kurs: k, ogeId } = await kurs("davet", uretici.id);
    const kod = await dv.davetKoduUret(davetEden.id, k.id);
    const r1 = await egitim.POST(baglam(davetli, { action: "join", courseId: String(k.id) }, { [dv.DAVET_CEREZ]: `course:${k.id}:${kod.id}` }));
    expect(r1.status).toBe(303);
    expect(r1.headers.get("location")).toContain("katildin=1");
    expect(r1.headers.get("location")).toContain("davet=1");
    expect((await katilim(davetli.id, k.id))!.inviteCodeId).toBe(kod.id);
    const r2 = await egitim.POST(baglam(davetli, { action: "complete", itemId: String(ogeId) }));
    expect(r2.status).toBe(303);
    expect((await katilim(davetli.id, k.id))!.activatedAt).not.toBeNull();
    expect((await ledger(davetEden.id, "course_invite_activated", `course:${k.id}:u:${davetli.id}`)).map((r) => r.delta)).toEqual([15]);
    expect((await ledger(ust.id, "invite_second_level", `u:${davetli.id}`)).map((r) => r.delta)).toEqual([5]);
    expect((await ledger(davetli.id, "course_invite_welcome", `course:${k.id}`)).map((r) => r.delta)).toEqual([10]);
    expect((await ledger(uretici.id, "course_learner_activated", `course:${k.id}:u:${davetli.id}`)).map((r) => r.delta)).toEqual([5]);
    expect((await egitim.POST(baglam(davetli, { action: "complete", itemId: String(ogeId) }))).status).toBe(303); // yeniden
    expect((await ledger(davetEden.id, "course_invite_activated")).length).toBe(1);
    expect((await ledger(uretici.id, "course_learner_activated")).length).toBe(1);
  });

  it("course_launched eşiği (rota): işaretli katılımcı sayılmaz — +50 3. İŞARETSİZ aktivasyonda; işaretli katılımcının aktivasyon puanı bekleyende tutulur", async () => {
    const [uretici, x1, x2, x3, x4] = await Promise.all([uye("ur2"), uye("x1"), uye("x2"), uye("x3"), uye("x4")]);
    await db.update(schema.users).set({ flaggedAt: new Date() }).where(eq(schema.users.id, x1.id));
    const { kurs: k, ogeId } = await kurs("acilis", uretici.id);
    const tamamla = async (u: Uye) => {
      expect((await egitim.POST(baglam(u, { action: "join", courseId: String(k.id) }))).status).toBe(303);
      expect((await egitim.POST(baglam(u, { action: "complete", itemId: String(ogeId) }))).status).toBe(303);
      return (await ledger(uretici.id, "course_launched", `course:${k.id}`)).length;
    };
    expect(await tamamla(x1)).toBe(0); // işaretli: eşiğe sayılmaz
    expect((await ledger(uretici.id, "course_learner_activated", `course:${k.id}:u:${x1.id}`)).length).toBe(0);
    expect(await bekleyen(uretici.id, "course_learner_activated", `course:${k.id}:u:${x1.id}`)).toMatchObject({ status: "pending", delta: 5 });
    expect(await tamamla(x2)).toBe(0);
    expect(await tamamla(x3)).toBe(0); // işaretsiz 2 < 3
    expect(await tamamla(x4)).toBe(1); // işaretsiz 3 → +50 (en genç işaretsiz 30 günlük → doğrudan ledger)
    expect((await ledger(uretici.id, "course_launched", `course:${k.id}`)).map((r) => r.delta)).toEqual([50]);
    // Ödemeden SONRA 24 saatten genç 5. katılımcı: eşik yeniden gönderilir (>=), ledger'da anahtar var → hayalet yok (A2)
    expect(await tamamla(await uye("x5", 0))).toBe(1);
    expect(await bekleyen(uretici.id, "course_launched", `course:${k.id}`)).toBeUndefined();
  });

  it("onayliKulupMu (rota create): onay bekleyen topluluğun başkanı kurs açar → pending (?onay=1); topluluk onaylanınca → published (?yayin=1)", async () => {
    const baskan = await uye("bask");
    const [kulup] = await db
      .insert(schema.clubs)
      .values({ slug: `itest-rt-kulup-${t}`, name: "Itest RT Kulübü", kind: "sehir", place: "Itest", il: "Ardahan", presidentId: baskan.id, status: "pending" })
      .returning();
    kulupler.push(kulup!.id);
    await db.insert(schema.clubMembers).values({ clubId: kulup!.id, userId: baskan.id, role: "president" });
    const form = (ad: string) => ({
      title: `Itest rota ${ad}`,
      clubId: String(kulup!.id),
      i_0_kind: "youtube", i_0_url: VIDEO, i_1_kind: "youtube", i_1_url: VIDEO, i_2_kind: "youtube", i_2_url: VIDEO,
    });
    const r1 = await egitim.POST(baglam(baskan, form("bekleyen")));
    expect(r1.status).toBe(303);
    expect(r1.headers.get("location")).toMatch(/\?onay=1$/);
    const k1 = await db.query.courses.findFirst({ where: and(eq(schema.courses.createdBy, baskan.id), like(schema.courses.title, "Itest rota bekleyen")) });
    expect(k1).toMatchObject({ status: "pending", clubId: kulup!.id });
    await db.update(schema.clubs).set({ status: "approved" }).where(eq(schema.clubs.id, kulup!.id));
    const r2 = await egitim.POST(baglam(baskan, form("onayli")));
    expect(r2.headers.get("location")).toMatch(/\?yayin=1$/);
    const k2 = await db.query.courses.findFirst({ where: and(eq(schema.courses.createdBy, baskan.id), like(schema.courses.title, "Itest rota onayli")) });
    expect(k2).toMatchObject({ status: "published", clubId: kulup!.id });
  });
});
