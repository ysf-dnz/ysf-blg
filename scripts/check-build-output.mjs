/**
 * Build-çıktısı bekçisi: server-mode'a geçişte statik kalması gereken
 * varlıkların statik kaldığını doğrular ("endpoint λ'ya kaydı"
 * regresyonu daha önce canlıda yakalandı — bu script kalıcı korkuluk).
 * Ayrıca DEPLOY EDİLEN çıktıda iki kırmızı çizgiyi bekler:
 *   1) hiçbir client varlığında Clerk gizli anahtarı (sk_) olmayacak,
 *   2) hiçbir statik kitap sayfasında Drive dosya linki olmayacak.
 * Kullanım: build SONRASI `node scripts/check-build-output.mjs`
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const STATIK = ".vercel/output/static";
const beklenen = [
  `${STATIK}/index.html`,
  `${STATIK}/rss.xml`,
  `${STATIK}/yazilar/index.html`,
  `${STATIK}/kutuphane/index.html`,
  `${STATIK}/og`,
  `${STATIK}/pagefind`,
  `${STATIK}/llms.txt`,
];

let hata = 0;
for (const yol of beklenen) {
  if (!existsSync(yol)) {
    console.error(`✗ EKSİK statik çıktı: ${yol}`);
    hata++;
  }
}

/** Dizini gezip uzantısı eşleşen dosyaları toplar */
function dosyalar(kok, uzanti, biriktir = []) {
  if (!existsSync(kok)) return biriktir;
  for (const ad of readdirSync(kok)) {
    const yol = join(kok, ad);
    if (statSync(yol).isDirectory()) dosyalar(yol, uzanti, biriktir);
    else if (yol.endsWith(uzanti)) biriktir.push(yol);
  }
  return biriktir;
}

// 1) Sır bekçisi: tarayıcıya inen hiçbir JS'te gizli anahtar olmamalı.
// (@clerk/astro entegrasyon opsiyonlarını injectScript ile client'a
// serileştirir — secretKey oraya konursa açık metin sızar.)
const sirDesenleri = [/\bsk_(test|live)_[A-Za-z0-9]/, /postgres(ql)?:\/\/[^\s"']+:[^\s"']+@/];
for (const dosya of dosyalar(`${STATIK}/_astro`, ".js")) {
  const icerik = readFileSync(dosya, "utf8");
  for (const desen of sirDesenleri) {
    if (desen.test(icerik)) {
      console.error(`✗ SIR SIZINTISI: ${dosya} içinde ${desen} eşleşti`);
      hata++;
    }
  }
}

// 2) İçerik bekçisi: statik kitap sayfaları misafire de servis edilir;
// Drive dosya linki/kurgusu oraya asla yazılmamalı (erişim server island'da).
const kitapSayfalari = dosyalar(`${STATIK}/kutuphane/kitap`, ".html");
const sizanKitap = kitapSayfalari.filter((d) => {
  const icerik = readFileSync(d, "utf8");
  return icerik.includes("drive.google.com/file") || icerik.includes("drive.google.com/uc");
});
if (sizanKitap.length) {
  console.error(
    `✗ DRIVE SIZINTISI: ${sizanKitap.length}/${kitapSayfalari.length} statik kitap sayfasında Drive linki var`,
  );
  console.error(`  ilk örnek: ${sizanKitap[0]}`);
  hata++;
}

const fonksiyonlar = existsSync(".vercel/output/functions")
  ? readdirSync(".vercel/output/functions")
  : [];
if (fonksiyonlar.length === 0) {
  console.error("✗ SSR fonksiyonu yok — üye alanı çalışmaz");
  hata++;
}

if (hata) {
  console.error(`\nBuild çıktısı doğrulaması BAŞARISIZ (${hata} sorun).`);
  process.exit(1);
}
console.log(
  `✓ Build çıktısı doğrulandı: ${beklenen.length} statik varlık + ${fonksiyonlar.length} SSR fonksiyonu` +
    ` · sır sızıntısı yok · ${kitapSayfalari.length} kitap sayfası Drive linki içermiyor`,
);
