import { describe, expect, it } from "vitest";
import { hostPaylari, hostToplami, iyiDegerlendirildiMi } from "@/lib/economy.ts";
import { PUAN } from "@/lib/points.ts";
import { DAVET_REASONLARI, tavanIcin } from "@/lib/rewards.ts";
import {
  base32,
  biletCoz,
  biletQrIcerigi,
  biletToken,
  degerlendirmeAcikMi,
  DONEN_PENCERE_SN,
  donenGecerli,
  donenPencere,
  donenQrIcerigi,
  donenToken,
  etkinlikBitis,
  girisPenceresinde,
  icsUret,
  kayitAcikMi,
  trAralik,
  trGirdi,
  trTarihOku,
} from "@/lib/etkinlik-kural.ts";

const SIR = "test-sirri";
const t = (s: string) => new Date(s);

describe("düzenleyen payları (F3-06)", () => {
  it.each([
    [0, 0],
    [1, 5],
    [99, 495],
    [100, 500],
    [101, 500], // kabul: 101 girişte toplam 500
    [5000, 500],
    [-3, 0],
  ])("%i giriş → toplam %i", (giris, toplam) => {
    expect(hostToplami(giris)).toBe(toplam);
  });

  it.each([
    // toplam, host'lar, açan → beklenen paylar (host sırasıyla)
    [500, [1, 2, 3], 3, [166, 166, 168]], // kabul: kalan açana
    [500, [1, 2, 3], 1, [168, 166, 166]],
    [500, [7], 7, [500]],
    [500, [1, 2], 2, [250, 250]],
    [500, [1, 2, 3, 4], 4, [125, 125, 125, 125]],
    [5, [1, 2, 3], 2, [1, 3, 1]],
    [500, [1, 2, 3], null, [168, 166, 166]], // açan bilinmiyor → kalan ilk host'a
    [500, [1, 2, 3], 99, [168, 166, 166]], // açan host değil → ilk host'a
    [500, [1, 1, 2], 1, [250, 250]], // yinelenen host tekilleşir
  ])("%i puan, host %j, açan %s → %j", (toplam, hostlar, acan, beklenen) => {
    const p = hostPaylari(toplam, hostlar, acan);
    expect([...new Set(hostlar)].map((h) => p.get(h) ?? 0)).toEqual(beklenen);
    expect([...p.values()].reduce((a, b) => a + b, 0)).toBe(toplam);
  });

  it("payı 0 çıkan host sonuca girmez (0'lık ledger satırı idem anahtarını tüketmesin)", () => {
    const p = hostPaylari(2, [1, 2, 3], 1);
    expect([...p.entries()]).toEqual([[1, 2]]);
    expect(hostPaylari(0, [1, 2], 1).size).toBe(0);
    expect(hostPaylari(500, [], null).size).toBe(0);
  });

  it.each([
    [4.0, 10, true],
    [3.99, 50, false],
    [5, 9, false],
    [4.5, 10, true],
  ])("ort %f, %i değerlendirme → iyi mi %s", (ort, n, beklenen) => {
    expect(iyiDegerlendirildiMi(ort, n)).toBe(beklenen);
  });

  it("değişmez: bir etkinlik düzenleyenlere en çok 550 puan getirir (PRD §4.2)", () => {
    expect(hostToplami(10_000) + PUAN.eventWellRated).toBe(550);
  });
});

describe("etkinlik davet tavanı (F3-03)", () => {
  it("event_invite_attended davet havuzunda; welcome/hosted/well_rated tavansız", () => {
    expect(DAVET_REASONLARI).toContain("event_invite_attended");
    expect(tavanIcin("event_invite_attended")?.limit).toBe(PUAN.inviteWeeklyCap);
    expect(tavanIcin("event_invite_attended")?.reasons).toBe(DAVET_REASONLARI);
    expect(tavanIcin("event_invite_welcome")).toBeUndefined();
    expect(tavanIcin("event_hosted")).toBeUndefined();
    expect(tavanIcin("event_well_rated")).toBeUndefined();
    expect(tavanIcin("event_attended")).toBeUndefined();
  });
});

