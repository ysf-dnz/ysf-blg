/**
 * Mesaj, engel ve harita — gerçek DB (Faz 4): izin matrisi tek SQL'de (AC-23) ve saf eşleniği
 * dmKarar ile AYNI sonucu verir; engel iki yönlü (AC-22: mesaj + harita); hız penceresi paralel
 * isteklerde TAM sınırda kalır (danışma kilidi); günde 20 yeni konuşma; gelen kutusu / okundu;
 * harita ızgarası yalnız rızalı üyeler (AC-21) ve filtreler.
 * Yalnız POSTGRES_URL_TEST ile koşar; kendi geçici üyelerini açar ve temizler:
 *   POSTGRES_URL_TEST="$(node --env-file=.env.local -p process.env.POSTGRES_URL)" npx vitest run tests/integration/mesaj-db
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, or } from "drizzle-orm";

const URL = process.env.POSTGRES_URL_TEST;

describe.skipIf(!URL)("mesaj / engel / harita — gerçek DB", { timeout: 180_000 }, () => {
  type Db = typeof import("@/db/client.ts");
  type Ms = typeof import("@/lib/mesaj.ts");
  type Hr = typeof import("@/lib/harita.ts");
  type Ec = typeof import("@/lib/economy.ts");
  type Rw = typeof import("@/lib/rewards.ts");
  let db: Db["db"], schema: Db["schema"], ms: Ms, hr: Hr, ec: Ec, rw: Rw;
  const uyeler: number[] = [];
  const kulupler: number[] = [];
  const kurslar: number[] = [];
  const t = Date.now().toString(36);
  let sira = 0;

  type UyeEk = Partial<Pick<typeof schema.users.$inferInsert, "dmPolicy" | "mapVisibleAt" | "city">>;
  async function uye(ad: string, ek: UyeEk = {}) {
    const [u] = await db
      .insert(schema.users)
      .values({ clerkId: `demo_itest_msg_${ad}_${t}`, handle: `itest-msg-${ad}-${t}`, name: `Itest ${ad}`, ...ek })
      .returning();
    uyeler.push(u!.id);
    return u!;
  }
  async function topluUye(n: number, ad: string): Promise<number[]> {
    const rows = await db
      .insert(schema.users)
      .values(Array.from({ length: n }, (_, i) => ({ clerkId: `demo_itest_msg_${ad}${i}_${t}`, handle: `itest-msg-${ad}${i}-${t}`, name: `Itest ${ad}${i}` })))
      .returning({ id: schema.users.id });
    uyeler.push(...rows.map((r) => r.id));
    return rows.map((r) => r.id);
  }
  /** Ortak topluluk: üyeleri aynı kulübe yazar (varsayılan onaylı) */
  async function kulup(uyeIdleri: number[], status: "approved" | "pending" | "archived" = "approved") {
    const [k] = await db
      .insert(schema.clubs)
      .values({ slug: `itest-msg-${t}-${sira++}`, name: "Itest Mesaj Kulübü", kind: "sehir", place: "x", il: "Ankara", presidentId: uyeIdleri[0]!, status })
      .returning();
    kulupler.push(k!.id);
    await db.insert(schema.clubMembers).values(uyeIdleri.map((userId) => ({ clubId: k!.id, userId })));
    return k!;
  }
  const takip = (a: number, b: number) => db.insert(schema.follows).values({ followerId: a, followedId: b });
  const yazilan = (a: number, b: number) =>
    db.query.messages.findMany({ where: and(eq(schema.messages.senderId, a), eq(schema.messages.recipientId, b)) });
  /** Gönderenin mesajlarını hız penceresinin dışına iter (30 sn beklemeden sınamak için) */
  const pencereyiBosalt = (gonderenId: number) =>
    db
      .update(schema.messages)
      .set({ createdAt: new Date(Date.now() - (ec.DM_PENCERE_SN + 1) * 1000) })
      .where(eq(schema.messages.senderId, gonderenId));
  /** SQL kararı ile saf eşleniği aynı mı: yazıldıysa "ok", değilse aynı ret gerekçesi */
  async function gonderVeKarsilastir(g: number, a: number, govde = "selam") {
    const beklenen = ec.dmKarar(await ms.mesajDurumu(g, a));
    const s = await ms.mesajGonder(g, a, govde);
    expect(s.durum, "SQL WHERE ile dmKarar ayrıştı").toBe(beklenen);
    return s.durum;
  }

  beforeAll(async () => {
    process.env.POSTGRES_URL = URL;
    ({ db, schema } = await import("@/db/client.ts"));
    ms = await import("@/lib/mesaj.ts");
    hr = await import("@/lib/harita.ts");
    ec = await import("@/lib/economy.ts");
    rw = await import("@/lib/rewards.ts");
  });
  afterAll(async () => {
    if (uyeler.length === 0) return;
    await db.delete(schema.messages).where(or(inArray(schema.messages.senderId, uyeler), inArray(schema.messages.recipientId, uyeler)));
    await db.delete(schema.blocks).where(or(inArray(schema.blocks.blockerId, uyeler), inArray(schema.blocks.blockedId, uyeler)));
    await db.delete(schema.follows).where(or(inArray(schema.follows.followerId, uyeler), inArray(schema.follows.followedId, uyeler)));
    if (kurslar.length) {
      await db.delete(schema.courseEnrollments).where(inArray(schema.courseEnrollments.courseId, kurslar));
      await db.delete(schema.courses).where(inArray(schema.courses.id, kurslar));
    }
    if (kulupler.length) {
      await db.delete(schema.clubMembers).where(inArray(schema.clubMembers.clubId, kulupler));
      await db.delete(schema.clubs).where(inArray(schema.clubs.id, kulupler));
    }
    for (const tbl of [schema.notifications, schema.badges, schema.bookAccess, schema.pointsLedger])
      await db.delete(tbl).where(inArray(tbl.userId, uyeler));
    await db.delete(schema.users).where(inArray(schema.users.id, uyeler));
  });

  /* ---------------- AC-23: izin politikası ---------------- */

  it("AC-23 mutual (varsayılan): bağ yoksa yeni konuşma başlatılamaz; Sv4 de yetmez", async () => {
    const [g, a] = [await uye("m-g"), await uye("m-a")];
    expect(await gonderVeKarsilastir(g.id, a.id)).toBe("bag");
    await rw.awardPoints({ userId: g.id, delta: 200, reason: "welcome", refId: `itest:${t}` }); // Sv4+
    expect(await gonderVeKarsilastir(g.id, a.id)).toBe("bag");
    expect(await yazilan(g.id, a.id)).toHaveLength(0);
  });

  it("AC-23 mutual: ortak ONAYLI topluluk bağdır; onay bekleyen/arşivli topluluk bağ değildir", async () => {
    const [g, a] = [await uye("k-g"), await uye("k-a")];
    await kulup([g.id, a.id], "pending");
    await kulup([g.id, a.id], "archived");
    expect(await gonderVeKarsilastir(g.id, a.id)).toBe("bag");
    await kulup([g.id, a.id]);
    expect(await gonderVeKarsilastir(g.id, a.id)).toBe("ok");
    expect(await yazilan(g.id, a.id)).toHaveLength(1);
  });

  it("AC-23 mutual: tek yönlü takip bağ değildir, karşılıklı takip bağdır", async () => {
    const [g, a] = [await uye("t-g"), await uye("t-a")];
    await takip(g.id, a.id);
    expect(await gonderVeKarsilastir(g.id, a.id)).toBe("bag");
    await takip(a.id, g.id);
    expect(await gonderVeKarsilastir(g.id, a.id)).toBe("ok");
  });

  it("everyone: bağ yoksa Sv4 altı başlatamaz, Sv4+ başlatır", async () => {
    const [g, a] = [await uye("e-g"), await uye("e-a", { dmPolicy: "everyone" })];
    expect(await gonderVeKarsilastir(g.id, a.id)).toBe("bag");
    await rw.awardPoints({ userId: g.id, delta: 64, reason: "welcome", refId: `itest:${t}` });
    expect(await gonderVeKarsilastir(g.id, a.id)).toBe("bag"); // 64 < 65
    await rw.awardPoints({ userId: g.id, delta: 1, reason: "quiz", refId: `itest:${t}` });
    expect(await gonderVeKarsilastir(g.id, a.id)).toBe("ok");
  });

  it("nobody: bağ + Sv4 olsa da başlatılamaz; alıcı yazınca yanıt serbest (ayardan bağımsız)", async () => {
    const [g, a] = [await uye("n-g"), await uye("n-a", { dmPolicy: "nobody" })];
    await kulup([g.id, a.id]);
    await rw.awardPoints({ userId: g.id, delta: 200, reason: "welcome", refId: `itest:${t}` });
    expect(await gonderVeKarsilastir(g.id, a.id)).toBe("kapali");
    // Alıcı konuşmayı kendisi açar (g'nin ayarı mutual + ortak topluluk → yazabilir)
    expect(await gonderVeKarsilastir(a.id, g.id)).toBe("ok");
    expect(await gonderVeKarsilastir(g.id, a.id)).toBe("ok");
  });

  it("kendine ve olmayan üyeye yazılamaz; boş / 1000'den uzun gövde reddedilir; gövde temizlenir", async () => {
    const [g, a] = [await uye("s-g"), await uye("s-a")];
    await kulup([g.id, a.id]);
    expect(await gonderVeKarsilastir(g.id, g.id)).toBe("kendin");
    expect((await ms.mesajGonder(g.id, 2_000_000_000, "selam")).durum).toBe("kapali");
    expect((await ms.mesajGonder(g.id, a.id, "   \n ")).durum).toBe("bos");
    expect((await ms.mesajGonder(g.id, a.id, "a".repeat(ec.DM_AZAMI_UZUNLUK + 1))).durum).toBe("bos");
    expect((await ms.mesajGonder(g.id, a.id, "  satır1\r\nsatır2\u0000 <b>x</b>  ")).durum).toBe("ok");
    expect((await yazilan(g.id, a.id)).map((m) => m.body)).toEqual(["satır1\nsatır2 <b>x</b>"]);
  });

  /* ---------------- AC-22: engel ---------------- */

  it("AC-22: B, A'yı engellerse A B'ye (ve B A'ya) yazamaz; süren konuşmada da; engel kalkınca yazılır", async () => {
    const [a, b] = [await uye("en-a"), await uye("en-b")];
    await kulup([a.id, b.id]);
    expect(await gonderVeKarsilastir(a.id, b.id)).toBe("ok");
    expect(await gonderVeKarsilastir(b.id, a.id)).toBe("ok"); // karşılıklı yazışmışlar
    await ms.engelle(b.id, a.id);
    await ms.engelle(b.id, a.id); // idempotent
    expect(await ms.engelDurumu(a.id, b.id)).toEqual({ benim: false, karsi: true });
    expect(await ms.engelDurumu(b.id, a.id)).toEqual({ benim: true, karsi: false });
    await pencereyiBosalt(a.id);
    expect(await gonderVeKarsilastir(a.id, b.id)).toBe("engel");
    expect(await gonderVeKarsilastir(b.id, a.id)).toBe("engel"); // iki yönlü
    expect(await yazilan(a.id, b.id)).toHaveLength(1);
    await ms.engelKaldir(a.id, b.id); // engeli yalnız koyan kaldırır: A'nın çağrısı etkisiz
    expect(await gonderVeKarsilastir(a.id, b.id)).toBe("engel");
    await ms.engelKaldir(b.id, a.id);
    expect(await gonderVeKarsilastir(a.id, b.id)).toBe("ok");
  });

  /* ---------------- Frenler ---------------- */

  it("hız penceresi: 12 paralel gönderim → TAM 5 yazılır (danışma kilidi); pencere boşalınca yeniden yazılır", async () => {
    const [g, a] = [await uye("hz-g"), await uye("hz-a")];
    await kulup([g.id, a.id]);
    const sonuclar = await Promise.all(Array.from({ length: 12 }, (_, i) => ms.mesajGonder(g.id, a.id, `paralel ${i}`)));
    expect(sonuclar.filter((s) => s.durum === "ok")).toHaveLength(ec.DM_PENCERE_LIMIT);
    expect(sonuclar.filter((s) => s.durum === "hiz")).toHaveLength(12 - ec.DM_PENCERE_LIMIT);
    expect(await yazilan(g.id, a.id)).toHaveLength(ec.DM_PENCERE_LIMIT);
    expect(await gonderVeKarsilastir(g.id, a.id)).toBe("hiz");
    await pencereyiBosalt(g.id);
    expect(await gonderVeKarsilastir(g.id, a.id)).toBe("ok");
  });

  it("günde 20 yeni konuşma: 21. yeni konuşma başlatılamaz; süren konuşma ve yanıt etkilenmez", async () => {
    const g = await uye("gn-g");
    const alicilar = await topluUye(ec.DM_GUNLUK_YENI_KONUSMA + 2, "gn");
    await kulup([g.id, ...alicilar]);
    for (const a of alicilar.slice(0, ec.DM_GUNLUK_YENI_KONUSMA)) {
      expect((await ms.mesajGonder(g.id, a, "ilk")).durum).toBe("ok");
      await pencereyiBosalt(g.id); // ~31 sn geri: hâlâ bugün
    }
    const yirmiBirinci = alicilar[ec.DM_GUNLUK_YENI_KONUSMA]!;
    expect(await gonderVeKarsilastir(g.id, yirmiBirinci)).toBe("gunluk");
    expect(await gonderVeKarsilastir(g.id, alicilar[0]!)).toBe("ok"); // süren konuşma
    await pencereyiBosalt(g.id);
    // Karşı tarafın başlattığı konuşmaya yanıt: yeni konuşma sayılmaz
    const baslatan = alicilar[ec.DM_GUNLUK_YENI_KONUSMA + 1]!;
    expect((await ms.mesajGonder(baslatan, g.id, "ben başlattım")).durum).toBe("ok");
    expect(await gonderVeKarsilastir(g.id, baslatan)).toBe("ok");
    expect((await ms.mesajDurumu(g.id, yirmiBirinci)).bugunYeniKonusma).toBe(ec.DM_GUNLUK_YENI_KONUSMA);
  });

  /* ---------------- Gelen kutusu / okundu ---------------- */

  it("gelen kutusu: konuşma başına son mesaj + okunmamış; okundu yalnız alıcının gelenlerini yazar; yoklama imleci id", async () => {
    const [ben, x, y] = [await uye("gk-ben"), await uye("gk-x"), await uye("gk-y")];
    await kulup([ben.id, x.id, y.id]);
    await ms.mesajGonder(x.id, ben.id, "x1");
    await ms.mesajGonder(x.id, ben.id, "x2");
    await ms.mesajGonder(y.id, ben.id, "y1");
    const benden = await ms.mesajGonder(ben.id, y.id, "ben→y");
    expect(benden.durum).toBe("ok");
    const kutu = await ms.gelenKutusu(ben.id);
    expect(kutu.map((k) => [k.kisiId, k.son.body, k.okunmamis])).toEqual([
      [y.id, "ben→y", 1],
      [x.id, "x2", 2],
    ]);
    expect(await ms.okunmamisMesaj(ben.id)).toBe(3);
    expect(await ms.okunduYaz(x.id, ben.id)).toBe(0); // gönderen kendi mesajını okundu yapamaz
    expect(await ms.okunduYaz(ben.id, x.id)).toBe(2);
    expect(await ms.okunduYaz(ben.id, x.id)).toBe(0); // idempotent
    expect(await ms.okunmamisMesaj(ben.id)).toBe(1);
    const tumu = await ms.konusma(ben.id, y.id);
    expect(tumu.map((m) => m.body)).toEqual(["y1", "ben→y"]); // eskiden yeniye
    expect((await ms.konusma(ben.id, y.id, { sonraId: tumu[0]!.id })).map((m) => m.body)).toEqual(["ben→y"]);
    expect(await ms.konusma(x.id, y.id)).toEqual([]); // üçüncü kişi konuşmayı göremez
  });

  /* ---------------- AC-21 / AC-22: harita ---------------- */

  it("AC-21: haritada yalnız rıza verenler; AC-22: engel iki yönde gizler; filtreler topluluk · kurs · takip", async () => {
    const simdi = new Date();
    const bakan = await uye("h-bakan");
    const gorunen = await uye("h-gorunen", { mapVisibleAt: simdi, city: "Ardahan" });
    const rizasiz = await uye("h-rizasiz", { city: "Ardahan" });
    const ilsiz = await uye("h-ilsiz", { mapVisibleAt: simdi });
    const yabanci = await uye("h-yabanci", { mapVisibleAt: simdi, city: "Atlantis" }); // 81 il dışı
    const engelleyen = await uye("h-engelleyen", { mapVisibleAt: simdi, city: "Ardahan" });
    const engellenen = await uye("h-engellenen", { mapVisibleAt: simdi, city: "Ardahan" });
    const handlelar = async (f?: Parameters<Hr["haritaUyeleri"]>[1], kim = bakan.id) =>
      [...(await hr.haritaUyeleri(kim, f)).values()].flatMap((v) => v.uyeler.map((u) => u.h)).filter((h) => h.endsWith(t));

    expect((await handlelar()).sort()).toEqual([engellenen.handle, engelleyen.handle, gorunen.handle].sort());
    for (const yok of [rizasiz, ilsiz, yabanci]) expect(await handlelar()).not.toContain(yok.handle);
    const ardahan = (await hr.haritaUyeleri(bakan.id)).get("Ardahan")!;
    expect(ardahan.uyeler.find((u) => u.h === gorunen.handle)).toEqual({ h: gorunen.handle, ad: gorunen.name, av: null, sv: 1 });

    // Engel iki yönlü: engelleyen de engellenen de birbirini görmez; üçüncü kişi ikisini de görür
    await ms.engelle(engelleyen.id, bakan.id);
    await ms.engelle(bakan.id, engellenen.id);
    expect(await handlelar()).toEqual([gorunen.handle]);
    expect(await handlelar(undefined, engelleyen.id)).not.toContain(bakan.handle);
    expect((await handlelar(undefined, gorunen.id)).sort()).toEqual([engellenen.handle, engelleyen.handle, gorunen.handle].sort());

    // Filtreler rıza ve engel süzgecinin ÜSTÜNE uygulanır (rızasız üye filtreyle de çıkmaz)
    const k = await kulup([gorunen.id, rizasiz.id, engelleyen.id]);
    expect(await handlelar({ kulupId: k.id })).toEqual([gorunen.handle]);
    const [kurs] = await db
      .insert(schema.courses)
      .values({ slug: `itest-msg-kurs-${t}`, title: "Itest Kurs", createdBy: bakan.id })
      .returning();
    kurslar.push(kurs!.id);
    await db.insert(schema.courseEnrollments).values([rizasiz, engellenen].map((u) => ({ courseId: kurs!.id, userId: u.id })));
    expect(await handlelar({ kursId: kurs!.id })).toEqual([]);
    await db.insert(schema.courseEnrollments).values({ courseId: kurs!.id, userId: gorunen.id });
    expect(await handlelar({ kursId: kurs!.id })).toEqual([gorunen.handle]);
    expect(await handlelar({ takip: true })).toEqual([]);
    await takip(bakan.id, gorunen.id);
    await takip(bakan.id, rizasiz.id);
    expect(await handlelar({ takip: true })).toEqual([gorunen.handle]);
  });
});
