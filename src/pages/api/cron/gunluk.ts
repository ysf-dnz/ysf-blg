/**
 * GET /api/cron/gunluk — günlük bakım işleri (Vercel Cron, 03:00 UTC).
 * Kimlik: Authorization: Bearer CRON_SECRET (Vercel) veya x-cron-secret.
 * Her iş cron_runs (job, period_key UNIQUE) ile idempotent: aynı dönem
 * ikinci kez çalışmaz; endpoint elle de güvenle tetiklenebilir.
 */
import type { APIRoute } from "astro";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { aktifSezon, kulupIciSiralama, kulupSiralamasi } from "@/lib/league.ts";
import { awardBadge, gunKey, hazineKitabiAc } from "@/lib/rewards.ts";

export const prerender = false;

/** İş daha önce bu dönem için koştuysa false döner; koşmadıysa kaydeder */
async function birKez(job: string, periodKey: string): Promise<boolean> {
  const [row] = await db
    .insert(schema.cronRuns)
    .values({ job, periodKey })
    .onConflictDoNothing()
    .returning();
  return !!row;
}

/**
 * Dönem kilidini alır, işi çalıştırır; iş PATLARSA kilidi geri verir.
 * Kilit iş bitmeden tüketilirse yarıda kalan bir sezon kapanışı bir daha
 * hiç koşmaz (aktifSezon bayat sezonu seçmez) → ödüller kalıcı kaybolur.
 */
async function birKezCalistir<T>(
  job: string,
  periodKey: string,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  if (!(await birKez(job, periodKey))) return undefined;
  try {
    return await fn();
  } catch (err) {
    await db
      .delete(schema.cronRuns)
      .where(and(eq(schema.cronRuns.job, job), eq(schema.cronRuns.periodKey, periodKey)));
    throw err;
  }
}

/** 7 gün hareketsiz "üstlenildi" görevleri backlog'a döndür (site geneli) */
async function bayatGorevSupur(): Promise<number> {
  const rows = await db
    .update(schema.campaignTasks)
    .set({ status: "backlog", assigneeId: null, claimedAt: null })
    .where(
      and(
        eq(schema.campaignTasks.status, "claimed"),
        lt(schema.campaignTasks.claimedAt, new Date(Date.now() - 7 * 864e5)),
      ),
    )
    .returning({ id: schema.campaignTasks.id });
  return rows.length;
}

/** Sezonu kapat: şampiyon kulüp + ilk 10 üyeye hazine kitabı */
async function sezonKapat(sezon: typeof schema.seasons.$inferSelect) {
  const siralama = await kulupSiralamasi(sezon.startsAt, sezon.endsAt);
  const sampiyon = siralama[0];
  await db
    .update(schema.seasons)
    .set({ status: "closed", championClubId: sampiyon?.clubId ?? null })
    .where(eq(schema.seasons.id, sezon.id));

  if (sampiyon) {
    const uyeler = await db.query.clubMembers.findMany({
      where: eq(schema.clubMembers.clubId, sampiyon.clubId),
    });
    for (const u of uyeler) {
      await awardBadge(
        u.userId,
        "sezon-sampiyonu",
        `"${sampiyon.name}" ${sezon.name} sezonunun şampiyonu oldu 🏆`,
        `/kulup/${sampiyon.slug}`,
      );
    }
  }

  // Site geneli ilk 10 üye: hazinedeki sıradaki kilitli kitap hediye
  const [ilk10] = await Promise.all([
    db
      .select({
        userId: schema.pointsLedger.userId,
        t: sql<number>`sum(${schema.pointsLedger.delta})`,
      })
      .from(schema.pointsLedger)
      .where(
        and(
          sql`${schema.pointsLedger.delta} > 0`,
          sql`${schema.pointsLedger.createdAt} >= ${sezon.startsAt}`,
          sql`${schema.pointsLedger.createdAt} < ${sezon.endsAt}`,
        ),
      )
      .groupBy(schema.pointsLedger.userId)
      .orderBy(desc(sql`sum(${schema.pointsLedger.delta})`))
      .limit(10),
  ]);
  for (const u of ilk10) {
    const kitap = await hazineKitabiAc(u.userId, "reward");
    await db.insert(schema.notifications).values({
      userId: u.userId,
      kind: "season",
      body: kitap
        ? `${sezon.name} sezonunu ilk 10'da bitirdin 🏅 Hazinendeki sıradaki kitap hediye!`
        : `${sezon.name} sezonunu ilk 10'da bitirdin 🏅`,
      href: kitap ? `/kutuphane/kitap/${kitap}` : "/lider",
    });
  }
}

