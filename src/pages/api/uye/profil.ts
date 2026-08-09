/** POST /api/uye/profil — şehir/üniversite güncelle. */
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember } from "@/lib/member.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });
  const form = await context.request.formData();

  // Sosyal linkler: yalnızca https URL kabul edilir
  const socials: Record<string, string> = {};
  for (const key of ["linkedin", "github", "instagram", "youtube", "x", "website"]) {
    const v = String(form.get(`social_${key}`) ?? "").trim();
    if (v && /^https:\/\/[^\s]+$/.test(v)) socials[key] = v.slice(0, 200);
  }

  await db
    .update(schema.users)
    .set({
      city: String(form.get("city") ?? "").trim() || null,
      university: String(form.get("university") ?? "").trim().slice(0, 80) || null,
      bio: String(form.get("bio") ?? "").trim().slice(0, 280) || null,
      socials: Object.keys(socials).length ? JSON.stringify(socials) : null,
    })
    .where(eq(schema.users.id, member.id));
  return context.redirect("/uye/profil?durum=ok");
};
