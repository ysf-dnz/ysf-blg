/**
 * Kurs daveti (Faz 2, ADR 0001 K2/K3): kod üretimi ve normalizasyonu, karşılama
 * çerezi, atıflı katılım ve bekleyen davet puanları. Davet mantığının TEK kaynağı;
 * /d/[kod], /kurslar/[slug], api/uye/egitim ve api/kart bunu çağırır.
 */
import { createHash, createHmac, randomInt } from "node:crypto";
import type { AstroCookies } from "astro";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import type { Member } from "./member.ts";
import { PUAN } from "./points.ts";
import { bekleyenYaz, puanOlayi } from "./rewards.ts";
import { hesapGencMi } from "./economy.ts";
import { R } from "./routes.ts";

export type InviteCode = typeof schema.inviteCodes.$inferSelect;
export type Kurs = typeof schema.courses.$inferSelect;
export type Katilim = typeof schema.courseEnrollments.$inferSelect;
export type Kisi = typeof schema.users.$inferSelect;

/** Crockford Base32: I, L, O, U yok — elle yazımda O→0, I/L→1 okunur */
export const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const KOD_UZUNLUK = 7;

export function kodUret(): string {
  let s = "";
  for (let i = 0; i < KOD_UZUNLUK; i++) s += CROCKFORD[randomInt(CROCKFORD.length)];
  return s;
}

/** Kullanıcı girdisini (büyük/küçük, O/I/L karışık, tire/boşluk) geçerli koda çevirir; değilse null */
export function kodNormalize(girdi: string): string | null {
  const k = girdi
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/[^0-9A-Z]/g, "");
  if (k.length !== KOD_UZUNLUK) return null;
  for (const c of k) if (!CROCKFORD.includes(c)) return null;
  return k;
}

/**
 * IP/UA takma adı: ham değer saklanmaz; HMAC anahtarı gizli (CRON_SECRET her ortamda var)
 * — sabit tuzlu SHA-256 IPv4 uzayını dakikalar içinde geri çevirtirdi.
 */
export function kisaHash(deger: string): string {
  const anahtar = process.env.CRON_SECRET ?? import.meta.env.CRON_SECRET ?? "ysf-davet-dev";
  return createHmac("sha256", anahtar).update(deger).digest("hex").slice(0, 32);
}

/** Davet süresi: katılımdan bu yana 14 gün geçtiyse davet puanları artık ödenmez (AC-8) */
export function davetSuresiDoldu(katilim: Katilim, simdi: Date = new Date()): boolean {
  return simdi.getTime() - katilim.joinedAt.getTime() > PUAN.inviteExpiryDays * 864e5;
}

/** Instagram/Telegram/Facebook içi tarayıcı: Google OAuth engellenir → e-posta kodu önerilir */
export function uygulamaIciTarayici(ua: string | null | undefined): boolean {
  return !!ua && /Instagram|FBAN|FBAV|FB_IAB|Telegram|TikTok|Twitter|Line\//i.test(ua);
}

/** QR içeriği: tamamen büyük harf (alfanümerik mod, daha az modül) — /D/ 301 ile /d/q/'ya iner */
export function qrIcerigi(kok: string, code: string): string {
  return `${kok}/D/${code}`.toUpperCase();
}

/**
 * /d/q/'ya inen isteğin kanalı. Vercel kenarında rota eşleşmesi harf DUYARSIZ: "/D/[kod]"
 * 301'i paylaşım bağlantısını (/d/kod) da buraya getirir, yol kanalı ayırt etmez. Ayrım kodun
 * yazımından: QR içeriği hep büyük harf (qrIcerigi), bağlantı hep küçük harf üretilir.
 * shortcut: yalnız rakamdan oluşan kod (~%0,03) bağlantıdan gelse de "qr" sayılır; kanal
 * istatistiği kesinlik isterse bağlantıya ayrı yol (/d/l/) açılır.
 */
export function davetKanali(kodHam: string): "qr" | "link" {
  return /[a-z]/.test(kodHam) ? "link" : "qr";
}

/** Kart önbellek sürümü: nota/ada/başlığa bağlı 8 karakter (?v=) — değişince CDN girdisi doğal düşer */
export function kartSurumu(h: DavetHedefi): string {
  return createHash("sha256")
    .update([h.kod.code, h.kod.note ?? "", h.davetEden.name, h.davetEden.avatarUrl ?? "", h.kurs.title, h.kurs.summary ?? "", h.kurs.coverUrl ?? ""].join("|"))
    .digest("hex")
    .slice(0, 8);
}

export type DavetHedefi = { kod: InviteCode; davetEden: Kisi; kurs: Kurs };

