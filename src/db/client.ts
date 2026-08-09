import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.ts";

type Db = ReturnType<typeof create>;

function create() {
  const url = import.meta.env.POSTGRES_URL ?? process.env.POSTGRES_URL;
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
