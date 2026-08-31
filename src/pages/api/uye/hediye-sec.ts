/**
 * POST /api/uye/hediye-sec — "Bilgi Hazinesi": üye 5 kitap seçer;
 * İLKİ hediye olarak anında açılır, kalan 4'ü hedef listesine yazılır
 * (kilitli hazineler — yazdıkça kazanılan puanla açılır).
 * Tek hediye hakkı: gift kaydı varsa yalnız liste güncellenebilir.
 */
import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { getCollection } from "astro:content";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { seviyeHediyeleriniUygula } from "@/lib/rewards.ts";
import { R } from "@/lib/routes.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });

  const form = await context.request.formData();
  const secimler = form
    .getAll("bookIds")
    .map(String)
    .filter(Boolean)
    .slice(0, 5);
  if (secimler.length === 0) return new Response("Kitap seç", { status: 400 });

  const books = await getCollection("books");
  const gecerli = secimler.filter((id) => books.some((b) => b.data.id === id));
  if (gecerli.length === 0) return new Response("Geçersiz seçim", { status: 400 });

  // Hedef listesi (mevcutsa üstüne ekler; unique index çiftleri engeller)
  const mevcutListe = await db.query.learningList.findMany({
    where: eq(schema.learningList.userId, member.id),
  });
  let sira = mevcutListe.length;
  for (const bookId of gecerli) {
    await db
      .insert(schema.learningList)
      .values({ userId: member.id, bookId, order: sira++ })
      .onConflictDoNothing();
  }

  // İlk seçim hediye (yalnızca daha önce hediye alınmadıysa)
  const existingGift = await db.query.bookAccess.findFirst({
    where: and(
      eq(schema.bookAccess.userId, member.id),
      eq(schema.bookAccess.source, "gift"),
    ),
  });

  // Hazine artık dolu: kayıt anında (liste boşken) verilemeyen seviye
  // hediyelerini burada telafi et. Yeni üye +50 welcome ile anında Sv3
  // olduğundan bu hak eskiden sessizce yanıyordu.
  const telafi = await seviyeHediyeleriniUygula(member.id);
  if (telafi.length > 0) {
    await db.insert(schema.notifications).values({
      userId: member.id,
      kind: "level",
      body: `Seviyenden hak ettiğin ${telafi.length} bedava kitap hazinenden açıldı 🎁`,
      href: R.kitap(telafi[0]!),
    });
  }

  if (!existingGift) {
    const hediye = gecerli[0]!;
    await db
      .insert(schema.bookAccess)
      .values({ userId: member.id, bookId: hediye, source: "gift" })
      .onConflictDoNothing();
    await db.insert(schema.notifications).values({
      userId: member.id,
      kind: "gift",
      body: "Hazinenin ilk kitabı açıldı 🎁 Kalanların anahtarı: yaz, çöz, paylaş.",
      href: R.uye.yaz(hediye),
    });
    return context.redirect(`${R.kitap(hediye)}?hediye=1`);
  }
  return context.redirect(R.uye.panel);
};
