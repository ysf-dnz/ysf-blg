/**
 * POST /api/uye/etkinlik — etkinlik aç, kayıt ol (RSVP), dönen QR girişi, görevli yönet, elle giriş, değerlendir.
 * Aksiyonlar AÇIK dallardır: bilinmeyen aksiyon 400 (eskiden her şey oluşturmaya düşüyordu).
 */
import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import {
  donenGiris,
  etkinligiDegerlendir,
  etkinlikGorunurMu,
  gorevliEkle,
  gorevliHizAsildi,
  gorevliRol,
  gorevliSil,
  girisYap,
  kayitOl,
  okutabilirMi,
  slugGaranti,
  slugUret,
  yonetebilirMi,
} from "@/lib/etkinlik.ts";
import { ETKINLIK_TURLERI, etkinlikBitis, KAPI_ACILIS_DK, trTarihOku, type EtkinlikTuru } from "@/lib/etkinlik-kural.ts";
import { getOrCreateMember } from "@/lib/member.ts";
import { canManage, clubRoleOf } from "@/lib/permissions.ts";
import { R } from "@/lib/routes.ts";
import { ilBul } from "@/lib/topluluk.ts";

export const prerender = false;

const GUN = 864e5;

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });

  const form = await context.request.formData();
  const action = String(form.get("action") ?? "create");
  const metin = (ad: string, azami: number) => String(form.get(ad) ?? "").trim().slice(0, azami);

  if (action === "create") {
    // Kulüp etkinliğinde kulüp yöneticisi, kulüpsüz (site geneli) etkinlikte rep/admin
    const clubId = Number(form.get("clubId") ?? 0) || null;
    const kulup = clubId ? await db.query.clubs.findFirst({ where: eq(schema.clubs.id, clubId) }) : null;
    if (clubId && !kulup) return new Response("Topluluk bulunamadı", { status: 404 });
    const yetkili = clubId ? canManage(await clubRoleOf(member, clubId)) : member.role !== "member";
    if (!yetkili) return new Response("Yetkisiz", { status: 403 });
    // Onay bekleyen/arşivli topluluk etkinlik açamaz: herkes başvurup anında başkan olur; admin
    // onayı etkinlik ödüllerinin (katılım, düzenleyen payı) tek güven kapısıdır.
    if (kulup && kulup.status !== "approved" && member.role !== "admin")
      return new Response("Topluluğun onaylanınca etkinlik açabilirsin", { status: 403 });

    const title = metin("title", 80);
    const startsAt = trTarihOku(String(form.get("startsAt") ?? ""));
    if (!title || !startsAt) return new Response("Başlık ve başlangıç zamanı gerekli", { status: 400 });
    // Geçmişe/şu ana etkinlik açılamaz: giriş penceresi ve değerlendirme anında açılırdı
    if (startsAt.getTime() <= Date.now())
      return new Response("Başlangıç zamanı gelecekte olmalı", { status: 400 });
    const endsHam = String(form.get("endsAt") ?? "").trim();
    const endsAt = endsHam ? trTarihOku(endsHam) : null;
    if (endsHam && (!endsAt || endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 14 * GUN))
      return new Response("Bitiş, başlangıçtan sonra ve en çok 14 gün içinde olmalı", { status: 400 });
    const bitis = etkinlikBitis({ startsAt, endsAt });
    const kapanisHam = String(form.get("rsvpClosesAt") ?? "").trim();
    const rsvpClosesAt = kapanisHam ? trTarihOku(kapanisHam) : null;
    if (kapanisHam && (!rsvpClosesAt || rsvpClosesAt > bitis))
      return new Response("Kayıt kapanışı etkinlik bitişinden sonra olamaz", { status: 400 });
    const kindHam = String(form.get("kind") ?? "");
    const kapasite = Math.trunc(Number(form.get("capacity") ?? 0));
    const kapak = metin("coverUrl", 300);

    const slug = slugUret(title);
    const [e] = await db
      .insert(schema.events)
      .values({
        clubId,
        slug,
        title,
        description: metin("description", 500) || null,
        startsAt,
        endsAt,
        kind: (ETKINLIK_TURLERI as readonly string[]).includes(kindHam) ? (kindHam as EtkinlikTuru) : null,
        location: metin("location", 120) || null,
        il: ilBul(String(form.get("il") ?? "")) ?? ilBul(kulup?.il) ?? null,
        capacity: kapasite >= 1 && kapasite <= 100_000 ? kapasite : null,
        rsvpClosesAt,
        // canParse şart: bozuk URL sayfada new URL ile kalıcı 500 üretirdi (kurs kapağı kuralı)
        coverUrl: /^https:\/\/[^\s]+$/.test(kapak) && URL.canParse(kapak) ? kapak : null,
        createdBy: member.id,
      })
      .returning();
    // Açan otomatik düzenleyen (host). Bu satır yazılamasa da created_by host sayılır.
    await gorevliEkle(e!, member.id, "host");
    return context.redirect(`${R.etkinlik(slug)}?yeni=1`);
  }

  const eventId = Number(form.get("eventId") ?? 0);
  const e = eventId ? await db.query.events.findFirst({ where: eq(schema.events.id, eventId) }) : undefined;
  if (!e) return new Response("Etkinlik bulunamadı", { status: 404 });
  const slug = await slugGaranti(e);
  const sayfa = R.etkinlik(slug);

  if (action === "rsvp") {
    const kulup = e.clubId ? await db.query.clubs.findFirst({ where: eq(schema.clubs.id, e.clubId) }) : null;
    if (!etkinlikGorunurMu(e, kulup) && !(await yonetebilirMi(e, member)))
      return new Response("Etkinlik bulunamadı", { status: 404 });
    // Kayıt PUAN ÜRETMEZ (AC-15): event_attended yalnız doğrulanmış girişte yazılır
    const k = await kayitOl(member, e, { oncelik: form.get("priority") === "1", cookies: context.cookies });
    const p = new URLSearchParams({ sonuc: k.durum });
    if (k.davetli) p.set("davet", "1");
    if (form.get("priority") === "1" && k.durum === "yeni" && !k.oncelikli) p.set("oncelik", "yok");
    return context.redirect(`${sayfa}?${p}`);
  }

  // Dönen QR ile kendi girişini doğrula (F4-05, #32): giriş /c/q/ GET'inde DEĞİL burada yazılır.
  // Tüm sonuçlar etkinlik sayfasına döner (otomatik gönderen /c/q/ sayfasına dönmek döngü olurdu).
  if (action === "donen-giris") {
    const kulup = e.clubId ? await db.query.clubs.findFirst({ where: eq(schema.clubs.id, e.clubId) }) : null;
    // Gizli etkinlikte 404: yönlendirme adresi slug'ı sızdırmasın
    if (!etkinlikGorunurMu(e, kulup)) return new Response("Etkinlik bulunamadı", { status: 404 });
    const s = await donenGiris(e, member, metin("token", 40), context.cookies);
    return context.redirect(`${sayfa}?giris=${s.durum}${s.durum === "geldi" ? `&puan=${s.puan}` : ""}`);
  }

  if (action === "staff-ekle" || action === "staff-sil") {
    if (!(await yonetebilirMi(e, member))) return new Response("Yetkisiz", { status: 403 });
    const handle = metin("handle", 60).replace(/^@/, "").toLowerCase();
    const kisi = handle
      ? await db.query.users.findFirst({ where: eq(schema.users.handle, handle) })
      : undefined;
    if (!kisi) return context.redirect(`${sayfa}?gorevli=yok#yonetim`);
    const rol = form.get("rol") === "host" ? "host" : "scanner";
    // Düzenleyen (host) listesi payı böler: yalnız etkinliği AÇAN (ve admin) değiştirir, o da kapı
    // açılışına kadar. Yoksa ortak düzenleyen diğerlerini çıkarıp kendi hesaplarını ekleyebiliyor,
    // dağıtımdan hemen önce liste değiştirilebiliyordu. Görevli (scanner) yönetimi her düzenleyende.
    const hedefRol = action === "staff-sil" ? await gorevliRol(e, kisi.id) : rol;
    if (hedefRol === "host") {
      const acan = member.id === e.createdBy || member.role === "admin";
      const kapidanOnce = Date.now() < e.startsAt.getTime() - KAPI_ACILIS_DK * 60_000;
      if (!acan || !kapidanOnce) return context.redirect(`${sayfa}?gorevli=kilitli#yonetim`);
    }
    if (action === "staff-sil") {
      await gorevliSil(e, kisi.id);
      return context.redirect(`${sayfa}?gorevli=silindi#yonetim`);
    }
    const eklendi = await gorevliEkle(e, kisi.id, rol);
    if (eklendi) {
      await db.insert(schema.notifications).values({
        userId: kisi.id,
        kind: "event",
        body:
          rol === "host"
            ? `"${e.title}" etkinliğinde ortak düzenleyen oldun 🎤 Katılımcı puanı düzenleyenler arasında paylaşılır.`
            : `"${e.title}" etkinliğinde giriş görevlisisin 🎟️ Bilet okutma ekranı etkinlik sayfasında.`,
        href: sayfa,
      });
    }
    return context.redirect(`${sayfa}?gorevli=${eklendi ? "eklendi" : "olmadi"}#yonetim`);
  }

  // Değerlendirme (1–5): yalnız girişi doğrulanmış katılımcı, bitişten 7 gün sonrasına kadar
  if (action === "rate") {
    const s = await etkinligiDegerlendir(e, member.id, Number(form.get("stars")), metin("body", 300) || null);
    return context.redirect(`${sayfa}?deger=${s}#degerlendir`);
  }

  // Elle giriş: telefonu/bileti olmayan kayıtlı katılımcıyı görevli listeden işaretler
  if (action === "checkin-manual") {
    if (!(await okutabilirMi(e, member))) return new Response("Yetkisiz", { status: 403 });
    const donus = R.etkinlikGiris(slug);
    if (await gorevliHizAsildi(member.id)) return context.redirect(`${donus}?elle=hiz#liste`);
    const s = await girisYap(e, Number(form.get("userId") ?? 0), "manual", member.id);
    return context.redirect(`${donus}?elle=${s.durum}#liste`);
  }

  return new Response("Bilinmeyen işlem", { status: 400 });
};
