import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.ts";

type Db = ReturnType<typeof create>;

function create() {
  // process.env ÖNCE: import.meta.env build anında literal olarak gömülür;
  // önce ona bakılırsa panelde env değiştirmek/sır rotasyonu redeploy'suz
  // etkisiz kalır ve eski parola derlenmiş çıktıda yaşamaya devam eder.
  const url = process.env.POSTGRES_URL ?? import.meta.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL tanımlı değil (vercel env pull).");
  return drizzle(neon(url), { schema });
}

// Tembel başlatma: env kontrolü İLK SORGUDA yapılır — böylece saf
// fonksiyonları (permissions, levels…) import eden birim testleri
// veritabanı bağlantısı gerektirmez.
let _db: Db | undefined;
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    _db ??= create();
    return Reflect.get(_db, prop as keyof Db);
  },
});

export { schema };
