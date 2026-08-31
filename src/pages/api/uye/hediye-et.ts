/**
 * POST /api/uye/hediye-et — arkadaşa kitap hediye etme (100 puan).
 * Sosyal harcama: ekonomiyi süzer + yeni okuyucu kazandırır.
 * Korumalar: kendine olmaz, alıcı zaten sahipse olmaz, bakiye şart.
 */
import type { APIRoute } from "astro";
import { spendPoints } from "@/lib/rewards.ts";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember, hasBookAccess } from "@/lib/member.ts";
import { PUAN } from "@/lib/points.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });

  const form = await context.request.formData();
  const bookId = String(form.get("bookId") ?? "");
  const handle = String(form.get("handle") ?? "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
  // Hata dalları SESSİZ kalmamalı: yanlış handle yazan üye hediyenin
  // gittiğini sanıyordu. Her başarısızlık ?hediye=<kod> ile panoda gösterilir.
  const geri = (hata?: string) =>
    context.redirect(hata ? `/uye?hediye=${hata}` : "/uye?hediye=ok");

  if (!bookId || !handle) return geri("eksik");
  // Hediye edilecek kitaba kendin sahip olmalısın (raftan hediye edilir)
  if (!(await hasBookAccess(member.id, bookId))) return geri("sahipdegil");

  const alici = await db.query.users.findFirst({
    where: eq(schema.users.handle, handle),
  });
  if (!alici) return geri("kisiyok");
  if (alici.id === member.id) return geri("kendine");
  if (await hasBookAccess(alici.id, bookId)) {
    await db.insert(schema.notifications).values({
      userId: member.id,
      kind: "gift",
      body: `@${alici.handle} bu kitaba zaten sahip — puanın harcanmadı.`,
    });
    return geri("zatensahip");
  }

  // Atomik harcama: bakiye koşulu INSERT içinde; aynı hediye iki kez kesilmez
  const kesildi = await spendPoints({
    userId: member.id,
    cost: PUAN.giftBookCost,
    reason: "spend_gift",
    refId: `${bookId}→${alici.id}`,
  });
  if (!kesildi) return geri("puan");
  await db
    .insert(schema.bookAccess)
    .values({ userId: alici.id, bookId, source: "reward" })
    .onConflictDoNothing();
  await db.insert(schema.notifications).values({
    userId: alici.id,
    kind: "gift",
    body: `${member.name} sana bir kitap hediye etti 🎁`,
    href: `/kutuphane/kitap/${bookId}`,
  });
  await db.insert(schema.notifications).values({
    userId: member.id,
    kind: "gift",
    body: `Hediyen @${alici.handle}'a ulaştı 🎁 −${PUAN.giftBookCost} puan`,
  });
  return geri();
};
