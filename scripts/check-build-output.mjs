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

// 3) Sitemap bekçisi: üye alanı (/uye/*) sitemap'e girmez (/uyeler herkese açık, kalır);
// kurs sitemap'i index'te; /dersler → /kurslar 301 adapter rotasında.
const sitemap0 = `${STATIK}/sitemap-0.xml`;
if (existsSync(sitemap0) && /\/uye(\/|<)/.test(readFileSync(sitemap0, "utf8"))) {
  console.error("✗ SITEMAP: /uye/* üye alanı sitemap-0.xml'e sızdı (astro.config sitemap.filter)");
  hata++;
}
const sitemapIndex = `${STATIK}/sitemap-index.xml`;
for (const ozel of ["sitemap-kurslar.xml", "sitemap-etkinlikler.xml"]) {
  if (existsSync(sitemapIndex) && !readFileSync(sitemapIndex, "utf8").includes(ozel)) {
    console.error(`✗ SITEMAP: ${ozel} index'te yok (customSitemaps)`);
    hata++;
  }
}
const vercelConfig = ".vercel/output/config.json";
if (existsSync(vercelConfig)) {
  const routes = JSON.parse(readFileSync(vercelConfig, "utf8")).routes ?? [];
  const dersler = routes.find((r) => r.src === "^/dersler$" || r.src === "^/dersler/?$");
  if (!dersler || dersler.status !== 301) {
    console.error("✗ REDIRECT: /dersler → /kurslar 301 rotası adapter çıktısında yok");
    hata++;
  }
  // Büyük harf QR yolları (/D davet, /T bilet, /C dönen QR). Vercel kenarı deseni harf DUYARSIZ
  // eşleştirir: hedef, kaynağın küçük harfli hâliyle aynı desene uyarsa canlıda sonsuz 301 döngüsü.
  for (const [onek, hedefOnek] of [["D", "/d/q/"], ["T", "/t/q/"], ["C", "/c/q/"]]) {
    const r = routes.find((x) => x.status === 301 && typeof x.src === "string" && x.src.startsWith(`^/${onek}`));
    const hedef = r?.headers?.Location ?? "";
    if (!r || !hedef.startsWith(hedefOnek)) {
      console.error(`✗ REDIRECT: /${onek}/… → ${hedefOnek}… 301 rotası adapter çıktısında yok (bulunan hedef: ${hedef || "—"})`);
      hata++;
    } else if (new RegExp(r.src, "i").test(hedef.replace(/\$\d/g, "x"))) {
      console.error(`✗ REDIRECT: /${onek}/… hedefi (${hedef}) kendi desenine uyuyor → canlıda sonsuz yönlendirme döngüsü`);
      hata++;
    } else if (hedef.includes("[")) {
      console.error(`✗ REDIRECT: /${onek}/… hedefi çözülmemiş parametre taşıyor (${hedef}) — hedef sayfa dosyası yok`);
      hata++;
    }
  }
}

const fonksiyonlar = existsSync(".vercel/output/functions")
  ? readdirSync(".vercel/output/functions")
  : [];
if (fonksiyonlar.length === 0) {
  console.error("✗ SSR fonksiyonu yok — üye alanı çalışmaz");
  hata++;
}

// 4) Davet kartı bekçisi: /api/kart satori+resvg'yi ÇALIŞMA ZAMANINDA koşturur →
// fonksiyon paketinde 3 marka fontu (astro.config includeFiles) ve resvg native
// binary'si olmalı; yoksa canlıda kart 500 verir (ADR 0001 K3.1).
const renderFunc = ".vercel/output/functions/_render.func";
const ttf = dosyalar(renderFunc, ".ttf").length;
const resvgNode = dosyalar(renderFunc, ".node").filter((d) => /resvg/i.test(d)).length;
if (ttf < 3 || resvgNode < 1) {
  console.error(`✗ KART: ${renderFunc} içinde ${ttf}/3 .ttf ve ${resvgNode}/1 resvg .node var`);
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
