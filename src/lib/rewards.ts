/**
 * Ödül motoru — puanın tek kapısı.
 * awardPoints(): ledger'a yazar; pozitifse streak ilerletir ve seviye
 * atlama açılımlarını (kitap, rozet, yayın hakkı) tetikler.
 * awardBadge(): rozeti bir kez verir (unique) ve bildirim bırakır.
 * Tasarım: kullanıcıyı asla bloklamaz — ödül yan etkileri best-effort.
 */
import { and, eq, gt, gte, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { LEVEL_THRESHOLDS, levelFor } from "@/lib/levels.ts";
import { likePuaniVerilirMi } from "@/lib/economy.ts";
import { PUAN } from "@/lib/points.ts";

type Reason = (typeof schema.pointsLedger.$inferInsert)["reason"];
type BadgeKind = (typeof schema.badges.$inferInsert)["kind"];

/** Seviye açılımları — panoda "sıradaki seviyede seni ne bekliyor" bununla çizilir */
export const UNLOCKS: Record<number, string> = {
  3: "🎁 Hazinenden 1 kitap bedava açılır",
  5: "🎁 İkinci bedava kitap + 📚 Usta Okur rozeti",
  7: "🚀 Quiz ve eğitimlerin onay beklemeden yayınlanır",
};

/**
 * Gün anahtarı (YYYY-MM-DD) — streak hesabı bunun üstünden yürür.
 * Topluluk TR odaklı; sunucu (Vercel) UTC'de koştuğu için gün sınırı
 * SABİT Europe/Istanbul'dur — yoksa TR saatiyle 00:00-03:00 arası
 * aktivite önceki güne yazılıp serileri haksız yere kırardı.
 */
export const TOPLULUK_TZ = "Europe/Istanbul";
const gunBicimi = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TOPLULUK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function gunKey(d: Date): string {
  return gunBicimi.format(d);
}

/** Saf streak geçişi (birim test edilir): dünse +1, bugünse aynı, değilse 1 */
export function sonrakiStreak(
  streakCount: number,
  streakLastDay: string | null,
  simdi: Date,
): { count: number; day: string; ilerledi: boolean } {
  const bugun = gunKey(simdi);
  if (streakLastDay === bugun) return { count: streakCount, day: bugun, ilerledi: false };
  const dun = gunKey(new Date(simdi.getTime() - 864e5));
  return {
    count: streakLastDay === dun ? streakCount + 1 : 1,
    day: bugun,
    ilerledi: true,
  };
}

export async function awardBadge(
  userId: number,
  kind: BadgeKind,
  body?: string,
  href = "/uye",
): Promise<boolean> {
  const [row] = await db
    .insert(schema.badges)
    .values({ userId, kind })
    .onConflictDoNothing()
    .returning();
  if (!row) return false;
  await db.insert(schema.notifications).values({
    userId,
    kind: "badge",
    body: body ?? `Yeni rozet kazandın: ${kind} 🏅`,
    href,
  });
  return true;
}

/** Hazinedeki (learning_list) ilk kilitli kitabı verilen kaynakla açar */
export async function hazineKitabiAc(
  userId: number,
  source: "level" | "reward",
): Promise<string | null> {
  const [liste, acik] = await Promise.all([
    db.query.learningList.findMany({
      where: eq(schema.learningList.userId, userId),
      orderBy: schema.learningList.order,
    }),
    db.query.bookAccess.findMany({
      where: eq(schema.bookAccess.userId, userId),
    }),
  ]);
  const acikIdler = new Set(acik.map((a) => a.bookId));
  const kilitli = liste.find((h) => !acikIdler.has(h.bookId));
  if (!kilitli) return null;
  await db
    .insert(schema.bookAccess)
    .values({ userId, bookId: kilitli.bookId, source })
    .onConflictDoNothing();
  return kilitli.bookId;
}

/**
 * Seviye hediyesi HAKKI: bu seviyeye kadar kaç bedava hazine kitabı
 * kazanılmış olmalı (kümülatif). UNLOCKS ile aynı seviyeleri anlatır.
 */
function seviyeHediyeHakki(level: number): number {
  let hak = 0;
  if (level >= 3) hak++;
  if (level >= 5) hak++;
  return hak;
}

/**
 * Seviye hediyelerini HAK ESASLI uygular (kendi kendini onarır).
 *
 * NEDEN: eski kurgu olay esaslıydı — hediye yalnız seviye atlama ANINDA
 * verilirdi. Yeni üye kayıtta +50 puanla anında Seviye 3 olduğu için
 * hediye `learning_list` HENÜZ BOŞKEN tetikleniyor, `hazineKitabiAc`
 * null dönüyor ve hak telafisiz YANIYORDU: vaat edilen iki bedava
 * kitaptan biri fiilen hiç dağıtılmıyordu.
 *
 * Burada hak ile gerçekleşen karşılaştırılır; eksik varsa (hazine artık
 * doluysa) tamamlanır. Hazine seçimi sonrası da çağrılır.
 *
 * @returns yeni açılan kitap id'leri
 */
export async function seviyeHediyeleriniUygula(userId: number): Promise<string[]> {
  const seviye = levelFor(await kazanilan(userId));
  const hak = seviyeHediyeHakki(seviye);
  if (hak === 0) return [];

  const verilmis = await db.query.bookAccess.findMany({
    where: and(eq(schema.bookAccess.userId, userId), eq(schema.bookAccess.source, "level")),
  });
  const acilanlar: string[] = [];
  for (let i = verilmis.length; i < hak; i++) {
    const kitap = await hazineKitabiAc(userId, "level");
    if (!kitap) break; // hazine boş/tükendi — hak korunur, sonra uygulanır
    acilanlar.push(kitap);
  }
  return acilanlar;
}

/** Toplam kazanılan (pozitif) puan — seviye bundan türer */
async function kazanilan(userId: number): Promise<number> {
  const [row] = await db
    .select({ t: sql<number>`coalesce(sum(${schema.pointsLedger.delta}), 0)` })
    .from(schema.pointsLedger)
    .where(and(eq(schema.pointsLedger.userId, userId), gt(schema.pointsLedger.delta, 0)));
  return Number(row?.t ?? 0);
}

async function seviyeAcilimi(userId: number, onceki: number, sonraki: number) {
  const eskiLv = levelFor(onceki);
  const yeniLv = levelFor(sonraki);
  if (yeniLv <= eskiLv) return;
  for (let lv = eskiLv + 1; lv <= yeniLv; lv++) {
    if (lv === 3) {
      // Hak esaslı: hazine boşsa hak YANMAZ, liste dolunca uygulanır
      const [kitap] = await seviyeHediyeleriniUygula(userId);
      await db.insert(schema.notifications).values({
        userId,
        kind: "level",
        body: kitap
          ? "Seviye 3'e ulaştın 🎉 Hazinendeki sıradaki kitap bedava açıldı!"
          : "Seviye 3'e ulaştın 🎉 Hazineni kur — bedava kitabın seni bekliyor.",
        href: kitap ? `/kutuphane/kitap/${kitap}` : "/uye/hosgeldin",
      });
    } else if (lv === 5) {
      await seviyeHediyeleriniUygula(userId);
      await awardBadge(
        userId,
        "usta-okur",
        "Seviye 5 📚 Usta Okur rozetin ve ikinci bedava kitabın hazır!",
      );
    } else if (lv === 7) {
      await db.insert(schema.notifications).values({
        userId,
        kind: "level",
        body: "Seviye 7 🚀 Artık quiz ve eğitimlerin onay beklemeden yayınlanıyor.",
        href: "/uye",
      });
    } else {
      await db.insert(schema.notifications).values({
        userId,
        kind: "level",
        body: `Seviye ${lv}'e yükseldin 🎉`,
        href: "/lider",
      });
    }
  }
}

async function streakIlerlet(userId: number) {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user) return;
  const g = sonrakiStreak(user.streakCount, user.streakLastDay, new Date());
  if (!g.ilerledi) return;
  await db
    .update(schema.users)
    .set({ streakCount: g.count, streakLastDay: g.day })
    .where(eq(schema.users.id, userId));
  // Kilometre taşları awardPoints üzerinden verilir: bonus seviye atlatıyorsa
  // açılım (bedava kitap / rozet) da tetiklensin. Sonsuz döngü yok — bu satıra
  // gelindiğinde streakLastDay bugüne çekilmiştir, iç çağrıda ilerledi=false.
  // refId dönem anahtarlı: aynı kilometre taşı iki kez ödüllenmez (ledger unique).
  if (g.count === 7) {
    await awardPoints({
      userId,
      delta: PUAN.streak7,
      reason: "streak_bonus",
      refId: `streak-7:${g.day}`,
    });
    await awardBadge(userId, "streak-7", `7 günlük seri 🔥 +${PUAN.streak7} puan!`);
  } else if (g.count === 30) {
    await awardPoints({
      userId,
      delta: PUAN.streak30,
      reason: "streak_bonus",
      refId: `streak-30:${g.day}`,
    });
    await awardBadge(userId, "streak-30", `30 günlük seri 🔥🔥 +${PUAN.streak30} puan!`);
  }
}

