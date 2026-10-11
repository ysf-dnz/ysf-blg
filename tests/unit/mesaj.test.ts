import { describe, expect, it } from "vitest";
import {
  DM_AZAMI_UZUNLUK,
  DM_GUNLUK_YENI_KONUSMA,
  DM_PENCERE_LIMIT,
  dmKarar,
  dmPolitikasiMi,
  type DmDurum,
} from "@/lib/economy.ts";
import { govdeGecerliMi, govdeTemizle, mesajZamani, metniParcala, retMetni } from "@/lib/mesaj-kural.ts";

const link = (deger: string) => ({ tur: "link", deger });
const metin = (deger: string) => ({ tur: "metin", deger });

describe("mesaj gövdesi (F4-03)", () => {
  it.each([
    ["  merhaba  ", "merhaba"],
    ["satır1\r\nsatır2\rsatır3", "satır1\nsatır2\nsatır3"],
    ["a\n\n\n\n\nb", "a\n\nb"], // 3+ boş satır ikiye iner
    ["gizli\u0000\u0007karakter", "gizlikarakter"], // kontrol karakterleri atılır
    ["sekme\tkalır", "sekme\tkalır"],
    ["https://x.com/‮moc.elgoog", "https://x.com/moc.elgoog"], // bidi yön değiştirici (taklit) atılır
    ["aile 👨‍👩‍👧", "aile 👨‍👩‍👧"], // ZWJ'li emoji korunur
    ["   \n\t ", ""],
    [null, ""],
  ])("temizle %j → %j", (girdi, beklenen) => {
    expect(govdeTemizle(girdi)).toBe(beklenen);
  });

  it.each([
    ["", false],
    ["a", true],
    ["a".repeat(DM_AZAMI_UZUNLUK), true],
    ["a".repeat(DM_AZAMI_UZUNLUK + 1), false],
  ])("geçerli mi (%s karakter)", (govde, beklenen) => {
    expect(govdeGecerliMi(govde)).toBe(beklenen);
  });
});

describe("yalnız https otomatik bağlantı (AC-24)", () => {
  it.each([
    ["düz metin", [metin("düz metin")]],
    ["bak https://go.dev/doc iyi", [metin("bak "), link("https://go.dev/doc"), metin(" iyi")]],
    ["https://a.com ve https://b.org/x?y=1#z", [link("https://a.com"), metin(" ve "), link("https://b.org/x?y=1#z")]],
    // Cümle sonu noktalama bağlantıya girmez
    ["(bkz. https://go.dev/doc).", [metin("(bkz. "), link("https://go.dev/doc"), metin(").")]],
    ["sor: https://x.com/a?", [metin("sor: "), link("https://x.com/a"), metin("?")]],
    // Başka HİÇBİR şema bağlantı olmaz
    ["javascript:alert(1)", [metin("javascript:alert(1)")]],
    ["tıkla: JAVASCRIPT:alert(document.cookie)", [metin("tıkla: JAVASCRIPT:alert(document.cookie)")]],
    ["data:text/html,<script>alert(1)</script>", [metin("data:text/html,<script>alert(1)</script>")]],
    ["http://guvensiz.example", [metin("http://guvensiz.example")]],
    ["mailto:a@b.co ve /uye/admin", [metin("mailto:a@b.co ve /uye/admin")]],
    // Markdown ve HTML işlenmez: metin olarak kalır
    ["[tıkla](javascript:alert(1))", [metin("[tıkla](javascript:alert(1))")]],
    ['<a href="https://x.com">x</a>', [metin('<a href="'), link("https://x.com"), metin('">x</a>')]],
    ["<img src=x onerror=alert(1)>", [metin("<img src=x onerror=alert(1)>")]],
    // Adres değil
    ["https://", [metin("https://")]],
    ["", []],
  ])("%j", (govde, beklenen) => {
    expect(metniParcala(govde)).toEqual(beklenen);
  });

  it("parçalar birleşince gövdenin kendisidir (hiçbir karakter kaybolmaz/eklenmez)", () => {
    const govde = "a https://x.com/y, b javascript:alert(1) <b>c</b>\nhttps://z.org.";
    expect(
      metniParcala(govde)
        .map((p) => p.deger)
        .join(""),
    ).toBe(govde);
  });
});

