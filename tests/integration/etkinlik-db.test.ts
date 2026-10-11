/**
 * Etkinlik — gerçek DB (Faz 3): kapasite yarışı, kayıt kapanışı, ⭐ koltuk, görevli sınırı;
 * etkinlik daveti atfı, bekleyen ve bitişte düşme (AC-19), düzenleyen davet puanı almaz (AC-20);
 * giriş doğrulaması: RSVP puansız (AC-15), tekrar okutma (AC-16), paralel/çift gönderim (AC-18).
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
