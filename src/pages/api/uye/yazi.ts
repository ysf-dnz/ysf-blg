/** POST /api/uye/yazi — yazı oluştur (taslak veya onaya gönder) */
import type { APIRoute } from "astro";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { slugifyTitle } from "@/lib/markdown.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });

  const form = await context.request.formData();
  const title = String(form.get("title") ?? "").trim();
  const markdown = String(form.get("markdown") ?? "").trim();
  const bookId = String(form.get("bookId") ?? "") || null;
  const action = String(form.get("action") ?? "draft");
  if (!title || !markdown) return new Response("Eksik alan", { status: 400 });
  if (markdown.length > 50_000) return new Response("Çok uzun", { status: 400 });

  const visibility =
    String(form.get("visibility") ?? "public") === "members"
      ? ("members" as const)
      : ("public" as const);

  const slug = `${slugifyTitle(title)}-${Date.now().toString(36)}`;
  await db.insert(schema.memberPosts).values({
    userId: member.id,
    bookId,
    title,
    markdown,
    slug,
    visibility,
    status: action === "submit" ? "pending" : "draft",
  });

  return context.redirect(
    action === "submit" ? "/uye/yaz?durum=gonderildi" : "/uye/yaz",
  );
};