/**
 * Puanın tek kapısı: ledger + (pozitifse) streak + seviye açılımları.
 * Yan etkiler kullanıcı akışını asla düşürmez.
 *
 * Idempotent: aynı (userId, reason, refId) daha önce yazıldıysa hiçbir şey
 * yapmaz ve false döner (points_ledger_idem_idx). Çift tık / paralel istek
 * / yeniden gönderim böylece çift ödül üretemez.
 * @returns ledger'a GERÇEKTEN yazıldıysa true
 */
export async function awardPoints(opts: {
  userId: number;
  delta: number;
  reason: Reason;
  refId?: string;
}): Promise<boolean> {
  const onceki = opts.delta > 0 ? await kazanilan(opts.userId) : 0;
  const [row] = await db
    .insert(schema.pointsLedger)
    .values({
      userId: opts.userId,
      delta: opts.delta,
      reason: opts.reason,
      refId: opts.refId,
    })
    .onConflictDoNothing()
    .returning({ id: schema.pointsLedger.id });
  if (!row) return false;
  if (opts.delta <= 0) return true;
  try {
    await streakIlerlet(opts.userId);
    await seviyeAcilimi(opts.userId, onceki, onceki + opts.delta);
  } catch {
    /* ödül süsleri asla ana akışı düşürmesin */
  }
  return true;
}

