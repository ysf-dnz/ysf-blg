import { describe, expect, it } from "vitest";
import {
  parseBookFileName,
  titleMatchScore,
} from "../../scripts/lib/book-title.ts";

describe("parseBookFileName", () => {
  it("Z-Library ekli ad: yazar parantezini ayırır, gürültüyü atar", () => {
    const r = parseBookFileName(
      "Designing Interfaces Patterns for Effective Interaction Design (Jenifer Tidwell, Charles Brewer, Aynne Valencia) (Z-Library).pdf",
    );
    expect(r.title).toBe(
      "Designing Interfaces Patterns for Effective Interaction Design",
    );
    expect(r.author).toBe("Jenifer Tidwell, Charles Brewer, Aynne Valencia");
  });

  it("(by-Yazar)- kalıbı ve zaman damgası", () => {
    const r = parseBookFileName(
      "(by-Brian-Allbee)-Hands-On-Software-Engineering-wi_230516_080832.pdf",
    );
    expect(r.author).toBe("Brian Allbee");
    expect(r.title).toBe("Hands On Software Engineering Wi");
  });

  it("yıl parantezi başlıktan temizlenir, yazar üretmez", () => {
    const r = parseBookFileName("AI-Powered Developer (2023).pdf");
    expect(r.title).toBe("AI-Powered Developer");
    expect(r.author).toBeUndefined();
  });

  it("epub uzantısı ve yazar parantezi", () => {
    const r = parseBookFileName(
      "The Kaggle Workbook (Konrad Banachewicz, Luca Massaron) (Z-Library).epub",
    );
    expect(r.title).toBe("The Kaggle Workbook");
    expect(r.author).toBe("Konrad Banachewicz, Luca Massaron");
  });

  it("düz ad olduğu gibi kalır", () => {
    expect(parseBookFileName("Programming Quantum Computers.pdf").title).toBe(
      "Programming Quantum Computers",
    );
  });
});

describe("titleMatchScore", () => {
  it("aynı kitap farklı yazımda yüksek skor alır", () => {
    expect(
      titleMatchScore(
        "Programming Quantum Computers",
        "Programming Quantum Computers: Essential Algorithms",
      ),
    ).toBeGreaterThan(0.9);
  });

  it("alakasız başlıklar düşük skor alır", () => {
    expect(
      titleMatchScore("Programming Quantum Computers", "Osmanlı Tarihi"),
    ).toBeLessThan(0.2);
  });
});
