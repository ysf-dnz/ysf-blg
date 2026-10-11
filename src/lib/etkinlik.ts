/**
 * Etkinlik akışı (Faz 3, ADR 0001 K1.4/K2/K6): slug, görünürlük, görevliler, kapasiteli
 * kayıt (RSVP), giriş doğrulaması ve ödül zinciri, etkinlik sonrası (düzenleyen payı,
 * değerlendirme). Saf kurallar (zaman pencereleri, imzalar) etkinlik-kural.ts'te.
 */
import type { AstroCookies } from "astro";
import { and, eq, gte, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { birKezCalistir } from "./cron.ts";
import { davetCereziOku, davetCereziSil } from "./davet.ts";
import { hostPaylari, hostToplami, iyiDegerlendirildiMi } from "./economy.ts";
import {
  biletCoz,
  degerlendirmeAcikMi,
  donenGecerli,
  etkinlikBitis,
  etkinlikGorunurMu,
  girisPenceresinde,
  kayitAcikMi,
  trSaat,
  VARSAYILAN_SURE_SAAT,
} from "./etkinlik-kural.ts";
import { slugifyTitle } from "./markdown.ts";
import type { Member } from "./member.ts";
import { PUAN } from "./points.ts";
import { awardPoints, bekleyenYaz, puanOlayi, satirlar, spendPoints } from "./rewards.ts";
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

/* ---------------- Giriş doğrulaması (ADR K1.4) ---------------- */

export type GirisYontemi = "ticket" | "rotating" | "manual";
export type GirisSonucu =
  /** Girişi BU istek yazdı; `puan` katılımcıya şimdi yazılan toplam */
  | { durum: "geldi"; rsvp: Rsvp; puan: number }
  /** Daha önce giriş yapılmış ("Zaten geldi (HH:MM)") */
  | { durum: "zaten"; rsvp: Rsvp }
  /** Kayıtlı ama giriş penceresi dışında (kapı açılışından önce / bitişten sonra) */
  | { durum: "pencere" }
  /** Bu etkinliğe kaydı yok */
  | { durum: "yok" };

/** Görevli başına dakikada okutma sınırı (PRD §4.2) */
export const GOREVLI_DAKIKADA = 120;

/**
 * Girişte yazılan puanlar — her adım idempotent (awardPoints idem index, puanOlayi).
 * Sıra ADR K1.4: katılımcıya event_attended (refId ÖNEKSİZ String(eventId): eski RSVP
 * ödülünü almış üye ikinci +10'u alamaz) → davetliyse event_invite_welcome (anında) →
 * davet edenin bekleyeni kesinleşir (davetlinin hesabı 24 saatten gençse matures_at).
 * Kendine puan yok: düzenleyen kendi etkinliğinde giriş puanı almaz; düzenleyen davet
 * puanı da almaz (AC-20). event_hosted burada YAZILMAZ (bitiş + 48 s cron'u, canlı sayım).
 * @returns katılımcıya bu çağrıda yazılan puan
 */
async function girisOdulleri(e: Etkinlik, rsvp: Rsvp): Promise<number> {
  const hostlar = await hostIdleri(e);
  if (hostlar.includes(rsvp.userId)) return 0;
  let puan = await awardPoints({
    userId: rsvp.userId,
    delta: PUAN.eventAttended,
    reason: "event_attended",
    refId: String(e.id),
  });
  if (!rsvp.inviteCodeId) return puan;
  const kod = await db.query.inviteCodes.findFirst({
    where: eq(schema.inviteCodes.id, rsvp.inviteCodeId),
  });
  if (!kod || kod.targetType !== "event" || kod.targetId !== e.id || kod.inviterId === rsvp.userId) return puan;
  puan += await awardPoints({
    userId: rsvp.userId,
    delta: PUAN.eventInviteWelcome,
    reason: "event_invite_welcome",
    refId: `event:${e.id}`,
  });
  if (hostlar.includes(kod.inviterId)) return puan;
  const davetli = await db.query.users.findFirst({ where: eq(schema.users.id, rsvp.userId) });
  if (!davetli) return puan;
  const n = await puanOlayi({
    userId: kod.inviterId,
    delta: PUAN.eventInviteAttended,
    reason: "event_invite_attended",
    refId: `event:${e.id}:u:${rsvp.userId}`,
    kaynakOlusturulma: davetli.createdAt,
    note: `${davetli.name} "${e.title}" etkinliğine geldi`,
  });
  // Yalnız gerçekten yazıldıysa bildir (tekrar okutma / onarım koşumu bildirim yağdırmasın)
  if (n > 0) {
    await db.insert(schema.notifications).values({
      userId: kod.inviterId,
      kind: "event",
      body: `${davetli.name} davetinle "${e.title}" etkinliğine geldi 🎟️ +${n} puan${n < PUAN.eventInviteAttended ? " (haftalık davet tavanına kırpıldı)" : ""}`,
      href: R.etkinlik(e.slug ?? String(e.id)),
    });
  }
  return puan;
}

/**
 * Giriş doğrulaması — tek istek, idempotent (ADR K1.4, C ilkeli):
 * `UPDATE … WHERE checked_in_at IS NULL RETURNING` satır döndürdüyse girişi BU istek yaptı.
 * Çevrimdışı kuyruğun tekrar gönderdiği istek boş döner → "zaten" (AC-16, AC-18).
 * Giriş yalnız pencerede (kapı açılışı → bitiş) yazılır: davet edenin bekleyeni bitişte
 * düşer ve puanOlayi düşmüş satıra bakmadan ödediği için bitişten sonra giriş kabul edilmez.
 * Ödül zinciri "zaten" durumunda da koşar: UPDATE yazılıp ödüller yazılamadan ölen istek
 * sonraki okutmada kendini onarır (adımlar idempotent; yeni puan üretmez).
 */
export async function girisYap(
  e: Etkinlik,
  userId: number,
  yontem: GirisYontemi,
  gorevliId: number,
): Promise<GirisSonucu> {
  const simdi = new Date();
  const kayit = and(eq(schema.eventRsvps.eventId, e.id), eq(schema.eventRsvps.userId, userId));
  const [yazilan] = girisPenceresinde(e, simdi)
    ? await db
        .update(schema.eventRsvps)
        .set({ checkedInAt: simdi, checkinMethod: yontem, checkedInBy: gorevliId })
        .where(and(kayit, isNull(schema.eventRsvps.checkedInAt)))
        .returning()
    : [];
  const rsvp = yazilan ?? (await db.query.eventRsvps.findFirst({ where: kayit }));
  if (!rsvp) return { durum: "yok" };
  if (!rsvp.checkedInAt) return { durum: "pencere" };
  const puan = await girisOdulleri(e, rsvp);
  return yazilan ? { durum: "geldi", rsvp, puan } : { durum: "zaten", rsvp };
}

/** Görevli son 60 sn'de sınırı doldurdu mu? (fren; okutma sayımı checked_in_by üzerinden) */
export async function gorevliHizAsildi(gorevliId: number): Promise<boolean> {
  const [r] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.eventRsvps)
    .where(
      and(
        eq(schema.eventRsvps.checkedInBy, gorevliId),
        gte(schema.eventRsvps.checkedInAt, new Date(Date.now() - 60_000)),
      ),
    );
  return Number(r?.n ?? 0) >= GOREVLI_DAKIKADA;
}

