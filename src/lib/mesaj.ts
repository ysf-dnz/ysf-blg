/**
 * Birebir mesaj (DM v1, F4-03) ve engel (F4-04) — DB akışı. Saf kurallar: economy.ts `dmKarar`
 * (izin) ve mesaj-kural.ts (gövde). Konuşma = iki üyenin `messages` satırları (iki yön).
 *
 * Gönderim ADR K1 A ilkeli TEK SQL: engel, hız ve izin koşulları INSERT'in WHERE'inde; sayım
 * tabanlı frenler (30 sn penceresi, günde 20 yeni konuşma) paralel isteklerde aynı anlık görüntüyü
 * görmesin diye gönderen başına danışma kilidiyle aynı HTTP transaction'ında (K1.5 deseni).
 * Puan üretmez; `notifications`'a yazılmaz (okunmamış sayısı BildirimZili'nde ayrı sayılır).
 */
import { and, desc, eq, gt, inArray, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import {
  DM_GUNLUK_YENI_KONUSMA,
  DM_PENCERE_LIMIT,
  DM_PENCERE_SN,
  DM_YANITSIZ_SINIR,
  dmKarar,
  dmPolitikasiMi,
  type DmDurum,
  type DmKarar,
} from "./economy.ts";
import { SV4_PUAN } from "./levels.ts";
import { govdeGecerliMi, govdeTemizle } from "./mesaj-kural.ts";
import { gunBaslangici, satirlar } from "./rewards.ts";

export type Mesaj = typeof schema.messages.$inferSelect;

/** Gönderen başına danışma kilidi sınıfı (iki anahtarlı: etkinlik 31, puan tek anahtarlı — çakışmaz) */
const KILIT_MESAJ = 41;

/* ---- SQL parçaları: gönderim INSERT'i ile mesajDurumu AYNI parçalardan kurulur (tek gerçek) ---- */

/** İki yönlü engel: a b'yi ya da b a'yı engellemiş */
export const engelSql = (a: number | SQL, b: number | SQL): SQL =>
  sql`exists (select 1 from blocks bl where (bl.blocker_id = ${a} and bl.blocked_id = ${b}) or (bl.blocker_id = ${b} and bl.blocked_id = ${a}))`;
const yazmisSql = (kimden: number, kime: number): SQL =>
  sql`exists (select 1 from messages mm where mm.sender_id = ${kimden} and mm.recipient_id = ${kime})`;
/** kimden → kime toplam mesaj (alıcı yanıtlamadıysa "yanıtsız" tavanına sayılır) */
const gonderilenSql = (kimden: number, kime: number): SQL =>
  sql`(select count(*) from messages mg where mg.sender_id = ${kimden} and mg.recipient_id = ${kime})`;
/** serial/int4 üst sınırı: aşan değer Postgres'te "out of range" hatası (500) üretir */
export const INT4_AZAMI = 2_147_483_647;
export const idMi = (n: number): boolean => Number.isSafeInteger(n) && n > 0 && n <= INT4_AZAMI;
/**
 * Bağ: ortak ONAYLI topluluk (pending/arşivli sayılmaz) ya da karşılıklı takip.
 * shortcut: club_members'ta user_id öncelikli index yok (küçük tablo), üye sayısı büyüyünce eklenir.
 */
const bagSql = (a: number, b: number): SQL => sql`(
  exists (select 1 from club_members x join club_members y on y.club_id = x.club_id
          join clubs cl on cl.id = x.club_id
          where x.user_id = ${a} and y.user_id = ${b} and cl.status = 'approved')
  or (exists (select 1 from follows f where f.follower_id = ${a} and f.followed_id = ${b})
      and exists (select 1 from follows f where f.follower_id = ${b} and f.followed_id = ${a})))`;
const sv4Sql = (u: number): SQL =>
  sql`((select coalesce(sum(pl.delta), 0) from points_ledger pl where pl.user_id = ${u} and pl.delta > 0) >= ${SV4_PUAN})`;
const pencereSql = (u: number): SQL =>
  sql`(select count(*) from messages mp where mp.sender_id = ${u}
       and mp.created_at > now() - ${DM_PENCERE_SN}::int * interval '1 second')`;
/** Bugün (TR günü) u'nun BAŞLATTIĞI konuşmalar: ilk mesajı u atmış ve o mesaj bugün */
const yeniKonusmaSql = (u: number, gun: Date): SQL => sql`(
  select count(*) from (select recipient_id, min(created_at) as ilk from messages where sender_id = ${u} group by recipient_id) bk
  where bk.ilk >= ${gun.toISOString()}::timestamp
    and not exists (select 1 from messages mo where mo.sender_id = bk.recipient_id and mo.recipient_id = ${u} and mo.created_at < bk.ilk))`;

/** Gönderen → alıcı çifti için karar girdileri — tek sorgu (yalnız gösterim/ret gerekçesi için) */
export async function mesajDurumu(gonderenId: number, aliciId: number): Promise<DmDurum> {
  const [r] = satirlar<{
    engel: boolean;
    karsi: boolean;
    ben: boolean;
    bag: boolean;
    sv4: boolean;
    politika: string | null;
    pencere: number;
    yeni: number;
    aliciya: number;
  }>(
    await db.execute(sql`
      select ${engelSql(gonderenId, aliciId)} as engel,
             ${yazmisSql(aliciId, gonderenId)} as karsi,
             ${yazmisSql(gonderenId, aliciId)} as ben,
             ${bagSql(gonderenId, aliciId)} as bag,
             ${sv4Sql(gonderenId)} as sv4,
             (select coalesce(u.dm_policy, 'mutual') from users u where u.id = ${aliciId}) as politika,
             ${pencereSql(gonderenId)}::int as pencere,
             ${yeniKonusmaSql(gonderenId, gunBaslangici())}::int as yeni,
             ${gonderilenSql(gonderenId, aliciId)}::int as aliciya`),
  );
  return {
    kendisi: gonderenId === aliciId,
    engel: !!r?.engel,
    karsiYazmis: !!r?.karsi,
    benYazmis: !!r?.ben,
    bag: !!r?.bag,
    sv4: !!r?.sv4,
    // Alıcı yoksa (alt sorgu NULL) kimse yazamaz; beyaz liste dışı değer gönderim SQL'indeki
    // CASE'in else dalıyla AYNI yorumlanır (mutual) — iki karar ayrışmasın
    politika: !r?.politika ? "nobody" : dmPolitikasiMi(r.politika) ? r.politika : "mutual",
    penceredeGonderilen: Number(r?.pencere ?? 0),
    bugunYeniKonusma: Number(r?.yeni ?? 0),
    aliciyaGonderilen: Number(r?.aliciya ?? 0),
  };
}

export type GonderimSonucu = { durum: "ok"; id: number } | { durum: Exclude<DmKarar, "ok"> | "bos" };

/**
 * Mesaj gönder. Satır döndüyse yazıldı; dönmediyse gerekçe `dmKarar(mesajDurumu())` ile okunur
 * (yazma kararı DEĞİL — o yalnız aşağıdaki WHERE'dedir; dmKarar bunun saf eşleniğidir).
 */
export async function mesajGonder(gonderenId: number, aliciId: number, govde: string): Promise<GonderimSonucu> {
  const temiz = govdeTemizle(govde);
  if (!govdeGecerliMi(temiz)) return { durum: "bos" };
  const g = gonderenId;
  const a = aliciId;
  const [, sonuc] = await db.batch([
    db.execute(sql`select pg_advisory_xact_lock(${KILIT_MESAJ}::int, ${g}::int)`),
    db.execute(sql`
      insert into messages (sender_id, recipient_id, body)
      select ${g}::int, u.id, ${temiz}::text
      from users u
      where u.id = ${a} and u.id <> ${g}
        and not ${engelSql(g, a)}
        and ${pencereSql(g)} < ${DM_PENCERE_LIMIT}
        and (${yazmisSql(a, g)}
             or ((case coalesce(u.dm_policy, 'mutual')
                    when 'nobody' then false
                    when 'everyone' then (${bagSql(g, a)} or ${sv4Sql(g)})
                    else ${bagSql(g, a)} end)
                 and (${yazmisSql(g, a)} or ${yeniKonusmaSql(g, gunBaslangici())} < ${DM_GUNLUK_YENI_KONUSMA})
                 and ${gonderilenSql(g, a)} < ${DM_YANITSIZ_SINIR}))
      returning id`),
  ]);
  const id = Number(satirlar<{ id: number }>(sonuc)[0]?.id ?? 0);
  if (id) return { durum: "ok", id };
  const karar = dmKarar(await mesajDurumu(g, a));
  // Yazılamadı ama durum şimdi uygun görünüyorsa pencere az önce açılmıştır: yeniden denesin
  return { durum: karar === "ok" ? "hiz" : karar };
}

export const KONUSMA_SAYFASI = 100;

/**
 * İki üye arasındaki mesajlar, eskiden yeniye (en yeni `limit` adet). sonraId: yalnız ondan
 * yeniler (yoklama); onceId: yalnız ondan eskiler ("daha eski mesajlar" sayfası).
 */
export async function konusma(
  benId: number,
  kisiId: number,
  o: { sonraId?: number; onceId?: number; limit?: number } = {},
): Promise<Mesaj[]> {
  const m = schema.messages;
  const rows = await db
    .select()
    .from(m)
    .where(
      and(
        or(and(eq(m.senderId, benId), eq(m.recipientId, kisiId)), and(eq(m.senderId, kisiId), eq(m.recipientId, benId))),
        o.sonraId ? gt(m.id, o.sonraId) : undefined,
        o.onceId ? lt(m.id, o.onceId) : undefined,
      ),
    )
    .orderBy(desc(m.id))
    .limit(o.limit ?? KONUSMA_SAYFASI);
  return rows.reverse();
}

export type KonusmaOzeti = { kisiId: number; son: Mesaj; okunmamis: number };

/** Gelen kutusu: konuşma başına son mesaj + okunmamış sayısı, en yeni üstte */
export async function gelenKutusu(benId: number, limit = 100): Promise<KonusmaOzeti[]> {
  const sonlar = satirlar<{ id: number }>(
    await db.execute(sql`
      select max(id) as id from messages
      where sender_id = ${benId} or recipient_id = ${benId}
      group by case when sender_id = ${benId} then recipient_id else sender_id end
      order by 1 desc limit ${limit}`),
  ).map((r) => Number(r.id));
  if (sonlar.length === 0) return [];
  const m = schema.messages;
  const [mesajlar, okunmamislar] = await Promise.all([
    db.select().from(m).where(inArray(m.id, sonlar)).orderBy(desc(m.id)),
    db
      .select({ kisiId: m.senderId, n: sql<number>`count(*)` })
      .from(m)
      .where(okunmamisKosulu(benId))
      .groupBy(m.senderId),
  ]);
  const okunmamis = new Map(okunmamislar.map((r) => [r.kisiId, Number(r.n)]));
  return mesajlar.map((son) => {
    const kisiId = son.senderId === benId ? son.recipientId : son.senderId;
    return { kisiId, son, okunmamis: okunmamis.get(kisiId) ?? 0 };
  });
}

/**
 * Okunmamış sayılan mesajlar: bana gelmiş, okunmamış ve göndereniyle aramda ENGEL YOK. Engelli
 * kişinin eski okunmamışları rozeti şişirmez (temizlemek için tacizcinin konuşmasını açıp ona
 * "Görüldü" göstermek gerekmesin).
 */
const okunmamisKosulu = (benId: number) => {
  const m = schema.messages;
  return and(eq(m.recipientId, benId), isNull(m.readAt), sql`not ${engelSql(benId, sql`${m.senderId}`)}`);
};

/**
 * Bu kişiden gelenleri okundu yaz (yalnız POST'tan çağrılır: GET durum değiştirmez). Yazılan satır
 * sayısı. sonId: sayfada gösterilen en yeni mesaj — görülmemiş (sonradan gelen) mesaj okundu olmasın.
 * Arada engel varsa yazılmaz ("Görüldü" engellenen kişiye sinyal olmasın).
 */
export async function okunduYaz(benId: number, kisiId: number, sonId?: number): Promise<number> {
  const m = schema.messages;
  const rows = await db
    .update(m)
    .set({ readAt: new Date() })
    .where(and(okunmamisKosulu(benId), eq(m.senderId, kisiId), sonId ? lte(m.id, sonId) : undefined))
    .returning({ id: m.id });
  return rows.length;
}

/** Okunmamış mesaj toplamı (BildirimZili; messages_recipient_read_idx) */
export async function okunmamisMesaj(benId: number): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.messages)
    .where(okunmamisKosulu(benId));
  return Number(r?.n ?? 0);
}

/* ---------------- Engel (F4-04) ---------------- */

export async function engelle(benId: number, kisiId: number): Promise<void> {
  if (benId === kisiId) return;
  await db.insert(schema.blocks).values({ blockerId: benId, blockedId: kisiId }).onConflictDoNothing();
}

export async function engelKaldir(benId: number, kisiId: number): Promise<void> {
  await db
    .delete(schema.blocks)
    .where(and(eq(schema.blocks.blockerId, benId), eq(schema.blocks.blockedId, kisiId)));
}

/** benim: ben onu engelledim (kaldırabilirim) · karsi: o beni engelledi (bana gösterilmez, yalnız etkisi) */
export async function engelDurumu(benId: number, kisiId: number): Promise<{ benim: boolean; karsi: boolean }> {
  const b = schema.blocks;
  const rows = await db
    .select({ blockerId: b.blockerId })
    .from(b)
    .where(or(and(eq(b.blockerId, benId), eq(b.blockedId, kisiId)), and(eq(b.blockerId, kisiId), eq(b.blockedId, benId))));
  return { benim: rows.some((r) => r.blockerId === benId), karsi: rows.some((r) => r.blockerId === kisiId) };
}
