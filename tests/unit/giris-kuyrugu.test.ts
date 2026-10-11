import { describe, expect, it } from "vitest";
import { kuyrugaEkle, kuyrukOku, kuyruktanCikar, tokenAyikla, yeniOkumaMi } from "@/features/etkinlik/giris-kuyrugu.ts";
import { biletCoz, biletQrIcerigi, biletToken } from "@/lib/etkinlik-kural.ts";

const T = "42.ABCDEFGH12345678";

describe("görevli tarayıcısı — bilet token'ı ayıklama", () => {
  it.each([
    ["HTTPS://YUSUFDENIZ.COM/T/42.ABCDEFGH12345678", T], // QR içeriği
    ["https://yusufdeniz.com/t/q/42.abcdefgh12345678", T], // 301 sonrası adres
    ["https://yusufdeniz.com/t/q/42.ABCDEFGH12345678?x=1", T],
    ["  42.abcdefgh12345678  ", T], // elle yazım
    ["42.ABCDEFGH12345678", T],
    ["HTTPS://YUSUFDENIZ.COM/D/DEM07KQ", null], // davet QR'ı bilet değildir
    ["HTTPS://YUSUFDENIZ.COM/C/9/ABCDE12345", null], // dönen QR bilet değildir
    ["42.KISA", null],
    ["x42.ABCDEFGH12345678", null],
    ["", null],
  ])("%j → %j", (metin, beklenen) => {
    expect(tokenAyikla(metin)).toBe(beklenen);
  });

  it("gerçek bilet QR'ı ayıklanınca imzası doğrulanır (uçtan uca biçim)", () => {
    const token = biletToken(1234, "sir");
    const ayiklanan = tokenAyikla(biletQrIcerigi("https://yusufdeniz.com", token));
    expect(ayiklanan).toBe(token);
    expect(biletCoz(ayiklanan, "sir")).toBe(1234);
  });
});

describe("görevli tarayıcısı — tekrar okuma ve çevrimdışı kuyruk (AC-18)", () => {
  it("kamera aynı bileti art arda görür: 4 sn içinde yeniden işlenmez", () => {
    const son = new Map<string, number>();
    expect(yeniOkumaMi(son, T, 1000)).toBe(true);
    expect(yeniOkumaMi(son, T, 1300)).toBe(false);
    expect(yeniOkumaMi(son, T, 4999)).toBe(false);
    expect(yeniOkumaMi(son, T, 5000)).toBe(true);
    expect(yeniOkumaMi(son, "7.ABCDEFGH12345678", 5001)).toBe(true); // başka bilet beklemez
  });

  it("bağlantı yokken 30 bilet (bir kısmı iki kez okutuldu) kuyrukta TEKİL durur, sırası korunur", () => {
    let kuyruk = kuyrukOku(null);
    const biletler = Array.from({ length: 30 }, (_, i) => `${i + 1}.ABCDEFGH12345678`);
    for (const [i, b] of [...biletler, ...biletler.slice(0, 10)].entries()) kuyruk = kuyrugaEkle(kuyruk, b, i);
    expect(kuyruk).toHaveLength(30);
    expect(kuyruk.map((o) => o.token)).toEqual(biletler);
    // Gönderilen düşer; kalanlar bir sonraki denemeye kalır
    kuyruk = kuyruktanCikar(kuyruk, biletler[0]!);
    expect(kuyruk).toHaveLength(29);
    expect(kuyruk[0]!.token).toBe(biletler[1]);
  });

  it("depodaki bozuk/yabancı veri kuyruğu düşürmez", () => {
    expect(kuyrukOku("bozuk{")).toEqual([]);
    expect(kuyrukOku('{"token":"x"}')).toEqual([]);
    expect(kuyrukOku('[{"token":"1.A","at":5},{"token":7},null,"x"]')).toEqual([{ token: "1.A", at: 5 }]);
    const k = kuyrugaEkle([], T, 1);
    expect(kuyrukOku(JSON.stringify(k))).toEqual(k);
  });
});