describe("etkinlik zaman pencereleri", () => {
  const e = { startsAt: t("2026-11-01T16:00:00Z"), endsAt: t("2026-11-01T18:00:00Z"), rsvpClosesAt: null };

  it("bitiş girilmemişse başlangıç + 2 saat", () => {
    expect(etkinlikBitis({ startsAt: e.startsAt, endsAt: null }).toISOString()).toBe("2026-11-01T18:00:00.000Z");
    expect(etkinlikBitis(e)).toBe(e.endsAt);
  });

  it.each([
    ["2026-11-01T14:59:59Z", false], // kapı açılışından önce
    ["2026-11-01T15:00:00Z", true], // başlangıç − 60 dk
    ["2026-11-01T17:00:00Z", true],
    ["2026-11-01T18:00:00Z", true], // bitiş anı dahil
    ["2026-11-01T18:00:01Z", false], // bitişten sonra giriş yazılmaz (AC-19 ile tutarlı)
  ])("giriş penceresi %s → %s", (an, beklenen) => {
    expect(girisPenceresinde(e, t(an))).toBe(beklenen);
  });

  it.each([
    [null, "2026-11-01T17:59:59Z", true], // kapanış yoksa bitişe kadar
    [null, "2026-11-01T18:00:00Z", false],
    ["2026-10-31T21:00:00Z", "2026-10-31T20:59:59Z", true],
    ["2026-10-31T21:00:00Z", "2026-10-31T21:00:00Z", false],
  ])("kayıt kapanışı %s, şimdi %s → açık mı %s", (kapanis, an, beklenen) => {
    expect(kayitAcikMi({ ...e, rsvpClosesAt: kapanis ? t(kapanis) : null }, t(an))).toBe(beklenen);
  });

  it.each([
    ["2026-11-01T15:59:59Z", false],
    ["2026-11-01T16:00:00Z", true],
    ["2026-11-08T18:00:00Z", true], // bitiş + 7 gün dahil
    ["2026-11-08T18:00:01Z", false],
  ])("değerlendirme penceresi %s → %s", (an, beklenen) => {
    expect(degerlendirmeAcikMi(e, t(an))).toBe(beklenen);
  });
});

describe("TR saatli girdi/çıktı (sunucu UTC'de koşar)", () => {
  it("datetime-local TR saati olarak okunur: 19:00 → 16:00Z", () => {
    expect(trTarihOku("2026-11-01T19:00")?.toISOString()).toBe("2026-11-01T16:00:00.000Z");
  });
  it.each(["", "2026-11-01", "2026-11-01T19:00:00Z", "2026-13-40T99:99", "bozuk", null, undefined])(
    "geçersiz girdi %j → null",
    (g) => {
      expect(trTarihOku(g)).toBeNull();
    },
  );
  it("gidiş-dönüş: okunan an yine aynı girdi değerini verir", () => {
    expect(trGirdi(trTarihOku("2026-11-01T19:00")!)).toBe("2026-11-01T19:00");
    expect(trGirdi(t("2026-12-31T22:30:00Z"))).toBe("2027-01-01T01:30");
  });
  it("aralık metni TR saatiyle", () => {
    expect(trAralik({ startsAt: t("2026-11-01T16:00:00Z"), endsAt: t("2026-11-01T18:00:00Z") })).toMatch(
      /1 Kasım 2026.*19:00–21:00/,
    );
  });
});

describe("bilet token'ı (ADR K6: {rsvpId}.{base32(HMAC('t:'+rsvpId))})", () => {
  it("biçim ve gidiş-dönüş", () => {
    const tok = biletToken(42, SIR);
    expect(tok).toMatch(/^42\.[0-9A-HJKMNP-TV-Z]{16}$/);
    expect(biletCoz(tok, SIR)).toBe(42);
    expect(biletCoz(tok.toLowerCase(), SIR)).toBe(42);
  });
  it("deterministik; sır değişince imza değişir", () => {
    expect(biletToken(42, SIR)).toBe(biletToken(42, SIR));
    expect(biletToken(42, SIR)).not.toBe(biletToken(42, "baska-sir"));
    expect(biletCoz(biletToken(42, SIR), "baska-sir")).toBeNull();
  });
  it.each([
    ["başka RSVP'nin imzası", (tok: string) => tok.replace(/^42\./, "43.")],
    ["bozuk imza", (tok: string) => tok.slice(0, -1) + (tok.endsWith("0") ? "1" : "0")],
    ["kısa imza", (tok: string) => tok.slice(0, -2)],
    ["imzasız", () => "42"],
    ["boş", () => ""],
    ["negatif id", (tok: string) => "-" + tok],
  ])("%s reddedilir", (_ad, boz) => {
    expect(biletCoz(boz(biletToken(42, SIR)), SIR)).toBeNull();
  });
  it("bilet ve dönen QR imzaları aynı sırla çakışmaz ('t:' / 'c:' önekleri)", () => {
    expect(biletToken(7, SIR).split(".")[1]!.slice(0, 10)).not.toBe(donenToken(7, 0, SIR));
  });
  it("QR içerikleri tamamen büyük harf (alfanümerik mod)", () => {
    const k = "https://yusufdeniz.com";
    expect(biletQrIcerigi(k, "42.abcdefgh12345678")).toBe("HTTPS://YUSUFDENIZ.COM/T/42.ABCDEFGH12345678");
    expect(donenQrIcerigi(k, 9, "abcde12345")).toBe("HTTPS://YUSUFDENIZ.COM/C/9/ABCDE12345");
    expect(biletQrIcerigi(k, biletToken(42, SIR))).toMatch(/^[0-9A-Z $%*+\-./:]+$/);
  });
});

