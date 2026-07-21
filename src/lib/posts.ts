import { getCollection, type CollectionEntry } from "astro:content";
import type { Lang } from "./i18n/index.ts";

export type Post = CollectionEntry<"posts">;

/** Yayınlanmış (draft olmayan) yazılar, yeniden eskiye sıralı. */
export async function getPublishedPosts(lang?: Lang): Promise<Post[]> {
  const posts = await getCollection("posts", ({ data }) => {
    if (data.draft && import.meta.env.PROD) return false;
    if (lang && data.lang !== lang) return false;
    return true;
  });
  return posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
}

/**
 * Yazının slug'ı: dosya id'sinden dil klasörü atılır (tr/foo.mdx → foo).
 */
export function postSlug(post: Post): string {
  return post.id.replace(/^(tr|en)\//, "").replace(/\.mdx$/, "");
}

export function postPath(post: Post): string {
  const slug = postSlug(post);
  return post.data.lang === "en" ? `/en/yazilar/${slug}` : `/yazilar/${slug}`;
}

/**
 * Çeviri eşleştirmesini iki yönlü çözer: yazının kendi translationOf alanı
 * veya karşı dilde bu yazıyı işaret eden bir yazı.
 */
export function findTranslation(post: Post, all: Post[]): Post | undefined {
  const slug = postSlug(post);
  const otherLang = post.data.lang === "tr" ? "en" : "tr";
  return all.find(
    (p) =>
      p.data.lang === otherLang &&
      (postSlug(p) === post.data.translationOf ||
        p.data.translationOf === slug),
  );
}

/** Aynı dildeki sıralı listede önceki/sonraki yazı. */
export function prevNext(
  post: Post,
  sorted: Post[],
): { prev?: Post; next?: Post } {
  const idx = sorted.findIndex((p) => p.id === post.id);
  if (idx === -1) return {};
  return {
    // liste yeniden-eskiye sıralı: "önceki yazı" kronolojik olarak daha eski
    prev: sorted[idx + 1],
    next: sorted[idx - 1],
  };
}

/** Karşılıksız veya çakışan translationOf referanslarını raporlar. */
export function validateTranslations(all: Post[]): string[] {
  const warnings: string[] = [];
  for (const post of all) {
    const ref = post.data.translationOf;
    if (!ref) continue;
    const otherLang = post.data.lang === "tr" ? "en" : "tr";
    const target = all.find(
      (p) => p.data.lang === otherLang && postSlug(p) === ref,
    );
    if (!target) {
      warnings.push(
        `${post.id}: translationOf "${ref}" ${otherLang} dilinde bulunamadı`,
      );
    }
  }
  return warnings;
}
