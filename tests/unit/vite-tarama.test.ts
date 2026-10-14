import { readdirSync, readFileSync } from "node:fs";
import { transformWithEsbuild } from "vite";
import { describe, expect, it } from "vitest";

// Vite bağımlılık taraması (optimizer/scan.ts) .astro dosyasını HTML gibi okur: yorumları atar, bu desene
// uyan her <script>…</script> bloğunu TS olarak ayrıştırır. Ön bölüm yorumunda ya da metinde düz "<script>"
// yazısı sahte bir blok açar (ilk </script>'e kadar her şey kod sanılır) → tarama çöker, bağımlılıklar geç
// keşfedilir, dev sunucusu ~60 sn sonra "optimized dependencies changed. reloading" ile tam sayfa yeniler ve
// açık dialog'lu e2e'ler düşer (D3Chart yorumunda yaşandı: `Expected ";" but found "kaydedilir"`).
// Desenler Vite 7'den birebir kopya; Vite bunları değiştirirse burası da değişir.
const scriptRE = /(<script(?:\s+[a-z_:][-\w:]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^"'<>=\s]+))?)*\s*>)(.*?)<\/script>/gis;
const commentRE = /<!--.*?-->/gs;
const srcRE = /\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s'">]+))/i;
const typeRE = /\btype\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s'">]+))/i;
const langRE = /\blang\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s'">]+))/i;

const nitelik = (re: RegExp, etiket: string) => {
  const m = re.exec(etiket);
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
};

/** Taramanın ayrıştıracağı bloklar — Vite'ın atladıkları (JSON-LD gibi JS olmayan tür, src'li, boş) dışarıda. */
function taramaBloklari(kaynak: string) {
  const bloklar: { etiket: string; icerik: string; loader: "ts" | "tsx" | "jsx" }[] = [];
  for (const [, etiket, icerik] of kaynak.replace(commentRE, "<!---->").matchAll(scriptRE)) {
    const tur = nitelik(typeRE, etiket);
    if (tur && !(tur.includes("javascript") || tur.includes("ecmascript") || tur === "module")) continue;
    if (srcRE.test(etiket) || !icerik.trim()) continue;
    const dil = nitelik(langRE, etiket);
    bloklar.push({ etiket, icerik, loader: dil === "tsx" || dil === "jsx" ? dil : "ts" });
  }
  return bloklar;
}

const ayristirmaHatasi = async (blok: ReturnType<typeof taramaBloklari>[number]) => {
  try {
    // tsconfigRaw dize → Vite tsconfig aramaz; ayrıştırma hatası yalnız sözdiziminden gelir
    await transformWithEsbuild(blok.icerik, "tarama.ts", { loader: blok.loader, tsconfigRaw: "{}" });
    return null;
  } catch (e) {
    return (e as { errors?: { text: string }[] }).errors?.[0]?.text ?? String(e);
  }
};

describe("Vite bağımlılık taraması .astro betiklerini ayrıştırabilir", () => {
  it("yorumdaki düz <script> yazısı sahte blok açar ve yakalanır (bekçinin kendi sınaması)", async () => {
    const kaynak = [
      "---",
      "/**",
      " * MDX içinde bir <script> etiketiyle kaydedilir.",
      " */",
      "const a = 1;",
      "---",
      "<div>{a}</div>",
      "<script>",
      "  console.log(a);",
      "</script>",
    ].join("\n");
    const bloklar = taramaBloklari(kaynak);
    expect(bloklar).toHaveLength(1); // gerçek blok sahte bloğun içinde kaldı
    expect(await ayristirmaHatasi(bloklar[0])).toMatch(/Expected ";" but found "kaydedilir"/);
  });

  it("JSON-LD, src'li ve boş bloklar taranmaz; HTML yorumundaki <script> yazısı zararsız", () => {
    const kaynak = [
      '<script type="application/ld+json">{"a": 1}</script>',
      '<script src="/x.js"></script>',
      "<script>  </script>",
      "<!-- örnek: <script> -->",
      "<script>const b: number = 2;</script>",
    ].join("\n");
    expect(taramaBloklari(kaynak).map((b) => b.icerik)).toEqual(["const b: number = 2;"]);
  });

  it("src altındaki her .astro dosyası", async () => {
    const dosyalar = readdirSync("src", { recursive: true, encoding: "utf8" })
      .filter((d) => d.endsWith(".astro"))
      .map((d) => `src/${d}`);
    const hatalar: string[] = [];
    let blokSayisi = 0;
    for (const dosya of dosyalar) {
      for (const blok of taramaBloklari(readFileSync(dosya, "utf8"))) {
        blokSayisi++;
        const hata = await ayristirmaHatasi(blok);
        if (hata) hatalar.push(`${dosya} ${blok.etiket}: ${hata}`);
      }
    }
    // Boş tarama yeşil görünmesin: dosyalar ve bloklar gerçekten okundu
    expect(dosyalar.length).toBeGreaterThan(50);
    expect(blokSayisi).toBeGreaterThan(10);
    expect(hatalar).toEqual([]);
  });
});
