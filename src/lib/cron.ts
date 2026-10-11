/**
 * Cron idempotency kilidi — cron_runs (job, period_key UNIQUE). Günlük cron ve
 * varlık başına tek-atış işler (ör. etkinlik düzenleyen payı) aynı kilidi kullanır.
 */
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";

/** İş daha önce bu dönem için koştuysa false döner; koşmadıysa kaydeder */
export async function birKez(job: string, periodKey: string): Promise<boolean> {
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
export async function birKezCalistir<T>(
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