describe("mesaj izni — dmKarar (AC-23)", () => {
  const taban: DmDurum = {
    kendisi: false,
    engel: false,
    karsiYazmis: false,
    benYazmis: false,
    bag: false,
    sv4: false,
    politika: "mutual",
    penceredeGonderilen: 0,
    bugunYeniKonusma: 0,
  };
  it.each<[string, Partial<DmDurum>, ReturnType<typeof dmKarar>]>([
    // mutual (varsayılan): yalnız bağ
    ["mutual · bağ yok → başlatamaz", {}, "bag"],
    ["mutual · bağ yok ama Sv4 → yine başlatamaz", { sv4: true }, "bag"],
    ["mutual · bağ var → yazar", { bag: true }, "ok"],
    // everyone: bağ ya da Sv4+
    ["everyone · bağ yok, Sv4 altı → başlatamaz", { politika: "everyone" }, "bag"],
    ["everyone · Sv4 → yazar", { politika: "everyone", sv4: true }, "ok"],
    ["everyone · bağ → yazar", { politika: "everyone", bag: true }, "ok"],
    // nobody: kimse başlatamaz
    ["nobody · bağ + Sv4 bile → kapalı", { politika: "nobody", bag: true, sv4: true }, "kapali"],
    // Alıcı daha önce yazdıysa yanıt her ayarda serbest
    ["karşı taraf yazmış · mutual bağsız → yanıtlar", { karsiYazmis: true }, "ok"],
    ["karşı taraf yazmış · nobody → yanıtlar", { karsiYazmis: true, politika: "nobody" }, "ok"],
    // Engel her şeyin önünde (iki yön tek bayrak)
    ["engel · karşı taraf yazmış olsa da", { engel: true, karsiYazmis: true, bag: true }, "engel"],
    ["kendine", { kendisi: true, bag: true }, "kendin"],
    // Hız penceresi
    ["pencere dolu", { bag: true, penceredeGonderilen: DM_PENCERE_LIMIT }, "hiz"],
    ["pencere dolmadı", { bag: true, penceredeGonderilen: DM_PENCERE_LIMIT - 1 }, "ok"],
    ["pencere dolu · yanıt da frenlenir", { karsiYazmis: true, penceredeGonderilen: DM_PENCERE_LIMIT }, "hiz"],
    // Günde 20 yeni konuşma: yalnız YENİ konuşmayı keser
    ["günlük sınır · yeni konuşma", { bag: true, bugunYeniKonusma: DM_GUNLUK_YENI_KONUSMA }, "gunluk"],
    ["günlük sınır · bir eksik", { bag: true, bugunYeniKonusma: DM_GUNLUK_YENI_KONUSMA - 1 }, "ok"],
    ["günlük sınır · süren konuşma etkilenmez", { bag: true, benYazmis: true, bugunYeniKonusma: DM_GUNLUK_YENI_KONUSMA }, "ok"],
    ["günlük sınır · yanıt etkilenmez", { karsiYazmis: true, bugunYeniKonusma: DM_GUNLUK_YENI_KONUSMA }, "ok"],
    // Süren konuşma politikayı aşmaz: alıcı yanıtlamadıysa ayar her gönderimde geçerli
    ["ben yazmışım · alıcı kapatmış → yazamaz", { benYazmis: true, politika: "nobody" }, "kapali"],
    ["ben yazmışım · bağ kopmuş → yazamaz", { benYazmis: true }, "bag"],
  ])("%s", (_ad, fark, beklenen) => {
    expect(dmKarar({ ...taban, ...fark })).toBe(beklenen);
  });

  it("ayar beyaz listesi", () => {
    expect(["everyone", "mutual", "nobody"].every(dmPolitikasiMi)).toBe(true);
    expect(["", "herkes", "MUTUAL", "everyone "].some(dmPolitikasiMi)).toBe(false);
  });
});

describe("ret metni ve zaman", () => {
  const o = { ad: "Elif", politika: "mutual" as const, benEngelledim: false };
  it("karşı tarafın engeli söylenmez: 'mesaj almıyor' ile aynı metin", () => {
    expect(retMetni("engel", o)).toBe(retMetni("kapali", o));
    expect(retMetni("engel", o)).not.toMatch(/engel/i);
    expect(retMetni("engel", { ...o, benEngelledim: true })).toMatch(/engeli kaldır/);
  });
  it("bağ gerekçesi alıcının ayarına göre", () => {
    expect(retMetni("bag", o)).toMatch(/ortak topluluğu olan ya da karşılıklı takipleştiği/);
    expect(retMetni("bag", { ...o, politika: "everyone" })).toMatch(/Seviye 4/);
  });
  it("mesaj zamanı TR saatiyle (UTC 21:30 → ertesi gün 00:30)", () => {
    expect(mesajZamani(new Date("2026-10-11T21:30:00Z"))).toBe("12 Eki 00:30");
  });
});
