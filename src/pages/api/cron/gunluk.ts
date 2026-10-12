/**
 * GET /api/cron/gunluk — günlük bakım işleri (Vercel Cron, 03:00 UTC).
 * Kimlik: Authorization: Bearer CRON_SECRET (Vercel) veya x-cron-secret.
 * Her iş cron_runs (job, period_key UNIQUE) ile idempotent: aynı dönem
 * ikinci kez çalışmaz; endpoint elle de güvenle tetiklenebilir.
 * İşler: bayat görev, sezon, ayın kitabı, özel ligler, suistimal taraması, bekleyen puanlar,
 * davet ziyaret temizliği, etkinlik sonrası (düzenleyen payı + iyi değerlendirme), canlılık havuzu.
 */
import type { APIRoute } from "astro";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { birKezCalistir } from "@/lib/cron.ts";
import { etkinlikSonrasiIsle } from "@/lib/etkinlik.ts";
import { aktifSezon, bitenSezonlar, kulupIciSiralama, sezonKapat } from "@/lib/league.ts";
import { awardBadge, bekleyenleriIsle, gunKey } from "@/lib/rewards.ts";
import { canlilikHavuzuDagit, imzalariUnut, suistimalTara } from "@/lib/ekonomi.ts";
import { isoHafta, sonTamamlananHafta } from "@/lib/economy.ts";
import { CANLILIK_ILK_HAFTA } from "@/lib/points.ts";
import { SAKLAMA_GUN } from "@/lib/economy.ts";

export const prerender = false;

/** 7 gün hareketsiz "üstlenildi" görevleri backlog'a döndür (site geneli) */
async function bayatGorevSupur(): Promise<number> {
  const rows = await db
    .update(schema.campaignTasks)
    .set({ status: "backlog", assigneeId: null, claimedAt: null })
    .where(
      and(
        eq(schema.campaignTasks.status, "claimed"),
        lt(schema.campaignTasks.claimedAt, new Date(Date.now() - 7 * 864e5)),
      ),
    )
    .returning({ id: schema.campaignTasks.id });
  return rows.length;
}

/** Ayın kitabı: en çok oyu alan kitap site-geneli kampanyaya dönüşür */
async function ayinKitabi() {
  const [birinci] = await db
    .select({
      bookId: schema.campaignVotes.bookId,
      n: sql<number>`count(*)`,
    })
    .from(schema.campaignVotes)
    .groupBy(schema.campaignVotes.bookId)
    .orderBy(desc(sql`count(*)`))
    .limit(1);
  if (!birinci) return;
  const admin = await db.query.users.findFirst({
    where: eq(schema.users.role, "admin"),
  });
  if (!admin) return;
  const simdi = new Date();
  const ad = new Intl.DateTimeFormat("tr-TR", { month: "long" }).format(simdi);
  await db.insert(schema.campaigns).values({
    clubId: null,
    bookId: birinci.bookId,
    title: `📖 ${ad} Ayının Kitabı`,
    ownerId: admin.id,
    status: "active",
  });
  await db.delete(schema.campaignVotes);
}

/**
 * Süresi biten özel ligleri kapat: birinciye rozet + bildirim. Kilit işle birlikte (`birKezCalistir`: fırlatırsa
 * geri verilir, ertesi gün yeniden denenir); rozet (unique) `closed`'dan ÖNCE; tek bozuk lig öbürlerini ve
 * 5–8. adımları durdurmaz (hata rapora + günlüğe).
 */