/**
 * Harcama kapısı: bakiye yeterliyse TEK atomik SQL ile düşer.
 *
 * Neden tek SQL: neon-http sürücüsü interaktif transaction desteklemez,
 * bu yüzden "önce bakiyeyi oku, sonra yaz" deseni yarışa açıktır —
 * 200 puanla paralel N istek atıp N kitap açmak mümkündü. Burada bakiye
 * koşulu INSERT'in WHERE'ine gömülüdür: koşul tutmazsa satır yazılmaz.
 * ON CONFLICT DO NOTHING ile aynı harcama iki kez de kesilemez.
 *
 * @param cost POZİTİF maliyet (ledger'a negatif yazılır)
 * @returns harcama gerçekten kesildiyse true; bakiye yetmediyse veya
 *          bu harcama zaten kesilmişse false
 */
export async function spendPoints(opts: {
  userId: number;
  cost: number;
  reason: Reason;
  refId: string;
}): Promise<boolean> {
  const sonuc = await db.execute(sql`
    insert into points_ledger (user_id, delta, reason, ref_id)
    select ${opts.userId}, ${-opts.cost}, ${opts.reason}, ${opts.refId}
    where (
      select coalesce(sum(delta), 0) from points_ledger where user_id = ${opts.userId}
    ) >= ${opts.cost}
    on conflict do nothing
    returning id
  `);
  const satirlar = Array.isArray(sonuc)
    ? sonuc
    : ((sonuc as { rows?: unknown[] })?.rows ?? []);
  return satirlar.length > 0;
}