/** Kodu çöz: aktif kod + yayındaki kurs + davet eden. Değilse null. */
export async function davetHedefi(kodHam: string): Promise<DavetHedefi | null> {
  const code = kodNormalize(kodHam);
  if (!code) return null;
  const kod = await db.query.inviteCodes.findFirst({
    where: and(eq(schema.inviteCodes.code, code), isNull(schema.inviteCodes.revokedAt)),
  });
  if (!kod || kod.targetType !== "course") return null;
  const [kurs, davetEden] = await Promise.all([
    db.query.courses.findFirst({ where: eq(schema.courses.id, kod.targetId) }),
    db.query.users.findFirst({ where: eq(schema.users.id, kod.inviterId) }),
  ]);
  if (!kurs || kurs.status !== "published" || !davetEden) return null;
  return { kod, davetEden, kurs };
}

/** (davet eden, kurs) için aktif kodu getirir, yoksa üretir (unique çakışmasında yeniden dener) */
export async function davetKoduUret(inviterId: number, courseId: number): Promise<InviteCode> {
  const where = and(
    eq(schema.inviteCodes.inviterId, inviterId),
    eq(schema.inviteCodes.targetType, "course"),
    eq(schema.inviteCodes.targetId, courseId),
    isNull(schema.inviteCodes.revokedAt),
  );
  const mevcut = await db.query.inviteCodes.findFirst({ where });
  if (mevcut) return mevcut;
  for (let i = 0; i < 3; i++) {
    const [row] = await db
      .insert(schema.inviteCodes)
      .values({ code: kodUret(), inviterId, targetType: "course", targetId: courseId })
      .onConflictDoNothing()
      .returning();
    if (row) return row;
  }
  // Paralel istek aynı anda üretti ya da kod çakıştı: artık var olmalı
  return (await db.query.inviteCodes.findFirst({ where }))!;
}

/* ---------------- Karşılama çerezi ---------------- */

export const DAVET_CEREZ = "ysf_davet";
const CEREZ_GUN = 30;

/** Değer `course:{courseId}:{codeId}` — davet eden koddan türer, ad/handle taşınmaz */
export function davetCereziKur(cookies: AstroCookies, h: DavetHedefi, secure: boolean) {
  cookies.set(DAVET_CEREZ, `course:${h.kurs.id}:${h.kod.id}`, {
    path: "/",
    maxAge: 60 * 60 * 24 * CEREZ_GUN,
    sameSite: "lax",
    httpOnly: true,
    secure,
  });
}

/** Çerez bu kursa aitse kod id'sini döner (hedef eşleşmiyorsa atıf yok — AC-9) */
export function davetCereziOku(cookies: AstroCookies | undefined, courseId: number): number | null {
  const m = cookies?.get(DAVET_CEREZ)?.value?.match(/^course:(\d+):(\d+)$/);
  return m && Number(m[1]) === courseId ? Number(m[2]) : null;
}

export function davetCereziSil(cookies: AstroCookies | undefined) {
  cookies?.delete(DAVET_CEREZ, { path: "/" });
}

/* ---------------- Atıflı katılım ve davet puanları ---------------- */

async function bildir(userId: number, body: string, href: string) {
  await db.insert(schema.notifications).values({ userId, kind: "course", body, href });
}

/**
 * Kursa katıl. Yeni katılımsa ve karşılama çerezi BU kursa ait geçerli bir kodu
 * taşıyorsa (davet eden ≠ üye) atıf `invite_code_id`'ye yazılır ve iki bekleyen
 * davet puanı açılır (14 gün). Tekillik `course_enrollments(user, course)` ile:
 * "ilk geçerli davet kazanır". Üretici kendi kursuna katılmaz.
 */
