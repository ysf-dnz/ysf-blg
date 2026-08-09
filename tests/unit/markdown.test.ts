import { describe, expect, it } from "vitest";
import { renderMemberMarkdown, slugifyTitle } from "@/lib/markdown.ts";

describe("renderMemberMarkdown — XSS koruması", () => {
  it("script etiketi çalıştırılabilir HTML olarak çıkmaz", () => {
    const out = renderMemberMarkdown('<script>alert(1)</script>');
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script");
  });
  it("img onerror enjeksiyonu etkisiz", () => {
    const out = renderMemberMarkdown('<img src=x onerror=alert(1)>');
    expect(out).not.toContain("<img");
  });
  it("saf markdown çalışır", () => {
    const out = renderMemberMarkdown("## Başlık\n\n**kalın**");
    expect(out).toContain("<h2");
    expect(out).toContain("<strong>kalın</strong>");
  });
});

describe("slugifyTitle — Türkçe karakterler", () => {
  it("ışğüöç → isguoc", () =>
    expect(slugifyTitle("Işık Şölen Ğül Üzüm Öykü Çay")).toBe(
      "isik-solen-gul-uzum-oyku-cay",
    ));
  it("boş/sembol girdi 'yazi' fallback", () =>
    expect(slugifyTitle("!!!")).toBe("yazi"));
  it("60 karakterde kesilir", () =>
    expect(slugifyTitle("a".repeat(100)).length).toBeLessThanOrEqual(60));
});
