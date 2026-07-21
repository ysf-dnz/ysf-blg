/**
 * MDX/markdown ham metninden tahmini okuma süresi (dakika) hesaplar.
 * Kod blokları ve frontmatter kelime sayımına dahil edilmez; kod blokları
 * için satır başına sabit ek süre eklenir.
 */
const WORDS_PER_MINUTE = 200;
const SECONDS_PER_CODE_LINE = 2;

export function readingTimeMinutes(raw: string): number {
  let text = raw.replace(/^---[\s\S]*?---/, "");

  let codeLines = 0;
  text = text.replace(/```[\s\S]*?```/g, (block) => {
    codeLines += Math.max(block.split("\n").length - 2, 0);
    return " ";
  });

  // MDX import/export satırları ve JSX etiketleri okunmaz
  text = text
    .replace(/^(import|export)\s.*$/gm, " ")
    .replace(/<[^>]+>/g, " ");

  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const minutes = words / WORDS_PER_MINUTE + (codeLines * SECONDS_PER_CODE_LINE) / 60;
  return Math.max(1, Math.round(minutes));
}
