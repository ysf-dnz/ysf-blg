/**
 * Mesaj gövdesi kuralları — SAF (DB yok): hem sunucu render'ı hem konuşma sayfasının istemci
 * betiği kullanır. Gövde DÜZ METİNDİR (markdown yok); tek zenginlik `https://` adreslerinin
 * bağlantıya çevrilmesidir. Parçalar metin olarak döner: çağıran Astro kaçışı / textContent ile
 * basar, innerHTML KULLANILMAZ (AC-24: `javascript:` bağlantısı tıklanamaz düz metin kalır).
 */
import { DM_AZAMI_UZUNLUK } from "./economy.ts";

/**
 * Satır sonlarını tekilleştirir; kontrol karakterlerini (\n ve \t dışında) ve bidi yön
 * değiştiricileri (U+202A–202E, U+2066–2069: adresi ters gösterip taklit eder) atar; kırpar.
 * ZWJ (emoji birleştirici) korunur.
 */
export function govdeTemizle(ham: string | null | undefined): string {
  return String(ham ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\P{Cc}\n\t]|[\u202A-\u202E\u2066-\u2069]/gu, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Gönderilebilir gövde mi (temizlenmiş hâliyle 1–1000 karakter) */
export function govdeGecerliMi(temiz: string): boolean {
  return temiz.length > 0 && temiz.length <= DM_AZAMI_UZUNLUK;
}

export type MesajParcasi = { tur: "metin" | "link"; deger: string };

const HTTPS = /https:\/\/[^\s<>"'`]+/g;
/** Adresin sonuna yapışan noktalama cümleye aittir ("…bak https://x.com." → nokta bağlantıda değil) */
const SON_NOKTALAMA = /[.,;:!?)\]}'"»]+$/;

/** Gövdeyi metin ve `https://` bağlantı parçalarına böler; başka hiçbir şema bağlantı olmaz */
export function metniParcala(govde: string): MesajParcasi[] {
  const parcalar: MesajParcasi[] = [];
  let son = 0;
  const metinEkle = (s: string) => {
    if (!s) return;
    const onceki = parcalar.at(-1);
    if (onceki?.tur === "metin") onceki.deger += s;
    else parcalar.push({ tur: "metin", deger: s });
  };
  for (const m of govde.matchAll(HTTPS)) {
    const ham = m[0];
    const adres = ham.replace(SON_NOKTALAMA, "");
    metinEkle(govde.slice(son, m.index));
    if (adres.length > "https://".length && URL.canParse(adres)) {
      parcalar.push({ tur: "link", deger: adres });
      metinEkle(ham.slice(adres.length));
    } else metinEkle(ham);
    son = m.index + ham.length;
  }
  metinEkle(govde.slice(son));
  return parcalar;
}

const zamanBicimi = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
/** "12 Eki 14:05" — TR saati (Vercel UTC'de koşar) */
export const mesajZamani = (d: Date): string => zamanBicimi.format(d);

/** Mesajın gönderilememe gerekçesi (form yerine ve hata bandında aynı metin) */
export type RetDurumu = "kendin" | "engel" | "hiz" | "kapali" | "bag" | "gunluk" | "bos";
export function retMetni(
  durum: RetDurumu,
  o: { ad: string; politika: "everyone" | "mutual" | "nobody"; benEngelledim: boolean },
): string {
  switch (durum) {
    case "hiz":
      return "Çok hızlısın — birkaç saniye sonra yeniden dene.";
    case "bos":
      return `Mesaj boş olamaz ve en çok ${DM_AZAMI_UZUNLUK} karakter olabilir.`;
    case "gunluk":
      return "Bugün başlatabileceğin yeni konuşma sayısı doldu; süren konuşmalarına yazabilirsin, yenisi için yarını bekle.";
    case "bag":
      return o.politika === "everyone"
        ? `${o.ad} ile ortak topluluğun ya da karşılıklı takibin yok; bağın olmayan birine yazmak için Seviye 4 gerekir.`
        : `${o.ad} yalnız ortak topluluğu olan ya da karşılıklı takipleştiği üyelerden mesaj alıyor.`;
    case "engel":
      // Karşı tarafın engeli söylenmez: "mesaj almıyor" ile aynı metin
      return o.benEngelledim ? "Bu üyeyi engelledin. Mesaj göndermek için engeli kaldır." : `${o.ad} şu an yeni mesaj almıyor.`;
    case "kendin":
      return "Kendine mesaj gönderemezsin.";
    default:
      return `${o.ad} şu an yeni mesaj almıyor.`;
  }
}
