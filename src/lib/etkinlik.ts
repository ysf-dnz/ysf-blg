/**
 * Etkinlik akışı (Faz 3, ADR 0001 K1.4/K2/K6): slug, görünürlük, görevliler ve
 * kapasiteli kayıt (RSVP). Saf kurallar (zaman pencereleri, imzalar) etkinlik-kural.ts'te.
 */
import type { AstroCookies } from "astro";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { davetCereziOku, davetCereziSil } from "./davet.ts";
import { etkinlikBitis, etkinlikGorunurMu, kayitAcikMi, VARSAYILAN_SURE_SAAT } from "./etkinlik-kural.ts";
import { slugifyTitle } from "./markdown.ts";
import type { Member } from "./member.ts";
import { PUAN } from "./points.ts";
import { bekleyenYaz, satirlar, spendPoints } from "./rewards.ts";
import { R } from "./routes.ts";

export type Etkinlik = typeof schema.events.$inferSelect;
export type Rsvp = typeof schema.eventRsvps.$inferSelect;
export type Kulup = typeof schema.clubs.$inferSelect;
export type GorevliRol = "host" | "scanner";

/**
 * Etkinlik başına danışma kilidi sınıfı (iki anahtarlı biçim → awardPoints'in tek
 * anahtarlı user_id kilidiyle aynı uzayda değil).
 */
const KILIT_ETKINLIK = 31;

export function slugUret(title: string): string {
  const taban = slugifyTitle(title);
  // slugifyTitle boş sonuçta "yazi" döner (üye yazısı varsayılanı)
  return `${taban === "yazi" ? "etkinlik" : taban}-${crypto.randomUUID().slice(0, 6)}`;
}

/**
 * Slug'sız etkinliğe (şema push'u ile Faz 3 deploy'u arasında eski kodun açtığı)
 * ilk görüntülemede slug atar — tek SQL, yalnız hâlâ NULL ise (C ilkeli).
 */
export async function slugGaranti(e: Pick<Etkinlik, "id" | "slug" | "title">): Promise<string> {
  if (e.slug) return e.slug;
  const [row] = await db
    .update(schema.events)
    .set({ slug: slugUret(e.title) })
    .where(and(eq(schema.events.id, e.id), isNull(schema.events.slug)))
    .returning({ slug: schema.events.slug });
  if (row?.slug) return row.slug;
  const yeni = await db.query.events.findFirst({
    where: eq(schema.events.id, e.id),
    columns: { slug: true },
  });
  return yeni?.slug ?? String(e.id);
}

/** /etkinlik/[slug] parametresi: slug; yalnız rakamsa id (slug'sız eski kayıt için) */
export async function etkinlikBul(param: string): Promise<Etkinlik | undefined> {
  const e = await db.query.events.findFirst({ where: eq(schema.events.slug, param) });
  if (e || !/^\d{1,9}$/.test(param)) return e;
  return db.query.events.findFirst({ where: eq(schema.events.id, Number(param)) });
}

/* ---------------- Görevliler ---------------- */

/** Düzenleyenler: event_staff host'ları + etkinliği açan (eski kayıtta staff satırı olmayabilir) */
export async function hostIdleri(e: Pick<Etkinlik, "id" | "createdBy">): Promise<number[]> {
  const rows = await db.query.eventStaff.findMany({
    where: and(eq(schema.eventStaff.eventId, e.id), eq(schema.eventStaff.role, "host")),
    columns: { userId: true },
  });
  return [...new Set([...(e.createdBy ? [e.createdBy] : []), ...rows.map((r) => r.userId)])];
}

/** Üyenin etkinlikteki görevi. Admin yönetebilir ama host SAYILMAZ (düzenleyen payı almaz). */
export async function gorevliRol(
  e: Pick<Etkinlik, "id" | "createdBy">,
  userId: number,
): Promise<GorevliRol | null> {
  if (e.createdBy === userId) return "host";
  const row = await db.query.eventStaff.findFirst({
    where: and(eq(schema.eventStaff.eventId, e.id), eq(schema.eventStaff.userId, userId)),
  });
  return (row?.role as GorevliRol | undefined) ?? null;
}

