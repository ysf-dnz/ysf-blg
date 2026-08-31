/**
 * GET /api/uye/kitap-linkler?bookId=... — kutlama bandının içeriğini verir.
 *
 * NEDEN VAR: kitap sayfaları statiktir (884 sayfa, aranabilir). Statik HTML
 * build anında üretildiği için `?acildi=1` gibi çalışma-zamanı durumunu
 * bilemez. Eskiden bantlar statik HTML'de durup Drive linklerini İSTEMCİDE
 * kuruyordu — misafir `?acildi=1` yazarak çalışan bir indirme linki alıyordu.
 * Artık linkler yalnız buradan, erişim SUNUCUDA doğrulandıktan sonra gelir.
 *
 * Erişimi olmayan (misafir dahil) 403 alır ve bant hiç açılmaz.
 */
import type { APIRoute } from "astro";
import { getOrCreateMember, hasBookAccess } from "@/lib/member.ts";
import { siteKok } from "@/lib/urls.ts";
import { getEntry } from "astro:content";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const bookId = context.url.searchParams.get("bookId") ?? "";
  if (!bookId) return new Response("bookId eksik", { status: 400 });

  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });
  if (!(await hasBookAccess(member.id, bookId)))
    return new Response("Bu kitap henüz açılmadı", { status: 403 });

  const kitap = await getEntry("books", bookId);
  const notebookId = kitap?.data.notebookId;

  return Response.json(
    {
      indir: `https://drive.google.com/uc?export=download&id=${bookId}`,
      oku: `https://drive.google.com/file/d/${bookId}/view`,
      notebook: notebookId
        ? `https://notebooklm.google.com/notebook/${notebookId}`
        : null,
      // Kutlama anı = paylaşım anı: davet kartı bu ref linkiyle üretilir
      ref: `${siteKok(context.site, context.url)}/?ref=${member.handle}`,
      kitapAdi: kitap?.data.titleTr ?? kitap?.data.title ?? "",
      kapak: kitap?.data.cover ?? null,
    },
    { headers: { "cache-control": "private, no-store" } },
  );
};
