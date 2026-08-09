/** POST /api/uye/kulup — kulüp başvurusu ve üyelik. */
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember } from "@/lib/member.ts";
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

  return new Response("Bilinmeyen işlem", { status: 400 });
};