export type BiletSonucu =
  | { durum: "gecersiz" | "yetkisiz" | "hiz" | "pencere" }
  | { durum: "baska"; etkinlik: string }
  | {
      durum: "geldi" | "zaten";
      ad: string;
      avatarUrl: string | null;
      /** Giriş saati (TR) — "Zaten geldi (09:41)" */
      saat: string;
      etkinlik: string;
      oncelikli: boolean;
    };

/**
 * Görevli bir bileti okuttu. İmza doğrulanır (kolonsuz HMAC), bilet RSVP'yi bulur;
 * okutan o etkinliğin görevlisi değilse hiçbir bilgi dönmez. `beklenenEtkinlik`
 * verilirse başka etkinliğin bileti giriş YAPILMADAN reddedilir.
 */
export async function biletGiris(
  token: string,
  gorevli: Member,
  beklenenEtkinlik?: number,
): Promise<BiletSonucu> {
  const rsvpId = biletCoz(token);
  const rsvp = rsvpId
    ? await db.query.eventRsvps.findFirst({ where: eq(schema.eventRsvps.id, rsvpId) })
    : undefined;
  const e = rsvp
    ? await db.query.events.findFirst({ where: eq(schema.events.id, rsvp.eventId) })
    : undefined;
  if (!rsvp || !e) return { durum: "gecersiz" };
  if (!(await okutabilirMi(e, gorevli))) return { durum: "yetkisiz" };
  if (beklenenEtkinlik && beklenenEtkinlik !== e.id) return { durum: "baska", etkinlik: e.title };
  if (await gorevliHizAsildi(gorevli.id)) return { durum: "hiz" };
  const sonuc = await girisYap(e, rsvp.userId, "ticket", gorevli.id);
  if (sonuc.durum === "pencere" || sonuc.durum === "yok") return { durum: "pencere" };
  const kisi = await db.query.users.findFirst({ where: eq(schema.users.id, rsvp.userId) });
  return {
    durum: sonuc.durum,
    ad: kisi?.name ?? "Üye",
    avatarUrl: kisi?.avatarUrl ?? null,
    saat: trSaat(sonuc.rsvp.checkedInAt!),
    etkinlik: e.title,
    oncelikli: sonuc.rsvp.priority,
  };
}

