/**
 * Etkinlik — gerçek DB (Faz 3): kapasite yarışı, kayıt kapanışı, ⭐ koltuk, görevli sınırı;
 * etkinlik daveti atfı, bekleyen ve bitişte düşme (AC-19), düzenleyen davet puanı almaz (AC-20);
 * giriş doğrulaması: RSVP puansız (AC-15), tekrar okutma (AC-16), paralel/çift gönderim (AC-18);
 * dönen QR (AC-17); etkinlik sonrası: düzenleyen payı (101 giriş → 500; 166/166/168), cron no-op,
 * değerlendirme ve iyi değerlendirme ödülü.
 * Yalnız POSTGRES_URL_TEST ile koşar; kendi geçici üyelerini/etkinliklerini açar ve temizler:
 *   POSTGRES_URL_TEST="$(node --env-file=.env.local -p process.env.POSTGRES_URL)" npx vitest run tests/integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import type { AstroCookies } from "astro";

const URL = process.env.POSTGRES_URL_TEST;
const SAAT = 3600e3;
const cerez = (deger: string | null) =>
  ({ get: () => (deger ? { value: deger } : undefined), delete: () => {} }) as unknown as AstroCookies;

describe.skipIf(!URL)("etkinlik — gerçek DB", { timeout: 180_000 }, () => {
  type Db = typeof import("@/db/client.ts");
  type Ev = typeof import("@/lib/etkinlik.ts");
  type Rw = typeof import("@/lib/rewards.ts");
  type Dv = typeof import("@/lib/davet.ts");
  let db: Db["db"], schema: Db["schema"], ev: Ev, rw: Rw, dv: Dv;
  const uyeler: number[] = [];
  const etkinlikler: number[] = [];
  const kulupler: number[] = [];
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
    dv = await import("@/lib/davet.ts");
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
    if (kulupler.length) await db.delete(schema.clubs).where(inArray(schema.clubs.id, kulupler));
    if (uyeler.length === 0) return;
    for (const tbl of [schema.pendingPoints, schema.notifications, schema.badges, schema.bookAccess, schema.pointsLedger])
      await db.delete(tbl).where(inArray(tbl.userId, uyeler));
    await db.delete(schema.users).where(inArray(schema.users.id, uyeler));
  }, 60_000);

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

  it("görevliler: açan + en çok 3 ortak düzenleyen; görevli (scanner) bu sınıra girmez; açan çıkarılamaz", async () => {
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

  /* ---------------- F3-03: etkinlik daveti ---------------- */

  const bekleyen = (userId: number, refId: string) =>
    db.query.pendingPoints.findFirst({
      where: and(eq(schema.pendingPoints.userId, userId), eq(schema.pendingPoints.reason, "event_invite_attended"), eq(schema.pendingPoints.refId, refId)),
    });

  it("davetle kayıt: atıf yazılır, davet edene bekleyen +10 açılır (bitişte sona erer); kod çözülür", async () => {
    const acan = await uye("dv-acan");
    const e = await etkinlik(acan.id, { baslangic: 2, bitis: 4 });
    const davetEden = await uye("dv-eden");
    await ev.kayitOl(davetEden, e);
    const kod = await dv.davetKoduUret(davetEden.id, e.id, "event");
    expect((await dv.davetKoduUret(davetEden.id, e.id, "event")).id).toBe(kod.id);
    // Aynı sayısal id'li KURS için ayrı kod üretilir (tür ayrımı)
    expect(kod.targetType).toBe("event");
    const cozulen = await dv.davetCoz(kod.code.toLowerCase());
    expect(cozulen && "etkinlik" in cozulen && cozulen.etkinlik.id).toBe(e.id);
    expect(await dv.davetHedefi(kod.code)).toBeNull(); // kurs çözücüsü etkinlik kodunu tanımaz

    const davetli = await uye("dv-davetli");
    const k = await ev.kayitOl(davetli, e, { cookies: cerez(`event:${e.id}:${kod.id}`) });
    expect(k).toMatchObject({ durum: "yeni", davetli: true });
    expect(k.rsvp?.inviteCodeId).toBe(kod.id);
    const b = await bekleyen(davetEden.id, `event:${e.id}:u:${davetli.id}`);
    expect(b).toMatchObject({ status: "pending", delta: 10 });
    expect(b!.expiresAt!.getTime()).toBe(e.endsAt!.getTime());
    // Davet anında ledger'a HİÇBİR ŞEY yazılmaz (RSVP puan üretmez; davet puanı girişte)
    expect(await ledger(davetEden.id, "event_invite_attended", `event:${e.id}:u:${davetli.id}`)).toHaveLength(0);
    expect(await ledger(davetli.id, "event_invite_welcome", `event:${e.id}`)).toHaveLength(0);
  });

  it("işaretli davetli girişi (F5-04): davetlinin kendi +10/+5'i yazılır, davet edenin +10'u bekleyende TUTULUR (kaynakIsaretli), işaret kalkınca kesinleşir; C3 (kapandı): işaretli giriş düzenleyen payına sayılmaz", async () => {
    const acan = await uye("fl-acan");
    const e = await etkinlik(acan.id); // kapı açık (başlangıç −1 s), bitiş +3 s
    const davetEden = await uye("fl-eden");
    await ev.kayitOl(davetEden, e);
    const kod = await dv.davetKoduUret(davetEden.id, e.id, "event");
    const ham = await uye("fl-davetli", 30);
    await db.update(schema.users).set({ flaggedAt: new Date() }).where(eq(schema.users.id, ham.id));
    const davetli = (await db.query.users.findFirst({ where: eq(schema.users.id, ham.id) }))!;
    expect((await ev.kayitOl(davetli, e, { cookies: cerez(`event:${e.id}:${kod.id}`) })).rsvp?.inviteCodeId).toBe(kod.id);
    expect((await ev.girisYap(e, davetli.id, "ticket", acan.id)).durum).toBe("geldi");
    // İşaretli üyenin KENDİ doğrudan puanları yazılır (#65: kullanıcı engellenmez)
    expect(await ledger(davetli.id, "event_attended", String(e.id))).toHaveLength(1);
    expect(await ledger(davetli.id, "event_invite_welcome", `event:${e.id}`)).toHaveLength(1);
    // Davet edenin +10'u: kaynak işaretli → bekleyen tutulur (olgun ama kesinleşmez)
    const ref = `event:${e.id}:u:${davetli.id}`;
    expect(await ledger(davetEden.id, "event_invite_attended", ref)).toHaveLength(0);
    expect(await bekleyen(davetEden.id, ref)).toMatchObject({ status: "pending", delta: 10, expiresAt: null });
    expect(await rw.bekleyenleriIsle(new Date(), davetEden.id)).toMatchObject({ kesinlesen: 0 });
    // C3 (kapandı): işaretli hesabın girişi düzenleyen payına sayılmaz; işaret kalkınca sayılır
    expect(await ev.hostPayHesabi(e)).toMatchObject({ katilimci: 0, toplam: 0 });
    await db.update(schema.users).set({ flaggedAt: null }).where(eq(schema.users.id, davetli.id));
    expect(await ev.hostPayHesabi(e)).toMatchObject({ katilimci: 1, toplam: 5 });
    expect(await rw.bekleyenleriIsle(new Date(), davetEden.id)).toMatchObject({ kesinlesen: 1 });
    expect((await ledger(davetEden.id, "event_invite_attended", ref)).map((r) => r.delta)).toEqual([10]);
  });

  it("atıfsız durumlar: kendi kodu, başka etkinliğin çerezi, kurs çerezi, iptal edilmiş kod", async () => {
    const acan = await uye("at-acan");
    const e = await etkinlik(acan.id, { baslangic: 2, bitis: 4 });
    const baska = await etkinlik(acan.id, { baslangic: 2, bitis: 4 });
    const eden = await uye("at-eden");
    await ev.kayitOl(eden, baska);
    const baskaKod = await dv.davetKoduUret(eden.id, baska.id, "event");
    const kod = await dv.davetKoduUret(eden.id, e.id, "event");

    // Kendi kodu: kaydolur, atıf yok
    const kendi = await ev.kayitOl(eden, e, { cookies: cerez(`event:${e.id}:${kod.id}`) });
    expect(kendi).toMatchObject({ durum: "yeni", davetli: false });
    expect(kendi.rsvp?.inviteCodeId).toBeNull();
    // Başka etkinliğin daveti (AC-9 eşleniği) ve kurs çerezi
    const a = await ev.kayitOl(await uye("at-a"), e, { cookies: cerez(`event:${baska.id}:${baskaKod.id}`) });
    const b = await ev.kayitOl(await uye("at-b"), e, { cookies: cerez(`course:${e.id}:${kod.id}`) });
    // Çerez bu etkinliği gösteriyor ama kod başka etkinliğe ait (sahte çerez)
    const c = await ev.kayitOl(await uye("at-c"), e, { cookies: cerez(`event:${e.id}:${baskaKod.id}`) });
    for (const s of [a, b, c]) {
      expect(s).toMatchObject({ durum: "yeni", davetli: false });
      expect(s.rsvp?.inviteCodeId).toBeNull();
    }
    // İptal edilmiş kod
    await db.update(schema.inviteCodes).set({ revokedAt: new Date() }).where(eq(schema.inviteCodes.id, kod.id));
    const d = await ev.kayitOl(await uye("at-d"), e, { cookies: cerez(`event:${e.id}:${kod.id}`) });
    expect(d.davetli).toBe(false);
    expect(await db.query.pendingPoints.findMany({ where: eq(schema.pendingPoints.userId, eden.id) })).toHaveLength(0);
  });

  it("AC-20: düzenleyenin davetiyle kayıt atıf taşır ama düzenleyene bekleyen AÇILMAZ", async () => {
    const acan = await uye("h-acan");
    const ortak = await uye("h-ortak");
    const e = await etkinlik(acan.id, { baslangic: 2, bitis: 4 });
    await ev.gorevliEkle(e, ortak.id, "host");
    for (const host of [acan, ortak]) {
      const kod = await dv.davetKoduUret(host.id, e.id, "event");
      const davetli = await uye(`h-davetli-${host.id}`);
      const k = await ev.kayitOl(davetli, e, { cookies: cerez(`event:${e.id}:${kod.id}`) });
      expect(k).toMatchObject({ durum: "yeni", davetli: true }); // huni sayımı için atıf kalır
      expect(await bekleyen(host.id, `event:${e.id}:u:${davetli.id}`)).toBeUndefined();
    }
    // Giriş görevlisi (scanner) düzenleyen değildir: davet puanı alabilir
    const gorevli = await uye("h-gorevli");
    await ev.gorevliEkle(e, gorevli.id, "scanner");
    const kod = await dv.davetKoduUret(gorevli.id, e.id, "event");
    const davetli = await uye("h-davetli-g");
    await ev.kayitOl(davetli, e, { cookies: cerez(`event:${e.id}:${kod.id}`) });
    expect(await bekleyen(gorevli.id, `event:${e.id}:u:${davetli.id}`)).toMatchObject({ status: "pending" });
  });

  it("AC-19: davetli gelmezse davet edenin bekleyeni etkinlik bitince düşer, ledger boş kalır", async () => {
    const acan = await uye("d19-acan");
    const e = await etkinlik(acan.id, { baslangic: 2, bitis: 4 });
    const eden = await uye("d19-eden");
    await ev.kayitOl(eden, e);
    const kod = await dv.davetKoduUret(eden.id, e.id, "event");
    const davetli = await uye("d19-davetli");
    await ev.kayitOl(davetli, e, { cookies: cerez(`event:${e.id}:${kod.id}`) });
    const ref = `event:${e.id}:u:${davetli.id}`;
    // Bitişten ÖNCE: düşmez
    expect((await rw.bekleyenleriIsle(new Date(e.endsAt!.getTime() - 1000), eden.id)).dusen).toBe(0);
    expect((await bekleyen(eden.id, ref))?.status).toBe("pending");
    // Bitişten SONRA: düşer
    expect((await rw.bekleyenleriIsle(new Date(e.endsAt!.getTime() + 1000), eden.id)).dusen).toBe(1);
    expect((await bekleyen(eden.id, ref))?.status).toBe("expired");
    expect(await ledger(eden.id, "event_invite_attended", ref)).toHaveLength(0);
    // Biten etkinliğin kodu artık çözülmez (kart/karşılama üretmez)
    await db.update(schema.events).set({ startsAt: new Date(Date.now() - 5 * SAAT), endsAt: new Date(Date.now() - 3 * SAAT) }).where(eq(schema.events.id, e.id));
    expect(await dv.davetCoz(kod.code)).toBeNull();
  });

  /* ---------------- F3-04: giriş doğrulaması ---------------- */

  const kayit = (eventId: number, userId: number) =>
    db.query.eventRsvps.findFirst({ where: and(eq(schema.eventRsvps.eventId, eventId), eq(schema.eventRsvps.userId, userId)) });

  it("AC-15/AC-16: kayıt puan üretmez; giriş +10 yazar; tekrar okutma 'zaten', yeni puan yok", async () => {
    const acan = await uye("g-acan");
    const e = await etkinlik(acan.id); // pencerede (1 saat önce başladı)
    const k = await uye("g-kat");
    expect((await ev.kayitOl(k, e)).durum).toBe("yeni");
    expect(await ledger(k.id, "event_attended", String(e.id))).toHaveLength(0); // AC-15
    const g1 = await ev.girisYap(e, k.id, "ticket", acan.id);
    expect(g1).toMatchObject({ durum: "geldi", puan: 10 });
    const g2 = await ev.girisYap(e, k.id, "ticket", acan.id);
    expect(g2.durum).toBe("zaten"); // AC-16
    expect((await ledger(k.id, "event_attended", String(e.id))).map((l) => l.delta)).toEqual([10]);
    const r = await kayit(e.id, k.id);
    expect(r).toMatchObject({ checkinMethod: "ticket", checkedInBy: acan.id });
    expect(g2.durum === "zaten" && g2.rsvp.checkedInAt?.getTime()).toBe(r!.checkedInAt!.getTime());
    // Kaydı olmayan üye
    expect((await ev.girisYap(e, (await uye("g-kayitsiz")).id, "ticket", acan.id)).durum).toBe("yok");
  });

  it("AC-18: aynı bilet 30 kez paralel gönderilir → TEK 'geldi', 29 'zaten', ledger'da tek satır", async () => {
    const acan = await uye("p-acan");
    const e = await etkinlik(acan.id);
    const k = await uye("p-kat");
    const { rsvp } = await ev.kayitOl(k, e);
    const { biletToken } = await import("@/lib/etkinlik-kural.ts");
    const token = biletToken(rsvp!.id);
    const sonuclar = await Promise.all(Array.from({ length: 30 }, () => ev.biletGiris(token, acan, e.id)));
    expect(sonuclar.filter((s) => s.durum === "geldi")).toHaveLength(1);
    expect(sonuclar.filter((s) => s.durum === "zaten")).toHaveLength(29);
    expect(await ledger(k.id, "event_attended", String(e.id))).toHaveLength(1);
    expect(sonuclar.find((s) => s.durum === "geldi")).toMatchObject({ ad: k.name, etkinlik: e.title });
  });

  it("eski RSVP ödülünü almış üye girişte ikinci +10'u alamaz (event_attended refId String(eventId) AYNEN)", async () => {
    const acan = await uye("eski-acan");
    const e = await etkinlik(acan.id);
    const k = await uye("eski-kat");
    await ev.kayitOl(k, e);
    // Faz 3 öncesi kod RSVP anında yazıyordu:
    await rw.awardPoints({ userId: k.id, delta: 10, reason: "event_attended", refId: String(e.id) });
    expect(await ev.girisYap(e, k.id, "ticket", acan.id)).toMatchObject({ durum: "geldi", puan: 0 });
    expect(await ledger(k.id, "event_attended", String(e.id))).toHaveLength(1);
  });

  it("davetli girişi: davetliye +5 anında, davet edene +10 ve bekleyeni kesinleşir (tekrarında çift yazım yok)", async () => {
    const acan = await uye("dg-acan");
    const e = await etkinlik(acan.id);
    const eden = await uye("dg-eden");
    await ev.kayitOl(eden, e);
    const kod = await dv.davetKoduUret(eden.id, e.id, "event");
    const davetli = await uye("dg-davetli"); // 2 günlük hesap
    await ev.kayitOl(davetli, e, { cookies: cerez(`event:${e.id}:${kod.id}`) });
    const ref = `event:${e.id}:u:${davetli.id}`;
    expect(await ev.girisYap(e, davetli.id, "ticket", acan.id)).toMatchObject({ durum: "geldi", puan: 15 });
    expect((await ledger(davetli.id, "event_invite_welcome", `event:${e.id}`)).map((l) => l.delta)).toEqual([5]);
    expect((await ledger(eden.id, "event_invite_attended", ref)).map((l) => l.delta)).toEqual([10]);
    expect(await bekleyen(eden.id, ref)).toMatchObject({ status: "confirmed", yazilan: 10 });
    // Tekrar okutma (çevrimdışı kuyruk yeniden gönderdi): hiçbir şey çiftlenmez
    await ev.girisYap(e, davetli.id, "ticket", acan.id);
    expect(await ledger(davetli.id, "event_invite_welcome", `event:${e.id}`)).toHaveLength(1);
    expect(await ledger(eden.id, "event_invite_attended", ref)).toHaveLength(1);
    // Kesinleşen bekleyen bitişte "düşmüş" sayılmaz
    expect((await rw.bekleyenleriIsle(new Date(e.endsAt!.getTime() + 1000), eden.id)).dusen).toBe(0);
  });

  it("genç davetli (hesap < 24 s): davet edenin puanı ledger'a DEĞİL bekleyene (matures_at); olgunlaşınca kesinleşir", async () => {
    const acan = await uye("gn-acan");
    const e = await etkinlik(acan.id);
    const eden = await uye("gn-eden");
    await ev.kayitOl(eden, e);
    const kod = await dv.davetKoduUret(eden.id, e.id, "event");
    const davetli = await uye("gn-davetli", 0); // kapıda yeni kaydolan
    await ev.kayitOl(davetli, e, { cookies: cerez(`event:${e.id}:${kod.id}`) });
    const ref = `event:${e.id}:u:${davetli.id}`;
    // Davetlinin KENDİ puanları anında (ADR K1.4: welcome için bekleyen satır yok)
    expect(await ev.girisYap(e, davetli.id, "rotating", davetli.id)).toMatchObject({ durum: "geldi", puan: 15 });
    expect(await ledger(eden.id, "event_invite_attended", ref)).toHaveLength(0);
    const b = await bekleyen(eden.id, ref);
    expect(b).toMatchObject({ status: "pending", expiresAt: null });
    expect(b!.maturesAt!.getTime()).toBe(davetli.createdAt.getTime() + 24 * SAAT);
    // Bitiş geçse de DÜŞMEZ (olay geldi, yalnız hesap yaşı bekleniyor); olgunlaşınca kesinleşir
    expect(await rw.bekleyenleriIsle(new Date(e.endsAt!.getTime() + 1000), eden.id)).toMatchObject({ kesinlesen: 0, dusen: 0 });
    expect((await rw.bekleyenleriIsle(new Date(b!.maturesAt!.getTime() + 1000), eden.id)).kesinlesen).toBe(1);
    expect((await ledger(eden.id, "event_invite_attended", ref)).map((l) => l.delta)).toEqual([10]);
  });

  it("AC-20: düzenleyenin davetlisi gelince davetli +15 alır, düzenleyen davet puanı ALMAZ; düzenleyen kendi girişinden puan almaz", async () => {
    const acan = await uye("h20-acan");
    const e = await etkinlik(acan.id);
    const kod = await dv.davetKoduUret(acan.id, e.id, "event");
    const davetli = await uye("h20-davetli");
    await ev.kayitOl(davetli, e, { cookies: cerez(`event:${e.id}:${kod.id}`) });
    expect(await ev.girisYap(e, davetli.id, "ticket", acan.id)).toMatchObject({ durum: "geldi", puan: 15 });
    expect(await ledger(acan.id, "event_invite_attended", `event:${e.id}:u:${davetli.id}`)).toHaveLength(0);
    expect(await bekleyen(acan.id, `event:${e.id}:u:${davetli.id}`)).toBeUndefined();
    // Düzenleyen kendi etkinliğine kaydolup giriş yaparsa: giriş yazılır, puan yazılmaz
    await ev.kayitOl(acan, e);
    expect(await ev.girisYap(e, acan.id, "manual", acan.id)).toMatchObject({ durum: "geldi", puan: 0 });
    expect(await ledger(acan.id, "event_attended", String(e.id))).toHaveLength(0);
  });

  it("giriş penceresi: kapı açılmadan ve bitişten sonra giriş YAZILMAZ (bitişte düşen bekleyen sonradan ödenmesin)", async () => {
    const acan = await uye("pn-acan");
    const erken = await etkinlik(acan.id, { baslangic: 5, bitis: 7 });
    const k1 = await uye("pn-1");
    await ev.kayitOl(k1, erken);
    expect((await ev.girisYap(erken, k1.id, "ticket", acan.id)).durum).toBe("pencere");
    expect((await kayit(erken.id, k1.id))?.checkedInAt).toBeNull();

    // Bitmiş etkinlik: davetli gelmedi → bekleyen düştü → geç okutma ne giriş ne puan yazar
    const gec = await etkinlik(acan.id, { baslangic: 2, bitis: 4 });
    const eden = await uye("pn-eden");
    await ev.kayitOl(eden, gec);
    const kod = await dv.davetKoduUret(eden.id, gec.id, "event");
    const k2 = await uye("pn-2");
    await ev.kayitOl(k2, gec, { cookies: cerez(`event:${gec.id}:${kod.id}`) });
    const bitmis = { ...gec, startsAt: new Date(Date.now() - 5 * SAAT), endsAt: new Date(Date.now() - 3 * SAAT) };
    await db.update(schema.events).set({ startsAt: bitmis.startsAt, endsAt: bitmis.endsAt }).where(eq(schema.events.id, gec.id));
    await db.update(schema.pendingPoints).set({ expiresAt: bitmis.endsAt }).where(eq(schema.pendingPoints.userId, eden.id));
    await rw.bekleyenleriIsle(new Date(), eden.id);
    expect((await ev.girisYap(bitmis, k2.id, "ticket", acan.id)).durum).toBe("pencere");
    expect((await kayit(gec.id, k2.id))?.checkedInAt).toBeNull();
    expect(await ledger(eden.id, "event_invite_attended", `event:${gec.id}:u:${k2.id}`)).toHaveLength(0);
    expect(await ledger(k2.id, "event_attended", String(gec.id))).toHaveLength(0);
  });

  it("bilet: bozuk imza geçersiz; görevli olmayan okutamaz; başka etkinliğin bileti işlenmez; görevli (scanner) okutur", async () => {
    const acan = await uye("b-acan");
    const e = await etkinlik(acan.id);
    const baska = await etkinlik(acan.id);
    const k = await uye("b-kat");
    const { rsvp } = await ev.kayitOl(k, e);
    const { biletToken } = await import("@/lib/etkinlik-kural.ts");
    const token = biletToken(rsvp!.id);
    const bozuk = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
    expect((await ev.biletGiris(bozuk, acan)).durum).toBe("gecersiz");
    expect((await ev.biletGiris("999999999.AAAAAAAAAAAAAAAA", acan)).durum).toBe("gecersiz");
    expect((await ev.biletGiris(token, await uye("b-yabanci"))).durum).toBe("yetkisiz");
    expect((await ev.biletGiris(token, k)).durum).toBe("yetkisiz"); // bilet sahibi kendini okutamaz
    expect(await ev.biletGiris(token, acan, baska.id)).toMatchObject({ durum: "baska", etkinlik: e.title });
    expect((await kayit(e.id, k.id))?.checkedInAt).toBeNull();
    const gorevli = await uye("b-gorevli");
    await ev.gorevliEkle(e, gorevli.id, "scanner");
    expect(await ev.biletGiris(token.toLowerCase(), gorevli, e.id)).toMatchObject({ durum: "geldi", ad: k.name });
    expect((await kayit(e.id, k.id))?.checkedInBy).toBe(gorevli.id);
  });

  /* ---------------- Faz 3 incelemesi: ödül zinciri kapıları ---------------- */

  it("onay bekleyen topluluğun etkinliği ödül zincirine KAPALI: kayıt, giriş, değerlendirme ve düzenleyen payı işlemez; onay gelince açılır", async () => {
    const baskan = await uye("gz-baskan");
    const [kulup] = await db
      .insert(schema.clubs)
      .values({ slug: `itest-ev-kulup-${t}`, name: "Itest Onaysız Kulüp", kind: "sehir", place: "x", il: "Ankara", presidentId: baskan.id })
      .returning();
    kulupler.push(kulup!.id);
    expect(kulup!.status).toBe("pending");
    const e = await etkinlik(baskan.id, { clubId: kulup!.id });
    const kukla = await uye("gz-kukla");
    await ev.gorevliEkle(e, kukla.id, "scanner"); // görevli de olsa kaydolamaz
    expect(await ev.etkinlikAcikMi(e)).toBe(false);
    expect((await ev.kayitOl(kukla, e)).durum).toBe("kapali");
    // Kayıt bir şekilde var olsa bile (eski veri) giriş ve ödül yazılmaz
    await db.insert(schema.eventRsvps).values({ eventId: e.id, userId: kukla.id });
    expect((await ev.girisYap(e, kukla.id, "manual", kukla.id)).durum).toBe("pencere");
    expect((await kayit(e.id, kukla.id))?.checkedInAt).toBeNull();
    expect(await ledger(kukla.id, "event_attended", String(e.id))).toHaveLength(0);
    const { donenPencere, donenToken } = await import("@/lib/etkinlik-kural.ts");
    expect((await ev.donenGiris(e, await uye("gz-kapida"), donenToken(e.id, donenPencere()))).durum).toBe("kapali");

    // Bitmiş + girişli gizli etkinlik: cron pay dağıtmaz ve tek-atış kilidi TÜKETMEZ
    const eski = await etkinlik(baskan.id, { clubId: kulup!.id, baslangic: -52, bitis: -50 });
    await girisliKayit(eski.id, [kukla.id], new Date(Date.now() - 51 * SAAT));
    expect(await ev.etkinligiDegerlendir(eski, kukla.id, 5, null)).toBe("pencere");
    expect(await ev.etkinlikSonrasiIsle({ yalniz: [eski.id] })).toEqual({ host: 0, iyiDegerlendirme: 0, hata: 0 });
    expect(await pay(baskan.id, "event_hosted", eski.id)).toEqual([]);
    // Admin onaylayınca (geriye bakış süresi içinde) dağıtım yapılır
    await db.update(schema.clubs).set({ status: "approved" }).where(eq(schema.clubs.id, kulup!.id));
    expect(await ev.etkinlikAcikMi(e)).toBe(true);
    expect(await ev.etkinlikSonrasiIsle({ yalniz: [eski.id] })).toMatchObject({ host: 1 });
    expect(await pay(baskan.id, "event_hosted", eski.id)).toEqual([5]);
  });

  it("ödül zinciri YALNIZ girişi yazan istekte koşar: 'zaten' okutma eksik/kırpılmış ödülü sonradan yazmaz", async () => {
    const acan = await uye("zt-acan");
    const e = await etkinlik(acan.id);
    const eden = await uye("zt-eden");
    await ev.kayitOl(eden, e);
    const kod = await dv.davetKoduUret(eden.id, e.id, "event");
    const davetli = await uye("zt-davetli");
    await ev.kayitOl(davetli, e, { cookies: cerez(`event:${e.id}:${kod.id}`) });
    const ref = `event:${e.id}:u:${davetli.id}`;
    // Davet edenin haftalık davet tavanı DOLU → girişte 0 yazılır, bekleyen "kırpıldı" olarak kapanır
    await rw.awardPoints({ userId: eden.id, delta: 300, reason: "referral_joined", refId: `itest-tavan:${t}` });
    expect(await ev.girisYap(e, davetli.id, "ticket", acan.id)).toMatchObject({ durum: "geldi", puan: 15 });
    expect(await ledger(eden.id, "event_invite_attended", ref)).toHaveLength(0);
    expect(await bekleyen(eden.id, ref)).toMatchObject({ status: "confirmed", yazilan: 0 });
    // Tavan penceresi boşalsa da (dolduran satır silinir) yeniden okutma ödemeyi tetiklemez
    await db.delete(schema.pointsLedger).where(and(eq(schema.pointsLedger.userId, eden.id), eq(schema.pointsLedger.reason, "referral_joined")));
    expect((await ev.girisYap(e, davetli.id, "ticket", acan.id)).durum).toBe("zaten");
    expect((await ev.girisYap(e, davetli.id, "manual", acan.id)).durum).toBe("zaten");
    expect(await ledger(eden.id, "event_invite_attended", ref)).toHaveLength(0);
    expect((await ledger(davetli.id, "event_attended", String(e.id))).map((l) => l.delta)).toEqual([10]);
  });

  it("elle girişler düzenleyen payına sayılmaz (düzenleyen gelmeyenleri işaretleyip payını şişiremez); katılımcının +10'u kalır", async () => {
    const acan = await uye("el-acan");
    const e = await etkinlik(acan.id);
    const [a, b, c, d, f] = await topluUye(5, "el");
    for (const id of [a!, b!, c!, d!, f!]) await db.insert(schema.eventRsvps).values({ eventId: e.id, userId: id });
    const { biletToken } = await import("@/lib/etkinlik-kural.ts");
    for (const id of [a!, b!]) expect((await ev.biletGiris(biletToken((await kayit(e.id, id))!.id), acan, e.id)).durum).toBe("geldi");
    for (const id of [c!, d!, f!]) expect(await ev.girisYap(e, id, "manual", acan.id)).toMatchObject({ durum: "geldi", puan: 10 });
    expect(await ev.hostPayHesabi(e)).toMatchObject({ katilimci: 2, toplam: 10 });
    expect((await ev.hostBekleyenleri(acan.id)).find((h) => h.etkinlik.id === e.id)).toMatchObject({ tahmini: 10, katilimci: 2 });
  });

  it("etkinlikler arası tavan: katılım kayan 7 günde 70; düzenleyen puanları (pay + iyi değerlendirme) ortak 1000", async () => {
    const k = await uye("tv-kat");
    const yazilanlar = [];
    for (let i = 0; i < 9; i++) yazilanlar.push(await rw.awardPoints({ userId: k.id, delta: 10, reason: "event_attended", refId: `itest-tv-${t}-${i}` }));
    expect(yazilanlar).toEqual([10, 10, 10, 10, 10, 10, 10, 0, 0]);
    const h = await uye("tv-host");
    expect(await rw.awardPoints({ userId: h.id, delta: 500, reason: "event_hosted", refId: `event:itest-${t}-1` })).toBe(500);
    expect(await rw.awardPoints({ userId: h.id, delta: 50, reason: "event_well_rated", refId: `event:itest-${t}-1` })).toBe(50);
    expect(await rw.awardPoints({ userId: h.id, delta: 500, reason: "event_hosted", refId: `event:itest-${t}-2` })).toBe(450); // 1000'e kırpıldı
    expect(await rw.awardPoints({ userId: h.id, delta: 50, reason: "event_well_rated", refId: `event:itest-${t}-2` })).toBe(0);
  });

  it("görevli sınırı: etkinlik başına en çok 20 görevli (açan dahil)", async () => {
    const acan = await uye("gs-acan");
    const e = await etkinlik(acan.id);
    const adaylar = await topluUye(21, "gs");
    const eklenen = [];
    for (const id of adaylar) eklenen.push(await ev.gorevliEkle(e, id, "scanner"));
    expect(eklenen.filter(Boolean)).toHaveLength(19); // açan + 19 = 20
    expect(eklenen.slice(19)).toEqual([false, false]);
  });

  /* ---------------- F3-05: dönen QR ---------------- */

  it("AC-17: dönen QR — 2 dk önceki token reddedilir (kayıt bile açılmaz); güncel token kayıtsız üyeyi kaydedip girişi yazar", async () => {
    const { donenPencere, donenToken } = await import("@/lib/etkinlik-kural.ts");
    const acan = await uye("dq-acan");
    const e = await etkinlik(acan.id);
    const baska = await etkinlik(acan.id);
    const k = await uye("dq-kat");
    const eski = donenToken(e.id, donenPencere(new Date(Date.now() - 120_000)));
    expect(await ev.donenGiris(e, k, eski)).toEqual({ durum: "sure" });
    expect(await ev.donenGiris(e, k, donenToken(baska.id, donenPencere()))).toEqual({ durum: "sure" }); // başka etkinliğin QR'ı
    expect(await ev.donenGiris(e, k, "")).toEqual({ durum: "sure" });
    expect(await kayit(e.id, k.id)).toBeUndefined();

    expect(await ev.donenGiris(e, k, donenToken(e.id, donenPencere()))).toEqual({ durum: "geldi", puan: 10 });
    expect(await kayit(e.id, k.id)).toMatchObject({ checkinMethod: "rotating", checkedInBy: k.id });
    expect((await ev.donenGiris(e, k, donenToken(e.id, donenPencere()).toLowerCase())).durum).toBe("zaten");
    expect(await ledger(k.id, "event_attended", String(e.id))).toHaveLength(1);
  });

  it("dönen QR: kontenjan doluysa kayıtsız üye giremez, kayıtlı girer; pencere dışında giriş yok", async () => {
    const { donenPencere, donenToken } = await import("@/lib/etkinlik-kural.ts");
    const acan = await uye("dk-acan");
    const dolu = await etkinlik(acan.id, { capacity: 1 });
    const kayitli = await uye("dk-kayitli");
    await ev.kayitOl(kayitli, dolu);
    const kapida = await uye("dk-kapida");
    expect(await ev.donenGiris(dolu, kapida, donenToken(dolu.id, donenPencere()))).toEqual({ durum: "dolu" });
    expect(await kayit(dolu.id, kapida.id)).toBeUndefined();
    expect((await ev.donenGiris(dolu, kayitli, donenToken(dolu.id, donenPencere()))).durum).toBe("geldi");

    const erken = await etkinlik(acan.id, { baslangic: 5, bitis: 7 });
    expect(await ev.donenGiris(erken, kapida, donenToken(erken.id, donenPencere()))).toEqual({ durum: "pencere" });
    expect(await kayit(erken.id, kapida.id)).toBeUndefined(); // pencere dışında kayıt da açılmaz
  });

  /* ---------------- F3-06: etkinlik sonrası ---------------- */

  /** n üyeyi tek sorguda açar (101 girişli senaryo) */
  async function topluUye(n: number, ad: string) {
    const rows = await db
      .insert(schema.users)
      .values(Array.from({ length: n }, (_, i) => ({ clerkId: `demo_itest_ev_${ad}${i}_${t}`, handle: `itest-ev-${ad}${i}-${t}`, name: `Itest ${ad}${i}`, createdAt: new Date(Date.now() - 5 * 864e5) })))
      .returning({ id: schema.users.id });
    uyeler.push(...rows.map((r) => r.id));
    return rows.map((r) => r.id);
  }
  const girisliKayit = (eventId: number, ids: number[], an: Date) =>
    db.insert(schema.eventRsvps).values(ids.map((userId) => ({ eventId, userId, checkedInAt: an, checkinMethod: "ticket" as const })));
  const pay = async (userId: number, reason: string, eventId: number) =>
    (await ledger(userId, reason, `event:${eventId}`)).map((l) => l.delta);

  it("düzenleyen payı: 101 girişte toplam 500 → 3 host 166/166/168 (kalan açana); 48 saat dolmadan dağıtılmaz; cron ikinci koşumda no-op", async () => {
    const acan = await uye("hp-acan");
    const [h1, h2] = [await uye("hp-h1"), await uye("hp-h2")];
    const e = await etkinlik(acan.id, { baslangic: -52, bitis: -50 }); // 50 saat önce bitti
    await ev.gorevliEkle(e, h1.id, "host");
    await ev.gorevliEkle(e, h2.id, "host");
    const gorevli = await uye("hp-gorevli");
    await ev.gorevliEkle(e, gorevli.id, "scanner");
    const gelis = new Date(Date.now() - 51 * SAAT);
    await girisliKayit(e.id, await topluUye(101, "hp"), gelis);
    await girisliKayit(e.id, [acan.id], gelis); // düzenleyenin kendi girişi SAYILMAZ
    await db.insert(schema.eventRsvps).values({ eventId: e.id, userId: (await uye("hp-gelmeyen")).id }); // gelmeyen sayılmaz

    expect(await ev.hostPayHesabi(e)).toMatchObject({ katilimci: 101, toplam: 500 });
    // Henüz 48 saat dolmamış başka bir etkinlik işlenmez
    const taze = await etkinlik(acan.id, { baslangic: -49, bitis: -47 });
    await girisliKayit(taze.id, [h1.id], new Date(Date.now() - 48 * SAAT));
    expect(await ev.etkinlikSonrasiIsle({ yalniz: [e.id, taze.id] })).toEqual({ host: 1, iyiDegerlendirme: 0, hata: 0 });
    expect(await pay(acan.id, "event_hosted", e.id)).toEqual([168]);
    expect(await pay(h1.id, "event_hosted", e.id)).toEqual([166]);
    expect(await pay(h2.id, "event_hosted", e.id)).toEqual([166]);
    expect(await pay(gorevli.id, "event_hosted", e.id)).toEqual([]); // görevli (scanner) pay almaz
    expect(await pay(acan.id, "event_hosted", taze.id)).toEqual([]);
    // İkinci koşum: kilit tutuyor, ledger değişmiyor
    expect(await ev.etkinlikSonrasiIsle({ yalniz: [e.id, taze.id] })).toEqual({ host: 0, iyiDegerlendirme: 0, hata: 0 });
    expect(await pay(acan.id, "event_hosted", e.id)).toEqual([168]);
    // Kilit silinse bile (elle yeniden koşum) idem index çift yazımı yutar
    expect((await ev.hostOdulleriniDagit(e)).yazilan).toBe(0);
    // event_hosted için bekleyen satır YOKTUR (ADR K2)
    expect(await db.query.pendingPoints.findMany({ where: inArray(schema.pendingPoints.userId, [acan.id, h1.id, h2.id]) })).toHaveLength(0);
  });

  it("değerlendirme: yalnız girişi doğrulanmış katılımcı; tek satır (güncellenir); düzenleyen ve gelmeyen değerlendiremez", async () => {
    const acan = await uye("dg2-acan");
    const e = await etkinlik(acan.id); // sürüyor → pencere açık
    const gelen = await uye("dg2-gelen");
    const gelmeyen = await uye("dg2-gelmeyen");
    await ev.kayitOl(gelen, e);
    await ev.kayitOl(gelmeyen, e);
    await ev.kayitOl(acan, e);
    await ev.girisYap(e, gelen.id, "ticket", acan.id);
    await ev.girisYap(e, acan.id, "manual", acan.id);
    expect(await ev.etkinligiDegerlendir(e, gelmeyen.id, 5, null)).toBe("giris-yok");
    expect(await ev.etkinligiDegerlendir(e, acan.id, 5, null)).toBe("giris-yok"); // kendi etkinliği
    expect(await ev.etkinligiDegerlendir(e, (await uye("dg2-yabanci")).id, 5, null)).toBe("giris-yok");
    expect(await ev.etkinligiDegerlendir(e, gelen.id, 0, null)).toBe("gecersiz");
    expect(await ev.etkinligiDegerlendir(e, gelen.id, 4.5, null)).toBe("gecersiz");
    expect(await ev.etkinligiDegerlendir(e, gelen.id, 3, "idare eder")).toBe("tamam");
    expect(await ev.etkinligiDegerlendir(e, gelen.id, 5, "fikrim değişti")).toBe("tamam");
    const satirlar = await db.query.ratings.findMany({ where: eq(schema.ratings.eventId, e.id) });
    expect(satirlar.map((r) => [r.userId, r.stars, r.body])).toEqual([[gelen.id, 5, "fikrim değişti"]]);
    // Pencere: bitişten 7 günden fazla geçmiş
    const eski = await etkinlik(acan.id, { baslangic: -200, bitis: -198 });
    await girisliKayit(eski.id, [gelen.id], new Date(Date.now() - 199 * SAAT));
    expect(await ev.etkinligiDegerlendir(eski, gelen.id, 5, null)).toBe("pencere");
  });

  it("iyi değerlendirme: bitişten 7 gün sonra ort ≥ 4,0 ve ≥ 10 değerlendirme → +50 düzenleyenler arasında; 9 değerlendirmede yok", async () => {
    const acan = await uye("wr-acan");
    const ortak = await uye("wr-ortak");
    const katilimcilar = await topluUye(10, "wr");
    const yeterli = await etkinlik(acan.id, { baslangic: -200, bitis: -198 }); // ~8 gün önce bitti
    const az = await etkinlik(acan.id, { baslangic: -200, bitis: -198 });
    const dusuk = await etkinlik(acan.id, { baslangic: -200, bitis: -198 });
    const erken = await etkinlik(acan.id, { baslangic: -100, bitis: -98 }); // 7 gün dolmadı
    await ev.gorevliEkle(yeterli, ortak.id, "host");
    const yildizlar = [5, 5, 5, 4, 4, 4, 4, 4, 4, 3]; // ort 4,2
    await db.insert(schema.ratings).values([
      ...katilimcilar.map((userId, i) => ({ userId, eventId: yeterli.id, stars: yildizlar[i]! })),
      ...katilimcilar.slice(0, 9).map((userId) => ({ userId, eventId: az.id, stars: 5 })),
      ...katilimcilar.map((userId) => ({ userId, eventId: dusuk.id, stars: 3 })),
      ...katilimcilar.map((userId) => ({ userId, eventId: erken.id, stars: 5 })),
    ]);
    const ids = [yeterli.id, az.id, dusuk.id, erken.id];
    // 4 etkinliğin düzenleyen payı kilidi (girişsiz → 0 puan) + 3'ünün değerlendirme kilidi
    expect(await ev.etkinlikSonrasiIsle({ yalniz: ids })).toEqual({ host: 4, iyiDegerlendirme: 3, hata: 0 });
    expect(await pay(acan.id, "event_well_rated", yeterli.id)).toEqual([25]);
    expect(await pay(ortak.id, "event_well_rated", yeterli.id)).toEqual([25]);
    expect(await pay(acan.id, "event_well_rated", az.id)).toEqual([]);
    expect(await pay(acan.id, "event_well_rated", dusuk.id)).toEqual([]);
    expect(await pay(acan.id, "event_well_rated", erken.id)).toEqual([]);
    expect(await pay(acan.id, "event_hosted", yeterli.id)).toEqual([]); // giriş yok → 0'lık satır yazılmaz
    expect(await ev.etkinlikSonrasiIsle({ yalniz: ids })).toEqual({ host: 0, iyiDegerlendirme: 0, hata: 0 });
    expect(await pay(acan.id, "event_well_rated", yeterli.id)).toEqual([25]);
  });

  it("pano tahmini: süren etkinlikte düzenleyenin payı canlı sayımdan; dağıtım anı bitiş + 48 saat", async () => {
    const acan = await uye("pt-acan");
    const e = await etkinlik(acan.id); // 1 saat önce başladı, 3 saat sonra bitiyor
    await girisliKayit(e.id, await topluUye(3, "pt"), new Date());
    const b = await ev.hostBekleyenleri(acan.id);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ tahmini: 15, katilimci: 3 });
    expect(b[0]!.dagitim.getTime()).toBe(e.endsAt!.getTime() + 48 * SAAT);
    expect(await ev.hostBekleyenleri((await uye("pt-yabanci")).id)).toEqual([]);
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
