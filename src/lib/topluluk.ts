/**
 * Topluluk (kulüp) türleri ve il listesi — etiketlerin, form seçeneklerinin ve API
 * beyaz listesinin tek kaynağı. `clubs.kind` DB'de düz text: koruma burada.
 */
import iller from "@/data/il-koordinatlari.json";
import type * as schema from "@/db/schema.ts";

export type KulupTuru = (typeof schema.clubs.$inferSelect)["kind"];

export const KULUP_TUR: Record<KulupTuru, string> = {
  universite: "🎓 Üniversite",
  lise: "🏫 Lise",
  sehir: "🏙️ Şehir",
  vakif: "🤝 Vakıf",
  dernek: "🌱 Dernek",
  kurum: "🏢 Kurum",
};

export const kulupTuruMu = (s: string): s is KulupTuru => Object.hasOwn(KULUP_TUR, s);
/** Bilinmeyen (beyaz liste öncesi yazılmış) değerde ham metne düşer */
export const turEtiketi = (s: string): string => (KULUP_TUR as Record<string, string>)[s] ?? s;

// Türkçe küçültme + ı→i katlama: "Istanbul"/"IZMIR" (ASCII klavye) de "İstanbul"/"İzmir" ile eşleşir
const normalize = (s: string) => s.trim().toLocaleLowerCase("tr").replace(/ı/g, "i");
/** 81 il, Türkçe alfabetik (JSON plaka sırasında) */
export const ILLER: string[] = Object.keys(iller).sort((a, b) => a.localeCompare(b, "tr"));
const IL_HARITA = new Map(ILLER.map((il) => [normalize(il), il]));

/** Serbest yazılmış ili ("ankara ", "ANKARA") listedeki kanonik ada çevirir; listede yoksa null */
export function ilBul(girdi: string | null | undefined): string | null {
  return IL_HARITA.get(normalize(String(girdi ?? ""))) ?? null;
}
