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
  /** Etkinlik katılımı */
  eventAttended: 10,
  /** 7 günlük seri kilometre taşı */
  streak7: 25,
  /** 30 günlük seri kilometre taşı */
  streak30: 150,
  /** Eğitim (kurs) tamamlama ödülü */
  courseCompleted: 25,
  /** Bir üyenin eğitim tamamlamadan kazanabileceği HAFTALIK tavan —
   *  kendi kursunu açıp bitirme döngüsüyle sınırsız basımı engeller */
  courseWeeklyCap: 100,
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
