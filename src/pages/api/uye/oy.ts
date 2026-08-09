/** POST /api/uye/oy — sonraki gündem kitabına oy (kitap başına 1). */
import type { APIRoute } from "astro";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember } from "@/lib/member.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });
  const form = await context.request.formData();
  const bookId = String(form.get("bookId") ?? "");
  if (bookId) {
    await db
      .insert(schema.campaignVotes)
      .values({ bookId, userId: member.id })
      .onConflictDoNothing();
  }
  return context.redirect("/gundem");
};
