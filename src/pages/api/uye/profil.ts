/**
 * POST /api/uye/profil — şehir/üniversite/bio/sosyal linkler + haritada görünme rızası (F4-02)
 * ve "kimden mesaj alırım" ayarı (F4-03).
 */
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { dmPolitikasiMi } from "@/lib/economy.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { ilBul } from "@/lib/topluluk.ts";

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

  // İl 81 il listesinden (harita eşleşmesi serbest metinle tutmuyordu); listede yoksa boş
  const city = ilBul(String(form.get("city") ?? ""));
  const dmPolicy = String(form.get("dmPolicy") ?? "");

  await db
    .update(schema.users)
    .set({
      city,
      // Rıza anı korunur (yeniden kaydetmek tarihi yenilemez); kutu boşsa ya da il yoksa görünmez
      mapVisibleAt: form.get("mapVisible") === "1" && city ? (member.mapVisibleAt ?? new Date()) : null,
      // Beyaz liste dışı değer mevcut ayarı korur
      ...(dmPolitikasiMi(dmPolicy) ? { dmPolicy } : {}),
      university: String(form.get("university") ?? "").trim().slice(0, 80) || null,
      bio: String(form.get("bio") ?? "").trim().slice(0, 280) || null,
      socials: Object.keys(socials).length ? JSON.stringify(socials) : null,
    })
    .where(eq(schema.users.id, member.id));
  return context.redirect("/uye/profil?durum=ok");
};
