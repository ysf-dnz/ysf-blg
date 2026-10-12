/**
 * Faz 5 ekonomi katmanı (DB tarafı): haftalık canlılık havuzu, ekonomi kartı (tek SQL),
 * suistimal taraması ve işaretli hesap kuyruğu. Saf kurallar lib/economy.ts'te.
 */
import { sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import {
  OGE_ASGARI_SN,
  SUISTIMAL_ESIK,
  canlilikV,
  havuz,
  havuzDagit,
  sonTamamlananHafta,
  type EkonomiHam,
} from "./economy.ts";
import { DAVET_KAYNAKLI, awardPoints, satirlar } from "./rewards.ts";
import { R } from "./routes.ts";

/* ---------------- Canlılık havuzu (F5-02) ---------------- */

type Hafta = ReturnType<typeof sonTamamlananHafta>;

/**
 * Haftanın canlılık havuzunu dağıt (PRD §4.2): yayındaki her kurs için V → havuz → 50/30/20.
 * Pay kişi başına TEK `vitality_pool` satırı (refId `course:{id}:{hafta}`): awardPoints idempotent,
 * cron yeniden koşarsa çift ödeme olmaz. Davet tavanına girmez.
 * İşaretli hesabın ilerlemesi ve asgari süreden (öğe × 60 sn) kısa tamamlama V'ye sayılmaz.
 * @param kursIdleri yalnız bu kurslar (entegrasyon testi canlı kursları ödemesin)
 */
export async function canlilikHavuzuDagit(
  hafta: Hafta = sonTamamlananHafta(),
  kursIdleri?: number[],
): Promise<{ kurs: number; puan: number }> {
  const b = sql`${hafta.baslangic.toISOString()}::timestamp`;
  const e = sql`${hafta.bitis.toISOString()}::timestamp`;
  const yalniz = kursIdleri
    ? sql`and c.id in (${sql.join(kursIdleri.map((i) => sql`${i}`), sql`, `)})`
    : sql``;
  const kurslar = satirlar<{
    id: number;
    title: string;
    slug: string;
    created_by: number;
    ilerleyen: number;
    tamamlama: number;
    begenili: number;
    kaynak: number;
  }>(
    await db.execute(sql`
      select c.id, c.title, c.slug, c.created_by,
        (select count(distinct p.user_id) from course_progress p join users u on u.id = p.user_id
          where p.course_id = c.id and p.user_id <> c.created_by and u.flagged_at is null
            and p.completed_at >= ${b} and p.completed_at < ${e})::int as ilerleyen,
        (select count(*) from course_enrollments k join users u on u.id = k.user_id
          where k.course_id = c.id and u.flagged_at is null
            and k.completed_at >= ${b} and k.completed_at < ${e}
            and k.completed_at - k.joined_at >= ${OGE_ASGARI_SN} * interval '1 second'
              * (select count(*) from course_items i where i.course_id = c.id))::int as tamamlama,
        (select count(distinct y.id) from comments y
          join course_items i on i.id = y.course_item_id
          join likes l on l.comment_id = y.id
          where i.course_id = c.id and y.hidden_at is null and l.user_id <> y.user_id
            and l.created_at >= ${b} and l.created_at < ${e})::int as begenili,
        (select count(*) from course_resources r
          where r.course_id = c.id and r.status = 'accepted'
            and r.accepted_at >= ${b} and r.accepted_at < ${e})::int as kaynak
      from courses c
      where c.status = 'published' ${yalniz}
    `),
  );
  const canli = kurslar
    .map((k) => ({
      ...k,
      toplam: havuz(
        canlilikV({ ilerleyen: k.ilerleyen, tamamlama: k.tamamlama, begeniliYorum: k.begenili, kaynak: k.kaynak }),
      ),
    }))
    .filter((k) => k.toplam > 0);
  if (canli.length === 0) return { kurs: 0, puan: 0 };

  const idler = sql.join(canli.map((k) => sql`${k.id}`), sql`, `);
  const [katki, davet] = await Promise.all([
    // Katkıcılar: o hafta yorumuna beğeni alanlar (kendi beğenisi hariç); ağırlık = beğeni sayısı
    db.execute(sql`
      select i.course_id, y.user_id, count(*)::int as n
      from likes l join comments y on y.id = l.comment_id join course_items i on i.id = y.course_item_id
      where i.course_id in (${idler}) and y.hidden_at is null and l.user_id <> y.user_id
        and l.created_at >= ${b} and l.created_at < ${e}
      group by i.course_id, y.user_id`),
    // Davet edenler: o hafta ilerleme kaydeden davetlileri; ağırlık = aktif davetli sayısı
    db.execute(sql`
      select k.course_id, d.inviter_id as user_id, count(*)::int as n
      from course_enrollments k join invite_codes d on d.id = k.invite_code_id
      where k.course_id in (${idler}) and d.inviter_id <> k.user_id
        and exists (select 1 from course_progress p
                    where p.course_id = k.course_id and p.user_id = k.user_id
                      and p.completed_at >= ${b} and p.completed_at < ${e})
      group by k.course_id, d.inviter_id`),
  ]);
  const agirliklar = (sonuc: unknown, kursId: number) =>
    new Map(
      satirlar<{ course_id: number; user_id: number; n: number }>(sonuc)
        .filter((r) => r.course_id === kursId)
        .map((r) => [r.user_id, r.n]),
    );

  let puan = 0;
  for (const k of canli) {
    const paylar = havuzDagit(k.toplam, k.created_by, agirliklar(katki, k.id), agirliklar(davet, k.id));
    for (const [userId, pay] of paylar) {
      const n = await awardPoints({
        userId,
        delta: pay,
        reason: "vitality_pool",
        refId: `course:${k.id}:${hafta.etiket}`,
      });
      if (n <= 0) continue;
      puan += n;
      await db.insert(schema.notifications).values({
        userId,
        kind: "course",
        body: `"${k.title}" bu hafta canlıydı 🌱 Canlılık havuzundan +${n} puan`,
        href: R.kurs(k.slug),
      });
    }
  }
  return { kurs: canli.length, puan };
}

/* ---------------- Ekonomi kartı (F5-03) ---------------- */

export type EkonomiKarti = EkonomiHam & {
  /** Şu an bekleyen satır (tüm zamanlar) */
  bekleyen: number;
  /** Son 7 günde basılan puanın kaynağa göre dağılımı, büyükten küçüğe */
  kaynaklar: { reason: string; puan: number }[];
};

/** /uye/admin ekonomi kartı — TEK SQL: puan son 7 gün, huniler son 30 gün (PRD §4.9) */
export async function ekonomiKarti(): Promise<EkonomiKarti> {
  const davet = sql.join(DAVET_KAYNAKLI.map((r) => sql`${r}`), sql`, `);
  const [r] = satirlar<EkonomiKarti & { kaynaklar: EkonomiKarti["kaynaklar"] | string }>(
    await db.execute(sql`
      with l as (
        select user_id, delta, reason from points_ledger
        where delta > 0 and created_at > now() - interval '7 days'
      ), p as (
        select status, delta, yazilan from pending_points
        where resolved_at > now() - interval '7 days'
      ), k as (
        select activated_at, completed_at from course_enrollments
        where joined_at > now() - interval '30 days'
      ), g as (
        select r.checked_in_at from event_rsvps r join events e on e.id = r.event_id
        where coalesce(e.ends_at, e.starts_at + interval '2 hours')
              between now() - interval '30 days' and now()
      )
      select
        (select coalesce(sum(delta), 0) from l)::int as basilan,
        (select count(distinct user_id) from l)::int as aktif,
        (select coalesce(sum(delta), 0) from l where reason in (${davet}))::int as davet,
        (select coalesce(json_agg(json_build_object('reason', reason, 'puan', puan) order by puan desc), '[]'::json)
           from (select reason, sum(delta)::int as puan from l group by reason) x) as kaynaklar,
        (select count(*) from p where status = 'confirmed')::int as kesinlesen,
        (select count(*) from p where status = 'confirmed' and yazilan < delta)::int as kirpilan,
        (select count(*) from p where status = 'expired')::int as dusen,
        (select count(*) from pending_points where status = 'pending')::int as bekleyen,
        (select count(*) from k)::int as "kursKatilim",
        (select count(activated_at) from k)::int as "kursAktif",
        (select count(completed_at) from k)::int as "kursBiten",
        (select count(*) from g)::int as "etkinlikKayit",
        (select count(checked_in_at) from g)::int as "etkinlikGiris"
    `),
  );
  const kaynaklar = typeof r!.kaynaklar === "string" ? JSON.parse(r!.kaynaklar) : r!.kaynaklar;
  return { ...r!, kaynaklar };
}

/* ---------------- Suistimal taraması (F5-04) ---------------- */

/** Admin "temiz" dediği hesabın cron_runs işareti (job, period_key = userId): tarama yeniden işaretlemez */
export const SUISTIMAL_TEMIZ = "suistimal-temiz";

/**
 * Davet çiftliği taraması — TEK SQL (saf eşleniği economy.ts suistimalMi): aynı davetçiye 24 saatte
 * ≥ SUISTIMAL_ESIK yeni hesap bağlandıysa (platform, kurs ya da etkinlik daveti) VE o davetçinin
 * kodlarına aynı imzadan (ip + ua) ≥ SUISTIMAL_ESIK ziyaret geldiyse, o hesaplar işaretlenir.
 * Yalnız `member` rolü; adminin temizlediği hesap yeniden işaretlenmez. Cron'da bekleyenlerden ÖNCE koşar.
 * shortcut: günlük tarama — küme iki cron arasında tamamlanırsa ilk hesapların bekleyeni panodan
 * kesinleşebilir; ölçülürse tarama katılım anına taşınır.
 * @param davetciId yalnız bu davetçi (entegrasyon testi)
 */
export async function suistimalTara(davetciId?: number): Promise<{ id: number; inviter_id: number }[]> {
  const yalniz = davetciId ? sql`and b.inviter_id = ${davetciId}` : sql``;
  return satirlar(
    await db.execute(sql`
      with bag as (
        select invited_id as user_id, inviter_id from referrals
        union
        select k.user_id, d.inviter_id from course_enrollments k join invite_codes d on d.id = k.invite_code_id
        union
        select r.user_id, d.inviter_id from event_rsvps r join invite_codes d on d.id = r.invite_code_id
      ), yeni as (
        select u.id, b.inviter_id,
          count(*) over (partition by b.inviter_id order by u.created_at
                         range between interval '24 hours' preceding and current row) as pencere
        from users u join bag b on b.user_id = u.id
        where u.created_at > now() - interval '48 hours' and b.inviter_id <> u.id ${yalniz}
      ), yogun as (
        select inviter_id from yeni group by inviter_id having max(pencere) >= ${SUISTIMAL_ESIK}
      ), imza as (
        select d.inviter_id, count(*) as n, sum(count(*)) over (partition by d.inviter_id) as toplam
        from invite_visits v join invite_codes d on d.id = v.invite_code_id
        where v.created_at > now() - interval '48 hours'
        group by d.inviter_id, v.ip_hash, coalesce(v.ua_hash, '')
      ), supheli as (
        select distinct y.inviter_id from yogun y join imza i on i.inviter_id = y.inviter_id
        where i.n >= ${SUISTIMAL_ESIK} and i.n * 2 >= i.toplam
      )
      update users u set flagged_at = now()
      from yeni y join supheli s on s.inviter_id = y.inviter_id
      where u.id = y.id and u.flagged_at is null and u.role = 'member'
        and not exists (select 1 from cron_runs c where c.job = ${SUISTIMAL_TEMIZ} and c.period_key = u.id::text)
      returning u.id, y.inviter_id
    `),
  );
}

/** /uye/admin suistimal kuyruğu: işaretli hesaplar, onları getiren ve tutulan bekleyen puan */
export async function isaretliHesaplar() {
  return satirlar<{
    id: number;
    handle: string;
    name: string;
    /** TR saatiyle "GG.AA SS:DD" */
    acilis: string;
    isaret: string;
    davet_eden: string | null;
    tutulan: number;
  }>(
    await db.execute(sql`
      select u.id, u.handle, u.name,
        to_char(u.created_at + interval '3 hours', 'DD.MM HH24:MI') as acilis,
        to_char(u.flagged_at + interval '3 hours', 'DD.MM HH24:MI') as isaret,
        (select i.handle from referrals r join users i on i.id = r.inviter_id
          where r.invited_id = u.id limit 1) as davet_eden,
        (select coalesce(sum(p.delta), 0) from pending_points p
          where p.status = 'pending'
            and (p.user_id = u.id or substring(p.ref_id from '(?:^|:)u:([0-9]{1,9})$')::int = u.id))::int as tutulan
      from users u
      where u.flagged_at is not null
      order by u.flagged_at desc
      limit 100
    `),
  );
}
