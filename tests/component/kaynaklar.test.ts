import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Kaynaklar from "@/features/posts/Kaynaklar.astro";

describe("Kaynaklar", () => {
  it("kaynak listesini başlıkla render eder", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Kaynaklar, {
      props: {
        kaynaklar: [
          { baslik: "Bir Makale", url: "https://example.com/makale", tur: "makale" },
        ],
      },
    });
    expect(html).toContain("Bu yazının kaynakları");
    expect(html).toContain("Bir Makale");
    expect(html).toContain("https://example.com/makale");
  });

  it("notebooklm türünde kutuphanem linki ekler", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Kaynaklar, {
      props: {
        kaynaklar: [
          {
            baslik: "AI Ajanları Defteri",
            url: "https://notebooklm.google.com/notebook/abc",
            tur: "notebooklm",
          },
        ],
      },
    });
    expect(html).toContain("ysf-dnz.github.io/kutuphanem");
    expect(html).toContain("📔");
  });

  it("boş listede hiçbir şey render etmez", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Kaynaklar, {
      props: { kaynaklar: [] },
    });
    expect(html).not.toContain("Bu yazının kaynakları");
  });
});
