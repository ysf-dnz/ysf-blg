/**
 * Şikâyet kaydı (F1-10, F4-04). Saatte 10 freni ve yazım TEK transaction'da, şikâyetçi başına
 * danışma kilidiyle (ADR K1.5 deseni): eski "önce say, sonra yaz" paralel isteklerde freni aşıyordu
 * ve üye hedefiyle hedef uzayı tüm üye rehberine genişledi (admin kuyruğu tek hesaptan doldurulamasın).
 */
import { sql } from "drizzle-orm";
import { db } from "@/db/client.ts";
import { satirlar } from "./rewards.ts";

export const SIKAYET_TURLERI = ["course", "comment", "user", "message"] as const;
export type SikayetTuru = (typeof SIKAYET_TURLERI)[number];
export const sikayetTuruMu = (s: string): s is SikayetTuru => (SIKAYET_TURLERI as readonly string[]).includes(s);

/** Şikâyetçi başına saatlik sınır (tüm hedef türleri ortak) */
export const SIKAYET_SAATLIK = 10;
const KILIT_SIKAYET = 42;

/**
 * yazildi: yeni kayıt ya da KAPANMIŞ üye/mesaj şikâyeti yeniden açıldı · vardi: aynı hedef için açık
 * (ya da kurs/yorumda kapanmış) kaydı zaten var · hiz: saatlik sınır dolu.
 * `reports_idx` durumdan bağımsız tekil: admin kapattıktan sonra süren taciz yeniden bildirilebilsin
 * diye üye/mesajda kapanmış kayıt yeniden açılır. Kurs/yorumda AÇILMAZ: adminin geri açtığı içerik
 * aynı şikâyetçilerle yeniden gizlenirdi.
 */
export async function sikayetKaydet(
  reporterId: number,
  targetType: SikayetTuru,
  targetId: number,
  reason: string | null,
): Promise<"yazildi" | "vardi" | "hiz"> {
  const sonSaat = sql`(select count(*) from reports rs where rs.reporter_id = ${reporterId}
                       and rs.created_at > now() - interval '1 hour')`;
  const [, sonuc, sayim] = await db.batch([
    db.execute(sql`select pg_advisory_xact_lock(${KILIT_SIKAYET}::int, ${reporterId}::int)`),
    db.execute(sql`
      insert into reports (reporter_id, target_type, target_id, reason)
      select ${reporterId}::int, ${targetType}::text, ${targetId}::int, ${reason}::text
      where ${sonSaat} < ${SIKAYET_SAATLIK}
      on conflict (reporter_id, target_type, target_id) do update
        set status = 'open', reason = excluded.reason, created_at = now()
        where reports.status <> 'open' and reports.target_type in ('user', 'message')
      returning id`),
    db.execute(sql`select ${sonSaat}::int as n`),
  ]);
  if (satirlar(sonuc).length > 0) return "yazildi";
  return Number(satirlar<{ n: number }>(sayim)[0]?.n ?? 0) >= SIKAYET_SAATLIK ? "hiz" : "vardi";
}
