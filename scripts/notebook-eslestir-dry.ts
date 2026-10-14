/**
 * NotebookLM defter ↔ kitap eşleştirmesi — DRY-RUN (B3, 2026-10-14). books.json + kutuphanem.json okur, her kitap için
 * en iyi defteri ve skoru sync-drive-books.ts ile AYNI kuralla (titleMatchScore) hesaplar ve YALNIZ rapor yazar:
 * books.json / kutuphanem.json / DB'ye dokunmaz. 0.85 altı eşleşme Yusuf onaylamadan uygulanmaz.
 *   node --experimental-strip-types scripts/notebook-eslestir-dry.ts
 * Çıktı: docs/devir/notebook-eslestirme-adaylari.md
 */
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeForMatch, titleMatchScore } from "./lib/book-title.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIKTI = join(ROOT, "docs/devir/notebook-eslestirme-adaylari.md");
const ESIK = 0.85; // sync-drive-books.ts MATCH_THRESHOLD
const ADAY_ALT = 0.6;

type Kitap = { id: string; title: string; author?: string; notebookId?: string };
type Defter = { id: string; name: string; shared?: boolean; sourceCount?: number };

const ham = JSON.parse(await readFile(join(ROOT, "src/data/books.json"), "utf8"));
const kitaplar: Kitap[] = Array.isArray(ham) ? ham : (ham.books ?? Object.values(ham));
const kutuphanem = JSON.parse(await readFile(join(ROOT, "src/data/kutuphanem.json"), "utf8"));
const defterler: Defter[] = kutuphanem.notebooks;

/** titleMatchScore'un saydığı anlamlı sözcük sayısı (>2 harf) — skor ortak ÷ KÜÇÜK küme, tek sözcük şişirir */
const sozcuk = (s: string) => new Set(normalizeForMatch(s).split(" ").filter((w) => w.length > 2)).size;

const satirlar = kitaplar.map((k) => {
  let en: { d: Defter; skor: number } | undefined;
  for (const d of defterler) {
    const skor = titleMatchScore(k.title, d.name);
    if (!en || skor > en.skor) en = { d, skor };
  }
  return { k, d: en?.d, skor: en?.skor ?? 0, kucuk: en ? Math.min(sozcuk(k.title), sozcuk(en.d.name)) : 0 };
});

const yuksek = satirlar.filter((s) => s.skor >= ESIK);
const aday = satirlar.filter((s) => s.skor >= ADAY_ALT && s.skor < ESIK).sort((a, b) => b.skor - a.skor);
const eslesmeyen = satirlar.length - yuksek.length - aday.length;
// Doğrulama: aynı kural books.json'daki notebookId'leri yeniden üretmeli (sync'ten beri iki dosya değişmediyse)
const uyumsuz = satirlar.filter((s) => (s.skor >= ESIK ? s.d!.id : undefined) !== (s.k.notebookId || undefined));
const ayniDefter = new Map<string, number>();
for (const s of aday) ayniDefter.set(s.d!.id, (ayniDefter.get(s.d!.id) ?? 0) + 1);

const kac = (x: string) => x.replaceAll("|", "\\|");
const paylasim = (d?: Defter) => (d?.shared ? "açık" : "kapalı");
const md = [
  "# NotebookLM eşleştirme adayları (DRY-RUN — uygulanmadı)",
  "",
  `> Üreten: \`scripts/notebook-eslestir-dry.ts\` (${new Date().toISOString().slice(0, 10)}). Kaynak: \`books.json\` ${kitaplar.length} kitap, ` +
    `\`kutuphanem.json\` ${defterler.length} defter (syncedAt ${kutuphanem.syncedAt}). Kural \`titleMatchScore\` = ortak anlamlı sözcük ÷ KÜÇÜK küme ` +
    `(\`sync-drive-books.ts\` ile aynı): tek sözcüklü başlık tek ortak sözcükle 1.00 alır → "ortak/küçük" sütunu 1 ise eşleşme şüphelidir. ` +
    `"Paylaşım" anlık görüntüdeki \`shared\`; kapalı defterin bağlantısı üyeye erişim hatası verir.`,
  "",
  `**Özet:** ≥ ${ESIK}: ${yuksek.length} · ${ADAY_ALT}–${ESIK} aday: ${aday.length} · < ${ADAY_ALT} (eşleşmeyen): ${eslesmeyen} · ` +
    `books.json ile uyumsuz: ${uyumsuz.length} · birden çok kitaba aday defter: ${[...ayniDefter.values()].filter((n) => n > 1).length}`,
  "",
  `## 1. ≥ ${ESIK} — doğrulama (books.json'da notebookId'li olanlar bunlar olmalı)`,
  "",
  "| Kitap | Defter | Skor | Ortak/küçük | books.json | Paylaşım |",
  "|---|---|---|---|---|---|",
  ...yuksek.map(
    (s) =>
      `| ${kac(s.k.title)} | ${kac(s.d!.name)} | ${s.skor.toFixed(2)} | ${Math.round(s.skor * s.kucuk)}/${s.kucuk} | ` +
      `${s.k.notebookId === s.d!.id ? "aynı" : "FARKLI"} | ${paylasim(s.d)} |`,
  ),
  "",
  `## 2. ${ADAY_ALT}–${ESIK} adaylar — Yusuf onayı ister (onaylanan satırlar küçük bir betikle yazılır, elle değil)`,
  "",
  "| Kitap | Yazar | Defter | Skor | Ortak/küçük | Paylaşım | Kitap id |",
  "|---|---|---|---|---|---|---|",
  ...aday.map(
    (s) =>
      `| ${kac(s.k.title)} | ${kac(s.k.author ?? "")} | ${kac(s.d!.name)}${(ayniDefter.get(s.d!.id) ?? 0) > 1 ? " ⚠️ çoklu" : ""} | ${s.skor.toFixed(2)} | ` +
      `${Math.round(s.skor * s.kucuk)}/${s.kucuk} | ${paylasim(s.d)} | \`${s.k.id}\` |`,
  ),
  "",
  `## 3. Eşleşmeyen (< ${ADAY_ALT}): ${eslesmeyen} kitap`,
  "",
  "Bu kitaplar için defter yok. Talep öncelikli üretim planı (ONAY BEKLER): PROGRESS.md \"FAZ 5 ARTIK + UX KAPANIŞI\" ve GitHub #42.",
  "",
  ...(uyumsuz.length
    ? ["## ⚠️ books.json ile uyumsuz", "", ...uyumsuz.map((s) => `- ${kac(s.k.title)}: books.json \`${s.k.notebookId ?? "—"}\` ↔ yeniden hesap \`${s.skor >= ESIK ? s.d!.id : "—"}\` (${s.skor.toFixed(2)})`), ""]
    : []),
].join("\n");

await writeFile(CIKTI, md + "\n");
console.log(`≥${ESIK}: ${yuksek.length} · aday: ${aday.length} · eşleşmeyen: ${eslesmeyen} · uyumsuz: ${uyumsuz.length} → ${CIKTI}`);
