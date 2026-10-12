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
import { engelDurumu, engelKaldir, engelle, idMi, konusma, mesajGonder, okunduYaz, okunmamisMesaj } from "@/lib/mesaj.ts";
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
  const mesajlar = await konusma(member.id, kisi.id, { sonraId: idMi(since) ? since : 0 });
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
    if (s.durum === "ok") {
      await okunduYaz(member.id, kisi.id);
      return json ? Response.json(s, { headers: ONBELLEKSIZ }) : context.redirect(sayfa);
    }
    // Karşı tarafın engeli SÖYLENMEZ: adres, durum kodu ve metin "mesaj almıyor" ile birebir aynı
    // (yalnız metni gizleyip ?hata=engel / durum:"engel" döndürmek engeli ele veriyordu)
    const durum = s.durum === "engel" && !(await engelDurumu(member.id, kisi.id)).benim ? "kapali" : s.durum;
    if (!json) return context.redirect(`${sayfa}?hata=${durum}`);
    const politika = kisi.dmPolicy && dmPolitikasiMi(kisi.dmPolicy) ? kisi.dmPolicy : "mutual";
    return Response.json(
      { durum, mesaj: retMetni(durum, { ad: kisi.name, politika, benEngelledim: durum === "engel" }) },
      { status: durum === "hiz" ? 429 : durum === "bos" ? 400 : 403, headers: ONBELLEKSIZ },
    );
  }

  if (action === "okundu") {
    // son: sayfada gösterilen en yeni mesaj (görülmemiş, sonradan gelen mesaj okundu sayılmasın)
    const son = Number(form.get("son") ?? 0);
    await okunduYaz(member.id, kisi.id, idMi(son) ? son : undefined);
    return Response.json({ okunmamis: await okunmamisMesaj(member.id) }, { headers: ONBELLEKSIZ });
  }

  if (action === "engelle" || action === "engel-kaldir") {
    if (action === "engelle") await engelle(member.id, kisi.id);
    else await engelKaldir(member.id, kisi.id);
    return context.redirect(guvenliYol(form, sayfa));
  }

  return new Response("Bilinmeyen işlem", { status: 400 });
};
