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
import { DAVET_KAYNAKLI, puanOlayi, satirlar } from "./rewards.ts";
import { R } from "./routes.ts";

/* ---------------- Canlılık havuzu (F5-02) ---------------- */

type Hafta = ReturnType<typeof sonTamamlananHafta>;

/**
 * Haftanın canlılık havuzunu dağıt (PRD §4.2): yayındaki her kurs için V → havuz → 50/30/20.
 * Pay kişi başına TEK `vitality_pool` satırı (refId `course:{id}:{hafta}`): awardPoints idempotent,
 * cron yeniden koşarsa çift ödeme olmaz. Davet tavanına girmez; kişi başı haftalık tavanı var (tavanIcin).
 * V'ye ve pay ağırlıklarına SAYILMAYANLAR: üreticinin kendi eklediği kaynak (otomatik kabul edilir) ve
 * kendi yorumu, işaretli hesabın ilerlemesi / beğenisi / davetliliği, kursa katılmamış hesabın beğenisi,
 * asgari süreden (öğe × 60 sn) kısa tamamlama. İşaretli alıcının payı bekleyene yazılır (puanOlayi).
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
          join users lu on lu.id = l.user_id
          where i.course_id = c.id and y.hidden_at is null and y.user_id <> c.created_by
            and l.user_id <> y.user_id and lu.flagged_at is null
            and exists (select 1 from course_enrollments ke where ke.course_id = c.id and ke.user_id = l.user_id)
            and l.created_at >= ${b} and l.created_at < ${e})::int as begenili,
        (select count(*) from course_resources r
          where r.course_id = c.id and r.status = 'accepted' and r.user_id <> c.created_by
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
    // Katkıcılar: o hafta yorumuna beğeni alanlar (kendi ve işaretli hesabın beğenisi hariç);
    // ağırlık = beğeni sayısı. Üretici havuzDagit'te bu dilimden çıkarılır.
    db.execute(sql`
      select i.course_id, y.user_id, count(*)::int as n
      from likes l join comments y on y.id = l.comment_id join course_items i on i.id = y.course_item_id
        join users lu on lu.id = l.user_id
      where i.course_id in (${idler}) and y.hidden_at is null and l.user_id <> y.user_id
        and lu.flagged_at is null
        -- Beğenen kursa KATILMIŞ olmalı (Faz 5 kararı): kursla ilgisi olmayan kuklanın beğenisi %30 dilimini yönlendirmesin
        and exists (select 1 from course_enrollments ke where ke.course_id = i.course_id and ke.user_id = l.user_id)
        and l.created_at >= ${b} and l.created_at < ${e}
      group by i.course_id, y.user_id`),
    // Davet edenler: o hafta ilerleme kaydeden İŞARETSİZ davetlileri; ağırlık = aktif davetli sayısı
    db.execute(sql`
      select k.course_id, d.inviter_id as user_id, count(*)::int as n
      from course_enrollments k join invite_codes d on d.id = k.invite_code_id
        join users ku on ku.id = k.user_id
      where k.course_id in (${idler}) and d.inviter_id <> k.user_id and ku.flagged_at is null
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
      // puanOlayi: alıcı işaretliyse pay bekleyene gider. Kaynak tek bir hesap değil → yaş freni yok.
      const n = await puanOlayi({
        userId,
        delta: pay,
        reason: "vitality_pool",
        refId: `course:${k.id}:${hafta.etiket}`,
        kaynakOlusturulma: new Date(0),
        note: `"${k.title}" canlılık havuzu (${hafta.etiket})`,
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
 * Davet çiftliği taraması — TEK SQL (saf eşleniği economy.ts suistimalMi; ikisi birlikte değişir).
 * KANIT HESABIN KENDİ KAYIT İMZASI (users.signup_ip_hash — Faz 5 kök çözüm), kimliksiz /d/ ziyareti DEĞİL:
 * aynı davetçiye (kurs / etkinlik kodu YA DA /?ref= platform daveti) bağlı, 48 saatte açılmış, AYNI imzayı taşıyan
 * ≥ SUISTIMAL_ESIK hesabın 24 saatlik penceresindeki üyeler işaretlenir. Dışarıdan eklenen hiçbir istek (ziyaret,
 * curl, OG botu, yabancının kuklaları) bir hesabı kümeye sokamaz ya da çıkaramaz; farklı ağdan gelen gerçek davetli
 * aynı gün gelse de işaretlenmez. İmzasız (NULL) hesap hiçbir kümeye girmez — NULL hiçbir zaman suçlamaz.
 * Yalnız `member` rolü; adminin temizlediği hesap yeniden işaretlenmez. Cron'da en başta koşar.
 * shortcut: iki ağa yayılan çiftlik (3+3) ve günde ≤ 4 hesap eşiğin altında; IP dağıtan çiftlik görünmez
 * (tavanlar sınırlar: davet 300/7g, referral_joined 24 s bekleyen, havuz 200, beğeni 100). Kuyrukta çok-ağlı
 * küme görülürse davetçi düzeyi "farklı imza ×2 ≤ imzalı" kuralı eklenir (oda arkadaşı çiftlerini de işaretler —
 * bilinçli ertelendi). Aynı ağdan gerçek kalabalık (yurt / kampüs Wi-Fi) sahte pozitif → admin "Temiz".
 * @param davetciId yalnız bu davetçi (entegrasyon testi)
 */
