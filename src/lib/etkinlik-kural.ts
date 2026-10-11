/**
 * Etkinlik kuralları — SAF fonksiyonlar (DB yok, birim testli): zaman pencereleri,
 * TR saatli girdi/çıktı, bilet ve dönen QR imzaları (ADR 0001 K6), .ics üretimi.
 * DB'li akış (kayıt, giriş, ödül) lib/etkinlik.ts'te; davet.ts de buradan okur
 * (döngüsel import olmasın diye ayrı dosya).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { PUAN } from "./points.ts";

/** events tablosunun bu modülün baktığı kadarı (şema tipine bağımlı olmadan test edilir) */
export type EtkinlikZamani = {
  startsAt: Date;
  endsAt: Date | null;
  rsvpClosesAt?: Date | null;
};

export const ETKINLIK_TURLERI = ["bulusma", "atolye", "konferans", "cevrimici"] as const;
export type EtkinlikTuru = (typeof ETKINLIK_TURLERI)[number];
export const TUR_AD: Record<EtkinlikTuru, string> = {
  bulusma: "Buluşma",
  atolye: "Atölye",
  konferans: "Konferans",
  cevrimici: "Çevrimiçi",
};

const TZ = "Europe/Istanbul";
const SAAT = 3600_000;
/** Bitişi girilmemiş (eski) etkinlik bu kadar sürer sayılır */
export const VARSAYILAN_SURE_SAAT = 2;
/** Kapı açılışı: giriş doğrulaması başlangıçtan bu kadar dakika önce başlar */
export const KAPI_ACILIS_DK = 60;

/**
 * Herkese açık mı? events'te status yok: kulüp etkinliği kulüp onaylıysa görünür
 * (onay bekleyen kulübün etkinliği sitemap/OG ile indekslenmesin); kulüpsüz etkinliği
 * yalnız rep/admin açabildiği için hep görünür.
 */
export function etkinlikGorunurMu(
  e: { clubId: number | null },
  kulup: { status: string } | null | undefined,
): boolean {
  return !e.clubId || kulup?.status === "approved";
}

export function etkinlikBitis(e: EtkinlikZamani): Date {
  return e.endsAt ?? new Date(e.startsAt.getTime() + VARSAYILAN_SURE_SAAT * SAAT);
}

/** Kayıt (RSVP) açık mı: kayıt kapanışına — yoksa bitişe — kadar */
export function kayitAcikMi(e: EtkinlikZamani, simdi: Date = new Date()): boolean {
  return simdi.getTime() < (e.rsvpClosesAt ?? etkinlikBitis(e)).getTime();
}

/**
 * Giriş doğrulaması penceresi: kapı açılışından bitişe kadar. Bitişten SONRA giriş
 * yazılmaz: davet edenin bekleyeni bitişte düşer (AC-19) ve puanOlayi düşmüş satıra
 * bakmadan ödediği için pencere burada kapanmak zorunda.
 */
export function girisPenceresinde(e: EtkinlikZamani, simdi: Date = new Date()): boolean {
  const t = simdi.getTime();
  return t >= e.startsAt.getTime() - KAPI_ACILIS_DK * 60_000 && t <= etkinlikBitis(e).getTime();
}

/** Değerlendirme: başlangıçtan bitiş + 7 güne kadar (yalnız giriş yapanlar — çağıran denetler) */
export function degerlendirmeAcikMi(e: EtkinlikZamani, simdi: Date = new Date()): boolean {
  const t = simdi.getTime();
  return t >= e.startsAt.getTime() && t <= etkinlikBitis(e).getTime() + PUAN.eventRatingDays * 24 * SAAT;
}

/**
 * `<input type="datetime-local">` değeri (YYYY-MM-DDTHH:mm) TR saatidir. `new Date(s)`
 * sunucu saat dilimiyle (Vercel UTC) çözer ve anı 3 saat kaydırırdı → sabit +03:00
 * (Türkiye kalıcı UTC+3, yaz saati yok).
 */