export type DonenSonucu =
  /** QR'ın süresi dolmuş (yalnız içindeki ve bir önceki 30 sn'lik pencere geçerli — AC-17) */
  | { durum: "sure" | "pencere" | "dolu" | "kapali" }
  | { durum: "geldi"; puan: number }
  | { durum: "zaten"; saat: string };

/**
 * Dönen QR ile kendi girişini doğrula (F3-05). Katılımcı girişteki ekrandan okutur:
 * token geçerliyse ve giriş penceresindeyse kayıtsız üye ÖNCE kaydedilir (kontenjan ve
 * kayıt kapanışı kayitOl'un SQL'inde; davet çerezi varsa atıf da orada), sonra giriş
 * F3-04 ile AYNI K1.4 zinciriyle yazılır (checkin_method='rotating').
 */
export async function donenGiris(
  e: Etkinlik,
  member: Member,
  token: string,
  cookies?: AstroCookies,
): Promise<DonenSonucu> {
  if (!donenGecerli(e.id, token)) return { durum: "sure" };
  if (!girisPenceresinde(e)) return { durum: "pencere" };
  const k = await kayitOl(member, e, { cookies });
  if (k.durum === "dolu" || k.durum === "kapali") return { durum: k.durum };
  const g = await girisYap(e, member.id, "rotating", member.id);
  if (g.durum === "geldi") return { durum: "geldi", puan: g.puan };
  if (g.durum === "zaten") return { durum: "zaten", saat: trSaat(g.rsvp.checkedInAt!) };
  return { durum: "pencere" };
}

/* ---------------- Etkinlik sonrası: düzenleyen payı, değerlendirme (F3-06) ---------------- */

/** Doğrulanmış katılımcı sayısı — düzenleyenlerin kendi girişi sayılmaz (kendine puan yok) */
async function girisSayisi(eventId: number, hostlar: number[]): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.eventRsvps)
    .where(
      and(
        eq(schema.eventRsvps.eventId, eventId),
        isNotNull(schema.eventRsvps.checkedInAt),
        hostlar.length ? notInArray(schema.eventRsvps.userId, hostlar) : undefined,
      ),
    );
  return Number(r?.n ?? 0);
}

/**
 * Düzenleyen payları — CANLI sayımdan (ADR K2: event_hosted için bekleyen satır YOK;
 * "host sonradan eklendi, pay değişti" sorunu böylece yok). Pano tahmini ve cron dağıtımı
 * aynı hesabı kullanır.
 */
export async function hostPayHesabi(
  e: Pick<Etkinlik, "id" | "createdBy">,
): Promise<{ katilimci: number; toplam: number; paylar: Map<number, number> }> {
  const hostlar = await hostIdleri(e);
  const katilimci = await girisSayisi(e.id, hostlar);
  const toplam = hostToplami(katilimci);
  return { katilimci, toplam, paylar: hostPaylari(toplam, hostlar, e.createdBy) };
}

