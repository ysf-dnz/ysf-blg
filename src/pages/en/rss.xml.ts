import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getPublishedPosts, postPath } from "@/lib/posts.ts";
import { en } from "@/lib/i18n/en.ts";

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts("en");
  return rss({
    title: en["site.title"],
    description: en["site.description"],
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: postPath(post),
      categories: [post.data.category, ...post.data.tags],
    })),
    customData: "<language>en</language>",
  });
}
