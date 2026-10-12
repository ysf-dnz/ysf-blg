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

/** Görevli başına dakikada okutma sınırı (PRD §4.2) */
export const GOREVLI_DAKIKADA = 120;
/** Son 60 sn'de bu kadar giriş yazmış görevli frenlenir mi? */
export function gorevliHizAsildiMi(sonDakikadakiGiris: number): boolean {
  return sonDakikadakiGiris >= GOREVLI_DAKIKADA;
}

/** Etkinlik iyi değerlendirildi mi? (ort ≥ 4,0 ve en az 10 değerlendirme) */
export function iyiDegerlendirildiMi(ortalama: number, adet: number): boolean {
  return adet >= PUAN.eventWellRatedMinCount && ortalama >= PUAN.eventWellRatedMinAvg;
}

/* ---------------- Mesaj (DM) frenleri — PRD §4.6, F4-03 ---------------- */

/** Hız penceresi (sn) ve pencere başına mesaj sınırı: sohbet akabilsin, sel olmasın */
export const DM_PENCERE_SN = 30;
export const DM_PENCERE_LIMIT = 5;
/** TR gününde başlatılabilecek yeni konuşma (ilk mesajı gönderenin attığı konuşma) */
export const DM_GUNLUK_YENI_KONUSMA = 20;
/**
 * Alıcı yanıtlayana kadar aynı kişiye yazılabilecek mesaj ("mesaj isteği" tavanı): bağ tek taraflı
 * da kurulabilir (onaylı topluluğa katılmak tek tık) — yanıtsız konuşma taciz kanalı olmasın.
 */
export const DM_YANITSIZ_SINIR = 3;
export const DM_AZAMI_UZUNLUK = 1000;

export type DmPolitika = "everyone" | "mutual" | "nobody";
export const DM_POLITIKALARI: DmPolitika[] = ["mutual", "everyone", "nobody"];
export const dmPolitikasiMi = (s: string): s is DmPolitika => (DM_POLITIKALARI as string[]).includes(s);

/** Gönderen → alıcı çifti için kararın girdileri (lib/mesaj.ts mesajDurumu tek sorguda doldurur) */
export type DmDurum = {
  kendisi: boolean;
  /** İki yönden biri: gönderen alıcıyı ya da alıcı göndereni engellemiş */
  engel: boolean;
  /** Alıcı gönderene daha önce yazmış (yanıt her zaman serbest: alıcı konuşmaya razı olmuş) */
  karsiYazmis: boolean;
  /** Gönderen alıcıya daha önce yazmış (süren konuşma: günlük yeni konuşma sayacına girmez) */
  benYazmis: boolean;
  /** Ortak onaylı topluluk ya da karşılıklı takip */
  bag: boolean;
  /** Gönderen Sv4+ */
  sv4: boolean;
  /** Alıcının ayarı; alıcı yoksa "nobody" */
  politika: DmPolitika;
  /** Gönderenin son DM_PENCERE_SN sn'de attığı mesaj */
  penceredeGonderilen: number;
  /** Gönderenin bugün başlattığı yeni konuşma */
  bugunYeniKonusma: number;
  /** Gönderenin bu alıcıya yazdığı toplam mesaj (alıcı yanıtlamadıysa tavana sayılır) */
  aliciyaGonderilen: number;
};
export type DmKarar = "ok" | "kendin" | "engel" | "hiz" | "kapali" | "bag" | "gunluk" | "yanitsiz";

/**
 * Mesaj gönderilebilir mi? Gönderim SQL'inin (lib/mesaj.ts mesajGonder WHERE'i) SAF EŞLENİĞİ:
 * sayfa formu gösterip göstermemeye ve ret gerekçesine bununla karar verir; yazma kararını SQL verir.
 *  - mutual (varsayılan): yalnız bağ (AC-23) — Sv4 yetmez.
 *  - everyone: bağ ya da Sv4+ (PRD: bağ yoksa yeni konuşma için Sv4+).
 *  - nobody: kimse başlatamaz; alıcının kendi yazdığı kişi yanıtlayabilir.
 *  - Alıcı hiç yazmadıysa gönderen en çok DM_YANITSIZ_SINIR mesaj yazar (yanıt gelince tavan kalkar).
 */
