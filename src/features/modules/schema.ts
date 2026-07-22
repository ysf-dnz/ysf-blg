/**
 * Modüler pencere sistemi: admin panelinden eklenip sürüklenerek sıralanan
 * içerik blokları. Aynı şema üç yerde kullanılır: proje detayları,
 * kitap ek pencereleri (bookExtras) ve ana sayfa singleton'ı.
 */
import { z } from "astro:content";

/**
 * Keystatic blocks alanı her öğeyi { discriminant, value } olarak yazar;
 * elle yazılmış YAML ise düz { tip, ... } kullanabilir. İkisini de kabul edip
 * normalize ederiz; Keystatic'in boş string bıraktığı opsiyonel alanlar
 * silinir ki .optional()/.default() doğru çalışsın.
 */
function normalize(m: unknown): unknown {
  if (!m || typeof m !== "object") return m;
  let obj = m as Record<string, unknown>;
  if ("discriminant" in obj) {
    obj = {
      tip: obj.discriminant,
      ...((obj.value as Record<string, unknown>) ?? {}),
    };
  }
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== "" && v !== null),
  );
}

const modulUnion = z.preprocess(
  normalize,
  z.discriminatedUnion("tip", [
      z.object({
        tip: z.literal("halka"),
        baslik: z.string(),
        // public/ altına yazılan görsel yolu ya da tam URL
        kapak: z.string(),
        ringColor: z.string().optional(),
        hedefUrl: z.string(),
        hedefTip: z
          .enum(["internal", "medium", "youtube", "instagram", "external"])
          .default("external"),
      }),
      z.object({
        tip: z.literal("drivePdf"),
        baslik: z.string().optional(),
        dosyaId: z.string(),
      }),
      z.object({
        tip: z.literal("driveJpeg"),
        baslik: z.string().optional(),
        dosyaId: z.string(),
        genislik: z.number().int().positive().default(1600),
      }),
      z.object({
        tip: z.literal("youtube"),
        baslik: z.string().optional(),
        url: z.string(),
      }),
      z.object({
        tip: z.literal("spotify"),
        baslik: z.string().optional(),
        url: z.string(),
      }),
  ]),
);

export const modulSchema = z.array(modulUnion).default([]);

export type Modul = z.infer<typeof modulSchema>[number];
