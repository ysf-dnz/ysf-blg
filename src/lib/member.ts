/**
 * Üye yardımcıları: Clerk kimliği ↔ users tablosu köprüsü,
 * puan toplamı, kitap erişimi.
 */
import { and, eq, sql } from "drizzle-orm";
import { awardPoints, sayacRozetleri } from "@/lib/rewards.ts";
import { db, schema } from "@/db/client.ts";
import { PUAN } from "./points.ts";
import type { APIContext, AstroGlobal } from "astro";

type Ctx = Pick<AstroGlobal | APIContext, "locals"> &
  Partial<Pick<AstroGlobal | APIContext, "cookies">>;

/** Site sahibi — ilk girişte admin rolü alır */
const OWNER_EMAILS = ["sn.yusufdeniz@gmail.com"];

export type Member = typeof schema.users.$inferSelect;

function slugifyHandle(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[ışğüöç]/g, (c) =>
        ({ ı: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c" })[c] ?? c,
      )
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "uye"
  );
}

/** Girişli Clerk kullanıcısı için users satırını getirir; yoksa
 *  karşılama paketiyle (hediye kitap + puan) oluşturur. */
export async function getOrCreateMember(ctx: Ctx): Promise<Member | null> {
  const auth = (ctx.locals as App.Locals).auth();
  if (!auth.userId) return null;

  const existing = await db.query.users.findFirst({
    where: eq(schema.users.clerkId, auth.userId),
  });
  if (existing) return existing;

  const clerkUser = await (ctx.locals as App.Locals).currentUser();
  const name = clerkUser?.fullName ?? clerkUser?.username ?? "Üye";
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  const base = slugifyHandle(name);
  // handle çakışması: sonuna kısa rastgele ek
  const handle = `${base}-${auth.userId.slice(-4).toLowerCase()}`;

  const [user] = await db
    .insert(schema.users)
    .values({
      clerkId: auth.userId,
      handle,
      name,
      avatarUrl: clerkUser?.imageUrl,
      role: OWNER_EMAILS.includes(email.toLowerCase()) ? "admin" : "member",
    })
    .onConflictDoNothing({ target: schema.users.clerkId })
    .returning();

  const member =
    user ??
    (await db.query.users.findFirst({
      where: eq(schema.users.clerkId, auth.userId),
    }))!;

  if (user) {
    // Karşılama puanı; hediye kitabı üye /uye/hosgeldin'de KENDİSİ seçer
    await awardPoints({
      userId: member.id,
      delta: PUAN.welcome,
      reason: "welcome",
    });

    // Davet cookie'si varsa daveti işle: davet edene "joined" puanı
    const refHandle = ctx.cookies?.get("ysf_ref")?.value;
    if (refHandle && refHandle !== member.handle) {
      const inviter = await db.query.users.findFirst({
        where: eq(schema.users.handle, refHandle),
      });
      if (inviter && inviter.id !== member.id) {
        await db
          .insert(schema.referrals)
          .values({ inviterId: inviter.id, invitedId: member.id })
          .onConflictDoNothing();
        const bonus =
          inviter.role === "rep"
            ? Math.round(PUAN.referralJoined * PUAN.repReferralMultiplier)
            : PUAN.referralJoined;
        await awardPoints({
          userId: inviter.id,
          delta: bonus,
          reason: "referral_joined",
          refId: String(member.id),
        });
        await db.insert(schema.notifications).values({
          userId: inviter.id,
          kind: "referral",
          body: `${member.name} davetinle katıldı 🎉 +${bonus} puan`,
          href: `/u/${member.handle}`,
        });
      }
      ctx.cookies?.delete("ysf_ref", { path: "/" });
    }
  }
  return member;
}

/** Onaylanan ilk yazıda davet aktivasyonu: davet edene büyük puan */
export async function activateReferralIfFirstPost(authorId: number) {
  const ref = await db.query.referrals.findFirst({
    where: eq(schema.referrals.invitedId, authorId),
  });
  if (!ref || ref.status === "activated") return;
  await db
    .update(schema.referrals)
    .set({ status: "activated" })
    .where(eq(schema.referrals.id, ref.id));
  await awardPoints({
    userId: ref.inviterId,
    delta: PUAN.referralActivated,
    reason: "referral_activated",
    refId: String(authorId),
  });
  await db.insert(schema.notifications).values({
    userId: ref.inviterId,
    kind: "referral",
    body: `Davet ettiğin üyenin ilk yazısı yayınlandı 🚀 +${PUAN.referralActivated} puan`,
  });
  await sayacRozetleri(ref.inviterId, "referral_activated");
}

/** Toplam bakiye (kazanılan - harcanan) */
export async function pointBalance(userId: number): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${schema.pointsLedger.delta}), 0)` })
    .from(schema.pointsLedger)
    .where(eq(schema.pointsLedger.userId, userId));
  return Number(row?.total ?? 0);
}

/** Toplam KAZANILAN puan (seviye için; negatifler hariç) */
export async function earnedPoints(userId: number): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(case when ${schema.pointsLedger.delta} > 0 then ${schema.pointsLedger.delta} else 0 end), 0)`,
    })
    .from(schema.pointsLedger)
    .where(eq(schema.pointsLedger.userId, userId));
  return Number(row?.total ?? 0);
}

export async function hasBookAccess(
  userId: number,
  bookId: string,
): Promise<boolean> {
  const row = await db.query.bookAccess.findFirst({
    where: and(
      eq(schema.bookAccess.userId, userId),
      eq(schema.bookAccess.bookId, bookId),
    ),
  });
  return !!row;
}
