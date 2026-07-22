/**
 * Kitapları başlıktan konuya göre kategorilere ayırır. Kategoriler ve anahtar
 * kelimeler admin panelinden yönetilir: src/data/book-categories.json
 * (Keystatic → Kütüphane → Kitap Kategorileri).
 *
 * anahtarKelimeler regex parçalarıdır ("|" ile birleştirilir, i bayraklı);
 * oncelik küçük olan kural önce denenir — ilk eşleşen kazanır.
 */
import bookCategories from "../data/book-categories.json";

export interface Kategori {
  key: string;
  ad: string;
  renk: string;
}

interface KategoriKaydi extends Kategori {
  oncelik: number;
  anahtarKelimeler: string[];
}

const kayitlar = bookCategories.kategoriler as KategoriKaydi[];

// Dizi sırası = rafta görünüm sırası
export const KATEGORILER: Kategori[] = kayitlar.map(({ key, ad, renk }) => ({
  key,
  ad,
  renk,
}));

const KURALLAR: [string, RegExp][] = kayitlar
  .filter((k) => k.anahtarKelimeler.length > 0)
  .sort((a, b) => a.oncelik - b.oncelik)
  .map((k) => [k.key, new RegExp(k.anahtarKelimeler.join("|"), "i")]);

export function kategorile(title: string): string {
  for (const [key, re] of KURALLAR) {
    if (re.test(title)) return key;
  }
  return "diger";
}