/** Etkinliği yönetir (görevli ekler, CSV indirir): host ya da admin */
export async function yonetebilirMi(e: Pick<Etkinlik, "id" | "createdBy">, member: Member | null): Promise<boolean> {
  if (!member) return false;
  return member.role === "admin" || (await gorevliRol(e, member.id)) === "host";
}

/** Bilet okutur / giriş ekranını açar: host, scanner ya da admin */
export async function okutabilirMi(e: Pick<Etkinlik, "id" | "createdBy">, member: Member | null): Promise<boolean> {
  if (!member) return false;
  return member.role === "admin" || (await gorevliRol(e, member.id)) !== null;
}

/**
 * Görevli ekle. Ortak düzenleyen sınırı (açan + 3) INSERT'in WHERE'inde (A ilkeli).
 * @returns eklendiyse true; zaten görevliyse ya da host sınırı doluysa false
 */
export async function gorevliEkle(
  e: Pick<Etkinlik, "id" | "createdBy">,
  userId: number,
  rol: GorevliRol,
): Promise<boolean> {
  const sonuc = await db.execute(sql`
    insert into event_staff (event_id, user_id, role)
    select ${e.id}, ${userId}, ${rol}
    where ${rol} <> 'host' or (
      select count(*) from event_staff
      where event_id = ${e.id} and role = 'host' and user_id <> ${e.createdBy ?? 0}
    ) < ${PUAN.eventMaxCoHosts}
    on conflict do nothing
    returning id
  `);
  return satirlar(sonuc).length > 0;
}

/** Görevliyi çıkar (etkinliği açan çıkarılamaz) */
export async function gorevliSil(e: Pick<Etkinlik, "id" | "createdBy">, userId: number): Promise<void> {
  if (userId === e.createdBy) return;
  await db
    .delete(schema.eventStaff)
    .where(and(eq(schema.eventStaff.eventId, e.id), eq(schema.eventStaff.userId, userId)));
}

/* ---------------- Kayıt (RSVP) ---------------- */

export type KayitDurumu = "yeni" | "zaten" | "dolu" | "kapali";
export type KayitSonucu = { durum: KayitDurumu; rsvp?: Rsvp; oncelikli: boolean; davetli: boolean };

/**
 * Etkinliğe kayıt. Kapasite ve kayıt kapanışı INSERT'in WHERE'inde; aynı etkinliğe
 * paralel kayıtlar danışma kilidiyle sıraya girer (tek HTTP transaction'ı, ADR K1.5
 * deseni): kilitsiz tek SQL'de N eşzamanlı istek aynı sayımı görüp kapasiteyi N kez
 * aşabiliyordu. ⭐ öncelikli koltuk yalnız YENİ kayıtta ve kesinti gerçekleştiyse.
 *
 * Atıf (F3-03): karşılama çerezi BU etkinliğe ait geçerli bir kodu taşıyorsa (davet eden ≠
 * üye) kod `invite_code_id`'ye yazılır — tekillik event_rsvps(event, user): "ilk geçerli
 * davet kazanır". Davet edene `event_invite_attended` BEKLEYEN açılır (bitişte düşer, AC-19);
 * davet eden düzenleyense açılmaz (AC-20: host'lar event_hosted alır, davet puanı almaz).
 */
