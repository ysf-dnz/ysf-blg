/**
 * 81 il sınırını OpenStreetMap'ten (Nominatim, ODbL) çeker → src/data/il-sinirlari.json
 * (GeoJSON FeatureCollection; properties.il = il-koordinatlari.json anahtarı).
 * Nominatim kullanım politikası: ≤ 1 istek/sn, tanıtıcı User-Agent; tek seferlik koşum.
 * Koşum: node --experimental-strip-types scripts/il-sinirlari-cek.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

const iller = Object.keys(JSON.parse(readFileSync("src/data/il-koordinatlari.json", "utf8")));
const UA = "ysf-blog harita (https://yusufdeniz.com)";
const ESIK = "0.006"; // derece (~650 m) — ülke ölçeğinde choropleth için yeterli, ~250 KB
const norm = (s: string) => s.trim().toLocaleLowerCase("tr");
const yuvarla = (c: unknown): unknown =>
  typeof c === "number" ? Math.round(c * 1000) / 1000 : (c as unknown[]).map(yuvarla);

type Sonuc = { osm_type: string; osm_id: number; addresstype: string; name: string; geojson?: { type: string; coordinates: unknown } };
const features: unknown[] = [];
const eksik: string[] = [];
for (const il of iller) {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.search = new URLSearchParams({ state: il, country: "Türkiye", format: "jsonv2", polygon_geojson: "1", polygon_threshold: ESIK, limit: "3" }).toString();
  const res = await fetch(u, { headers: { "User-Agent": UA, "Accept-Language": "tr" } });
  const rs = (await res.json()) as Sonuc[];
  const aday = rs.filter((x) => x.osm_type === "relation" && x.addresstype === "province" && x.geojson);
  const r = aday.find((x) => norm(x.name) === norm(il)) ?? aday[0];
  if (!r) eksik.push(il);
  else features.push({ type: "Feature", properties: { il, osmId: r.osm_id }, geometry: { type: r.geojson!.type, coordinates: yuvarla(r.geojson!.coordinates) } });
  console.log(il, r ? `→ ${r.name} R${r.osm_id} ${r.geojson!.type}${norm(r.name) === norm(il) ? "" : " (AD FARKLI)"}` : "→ YOK", `HTTP ${res.status}`);
  await new Promise((f) => setTimeout(f, 1100));
}
writeFileSync("src/data/il-sinirlari.json", JSON.stringify({ type: "FeatureCollection", features }));
console.log(`${features.length}/${iller.length} il yazıldı → src/data/il-sinirlari.json`);
if (eksik.length) {
  console.error("EKSİK:", eksik.join(", "));
  process.exit(1);
}
