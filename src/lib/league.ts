/**
 * Lig & sezon motoru.
 * - Sezon: aylık pencere; kulüp skoru = üyelerin pozitif puanı ÷ √üye
 *   (küçük kulüp ezilmez, büyük kulüp şişmez). Ham toplam da döner.
 * - Özel lig: başkanın kulüp içi yarışması; aynı sorgu kulüp-scoped koşar.
 * Sorguların tümü points_ledger'dan türetilir (tek gerçek kaynak).
 */
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, lt, lte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { TOPLULUK_TZ, awardBadge, gunKey, hazineKitabiAc } from "@/lib/rewards.ts";
import { birKezCalistir } from "@/lib/cron.ts";
import { isaretsizKazananSql } from "@/lib/social.ts";

export interface KulupSkoru {
  clubId: number;
  name: string;
  slug: string;
  memberCount: number;
  raw: number;
  /** raw / sqrt(memberCount) — adil kıyas skoru */
  normalized: number;
}

export interface UyeSkoru {
  userId: number;
  handle: string;
  name: string;
  avatarUrl: string | null;
  total: number;
}

/** Ay adı ("2026 Ağustos") — sezon isimlendirmesi, TR takvimine göre (Vercel UTC'de koşar) */
export function sezonAdi(d: Date): string {
  return new Intl.DateTimeFormat("tr-TR", { year: "numeric", month: "long", timeZone: TOPLULUK_TZ }).format(d);
}

/** Ayın ilk/son anı — TR takvimi (sabit +03:00; makine saat dilimi ne olsun aynı pencere; gunKey ile uyumlu) */
export function ayPenceresi(d: Date): { start: Date; end: Date } {
  const [y, m] = gunKey(d).split("-").map(Number) as [number, number];
  const tr = (yy: number, mm: number) => new Date(`${yy}-${String(mm).padStart(2, "0")}-01T00:00:00+03:00`);
  return { start: tr(y, m), end: m === 12 ? tr(y + 1, 1) : tr(y, m + 1) };
}

/**
 * Aktif sezonu döndürür; yoksa içinde bulunulan ay için oluşturur.
 * Cron'suz da çalışır (ilk sayfa görüntülemesi sezonu açar).
 */
export async function aktifSezon() {
  const simdi = new Date();
  const mevcut = await db.query.seasons.findFirst({
    where: and(eq(schema.seasons.status, "active"), gt(schema.seasons.endsAt, simdi)),
  });
  if (mevcut) return mevcut;
  const { start, end } = ayPenceresi(simdi);
  const [yeni] = await db
    .insert(schema.seasons)
    .values({ name: sezonAdi(simdi), startsAt: start, endsAt: end })
    .returning();
  return yeni!;
}

/**
 * Bitişi geçmiş AKTİF sezonlar (eskiden yeniye) — cron bunları kapatır. aktifSezon() bitmiş sezonu asla
 * döndürmez; cron'un eski `aktifSezon().endsAt <= now` dalı bu yüzden ölüydü (Faz 5 incelemesi C1).
 */
export async function bitenSezonlar(simdi: Date = new Date()) {
  return db.query.seasons.findMany({
    where: and(eq(schema.seasons.status, "active"), lte(schema.seasons.endsAt, simdi)),
    orderBy: asc(schema.seasons.endsAt),
  });
}

/**
 * Sezonu kapat: şampiyon kulüp (yalnız puanı > 0 olan; işaretli üyeler puana da rozete de girmez) + site geneli
 * ilk 10 üyeye hazinedeki sıradaki kilitli kitap (hazine boşsa yalnız kutlama). Aynı adlı (yarışta çift açılmış)
 * aktif sezon satırları birlikte kapanır. Cron `birKezCalistir('sezon-kapat', sezon.name)` ile çağırır.
 * SIRA: ödüller ÖNCE, `closed` EN SONDA — yarıda kalırsa sezon `active` kalır, `bitenSezonlar` ertesi gün yine
 * listeler ve kapanış tamamlanır (eski sıra `closed`'ı önce yazıyordu: Neon geçici hatasında kalan ilk-10 kitapları
 * ve rozetler sessizce, kalıcı kayboluyordu). Yeniden koşum çift ödül vermez: rozet unique, ilk-10 kitabı kişi başına
 * `sezon-ilk10` kilidiyle (`hazineKitabiAc` idempotent DEĞİL — her çağrı sıradaki kitabı açar).
 * Ledger penceresi kolon kodlayıcısından geçer (ham Date parametresi TR makinesinde 3 saat kayardı).
 */
