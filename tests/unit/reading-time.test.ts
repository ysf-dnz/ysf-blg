import { describe, expect, it } from "vitest";
import { readingTimeMinutes } from "@/lib/reading-time.ts";

describe("readingTimeMinutes", () => {
  it("kısa metin için en az 1 dakika döner", () => {
    expect(readingTimeMinutes("Merhaba dünya")).toBe(1);
  });

  it("200 kelime/dk hızına göre hesaplar", () => {
    const words = Array.from({ length: 600 }, (_, i) => `kelime${i}`).join(" ");
    expect(readingTimeMinutes(words)).toBe(3);
  });

  it("frontmatter'ı kelime sayımına katmaz", () => {
    const raw = `---\ntitle: ${"uzun ".repeat(300)}\n---\nkısa metin`;
    expect(readingTimeMinutes(raw)).toBe(1);
  });

  it("kod bloklarını kelime yerine satır süresiyle sayar", () => {
    const code = "```ts\n" + "const x = 1;\n".repeat(30) + "```";
    const raw = `Açıklama paragrafı.\n${code}`;
    // 30 satır × 2 sn = 1 dk
    expect(readingTimeMinutes(raw)).toBe(1);
  });

  it("Türkçe karakterli kelimeleri sayar", () => {
    const words = Array.from({ length: 400 }, () => "öğrenme şeması ığdır çalışma").join(" ");
    expect(readingTimeMinutes(words)).toBeGreaterThan(4);
  });
});
