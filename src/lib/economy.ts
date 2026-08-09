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
