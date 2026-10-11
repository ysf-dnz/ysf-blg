/**
 * Ekonomi korumaları — saf fonksiyonlar (birim testli).
 * İlke: kullanıcıyı asla cezalandırma/engelleme; sadece puan musluğunu
 * sessizce kıs. Sosyal sinyaller (beğeni, onay) her zaman çalışır.
 */

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

