/**
 * Lig & sezon motoru.
 * - Sezon: aylık pencere; kulüp skoru = üyelerin pozitif puanı ÷ √üye
 *   (küçük kulüp ezilmez, büyük kulüp şişmez). Ham toplam da döner.
 * - Özel lig: başkanın kulüp içi yarışması; aynı sorgu kulüp-scoped koşar.
 * Sorguların tümü points_ledger'dan türetilir (tek gerçek kaynak).
 */
import { and, eq, gt, gte, inArray, lt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";

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

/** Ay adı ("2026 Ağustos") — sezon isimlendirmesi */
export function sezonAdi(d: Date): string {
  return new Intl.DateTimeFormat("tr-TR", { year: "numeric", month: "long" }).format(d);
}

/** Ayın ilk/son anı (UTC yerine yerel — topluluk TR odaklı) */
export function ayPenceresi(d: Date): { start: Date; end: Date } {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end };
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
  const uyelikler = await db.query.clubMembers.findMany({
    where: inArray(schema.clubMembers.clubId, kulupler.map((c) => c.id)),
  });
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
  const uyelikler = await db.query.clubMembers.findMany({
    where: eq(schema.clubMembers.clubId, clubId),
  });
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
