import type { APIContext } from "astro";
import { getPublishedPosts, postSlug } from "@/lib/posts.ts";
import { useTranslations } from "@/lib/i18n/index.ts";
import { renderOgImage } from "@/features/seo/og/render.ts";

export async function getStaticPaths() {
  const posts = await getPublishedPosts();
  // Aynı slug iki dilde de varsa tek path üretilir (ilk görülen kazanır)
  const bySlug = new Map(
    posts.map((post) => [postSlug(post), post] as const),
  );
  const paths = [...bySlug.entries()].map(([slug, post]) => ({
    params: { slug },
    props: {
      title: post.data.title,
      category: post.data.category,
      lang: post.data.lang,
    },
  }));
  return [
    ...paths,
    // Yazı dışı sayfalar için varsayılan görsel
    {
      params: { slug: "default" },
      props: { title: "Yusuf Deniz", category: undefined, lang: "tr" as const },
    },
  ];
}

export async function GET(context: APIContext) {
  const { title, category, lang } = context.props as {
    title: string;
    category?: string;
    lang: "tr" | "en";
  };
  const t = useTranslations(lang);
  const png = await renderOgImage({
    title,
    category,
    categoryLabel: category ? t(`kategori.${category}` as never) : undefined,
  });
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png" },
  });
}
