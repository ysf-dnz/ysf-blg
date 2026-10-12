/**
 * POST /api/uye/bildirim — bildirimlerimi okundu yaz. Pano (/uye) betiği çağırır: okundu
 * yazımı GET'te DEĞİL (zile ya da herhangi bir /uye bağlantısına ön-yükleme, kullanıcı panoyu
 * açmadan sayacı sıfırlıyordu). `son`: sayfada gösterilen en yeni bildirimin id'si — render ile
 * POST arasında gelen (görülmemiş) bildirim okundu sayılmasın.
 */
import type { APIRoute } from "astro";
import { and, eq, isNull, lte } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getOrCreateMember } from "@/lib/member.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });
  const son = Number((await context.request.formData()).get("son") ?? 0);
  if (!Number.isSafeInteger(son) || son <= 0) return new Response("Geçersiz istek", { status: 400 });
  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(schema.notifications.userId, member.id),
        isNull(schema.notifications.readAt),
        lte(schema.notifications.id, son),
      ),
    );
  return new Response(null, { status: 204 });
};
