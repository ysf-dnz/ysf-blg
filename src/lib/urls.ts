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

export const KUTUPHANEM_URL = "https://ysf-dnz.github.io/kutuphanem";

/**
 * Form'daki `next` yalnız site içi bir yol ise onu, değilse varsayılanı döner
 * (open redirect yok: `//`, `/\` ve kontrol karakterleri reddedilir).
 */
export function guvenliYol(form: FormData, varsayilan: string): string {
  const n = String(form.get("next") ?? "");
  return /^\/(?![\/\\])/.test(n) && !/[\\\x00-\x1f]/.test(n) ? n : varsayilan;
}
