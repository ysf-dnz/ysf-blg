/**
 * Harita verisi (F4-02): il başına ANONİM sayımın yanında, haritada görünmeye açık rıza vermiş
 * üyelerin ızgarası ve ildeki yaklaşan etkinlikler.
 *
 * AC-21 / AC-22'nin tek kapısı `haritaUyeleri`: rıza (map_visible_at) ve iki yönlü engel süzgeci
 * SQL WHERE'inde — sayfa kaynağına (JSON veri bloğu) rızasız ya da engelli üye HİÇ gömülmez.
 * Izgara yalnız girişli üyeye üretilir: misafire gömülseydi engellenen kişi oturumu kapatıp
 * engelleyeni yine görürdü (çağıran bakanId'siz çağıramaz).
 */
import { and, asc, desc, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { etkinlikGorunurSql } from "./etkinlik.ts";
import { trSaat, trTarih, VARSAYILAN_SURE_SAAT } from "./etkinlik-kural.ts";
import { engelSql } from "./mesaj.ts";
import { R } from "./routes.ts";
import { getLevelsMap } from "./social.ts";
import { ilBul } from "./topluluk.ts";

/** İstemciye giden üye kartı: handle, ad, avatar (yalnız https), seviye */
export type HaritaUye = { h: string; ad: string; av: string | null; sv: number };
export type HaritaFiltre = { kulupId?: number; kursId?: number; takip?: boolean };
export type HaritaEtkinlik = { yol: string; ad: string; zaman: string };
export type HaritaIl = { uyeler: HaritaUye[]; toplam: number };

/** İl popup'ında gösterilen üye üst sınırı (gerisi "+N" sayısı) */
export const IL_UYE_SINIRI = 24;
export const IL_ETKINLIK_SINIRI = 3;

/**
 * İl → haritada görünen üyeler (en yeni rıza üstte). Yalnız `map_visible_at` dolu ve ili
 * 81 il listesinde olanlar; bakanla aralarında engel (iki yön) olanlar hariç.
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
    .orderBy(desc(u.mapVisibleAt))
    .limit(2000); // shortcut: 2000'den çok görünen üyede il toplamları eksik sayılır; o ölçekte il başına sorguya geçilir

  const ilGruplari = new Map<string, typeof rows>();
  for (const r of rows) {
    const il = ilBul(r.city);
    if (!il) continue;
    if (!ilGruplari.has(il)) ilGruplari.set(il, []);
    ilGruplari.get(il)!.push(r);
  }
  const gosterilen = [...ilGruplari.values()].flatMap((g) => g.slice(0, IL_UYE_SINIRI));
  const seviyeler = await getLevelsMap(gosterilen.map((r) => r.id));
  return new Map(
    [...ilGruplari].map(([il, g]) => [
      il,
      {
        toplam: g.length,
        uyeler: g.slice(0, IL_UYE_SINIRI).map((r) => ({
          h: r.handle,
          ad: r.name,
          av: r.avatarUrl && /^https:\/\//.test(r.avatarUrl) ? r.avatarUrl : null,
          sv: seviyeler.get(r.id) ?? 1,
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
