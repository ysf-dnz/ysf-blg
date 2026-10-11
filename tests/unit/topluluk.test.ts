import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema.ts";
import { ilBul, ILLER, KULUP_TUR, kulupTuruMu, turEtiketi } from "@/lib/topluluk.ts";

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