/** TR gününün başlangıcı (Türkiye kalıcı UTC+3, yaz saati yok) */
export function gunBaslangici(simdi: Date = new Date()): Date {
  return new Date(`${gunKey(simdi)}T00:00:00+03:00`);
}

/**
 * Beğeni ödülü — çiftlik freni TEK kapıdan geçer.
 *
 * Sayaç HEM feed gönderisi HEM üye yazısı beğenilerini birlikte sayar:
 * eskiden fren yalnız feed'de vardı ve yalnız feed beğenilerini sayıyordu,
 * bu yüzden iki hesap birbirinin yazılarını beğenerek günlük sınırı
 * tamamen atlayabiliyordu.
 *
 * @returns puan gerçekten verildiyse true (beğeni her hâlükârda kalır)
 */
export async function begeniPuaniVer(opts: {
  begenenId: number;
  yazarId: number;
  refId: string;
}): Promise<boolean> {
  const bugun = gunBaslangici();
  const [feedSayi, yaziSayi] = await Promise.all([
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.likes)
      .innerJoin(schema.feedPosts, eq(schema.likes.feedPostId, schema.feedPosts.id))
      .where(
        and(
          eq(schema.likes.userId, opts.begenenId),
          eq(schema.feedPosts.userId, opts.yazarId),
          gte(schema.likes.createdAt, bugun),
        ),
      ),
    db
      .select({ c: sql<number>`count(*)` })
      .from(schema.likes)
      .innerJoin(schema.memberPosts, eq(schema.likes.memberPostId, schema.memberPosts.id))
      .where(
        and(
          eq(schema.likes.userId, opts.begenenId),
          eq(schema.memberPosts.userId, opts.yazarId),
          gte(schema.likes.createdAt, bugun),
        ),
      ),
  ]);
  // Yeni eklenen beğeni de sayıma dahil → daha önceki sayı = toplam - 1
  const toplam = Number(feedSayi[0]?.c ?? 0) + Number(yaziSayi[0]?.c ?? 0);
  if (!likePuaniVerilirMi(Math.max(0, toplam - 1))) return false;
  return awardPoints({
    userId: opts.yazarId,
    delta: PUAN.likeReceived,
    reason: "like_received",
    refId: opts.refId,
  });
}

/** Sayaç rozetleri: 10 görev, 5 quiz, 5 aktif davet */
export async function sayacRozetleri(userId: number, reason: Reason): Promise<void> {
  try {
    if (reason === "task_done") {
      const [r] = await db
        .select({ n: sql<number>`count(*)` })
        .from(schema.pointsLedger)
        .where(
          and(eq(schema.pointsLedger.userId, userId), eq(schema.pointsLedger.reason, "task_done")),
        );
      if (Number(r?.n ?? 0) >= 10)
        await awardBadge(userId, "gorev-10", "10 kampanya görevi tamamladın 🔨 Rozetin hazır!");
    }
    if (reason === "quiz_set_approved") {
      const [r] = await db
        .select({ n: sql<number>`count(*)` })
        .from(schema.quizzes)
        .where(
          and(eq(schema.quizzes.createdBy, userId), inArray(schema.quizzes.status, ["published"])),
        );
      if (Number(r?.n ?? 0) >= 5)
        await awardBadge(userId, "quiz-ustasi", "5 quiz seti yayında 🧠 Quiz Ustası oldun!");
    }
    if (reason === "referral_activated") {
      const [r] = await db
        .select({ n: sql<number>`count(*)` })
        .from(schema.referrals)
        .where(
          and(eq(schema.referrals.inviterId, userId), eq(schema.referrals.status, "activated")),
        );
      if (Number(r?.n ?? 0) >= 5) {
        const verildi = await awardBadge(
          userId,
          "davetci-5",
          "5 davetin aktifleşti 🤝 Davetçi rozetin + hazinenden bedava kitap!",
        );
        if (verildi) await hazineKitabiAc(userId, "reward");
      }
    }
  } catch {
    /* best-effort */
  }
}

export { LEVEL_THRESHOLDS };
