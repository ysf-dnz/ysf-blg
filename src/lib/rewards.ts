/**
 * Ödül motoru — puanın tek kapısı.
 * awardPoints(): ledger'a yazar; pozitifse streak ilerletir ve seviye
 * atlama açılımlarını (kitap, rozet, yayın hakkı) tetikler.
 * awardBadge(): rozeti bir kez verir (unique) ve bildirim bırakır.
 * Tasarım: kullanıcıyı asla bloklamaz — ödül yan etkileri best-effort.
 */
import { and, eq, gt, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { LEVEL_THRESHOLDS, levelFor } from "@/lib/levels.ts";

type Reason = (typeof schema.pointsLedger.$inferInsert)["reason"];
type BadgeKind = (typeof schema.badges.$inferInsert)["kind"];

/** Seviye açılımları — panoda "sıradaki seviyede seni ne bekliyor" bununla çizilir */
export const UNLOCKS: Record<number, string> = {
  3: "🎁 Hazinenden 1 kitap bedava açılır",
  5: "🎁 İkinci bedava kitap + 📚 Usta Okur rozeti",
  7: "🚀 Quiz ve eğitimlerin onay beklemeden yayınlanır",
};

/** Yerel gün anahtarı (YYYY-MM-DD) — streak hesabı bunun üstünden yürür */
export function gunKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
      const kitap = await hazineKitabiAc(userId, "level");
      await db.insert(schema.notifications).values({
        userId,
        kind: "level",
        body: kitap
          ? "Seviye 3'e ulaştın 🎉 Hazinendeki sıradaki kitap bedava açıldı!"
          : "Seviye 3'e ulaştın 🎉 Hazinene kitap ekle, bedava açılsın.",
        href: kitap ? `/kutuphane/kitap/${kitap}` : "/uye/hosgeldin",
      });
    } else if (lv === 5) {
      await hazineKitabiAc(userId, "level");
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
  // Kilometre taşları: ledger'a doğrudan yazılır (awardPoints'e dönmez — döngü yok)
  if (g.count === 7) {
    await db.insert(schema.pointsLedger).values({
      userId,
      delta: 25,
      reason: "streak_bonus",
      refId: "streak-7",
    });
    await awardBadge(userId, "streak-7", "7 günlük seri 🔥 +25 puan!");
  } else if (g.count === 30) {
    await db.insert(schema.pointsLedger).values({
      userId,
      delta: 150,
      reason: "streak_bonus",
      refId: "streak-30",
    });
    await awardBadge(userId, "streak-30", "30 günlük seri 🔥🔥 +150 puan!");
  }
}

/**
 * Puanın tek kapısı: ledger + (pozitifse) streak + seviye açılımları.
 * Yan etkiler kullanıcı akışını asla düşürmez.
 */
export async function awardPoints(opts: {
  userId: number;
  delta: number;
  reason: Reason;
  refId?: string;
}): Promise<void> {
  const onceki = opts.delta > 0 ? await kazanilan(opts.userId) : 0;
  await db.insert(schema.pointsLedger).values({
    userId: opts.userId,
    delta: opts.delta,
    reason: opts.reason,
    refId: opts.refId,
  });
  if (opts.delta <= 0) return;
  try {
    await streakIlerlet(opts.userId);
    await seviyeAcilimi(opts.userId, onceki, onceki + opts.delta);
  } catch {
    /* ödül süsleri asla ana akışı düşürmesin */
  }
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
