import { describe, expect, it } from "vitest";
import { renderSVG } from "uqr";
import { KART_BOYUT, renderDavetKarti, type KartFormat } from "@/features/davet/kart.ts";

const PNG_IMZA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("davet kartı — satori + resvg (fontlar diskten, DB yok, dış URL yok)", () => {
  it.each(Object.keys(KART_BOYUT) as KartFormat[])(
    "%s formatı doğru boyutta PNG üretir",
    async (format) => {
      const png = await renderDavetKarti({
        format,
        baslik: "Girişimcilik: Sıfırdan Şirket Kurmak — İlk Adımlar ve Öğrenilen Dersler",
        vaat: "Fikirden ilk müşteriye kadar yol haritası; her öğe bir görevle biter.",
        meta: ["Başlangıç", "90 dk", "7 öğe"],
        davetEden: { ad: "Şükrü Çağlayan" },
        not: "Beraber bitirelim, ilk öğe 10 dakika 🙂",
        qrSvg: renderSVG("HTTPS://YUSUFDENIZ.COM/D/7KQ2MXA", { ecc: "M", border: 4 }),
        kisaLink: "yusufdeniz.com/d/7kq2mxa",
      });
      const [w, h] = KART_BOYUT[format];
      expect(png.subarray(0, 8).equals(PNG_IMZA)).toBe(true);
      // IHDR: genişlik 16-19, yükseklik 20-23 (big-endian)
      expect(png.readUInt32BE(16)).toBe(w);
      expect(png.readUInt32BE(20)).toBe(h);
    },
    15_000,
  );
});
