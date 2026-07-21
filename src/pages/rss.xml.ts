import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getPublishedPosts, postPath } from "@/lib/posts.ts";
import { tr } from "@/lib/i18n/tr.ts";

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts("tr");
  return rss({
    title: tr["site.title"],
    description: tr["site.description"],
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: postPath(post),
      categories: [post.data.category, ...post.data.tags],
    })),
    customData: "<language>tr</language>",
  });
}
