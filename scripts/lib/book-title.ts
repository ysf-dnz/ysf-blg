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

const NOISE_PARENS =
  /\((z-?library|annas.?archive|libgen|safefile[^)]*|meap[^)]*)\)/gi;
const YEAR_PARENS = /\((19|20)\d{2}\)/g;
const COPY_SUFFIX = /\s*\(\d\)\s*$/; // "Ad (1).pdf" kopya numarası
const TRAILING_TIMESTAMP = /_\d{6}_\d{6}$/;

export function parseBookFileName(fileName: string): BookTitle {
  // uzantı, kopya numarası ve zaman damgası ekleri
  let name = fileName
    .replace(/\.(pdf|epub)$/i, "")
    .replace(COPY_SUFFIX, "")
    .trim();

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
  // kalan alt çizgiler her durumda boşluk olur ("YZ_Senin_Yardımcı_Pilotun (1)")
  name = name.replace(/_+/g, " ");

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
 * Kopya tespiti anahtarı: baskı/sürüm gürültüsü (meap, v08, edition eki
 * DEĞİL — yalnızca yayın süreci gürültüsü) atılarak aynı kitabın
 * varyantları tek anahtara iner.
 */
const DEDUPE_NOISE = new Set(["meap", "final", "version", "release"]);

export function dedupeKey(title: string): string {
  return normalizeForMatch(title)
    .split(" ")
    .filter((w) => !DEDUPE_NOISE.has(w) && !/^v\d+$/.test(w))
    .join(" ");
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
