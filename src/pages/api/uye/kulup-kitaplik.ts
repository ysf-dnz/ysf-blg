/**
 * POST /api/uye/kulup-kitaplik — kulüp ortak kütüphanesine ekleme.
 * Üyeler katalog kitabı VEYA serbest not/kaynak ekleyebilir.
 */
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { clubRoleOf } from "@/lib/permissions.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });

  const form = await context.request.formData();
  const clubId = Number(form.get("clubId") ?? 0);
  const club = await db.query.clubs.findFirst({
    where: (c, { eq }) => eq(c.id, clubId),
  });
  if (!club) return new Response("Kulüp yok", { status: 404 });
  // Yalnız kulüp üyeleri ekleyebilir
  if (!(await clubRoleOf(member, clubId)))
    return new Response("Önce kulübe katıl", { status: 403 });

  const bookId = String(form.get("bookId") ?? "") || null;
  const title = String(form.get("title") ?? "").trim() || null;
  const url = String(form.get("url") ?? "").trim() || null;
  const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;

  if (bookId) {
    const books = await getCollection("books");
    if (!books.some((b) => b.data.id === bookId))
      return new Response("Geçersiz kitap", { status: 400 });
  } else if (!title) {
    return new Response("Kitap seç veya not başlığı yaz", { status: 400 });
  }
  if (url && !/^https:\/\/[^\s]+$/.test(url))
    return new Response("Yalnız https linkler", { status: 400 });

  await db.insert(schema.clubBooks).values({
    clubId,
    bookId,
    title,
    url,
    note,
    addedBy: member.id,
  });
  return context.redirect(`/kulup/${club.slug}?t=kitaplik`);
};
