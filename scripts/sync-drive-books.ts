/**
 * Kitap rafı senkronu — tamamen kendi kendine yeter.
 *
 * Drive klasörü link-paylaşımlı olduğundan Google'ın herkese açık
 * `embeddedfolderview` endpoint'i auth'suz listeleme verir; bu script:
 *  1. Kök klasörü rekürsif tarar (PDF + EPUB), kategori = alt klasör adı
 *  2. Aynı başlıklı kopyaları teker bırakır
 *  3. Eksik kapakları Drive thumbnail endpoint'inden indirir, sharp ile
 *     küçültür (public/book-covers/<id>.jpg, 320px jpeg; görüntü değilse atılır)
 *  4. Başlık/yazar temizliği + kutuphanem defter eşleştirmesi yapar
 *  5. `src/data/books.json`'a yazar (books-overrides.json ayrı katmandır)
 *
 * Kullanım: npm run sync:kitaplik
 */
import { readFile, writeFile, access, unlink, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBookFileName, titleMatchScore, normalizeForMatch } from "./lib/book-title.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = join(ROOT, "src/data/books.json");
const KUTUPHANEM_PATH = join(ROOT, "src/data/kutuphanem.json");
const COVER_DIR = join(ROOT, "public/book-covers");
const ROOT_FOLDER = "1WVA5lPQDIWy-bNZvGGyNT6hifjpTDocF";
const MATCH_THRESHOLD = 0.85;

interface DriveFile {
  id: string;
  fileName: string;
  format: "pdf" | "epub";
  category: string;
}

const ENTRY_RE =
  /<div class="flip-entry" id="entry-([\w-]+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?flip-entry-title[^>]*>([^<]*)</g;

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

async function listFolder(
  folderId: string,
): Promise<{ folders: { id: string; name: string }[]; files: DriveFile[] }> {
  const res = await fetch(
    `https://drive.google.com/embeddedfolderview?id=${folderId}`,
  );
  if (!res.ok) {
    throw new Error(`Klasör listelenemedi (${folderId}): HTTP ${res.status}`);
  }
  const html = await res.text();
  const folders: { id: string; name: string }[] = [];
  const files: DriveFile[] = [];
  for (const m of html.matchAll(ENTRY_RE)) {
    const [, id, href, rawTitle] = m as unknown as [string, string, string, string];
    const name = decodeHtml(rawTitle.trim());
    if (href.includes("/drive/folders/")) {
      folders.push({ id, name });
    } else {
      const ext = name.toLowerCase().match(/\.(pdf|epub)$/)?.[1];
      if (ext) files.push({ id, fileName: name, format: ext as "pdf" | "epub", category: "" });
    }
  }
  return { folders, files };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function downloadCover(id: string): Promise<boolean> {
  const dest = join(COVER_DIR, `${id}.jpg`);
  if (await exists(dest)) return true;
  try {
    const res = await fetch(
      `https://drive.google.com/thumbnail?id=${id}&sz=w640`,
    );
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    // görüntü doğrulaması: JPEG/PNG/WebP magic bytes
    const isImage =
      (buf[0] === 0xff && buf[1] === 0xd8) ||
      (buf[0] === 0x89 && buf[1] === 0x50) ||
      (buf.subarray(0, 4).toString() === "RIFF");
    if (!isImage || buf.length < 1000) return false;
    const sharp = (await import("sharp")).default;
    await sharp(buf)
      .resize({ width: 320 })
      .jpeg({ quality: 70, mozjpeg: true })
      .toFile(dest);
    return true;
  } catch {
    return false;
  }
}

// 1. Rekürsif tarama (BFS)
console.log(`Drive klasörü taranıyor: ${ROOT_FOLDER}`);
const queue: { id: string; name: string }[] = [{ id: ROOT_FOLDER, name: "genel" }];
const seenFolders = new Set<string>();
const allFiles: DriveFile[] = [];

while (queue.length > 0) {
  const folder = queue.shift()!;
  if (seenFolders.has(folder.id)) continue;
  seenFolders.add(folder.id);
  const { folders, files } = await listFolder(folder.id);
  for (const f of files) f.category = folder.name;
  allFiles.push(...files);
  for (const sub of folders) queue.push(sub);
  console.log(`  ${folder.name}: ${files.length} kitap, ${folders.length} alt klasör`);
}

// 2. Kopya temizliği (normalize başlığa göre; ilk görülen kalır)
const byTitle = new Map<string, DriveFile>();
let dupes = 0;
for (const f of allFiles) {
  const key = normalizeForMatch(parseBookFileName(f.fileName).title);
  if (byTitle.has(key)) {
    dupes++;
    continue;
  }
  byTitle.set(key, f);
}
const uniqueFiles = [...byTitle.values()];
console.log(`Toplam ${allFiles.length} dosya, ${dupes} kopya atıldı → ${uniqueFiles.length} kitap`);

// 3. Kapaklar (paralel, 8'erli gruplar)
await mkdir(COVER_DIR, { recursive: true });
let coverOk = 0;
for (let i = 0; i < uniqueFiles.length; i += 8) {
  const batch = uniqueFiles.slice(i, i + 8);
  const results = await Promise.all(batch.map((f) => downloadCover(f.id)));
  coverOk += results.filter(Boolean).length;
  if (i % 80 === 0 && i > 0) console.log(`  kapak: ${i}/${uniqueFiles.length}...`);
}
console.log(`Kapak: ${coverOk}/${uniqueFiles.length}`);

// 4. Normalize + defter eşleştirme
const notebooks = JSON.parse(await readFile(KUTUPHANEM_PATH, "utf8"))
  .notebooks as { id: string; name: string }[];
const unmatched: string[] = [];

const books = await Promise.all(
  uniqueFiles.map(async (f) => {
    const { title, author } = parseBookFileName(f.fileName);
    const coverFile = join(COVER_DIR, `${f.id}.jpg`);
    const cover = (await exists(coverFile))
      ? `/book-covers/${f.id}.jpg`
      : undefined;

    let notebookId: string | undefined;
    let best: { id: string; name: string; score: number } | undefined;
    for (const nb of notebooks) {
      const score = titleMatchScore(title, nb.name);
      if (!best || score > best.score) best = { ...nb, score };
    }
    if (best && best.score >= MATCH_THRESHOLD) {
      notebookId = best.id;
    } else {
      unmatched.push(title);
    }

    return {
      id: f.id,
      title,
      author,
      format: f.format,
      cover,
      driveUrl: `https://drive.google.com/file/d/${f.id}/view`,
      category: f.category,
      notebookId,
    };
  }),
);

books.sort(
  (a, b) =>
    a.category.localeCompare(b.category, "tr") ||
    a.title.localeCompare(b.title, "tr"),
);

await writeFile(
  OUT_PATH,
  JSON.stringify(
    {
      syncedAt: new Date().toISOString(),
      source: `google-drive:${ROOT_FOLDER}`,
      books,
    },
    null,
    2,
  ) + "\n",
);

const nbCount = books.filter((b) => b.notebookId).length;
const cats = new Set(books.map((b) => b.category));
console.log(
  `Yazıldı: ${OUT_PATH} — ${books.length} kitap, ${cats.size} kategori, ` +
    `${books.filter((b) => b.cover).length} kapak, ${nbCount} defter eşleşmesi`,
);
if (unmatched.length > 0) {
  console.log(`Defter eşleşmeyen: ${unmatched.length} kitap (ilk 10):`);
  for (const t of unmatched.slice(0, 10)) console.log(`  - ${t}`);
}
