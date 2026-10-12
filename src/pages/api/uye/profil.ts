/**
 * POST /api/uye/profil — iki ayrı form: profil alanları (şehir/üniversite/bio/sosyal linkler) ve
 * action=gizlilik (haritada görünme rızası F4-02 + "kimden mesaj alırım" ayarı F4-03).
 */
import type { APIRoute } from "astro";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { dmPolitikasiMi } from "@/lib/economy.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { ilBul } from "@/lib/topluluk.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });
  const form = await context.request.formData();

  // Gizlilik ayarları AYRI form ve ayrı yazımdır: profil alanlarını bayat bir sekmeden kaydetmek harita
  // rızasını / mesaj ayarını o sekmedeki eski değere döndürmesin (inceleme bulgusu).
  if (form.get("action") === "gizlilik") {
    const dmPolicy = String(form.get("dmPolicy") ?? "");
    await db
      .update(schema.users)
      .set({
        // Tek SQL: il yoksa görünmez; rıza anı korunur (yeniden kaydetmek tarihi yenilemez)
        mapVisibleAt:
          form.get("mapVisible") === "1"
            ? sql`case when ${schema.users.city} is null then null else coalesce(${schema.users.mapVisibleAt}, now()) end`
            : null,
        // Beyaz liste dışı değer mevcut ayarı korur
        ...(dmPolitikasiMi(dmPolicy) ? { dmPolicy } : {}),
      })
      .where(eq(schema.users.id, member.id));
    return context.redirect("/uye/profil?durum=gizlilik#gizlilik");
  }

  // Sosyal linkler: yalnızca https URL kabul edilir
  const socials: Record<string, string> = {};
  for (const key of ["linkedin", "github", "instagram", "youtube", "x", "website"]) {
    const v = String(form.get(`social_${key}`) ?? "").trim();
    if (v && /^https:\/\/[^\s]+$/.test(v)) socials[key] = v.slice(0, 200);
  }

  // İl 81 il listesinden (harita eşleşmesi serbest metinle tutmuyordu); listede yoksa boş
  const city = ilBul(String(form.get("city") ?? ""));
  // Eski TEK formlu sayfa (Faz 4 ilk sürümü; açık kalmış sekme) dmPolicy alanını da gönderir: o formda
  // kaldırılan rıza sessizce yok sayılmasın. Yalnız GERİ ÇEKME yönü uygulanır (rıza bu yoldan AÇILMAZ).
  const eskiFormdaRizaKalkti = form.has("dmPolicy") && form.get("mapVisible") !== "1";

  await db
    .update(schema.users)
    .set({
      city,
      // Şehir boşaldıysa haritada yer yok: rıza da kalkar. Şehir varken rızaya DOKUNULMAZ (ayrı form)
      ...(city && !eskiFormdaRizaKalkti ? {} : { mapVisibleAt: null }),
      university: String(form.get("university") ?? "").trim().slice(0, 80) || null,
      bio: String(form.get("bio") ?? "").trim().slice(0, 280) || null,
      socials: Object.keys(socials).length ? JSON.stringify(socials) : null,
    })
    .where(eq(schema.users.id, member.id));
  return context.redirect("/uye/profil?durum=ok");
};
