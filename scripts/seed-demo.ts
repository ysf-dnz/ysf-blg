/**
 * Numune veri seti — tüm platform özelliklerini görünür/test edilir kılar.
 * İdempotent: demo_ clerkId'li kullanıcıları ve onlara bağlı her şeyi
 * silip yeniden kurar. Koşum: npm run seed:demo
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, inArray, like } from "drizzle-orm";
import * as schema from "../src/db/schema.ts";

const url = process.env.POSTGRES_URL;
if (!url) throw new Error("POSTGRES_URL yok (node --env-file=.env.local ...)");
const db = drizzle(neon(url), { schema });

// Kataloğdan gerçek kitap id'leri
const booksJson = JSON.parse(readFileSync("src/data/books.json", "utf8"));
const tumKitaplar: { id: string; title: string }[] = [];
(function walk(o: unknown) {
  if (Array.isArray(o)) return o.forEach(walk);
  if (o && typeof o === "object") {
    const x = o as Record<string, unknown>;
    if (typeof x.id === "string" && typeof x.title === "string" && x.id.length > 20)
      tumKitaplar.push({ id: x.id, title: x.title });
    Object.values(x).forEach(walk);
  }
})(booksJson);
const kitapId = (i: number) => tumKitaplar[i % tumKitaplar.length]!.id;
const MINDSET = "1JlqnQCbEoW5DGVOXte4O88AdSofFbH2Z";
const LEARNING_GO = "1h6nwQ-jHvqKuCtpiP3kdb5GsBtOcPww6";
const EFFECTIVE_GO = "1pASwcWSHzwO55U2Lv-v4giPCoZBmdy-l";

/** Etkinlikleri FK sırasıyla sil: değerlendirme, görevli, etkinlik davet kodları (+ziyaret), kayıt */
async function etkinlikleriSil(eids: number[]) {
  if (eids.length === 0) return;
  await db.delete(schema.ratings).where(inArray(schema.ratings.eventId, eids));
  await db.delete(schema.eventStaff).where(inArray(schema.eventStaff.eventId, eids));
  const kodlar = await db.query.inviteCodes.findMany({
    where: and(eq(schema.inviteCodes.targetType, "event"), inArray(schema.inviteCodes.targetId, eids)),
  });
  if (kodlar.length) {
    await db.delete(schema.inviteVisits).where(inArray(schema.inviteVisits.inviteCodeId, kodlar.map((k) => k.id)));
    await db.delete(schema.inviteCodes).where(inArray(schema.inviteCodes.id, kodlar.map((k) => k.id)));
  }
  await db.delete(schema.eventRsvps).where(inArray(schema.eventRsvps.eventId, eids));
  await db.delete(schema.events).where(inArray(schema.events.id, eids));
}

