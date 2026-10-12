import { describe, expect, it } from "vitest";
import {
  DAVET_PAYI_ESIK,
  HAVUZ_ESIK,
  HAVUZ_TAVAN,
  SUISTIMAL_ESIK,
  canlilikV,
  ekonomiOzeti,
  havuz,
  havuzDagit,
  isoHafta,
  sonTamamlananHafta,
  suistimalMi,
  type EkonomiHam,
} from "@/lib/economy.ts";
import { PUAN } from "@/lib/points.ts";
import { DAVET_KAYNAKLI, DAVET_REASONLARI, tavanIcin } from "@/lib/rewards.ts";

describe("2. seviye davet (F5-01)", () => {
  it("+5 ve davet tavanında (300 / kayan 7 gün)", () => {
    expect(PUAN.inviteSecondLevel).toBe(5);
    expect(DAVET_REASONLARI).toContain("invite_second_level");
    const t = tavanIcin("invite_second_level");
    expect(t?.limit).toBe(PUAN.inviteWeeklyCap);
    expect(t?.reasons).toEqual(DAVET_REASONLARI);
  });
  it("görev ödülü kişi başı kayan 7 günde 1000 (kulüp bütçesi kulüp sayısıyla çarpılmasın — C2b)", () => {
    expect(tavanIcin("task_done")).toMatchObject({ reasons: ["task_done"], limit: PUAN.taskWeeklyCap });
    expect(DAVET_REASONLARI).not.toContain("task_done");
  });
  it("canlılık havuzu DAVET tavanına girmez; kendi kişi başı haftalık tavanı var", () => {
    expect(DAVET_REASONLARI).not.toContain("vitality_pool");
    expect(DAVET_KAYNAKLI).not.toContain("vitality_pool");
    const t = tavanIcin("vitality_pool");
    expect(t?.reasons).toEqual(["vitality_pool"]);
    expect(t?.limit).toBe(PUAN.vitalityWeeklyCap);
    // Pencere içinde bulunulan TR haftası (dağıtım haftada bir, pazartesi yazılır)
    expect(t?.since.getTime()).toBe(isoHafta(new Date()).baslangic.getTime());
  });
});

describe("canlılık V ve havuz (F5-02, PRD §4.2)", () => {
  it.each([
    // ilerleyen, tamamlama, beğenili yorum, kaynak → V
    [0, 0, 0, 0, 0],
    [4, 1, 2, 1, 10],
    [10, 0, 0, 0, 10],
    [0, 0, 1, 0, 0.5],
    [20, 5, 10, 3, 46],
  ])("V(%i, %i, %i, %i) = %s", (ilerleyen, tamamlama, begeniliYorum, kaynak, v) => {
    expect(canlilikV({ ilerleyen, tamamlama, begeniliYorum, kaynak })).toBe(v);
  });

  it.each([
    [0, 0],
    [9.5, 0],
    [HAVUZ_ESIK, 36],
    [46, 58],
    [100, 69],
    [1000, HAVUZ_TAVAN],
    [1e6, HAVUZ_TAVAN],
  ])("havuz(%s) = %i", (v, beklenen) => expect(havuz(v)).toBe(beklenen));

  it("logaritmik: 100 kat canlı kurs ~3 kat alır", () => {
    expect(havuz(1000) / havuz(10)).toBeLessThan(3);
  });
});

describe("havuz dağıtımı 50 / 30 / 20", () => {
  const m = (o: Record<number, number>) => new Map(Object.entries(o).map(([k, v]) => [Number(k), v]));
  const dagit = (toplam: number, katki: Record<number, number>, davet: Record<number, number>) =>
    Object.fromEntries(havuzDagit(toplam, 1, m(katki), m(davet)));

  it.each([
    ["hak sahibi yok: yalnız üretici dilimi", 100, {}, {}, { 1: 50 }],
    ["katkıcılar beğeni payına göre", 100, { 2: 2, 3: 1 }, {}, { 1: 50, 2: 20, 3: 10 }],
    ["dilim içi artık üreticiye", 100, { 2: 1, 3: 1, 4: 1, 5: 1 }, {}, { 1: 52, 2: 7, 3: 7, 4: 7, 5: 7 }],
    ["üretici katkıcı diliminden pay almaz", 100, { 1: 9 }, {}, { 1: 50 }],
    ["davet edenler davetli payına göre", 100, {}, { 2: 3, 3: 1 }, { 1: 50, 2: 15, 3: 5 }],
    ["aynı kişi iki dilimden: TOPLANIR", 100, { 2: 3 }, { 1: 2, 2: 1 }, { 1: 64, 2: 36 }],
    ["dilim yuvarlama artığı üreticiye", 36, { 2: 1 }, { 3: 1 }, { 1: 19, 2: 10, 3: 7 }],
    ["0 ağırlık pay almaz", 100, { 2: 0, 3: 4 }, {}, { 1: 50, 3: 30 }],
    ["havuz yoksa dağıtım yok", 0, { 2: 1 }, { 3: 1 }, {}],
  ])("%s", (_ad, toplam, katki, davet, beklenen) => {
    expect(dagit(toplam, katki, davet)).toEqual(beklenen);
  });

  it("her dilim doluyken dağıtılan toplam = havuz; payı 0 olan yazılmaz", () => {
    for (let toplam = 36; toplam <= 100; toplam++) {
      const p = havuzDagit(toplam, 1, m({ 2: 5, 3: 2, 4: 1 }), m({ 5: 1, 6: 1, 7: 1 }));
      expect([...p.values()].reduce((a, b) => a + b, 0)).toBe(toplam);
      expect([...p.values()].every((v) => v > 0)).toBe(true);
    }
  });
});

