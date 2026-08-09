/** POST /api/uye/basvuru — temsilcilik başvurusu. */
import type { APIRoute } from "astro";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember } from "@/lib/member.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });
  const form = await context.request.formData();
  const place = String(form.get("place") ?? "").trim();
  if (!place) return new Response("Eksik alan", { status: 400 });
  await db.insert(schema.applications).values({
    userId: member.id,
    kind: String(form.get("kind") ?? "university") as "city" | "university",
    place,
    message: String(form.get("message") ?? "") || null,
  });
  return context.redirect("/uye");
};
