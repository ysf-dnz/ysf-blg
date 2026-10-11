/**
 * /api/uye/mesaj — birebir mesaj (DM v1, F4-03) ve engel (F4-04).
 *  GET  ?kisi=<handle>&since=<mesaj id>  → yoklama (JSON; YAZMAZ — "okundu" ayrı POST'tur).
 *  POST action=send | okundu | engelle | engel-kaldir  (form; kisi=<handle>).
 * Hata yanıtları düz metin DEĞİL yönlendirmedir: ClientRouter form POST'unu fetch ile gönderir ve
 * HTML olmayan yanıtta aksiyon adresine GET atar (kullanıcı 404 görürdü). İstemci betiği
 * `accept: application/json` gönderirse aynı sonuç JSON döner (sayfa yenilenmeden gönderim).
 */
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { dmPolitikasiMi } from "@/lib/economy.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { engelDurumu, engelKaldir, engelle, konusma, mesajGonder, okunduYaz, okunmamisMesaj } from "@/lib/mesaj.ts";
import { mesajZamani, retMetni } from "@/lib/mesaj-kural.ts";
import { R } from "@/lib/routes.ts";
import { guvenliYol } from "@/lib/urls.ts";

export const prerender = false;

const ONBELLEKSIZ = { "cache-control": "private, no-store" };
const kisiBul = (handle: string) =>
  /^[a-z0-9-]{1,60}$/.test(handle)
    ? db.query.users.findFirst({ where: eq(schema.users.handle, handle) })
    : Promise.resolve(undefined);

export const GET: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return Response.json({ durum: "oturum" }, { status: 401, headers: ONBELLEKSIZ });
  const kisi = await kisiBul(context.url.searchParams.get("kisi") ?? "");
  if (!kisi || kisi.id === member.id) return Response.json({ durum: "yok" }, { status: 404, headers: ONBELLEKSIZ });
  const since = Number(context.url.searchParams.get("since") ?? 0);
  const mesajlar = await konusma(member.id, kisi.id, { sonraId: Number.isSafeInteger(since) && since > 0 ? since : 0 });
  return Response.json(
    {
      mesajlar: mesajlar.map((m) => ({
        id: m.id,
        benden: m.senderId === member.id,
        govde: m.body,
        zaman: mesajZamani(m.createdAt),
      })),
    },
    { headers: ONBELLEKSIZ },
  );
};

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });
  const form = await context.request.formData();
  const action = String(form.get("action") ?? "");
  const json = (context.request.headers.get("accept") ?? "").includes("application/json");
  const kisi = await kisiBul(String(form.get("kisi") ?? ""));
  if (!kisi || kisi.id === member.id)
    return json ? Response.json({ durum: "yok" }, { status: 404 }) : context.redirect(R.uye.mesajlar);
  const sayfa = R.uye.mesaj(kisi.handle);

  if (action === "send") {
    const s = await mesajGonder(member.id, kisi.id, String(form.get("body") ?? ""));
    // Yanıtlamak okumaktır: gönderim başarılıysa bu kişiden gelenler okundu
    if (s.durum === "ok") await okunduYaz(member.id, kisi.id);
    if (!json) return context.redirect(s.durum === "ok" ? sayfa : `${sayfa}?hata=${s.durum}`);
    if (s.durum === "ok") return Response.json(s, { headers: ONBELLEKSIZ });
    const politika = kisi.dmPolicy && dmPolitikasiMi(kisi.dmPolicy) ? kisi.dmPolicy : "mutual";
    const benEngelledim = s.durum === "engel" && (await engelDurumu(member.id, kisi.id)).benim;
    return Response.json(
      { durum: s.durum, mesaj: retMetni(s.durum, { ad: kisi.name, politika, benEngelledim }) },
      { status: s.durum === "hiz" ? 429 : s.durum === "bos" ? 400 : 403, headers: ONBELLEKSIZ },
    );
  }

  if (action === "okundu") {
    await okunduYaz(member.id, kisi.id);
    return Response.json({ okunmamis: await okunmamisMesaj(member.id) }, { headers: ONBELLEKSIZ });
  }

  if (action === "engelle" || action === "engel-kaldir") {
    if (action === "engelle") await engelle(member.id, kisi.id);
    else await engelKaldir(member.id, kisi.id);
    return context.redirect(guvenliYol(form, sayfa));
  }

  return new Response("Bilinmeyen işlem", { status: 400 });
};
