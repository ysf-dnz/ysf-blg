/**
 * POST /api/uye/kitap-ac — puanla kitap erişimi açma.
 * Bakiye yetersizse veya kitap zaten açıksa güvenle geri döner.
 */
import type { APIRoute } from "astro";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember, hasBookAccess, pointBalance } from "@/lib/member.ts";
import { PUAN } from "@/lib/points.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });

  const form = await context.request.formData();
  const bookId = String(form.get("bookId") ?? "");
  if (!bookId) return new Response("bookId eksik", { status: 400 });

  const target = `/kutuphane/kitap/${bookId}`;
  if (await hasBookAccess(member.id, bookId)) {
    return context.redirect(target);
  }
  const balance = await pointBalance(member.id);
  if (balance < PUAN.bookUnlockCost) {
    return context.redirect(target);
  }

  await db.insert(schema.pointsLedger).values({
    userId: member.id,
    delta: -PUAN.bookUnlockCost,
    reason: "book_unlock",
    refId: bookId,
  });
  await db
    .insert(schema.bookAccess)
    .values({ userId: member.id, bookId, source: "points" })
    .onConflictDoNothing();
  await db.insert(schema.notifications).values({
    userId: member.id,
    kind: "book_unlocked",
    body: `"${bookId}" kitabına erişimin açıldı 🎉`,
    href: target,
  });

  // ?acildi=1 → hazine açılış kutlaması (konfeti + indirme bandı)
  return context.redirect(`${target}?acildi=1`);
};
