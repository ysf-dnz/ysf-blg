/**
 * Puan ekonomisi — tüm katsayılar tek yerde.
 * "Büyüme için ödül = bilgi": puan parayla değil katkıyla kazanılır,
 * kitap erişimiyle harcanır.
 */
export const PUAN = {
  /** Kayıtta karşılama puanı */
  welcome: 50,
  /** Onaylanan üye yazısı */
  postApproved: 100,
  /** Quiz: skor bu katsayıyla ölçeklenir (0-1 doğruluk×hız → 0-50) */
  quizMax: 50,
  /** Onaylanan quiz seti üretimi (ayrıca kitap ödülü) */
  quizSetApproved: 75,
  /** Davet edilen üye katıldı */
  referralJoined: 25,
  /** Davet edilen üyenin ilk yazısı onaylandı */
  referralActivated: 75,
  /** Beğeni alındı (Skool kuralı: 1 beğeni = 1 puan) */
  likeReceived: 1,
  /** Etkinlik: DOĞRULANMIŞ girişte katılımcıya (Faz 3 — RSVP artık puan üretmez) */
  eventAttended: 10,
  /** Etkinlik daveti: davetli, davetle geldiği etkinlikte giriş yapınca (anında) */
  eventInviteWelcome: 5,
  /** Etkinlik daveti: davet eden, davetlisi giriş yapınca (bekleyen → girişte; bitişte düşer) */
  eventInviteAttended: 10,
  /** Düzenleyenler: doğrulanmış katılımcı başına; host'lar arasında eşit bölünür */
  eventHostedPerAttendee: 5,
  /** event_hosted yalnız ilk bu kadar katılımcıdan hesaplanır (etkinlik başına en çok 500) */
  eventHostedMaxAttendees: 100,
  /** event_hosted dağıtımı bitişten bu kadar saat sonra (günlük cron) */
  eventHostedDelayHours: 48,
  /** İyi değerlendirilen etkinlik: host'lar arasında bölünür (konferans en çok 500 + 50) */
  eventWellRated: 50,
  eventWellRatedMinAvg: 4,
  eventWellRatedMinCount: 10,
  /** Etkinlik değerlendirme penceresi: bitişten sonra bu kadar gün (yalnız giriş yapanlar) */
  eventRatingDays: 7,
  /** Etkinliği açan + en çok bu kadar ortak düzenleyen (host) */
  eventMaxCoHosts: 3,
  /** 7 günlük seri kilometre taşı */
  streak7: 25,
  /** 30 günlük seri kilometre taşı */
  streak30: 150,
  /** Eğitim (kurs) tamamlama ödülü */
  courseCompleted: 25,
  /** Bir üyenin eğitim tamamlamadan kazanabileceği HAFTALIK tavan —
   *  kendi kursunu açıp bitirme döngüsüyle sınırsız basımı engeller */
  courseWeeklyCap: 100,
  /** Kurs üreticisi: ilk 3 katılımcı aktive oldu (kurs başına 1) */
  courseLaunched: 50,
  /** Kurs üreticisi: bir katılımcı aktive oldu */
  courseLearnerActivated: 5,
  /** Kurs üreticisi: bir katılımcı kursu bitirdi */
  courseLearnerCompleted: 10,
  /** Üreticinin katılımcı hareketlerinden GÜNLÜK (TR günü) toplam tavanı */
  courseProducerDailyCap: 100,
  /** En iyi cevap seçilen yorumun yazarı */
  answerAccepted: 10,
  /** Ek kaynak önerisi kabul edildi */
  resourceAccepted: 15,
  /** Ek kaynak puanı GÜNLÜK tavanı (3 kabul × 15) */
  resourceDailyCap: 45,
  /** En iyi cevap puanı GÜNLÜK tavanı (3 cevap × 10) — kukla hesap çiftliği freni */
  answerDailyCap: 30,
  /** Kurs daveti: davetli, davetle katıldığı kursta aktive olunca */
  inviteWelcome: 10,
  /** Kurs daveti: davet eden, davetlisi aktive olunca */
  inviteActivated: 15,
  /** Kurs daveti: davet eden, davetlisi kursu bitirince */
  inviteCompleted: 10,
  /** Davet kaynaklı puanların kişi başı KAYAN 7 GÜN tavanı (saadet zinciri freni) */
  inviteWeeklyCap: 300,
  /** Davet bekleyeni bu kadar gün içinde aktivasyon gelmezse düşer */
  inviteExpiryDays: 14,
  /** Kampanya görevi varsayılan ödülü (görev başına ayarlanabilir) */
  taskDefault: 50,
  /** Kampanya çarpanı: gündem kitabıyla ilgili üretim */
  campaignMultiplier: 1.5,
  /** Temsilci davet çarpanı */
  repReferralMultiplier: 1.5,
  /** Bir kitabın okuma erişimini açma maliyeti */
  bookUnlockCost: 200,
  /** Arkadaşa kitap hediye etme (kendi açılışının yarısı — sosyal teşvik) */
  giftBookCost: 100,
  /** Etkinlikte öncelikli koltuk */
  prioritySeatCost: 25,
  /** Avatar flair süsü */
  flairCost: 50,
} as const;

/** Hediye seçim vitrini öne çıkanı: "Learning Go" (books.json id'si) */
export const FEATURED_GIFT_BOOK_ID = "1h6nwQ-jHvqKuCtpiP3kdb5GsBtOcPww6";
