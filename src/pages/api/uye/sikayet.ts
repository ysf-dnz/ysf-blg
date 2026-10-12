/**
 * POST /api/uye/sikayet — kurs, yorum (F1-10), üye ya da mesaj (F4-04) şikâyeti.
 * Kurs/yorum: üç FARKLI Sv4+ üye şikâyet ettiyse içerik incelemeye kadar gizlenir;
 * sayım gizleme UPDATE'inin WHERE'inde (tek SQL, yarışsız). Üye/mesaj: otomatik etki YOK,
 * yalnız admin kuyruğu (/uye/admin). Mesajı yalnız ALICISI şikâyet eder (başkasının
 * yazışması id deneyerek kuyruğa düşürülemesin); engel şikâyeti kapatmaz.
 */
import type { APIRoute } from "astro";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { SV4_PUAN } from "@/lib/levels.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { idMi } from "@/lib/mesaj.ts";
import { sikayetKaydet, sikayetTuruMu } from "@/lib/sikayet.ts";
import { guvenliYol } from "@/lib/urls.ts";

export const prerender = false;

/** Gizleme eşiği: bu kadar farklı Sv4+ üye */
export const SIKAYET_ESIGI = 3;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });

  const form = await context.request.formData();
  const targetType = String(form.get("targetType") ?? "");
  const targetId = Number(form.get("targetId") ?? 0);
  const reason = String(form.get("reason") ?? "").trim().slice(0, 300) || null;
  const geri = guvenliYol(form, "/kurslar");
  if (!sikayetTuruMu(targetType) || !idMi(targetId))
    return new Response("Geçersiz hedef", { status: 400 });

  // Hedef var ve şikâyet edilebilir durumda mı (kuyruk olmayan/zaten kapalı hedeflerle dolmasın).
  // Her tür KENDİ tablosunda aranır: id'ler tablolar arasında çakışır.
  const hedefVar = await {
    course: () =>
      db.query.courses.findFirst({
        where: and(eq(schema.courses.id, targetId), inArray(schema.courses.status, ["published", "hidden"])),
        columns: { id: true },
      }),
    comment: () =>
      db.query.comments.findFirst({
        where: and(eq(schema.comments.id, targetId), isNull(schema.comments.hiddenAt)),
        columns: { id: true },
      }),
    user: () =>
      targetId === member.id
        ? Promise.resolve(undefined)
        : db.query.users.findFirst({ where: eq(schema.users.id, targetId), columns: { id: true } }),
    message: () =>
      db.query.messages.findFirst({
        where: and(eq(schema.messages.id, targetId), eq(schema.messages.recipientId, member.id)),
        columns: { id: true },
      }),
  }[targetType]();
  if (!hedefVar) return new Response("Hedef bulunamadı", { status: 404 });
  const don = (durum: string) => context.redirect(`${geri}${geri.includes("?") ? "&" : "?"}sikayet=${durum}`);

  // Saatte 10 freni + yazım tek transaction'da (lib/sikayet.ts). Düz metin 429 değil yönlendirme:
  // ClientRouter HTML olmayan yanıtta kullanıcıya 404 gösterirdi.
  const kayit = await sikayetKaydet(member.id, targetType, targetId, reason);
  if (kayit === "hiz") return don("hiz");

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
  } else if (targetType === "comment") {
    await db.execute(
      sql`update comments set hidden_at = now() where id = ${targetId} and hidden_at is null and ${sayim}`,
    );
  }
  // user | message: otomatik gizleme yok (aynı id'li yorumu gizleme tuzağı — dal AÇIKÇA comment)
  return don(kayit === "vardi" ? "var" : "1");
};