export function dmKarar(d: DmDurum): DmKarar {
  if (d.kendisi) return "kendin";
  if (d.engel) return "engel";
  if (d.penceredeGonderilen >= DM_PENCERE_LIMIT) return "hiz";
  if (d.karsiYazmis) return "ok";
  if (d.politika === "nobody") return "kapali";
  if (!d.bag && !(d.politika === "everyone" && d.sv4)) return "bag";
  if (!d.benYazmis && d.bugunYeniKonusma >= DM_GUNLUK_YENI_KONUSMA) return "gunluk";
  if (d.aliciyaGonderilen >= DM_YANITSIZ_SINIR) return "yanitsiz";
  return "ok";
}

/* ---------------- Canlılık havuzu — PRD §4.2, F5-02 ---------------- */

export type Canlilik = {
  /** Hafta içinde ilerleme kaydeden katılımcı */
  ilerleyen: number;
  tamamlama: number;
  /** Hafta içinde beğeni alan yorum/cevap */
  begeniliYorum: number;
  /** Hafta içinde kabul edilen ek kaynak */
  kaynak: number;
};
export function canlilikV(c: Canlilik): number {
  return c.ilerleyen + 3 * c.tamamlama + 0.5 * c.begeniliYorum + 2 * c.kaynak;
}

export const HAVUZ_ESIK = 10;
/** Kurs başına haftalık havuz tavanı */
export const HAVUZ_TAVAN = 100;
/** Logaritmik: 100 kat canlı kurs ~3 kat alır — büyük kurs ekonomiyi yutmaz */
export function havuz(v: number): number {
  return v < HAVUZ_ESIK ? 0 : Math.min(HAVUZ_TAVAN, Math.round(15 * Math.log(1 + v)));
}

/**
 * Havuz payları: %50 üretici · %30 beğeni alan katkıcılar (üretici hariç, beğeni payına göre) ·
 * %20 aktif davetlilerin davet edenleri (davetli payına göre). Aşağı yuvarla, artık üreticiye;
 * hak sahibi olmayan dilim DAĞITILMAZ. Aynı kişinin birden çok dilimdeki payı TOPLANIR:
 * refId `course:{id}:{hafta}` kişi başına tek ledger satırı taşır (ikinci insert'i idem index yutardı).
 * Payı 0 olan sonuca girmez.
 */
export function havuzDagit(
  toplam: number,
  ureticiId: number,
  katkicilar: Map<number, number>,
  davetciler: Map<number, number>,
): Map<number, number> {
  const paylar = new Map<number, number>();
  if (toplam <= 0) return paylar;
  const ekle = (id: number, n: number) => {
    if (n > 0) paylar.set(id, (paylar.get(id) ?? 0) + n);
  };
  // Tam sayı aritmetiği: 100 * 0.3 kayan noktada 30.000000000000004 verir
  const katkiDilim = Math.floor((toplam * 3) / 10);
  const davetDilim = Math.floor((toplam * 2) / 10);
  // Üretici: toplamın yarısı + yuvarlama artıkları; sahipsiz dilim buraya AKTARILMAZ
  let uretici = toplam - katkiDilim - davetDilim;
  const dilimler: [number, [number, number][]][] = [
    [katkiDilim, [...katkicilar].filter(([id]) => id !== ureticiId)],
    [davetDilim, [...davetciler]],
  ];
  for (const [dilim, hak] of dilimler) {
    const sahipler = hak.filter(([, agirlik]) => agirlik > 0);
    const agirlikToplam = sahipler.reduce((t, [, a]) => t + a, 0);
    if (agirlikToplam === 0) continue;
    let dagitilan = 0;
    for (const [id, agirlik] of sahipler) {
      const pay = Math.floor((dilim * agirlik) / agirlikToplam);
      ekle(id, pay);
      dagitilan += pay;
    }
    uretici += dilim - dagitilan;
  }
  ekle(ureticiId, uretici);
  return paylar;
}

/** Türkiye kalıcı UTC+3 (yaz saati yok): kaydırılmış anın UTC alanları = TR duvar saati */
const TR_OFSET_MS = 3 * 3600 * 1000;

