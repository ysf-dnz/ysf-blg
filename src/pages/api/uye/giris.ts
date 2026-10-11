/**
 * POST /api/uye/giris (JSON) — görevli tarayıcısı bilet okuttu. Yanıt JSON: tarayıcı sayfa
 * yenilemeden art arda okutur. Kimlik: oturum; yetki: o etkinliğin görevlisi (host/scanner/admin).
 */
import type { APIRoute } from "astro";
import { biletGiris } from "@/lib/etkinlik.ts";
import { getOrCreateMember } from "@/lib/member.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  // Astro'nun köken kontrolü yalnız form içerik türlerine bakar: içerik türü OLMAYAN no-cors POST
  // çapraz siteden geçer. application/json şartı tarayıcıda preflight zorlar; sec-fetch-site
  // gönderen tarayıcıda ayrıca aynı köken istenir (görevlinin oturumuyla uzaktan giriş yazdırılamasın).
  const kaynak = context.request.headers.get("sec-fetch-site");
  if (
    !(context.request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json") ||
    (kaynak !== null && kaynak !== "same-origin")
  )
    return Response.json({ durum: "gecersiz" }, { status: 400 });
  const member = await getOrCreateMember(context);
  if (!member) return Response.json({ durum: "oturum" }, { status: 401 });
  const govde = (await context.request.json().catch(() => null)) as { token?: unknown; eventId?: unknown } | null;
  const token = typeof govde?.token === "string" ? govde.token.slice(0, 40) : "";
  const eventId = Number(govde?.eventId) || undefined;
  const sonuc = await biletGiris(token, member, eventId);
  const status = { gecersiz: 404, yetkisiz: 403, hiz: 429 }[sonuc.durum as string] ?? 200;
  return Response.json(sonuc, { status, headers: { "cache-control": "no-store" } });
};