export function trTarihOku(girdi: string | null | undefined): Date | null {
  const s = String(girdi ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null;
  const d = new Date(`${s}:00+03:00`);
  return isNaN(d.getTime()) ? null : d;
}

const girdiBicimi = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
/** Date → datetime-local değeri (TR saati) */
export function trGirdi(d: Date): string {
  return girdiBicimi.format(d).replace(" ", "T");
}

const tarihBicimi = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TZ,
  day: "numeric",
  month: "long",
  year: "numeric",
  weekday: "long",
});
const saatBicimi = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
export const trTarih = (d: Date): string => tarihBicimi.format(d);
export const trSaat = (d: Date): string => saatBicimi.format(d);
/** "12 Ekim 2026 Pazartesi · 19:00–21:00" */
export function trAralik(e: EtkinlikZamani): string {
  return `${trTarih(e.startsAt)} · ${trSaat(e.startsAt)}–${trSaat(etkinlikBitis(e))}`;
}

/* ---------------- İmzalar: bilet ve dönen QR (ADR K6) ---------------- */

/** Crockford Base32 (I, L, O, U yok) — QR alfanümerik moduna uyar */
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const BILET_IMZA_UZUNLUK = 16; // 80 bit
export const DONEN_IMZA_UZUNLUK = 10; // 50 bit, ömrü < 60 sn
export const DONEN_PENCERE_SN = 30;

export function base32(buf: Uint8Array, uzunluk: number): string {
  let bit = 0;
  let deger = 0;
  let s = "";
  for (const b of buf) {
    deger = (deger << 8) | b;
    bit += 8;
    while (bit >= 5 && s.length < uzunluk) {
      s += B32[(deger >>> (bit - 5)) & 31];
      bit -= 5;
    }
    deger &= (1 << bit) - 1; // tüketilen bitleri at (32 bit taşmasın)
    if (s.length >= uzunluk) break;
  }
  return s;
}

/**
 * İmza sırrı. Yedek YOK: sır eksikse herkesin üretebileceği bilet yerine hata.
 * Aynı sırrın üç kullanımı öneklerle ayrılır (alan ayrımı): bilet "t:", dönen QR "c:",
 * IP/UA takma adı `kisaHash` "h:" — biri diğerinin imzasını üretemez.
 */
function gizliSir(): string {
  const s = process.env.CRON_SECRET ?? import.meta.env.CRON_SECRET;
  if (!s) throw new Error("CRON_SECRET tanımlı değil — bilet/giriş imzası üretilemez.");
  return s;
}

function imza(mesaj: string, uzunluk: number, sir: string): string {
  return base32(createHmac("sha256", sir).update(mesaj).digest(), uzunluk);
}

