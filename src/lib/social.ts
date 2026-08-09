/** Topluluk sorgu yardımcıları — N+1 önleyen toplu sorgular. */
import { inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { levelFor } from "./levels.ts";

export type User = typeof schema.users.$inferSelect;

export async function getUsersMap(ids: number[]): Promise<Map<number, User>> {
  const tekil = [...new Set(ids)];
  if (tekil.length === 0) return new Map();
  const rows = await db.query.users.findMany({
    where: inArray(schema.users.id, tekil),
  });
  return new Map(rows.map((u) => [u.id, u]));
}

/** Kazanılan puanlar (yalnız pozitifler) — TEK grup sorgusu. */
export async function getEarnedMap(ids: number[]): Promise<Map<number, number>> {
  const tekil = [...new Set(ids)];
  if (tekil.length === 0) return new Map();
  const rows = await db
    .select({
      userId: schema.pointsLedger.userId,
      total: sql<number>`sum(case when ${schema.pointsLedger.delta} > 0 then ${schema.pointsLedger.delta} else 0 end)`,
    })
    .from(schema.pointsLedger)
    .where(inArray(schema.pointsLedger.userId, tekil))
    .groupBy(schema.pointsLedger.userId);
  return new Map(rows.map((r) => [r.userId, Number(r.total ?? 0)]));
}

export async function getLevelsMap(ids: number[]): Promise<Map<number, number>> {
  const earned = await getEarnedMap(ids);
  return new Map([...new Set(ids)].map((id) => [id, levelFor(earned.get(id) ?? 0)]));
}
