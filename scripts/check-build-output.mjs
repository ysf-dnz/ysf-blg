/**
 * Build-çıktısı bekçisi: server-mode'a geçişte statik kalması gereken
 * varlıkların statik kaldığını doğrular ("endpoint λ'ya kaydı"
 * regresyonu daha önce canlıda yakalandı — bu script kalıcı korkuluk).
 * Kullanım: build SONRASI `node scripts/check-build-output.mjs`
 */
import { existsSync, readdirSync } from "node:fs";

const STATIK = ".vercel/output/static";
const beklenen = [
  `${STATIK}/index.html`,
  `${STATIK}/rss.xml`,
  `${STATIK}/yazilar/index.html`,
  `${STATIK}/kutuphane/index.html`,
  `${STATIK}/og`,
  `${STATIK}/pagefind`,
];

let hata = 0;
for (const yol of beklenen) {
  if (!existsSync(yol)) {
    console.error(`✗ EKSİK statik çıktı: ${yol}`);
    hata++;
  }
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
  `✓ Build çıktısı doğrulandı: ${beklenen.length} statik varlık + ${fonksiyonlar.length} SSR fonksiyonu`,
);
