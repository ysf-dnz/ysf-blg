/**
 * POST /api/uye/sikayet — kurs ya da yorum şikâyeti (F1-10).
 * Üç FARKLI Sv4+ üye şikâyet ettiyse içerik incelemeye kadar gizlenir;
 * sayım gizleme UPDATE'inin WHERE'inde (tek SQL, yarışsız). Admin kuyruğu /uye/admin.
 */
import type { APIRoute } from "astro";
import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { LEVEL_THRESHOLDS } from "@/lib/levels.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { guvenliYol } from "@/lib/urls.ts";

export const prerender = false;

/** Gizleme eşiği: bu kadar farklı Sv4+ üye */
export const SIKAYET_ESIGI = 3;
const SV4_PUAN = LEVEL_THRESHOLDS[3]!; // seviye 4 eşiği (kazanılan toplam)

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });

  const form = await context.request.formData();
  const targetType = String(form.get("targetType") ?? "");
  const targetId = Number(form.get("targetId") ?? 0);
  const reason = String(form.get("reason") ?? "").trim().slice(0, 300) || null;
  const geri = guvenliYol(form, "/kurslar");
  if (!(targetType === "course" || targetType === "comment") || !targetId)
    return new Response("Geçersiz hedef", { status: 400 });

  // Hedef var ve şikâyet edilebilir durumda mı (kuyruk olmayan/zaten kapalı hedeflerle dolmasın)
  const hedefVar =
    targetType === "course"
      ? await db.query.courses.findFirst({
          where: and(eq(schema.courses.id, targetId), inArray(schema.courses.status, ["published", "hidden"])),
        })
      : await db.query.comments.findFirst({
          where: and(eq(schema.comments.id, targetId), isNull(schema.comments.hiddenAt)),
        });
  if (!hedefVar) return new Response("Hedef bulunamadı", { status: 404 });

  // Hız sınırı: şikâyetçi başına saatte 10
  const [sonSaat] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.reports)
    .where(
      and(
        eq(schema.reports.reporterId, member.id),
        gte(schema.reports.createdAt, new Date(Date.now() - 3600_000)),
      ),
    );
  if (Number(sonSaat?.n ?? 0) >= 10)
    return new Response("Saatte en çok 10 şikâyet", { status: 429 });

  await db
    .insert(schema.reports)
    .values({ reporterId: member.id, targetType, targetId, reason })
    .onConflictDoNothing();

  // Sv4+ farklı şikâyetçi sayısı eşiği aşıyorsa gizle — sayım WHERE'de
  const sayim = sql`(
    select count(distinct r.reporter_id) from reports r
    where r.target_type = ${targetType} and r.target_id = ${targetId} and r.status = 'open'
      and (select coalesce(sum(delta), 0) from points_ledger
           where user_id = r.reporter_id and delta > 0) >= ${SV4_PUAN}
  ) >= ${SIKAYET_ESIGI}`;
  if (targetType === "course") {
    await db.execute(
      sql`update courses set status = 'hidden' where id = ${targetId} and status = 'published' and ${sayim}`,
    );
  } else {
    await db.execute(
      sql`update comments set hidden_at = now() where id = ${targetId} and hidden_at is null and ${sayim}`,
    );
  }
  return context.redirect(`${geri}${geri.includes("?") ? "&" : "?"}sikayet=1`);
};
