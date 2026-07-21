import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Callout from "@/components/mdx/Callout.astro";

describe("Callout", () => {
  it("varsayılan tip bilgi ve başlığı gösterir", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Callout, {
      slots: { default: "İçerik metni" },
    });
    expect(html).toContain("Bilgi");
    expect(html).toContain("İçerik metni");
  });

  it("uyari tipi kendi başlığını ve rengini kullanır", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Callout, {
      props: { type: "uyari" },
      slots: { default: "Dikkat!" },
    });
    expect(html).toContain("Uyarı");
    expect(html).toContain("amber");
  });

  it("özel başlık varsayılanı ezer", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Callout, {
      props: { type: "ipucu", baslik: "Pro tüyo" },
      slots: { default: "..." },
    });
    expect(html).toContain("Pro tüyo");
    expect(html).not.toContain(">İpucu<");
  });
});
