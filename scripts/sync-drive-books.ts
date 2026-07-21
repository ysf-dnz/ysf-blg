/**
 * Kitap rafı senkron doğrulayıcısı.
 *
 * Google Drive'a Vercel build'in erişimi YOK; ham liste Claude Code
 * oturumunda `.claude/skills/kitaplik-sync` skill'i ile (Drive MCP araçları)
 * `src/data/books-raw.json`'a çıkarılır. Bu script ham listeyi doğrular,
 * normalize eder ve `src/data/books.json`'a yazar (overrides korunur).
 *
 * Kullanım: npm run sync:kitaplik
 */
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW_PATH = join(ROOT, "src/data/books-raw.json");
const OUT_PATH = join(ROOT, "src/data/books.json");

interface RawBook {
  id: string;
  title: string;
  author?: string;
  format: string;
  coverUrl?: string;
  driveUrl: string;
  sizeBytes?: number;
  category?: string;
}

function fail(msg: string): never {
  console.error(`HATA: ${msg}`);
  process.exit(1);
}

let rawText: string;
try {
  rawText = await readFile(RAW_PATH, "utf8");
} catch {
  fail(
    `${RAW_PATH} yok. Önce Claude Code'da kitaplik-sync skill'ini çalıştırın ` +
      `("Drive kitaplığımı senkronla" deyin).`,
  );
}

const raw = JSON.parse(rawText) as { books?: RawBook[] };
if (!Array.isArray(raw.books)) fail("books-raw.json içinde books dizisi yok");

const seen = new Set<string>();
const books = raw.books.map((b, i) => {
  const yer = `books[${i}] (${b.title ?? b.id ?? "?"})`;
  if (!b.id || typeof b.id !== "string") fail(`${yer}: id eksik`);
  if (seen.has(b.id)) fail(`${yer}: tekrarlanan id`);
  seen.add(b.id);
  if (!b.title) fail(`${yer}: title eksik`);
  const format = b.format?.toLowerCase();
  if (format !== "pdf" && format !== "epub") {
    fail(`${yer}: format pdf|epub olmalı, gelen: ${b.format}`);
  }
  try {
    new URL(b.driveUrl);
  } catch {
    fail(`${yer}: geçersiz driveUrl`);
  }
  return {
    id: b.id,
    title: b.title.trim(),
    author: b.author?.trim() || undefined,
    format,
    coverUrl: b.coverUrl,
    driveUrl: b.driveUrl,
    sizeBytes: b.sizeBytes,
    category: b.category,
  };
});

books.sort((a, b) => a.title.localeCompare(b.title, "tr"));

await writeFile(
  OUT_PATH,
  JSON.stringify(
    {
      syncedAt: new Date().toISOString(),
      source: "google-drive (npm run sync:kitaplik ile güncellenir)",
      books,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Yazıldı: ${OUT_PATH} (${books.length} kitap)`);