export async function suistimalTara(davetciId?: number): Promise<{ id: number; inviter_id: number }[]> {
  return satirlar(
    await db.execute(sql`${suistimalCte(davetciId)}
      update users u set flagged_at = now()
      from aday a
      where u.id = a.id and u.flagged_at is null -- hedefte de: eşzamanlı ikinci tarama satırı yeniden güncellemesin
      returning u.id, a.inviter_id
    `),
  );
}

/** Taramanın işaretleyeceği hesaplar — salt OKUR (UPDATE yok). suistimalTara ile aynı CTE'ler, aynı küme. */
export async function suistimalAdaylari(davetciId?: number): Promise<{ id: number; inviter_id: number }[]> {
  return satirlar(await db.execute(sql`${suistimalCte(davetciId)} select id, inviter_id from aday`));
}

/** Tarama CTE'leri (tek kaynak): aday SELECT'i ve UPDATE aynı kümeyi görsün */
function suistimalCte(davetciId?: number) {
  const yalniz = davetciId ? sql`and b.inviter_id = ${davetciId}` : sql``;
  return sql`
      with bag as (
        select k.user_id, d.inviter_id from course_enrollments k join invite_codes d on d.id = k.invite_code_id
        union
        select r.user_id, d.inviter_id from event_rsvps r join invite_codes d on d.id = r.invite_code_id
        union
        -- /?ref= platform daveti GERİ (09fc098 ziyaret kanıtı yüzünden çıkarmıştı): kanıt artık hesabın imzası,
        -- ziyaretsiz gerçek platform davetlisi kümelenmez; tek ağdan açılan /?ref= kuklaları kümelenir
        select r.invited_id, r.inviter_id from referrals r
      ), yeni as (
        -- davetçi × imza: AYNI imzalı hesapların 24 saatlik kayan sayımı. İmzasız hesap ne sayılır ne işaretlenir
        -- (PARTITION BY NULL'ları tek gruba koyar — filtre olmadan 5 imzasız hesap "küme" olurdu)
        select u.id, u.created_at, u.signup_ip_hash as imza, b.inviter_id,
          count(*) over (partition by b.inviter_id, u.signup_ip_hash order by u.created_at
                         range between interval '24 hours' preceding and current row) as pencere
        from users u join bag b on b.user_id = u.id
        where u.created_at > now() - interval '48 hours' and b.inviter_id <> u.id
          and u.signup_ip_hash is not null ${yalniz}
      ), aday as (
        -- iki şüpheli davetçinin ortak üyesi TEK satır (UPDATE … FROM belirsiz davetçiyi seçerdi)
        select distinct on (y.id) y.id, y.inviter_id
        from yeni y join users u on u.id = y.id
        where u.flagged_at is null and u.role = 'member'
          and not exists (select 1 from cron_runs c where c.job = ${SUISTIMAL_TEMIZ} and c.period_key = u.id::text)
          -- yalnız KÜMENİN penceresi: aynı davetçi + AYNI imzayla 24 saatte ≥ eşik hesabın 24 saatlik penceresinde
          -- açılmış olmalı; farklı imzalı ya da pencere dışı hesap işaretlenmez (B4'ün imzalı hâli)
          and exists (select 1 from yeni z where z.inviter_id = y.inviter_id and z.imza = y.imza
                      and z.pencere >= ${SUISTIMAL_ESIK}
                      and y.created_at <= z.created_at and y.created_at >= z.created_at - interval '24 hours')
        order by y.id, y.inviter_id
      )`;
}

/**
 * Kayıt imzalarını unut (kişisel veri en az): hesap `gunOnce` günden yaşlıysa `signup_ip_hash` NULL — tarama yalnız
 * 48 saatlik yeni hesaplara bakar, 7 gün = 48 s + cron'un birkaç gün fırlatma payı. Cron günlük; `userIds` yalnız
 * entegrasyon testi (canlıyı daraltır). Silme değil NULL'lama: satır üyenin.
 */
export async function imzalariUnut(gunOnce = 7, userIds?: number[]): Promise<number> {
  const yalniz = userIds ? sql`and id in (${sql.join(userIds.map((i) => sql`${i}`), sql`, `)})` : sql``;
  return satirlar(
    await db.execute(sql`
      update users set signup_ip_hash = null
      where signup_ip_hash is not null and created_at < now() - ${gunOnce} * interval '1 day' ${yalniz}
      returning id
    `),
  ).length;
}

/** Bir hesaba ait ve ondan doğan (refId sonu `u:{id}`) bekleyen puanları düşür — admin "suistimal" kararı */
export async function bekleyenleriDusur(userId: number): Promise<number> {
  return satirlar(
    await db.execute(sql`
      update pending_points set status = 'expired', resolved_at = now()
      where status = 'pending'
        and (user_id = ${userId} or substring(ref_id from '(?:^|:)u:([0-9]{1,9})$')::int = ${userId})
      returning id
    `),
  ).length;
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