describe("TR saatli ISO hafta", () => {
  it.each([
    ["2026-10-12T00:00:00+03:00", "2026-W42"], // pazartesi 00:00 TR
    ["2026-10-11T23:59:59+03:00", "2026-W41"],
    ["2026-10-11T21:30:00Z", "2026-W42"], // UTC'de pazar, TR'de pazartesi 00:30
    ["2026-01-01T12:00:00+03:00", "2026-W01"],
    ["2027-01-01T12:00:00+03:00", "2026-W53"], // cuma: perşembesi 2026'da
    ["2024-12-30T09:00:00+03:00", "2025-W01"],
    ["2026-12-31T23:00:00+03:00", "2026-W53"],
  ])("%s → %s", (an, etiket) => expect(isoHafta(new Date(an)).etiket).toBe(etiket));

  it("pencere pazartesi 00:00 TR → sonraki pazartesi", () => {
    const h = isoHafta(new Date("2026-10-14T15:00:00+03:00"));
    expect(h.baslangic.toISOString()).toBe(new Date("2026-10-12T00:00:00+03:00").toISOString());
    expect(h.bitis.toISOString()).toBe(new Date("2026-10-19T00:00:00+03:00").toISOString());
  });

  it("son tamamlanan hafta: pazartesi sabahı bir önceki hafta", () => {
    expect(sonTamamlananHafta(new Date("2026-10-19T06:00:00+03:00")).etiket).toBe("2026-W42");
    expect(sonTamamlananHafta(new Date("2026-10-18T23:59:00+03:00")).etiket).toBe("2026-W41");
  });
});

describe("ekonomi kartı özeti (F5-03)", () => {
  const ham: EkonomiHam = {
    basilan: 1000,
    aktif: 8,
    davet: 400,
    kesinlesen: 10,
    kirpilan: 2,
    dusen: 5,
    kursKatilim: 20,
    kursAktif: 10,
    kursBiten: 5,
    etkinlikKayit: 40,
    etkinlikGiris: 30,
  };
  it("oranlar", () => {
    expect(ekonomiOzeti(ham)).toEqual({
      uyeBasina: 125,
      davetPayi: 0.4,
      davetUyari: true,
      kirpilanOran: 0.2,
      dusenOran: 5 / 15,
      kursAktivasyon: 0.5,
      kursTamamlama: 0.25,
      etkinlikGiris: 0.75,
    });
  });
  it.each([
    [399, false],
    [400, true],
    [1000, true],
  ])("davet %i / 1000 → uyarı %s (eşik %%40)", (davet, uyari) => {
    expect(DAVET_PAYI_ESIK).toBe(0.4);
    expect(ekonomiOzeti({ ...ham, davet }).davetUyari).toBe(uyari);
  });
  it("boş hafta: sıfıra bölme yok", () => {
    const bos = Object.fromEntries(Object.keys(ham).map((k) => [k, 0])) as EkonomiHam;
    expect(ekonomiOzeti(bos)).toEqual({
      uyeBasina: 0,
      davetPayi: 0,
      davetUyari: false,
      kirpilanOran: 0,
      dusenOran: 0,
      kursAktivasyon: 0,
      kursTamamlama: 0,
      etkinlikGiris: 0,
    });
  });
});

describe("suistimal eşiği (F5-04) — tarama SQL'inin saf eşleniği", () => {
  it.each([
    // kodla katılan yeni hesap (24 s), en çok ziyaret eden IP'nin ziyareti, farklı IP → şüpheli mi
    [SUISTIMAL_ESIK, SUISTIMAL_ESIK, 1, true], // tek cihazdan 5 kukla
    [SUISTIMAL_ESIK - 1, 9, 1, false], // az hesap
    [9, SUISTIMAL_ESIK - 1, 3, false], // hiçbir IP yeterince tekrar etmemiş
    [6, 6, 6, false], // 6 gerçek üye (6 IP), biri 6 kez tıklamış
    [6, 10, 7, false], // 6 gerçek üye + üçüncü kişinin 10 curl isteği: IP EKLER, işaretletemez
    [5, 5, 5, false], // davet eden kendi bağlantısını 5 kez açmış, 4 arkadaş + kendisi
    [5, 5, 3, false], // 3 ağ, 5 hesap: yarıyı geçiyor (aile / yurt) — işaret yok
    [6, 6, 3, true], // 3 ağ, 6 hesap: "az ağ, çok hesap"
    [12, 24, 3, true], // aynı ağdan (konferans Wi-Fi) kalabalık: PRD "aynı IP imzası" — admin temizler
  ])("hesap %i, en çok IP ziyareti %i, farklı IP %i → %s", (yeniHesap, enCokIpZiyaret, farkliIp, beklenen) => {
    expect(suistimalMi({ yeniHesap, enCokIpZiyaret, farkliIp })).toBe(beklenen);
  });
});
