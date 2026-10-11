import { describe, expect, it } from "vitest";
import { belgeGezintisiMi } from "@/lib/urls.ts";

const istek = (basliklar: Record<string, string>) => new Request("https://yusufdeniz.com/x", { headers: basliklar });

describe("davet çerezi yalnız üst düzey belge gezintisinde kurulur", () => {
  it.each([
    [{ "sec-fetch-dest": "document" }, true],
    [{}, true], // başlığı göndermeyen eski tarayıcı (karsilama.ts ile aynı kural)
    [{ "sec-fetch-dest": "image" }, false], // aynı kökenli <img src="…?d=KOD"> atfı çalamaz
    [{ "sec-fetch-dest": "empty" }, false], // fetch / prefetch / ClientRouter
    [{ "sec-fetch-dest": "iframe" }, false],
    [{ "sec-fetch-dest": "script" }, false],
  ])("%j → %s", (basliklar, beklenen) => {
    expect(belgeGezintisiMi(istek(basliklar))).toBe(beklenen);
  });
});
