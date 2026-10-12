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
 * Kullanıcının KENDİ başlattığı üst düzey gezinti mi (adres çubuğu, yer imi, kamerayla QR okutma,
 * uygulamadan açılan bağlantı): sec-fetch-site "none". Bir web sayfasındaki bağlantıya tıklamak
 * (aynı site ya da başka site) DEĞİLDİR. Dönen QR sayfası formu yalnız böyle gezintide kendiliğinden
 * gönderir; aksi hâlde kullanıcı düğmeye dokunur. Başlığı göndermeyen eski tarayıcı geçer.
 */
export function kullaniciGezintisiMi(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  return belgeGezintisiMi(request) && (!site || site === "none");
}

/**
 * Site içi yola sorgu parametresi ekler (hash korunur). BİLİNÇLİ olarak dize işlemidir: yolu
 * `new URL()` ile ayrıştırıp `pathname`'i yeniden yazmak nokta-segmentleri çözer —
 * `/.//kotu.example` → `//kotu.example` olur ve Location'da BAŞKA SİTEYE yönlendirir (guvenliYol'un
 * süzdüğü şey geri gelir). Ham yol tarayıcıda site içinde kalır.
 */
export function yolaParametreEkle(yol: string, ad: string, deger: string): string {
  const kare = yol.indexOf("#");
  const govde = kare === -1 ? yol : yol.slice(0, kare);
  const hash = kare === -1 ? "" : yol.slice(kare);
  return `${govde}${govde.includes("?") ? "&" : "?"}${ad}=${encodeURIComponent(deger)}${hash}`;
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