describe("dönen QR (AC-17)", () => {
  const simdi = t("2026-11-01T16:10:07Z");
  const p = donenPencere(simdi);
  it.each([
    [0, true], // bu pencere
    [-1, true], // önceki pencere de geçerli
    [-2, false],
    [-4, false], // 2 dakika önceki ekran görüntüsü
    [1, false], // gelecekteki pencere
  ])("pencere farkı %i → geçerli mi %s", (fark, beklenen) => {
    expect(donenGecerli(5, donenToken(5, p + fark, SIR), simdi, SIR)).toBe(beklenen);
  });
  it("2 dakika önce üretilen token reddedilir", () => {
    const eski = donenToken(5, donenPencere(new Date(simdi.getTime() - 120_000)), SIR);
    expect(donenGecerli(5, eski, simdi, SIR)).toBe(false);
  });
  it("başka etkinliğin token'ı ve bozuk girdi reddedilir", () => {
    expect(donenGecerli(6, donenToken(5, p, SIR), simdi, SIR)).toBe(false);
    expect(donenGecerli(5, "", simdi, SIR)).toBe(false);
    expect(donenGecerli(5, null, simdi, SIR)).toBe(false);
    expect(donenGecerli(5, "KISA", simdi, SIR)).toBe(false);
  });
  it("küçük harf ve O/I yazımı normalleşir", () => {
    expect(donenGecerli(5, donenToken(5, p, SIR).toLowerCase(), simdi, SIR)).toBe(true);
  });
  it("pencere 30 sn", () => {
    expect(DONEN_PENCERE_SN).toBe(30);
    expect(donenPencere(t("2026-11-01T16:10:29.999Z"))).toBe(donenPencere(t("2026-11-01T16:10:00Z")));
    expect(donenPencere(t("2026-11-01T16:10:30Z"))).toBe(donenPencere(t("2026-11-01T16:10:00Z")) + 1);
  });
});

describe("base32", () => {
  it("Crockford alfabesi, istenen uzunluk", () => {
    expect(base32(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff]), 8)).toBe("ZZZZZZZZ");
    expect(base32(new Uint8Array([0, 0, 0, 0, 0]), 8)).toBe("00000000");
    expect(base32(new Uint8Array([0b00001_000, 0b10_00011_0]), 3)).toBe("123");
    expect(base32(new Uint8Array(32).fill(0xa5), 16)).toHaveLength(16);
  });
});

describe(".ics", () => {
  const e = {
    id: 9,
    title: "Go Atölyesi; canlı, kod",
    description: "Satır 1\nSatır 2",
    location: "ODTÜ, Ankara",
    startsAt: t("2026-11-01T16:00:00Z"),
    endsAt: null,
  };
  const ics = icsUret(e, "https://yusufdeniz.com/etkinlik/go-atolyesi-ab12cd", t("2026-10-11T10:00:00Z"));
  it("zorunlu alanlar, UTC anlar, CRLF", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("UID:etkinlik-9@yusufdeniz.com");
    expect(ics).toContain("DTSTART:20261101T160000Z");
    expect(ics).toContain("DTEND:20261101T180000Z"); // bitiş yok → +2 saat
    expect(ics).toContain("DTSTAMP:20261011T100000Z");
  });
  it("metin kaçışı (; , ve satır sonu)", () => {
    expect(ics).toContain("SUMMARY:Go Atölyesi\\; canlı\\, kod");
    expect(ics).toContain("DESCRIPTION:Satır 1\\nSatır 2");
    expect(ics).toContain("LOCATION:ODTÜ\\, Ankara");
  });
  it("uzun satır 75 oktette katlanır", () => {
    const uzun = icsUret({ ...e, description: "ç".repeat(200) }, "https://yusufdeniz.com/etkinlik/x");
    for (const satir of uzun.split("\r\n")) expect(Buffer.byteLength(satir)).toBeLessThanOrEqual(75);
  });
});