/** Ayın kitabı: en çok oyu alan kitap site-geneli kampanyaya dönüşür */
async function ayinKitabi() {
  const [birinci] = await db
    .select({
      bookId: schema.campaignVotes.bookId,
      n: sql<number>`count(*)`,
    })
    .from(schema.campaignVotes)
    .groupBy(schema.campaignVotes.bookId)
    .orderBy(desc(sql`count(*)`))
    .limit(1);
  if (!birinci) return;
  const admin = await db.query.users.findFirst({
    where: eq(schema.users.role, "admin"),
  });
  if (!admin) return;
  const simdi = new Date();
  const ad = new Intl.DateTimeFormat("tr-TR", { month: "long" }).format(simdi);
  await db.insert(schema.campaigns).values({
    clubId: null,
    bookId: birinci.bookId,
    title: `📖 ${ad} Ayının Kitabı`,
    ownerId: admin.id,
    status: "active",
  });
  await db.delete(schema.campaignVotes);
}

/** Süresi biten özel ligleri kapat: birinciye rozet + bildirim */
async function ozelLigleriKapat() {
  const bitenler = await db.query.clubLeagues.findMany({
    where: and(
      eq(schema.clubLeagues.status, "active"),
      lt(schema.clubLeagues.endsAt, new Date()),
    ),
  });
  for (const lig of bitenler) {
    if (!(await birKez("ozel-lig", String(lig.id)))) continue;
    const siralama = await kulupIciSiralama(lig.clubId, lig.startsAt, lig.endsAt, 1);
    const birinci = siralama[0]?.total ? siralama[0] : null;
    await db
      .update(schema.clubLeagues)
      .set({ status: "closed", winnerId: birinci?.userId ?? null })
      .where(eq(schema.clubLeagues.id, lig.id));
    if (birinci) {
      await awardBadge(
        birinci.userId,
        "lig-birincisi",
        `"${lig.name}" liginin birincisi oldun 🥇${lig.rewardNote ? ` Ödül: ${lig.rewardNote}` : ""}`,
      );
    }
  }
}

export const GET: APIRoute = async ({ request }) => {
  // process.env ÖNCE: import.meta.env build anında gömülür → panelden
  // rotasyon redeploy'suz etkisiz kalırdı (build'de tanımsızsa "undefined"
  // kalıcı gömülür ve cron sonsuza dek 401 döner).
  const secret = process.env.CRON_SECRET ?? import.meta.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const header = request.headers.get("x-cron-secret") ?? "";
  if (!secret || (auth !== `Bearer ${secret}` && header !== secret))
    return new Response("Yetkisiz", { status: 401 });

  const bugun = gunKey(new Date());
  const rapor: Record<string, unknown> = {};

  // 1) Bayat görev süpürmesi (günlük)
  const bayat = await birKezCalistir("bayat-gorev", bugun, bayatGorevSupur);
  if (bayat !== undefined) rapor.bayatGorev = bayat;

  // 2) Sezon döngüsü: biteni kapat, yenisini aç
  const sezon = await aktifSezon();
  if (sezon.endsAt <= new Date()) {
    const kapandi = await birKezCalistir("sezon-kapat", String(sezon.id), async () => {
      await sezonKapat(sezon);
      await aktifSezon(); // yeni ayın sezonu
      return sezon.name;
    });
    if (kapandi !== undefined) rapor.sezonKapandi = kapandi;
  }

  // 3) Ayın kitabı (her ayın ilk günü)
  if (new Date().getDate() === 1) {
    const secildi = await birKezCalistir("ayin-kitabi", bugun.slice(0, 7), async () => {
      await ayinKitabi();
      return true;
    });
    if (secildi !== undefined) rapor.ayinKitabi = secildi;
  }

  // 4) Biten özel ligler
  await ozelLigleriKapat();

  return new Response(JSON.stringify({ ok: true, ...rapor }), {
    headers: { "content-type": "application/json" },
  });
};
