/**
 * Harita verisi (F4-02): il başına ANONİM sayımın yanında, haritada görünmeye açık rıza vermiş
 * üyelerin ızgarası ve ildeki yaklaşan etkinlikler.
 *
 * AC-21 / AC-22'nin tek kapısı `haritaUyeleri`: rıza (map_visible_at) ve iki yönlü engel süzgeci
 * SQL WHERE'inde — sayfa kaynağına (JSON veri bloğu) rızasız ya da engelli üye HİÇ gömülmez.
 * Izgara yalnız girişli üyeye üretilir: misafire gömülseydi engellenen kişi oturumu kapatıp
 * engelleyeni yine görürdü (çağıran bakanId'siz çağıramaz).
 */
import { and, asc, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { etkinlikGorunurSql } from "./etkinlik.ts";
import { trSaat, trTarih, VARSAYILAN_SURE_SAAT } from "./etkinlik-kural.ts";
import { engelSql } from "./mesaj.ts";
import { R } from "./routes.ts";
import { levelFor } from "./levels.ts";
import { satirlar } from "./rewards.ts";
import { getEarnedMap } from "./social.ts";
import { ilBul } from "./topluluk.ts";

/** İstemciye giden üye kartı: handle, ad, avatar (yalnız https), seviye, bakanla ortak topluluk/kurs */
export type HaritaUye = { h: string; ad: string; av: string | null; sv: number; ortak?: string[] };
export type HaritaFiltre = { kulupId?: number; kursId?: number; takip?: boolean };
export type HaritaEtkinlik = { yol: string; ad: string; zaman: string };
export type HaritaIl = { uyeler: HaritaUye[]; toplam: number };

/** İl popup'ında gösterilen üye üst sınırı (en yüksek seviyeliler; gerisi "+N" sayısı) */
export const IL_UYE_SINIRI = 24;
export const IL_ETKINLIK_SINIRI = 3;

/**
 * Gösterilen üyelerin bakanla ORTAK bağları (PRD §4.6 "ortak topluluk ve kurs"): üye başına en çok
 * bir topluluk ve bir kurs adı. Yalnız bakanın KENDİ üyeliklerinden türer — bakanın üyesi olmadığı
 * topluluk/kurs bilgisi sızmaz. İki gruplu sorgu (satır başına sorgu yok).
 */
async function ortakBaglar(bakanId: number, uyeIdleri: number[]): Promise<Map<number, string[]>> {
  const sonuc = new Map<number, string[]>();
  const digerleri = uyeIdleri.filter((id) => id !== bakanId);
  if (digerleri.length === 0) return sonuc;
  const idler = sql.join(digerleri.map((id) => sql`${id}`), sql`, `);
  const [kulupler, kurslar] = await Promise.all([
    db.execute(sql`
      select distinct on (o.user_id) o.user_id as uye, c.name as ad
      from club_members ben join club_members o on o.club_id = ben.club_id
      join clubs c on c.id = ben.club_id
      where ben.user_id = ${bakanId} and c.status = 'approved' and o.user_id in (${idler})
      order by o.user_id, c.name`),
    db.execute(sql`
      select distinct on (o.user_id) o.user_id as uye, k.title as ad
      from course_enrollments ben join course_enrollments o on o.course_id = ben.course_id
      join courses k on k.id = ben.course_id
      where ben.user_id = ${bakanId} and k.status = 'published' and o.user_id in (${idler})
      order by o.user_id, k.title`),
  ]);
  for (const [satir, simge] of [[kulupler, "🏛️"], [kurslar, "🎓"]] as const)
    for (const r of satirlar<{ uye: number; ad: string }>(satir)) {
      const liste = sonuc.get(Number(r.uye)) ?? [];
      liste.push(`${simge} ${r.ad}`);
      sonuc.set(Number(r.uye), liste);
    }
  return sonuc;
}

/**
 * İl → haritada görünen üyeler. Yalnız `map_visible_at` dolu ve ili 81 il listesinde olanlar;
 * bakanla aralarında engel (iki yön) olanlar hariç. Sıra: kazanılan puan (seviye) azalan, sonra
 * üyelik sırası — rıza anına göre DEĞİL (kutuyu kaldırıp işaretleyerek üste çıkılamasın).
 * Filtreler: topluluk üyeleri · kursa katılanlar · bakanın takip ettikleri.
 */
export async function haritaUyeleri(
  bakanId: number,
  f: HaritaFiltre = {},
): Promise<Map<string, HaritaIl>> {
  const u = schema.users;
  const rows = await db
    .select({ id: u.id, handle: u.handle, name: u.name, avatarUrl: u.avatarUrl, city: u.city })
    .from(u)
    .where(
      and(
        isNotNull(u.mapVisibleAt),
        isNotNull(u.city),
        sql`not ${engelSql(bakanId, sql`${u.id}`)}`,
        f.kulupId
          ? sql`exists (select 1 from club_members cm where cm.club_id = ${f.kulupId} and cm.user_id = ${u.id})`
          : undefined,
        f.kursId
          ? sql`exists (select 1 from course_enrollments ce where ce.course_id = ${f.kursId} and ce.user_id = ${u.id})`
          : undefined,
        f.takip
          ? sql`exists (select 1 from follows fo where fo.follower_id = ${bakanId} and fo.followed_id = ${u.id})`
          : undefined,
      ),
    )
    .orderBy(asc(u.id))
    // shortcut: 2000'den çok görünen üyede en yüksek id'liler (en yeni üyeler) puandan bağımsız düşer ve il
    // toplamları eksik sayılır; o ölçekte il başına pencere fonksiyonlu sorguya geçilir
    .limit(2000);

  const kazanilan = await getEarnedMap(rows.map((r) => r.id));
  const puan = (id: number) => kazanilan.get(id) ?? 0;
  const ilGruplari = new Map<string, typeof rows>();
  for (const r of rows) {
    const il = ilBul(r.city);
    if (!il) continue;
    if (!ilGruplari.has(il)) ilGruplari.set(il, []);
    ilGruplari.get(il)!.push(r);
  }
  for (const g of ilGruplari.values()) g.sort((x, y) => puan(y.id) - puan(x.id) || x.id - y.id);
  const gosterilen = [...ilGruplari.values()].flatMap((g) => g.slice(0, IL_UYE_SINIRI));
  const ortak = await ortakBaglar(bakanId, gosterilen.map((r) => r.id));
  return new Map(
    [...ilGruplari].map(([il, g]) => [
      il,
      {
        toplam: g.length,
        uyeler: g.slice(0, IL_UYE_SINIRI).map((r) => ({
          h: r.handle,
          ad: r.name,
          av: r.avatarUrl && /^https:\/\//.test(r.avatarUrl) ? r.avatarUrl : null,
          sv: levelFor(puan(r.id)),
          ...(ortak.has(r.id) ? { ortak: ortak.get(r.id)! } : {}),
        })),
      },
    ]),
  );
}

/**
 * İl → yaklaşan (bitmemiş) herkese açık etkinlikler, en yakın üstte. Çevrimiçi etkinlik haritada yok:
 * il'i boş olabilir ya da topluluk etkinliğinde topluluğun iliyle dolmuştur (yer değil).
 */
export async function haritaEtkinlikleri(simdi: Date = new Date()): Promise<Map<string, HaritaEtkinlik[]>> {
  const e = schema.events;
  const rows = await db
    .select({ id: e.id, slug: e.slug, title: e.title, startsAt: e.startsAt, il: e.il })
    .from(e)
    .where(
      and(
        isNotNull(e.il),
        sql`${e.kind} is distinct from 'cevrimici'`,
        etkinlikGorunurSql,
        sql`coalesce(${e.endsAt}, ${e.startsAt} + ${VARSAYILAN_SURE_SAAT}::int * interval '1 hour') > ${simdi.toISOString()}::timestamp`,
      ),
    )
    .orderBy(asc(e.startsAt))
    .limit(300);
  const sonuc = new Map<string, HaritaEtkinlik[]>();
  for (const r of rows) {
    const il = ilBul(r.il);
    if (!il) continue;
    const liste = sonuc.get(il) ?? [];
    if (liste.length >= IL_ETKINLIK_SINIRI) continue;
    liste.push({ yol: R.etkinlik(r.slug ?? String(r.id)), ad: r.title, zaman: `${trTarih(r.startsAt)} · ${trSaat(r.startsAt)}` });
    sonuc.set(il, liste);
  }
  return sonuc;
}