export async function kayitOl(
  member: Member,
  e: Etkinlik,
  opts: { oncelik?: boolean; cookies?: AstroCookies } = {},
): Promise<KayitSonucu> {
  const simdi = new Date();
  const codeId = davetCereziOku(opts.cookies, e.id, "event");
  let kod = codeId
    ? await db.query.inviteCodes.findFirst({
        where: and(
          eq(schema.inviteCodes.id, codeId),
          isNull(schema.inviteCodes.revokedAt),
          eq(schema.inviteCodes.targetType, "event"),
          eq(schema.inviteCodes.targetId, e.id),
        ),
      })
    : undefined;
  if (kod && kod.inviterId === member.id) kod = undefined; // kendi kodu: kaydolur, atıf yok
  const [, sonuc] = await db.batch([
    db.execute(sql`select pg_advisory_xact_lock(${KILIT_ETKINLIK}::int, ${e.id}::int)`),
    db.execute(sql`
      insert into event_rsvps (event_id, user_id, invite_code_id)
      select e.id, ${member.id}, ${kod?.id ?? null}::int
      from events e
      where e.id = ${e.id}
        and (e.capacity is null
             or (select count(*) from event_rsvps r where r.event_id = e.id) < e.capacity)
        and coalesce(e.rsvp_closes_at, e.ends_at, e.starts_at + ${VARSAYILAN_SURE_SAAT}::int * interval '1 hour')
            > ${simdi.toISOString()}::timestamp
      on conflict do nothing
      returning id
    `),
  ]);
  const yeniId = Number(satirlar<{ id: number }>(sonuc)[0]?.id ?? 0);
  const rsvp = await db.query.eventRsvps.findFirst({
    where: and(eq(schema.eventRsvps.eventId, e.id), eq(schema.eventRsvps.userId, member.id)),
  });
  // Çerez yalnız BU hedefe aitse silinir (başka hedefin daveti yaşamaya devam eder)
  if (codeId) davetCereziSil(opts.cookies);
  if (!yeniId) {
    if (rsvp) return { durum: "zaten", rsvp, oncelikli: rsvp.priority, davetli: false };
    return { durum: kayitAcikMi(e, simdi) ? "dolu" : "kapali", oncelikli: false, davetli: false };
  }

  if (kod && !(await hostIdleri(e)).includes(kod.inviterId)) {
    await bekleyenYaz({
      userId: kod.inviterId,
      delta: PUAN.eventInviteAttended,
      reason: "event_invite_attended",
      refId: `event:${e.id}:u:${member.id}`,
      note: `${member.name} "${e.title}" etkinliğinde giriş yapınca`,
      expiresAt: etkinlikBitis(e),
    });
    await db.insert(schema.notifications).values({
      userId: kod.inviterId,
      kind: "event",
      body: `${member.name} davetinle "${e.title}" etkinliğine kaydoldu 👋 Girişi doğrulanınca +${PUAN.eventInviteAttended}.`,
      href: R.etkinlik(e.slug ?? String(e.id)),
    });
  }

  // Öncelikli koltuk: ÖNCE atomik kesinti, koltuk ancak kesinti gerçekleştiyse ⭐ olur
  let oncelikli = false;
  if (opts.oncelik) {
    const kesildi = await spendPoints({
      userId: member.id,
      cost: PUAN.prioritySeatCost,
      reason: "spend_priority",
      refId: String(e.id),
    });
    if (kesildi) {
      await db.update(schema.eventRsvps).set({ priority: true }).where(eq(schema.eventRsvps.id, yeniId));
      oncelikli = true;
    }
  }
  return { durum: "yeni", rsvp, oncelikli, davetli: !!kod };
}

/** Etkinlik başına kayıt / ⭐ / giriş sayıları — tek gruplu sorgu */
export async function kayitSayilari(
  eventIds: number[],
): Promise<Map<number, { kayit: number; oncelikli: number; giris: number }>> {
  if (eventIds.length === 0) return new Map();
  const rows = await db
    .select({
      eventId: schema.eventRsvps.eventId,
      kayit: sql<number>`count(*)`,
      oncelikli: sql<number>`count(*) filter (where ${schema.eventRsvps.priority})`,
      giris: sql<number>`count(${schema.eventRsvps.checkedInAt})`,
    })
    .from(schema.eventRsvps)
    .where(inArray(schema.eventRsvps.eventId, eventIds))
    .groupBy(schema.eventRsvps.eventId);
  return new Map(
    rows.map((r) => [
      r.eventId,
      { kayit: Number(r.kayit), oncelikli: Number(r.oncelikli), giris: Number(r.giris) },
    ]),
  );
}

export { etkinlikBitis, etkinlikGorunurMu };
