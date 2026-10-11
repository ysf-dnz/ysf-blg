/**
 * POST /api/uye/egitim — kurs motoru: oluştur · katıl · öğe tamamla ·
 * en iyi cevap · ek kaynak · değerlendir. (Rota adı tarihsel; kavram "kurs".)
 *
 * Puan kapıları (ADR 0001): üretici puanları puanOlayi() ile (kaynak hesap
 * 24 saatten gençse bekleyene), tavanlar awardPoints içinde (tavanIcin),
 * durum geçişleri tek SQL `UPDATE … WHERE … IS NULL RETURNING`.
 */
import type { APIRoute } from "astro";
import { and, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { awardPoints, puanOlayi } from "@/lib/rewards.ts";
import { db, schema } from "@/db/client.ts";
import { earnedPoints, getOrCreateMember, type Member } from "@/lib/member.ts";
import { levelFor } from "@/lib/levels.ts";
import { canManage, clubRoleOf } from "@/lib/permissions.ts";
import { PUAN } from "@/lib/points.ts";
import { asgariSureGectiMi } from "@/lib/economy.ts";
import { slugifyTitle } from "@/lib/markdown.ts";
import { R } from "@/lib/routes.ts";
import { guvenliYol } from "@/lib/urls.ts";
import { davetAktivasyonu, davetBitirme, kursaKatil } from "@/lib/davet.ts";

export const prerender = false;

/** Yayın için en az geçerli öğe (PRD §4.1) */
export const KURS_ASGARI_OGE = 3;
/** Bu kadar farklı katılımcı aktive olunca üretici "kurs açıldı" puanı alır */
export const KURS_ACILIS_ESIGI = 3;
const SEVIYELER = ["baslangic", "orta", "ileri"] as const;

type Kurs = typeof schema.courses.$inferSelect;
type Katilim = typeof schema.courseEnrollments.$inferSelect;

function parseYoutubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  return m?.[1] ?? null;
}

async function bildir(userId: number, body: string, href: string) {
  await db.insert(schema.notifications).values({ userId, kind: "course", body, href });
}

async function kursBul(id: number): Promise<Kurs | undefined> {
  return id ? db.query.courses.findFirst({ where: eq(schema.courses.id, id) }) : undefined;
}

async function katilimBul(userId: number, courseId: number): Promise<Katilim | undefined> {
  return db.query.courseEnrollments.findFirst({
    where: and(
      eq(schema.courseEnrollments.userId, userId),
      eq(schema.courseEnrollments.courseId, courseId),
    ),
  });
}

/**
 * Kurs bitirme ödülleri — kapılar: kendi kursu değil, asgari süre
 * (öğe × 60 sn, katılımdan beri), tavanlar (awardPoints içinde). İlerleme her
 * durumda kayıtlı; yalnız puan koşula bağlı.
 */
async function bitirmeOdulleri(
  ogrenen: Member,
  kurs: Kurs,
  katilim: Katilim,
  ogeSayisi: number,
) {
  if (kurs.createdBy === ogrenen.id) return;
  const href = R.kurs(kurs.slug);
  if (!asgariSureGectiMi(ogeSayisi, katilim.joinedAt)) {
    await bildir(
      ogrenen.id,
      `"${kurs.title}" tamamlandı ✅ İlerlemen kayıtlı; puan için kurs en az ${ogeSayisi} dakika sürmeli.`,
      href,
    );
    return;
  }
  const yazilan = await awardPoints({
    userId: ogrenen.id,
    delta: PUAN.courseCompleted,
    reason: "course_completed",
    refId: `course:${kurs.id}`,
  });
  await bildir(
    ogrenen.id,
    yazilan > 0
      ? `"${kurs.title}" bitti 🎓 +${yazilan} puan${yazilan < PUAN.courseCompleted ? " (haftalık kurs tavanına kırpıldı)" : ""}`
      : `"${kurs.title}" bitti 🎓 Bu haftaki kurs puanı tavanı dolu — ilerlemen kayıtlı.`,
    href,
  );
  await puanOlayi({
    userId: kurs.createdBy,
    delta: PUAN.courseLearnerCompleted,
    reason: "course_learner_completed",
    refId: `course:${kurs.id}:u:${ogrenen.id}`,
    kaynakOlusturulma: ogrenen.createdAt,
    note: `${ogrenen.name} "${kurs.title}" kursunu bitirdi`,
  });
  // Davet eden: davetlisi bitirdi (+10; asgari süre bu noktada geçmiş)
  await davetBitirme(katilim, kurs, ogrenen);
}

