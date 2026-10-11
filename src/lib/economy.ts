/**
 * Ekonomi korumaları — saf fonksiyonlar (birim testli).
 * İlke: kullanıcıyı asla cezalandırma/engelleme; sadece puan musluğunu
 * sessizce kıs. Sosyal sinyaller (beğeni, onay) her zaman çalışır.
 */
import { PUAN } from "./points.ts";

/** Aynı beğenenden aynı yazara GÜNLÜK puanlı beğeni sınırı */
export const GUNLUK_BEGENI_PUAN_SINIRI = 5;

/** Bu beğeni puan üretir mi? (bugunkuPuanliSayi = bu ikili için bugün
 *  daha önce puan üretmiş beğeni sayısı) */
export function likePuaniVerilirMi(bugunkuPuanliSayi: number): boolean {
  return bugunkuPuanliSayi < GUNLUK_BEGENI_PUAN_SINIRI;
}

/** Kulüp başına haftalık görev ödülü bütçesi */
export const KULUP_HAFTALIK_TAVAN = 1000;

/** Görev ödülünü kalan haftalık bütçeye kırp (0'a inebilir). */
export function gorevOdulKirp(
  istenen: number,
  buHaftaHarcanan: number,
  tavan: number = KULUP_HAFTALIK_TAVAN,
): { verilecek: number; kirpildi: boolean } {
  const kalan = Math.max(tavan - buHaftaHarcanan, 0);
  const verilecek = Math.min(Math.max(istenen, 0), kalan);
  return { verilecek, kirpildi: verilecek < istenen };
}

/** Kurs öğesi başına asgari okuma/izleme süresi (sn) — tıklama çiftliği freni */
export const OGE_ASGARI_SN = 60;

/**
 * Kurs tamamlama puanı için asgari süre geçti mi? (öğe sayısı × 60 sn, katılımdan
 * itibaren). Geçmediyse ilerleme yine kaydedilir, yalnız puan yazılmaz.
 */
export function asgariSureGectiMi(
  ogeSayisi: number,
  joinedAt: Date,
  simdi: Date = new Date(),
): boolean {
  return simdi.getTime() - joinedAt.getTime() >= ogeSayisi * OGE_ASGARI_SN * 1000;
}

/** Hesap yaşı freni: 24 saatten genç hesaptan gelen puan bekleyene yazılır */
export const HESAP_YASI_SAAT = 24;
export function hesapGencMi(createdAt: Date, simdi: Date = new Date()): boolean {
  return simdi.getTime() - createdAt.getTime() < HESAP_YASI_SAAT * 3600 * 1000;
}
/** Genç hesabın puanının kesinleşeceği an */
export function olgunlasmaAni(createdAt: Date): Date {
  return new Date(createdAt.getTime() + HESAP_YASI_SAAT * 3600 * 1000);
}

/** event_hosted toplamı: doğrulanmış katılımcı × 5, yalnız ilk 100 katılımcı (≤ 500) */
export function hostToplami(katilimci: number): number {
  return (
    Math.min(Math.max(Math.trunc(katilimci), 0), PUAN.eventHostedMaxAttendees) *
    PUAN.eventHostedPerAttendee
  );
}

/**
 * Düzenleyen payları (PRD §4.2): eşit böl, aşağı yuvarla, kalan etkinliği açana
 * (açan host değilse ilk host'a). Payı 0 çıkan host sonuca GİRMEZ: 0'lık ledger
 * satırı (user, reason, ref) idem anahtarını boşa tüketirdi.
 */
export function hostPaylari(
  toplam: number,
  hostlar: number[],
  acanId: number | null,
): Map<number, number> {
  const tekil = [...new Set(hostlar)];
  const paylar = new Map<number, number>();
  if (toplam <= 0 || tekil.length === 0) return paylar;
  const pay = Math.floor(toplam / tekil.length);
  const kalan = toplam - pay * tekil.length;
  const kalanKime = acanId != null && tekil.includes(acanId) ? acanId : tekil[0]!;
  for (const h of tekil) {
    const p = pay + (h === kalanKime ? kalan : 0);
    if (p > 0) paylar.set(h, p);
  }
  return paylar;
}

/** Etkinlik iyi değerlendirildi mi? (ort ≥ 4,0 ve en az 10 değerlendirme) */
export function iyiDegerlendirildiMi(ortalama: number, adet: number): boolean {
  return adet >= PUAN.eventWellRatedMinCount && ortalama >= PUAN.eventWellRatedMinAvg;
}

