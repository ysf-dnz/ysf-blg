/**
 * GET /api/cron/gunluk — DB'SİZ: db ve bütün iş fonksiyonları sahte (vi.mock), tarih vi.setSystemTime.
 * Kilitlenen kurallar: yetki (401), adım sırası (tarama HER ŞEYDEN ÖNCE, havuz en sonda), adım yalıtımı
 * (tarama fırlatırsa 1–8 koşar ve hata rapora yazılır — devir B2), CANLILIK_ILK_HAFTA kapısı ve hafta kilidi
 * (periodKey = son TAMAMLANAN TR haftası), sezon-kapat kilidinin yalnız bitişi geçmiş sezonda alınması.
 * Canlı DB'de bu ucu çağırmak bütün işleri gerçek veride koşturur; o yüzden yalnız böyle sınanır.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  process.env.CRON_SECRET = "itest-cron";
  return {
    log: [] as string[],
    tarama: vi.fn(async (): Promise<{ id: number; inviter_id: number }[]> => []),
    havuz: vi.fn(async () => ({ kurs: 0, puan: 0 })),
    sezonBitis: new Date("2099-01-01T00:00:00Z"),
  };
});
vi.mock("@/db/client.ts", async () => ({
  db: { query: { clubLeagues: { findMany: async () => (h.log.push("ozelLigleriKapat"), []) } } },
  schema: await import("@/db/schema.ts"),
}));
vi.mock("@/lib/cron.ts", () => ({
  birKez: vi.fn(async () => true),
  birKezCalistir: vi.fn(async (job: string) => (h.log.push(job), undefined)),
}));
vi.mock("@/lib/league.ts", () => ({
  aktifSezon: vi.fn(async () => (h.log.push("aktifSezon"), { id: 77, name: "itest sezon", startsAt: new Date(0), endsAt: h.sezonBitis })),
  kulupIciSiralama: vi.fn(),
  kulupSiralamasi: vi.fn(),
}));
vi.mock("@/lib/etkinlik.ts", () => ({
  etkinlikSonrasiIsle: vi.fn(async () => (h.log.push("etkinlikSonrasiIsle"), { host: 0, iyiDegerlendirme: 0 })),
}));
vi.mock("@/lib/rewards.ts", async (orig) => ({
  ...(await orig<typeof import("@/lib/rewards.ts")>()),
  awardBadge: vi.fn(),
  bekleyenleriIsle: vi.fn(),
  hazineKitabiAc: vi.fn(),
}));
vi.mock("@/lib/social.ts", () => ({ isaretsizKazananSql: {} }));
vi.mock("@/lib/ekonomi.ts", () => ({
  suistimalTara: () => (h.log.push("suistimalTara"), h.tarama()),
  canlilikHavuzuDagit: () => h.havuz(),
}));

import { birKezCalistir } from "@/lib/cron.ts";
import { GET } from "@/pages/api/cron/gunluk.ts";

const istek = (yetki = "Bearer itest-cron") =>
  GET({ request: new Request("http://localhost/api/cron/gunluk", { headers: { authorization: yetki } }) } as never);
const PAZARTESI_W43 = new Date("2026-10-19T03:00:00Z"); // 06:00 TR, cron saati; son tamamlanan hafta 2026-W42
const SALI_W42 = new Date("2026-10-13T03:00:00Z"); // son tamamlanan hafta 2026-W41 (açılıştan önce)

describe("GET /api/cron/gunluk (DB'siz)", () => {
  beforeEach(() => {
    h.log.length = 0;
    vi.mocked(birKezCalistir).mockClear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PAZARTESI_W43);
  });
  afterEach(() => vi.useRealTimers());

  it("yetkisiz istek 401; hiçbir iş çağrılmaz", async () => {
    expect((await istek("Bearer yanlis")).status).toBe(401);
    expect(h.log).toEqual([]);
  });

  it("adım sırası: tarama HER ŞEYDEN ÖNCE, bekleyen lig kapanışından sonra, havuz en sonda; hafta kilidi son tamamlanan TR haftası", async () => {
    const r = await istek();
    expect(r.status).toBe(200);
    expect(h.log).toEqual([
      "suistimalTara",
      "bayat-gorev",
      "aktifSezon",
      "ozelLigleriKapat",
      "bekleyen",
      "davet-ziyaret-temizlik",
      "etkinlikSonrasiIsle",
      "canlilik-havuzu",
    ]);
    expect(vi.mocked(birKezCalistir).mock.calls.find((c) => c[0] === "canlilik-havuzu")?.[1]).toBe("2026-W42");
    expect(vi.mocked(birKezCalistir).mock.calls.find((c) => c[0] === "bekleyen")?.[1]).toBe("2026-10-19");
    expect(await r.json()).toEqual({ ok: true }); // sahte işler undefined döndü → rapor boş
  });

  it("CANLILIK_ILK_HAFTA kapısı: açılıştan önceki hafta için havuz adımı hiç çağrılmaz", async () => {
    vi.setSystemTime(SALI_W42);
    await istek();
    expect(h.log).not.toContain("canlilik-havuzu");
    expect(h.log).toContain("bekleyen"); // öbür adımlar koşar
  });

  it("D4 (karakterizasyon): havuz telafisi yalnız SON tamamlanan haftaya bakar — bir TR haftası boyunca hiç ulaşılamazsa o hafta hiç denenmez", async () => {
    vi.setSystemTime(new Date("2026-11-02T03:00:00Z")); // pazartesi 06:00 TR; son tamamlanan 2026-W44, W43 bütün hafta kaçırıldı
    await istek();
    const haftalar = vi.mocked(birKezCalistir).mock.calls.filter((c) => c[0] === "canlilik-havuzu").map((c) => c[1]);
    expect(haftalar).toEqual(["2026-W44"]); // W43 için çağrı yok
  });
  it.todo("D4 karar (#42): atlanan haftaların telafisi (son N tamamlanan hafta) — devir §1 D4");

  it("tarama fırlatırsa (B2): yanıt 200, rapor.suistimalHata dolu, 1–8 adımlarının tamamı koşar", async () => {
    h.tarama.mockRejectedValueOnce(new Error("itest: tarama patladı"));
    const r = await istek();
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, suistimalHata: "itest: tarama patladı" });
    expect(h.log.slice(1)).toEqual(["bayat-gorev", "aktifSezon", "ozelLigleriKapat", "bekleyen", "davet-ziyaret-temizlik", "etkinlikSonrasiIsle", "canlilik-havuzu"]);
  });

  it("işaretlenen sayısı rapora yazılır", async () => {
    h.tarama.mockResolvedValueOnce([{ id: 1, inviter_id: 2 }, { id: 3, inviter_id: 2 }]);
    expect(await (await istek()).json()).toMatchObject({ suistimal: 2 });
  });

  it("sezon-kapat kilidi YALNIZ bitişi geçmiş sezonda alınır (aktifSezon böyle bir sezon döndürmez → dal ölü; devir C1)", async () => {
    await istek();
    expect(vi.mocked(birKezCalistir).mock.calls.some((c) => c[0] === "sezon-kapat")).toBe(false);
    h.sezonBitis.setTime(new Date("2026-10-01T00:00:00Z").getTime());
    try {
      await istek();
      expect(vi.mocked(birKezCalistir).mock.calls.find((c) => c[0] === "sezon-kapat")?.[1]).toBe("77");
    } finally {
      h.sezonBitis.setTime(new Date("2099-01-01T00:00:00Z").getTime());
    }
  });
});
