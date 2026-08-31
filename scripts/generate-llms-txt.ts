/**
 * Postbuild: llms.txt ve llms-full.txt üretir (GEO).
 * Yazı listesi src/content/posts'tan, tam metinler ham MDX'ten okunur.
 * ÇIKTI İKİ YERE yazılır: dist/ (lokal) ve .vercel/output/static/ —
 * Vercel deploy'u yalnız ikincisinden yapılır, dist/ canlıya çıkmaz.
 * Faz 7'de genişletilecek; şimdilik iskelet üretim.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "dist");
const VERCEL_STATIC = join(ROOT, ".vercel/output/static");
const POSTS_DIR = join(ROOT, "src/content/posts");
const SITE = process.env.SITE_URL ?? "https://yusufdeniz.dev";

interface PostMeta {
  title: string;
  description: string;
  lang: string;
  slug: string;
  draft: boolean;
  body: string;
}

function parseFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  const out: Record<string, string> = {};
  if (!match) return out;
  for (const line of match[1]!.split("\n")) {
    const m = line.match(/^(\w+):\s*"?(.*?)"?\s*$/);
    if (m) out[m[1]!] = m[2]!;
  }
  return out;
}

async function collectPosts(): Promise<PostMeta[]> {
  const posts: PostMeta[] = [];
  for (const lang of ["tr", "en"]) {
    const dir = join(POSTS_DIR, lang);
    let files: string[] = [];
    try {
      files = await readdir(dir);
    } catch {
      continue;
    }
    for (const file of files.filter((f) => f.endsWith(".mdx"))) {
      const raw = await readFile(join(dir, file), "utf8");
      const fm = parseFrontmatter(raw);
      posts.push({
        title: fm.title ?? file,
        description: fm.description ?? "",
        lang,
        slug: file.replace(/\.mdx$/, ""),
        draft: fm.draft === "true",
        body: raw.replace(/^---[\s\S]*?---\n/, ""),
      });
    }
  }
  return posts.filter((p) => !p.draft);
}

const posts = await collectPosts();

const urlFor = (p: PostMeta) =>
  p.lang === "en" ? `${SITE}/en/yazilar/${p.slug}` : `${SITE}/yazilar/${p.slug}`;

const llms = [
  "# Yusuf Deniz — Kişisel Blog",
  "",
  "> Yapay zekâ, yazılım, girişimcilik ve eğitim üzerine Türkçe (ve seçmeli İngilizce) yazılar.",
  `> Yazar: Yusuf Deniz. Kütüphane: https://ysf-dnz.github.io/kutuphanem`,
  "",
  "## Yazılar",
  "",
  ...posts.map((p) => `- [${p.title}](${urlFor(p)}): ${p.description}`),
  "",
  "## Tam içerik",
  "",
  `- [llms-full.txt](${SITE}/llms-full.txt): tüm yazıların tam metni`,
].join("\n");

const llmsFull = posts
  .map((p) =>
    [
      `# ${p.title}`,
      "",
      `URL: ${urlFor(p)}`,
      `Özet: ${p.description}`,
      "",
      p.body.trim(),
    ].join("\n"),
  )
  .join("\n\n---\n\n");

const hedefler = [DIST, VERCEL_STATIC].filter((d) => existsSync(d));
for (const hedef of hedefler) {
  await writeFile(join(hedef, "llms.txt"), llms);
  await writeFile(join(hedef, "llms-full.txt"), llmsFull);
}
console.log(`llms.txt üretildi (${posts.length} yazı) → ${hedefler.join(", ")}`);