export const POST: APIRoute = async (context) => {
  const member = await getOrCreateMember(context);
  if (!member) return new Response("Giriş gerekli", { status: 401 });

  const form = await context.request.formData();
  const action = String(form.get("action") ?? "create");

  // ---------------- Katıl ----------------
  if (action === "join") {
    const kurs = await kursBul(Number(form.get("courseId") ?? 0));
    if (!kurs || kurs.status !== "published")
      return new Response("Kurs yayında değil", { status: 404 });
    // Atıflı katılım: karşılama çerezi bu kursa aitse davet bekleyenleri açılır
    const k = await kursaKatil(member, kurs, context.cookies);
    const p = new URLSearchParams();
    if (k.yeni) p.set("katildin", "1");
    if (k.davetli) p.set("davet", "1");
    const b = String(form.get("b") ?? ""); // bulunduğu öğe korunur (sayfa 0..n-1'e kırpar)
    if (/^\d{1,3}$/.test(b) && b !== "0") p.set("b", b);
    return context.redirect(`${R.kurs(kurs.slug)}${p.size ? `?${p}` : ""}`);
  }

  // ---------------- Öğe tamamla ----------------
  if (action === "complete") {
    const item = await db.query.courseItems.findFirst({
      where: eq(schema.courseItems.id, Number(form.get("itemId") ?? 0)),
    });
    const kurs = item ? await kursBul(item.courseId) : undefined;
    if (!item || !kurs) return new Response("Öğe bulunamadı", { status: 404 });
    if (kurs.status !== "published")
      return new Response("Kurs yayında değil", { status: 403 });
    const katilim = await katilimBul(member.id, kurs.id);
    if (!katilim) return new Response("Önce kursa katıl", { status: 403 });

    const [ins] = await db
      .insert(schema.courseProgress)
      .values({ userId: member.id, courseId: kurs.id, itemId: item.id })
      .onConflictDoNothing()
      .returning();
    if (ins) {
      // Kurs aktivasyonu (ilk öğe) — tek SQL; satır döndüyse bu istek yaptı
      const [akt] = await db
        .update(schema.courseEnrollments)
        .set({ activatedAt: new Date() })
        .where(
          and(eq(schema.courseEnrollments.id, katilim.id), isNull(schema.courseEnrollments.activatedAt)),
        )
        .returning({ id: schema.courseEnrollments.id });
      if (akt && kurs.createdBy !== member.id) {
        await puanOlayi({
          userId: kurs.createdBy,
          delta: PUAN.courseLearnerActivated,
          reason: "course_learner_activated",
          refId: `course:${kurs.id}:u:${member.id}`,
          kaynakOlusturulma: member.createdAt,
          note: `${member.name} "${kurs.title}" kursunda aktive oldu`,
        });
        // Açılış eşiği: aktive olmuş FARKLI katılımcılar; en genç hesabın yaşı
        // hesap-yaşı frenini belirler (3 kukla hesapla anında +50 yazılamaz)
        const [aktif] = await db
          .select({
            n: sql<number>`count(*)`,
            enGenc: sql<string>`max(${schema.users.createdAt})`,
          })
          .from(schema.courseEnrollments)
          .innerJoin(schema.users, eq(schema.users.id, schema.courseEnrollments.userId))
          .where(
            and(
              eq(schema.courseEnrollments.courseId, kurs.id),
              isNotNull(schema.courseEnrollments.activatedAt),
              ne(schema.courseEnrollments.userId, kurs.createdBy),
            ),
          );
        if (Number(aktif?.n ?? 0) >= KURS_ACILIS_ESIGI) {
          const acildi = await puanOlayi({
            userId: kurs.createdBy,
            delta: PUAN.courseLaunched,
            reason: "course_launched",
            refId: `course:${kurs.id}`,
            kaynakOlusturulma: new Date(aktif!.enGenc),
            note: `"${kurs.title}" kursun açıldı (${KURS_ACILIS_ESIGI} katılımcı aktive)`,
          });
          if (acildi > 0)
            await bildir(
              kurs.createdBy,
              `"${kurs.title}" kursun açıldı 🚀 ${KURS_ACILIS_ESIGI} katılımcı aktive oldu, +${acildi} puan`,
              R.kurs(kurs.slug),
            );
        }
      }

      // Davetle gelen katılımcı aktive oldu → davet puanları kesinleşir (ADR K2)
      if (akt) await davetAktivasyonu(katilim, kurs, member);

      // Bitirme: tüm öğeler tamam → tek SQL geçiş
      const [[total], [done]] = await Promise.all([
        db
          .select({ c: sql<number>`count(*)` })
          .from(schema.courseItems)
          .where(eq(schema.courseItems.courseId, kurs.id)),
        db
          .select({ c: sql<number>`count(*)` })
          .from(schema.courseProgress)
          .where(
            and(
              eq(schema.courseProgress.courseId, kurs.id),
              eq(schema.courseProgress.userId, member.id),
            ),
          ),
      ]);
      if (Number(done?.c) === Number(total?.c)) {
        const [bit] = await db
          .update(schema.courseEnrollments)
          .set({ completedAt: new Date() })
          .where(
            and(
              eq(schema.courseEnrollments.id, katilim.id),
              isNull(schema.courseEnrollments.completedAt),
            ),
          )
          .returning({ id: schema.courseEnrollments.id });
        if (bit) await bitirmeOdulleri(member, kurs, katilim, Number(total?.c));
      }
    }
    return context.redirect(guvenliYol(form, R.kurs(kurs.slug)));
  }

  // ---------------- En iyi cevap (F1-07) ----------------
  if (action === "accept-answer") {
    const commentId = Number(form.get("commentId") ?? 0);
    // Tek SQL: yorum bu üreticinin kursunun öğesinde, kendi cevabı değil,
    // öğede henüz kabul edilmiş cevap yok → kabul et
    const sonuc = await db.execute(sql`
      update comments c set accepted_at = now()
      from course_items ci join courses k on k.id = ci.course_id
      where c.id = ${commentId} and c.course_item_id = ci.id and k.created_by = ${member.id}
        and k.status = 'published'
        and c.user_id <> ${member.id} and c.accepted_at is null and c.hidden_at is null
        and not exists (select 1 from comments x where x.course_item_id = ci.id and x.accepted_at is not null)
      returning c.user_id as user_id, k.slug as slug, k.title as title
    `);
    const satir = (Array.isArray(sonuc) ? sonuc : ((sonuc as { rows?: unknown[] }).rows ?? []))[0] as
      | { user_id: number; slug: string; title: string }
      | undefined;
    if (satir) {
      const n = await awardPoints({
        userId: satir.user_id,
        delta: PUAN.answerAccepted,
        reason: "answer_accepted",
        refId: `yorum:${commentId}`,
      });
      if (n > 0)
        await bildir(
          satir.user_id,
          `Cevabın "${satir.title}" kursunda en iyi cevap seçildi 🏅 +${n} puan`,
          R.kurs(satir.slug),
        );
    }
    return context.redirect(guvenliYol(form, R.kurslar));
  }

  // ---------------- Ek kaynak öner (F1-08) ----------------
  if (action === "resource") {
    const kurs = await kursBul(Number(form.get("courseId") ?? 0));
    const url = String(form.get("url") ?? "").trim();
    const note = String(form.get("note") ?? "").trim().slice(0, 200) || null;
    if (!kurs || kurs.status !== "published") return new Response("Kurs yok", { status: 404 });
    if (!/^https:\/\/[^\s]+$/.test(url))
      return new Response("Yalnız https:// bağlantı kabul edilir", { status: 400 });
    if (!(await katilimBul(member.id, kurs.id)) && kurs.createdBy !== member.id)
      return new Response("Önce kursa katıl", { status: 403 });
    // Spam freni: kurs başına en çok 3 bekleyen öneri (bildirim + liste taşmasın)
    const [bekleyen] = await db
      .select({ n: sql<number>`count(*)` })
      .from(schema.courseResources)
      .where(
        and(
          eq(schema.courseResources.courseId, kurs.id),
          eq(schema.courseResources.userId, member.id),
          eq(schema.courseResources.status, "pending"),
        ),
      );
    if (Number(bekleyen?.n ?? 0) >= 3)
      return new Response("Bu kursta 3 önerin onay bekliyor — önce onlar değerlendirilsin.", { status: 429 });
    await db.insert(schema.courseResources).values({
      courseId: kurs.id,
      userId: member.id,
      url: url.slice(0, 500),
      note,
      // Üreticinin kendi eklediği kaynak onay beklemez (puan da üretmez)
      status: kurs.createdBy === member.id ? "accepted" : "pending",
      acceptedAt: kurs.createdBy === member.id ? new Date() : null,
    });
    if (kurs.createdBy !== member.id)
      await bildir(
        kurs.createdBy,
        `${member.name} "${kurs.title}" için ek kaynak önerdi 🔗 Onaylarsan kursunda adıyla listelenir.`,
        R.kurs(kurs.slug),
      );
    return context.redirect(guvenliYol(form, R.kurs(kurs.slug)));
  }

  if (action === "resource-review") {
    const resourceId = Number(form.get("resourceId") ?? 0);
    const kabul = form.get("decision") === "accept";
    // Yalnız üretici, yalnız bekleyen → tek SQL
    const sonuc = await db.execute(sql`
      update course_resources r set status = ${kabul ? "accepted" : "rejected"},
        accepted_at = ${kabul ? sql`now()` : sql`null`}
      from courses k
      where r.id = ${resourceId} and r.course_id = k.id and k.created_by = ${member.id} and r.status = 'pending'
      returning r.user_id as user_id, k.slug as slug, k.title as title
    `);
    const satir = (Array.isArray(sonuc) ? sonuc : ((sonuc as { rows?: unknown[] }).rows ?? []))[0] as
      | { user_id: number; slug: string; title: string }
      | undefined;
    if (satir && kabul && satir.user_id !== member.id) {
      const n = await awardPoints({
        userId: satir.user_id,
        delta: PUAN.resourceAccepted,
        reason: "resource_accepted",
        refId: `kaynak:${resourceId}`,
      });
      await bildir(
        satir.user_id,
        n > 0
          ? `Ek kaynağın "${satir.title}" kursuna eklendi 🔗 +${n} puan`
          : `Ek kaynağın "${satir.title}" kursuna eklendi 🔗 (günlük kaynak puanı tavanı dolu)`,
        R.kurs(satir.slug),
      );
    }
    return context.redirect(guvenliYol(form, satir ? R.kurs(satir.slug) : R.kurslar));
  }

  // ---------------- Değerlendir (F1-09) ----------------
  if (action === "rate") {
    const kurs = await kursBul(Number(form.get("courseId") ?? 0));
    const stars = Number(form.get("stars") ?? 0);
    const body = String(form.get("body") ?? "").trim().slice(0, 300) || null;
    if (!kurs) return new Response("Kurs yok", { status: 404 });
    if (kurs.createdBy === member.id)
      return new Response("Kendi kursunu değerlendiremezsin", { status: 403 });
    if (!Number.isInteger(stars) || stars < 1 || stars > 5)
      return new Response("1-5 yıldız", { status: 400 });
    const katilim = await katilimBul(member.id, kurs.id);
    if (!katilim?.activatedAt)
      return new Response("Değerlendirmek için en az ilk öğeyi bitir", { status: 403 });
    await db
      .insert(schema.ratings)
      .values({ userId: member.id, courseId: kurs.id, stars, body })
      .onConflictDoUpdate({
        target: [schema.ratings.userId, schema.ratings.courseId],
        set: { stars, body },
      });
    return context.redirect(guvenliYol(form, R.kurs(kurs.slug)));
  }

  // ---------------- Oluştur ----------------
  const title = String(form.get("title") ?? "").trim().slice(0, 90);
  if (!title) return new Response("Başlık gerekli", { status: 400 });
  // clubId form'dan gelir → YÖNETİCİSİ OLMADIĞIN kulübe iliştirilemez.
  const istenenClubId = Number(form.get("clubId") ?? 0) || null;
  const clubId =
    istenenClubId && canManage(await clubRoleOf(member, istenenClubId))
      ? istenenClubId
      : null;

  // Öğeler ÖNCE çözülür; geçersizler sayılmaz, kurs satırı ancak yeterli
  // geçerli öğe varsa yazılır (eskiden 0 öğeli kurs yayınlanabiliyordu).
  type Oge = Omit<typeof schema.courseItems.$inferInsert, "courseId" | "order">;
  const ogeler: Oge[] = [];
  for (let i = 0; i < 100; i++) {
    const kind = form.get(`i_${i}_kind`);
    if (kind === null) continue;
    const baslik = String(form.get(`i_${i}_title`) ?? "").trim();
    const ref = String(form.get(`i_${i}_url`) ?? form.get(`i_${i}_ref`) ?? "").trim();
    if (kind === "youtube") {
      const vid = parseYoutubeId(ref);
      if (vid) ogeler.push({ kind: "youtube", title: baslik || `Video ${ogeler.length + 1}`, youtubeId: vid });
    } else if (kind === "yazi") {
      // Yalnız KENDİ yayınlanmış yazın (API başkasının yazısını kabul ediyordu)
      const post = await db.query.memberPosts.findFirst({
        where: and(
          eq(schema.memberPosts.id, Number(ref)),
          eq(schema.memberPosts.userId, member.id),
          eq(schema.memberPosts.status, "published"),
        ),
      });
      if (post) ogeler.push({ kind: "yazi", title: post.title, memberPostId: post.id });
    } else if (kind === "quiz") {
      const quiz = await db.query.quizzes.findFirst({
        where: and(eq(schema.quizzes.id, Number(ref)), eq(schema.quizzes.status, "published")),
      });
      if (quiz) ogeler.push({ kind: "quiz", title: quiz.title, quizId: quiz.id });
    }
  }
  if (ogeler.length < KURS_ASGARI_OGE)
    return new Response(
      `Yayın için en az ${KURS_ASGARI_OGE} geçerli öğe gerekir (${ogeler.length} geçerli).`,
      { status: 400 },
    );

  const coverRaw = String(form.get("coverUrl") ?? "").trim();
  const levelRaw = String(form.get("level") ?? "");
  // Sonek rastgele: Date.now tabanlı 3 karakter 46 sn'de bir tekrarlıyordu (unique → 500)
  const slug = `${slugifyTitle(title).slice(0, 60) || "kurs"}-${crypto.randomUUID().slice(0, 6)}`;
  const [course] = await db
    .insert(schema.courses)
    .values({
      clubId,
      bookId: String(form.get("bookId") ?? "") || null,
      slug,
      title,
      description: String(form.get("description") ?? "").trim().slice(0, 200) || null,
      summary: String(form.get("summary") ?? "").trim().slice(0, 140) || null,
      // canParse şart: "https://a^b" gibi değerler sayfada new URL ile kalıcı 500 üretirdi
      coverUrl:
        /^https:\/\/[^\s]+$/.test(coverRaw) && coverRaw.length <= 300 && URL.canParse(coverRaw)
          ? coverRaw
          : null,
      level: (SEVIYELER as readonly string[]).includes(levelRaw) ? (levelRaw as Kurs["level"]) : null,
      estMinutes: Math.min(Math.max(Math.round(Number(form.get("estMinutes") ?? 0)) || 0, 0), 6000) || null,
      // Kulüp kursu / admin / Sv7 güvenilir üretici: onaysız yayın; diğerleri admin onayı
      status:
        clubId || member.role === "admin" || levelFor(await earnedPoints(member.id)) >= 7
          ? "published"
          : "pending",
      createdBy: member.id,
    })
    .returning();
  await db
    .insert(schema.courseItems)
    .values(ogeler.map((o, order) => ({ ...o, courseId: course!.id, order })));

  return context.redirect(`${R.kurs(slug)}?${course!.status === "published" ? "yayin" : "onay"}=1`);
};
