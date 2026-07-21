/**
 * Drive dosya adından temiz kitap başlığı + yazar çıkarımı.
 * Örnekler:
 *  "Designing Interfaces ... (Jenifer Tidwell, Charles Brewer) (Z-Library).pdf"
 *    → { title: "Designing Interfaces ...", author: "Jenifer Tidwell, Charles Brewer" }
 *  "(by-Brian-Allbee)-Hands-On-Software-Engineering-wi_230516_080832.pdf"
 *    → { title: "Hands On Software Engineering Wi", author: "Brian Allbee" }
 *  "AI-Powered Developer (2023).pdf" → { title: "AI-Powered Developer" }
 */
export interface BookTitle {
  title: string;
  author?: string;
}

const NOISE_PARENS = /\((z-?library|annas.?archive|libgen)[^)]*\)/gi;
const YEAR_PARENS = /\((19|20)\d{2}\)/g;
const TRAILING_TIMESTAMP = /_\d{6}_\d{6}$/;

export function parseBookFileName(fileName: string): BookTitle {
  // uzantıyı at
  let name = fileName.replace(/\.(pdf|epub)$/i, "").trim();

  let author: string | undefined;

  // "(by-Yazar-Adı)-Başlık" kalıbı
  const byMatch = name.match(/^\(by[-_ ]([^)]+)\)[-_ ]*(.+)$/i);
  if (byMatch) {
    author = byMatch[1]!.replace(/[-_]+/g, " ").trim();
    name = byMatch[2]!;
  }

  // gürültü parantezleri ve yıl
  name = name.replace(NOISE_PARENS, " ").replace(YEAR_PARENS, " ");

  // sondaki "(Yazar, Yazar)" kalıbı — harfle başlayan, rakamsız içerik
  if (!author) {
    const authorMatch = name.match(/\(([^()]*[A-Za-zÇĞİÖŞÜçğıöşü][^()]*)\)\s*$/);
    if (authorMatch && !/\d/.test(authorMatch[1]!)) {
      author = authorMatch[1]!.trim();
      name = name.slice(0, authorMatch.index).trim();
    }
  }

  // "Yazar - Başlık" kalıbı (tek tire, iki tarafı da dolu, başlık tarafı uzun)
  if (!author) {
    const dashMatch = name.match(/^([^-]{3,40})\s-\s(.{6,})$/);
    if (dashMatch && !/\d/.test(dashMatch[1]!)) {
      author = dashMatch[1]!.trim();
      name = dashMatch[2]!.trim();
    }
  }

  // zaman damgası eki ve tire/altçizgi doldurmaları
  name = name.replace(TRAILING_TIMESTAMP, "");
  if (!name.includes(" ") && /[-_]/.test(name)) {
    // boşluksuz tamamen tireli adlar: tireleri boşluğa çevir, kelime başlarını büyüt
    name = name
      .replace(/[-_]+/g, " ")
      .trim()
      .replace(/\b\p{L}/gu, (ch) => ch.toLocaleUpperCase("tr"));
  }

  name = name.replace(/\s{2,}/g, " ").replace(/[-_\s]+$/g, "").trim();

  return { title: name, author };
}

/** Fuzzy eşleştirme için ad normalizasyonu (TR karakter + noktalama sadeleşir). */
export function normalizeForMatch(input: string): string {
  return input
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (ch) =>
      ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[ch] ?? ch,
    )
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Basit token örtüşme skoru (0-1): kitap adı ile defter adı arasındaki
 * ortak kelime oranı. Eşik çağıran tarafta uygulanır.
 */
export function titleMatchScore(a: string, b: string): number {
  const ta = new Set(normalizeForMatch(a).split(" ").filter((w) => w.length > 2));
  const tb = new Set(normalizeForMatch(b).split(" ").filter((w) => w.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const w of ta) if (tb.has(w)) common++;
  return common / Math.min(ta.size, tb.size);
}
