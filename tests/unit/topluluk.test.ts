import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema.ts";
import { ilBul, ILLER, KULUP_TUR, kulupAdiTemizle, kulupTuruMu, turEtiketi } from "@/lib/topluluk.ts";

describe("topluluk türleri (F3-01)", () => {
  it("etiket haritası şema enum'uyla birebir (vakıf · dernek · kurum dahil)", () => {
    expect(Object.keys(KULUP_TUR).sort()).toEqual([...schema.clubs.kind.enumValues].sort());
    expect(Object.keys(KULUP_TUR)).toEqual(expect.arrayContaining(["vakif", "dernek", "kurum"]));
  });
  it.each([
    ["universite", true],
    ["vakif", true],
    ["kurum", true],
    ["", false],
    ["sirket", false],
    ["toString", false], // prototip anahtarı beyaz listeyi geçemez
    ["__proto__", false],
  ])("tür %j geçerli mi → %s", (s, beklenen) => {
    expect(kulupTuruMu(s)).toBe(beklenen);
  });
  it("bilinmeyen (eski) değerde etiket ham metne düşer", () => {
    expect(turEtiketi("vakif")).toBe(KULUP_TUR.vakif);
    expect(turEtiketi("eski-tur")).toBe("eski-tur");
  });
});

describe("il listesi", () => {
  it("81 il, Türkçe alfabetik", () => {
    expect(ILLER).toHaveLength(81);
    expect(ILLER[0]).toBe("Adana");
    expect(ILLER.indexOf("Çanakkale")).toBeLessThan(ILLER.indexOf("Denizli"));
    expect(ILLER.indexOf("İzmir")).toBeGreaterThan(ILLER.indexOf("Isparta"));
  });
  it.each([
    ["Ankara", "Ankara"],
    ["  ankara ", "Ankara"],
    ["ANKARA", "Ankara"],
    ["İSTANBUL", "İstanbul"],
    ["izmir", "İzmir"],
    ["Istanbul", "İstanbul"], // ASCII klavye: noktasız büyük I
    ["IZMIR", "İzmir"],
    ["ıgdır", null], // ğ'siz yazım eşleşmez
    ["IĞDIR", "Iğdır"],
    ["isparta", "Isparta"],
    ["Ankra", null],
    ["", null],
    [null, null],
  ])("il %j → %j", (girdi, beklenen) => {
    expect(ilBul(girdi)).toBe(beklenen);
  });
});

describe("topluluk adı (F4-01)", () => {
  it.each([
    ["ODTÜ Yapay Zekâ Okuma Kulübü", "ODTÜ Yapay Zekâ Okuma Kulübü"],
    ["  İzmir   Okuma\tVakfı \n", "İzmir Okuma Vakfı"], // boşluklar tekilleşir
    ["Go & Rust 101 📚", "Go & Rust 101 📚"], // & ve emoji serbest (kaçış render'da)
    ["abc", "abc"],
    ["a".repeat(60), "a".repeat(60)],
    ["ab", null], // 3'ten kısa
    ["a".repeat(61), null], // 60'tan uzun: kesilmez, reddedilir
    ["   ", null],
    ["12345", null], // harf yok
    ["<script>alert(1)</script>", null],
    ["Kulüp > Vakıf", null],
    ["Okuma\u0000Kulübü", null], // kontrol karakteri
    ["Okuma\u202EübüluK", null], // bidi yön değiştirici (görsel taklit)
    ["Oku\u200Bma Kulübü", null], // sıfır genişlikli boşluk
    ["\u3164\u3164\u3164", null], // Hangul dolgu: \p{L} ama görünmez → tamamen boş görünen ad
    ["Okuma\u3164Kulübü", null],
    ["\u2800\u2800abc", null], // Braille boşluğu
    [null, null],
  ])("ad %j → %j", (girdi, beklenen) => {
    expect(kulupAdiTemizle(girdi)).toBe(beklenen);
  });
});