async function temizle() {
  const eski = await db.query.users.findMany({
    where: like(schema.users.clerkId, "demo_%"),
  });
  if (eski.length === 0) return;
  const ids = eski.map((u) => u.id);
  // Bağımlı tablolar (FK sırasıyla)
  await db.delete(schema.courseProgress).where(inArray(schema.courseProgress.userId, ids));
  await db.delete(schema.courseEnrollments).where(inArray(schema.courseEnrollments.userId, ids));
  await db.delete(schema.ratings).where(inArray(schema.ratings.userId, ids));
  await db.delete(schema.courseResources).where(inArray(schema.courseResources.userId, ids));
  await db.delete(schema.reports).where(inArray(schema.reports.reporterId, ids));
  await db.delete(schema.pendingPoints).where(inArray(schema.pendingPoints.userId, ids));
  const demoKodlar = await db.query.inviteCodes.findMany({ where: inArray(schema.inviteCodes.inviterId, ids) });
  if (demoKodlar.length) {
    await db.delete(schema.inviteVisits).where(inArray(schema.inviteVisits.inviteCodeId, demoKodlar.map((k) => k.id)));
    await db.delete(schema.inviteCodes).where(inArray(schema.inviteCodes.id, demoKodlar.map((k) => k.id)));
  }
  const kurslar = await db.query.courses.findMany({ where: inArray(schema.courses.createdBy, ids) });
  if (kurslar.length) {
    const cids = kurslar.map((c) => c.id);
    const ogeler = await db.query.courseItems.findMany({ where: inArray(schema.courseItems.courseId, cids) });
    if (ogeler.length) {
      const yorumlar = await db.query.comments.findMany({ where: inArray(schema.comments.courseItemId, ogeler.map((o) => o.id)) });
      if (yorumlar.length) await db.delete(schema.likes).where(inArray(schema.likes.commentId, yorumlar.map((y) => y.id)));
      await db.delete(schema.comments).where(inArray(schema.comments.courseItemId, ogeler.map((o) => o.id)));
    }
    await db.delete(schema.courseProgress).where(inArray(schema.courseProgress.courseId, cids));
    await db.delete(schema.courseEnrollments).where(inArray(schema.courseEnrollments.courseId, cids));
    await db.delete(schema.ratings).where(inArray(schema.ratings.courseId, cids));
    await db.delete(schema.courseResources).where(inArray(schema.courseResources.courseId, cids));
    await db.delete(schema.courseItems).where(inArray(schema.courseItems.courseId, cids));
    await db.delete(schema.courses).where(inArray(schema.courses.id, cids));
  }
  await db.delete(schema.likes).where(inArray(schema.likes.userId, ids));
  const gonderiler = await db.query.feedPosts.findMany({ where: inArray(schema.feedPosts.userId, ids) });
  if (gonderiler.length) {
    const gids = gonderiler.map((g) => g.id);
    await db.delete(schema.likes).where(inArray(schema.likes.feedPostId, gids));
    await db.delete(schema.comments).where(inArray(schema.comments.feedPostId, gids));
    await db.delete(schema.feedPosts).where(inArray(schema.feedPosts.id, gids));
  }
  await db.delete(schema.comments).where(inArray(schema.comments.userId, ids));
  const yazilar = await db.query.memberPosts.findMany({ where: inArray(schema.memberPosts.userId, ids) });
  if (yazilar.length) {
    await db.delete(schema.likes).where(inArray(schema.likes.memberPostId, yazilar.map((y) => y.id)));
    await db.delete(schema.memberPosts).where(inArray(schema.memberPosts.id, yazilar.map((y) => y.id)));
  }
  const kulupler = await db.query.clubs.findMany({ where: inArray(schema.clubs.presidentId, ids) });
  if (kulupler.length) {
    const kids = kulupler.map((k) => k.id);
    const kampanyalar = await db.query.campaigns.findMany({ where: inArray(schema.campaigns.clubId, kids) });
    if (kampanyalar.length) {
      await db.delete(schema.campaignTasks).where(inArray(schema.campaignTasks.campaignId, kampanyalar.map((c) => c.id)));
      await db.delete(schema.campaigns).where(inArray(schema.campaigns.id, kampanyalar.map((c) => c.id)));
    }
    await db.delete(schema.clubBooks).where(inArray(schema.clubBooks.clubId, kids));
    await db.delete(schema.clubLeagues).where(inArray(schema.clubLeagues.clubId, kids));
    await db.delete(schema.clubGroups).where(inArray(schema.clubGroups.clubId, kids));
    await db.delete(schema.clubMembers).where(inArray(schema.clubMembers.clubId, kids));
    const etkinlikler = await db.query.events.findMany({ where: inArray(schema.events.clubId, kids) });
    await etkinlikleriSil(etkinlikler.map((e) => e.id));
    await db.delete(schema.clubs).where(inArray(schema.clubs.id, kids));
  }
  const demoEtkinlik = await db.query.events.findMany({ where: inArray(schema.events.createdBy, ids) });
  await etkinlikleriSil(demoEtkinlik.map((e) => e.id));
  // Demo üyenin gerçek etkinliklerdeki izleri (görevlilik, okuttuğu biletler)
  await db.delete(schema.eventStaff).where(inArray(schema.eventStaff.userId, ids));
  await db.update(schema.eventRsvps).set({ checkedInBy: null }).where(inArray(schema.eventRsvps.checkedInBy, ids));
  const quizler = await db.query.quizzes.findMany({ where: inArray(schema.quizzes.createdBy, ids) });
  if (quizler.length) {
    const qids = quizler.map((q) => q.id);
    await db.delete(schema.quizAttempts).where(inArray(schema.quizAttempts.quizId, qids));
    await db.delete(schema.quizQuestions).where(inArray(schema.quizQuestions.quizId, qids));
    await db.delete(schema.quizzes).where(inArray(schema.quizzes.id, qids));
  }
  await db.delete(schema.quizAttempts).where(inArray(schema.quizAttempts.userId, ids));
  await db.delete(schema.eventRsvps).where(inArray(schema.eventRsvps.userId, ids));
  await db.delete(schema.learningList).where(inArray(schema.learningList.userId, ids));
  await db.delete(schema.follows).where(inArray(schema.follows.followerId, ids));
  await db.delete(schema.follows).where(inArray(schema.follows.followedId, ids));
  await db.delete(schema.referrals).where(inArray(schema.referrals.inviterId, ids));
  await db.delete(schema.referrals).where(inArray(schema.referrals.invitedId, ids));
  await db.delete(schema.applications).where(inArray(schema.applications.userId, ids));
  await db.delete(schema.notifications).where(inArray(schema.notifications.userId, ids));
  await db.delete(schema.bookAccess).where(inArray(schema.bookAccess.userId, ids));
  await db.delete(schema.badges).where(inArray(schema.badges.userId, ids));
  await db.delete(schema.pointsLedger).where(inArray(schema.pointsLedger.userId, ids));
  await db.delete(schema.users).where(inArray(schema.users.id, ids));
  console.log(`♻︎ ${ids.length} eski demo üye ve bağlı verileri temizlendi`);
}