export async function kursaKatil(
  member: Member,
  kurs: Kurs,
  cookies?: AstroCookies,
): Promise<{ yeni: boolean; davetli: boolean; davetEden?: Kisi }> {
  if (kurs.createdBy === member.id || kurs.status !== "published")
    return { yeni: false, davetli: false };
  const codeId = davetCereziOku(cookies, kurs.id);
  let kod = codeId
    ? await db.query.inviteCodes.findFirst({
        where: and(
          eq(schema.inviteCodes.id, codeId),
          isNull(schema.inviteCodes.revokedAt),
          eq(schema.inviteCodes.targetType, "course"),
          eq(schema.inviteCodes.targetId, kurs.id),
        ),
      })
    : undefined;
  if (kod && kod.inviterId === member.id) kod = undefined; // kendi kodu: katılır, davet puanı yok (AC-7)

  const [ins] = await db
    .insert(schema.courseEnrollments)
    .values({ userId: member.id, courseId: kurs.id, inviteCodeId: kod?.id ?? null })
    .onConflictDoNothing()
    .returning();
  if (codeId) davetCereziSil(cookies);
  if (!ins) return { yeni: false, davetli: false };
  if (!kod) return { yeni: true, davetli: false };

  const sonGun = new Date(Date.now() + PUAN.inviteExpiryDays * 864e5);
  const davetEden = await db.query.users.findFirst({ where: eq(schema.users.id, kod.inviterId) });
  await bekleyenYaz({
    userId: member.id,
    delta: PUAN.inviteWelcome,
    reason: "course_invite_welcome",
    refId: `course:${kurs.id}`,
    note: `"${kurs.title}" kursunda ilk öğeyi bitirince (${davetEden?.name ?? "davet"})`,
    expiresAt: sonGun,
  });
  await bekleyenYaz({
    userId: kod.inviterId,
    delta: PUAN.inviteActivated,
    reason: "course_invite_activated",
    refId: `course:${kurs.id}:u:${member.id}`,
    note: `${member.name} "${kurs.title}" kursunda ilk öğeyi bitirince`,
    expiresAt: sonGun,
  });
  await bildir(
    kod.inviterId,
    `${member.name} davetinle "${kurs.title}" kursuna katıldı 👋 İlk öğeyi bitirince +${PUAN.inviteActivated}.`,
    R.kurs(kurs.slug),
  );
  return { yeni: true, davetli: true, davetEden: davetEden ?? undefined };
}

/** Kurs aktivasyonunda (ilk öğe) davet puanları kesinleşir — genç hesap → matures_at (ADR K2) */
export async function davetAktivasyonu(katilim: Katilim, kurs: Kurs, davetli: Member) {
  if (!katilim.inviteCodeId || davetSuresiDoldu(katilim)) return;
  const kod = await db.query.inviteCodes.findFirst({
    where: eq(schema.inviteCodes.id, katilim.inviteCodeId),
  });
  if (!kod || kod.inviterId === davetli.id) return;
  await puanOlayi({
    userId: davetli.id,
    delta: PUAN.inviteWelcome,
    reason: "course_invite_welcome",
    refId: `course:${kurs.id}`,
    kaynakOlusturulma: davetli.createdAt,
    note: `"${kurs.title}" — davetle katılım karşılaması`,
  });
  const n = await puanOlayi({
    userId: kod.inviterId,
    delta: PUAN.inviteActivated,
    reason: "course_invite_activated",
    refId: `course:${kurs.id}:u:${davetli.id}`,
    kaynakOlusturulma: davetli.createdAt,
    note: `${davetli.name} "${kurs.title}" kursunda aktive oldu`,
  });
  await bildir(
    kod.inviterId,
    n > 0
      ? `${davetli.name} "${kurs.title}" kursunda aktive oldu ⚡ +${n} puan${n < PUAN.inviteActivated ? " (haftalık davet tavanına kırpıldı)" : ""}`
      : hesapGencMi(davetli.createdAt)
        ? `${davetli.name} "${kurs.title}" kursunda aktive oldu ⚡ Puan hesap 24 saatlik olunca kesinleşir.`
        : `${davetli.name} "${kurs.title}" kursunda aktive oldu ⚡ Haftalık davet puanı tavanın dolu; puan yazılmadı.`,
    R.kurs(kurs.slug),
  );
}

/** Kurs bitirmede davet edene +10 (asgari süre geçtiyse çağrılır) */
export async function davetBitirme(katilim: Katilim, kurs: Kurs, davetli: Member) {
  if (!katilim.inviteCodeId || davetSuresiDoldu(katilim)) return;
  const kod = await db.query.inviteCodes.findFirst({
    where: eq(schema.inviteCodes.id, katilim.inviteCodeId),
  });
  if (!kod || kod.inviterId === davetli.id) return;
  // Önce bekleyen satır: tavana kırpılırsa pano "kırpıldı" gerekçesini gösterebilsin
  await bekleyenYaz({
    userId: kod.inviterId,
    delta: PUAN.inviteCompleted,
    reason: "course_invite_completed",
    refId: `course:${kurs.id}:u:${davetli.id}`,
    note: `${davetli.name} "${kurs.title}" kursunu bitirdi`,
  });
  await puanOlayi({
    userId: kod.inviterId,
    delta: PUAN.inviteCompleted,
    reason: "course_invite_completed",
    refId: `course:${kurs.id}:u:${davetli.id}`,
    kaynakOlusturulma: davetli.createdAt,
    note: `${davetli.name} "${kurs.title}" kursunu bitirdi`,
  });
}