export async function sezonKapat(
  sezon: typeof schema.seasons.$inferSelect,
): Promise<{ sampiyonKulupId: number | null; ilk10: number }> {
  const siralama = await kulupSiralamasi(sezon.startsAt, sezon.endsAt);
  const sampiyon = siralama[0]?.raw ? siralama[0] : undefined; // puansız sezonun şampiyonu yok
  if (sampiyon) {
    const uyeler = await isaretsizler(
      await db.query.clubMembers.findMany({ where: eq(schema.clubMembers.clubId, sampiyon.clubId) }),
    );
    for (const u of uyeler)
      await awardBadge(u.userId, "sezon-sampiyonu", `"${sampiyon.name}" ${sezon.name} sezonunun şampiyonu oldu 🏆`, `/kulup/${sampiyon.slug}`);
  }
  const ilk10 = await db
    .select({ userId: schema.pointsLedger.userId, t: sql<number>`sum(${schema.pointsLedger.delta})` })
    .from(schema.pointsLedger)
    .where(
      and(
        gt(schema.pointsLedger.delta, 0),
        gte(schema.pointsLedger.createdAt, sezon.startsAt),
        lt(schema.pointsLedger.createdAt, sezon.endsAt),
        isaretsizKazananSql,
      ),
    )
    .groupBy(schema.pointsLedger.userId)
    .orderBy(desc(sql`sum(${schema.pointsLedger.delta})`))
    .limit(10);
  for (const u of ilk10) {
    await birKezCalistir("sezon-ilk10", `${sezon.name}:${u.userId}`, async () => {
      const kitap = await hazineKitabiAc(u.userId, "reward");
      await db.insert(schema.notifications).values({
        userId: u.userId,
        kind: "season",
        body: kitap
          ? `${sezon.name} sezonunu ilk 10'da bitirdin 🏅 Hazinendeki sıradaki kitap hediye!`
          : `${sezon.name} sezonunu ilk 10'da bitirdin 🏅`,
        href: kitap ? `/kutuphane/kitap/${kitap}` : "/lider",
      });
    });
  }
  await db
    .update(schema.seasons)
    .set({ status: "closed", championClubId: sampiyon?.clubId ?? null })
    .where(and(eq(schema.seasons.name, sezon.name), eq(schema.seasons.status, "active")));
  return { sampiyonKulupId: sampiyon?.clubId ?? null, ilk10: ilk10.length };
}

/** İşaretli (flagged_at) üyeler lig hesabına girmez: ne puanı ne de √üye paydası (F5-04) */
async function isaretsizler<T extends { userId: number }>(uyelikler: T[]): Promise<T[]> {
  if (uyelikler.length === 0) return uyelikler;
  const isaretli = new Set(
    (
      await db.query.users.findMany({
        where: and(inArray(schema.users.id, uyelikler.map((m) => m.userId)), isNotNull(schema.users.flaggedAt)),
        columns: { id: true },
      })
    ).map((u) => u.id),
  );
  return isaretli.size ? uyelikler.filter((m) => !isaretli.has(m.userId)) : uyelikler;
}

/** Pencere içindeki kullanıcı-başı pozitif puan toplamları */
async function pozitifPuanlar(
  userIds: number[],
  start: Date,
  end: Date,
): Promise<Map<number, number>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({
      userId: schema.pointsLedger.userId,
      t: sql<number>`coalesce(sum(${schema.pointsLedger.delta}), 0)`,
    })
    .from(schema.pointsLedger)
    .where(
      and(
        inArray(schema.pointsLedger.userId, userIds),
        gt(schema.pointsLedger.delta, 0),
        gte(schema.pointsLedger.createdAt, start),
        lt(schema.pointsLedger.createdAt, end),
      ),
    )
    .groupBy(schema.pointsLedger.userId);
  return new Map(rows.map((r) => [r.userId, Number(r.t)]));
}

/** Sezon penceresinde onaylı kulüplerin puan durumu (normalize sıralı) */
export async function kulupSiralamasi(start: Date, end: Date): Promise<KulupSkoru[]> {
  const kulupler = await db.query.clubs.findMany({
    where: eq(schema.clubs.status, "approved"),
  });
  if (kulupler.length === 0) return [];
  const uyelikler = await isaretsizler(
    await db.query.clubMembers.findMany({
      where: inArray(schema.clubMembers.clubId, kulupler.map((c) => c.id)),
    }),
  );
  const puan = await pozitifPuanlar([...new Set(uyelikler.map((m) => m.userId))], start, end);

  const skorlar = kulupler.map((c) => {
    const uyeler = uyelikler.filter((m) => m.clubId === c.id);
    const raw = uyeler.reduce((t, m) => t + (puan.get(m.userId) ?? 0), 0);
    const memberCount = uyeler.length;
    return {
      clubId: c.id,
      name: c.name,
      slug: c.slug,
      memberCount,
      raw,
      normalized: memberCount > 0 ? Math.round(raw / Math.sqrt(memberCount)) : 0,
    };
  });
  return skorlar.sort((a, b) => b.normalized - a.normalized);
}

/** Kulüp içi üye sıralaması (sezon veya özel lig penceresi) */
export async function kulupIciSiralama(
  clubId: number,
  start: Date,
  end: Date,
  limit = 10,
): Promise<UyeSkoru[]> {
  const uyelikler = await isaretsizler(
    await db.query.clubMembers.findMany({
      where: eq(schema.clubMembers.clubId, clubId),
    }),
  );
  if (uyelikler.length === 0) return [];
  const puan = await pozitifPuanlar(uyelikler.map((m) => m.userId), start, end);
  const users = await db.query.users.findMany({
    where: inArray(schema.users.id, uyelikler.map((m) => m.userId)),
  });
  return users
    .map((u) => ({
      userId: u.id,
      handle: u.handle,
      name: u.name,
      avatarUrl: u.avatarUrl,
      total: puan.get(u.id) ?? 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

/** Normalizasyon (saf, birim test için): ham toplam ÷ √üye */
export function normalizeSkor(raw: number, memberCount: number): number {
  return memberCount > 0 ? Math.round(raw / Math.sqrt(memberCount)) : 0;
}
