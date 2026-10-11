/** site config'ine göre mutlak URL üretir. */
export function absoluteUrl(path: string, site: URL | string): string {
  return new URL(path, site).toString();
}

/**
 * Kullanıcıya gösterilecek/paylaşılacak linklerin kökü.
 * SITE config'i (SITE_URL env) request origin'ine TERCİH edilir: proxy/CDN
 * arkasında request origin'i iç host'a düşebilir (Vercel'de "localhost"
 * olarak sızdığı görüldü — davet kartları localhost linkiyle üretilmişti).
 */
export function siteKok(site: URL | undefined, requestUrl: URL): string {
  return (site ?? requestUrl).origin;
}

/**
 * Üst düzey belge gezintisi mi? Davet çerezi yalnız böyle isteklerde kurulur: aynı kökenli
 * <img>/prefetch/fetch gibi alt kaynak istekleri çerezi kuramaz (atıf hırsızlığı). Başlığı
 * göndermeyen eski tarayıcı geçer (karsilama.ts ile aynı kural).
 */
export function belgeGezintisiMi(request: Request): boolean {
  const dest = request.headers.get("sec-fetch-dest");
  return !dest || dest === "document";
}

/**
 * GET ile durum değiştiren ESKİ akış (kurs ?katil=1, ADR K3.4) için fren: başka siteden gelen,
 * alt kaynak olarak yüklenen (<img>, iframe, script…) ve prefetch olarak işaretlenmiş istekler
 * yazamaz. "empty" (ClientRouter gezintisi — Clerk girişten böyle döner) ve "document" geçer.
 * shortcut: işaretsiz fetch-prefetch (Safari'de bağlantının üzerine gelmek) ve uygulamadan açılan
 * bağlantı hâlâ yazar; kalıcı çözüm GET'te hiç yazmamaktır (etkinlikte öyle; kurs için PROGRESS.md
 * "FABLE'A DEVİR").
 */
export function getIleYazilabilirMi(request: Request): boolean {
  const h = request.headers;
  const dest = h.get("sec-fetch-dest");
  if (h.get("sec-fetch-site") === "cross-site") return false;
  if (dest && dest !== "document" && dest !== "empty") return false;
  return !/prefetch|prerender/i.test(`${h.get("sec-purpose") ?? ""} ${h.get("purpose") ?? ""} ${h.get("x-moz") ?? ""}`);
}

export const KUTUPHANEM_URL = "https://ysf-dnz.github.io/kutuphanem";

/**
 * Form'daki `next` yalnız site içi bir yol ise onu, değilse varsayılanı döner
 * (open redirect yok: `//`, `/\` ve kontrol karakterleri reddedilir).
 */
export function guvenliYol(form: FormData, varsayilan: string): string {
  const n = String(form.get("next") ?? "");
  return /^\/(?![\/\\])/.test(n) && !/[\\\x00-\x1f]/.test(n) ? n : varsayilan;
}