async function kur() {
  const avatar = (s: number) => `https://i.pravatar.cc/150?img=${s}`;
  const [ayse, mehmet, zeynep, can, elif] = await db
    .insert(schema.users)
    .values([
      { clerkId: "demo_ayse", handle: "ayse-demir", name: "Ayşe Demir", avatarUrl: avatar(47), university: "ODTÜ", city: "Ankara", role: "rep", flair: "🔥", bio: "YZ okuma kulübü başkanı. Öğrenmenin en iyi yolu öğretmektir.", socials: JSON.stringify({ linkedin: "https://linkedin.com/in/ayse-demo", github: "https://github.com/ayse-demo" }) },
      { clerkId: "demo_mehmet", handle: "mehmet-kaya", name: "Mehmet Kaya", avatarUrl: avatar(12), university: "İTÜ", city: "İstanbul", role: "member" },
      { clerkId: "demo_zeynep", handle: "zeynep-arslan", name: "Zeynep Arslan", avatarUrl: avatar(32), university: "Ege Üniversitesi", city: "İzmir", role: "member", flair: "📚", socials: JSON.stringify({ youtube: "https://youtube.com/@zeynep-demo" }) },
      { clerkId: "demo_can", handle: "can-yildiz", name: "Can Yıldız", avatarUrl: avatar(59), city: "Konya", role: "member", bio: "Lise son. Go öğreniyorum.", createdAt: new Date(Date.now() - 3 * 864e5) },
      { clerkId: "demo_elif", handle: "elif-celik", name: "Elif Çelik", avatarUrl: avatar(25), university: "Boğaziçi", city: "İstanbul", role: "member", flair: "🚀", bio: "Yazdıkça öğreniyorum." },
    ])
    .returning();
  const U = { ayse: ayse!, mehmet: mehmet!, zeynep: zeynep!, can: can!, elif: elif! };

  // Puan defterleri (seviyeler: Elif Sv5 ~200+, Ayşe Sv4 ~155+, Zeynep Sv3, Mehmet Sv2, Can Sv1)
  const puanlar: { u: typeof ayse; delta: number; reason: string }[] = [
    { u: U.elif, delta: 50, reason: "welcome" }, { u: U.elif, delta: 100, reason: "post_approved" },
    { u: U.elif, delta: 100, reason: "post_approved" }, { u: U.elif, delta: 42, reason: "quiz" },
    { u: U.elif, delta: 75, reason: "task_done" }, { u: U.elif, delta: 8, reason: "like_received" },
    { u: U.ayse, delta: 50, reason: "welcome" }, { u: U.ayse, delta: 100, reason: "post_approved" },
    { u: U.ayse, delta: 38, reason: "quiz" }, { u: U.ayse, delta: 25, reason: "referral_joined" },
    { u: U.ayse, delta: 75, reason: "referral_activated" },
    { u: U.zeynep, delta: 50, reason: "welcome" }, { u: U.zeynep, delta: 100, reason: "post_approved" },
    { u: U.mehmet, delta: 50, reason: "welcome" },
    { u: U.can, delta: 50, reason: "welcome" },
  ];
  await db.insert(schema.pointsLedger).values(
    puanlar.map((p) => ({ userId: p.u!.id, delta: p.delta, reason: p.reason as never })),
  );

  // Kitap erişimleri + Bilgi Hazineleri (5'li listeler)
  for (const [i, u] of [U.ayse, U.mehmet, U.zeynep, U.can, U.elif].entries()) {
    const liste = [MINDSET, LEARNING_GO, EFFECTIVE_GO, kitapId(i * 7 + 3), kitapId(i * 7 + 4)];
    await db.insert(schema.learningList).values(liste.map((bookId, order) => ({ userId: u!.id, bookId, order })));
    await db.insert(schema.bookAccess).values({ userId: u!.id, bookId: liste[0]!, source: "gift" }).onConflictDoNothing();
    if (i % 2 === 0)
      await db.insert(schema.bookAccess).values({ userId: u!.id, bookId: liste[1]!, source: "points" }).onConflictDoNothing();
  }

  // Takipler
  await db.insert(schema.follows).values([
    { followerId: U.ayse!.id, followedId: U.elif!.id },
    { followerId: U.mehmet!.id, followedId: U.elif!.id },
    { followerId: U.can!.id, followedId: U.ayse!.id },
    { followerId: U.zeynep!.id, followedId: U.ayse!.id },
  ]);

  // Üye yazıları (2'si kitaba bağlı, 1'i yalnız üyeler)
  const [y1, y2, y3, y4] = await db
    .insert(schema.memberPosts)
    .values([
      { userId: U.elif!.id, bookId: MINDSET, title: "Mindset bana sınav kaygımı nasıl unutturdu?", markdown: "## Sabit zihniyetten büyüme zihniyetine\n\nDweck'in en çarpıcı iddiası: yetenek **başlangıç noktasıdır**, tavan değil.\n\n1. Hata = veri\n2. Çaba = yol\n3. Eleştiri = hediye\n\n> Nöronlar zorlandıkça büyür.\n\nSınavlara bakışım tamamen değişti.", slug: "mindset-sinav-kaygisi-demo", status: "published", publishedAt: new Date(Date.now() - 3 * 864e5) },
      { userId: U.ayse!.id, bookId: LEARNING_GO, title: "Learning Go'nun 3. bölümü: slice'ları nihayet anladım", markdown: "## Slice ≠ Dizi\n\nGo'da slice'lar **görünümdür**, kopya değil.\n\n```\ns := arr[1:3]\n```\n\nBu satır bellek paylaşır — kulüpteki herkesin bilmesi gereken ilk tuzak.", slug: "learning-go-slice-demo", status: "published", publishedAt: new Date(Date.now() - 2 * 864e5) },
      { userId: U.zeynep!.id, bookId: null, title: "Bir haftada okuma alışkanlığı: kulüp etkisi", markdown: "Tek başıma 3 sayfa okuyamıyordum; kulüpte haftada bir kitap bitiriyoruz. Sırrı: **görev panosu** + küçük sözler.", slug: "okuma-aliskanligi-kulup-demo", status: "published", visibility: "members", publishedAt: new Date(Date.now() - 864e5) },
      { userId: U.mehmet!.id, bookId: EFFECTIVE_GO, title: "Effective Go notlarım (taslak)", markdown: "## İlk izlenimler\n\n- error handling felsefesi\n- interface küçüklüğü", slug: "effective-go-notlar-demo", status: "pending" },
    ])
    .returning();
  await db.insert(schema.likes).values([
    { userId: U.ayse!.id, memberPostId: y1!.id },
    { userId: U.mehmet!.id, memberPostId: y1!.id },
    { userId: U.can!.id, memberPostId: y1!.id },
    { userId: U.elif!.id, memberPostId: y2!.id },
  ]);

  // Feed
  const feedler = await db
    .insert(schema.feedPosts)
    .values([
      { userId: U.can!.id, category: "soru", body: "Learning Go 5. bölümde goroutine'lere geldim — channel'ları gerçek hayatta en çok nerede kullanıyorsunuz?", bookId: LEARNING_GO },
      { userId: U.elif!.id, category: "ilerleme", body: "Mindset yazım yayınlandı 🎉 +100 puan geldi, sıradaki hazinem Effective Go'ya 58 puan kaldı!" },
      { userId: U.ayse!.id, category: "duyuru", body: "ODTÜ YZ Okuma Kulübü: Golang Ayı kampanyası başladı! Panoda 6 görev var, üretimler ×1.5 puan 🔥" },
      { userId: U.zeynep!.id, category: "kaynak", body: "Go tour'u bitirenler için harika bir alıştırma seti buldum, kulüp kitaplığına ekledim 📚" },
      { userId: U.mehmet!.id, category: "ilerleme", body: "İlk quiz denemem: 4/5 🧠 Hız bonusu fena değilmiş." },
    ])
    .returning();
  await db.insert(schema.comments).values([
    { userId: U.ayse!.id, feedPostId: feedler[0]!.id, body: "Worker pool deseni! Kampanya görevlerinden birinde tam bunu yazacaksın 😊" },
    { userId: U.elif!.id, feedPostId: feedler[0]!.id, body: "fan-in/fan-out örneklerine bak, kitabın 10. bölümü harika." },
    { userId: U.can!.id, feedPostId: feedler[2]!.id, body: "Podcast görevini ben üstlendim 🎙️" },
  ]);
  await db.insert(schema.likes).values([
    { userId: U.elif!.id, feedPostId: feedler[0]!.id },
    { userId: U.ayse!.id, feedPostId: feedler[0]!.id },
    { userId: U.mehmet!.id, feedPostId: feedler[2]!.id },
    { userId: U.zeynep!.id, feedPostId: feedler[2]!.id },
    { userId: U.can!.id, feedPostId: feedler[1]!.id },
  ]);

  // Kulüp + ortak kitaplık + kampanya + görevler
  const [kulup] = await db
    .insert(schema.clubs)
    .values({ slug: "odtu-yz-okuma-demo", name: "ODTÜ Yapay Zekâ Okuma Kulübü", kind: "universite", place: "ODTÜ", il: "Ankara", presidentId: U.ayse!.id, status: "approved", description: "Her ay bir kitap: oku → üret → paylaş. Görev panosuyla birlikte öğreniyoruz." })
    .returning();
  await db.insert(schema.clubMembers).values([
    { clubId: kulup!.id, userId: U.ayse!.id, role: "president" },
    { clubId: kulup!.id, userId: U.elif!.id, role: "mod" },
    { clubId: kulup!.id, userId: U.mehmet!.id, role: "member" },
    { clubId: kulup!.id, userId: U.can!.id, role: "member" },
  ]);
  // İkinci topluluk (Faz 3): farklı tür + il → Topluluklarımız filtreleri görünür/test edilir
  const [vakif] = await db
    .insert(schema.clubs)
    .values({ slug: "izmir-okuma-vakfi-demo", name: "İzmir Okuma Vakfı", kind: "vakif", place: "Konak", il: "İzmir", presidentId: U.zeynep!.id, status: "approved", description: "Mahalle kütüphanelerinde gönüllü okuma halkaları." })
    .returning();
  await db.insert(schema.clubMembers).values([
    { clubId: vakif!.id, userId: U.zeynep!.id, role: "president" },
    { clubId: vakif!.id, userId: U.elif!.id, role: "member" },
  ]);
  await db.insert(schema.clubBooks).values([
    { clubId: kulup!.id, bookId: LEARNING_GO, addedBy: U.ayse!.id, note: "Bu ayın ana kitabı — kampanya buradan yürüyor." },
    { clubId: kulup!.id, bookId: MINDSET, addedBy: U.elif!.id, note: "Dönem başı motivasyonu için birebir." },
    { clubId: kulup!.id, title: "Go Tour alıştırma çözümlerim", url: "https://github.com/ayse-demo/go-tour", note: "Takıldığınız yerde bakın, kopyalamayın 😊", addedBy: U.zeynep!.id },
  ]);
  const [kampanya] = await db
    .insert(schema.campaigns)
    .values({ clubId: kulup!.id, bookId: LEARNING_GO, title: "Golang Ayı", ownerId: U.ayse!.id, status: "active" })
    .returning();
  const gorevler = await db
    .insert(schema.campaignTasks)
    .values([
      { campaignId: kampanya!.id, title: "Bölüm 1-3 özeti (Instagram carousel)", kind: "sosyal_medya", status: "done", assigneeId: U.elif!.id, rewardPoints: 50, submissionUrl: "https://instagram.com/p/demo1" },
      { campaignId: kampanya!.id, title: "Goroutine'ler slayt seti", kind: "slayt", status: "review", assigneeId: U.mehmet!.id, rewardPoints: 60, submissionUrl: "https://docs.google.com/presentation/demo" },
      { campaignId: kampanya!.id, title: "Kitap sohbeti podcast bölümü", kind: "podcast", status: "claimed", assigneeId: U.can!.id, rewardPoints: 80, claimedAt: new Date() },
      { campaignId: kampanya!.id, title: "5. bölüm için quiz seti", kind: "quiz_seti", status: "backlog", rewardPoints: 50 },
      { campaignId: kampanya!.id, title: "Haftalık okuma maratonu organizasyonu", kind: "etkinlik", status: "backlog", rewardPoints: 40 },
      { campaignId: kampanya!.id, title: "Slice/map yazısı (topluluk)", kind: "yazi", status: "done", assigneeId: U.ayse!.id, rewardPoints: 50, submissionUrl: "https://example.com/topluluk/learning-go-slice-demo" },
    ])
    .returning();
  await db.insert(schema.pointsLedger).values([
    { userId: U.elif!.id, delta: 75, reason: "task_done", refId: String(gorevler[0]!.id) },
    { userId: U.ayse!.id, delta: 75, reason: "task_done", refId: String(gorevler[5]!.id) },
  ]);

  // Quiz (Mindset yayında + Learning Go bekleyen)
  const [quiz] = await db
    .insert(schema.quizzes)
    .values({ bookId: MINDSET, title: "Mindset: Büyüme Zihniyeti Testi", createdBy: U.elif!.id, status: "published" })
    .returning();
  await db.insert(schema.quizQuestions).values([
    { quizId: quiz!.id, question: "Dweck'e göre 'sabit zihniyet' neye inanır?", options: JSON.stringify(["Yetenek geliştirilebilir", "Yetenek doğuştan ve değişmez", "Çaba her şeydir", "Hata öğretir"]), correctIndex: 1, durationSec: 20, order: 0 },
    { quizId: quiz!.id, question: "Büyüme zihniyetinde hata ne anlama gelir?", options: JSON.stringify(["Yetersizlik kanıtı", "Kaçınılması gereken şey", "Öğrenme verisi", "Şanssızlık"]), correctIndex: 2, durationSec: 15, order: 1 },
    { quizId: quiz!.id, question: "Zorlandığında nöronlara ne olur?", options: JSON.stringify(["Ölürler", "Bağlantılar güçlenir", "Değişmez", "Yavaşlar"]), correctIndex: 1, durationSec: 15, order: 2 },
    { quizId: quiz!.id, question: "'Henüz' kelimesinin gücü nedir?", options: JSON.stringify(["Erteleme bahanesi", "Süreç vurgusu — öğrenme devam ediyor", "Kibarlık", "Zaman kazanma"]), correctIndex: 1, durationSec: 20, order: 3 },
    { quizId: quiz!.id, question: "Övgü nasıl yapılmalı?", options: JSON.stringify(["Zekâya: 'çok zekisin'", "Sonuca: 'birincisin'", "Sürece: 'çabana hayranım'", "Hiç yapılmamalı"]), correctIndex: 2, durationSec: 20, order: 4 },
  ]);
  await db.insert(schema.quizAttempts).values([
    { quizId: quiz!.id, userId: U.elif!.id, score: 42, correctCount: 5, totalCount: 5 },
    { quizId: quiz!.id, userId: U.mehmet!.id, score: 28, correctCount: 4, totalCount: 5 },
  ]);
  const [bekleyenQuiz] = await db
    .insert(schema.quizzes)
    .values({ bookId: LEARNING_GO, title: "Learning Go 1-5: Temeller", createdBy: U.can!.id, status: "pending" })
    .returning();
  await db.insert(schema.quizQuestions).values([
    { quizId: bekleyenQuiz!.id, question: "Go'da := ne yapar?", options: JSON.stringify(["Atama", "Kısa değişken tanımı", "Karşılaştırma", "Kanal"]), correctIndex: 1, durationSec: 15, order: 0 },
    { quizId: bekleyenQuiz!.id, question: "Slice nedir?", options: JSON.stringify(["Dizinin kopyası", "Dizi üzerine görünüm", "Map türü", "Pointer"]), correctIndex: 1, durationSec: 20, order: 1 },
    { quizId: bekleyenQuiz!.id, question: "go anahtar kelimesi ne başlatır?", options: JSON.stringify(["Paket", "Goroutine", "Modül", "Test"]), correctIndex: 1, durationSec: 15, order: 2 },
  ]);

  // Eğitim: karışık müfredat (2 video + 1 yazı + 1 quiz)
  const [kurs] = await db
    .insert(schema.courses)
    .values({
      clubId: kulup!.id,
      bookId: LEARNING_GO,
      slug: "sifirdan-go-learning-go-yol-haritasi-demo",
      title: "Sıfırdan Go: Learning Go Yol Haritası",
      description: "Video izle → yazı oku → quiz çöz. Kulübün ortak müfredatı.",
      summary: "4 öğede Go'nun temellerini kur, goroutine'lere ilk adımı at.",
      level: "baslangic",
      estMinutes: 90,
      status: "published",
      createdBy: U.ayse!.id,
    })
    .returning();
  const kursOgeleri = await db
    .insert(schema.courseItems)
    .values([
      { courseId: kurs!.id, order: 0, kind: "youtube", title: "Go Kurulum ve İlk Program", youtubeId: "446E-r0rXHI" },
      { courseId: kurs!.id, order: 1, kind: "yazi", title: y2!.title, memberPostId: y2!.id },
      { courseId: kurs!.id, order: 2, kind: "youtube", title: "Goroutine'lere Giriş", youtubeId: "f6kdp27TYZs" },
      { courseId: kurs!.id, order: 3, kind: "quiz", title: quiz!.title, quizId: quiz!.id },
    ])
    .returning();
  // Davet kodu (Ayşe → demo kurs; sabit kod e2e için) + ziyaretler
  const [davetKodu] = await db
    .insert(schema.inviteCodes)
    .values({ code: "DEM07KQ", inviterId: U.ayse!.id, targetType: "course", targetId: kurs!.id, note: "Birlikte başlayalım, ilk öğeyi bu hafta bitiriyoruz 🚀" })
    .returning();
  await db.insert(schema.inviteVisits).values([
    { inviteCodeId: davetKodu!.id, ipHash: "demo-ip-1", uaHash: "demo-ua", kanal: "qr" },
    { inviteCodeId: davetKodu!.id, ipHash: "demo-ip-2", uaHash: "demo-ua", kanal: "qr" },
    { inviteCodeId: davetKodu!.id, ipHash: "demo-ip-3", uaHash: "demo-ua", kanal: "link" },
  ]);
  // Katılımlar: Elif %50 (aktive), Mehmet katıldı ama başlamadı, Can aktive (Ayşe'nin davetiyle)
  const ikiGunOnce = new Date(Date.now() - 2 * 864e5);
  await db.insert(schema.courseEnrollments).values([
    { userId: U.elif!.id, courseId: kurs!.id, joinedAt: ikiGunOnce, activatedAt: ikiGunOnce },
    { userId: U.mehmet!.id, courseId: kurs!.id, joinedAt: ikiGunOnce },
    { userId: U.can!.id, courseId: kurs!.id, joinedAt: ikiGunOnce, activatedAt: ikiGunOnce, inviteCodeId: davetKodu!.id },
  ]);
  await db.insert(schema.courseProgress).values([
    { userId: U.elif!.id, courseId: kurs!.id, itemId: kursOgeleri[0]!.id },
    { userId: U.elif!.id, courseId: kurs!.id, itemId: kursOgeleri[1]!.id },
    { userId: U.can!.id, courseId: kurs!.id, itemId: kursOgeleri[0]!.id },
  ]);
  // Can davetle aktive oldu → davet puanları kesinleşmiş (tutarlı demo: Davetlerim "Aktive 1, +15")
  await db.insert(schema.pointsLedger).values([
    { userId: U.can!.id, delta: 10, reason: "course_invite_welcome", refId: `course:${kurs!.id}` },
    { userId: U.ayse!.id, delta: 15, reason: "course_invite_activated", refId: `course:${kurs!.id}:u:${U.can!.id}` },
  ]);
  // İkinci kurs (Elif, kulüp dışı, yayında): e2e davet akışı test üyesi için (henüz katılmamış)
  const [kurs2] = await db
    .insert(schema.courses)
    .values({
      bookId: LEARNING_GO,
      slug: "go-ile-cli-araclari-demo",
      title: "Go ile Küçük CLI Araçları",
      summary: "Üç kısa videoda flag, dosya ve HTTP ile ilk aracını yaz.",
      level: "orta",
      estMinutes: 45,
      status: "published",
      createdBy: U.elif!.id,
    })
    .returning();
  await db.insert(schema.courseItems).values([
    { courseId: kurs2!.id, order: 0, kind: "youtube", title: "flag paketi ile argümanlar", youtubeId: "446E-r0rXHI" },
    { courseId: kurs2!.id, order: 1, kind: "youtube", title: "Dosya okuma-yazma", youtubeId: "f6kdp27TYZs" },
    { courseId: kurs2!.id, order: 2, kind: "youtube", title: "HTTP istemcisi", youtubeId: "446E-r0rXHI" },
  ]);
  await db.insert(schema.inviteCodes).values({ code: "DEM0C21", inviterId: U.elif!.id, targetType: "course", targetId: kurs2!.id, note: "CLI yazmayı birlikte öğrenelim" });

  // Soru-cevap + ek kaynak + değerlendirme (kurs sayfası boş görünmesin)
  const [soru] = await db
    .insert(schema.comments)
    .values({ userId: U.elif!.id, courseItemId: kursOgeleri[0]!.id, body: "go install ile go get farkı ne? Modül dışında çalıştırınca hata aldım." })
    .returning();
  // En iyi cevap üreticinin değil bir katılımcının (API kendi cevabını seçmeye izin vermez)
  await db.insert(schema.comments).values([
    { userId: U.can!.id, courseItemId: kursOgeleri[0]!.id, body: "go install derlenen binary'yi $GOPATH/bin'e koyar; go get artık yalnız bağımlılık ekler. Modül dışı için GOFLAGS=-mod=mod dene.", acceptedAt: new Date() },
    { userId: U.ayse!.id, courseItemId: kursOgeleri[0]!.id, body: "Can doğru söylüyor; 2. videoda modül yapısını ayrıca anlatıyorum." },
  ]);
  await db.insert(schema.likes).values({ userId: U.can!.id, commentId: soru!.id });
  await db.insert(schema.courseResources).values([
    { courseId: kurs!.id, userId: U.can!.id, url: "https://go.dev/tour/welcome/1", note: "Resmî Go turu — 1. videoyla paralel gidiyor.", status: "accepted", acceptedAt: new Date() },
    { courseId: kurs!.id, userId: U.elif!.id, url: "https://gobyexample.com/", note: "Örnekle öğrenenler için.", status: "pending" },
  ]);
  await db.insert(schema.ratings).values({ userId: U.can!.id, courseId: kurs!.id, stars: 5, body: "Video + yazı karışımı çok iyi oturmuş." });

  // ---- Etkinlikler (Faz 3): yaklaşan + devam eden + bitmiş ----
  const SAAT = 3600e3;
  const simdi = Date.now();
  // 1) Yaklaşan (6 gün sonra, 2 saat, kontenjan 40): kayıt + etkinlik daveti (Elif → Can, bekleyen).
  // e2e bu etkinliğin BİTMEMİŞ olmasına dayanır → seed'den sonra 6 gün geçerli (maraton 13 gün).
  const [etkinlik] = await db
    .insert(schema.events)
    .values({ clubId: kulup!.id, campaignId: kampanya!.id, slug: "canli-quiz-gecesi-demo", title: "Canlı Quiz Gecesi: Learning Go", description: "Kampanya finali — kazanana kitap ödülü!", kind: "bulusma", startsAt: new Date(simdi + 144 * SAAT), endsAt: new Date(simdi + 146 * SAAT), location: "ODTÜ Kütüphane B1", il: "Ankara", capacity: 40, createdBy: U.ayse!.id })
    .returning();
  await db.insert(schema.eventStaff).values([
    { eventId: etkinlik!.id, userId: U.ayse!.id, role: "host" },
    { eventId: etkinlik!.id, userId: U.mehmet!.id, role: "scanner" },
  ]);
  const [etkinlikKodu] = await db
    .insert(schema.inviteCodes)
    .values({ code: "DEMEV01", inviterId: U.elif!.id, targetType: "event", targetId: etkinlik!.id, note: "Quiz gecesinde aynı takımda olalım 🧠" })
    .returning();
  await db.insert(schema.inviteVisits).values([
    { inviteCodeId: etkinlikKodu!.id, ipHash: "demo-ip-4", uaHash: "demo-ua", kanal: "qr" },
    { inviteCodeId: etkinlikKodu!.id, ipHash: "demo-ip-5", uaHash: "demo-ua", kanal: "link" },
  ]);
  await db.insert(schema.eventRsvps).values([
    { eventId: etkinlik!.id, userId: U.elif!.id, priority: true },
    { eventId: etkinlik!.id, userId: U.mehmet!.id },
    { eventId: etkinlik!.id, userId: U.can!.id, inviteCodeId: etkinlikKodu!.id },
  ]);
  await db.insert(schema.pendingPoints).values({
    userId: U.elif!.id, delta: 10, reason: "event_invite_attended", refId: `event:${etkinlik!.id}:u:${U.can!.id}`,
    note: 'Can Yıldız "Canlı Quiz Gecesi: Learning Go" etkinliğinde giriş yapınca', expiresAt: new Date(simdi + 146 * SAAT),
  });

  // 2) Devam eden (çevrimiçi maraton, 14 gün): giriş doğrulaması bugün denenebilir (e2e dönen QR)
  const [maraton] = await db
    .insert(schema.events)
    .values({ slug: "go-okuma-maratonu-demo", title: "Go Okuma Maratonu (çevrimiçi)", description: "İki hafta boyunca her akşam 30 dakika birlikte okuyoruz. Girişini ekrandaki QR ile doğrulat.", kind: "cevrimici", startsAt: new Date(simdi - SAAT), endsAt: new Date(simdi + 13 * 24 * SAAT), location: "Discord #okuma-odasi", createdBy: U.ayse!.id })
    .returning();
  await db.insert(schema.eventStaff).values([
    { eventId: maraton!.id, userId: U.ayse!.id, role: "host" },
    { eventId: maraton!.id, userId: U.elif!.id, role: "host" },
  ]);
  const [maratonKodu] = await db
    .insert(schema.inviteCodes)
    .values({ code: "DEMEV02", inviterId: U.mehmet!.id, targetType: "event", targetId: maraton!.id })
    .returning();
  await db.insert(schema.eventRsvps).values([
    { eventId: maraton!.id, userId: U.mehmet!.id, checkedInAt: new Date(simdi - 30 * 60e3), checkinMethod: "rotating", checkedInBy: U.mehmet!.id },
    { eventId: maraton!.id, userId: U.zeynep!.id, inviteCodeId: maratonKodu!.id, checkedInAt: new Date(simdi - 20 * 60e3), checkinMethod: "ticket", checkedInBy: U.ayse!.id },
    { eventId: maraton!.id, userId: U.can!.id },
  ]);
  // Girişte yazılanlar (ADR §7): katılımcı +10, davetli +5, davet eden +10
  await db.insert(schema.pointsLedger).values([
    { userId: U.mehmet!.id, delta: 10, reason: "event_attended", refId: String(maraton!.id) },
    { userId: U.zeynep!.id, delta: 10, reason: "event_attended", refId: String(maraton!.id) },
    { userId: U.zeynep!.id, delta: 5, reason: "event_invite_welcome", refId: `event:${maraton!.id}` },
    { userId: U.mehmet!.id, delta: 10, reason: "event_invite_attended", refId: `event:${maraton!.id}:u:${U.zeynep!.id}` },
  ]);

  // 3) Bitmiş (3 gün önce): 3 giriş, 2 değerlendirme, düzenleyen payı dağıtılmış (3 × 5 = 15)
  const [bulusma] = await db
    .insert(schema.events)
    .values({ clubId: kulup!.id, slug: "tanisma-bulusmasi-demo", title: "Dönem Açılışı Tanışma Buluşması", description: "Yeni dönemin kitaplarını seçtik, görev panosunu tanıttık.", kind: "bulusma", startsAt: new Date(simdi - 74 * SAAT), endsAt: new Date(simdi - 72 * SAAT), location: "ODTÜ Çarşı", il: "Ankara", createdBy: U.ayse!.id })
    .returning();
  await db.insert(schema.eventStaff).values({ eventId: bulusma!.id, userId: U.ayse!.id, role: "host" });
  const gelis = new Date(simdi - 74 * SAAT + 10 * 60e3);
  await db.insert(schema.eventRsvps).values(
    [U.elif!, U.mehmet!, U.can!].map((u) => ({ eventId: bulusma!.id, userId: u.id, checkedInAt: gelis, checkinMethod: "ticket" as const, checkedInBy: U.ayse!.id })),
  );
  await db.insert(schema.ratings).values([
    { userId: U.elif!.id, eventId: bulusma!.id, stars: 5, body: "Görev panosu tanıtımı çok işe yaradı." },
    { userId: U.can!.id, eventId: bulusma!.id, stars: 4 },
  ]);
  await db.insert(schema.pointsLedger).values([
    ...[U.elif!, U.mehmet!, U.can!].map((u) => ({ userId: u.id, delta: 10, reason: "event_attended" as const, refId: String(bulusma!.id) })),
    { userId: U.ayse!.id, delta: 15, reason: "event_hosted" as const, refId: `event:${bulusma!.id}` },
  ]);

  // Davet zinciri + temsilcilik başvurusu + bildirimler
  await db.insert(schema.referrals).values([
    { inviterId: U.ayse!.id, invitedId: U.can!.id, status: "activated" },
    { inviterId: U.elif!.id, invitedId: U.mehmet!.id, status: "joined" },
  ]);
  await db.insert(schema.applications).values({ userId: U.zeynep!.id, kind: "university", place: "Ege Üniversitesi", message: "İzmir'de okuma topluluğu kurmak istiyorum; 12 kişilik çekirdek ekibimiz hazır.", status: "pending" });
  await db.insert(schema.notifications).values([
    { userId: U.elif!.id, kind: "post", body: '"Mindset bana sınav kaygımı nasıl unutturdu?" yayınlandı 🎉 +100 puan', href: "/topluluk/mindset-sinav-kaygisi-demo" },
    { userId: U.can!.id, kind: "task", body: '"Kitap sohbeti podcast bölümü" görevini üstlendin — 7 gün içinde teslim et 🎙️', href: `/kampanya/${kampanya!.id}` },
    { userId: U.ayse!.id, kind: "referral", body: "Can davetinle katıldı ve ilk yazısı onaylandı 🚀 +75 puan" },
  ]);

  // 🏟️ Topluluk motoru: gruplar + özel lig + rozetler + streak
  const [grupRoman, grupTeknik] = await db
    .insert(schema.clubGroups)
    .values([
      { clubId: kulup!.id, name: "Roman Takımı", leaderId: U.elif!.id },
      { clubId: kulup!.id, name: "Teknik Kitap Takımı", leaderId: U.mehmet!.id },
    ])
    .returning();
  await db.update(schema.clubMembers).set({ groupId: grupRoman!.id })
    .where(and(eq(schema.clubMembers.clubId, kulup!.id), eq(schema.clubMembers.userId, U.elif!.id)));
  await db.update(schema.clubMembers).set({ groupId: grupTeknik!.id })
    .where(and(eq(schema.clubMembers.clubId, kulup!.id), inArray(schema.clubMembers.userId, [U.mehmet!.id, U.can!.id])));
  await db.update(schema.clubMembers).set({ role: "mod" })
    .where(and(eq(schema.clubMembers.clubId, kulup!.id), eq(schema.clubMembers.userId, U.mehmet!.id)));

  const bugun = new Date();
  await db.insert(schema.clubLeagues).values({
    clubId: kulup!.id,
    name: "Golang Okuma Maratonu",
    startsAt: new Date(bugun.getTime() - 7 * 864e5),
    endsAt: new Date(bugun.getTime() + 14 * 864e5),
    rewardNote: "Birinciye kitap hediye 🎁",
    createdBy: U.ayse!.id,
  });
  await db.insert(schema.badges).values([
    { userId: U.ayse!.id, kind: "kulup-kurucu" },
    { userId: U.ayse!.id, kind: "ilk-yazi" },
    { userId: U.elif!.id, kind: "ilk-yazi" },
    { userId: U.elif!.id, kind: "streak-7" },
  ]).onConflictDoNothing();
  const gunKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  await db.update(schema.users).set({ streakCount: 9, streakLastDay: gunKey(bugun) })
    .where(eq(schema.users.id, U.elif!.id));
  await db.update(schema.users).set({ streakCount: 3, streakLastDay: gunKey(new Date(bugun.getTime() - 864e5)) })
    .where(eq(schema.users.id, U.ayse!.id));

  console.log(`✓ Numune veri kuruldu:
  üyeler: 5 (ayse-demir 🔥 rep, mehmet-kaya, zeynep-arslan 📚, can-yildiz, elif-celik 🚀)
  topluluklar: /kulupler (2 tür, 2 il) · /kulup/${kulup!.slug} (pano+kitaplık+kurslar+etkinlik+üyeler dolu) · /kulup/${vakif!.slug}
  kampanya: /kampanya/${kampanya!.id} (6 görev, her Kanban durumu)
  quiz: /kitap/${MINDSET}/quiz (yayında) + 1 bekleyen (admin kuyruğu)
  kurs: /kurslar/${kurs!.slug} (video+yazı+quiz karışık, 3 katılımcı, soru-cevap, ek kaynak)
  davet: /d/dem07kq (Ayşe'nin kurs daveti; 3 ziyaret, Can davetle katıldı) · /d/dem0c21 (Elif → /kurslar/go-ile-cli-araclari-demo)
  yazılar: /topluluk (3 yayında — 1'i yalnız-üyeler, 1 bekleyen)
  etkinlikler: /etkinlik/${etkinlik!.slug} (6 gün sonra; kontenjan 40, görevliler, /d/demev01 Elif'in daveti)
    · /etkinlik/${maraton!.slug} (DEVAM EDİYOR 13 gün — giriş doğrulaması denenir, 2 giriş; e2e seed'den sonra ~6 gün geçerli)
    · /etkinlik/${bulusma!.slug} (bitti; 3 giriş, 2 değerlendirme, düzenleyen payı +15)
  profiller: /u/elif-celik (takipçili), /u/ayse-demir (rep+flair)`);
}

await temizle();
await kur();
