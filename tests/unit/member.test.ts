import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { kayitImzasi, ozelAgMi } from "@/lib/member.ts";
import { kisaHash } from "@/lib/davet.ts";

const ctx = (clientAddress?: string) => ({ locals: { auth: () => ({ userId: null }) }, ...(clientAddress !== undefined ? { clientAddress } : {}) }) as never;

describe("kayıt imzası (Faz 5 kök çözüm)", () => {
  it.each(["127.0.0.1", "::1", "::ffff:127.0.0.1", "0.0.0.0", "10.0.0.5", "192.168.1.9", "172.20.3.4", "172.31.255.1", "fd00::1", "fe80::1"])(
    "yerel / özel ağ %s → imza yok (dev = canlı DB)",
    (ip) => {
      expect(ozelAgMi(ip)).toBe(true);
      expect(kayitImzasi(ctx(ip))).toBeNull();
    },
  );
  it.each(["203.0.113.7", "172.32.0.1", "11.0.0.1", "2a02:4780:1:1::1"])("herkese açık %s → HMAC'li kısa hash, ham IP yok", (ip) => {
    expect(ozelAgMi(ip)).toBe(false);
    const imza = kayitImzasi(ctx(ip));
    expect(imza).toBe(kisaHash(ip));
    expect(imza).toHaveLength(32);
    expect(imza).not.toContain(ip.split(":")[0]!.split(".")[0]!);
  });
  it("adres yok ya da getter fırlatır → null (statik önizleme, test)", () => {
    expect(kayitImzasi(ctx())).toBeNull();
    expect(kayitImzasi(ctx(""))).toBeNull();
    const firlatan = { locals: { auth: () => ({ userId: null }) }, get clientAddress(): string { throw new Error("yok"); } } as never;
    expect(kayitImzasi(firlatan)).toBeNull();
  });
});

describe("kayıt imzası sayfalara sızmaz — bekçi", () => {
  const dosyalar = (kok: string): string[] =>
    readdirSync(kok).flatMap((ad) => {
      const yol = join(kok, ad);
      return statSync(yol).isDirectory() ? dosyalar(yol) : /\.(astro|ts|tsx|mjs)$/.test(ad) ? [yol] : [];
    });
  it("signupIpHash / signup_ip_hash yalnız schema, member ve ekonomi'de geçer", () => {
    const sizan = ["src/pages", "src/features", "src/components", "src/layouts"].flatMap(dosyalar).filter((d) => /signupIpHash|signup_ip_hash/.test(readFileSync(d, "utf8")));
    expect(sizan).toEqual([]);
    const okuyanlar = dosyalar("src/lib").filter((d) => /signupIpHash|signup_ip_hash/.test(readFileSync(d, "utf8")));
    expect(okuyanlar.sort()).toEqual(["src/lib/economy.ts", "src/lib/ekonomi.ts", "src/lib/member.ts"]); // economy.ts: yalnız saf eşlenik yorumu
  });
});
