/** POST /api/uye/kulup — kulüp başvurusu, üyelik, grup yönetimi, rol terfi. */
import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { clubRoleOf } from "@/lib/permissions.ts";
import { slugifyTitle } from "@/lib/markdown.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });

  const form = await context.request.formData();
  const action = String(form.get("action") ?? "");

  if (action === "apply") {
    const name = String(form.get("name") ?? "").trim();
    const kind = String(form.get("kind") ?? "universite") as
      | "universite"
      | "lise"
      | "sehir";
    const place = String(form.get("place") ?? "").trim();
    const il = String(form.get("il") ?? "").trim();
    if (!name || !place || !il) return new Response("Eksik alan", { status: 400 });

    const slug = `${slugifyTitle(name)}-${Date.now().toString(36).slice(-3)}`;
    const [club] = await db
      .insert(schema.clubs)
      .values({
        slug,
        name,
        kind,
        place,
        il,
        description: String(form.get("message") ?? "") || null,
        presidentId: member.id,
      })
      .returning();
    await db.insert(schema.clubMembers).values({
      clubId: club!.id,
      userId: member.id,
      role: "president",
    });
    await db.insert(schema.applications).values({
      userId: member.id,
      kind: kind === "lise" ? "lise_temsilciligi" : "universite_kulubu",
      place: `${name} (${place}, ${il})`,
      message: String(form.get("message") ?? "") || null,
    });
    return context.redirect(`/kulup/${slug}`);
  }

  if (action === "join") {
    const clubId = Number(form.get("clubId") ?? 0);
    const club = await db.query.clubs.findFirst({
      where: eq(schema.clubs.id, clubId),
    });
    if (club?.status === "approved") {
      await db
        .insert(schema.clubMembers)
        .values({ clubId, userId: member.id })
        .onConflictDoNothing();
    }
    return context.redirect(`/kulup/${club?.slug ?? ""}`);
  }

  /* ---- Grup yönetimi + rol terfi: yalnız başkan (admin dahil) ---- */
  const clubId = Number(form.get("clubId") ?? 0);
  const club = await db.query.clubs.findFirst({
    where: eq(schema.clubs.id, clubId),
  });
  if (!club) return new Response("Kulüp yok", { status: 404 });
  const geri = () => context.redirect(`/kulup/${club.slug}?t=uyeler`);
  const baskan = (await clubRoleOf(member, clubId)) === "president";
  if (!baskan) return new Response("Yetkisiz", { status: 403 });

  // Grup kur: lider seçilirse otomatik mod olur ve gruba atanır
  if (action === "grup-kur") {
    const name = String(form.get("name") ?? "").trim().slice(0, 60);
    if (!name) return new Response("Grup adı gerekli", { status: 400 });
    const leaderId = Number(form.get("leaderId") ?? 0) || null;
    const [grup] = await db
      .insert(schema.clubGroups)
      .values({ clubId, name, leaderId })
      .returning();
    if (leaderId) {
      await db
        .update(schema.clubMembers)
        .set({ role: "mod", groupId: grup!.id })
        .where(
          and(
            eq(schema.clubMembers.clubId, clubId),
            eq(schema.clubMembers.userId, leaderId),
            eq(schema.clubMembers.role, "member"),
          ),
        );
      await db.insert(schema.notifications).values({
        userId: leaderId,
        kind: "club",
        body: `"${club.name}" kulübünde "${name}" grubunun lideri oldun 🛡️ — artık görev açıp onaylayabilirsin.`,
        href: `/kulup/${club.slug}`,
      });
    }
    return geri();
  }

  // Üyeleri gruba ata (çoklu seçim; groupId=0 → gruptan çıkar)
  if (action === "grup-ata") {
    const groupId = Number(form.get("groupId") ?? 0) || null;
    if (groupId) {
      const grup = await db.query.clubGroups.findFirst({
        where: and(eq(schema.clubGroups.id, groupId), eq(schema.clubGroups.clubId, clubId)),
      });
      if (!grup) return new Response("Grup yok", { status: 404 });
    }
    const uyeIds = form
      .getAll("uyeId")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);
    for (const uyeId of uyeIds) {
      await db
        .update(schema.clubMembers)
        .set({ groupId })
        .where(
          and(
            eq(schema.clubMembers.clubId, clubId),
            eq(schema.clubMembers.userId, uyeId),
          ),
        );
    }
    return geri();
  }

  // Özel lig kur: tarih aralığı + ödül vaadi (başkanın kulüp içi yarışması)
  if (action === "lig-kur") {
    const name = String(form.get("name") ?? "").trim().slice(0, 80);
    const startsAt = new Date(String(form.get("startsAt") ?? ""));
    const endsAt = new Date(String(form.get("endsAt") ?? "") + "T23:59:59");
    if (!name || isNaN(startsAt.getTime()) || isNaN(endsAt.getTime()) || endsAt <= startsAt)
      return new Response("Geçersiz lig bilgisi", { status: 400 });
    await db.insert(schema.clubLeagues).values({
      clubId,
      name,
      startsAt,
      endsAt,
      rewardNote: String(form.get("rewardNote") ?? "").trim().slice(0, 200) || null,
      createdBy: member.id,
    });
    // Tüm kulüp üyelerine duyuru
    const uyeler = await db.query.clubMembers.findMany({
      where: eq(schema.clubMembers.clubId, clubId),
    });
    for (const u of uyeler) {
      if (u.userId === member.id) continue;
      await db.insert(schema.notifications).values({
        userId: u.userId,
        kind: "league",
        body: `"${club.name}" kulübünde yeni lig başladı: ${name} 🏟️ Katkıların puan durumuna işleniyor!`,
        href: `/kulup/${club.slug}?t=lig`,
      });
    }
    return context.redirect(`/kulup/${club.slug}?t=lig`);
  }

  // Rol terfi/tenzil: 🛡️ mod ver / al (başkan dokunulmaz)
  if (action === "rol") {
    const uyeId = Number(form.get("uyeId") ?? 0);
    const rol = String(form.get("rol") ?? "");
    if (!["mod", "member"].includes(rol) || uyeId === member.id)
      return new Response("Geçersiz", { status: 400 });
    const hedef = await db.query.clubMembers.findFirst({
      where: and(
        eq(schema.clubMembers.clubId, clubId),
        eq(schema.clubMembers.userId, uyeId),
      ),
    });
    if (!hedef || hedef.role === "president")
      return new Response("Geçersiz", { status: 400 });
    await db
      .update(schema.clubMembers)
      .set({ role: rol as "mod" | "member" })
      .where(eq(schema.clubMembers.id, hedef.id));
    await db.insert(schema.notifications).values({
      userId: uyeId,
      kind: "club",
      body:
        rol === "mod"
          ? `"${club.name}" kulübünde moderatör oldun 🛡️ — görev açabilir ve onaylayabilirsin.`
          : `"${club.name}" kulübündeki moderatörlüğün sona erdi.`,
      href: `/kulup/${club.slug}`,
    });
    return geri();
  }

  return new Response("Bilinmeyen işlem", { status: 400 });
};