function esit(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Elle yazımda O→0, I/L→1 (Crockford); QR'dan gelen zaten büyük harf */
const imzaNormalize = (s: string) => s.toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1");

/** Bilet token'ı: `{rsvpId}.{base32(HMAC("t:"+rsvpId))}` — kolonsuz; ilk parça RSVP'yi bulur */
export function biletToken(rsvpId: number, sir: string = gizliSir()): string {
  return `${rsvpId}.${imza(`t:${rsvpId}`, BILET_IMZA_UZUNLUK, sir)}`;
}

/** Geçerli imzalı token → rsvpId; değilse null */
export function biletCoz(token: string | null | undefined, sir: string = gizliSir()): number | null {
  const m = String(token ?? "").trim().match(/^(\d{1,9})\.([0-9A-Za-z]{16})$/);
  if (!m) return null;
  const rsvpId = Number(m[1]);
  return esit(imza(`t:${rsvpId}`, BILET_IMZA_UZUNLUK, sir), imzaNormalize(m[2]!)) ? rsvpId : null;
}

export function donenPencere(simdi: Date = new Date()): number {
  return Math.floor(simdi.getTime() / (DONEN_PENCERE_SN * 1000));
}

/** Dönen QR token'ı: base32(HMAC("c:"+eventId+":"+pencere)) */
export function donenToken(eventId: number, pencere: number, sir: string = gizliSir()): string {
  return imza(`c:${eventId}:${pencere}`, DONEN_IMZA_UZUNLUK, sir);
}

/** Yalnız içinde bulunulan ve bir önceki 30 sn'lik pencere geçerli (AC-17) */
export function donenGecerli(
  eventId: number,
  token: string | null | undefined,
  simdi: Date = new Date(),
  sir: string = gizliSir(),
): boolean {
  const t = imzaNormalize(String(token ?? "").trim());
  if (t.length !== DONEN_IMZA_UZUNLUK) return false;
  const p = donenPencere(simdi);
  // İki pencere de her zaman hesaplanır (erken çıkış zamanlama farkı sızdırmasın)
  const simdiki = esit(donenToken(eventId, p, sir), t);
  const onceki = esit(donenToken(eventId, p - 1, sir), t);
  return simdiki || onceki;
}

/** Bilet QR içeriği: tamamen büyük harf (alfanümerik mod) — /T/ 301 ile /t/q/'ya iner */
export function biletQrIcerigi(kok: string, token: string): string {
  return `${kok}/T/${token}`.toUpperCase();
}
/** Dönen QR içeriği — /C/ 301 ile /c/q/'ya iner */
export function donenQrIcerigi(kok: string, eventId: number, token: string): string {
  return `${kok}/C/${eventId}/${token}`.toUpperCase();
}

/* ---------------- Katılım listesi (CSV) ---------------- */

/**
 * CSV hücresi: çift tırnakla sarılır, iç tırnak ikilenir. Formül enjeksiyonu: = + - @ (ve
 * sekme/CR) ile başlayan kullanıcı metni Excel/Sheets'te formül sayılır → başına tek tırnak.
 */
export function csvHucre(deger: string | number | null | undefined): string {
  let s = String(deger ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Başlık + satırlar → CSV (CRLF; Excel Türkçe karakterleri tanısın diye UTF-8 BOM) */
export function csvUret(basliklar: string[], satirlar: (string | number | null | undefined)[][]): string {
  return "\uFEFF" + [basliklar, ...satirlar].map((s) => s.map(csvHucre).join(",")).join("\r\n") + "\r\n";
}

/* ---------------- Takvim (.ics, RFC 5545) ---------------- */

const icsKacis = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
const icsAn = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** Satır katlama: 75 oktet (UTF-8) — devam satırı tek boşlukla başlar */
function icsKatla(satir: string): string {
  const parcalar: string[] = [];
  let parca = "";
  let boyut = 0;
  for (const ch of satir) {
    const b = Buffer.byteLength(ch);
    if (boyut + b > (parcalar.length ? 74 : 75)) {
      parcalar.push(parca);
      parca = "";
      boyut = 0;
    }
    parca += ch;
    boyut += b;
  }
  parcalar.push(parca);
  return parcalar.join("\r\n ");
}

export function icsUret(
  e: EtkinlikZamani & { id: number; title: string; description?: string | null; location?: string | null },
  url: string,
  simdi: Date = new Date(),
): string {
  const host = URL.canParse(url) ? new URL(url).host : "yusufdeniz.com";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bilgi Oduldur//Etkinlik//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:etkinlik-${e.id}@${host}`,
    `DTSTAMP:${icsAn(simdi)}`,
    `DTSTART:${icsAn(e.startsAt)}`,
    `DTEND:${icsAn(etkinlikBitis(e))}`,
    `SUMMARY:${icsKacis(e.title)}`,
    ...(e.description ? [`DESCRIPTION:${icsKacis(e.description)}`] : []),
    ...(e.location ? [`LOCATION:${icsKacis(e.location)}`] : []),
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(icsKatla)
    .join("\r\n")
    .concat("\r\n");
}
