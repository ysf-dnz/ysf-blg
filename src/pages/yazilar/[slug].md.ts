export const prerender = true;
/**
 * GEO: her yazının ham markdown'ı /yazilar/<slug>.md olarak yayınlanır.
 * AI crawler'lar için düşük sürtünmeli erişim; llms.txt bunlara link verir.
 */
import type { APIContext } from "astro";
import { getPublishedPosts, postSlug } from "@/lib/posts.ts";

export async function getStaticPaths() {
  const posts = await getPublishedPosts("tr");
  return posts.map((post) => ({
    params: { slug: postSlug(post) },
    props: { post },
  }));
}

export function GET(context: APIContext) {
  const { post } = context.props as {
    post: Awaited<ReturnType<typeof getPublishedPosts>>[number];
  };
  const body = [
    `# ${post.data.title}`,
    "",
    `> ${post.data.description}`,
    "",
    `Yazar: Yusuf Deniz · Tarih: ${post.data.pubDate.toISOString().slice(0, 10)} · Kategori: ${post.data.category}`,
    "",
    post.body ?? "",
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