async function ozelLigleriKapat(): Promise<{ kapanan: number; hata: string[] }> {
  const bitenler = await db.query.clubLeagues.findMany({
    where: and(
      eq(schema.clubLeagues.status, "active"),
      lt(schema.clubLeagues.endsAt, new Date()),
    ),
  });
  let kapanan = 0;
  const hata: string[] = [];
  for (const lig of bitenler) {
    try {
      const oldu = await birKezCalistir("ozel-lig", String(lig.id), async () => {
        const siralama = await kulupIciSiralama(lig.clubId, lig.startsAt, lig.endsAt, 1);
        const birinci = siralama[0]?.total ? siralama[0] : null;
        if (birinci) {
          await awardBadge(
            birinci.userId,
            "lig-birincisi",
            `"${lig.name}" liginin birincisi oldun 🥇${lig.rewardNote ? ` Ödül: ${lig.rewardNote}` : ""}`,
          );
        }
        await db
          .update(schema.clubLeagues)
          .set({ status: "closed", winnerId: birinci?.userId ?? null })
          .where(eq(schema.clubLeagues.id, lig.id));
        return true;
      });
      if (oldu) kapanan++;
    } catch (err) {
      console.error("ozelLigKapat", lig.id, err);
      hata.push(`${lig.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { kapanan, hata };
}

export const GET: APIRoute = async ({ request }) => {
  // process.env ÖNCE: import.meta.env build anında gömülür → panelden
  // rotasyon redeploy'suz etkisiz kalırdı (build'de tanımsızsa "undefined"
  // kalıcı gömülür ve cron sonsuza dek 401 döner).
  const secret = process.env.CRON_SECRET ?? import.meta.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const header = request.headers.get("x-cron-secret") ?? "";
  if (!secret || (auth !== `Bearer ${secret}` && header !== secret))
    return new Response("Yetkisiz", { status: 401 });

  const bugun = gunKey(new Date());
  const rapor: Record<string, unknown> = {};

  // 0) Suistimal taraması (F5-04) — HER ŞEYDEN ÖNCE: işaretlenen hesap aynı koşumdaki sezon / lig
  // kapanış ödüllerine girmesin, bekleyeni olgunlaşmasın. Kilitsiz: UPDATE idempotent (yalnız
  // flagged_at IS NULL satırları), her koşumda güvenle çalışır. Fırlatırsa öbür işler durmaz (devir B2):
  // hata rapora yazılır, tarama ertesi gün yeniden denenir.
  try {
    const isaretlenen = await suistimalTara();
    if (isaretlenen.length) rapor.suistimal = isaretlenen.length;
  } catch (err) {
    console.error("suistimalTara", err); // yanıt 200 kalır; hata Vercel günlüğünde de görünsün
    rapor.suistimalHata = err instanceof Error ? err.message : String(err);
  }

  // 1) Bayat görev süpürmesi (günlük)
  const bayat = await birKezCalistir("bayat-gorev", bugun, bayatGorevSupur);
  if (bayat !== undefined) rapor.bayatGorev = bayat;

  // 2) Sezon döngüsü: bitişi geçmiş HER aktif sezonu kapat (eskiden yeniye), sonra yeni ayın sezonu.
  // Eski dal `aktifSezon().endsAt <= now` idi; aktifSezon bitmiş sezonu asla döndürmediği için dal ölüydü
  // (Ağustos / Eylül 2026 hiç kapanmadı — Faz 5 incelemesi C1). İlk koşumda birikmiş sezonlar peş peşe
  // kapanır: ilk 10 hazine kitabı ve şampiyon rozeti geç de olsa dağıtılır (işaretliler dışarıda).
  // Kilit sezon ADIYLA: yarışta çift açılmış aynı ayın satırları tek kapanışta (sezonKapat ada göre günceller).
  // Tek bozuk sezon öbür sezonları ve 3–8. adımları durdurmasın: hata rapora + günlüğe, ertesi gün yeniden denenir.
  const kapananlar: string[] = [];
  const sezonHatalari: string[] = [];
  for (const sezon of await bitenSezonlar()) {
    try {
      const kapandi = await birKezCalistir("sezon-kapat", sezon.name, async () => {
        await sezonKapat(sezon);
        return sezon.name;
      });
      if (kapandi !== undefined) kapananlar.push(kapandi);
    } catch (err) {
      console.error("sezonKapat", sezon.name, err);
      sezonHatalari.push(`${sezon.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (kapananlar.length) rapor.sezonKapandi = kapananlar;
  if (sezonHatalari.length) rapor.sezonHata = sezonHatalari;
  await aktifSezon(); // yeni ayın sezonu (yoksa açar)

  // 3) Ayın kitabı (her ayın ilk günü)
  if (new Date().getDate() === 1) {
    const secildi = await birKezCalistir("ayin-kitabi", bugun.slice(0, 7), async () => {
      await ayinKitabi();
      return true;
    });
    if (secildi !== undefined) rapor.ayinKitabi = secildi;
  }

  // 4) Biten özel ligler (lig başına kilit + try/catch; hata rapora)
  const ozel = await ozelLigleriKapat();
  if (ozel.kapanan) rapor.ozelLig = ozel.kapanan;
  if (ozel.hata.length) rapor.ozelLigHata = ozel.hata;

  // 5) Bekleyen puanlar: olgunlaşanlar kesinleşir, süresi dolanlar düşer (ADR 0001 K2)
  const bekleyen = await birKezCalistir("bekleyen", bugun, () => bekleyenleriIsle());
  if (bekleyen !== undefined) rapor.bekleyen = bekleyen;

  // 6) Davet ziyaret kayıtları SAKLAMA_GUN.davetZiyareti (30) gün saklanır (PRD §4.3; /gizlilik aynı sabiti okur)
  const temizlik = await birKezCalistir("davet-ziyaret-temizlik", bugun, async () => {
    const silinen = await db
      .delete(schema.inviteVisits)
      .where(lt(schema.inviteVisits.createdAt, new Date(Date.now() - SAKLAMA_GUN.davetZiyareti * 864e5)))
      .returning({ id: schema.inviteVisits.id });
    return silinen.length;
  });
  if (temizlik !== undefined) rapor.davetZiyaretTemizlik = temizlik;

  // 6b) Kayıt imzaları SAKLAMA_GUN.kayitImzasi (7) gün saklanır (kişisel veri en az; tarama bağ olayı son 48 saatte
  // olan hesaplara bakar; işaretli hesabın imzası karar verilene dek kalır — "Kümeyi temizle" kümeyi görsün)
  const imza = await birKezCalistir("imza-temizlik", bugun, () => imzalariUnut());
  if (imza !== undefined) rapor.imzaTemizlik = imza;

  // 7) Etkinlik sonrası (ADR 0001 K2 — bekleyen satır YOK, canlı sayım): bitişten 48 saat sonra
  // düzenleyen payı (min(giriş,100)×5), 7 gün sonra iyi değerlendirme (+50). Etkinlik başına
  // tek-atış kilit; tek bozuk etkinlik diğerlerini durdurmaz (içeride yakalanır).
  const etkinlik = await etkinlikSonrasiIsle();
  if (etkinlik.host || etkinlik.iyiDegerlendirme || etkinlik.hata) rapor.etkinlik = etkinlik;

  // 8) Canlılık havuzu (F5-02): son TAMAMLANAN TR haftası + bir önceki (bütün bir hafta kaçırılsa da ödenir —
  // D4 kararı; kilit hafta etiketiyle, çift ödeme yok). Açılıştan önceki haftalar ödenmez.
  const son = sonTamamlananHafta();
  const havuzlar: Record<string, unknown>[] = [];
  for (const hafta of [isoHafta(new Date(son.baslangic.getTime() - 1)), son]) {
    if (hafta.etiket < CANLILIK_ILK_HAFTA) continue;
    const canlilik = await birKezCalistir("canlilik-havuzu", hafta.etiket, () => canlilikHavuzuDagit(hafta));
    if (canlilik !== undefined) havuzlar.push({ hafta: hafta.etiket, ...canlilik });
  }
  if (havuzlar.length) rapor.canlilikHavuzu = havuzlar;

  return new Response(JSON.stringify({ ok: true, ...rapor }), {
    headers: { "content-type": "application/json" },
  });
};
