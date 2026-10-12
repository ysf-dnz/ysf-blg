import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import EkonomiKarti from "@/features/admin/EkonomiKarti.astro";

const kart = {
  basilan: 1000,
  aktif: 8,
  davet: 450,
  kesinlesen: 10,
  kirpilan: 2,
  dusen: 5,
  bekleyen: 7,
  kursKatilim: 20,
  kursAktif: 10,
  kursBiten: 5,
  etkinlikKayit: 40,
  etkinlikGiris: 30,
  kaynaklar: [
    { reason: "post_approved", puan: 550 },
    { reason: "course_invite_activated", puan: 450 },
  ],
};
const render = async (k: typeof kart) =>
  (await AstroContainer.create()).renderToString(EkonomiKarti, { props: { kart: k } });

describe("EkonomiKarti", () => {
  it("davet payı %40'ı geçince uyarı gösterir", async () => {
    const html = await render(kart);
    expect(html).toContain("data-davet-uyari");
    expect(html).toContain("%45");
    expect(html).toContain("course_invite_activated");
    expect(html).toContain("125"); // aktif üye başına
  });

  it("eşiğin altında uyarı yok", async () => {
    const html = await render({ ...kart, davet: 100 });
    expect(html).not.toContain("data-davet-uyari");
    expect(html).toContain("%10");
  });

  it("boş hafta: NaN / Infinity basmaz", async () => {
    const bos = { ...Object.fromEntries(Object.keys(kart).map((k) => [k, 0])), kaynaklar: [] } as unknown as typeof kart;
    const html = await render(bos);
    expect(html).not.toMatch(/NaN|Infinity/);
    expect(html).not.toContain("data-kaynaklar");
  });
});
