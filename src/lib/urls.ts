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
