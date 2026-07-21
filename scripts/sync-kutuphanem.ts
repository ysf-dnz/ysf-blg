/**
 * kutuphanem senkronu: https://github.com/ysf-dnz/kutuphanem reposundaki
 * index.html içine gömülü `const DATA` JSON'unu çekip normalize eder ve
 * src/data/kutuphanem.json'a yazar. Hata durumunda mevcut JSON'a dokunmaz.
 *
 * Kullanım: npm run sync:kutuphanem
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractConstObject } from "./lib/extract-data.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = join(ROOT, "src/data/kutuphanem.json");
const SOURCE_URL =
  "https://raw.githubusercontent.com/ysf-dnz/kutuphanem/main/index.html";
const NOTEBOOK_URL_BASE = "https://notebooklm.google.com/notebook/";

interface RawNode {
  id: string;
  name: string;
  full?: string;
  type: "root" | "cat" | "nb";
  cat?: string;
  color?: string;
  count?: number;
  sc?: number;
  shared?: boolean;
  tr?: string;
  en?: string;
}

interface KutuphanemData {
  syncedAt: string;
  source: string;
  categories: {
    id: string;
    name: string;
    full?: string;
    color: string;
    notebookCount: number;
  }[];
  notebooks: {
    id: string;
    name: string;
    nameEn?: string;
    category: string;
    color: string;
    sourceCount: number;
    shared: boolean;
    notebookUrl: string;
  }[];
}

async function main() {
  console.log(`Kaynak indiriliyor: ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Fetch başarısız: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();

  const data = extractConstObject(html, "DATA") as { nodes: RawNode[] };
  if (!Array.isArray(data.nodes)) {
    throw new Error("DATA.nodes dizisi bulunamadı — sayfa yapısı değişmiş olabilir");
  }

  const catNodes = data.nodes.filter((n) => n.type === "cat");
  const nbNodes = data.nodes.filter((n) => n.type === "nb");

  const output: KutuphanemData = {
    syncedAt: new Date().toISOString(),
    source: SOURCE_URL,
    categories: catNodes
      .map((c) => ({
        id: (c.cat ?? c.id).replace(/^cat_/, ""),
        name: c.name,
        full: c.full,
        color: c.color ?? "#888888",
        notebookCount: nbNodes.filter((n) => n.cat === c.cat).length,
      }))
      .sort((a, b) => a.id.localeCompare(b.id, "tr")),
    notebooks: nbNodes
      .map((n) => ({
        id: n.id,
        name: n.tr ?? n.name,
        nameEn: n.en,
        category: n.cat ?? "diger",
        color: n.color ?? "#888888",
        sourceCount: n.sc ?? 0,
        shared: n.shared ?? false,
        notebookUrl: `${NOTEBOOK_URL_BASE}${n.id}`,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };

  // Diff raporu
  let previous: KutuphanemData | undefined;
  try {
    previous = JSON.parse(await readFile(OUT_PATH, "utf8"));
  } catch {
    // ilk senkron
  }
  if (previous) {
    const oldIds = new Set(previous.notebooks.map((n) => n.id));
    const newIds = new Set(output.notebooks.map((n) => n.id));
    const added = output.notebooks.filter((n) => !oldIds.has(n.id));
    const removed = previous.notebooks.filter((n) => !newIds.has(n.id));
    console.log(
      `Diff: +${added.length} defter, -${removed.length} defter ` +
        `(${previous.notebooks.length} → ${output.notebooks.length})`,
    );
    for (const n of added.slice(0, 10)) console.log(`  + ${n.name}`);
    for (const n of removed.slice(0, 10)) console.log(`  - ${n.name}`);
    if (removed.length > 0) {
      console.warn(
        "UYARI: Silinen defterleri kutuphaneNode ile referanslayan yazılar build'de hata verir.",
      );
    }
  }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(
    `Yazıldı: ${OUT_PATH} (${output.categories.length} kategori, ${output.notebooks.length} defter)`,
  );
}

main().catch((err) => {
  console.error("Senkron başarısız, mevcut JSON korundu:", err.message);
  process.exit(1);
});