/** event_hosted dağıtımı: min(giriş, 100) × 5 düzenleyenler arasında (idempotent, refId event:{id}) */
export async function hostOdulleriniDagit(e: Etkinlik): Promise<{ katilimci: number; yazilan: number }> {
  const { katilimci, paylar } = await hostPayHesabi(e);
  let yazilan = 0;
  for (const [userId, delta] of paylar) {
    const n = await awardPoints({ userId, delta, reason: "event_hosted", refId: `event:${e.id}` });
    yazilan += n;
    if (n > 0)
      await db.insert(schema.notifications).values({
        userId,
        kind: "event",
        body: `"${e.title}" etkinliğine ${katilimci} kişi geldi 🎤 +${n} düzenleyen puanı.`,
        href: R.etkinlik(e.slug ?? String(e.id)),
      });
  }
  return { katilimci, yazilan };
}

/** event_well_rated: ort ≥ 4,0 ve ≥ 10 değerlendirme → +50 düzenleyenler arasında (idempotent) */
export async function iyiDegerlendirmeOdulu(e: Etkinlik): Promise<{ ortalama: number; adet: number; yazilan: number }> {
  const [r] = await db
    .select({ ort: sql<number>`coalesce(avg(${schema.ratings.stars}), 0)`, n: sql<number>`count(*)` })
    .from(schema.ratings)
    .where(eq(schema.ratings.eventId, e.id));
  const ortalama = Number(r?.ort ?? 0);
  const adet = Number(r?.n ?? 0);
  let yazilan = 0;
  if (iyiDegerlendirildiMi(ortalama, adet)) {
    for (const [userId, delta] of hostPaylari(PUAN.eventWellRated, await hostIdleri(e), e.createdBy)) {
      const n = await awardPoints({ userId, delta, reason: "event_well_rated", refId: `event:${e.id}` });
      yazilan += n;
      if (n > 0)
        await db.insert(schema.notifications).values({
          userId,
          kind: "event",
          body: `"${e.title}" çok beğenildi ⭐ ${ortalama.toFixed(1)} (${adet} değerlendirme) +${n} puan.`,
          href: R.etkinlik(e.slug ?? String(e.id)),
        });
    }
  }
  return { ortalama, adet, yazilan };
}

const GUN = 864e5;
/** Cron atlanırsa telafi için geriye bakış (gün) */
const GERIYE_BAKIS_GUN = 30;

/**
 * Günlük cron işi. Bitişinden 48 saat geçen etkinlikte düzenleyen payı, 7 gün geçende iyi
 * değerlendirme ödülü — etkinlik başına tek-atış kilit (cron_runs). Cron günde bir koştuğu
 * için koşul "≤ now − 48 s"tir (eşitlik penceresi değil). Tek bozuk etkinlik diğerlerini
 * durdurmaz: hata sayılır, kilit geri verilir, ertesi gün yeniden denenir.
 * `yalniz`: yalnız bu etkinlikler (testler canlı DB'deki başka etkinliklere dokunmasın).
 */
export async function etkinlikSonrasiIsle(
  opts: { simdi?: Date; yalniz?: number[] } = {},
): Promise<{ host: number; iyiDegerlendirme: number; hata: number }> {
  const simdi = opts.simdi ?? new Date();
  const once = (ms: number) => new Date(simdi.getTime() - ms).toISOString();
  const bitis = sql`coalesce(${schema.events.endsAt}, ${schema.events.startsAt} + ${VARSAYILAN_SURE_SAAT}::int * interval '1 hour')`;
  const adaylar = await db
    .select()
    .from(schema.events)
    .where(
      and(
        sql`${bitis} <= ${once(PUAN.eventHostedDelayHours * 3600e3)}::timestamp`,
        sql`${bitis} >= ${once((GERIYE_BAKIS_GUN + PUAN.eventRatingDays) * GUN)}::timestamp`,
        opts.yalniz ? inArray(schema.events.id, opts.yalniz.length ? opts.yalniz : [0]) : undefined,
      ),
    );
  if (adaylar.length === 0) return { host: 0, iyiDegerlendirme: 0, hata: 0 };
  // Daha önce koşanlar tek sorguda elenir (her gün etkinlik başına boş kilit denemesi olmasın)
  const kosmus = new Set(
    (
      await db.query.cronRuns.findMany({
        where: and(
          inArray(schema.cronRuns.job, ["etkinlik-host", "etkinlik-degerlendirme"]),
          inArray(schema.cronRuns.periodKey, adaylar.map((e) => String(e.id))),
        ),
      })
    ).map((r) => `${r.job}:${r.periodKey}`),
  );
  const rapor = { host: 0, iyiDegerlendirme: 0, hata: 0 };
  for (const e of adaylar) {
    try {
      if (!kosmus.has(`etkinlik-host:${e.id}`)) {
        const h = await birKezCalistir("etkinlik-host", String(e.id), () => hostOdulleriniDagit(e));
        if (h !== undefined) rapor.host++;
      }
      const degerlendirmeBitti = etkinlikBitis(e).getTime() <= simdi.getTime() - PUAN.eventRatingDays * GUN;
      if (degerlendirmeBitti && !kosmus.has(`etkinlik-degerlendirme:${e.id}`)) {
        const d = await birKezCalistir("etkinlik-degerlendirme", String(e.id), () => iyiDegerlendirmeOdulu(e));
        if (d !== undefined) rapor.iyiDegerlendirme++;
      }
    } catch {
      rapor.hata++;
    }
  }
  return rapor;
}