/** TR saatli ISO hafta: etiket "2026-W42", pencere pazartesi 00:00 TR → sonraki pazartesi */
export function isoHafta(an: Date): { etiket: string; baslangic: Date; bitis: Date } {
  const tr = new Date(an.getTime() + TR_OFSET_MS);
  const pazartesi = Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() - ((tr.getUTCDay() + 6) % 7));
  // ISO yılı, haftanın perşembesinin yılıdır
  const persembe = new Date(pazartesi + 3 * 864e5);
  const yil = persembe.getUTCFullYear();
  const hafta = Math.floor((persembe.getTime() - Date.UTC(yil, 0, 1)) / (7 * 864e5)) + 1;
  const baslangic = new Date(pazartesi - TR_OFSET_MS);
  return {
    etiket: `${yil}-W${String(hafta).padStart(2, "0")}`,
    baslangic,
    bitis: new Date(baslangic.getTime() + 7 * 864e5),
  };
}

/** Havuzun dağıtılacağı hafta: şu an içinde bulunulandan bir önceki (ilk kez pazartesi koşar) */
export function sonTamamlananHafta(simdi: Date = new Date()) {
  return isoHafta(new Date(isoHafta(simdi).baslangic.getTime() - 1));
}

/* ---------------- Ekonomi kartı — PRD §4.9, F5-03 ---------------- */

/** Davet kaynaklı pay bu oranı geçerse ekonomi davet çiftliğine kayıyor demektir */
export const DAVET_PAYI_ESIK = 0.4;

/** lib/ekonomi.ts ekonomiKarti() tek SQL'inin sayıları (son 7 gün; huniler son 30 gün) */
export type EkonomiHam = {
  basilan: number;
  /** Son 7 günde puan kazanan üye */
  aktif: number;
  davet: number;
  kesinlesen: number;
  kirpilan: number;
  dusen: number;
  kursKatilim: number;
  kursAktif: number;
  kursBiten: number;
  etkinlikKayit: number;
  etkinlikGiris: number;
};

const oran = (pay: number, payda: number) => (payda > 0 ? pay / payda : 0);

export function ekonomiOzeti(h: EkonomiHam) {
  const davetPayi = oran(h.davet, h.basilan);
  return {
    uyeBasina: Math.round(oran(h.basilan, h.aktif)),
    davetPayi,
    davetUyari: davetPayi >= DAVET_PAYI_ESIK,
    kirpilanOran: oran(h.kirpilan, h.kesinlesen),
    dusenOran: oran(h.dusen, h.kesinlesen + h.dusen),
    kursAktivasyon: oran(h.kursAktif, h.kursKatilim),
    kursTamamlama: oran(h.kursBiten, h.kursKatilim),
    etkinlikGiris: oran(h.etkinlikGiris, h.etkinlikKayit),
  };
}

/* ---------------- Suistimal işareti — PRD §4.2, F5-04 ---------------- */

/** Aynı davetçinin koduyla 24 saatte bu kadar yeni hesap VE aynı IP'den bu kadar ziyaret */
export const SUISTIMAL_ESIK = 5;

/**
 * Davet çiftliği şüphesi — lib/ekonomi.ts suistimalTara SQL'inin SAF EŞLENİĞİ (ikisi birlikte değişir).
 * Kanıt "az ağ, çok hesap": yeni hesaplar, davetçinin kodlarını ziyaret eden FARKLI IP sayısının en az
 * iki katı. Gerçek davette her yeni üye kendi ağından gelir. Üçüncü kişi (ya da davet edenin kendi
 * tıklamaları) yalnız IP EKLEYEBİLİR: `/d/` bağlantısından gelen davetlileri işaretletemez.
 * User-agent sayılmaz (isteyen değiştirir). İşaretlenen KÜME (yalnız yoğun 24 saatlik pencerenin üyeleri — B4)
 * kapsam kuralıdır, bu eşleniğin dışındadır.
 */
export function suistimalMi(d: { yeniHesap: number; enCokIpZiyaret: number; farkliIp: number }): boolean {
  return d.yeniHesap >= SUISTIMAL_ESIK && d.enCokIpZiyaret >= SUISTIMAL_ESIK && d.farkliIp * 2 <= d.yeniHesap;
}
