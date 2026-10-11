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
  it.each([
    "[x](javascript:alert(1))",
    "[x](JaVaScRiPt:alert(1))",
    "[x](&#106;avascript:alert(1))", // entity ile gizlenmiş şema — tarayıcı özniteliği çözer
    "[x](data:text/html,x)",
    "[x](//evil.com)",
    "[x][1]\n\n[1]: javascript:alert(1)", // referans stili
  ])("tehlikeli bağlantı hedefi etkisizleşir: %s", (md) => {
    const out = renderMemberMarkdown(md);
    expect(out).toContain('href="#"');
    expect(out).not.toMatch(/javascript|data:|evil|&#106;/i);
  });
  it("tehlikeli görsel kaynağı boşalır", () => {
    expect(renderMemberMarkdown("![i](javascript:alert(1))")).toContain('src=""');
  });
  it.each(["https://ok.com/a?b=1", "/kurslar/x?b=1", "#bolum", "mailto:a@b.c"])("güvenli hedef korunur: %s", (href) => {
    expect(renderMemberMarkdown(`[x](${href})`)).toContain(`href="${href}"`);
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