export type DegerlendirmeSonucu = "tamam" | "giris-yok" | "pencere" | "gecersiz";

/**
 * Etkinliği değerlendir (1–5): yalnız girişi doğrulanmış katılımcı, başlangıçtan bitiş + 7
 * güne. Düzenleyen kendi etkinliğini değerlendiremez (event_well_rated'i kendine yazdırmasın).
 * Üye başına tek satır (ratings_user_event_idx); yeniden gönderim günceller. Puan üretmez.
 */
export async function etkinligiDegerlendir(
  e: Etkinlik,
  userId: number,
  yildiz: number,
  yorum: string | null,
): Promise<DegerlendirmeSonucu> {
  if (!Number.isInteger(yildiz) || yildiz < 1 || yildiz > 5) return "gecersiz";
  if (!degerlendirmeAcikMi(e)) return "pencere";
  const [rsvp, hostlar] = await Promise.all([
    db.query.eventRsvps.findFirst({
      where: and(eq(schema.eventRsvps.eventId, e.id), eq(schema.eventRsvps.userId, userId)),
    }),
    hostIdleri(e),
  ]);
  if (!rsvp?.checkedInAt || hostlar.includes(userId)) return "giris-yok";
  await db
    .insert(schema.ratings)
    .values({ userId, eventId: e.id, stars: yildiz, body: yorum })
    .onConflictDoUpdate({
      target: [schema.ratings.userId, schema.ratings.eventId],
      set: { stars: yildiz, body: yorum },
    });
  return "tamam";
}

/**
 * Üyenin düzenlediği, payı henüz DAĞITILMAMIŞ etkinlikler için tahmini pay (pano satırı:
 * "bekleyen ≈ N, {tarih}"). Canlı sayım — ledger'da da pending_points'te de karşılığı yoktur.
 */
export async function hostBekleyenleri(
  userId: number,
  simdi: Date = new Date(),
): Promise<{ etkinlik: Etkinlik; tahmini: number; katilimci: number; dagitim: Date }[]> {
  const gorevler = await db.query.eventStaff.findMany({
    where: and(eq(schema.eventStaff.userId, userId), eq(schema.eventStaff.role, "host")),
    columns: { eventId: true },
  });
  const [benim, actiklarim] = await Promise.all([
    gorevler.length
      ? db.query.events.findMany({ where: inArray(schema.events.id, gorevler.map((g) => g.eventId)) })
      : [],
    db.query.events.findMany({ where: eq(schema.events.createdBy, userId) }),
  ]);
  const gecikme = PUAN.eventHostedDelayHours * 3600e3;
  // Başlamış (kapı açılmış) ama dağıtım anı gelmemiş etkinlikler
  const acik = [...new Map([...benim, ...actiklarim].map((e) => [e.id, e])).values()].filter(
    (e) => e.startsAt.getTime() - 3600e3 <= simdi.getTime() && etkinlikBitis(e).getTime() + gecikme > simdi.getTime(),
  );
  const sonuc = [];
  for (const e of acik) {
    const { katilimci, paylar } = await hostPayHesabi(e);
    const tahmini = paylar.get(userId) ?? 0;
    if (tahmini > 0) sonuc.push({ etkinlik: e, tahmini, katilimci, dagitim: new Date(etkinlikBitis(e).getTime() + gecikme) });
  }
  return sonuc;
}

export { etkinlikBitis, etkinlikGorunurMu };
