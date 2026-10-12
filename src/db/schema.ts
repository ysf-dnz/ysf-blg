/**
 * "Bilgi Ödüldür" topluluk platformu şeması.
 * Puanın tek gerçek kaynağı points_ledger'dır; toplamlar sorguyla türetilir.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id").notNull(),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    university: text("university"),
    city: text("city"),
    role: text("role", { enum: ["member", "rep", "admin"] })
      .notNull()
      .default("member"),
    bio: text("bio"),
    /** Mağazadan alınan avatar süsü (emoji) */
    flair: text("flair"),
    /** Sosyal linkler JSON: {linkedin, github, instagram, youtube, x, website} */
    socials: text("socials"),
    /** 🔥 Günlük seri: ardışık aktif gün sayısı ve son aktif günü (YYYY-MM-DD) */
    streakCount: integer("streak_count").notNull().default(0),
    streakLastDay: text("streak_last_day"),
    /** Haritada görünme rızası (F4-02): NULL = görünmez, dolu = açık rızanın verildiği an */
    mapVisibleAt: timestamp("map_visible_at"),
    /**
     * Kimden mesaj alınır (F4-03). NULL = mutual: kolon canlıya koddan ÖNCE çıktığı için
     * nullable + varsayılan (eski kodun insert'i kırılmaz).
     */
    dmPolicy: text("dm_policy", { enum: ["everyone", "mutual", "nobody"] }).default("mutual"),
    /**
     * Suistimal işareti (F5-04): NULL = temiz. Doluysa üye lider/lig hesaplarında görünmez ve
     * ona ya da ondan doğan bekleyen puanlar olgunlaşmaz (admin işareti kaldırınca kesinleşir).
     */
    flaggedAt: timestamp("flagged_at"),
    /**
     * Kayıt imzası (Faz 5 kök çözüm): kayıt anındaki istemci IP'sinin CRON_SECRET HMAC'li kısa hash'i
     * (davet.ts kisaHash; ham IP saklanmaz). Suistimal taraması hesabın KENDİ imzasına bakar (kimliksiz
     * ziyaret yerine). NULL = adres alınamadı ya da 30 gün sonra cron sildi (`imzalariUnut`).
     */
    signupIpHash: text("signup_ip_hash"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_clerk_id_idx").on(t.clerkId),
    uniqueIndex("users_handle_idx").on(t.handle),
    index("users_signup_ip_idx").on(t.signupIpHash, t.createdAt),
  ],
);

/** Puan hareketleri — tek gerçek kaynak */
export const pointsLedger = pgTable(
  "points_ledger",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    delta: integer("delta").notNull(),
    reason: text("reason", {
      enum: [
        "welcome",
        "post_approved",
        "quiz",
        "course_completed", // eğitim bitirme (quiz'den ayrı: tavanı ve analitiği ayrı)
        "quiz_set_approved",
        "referral_joined",
        "referral_activated",
        "like_received",
        "task_done",
        "event_attended",
        "rep_bonus",
        "book_unlock", // negatif: kitap açma harcaması
        "spend_gift", // negatif: arkadaşa kitap hediye etme
        "spend_priority", // negatif: etkinlik öncelikli koltuk
        "spend_flair", // negatif: avatar süsü
        "admin_adjust",
        "streak_bonus", // 7/30 gün seri ödülü
        "season_reward", // sezon sonu ödülü
        "level_reward", // seviye atlama ödülü
        // Kurslar (ADR 0001 §7 — her yeni reason refId TAŞIR, idem index öyle çalışır)
        "course_launched", // üretici: ilk 3 katılımcı aktive oldu (course:{id})
        "course_learner_activated", // üretici: katılımcı aktive oldu (course:{id}:u:{learner})
        "course_learner_completed", // üretici: katılımcı bitirdi (course:{id}:u:{learner})
        "answer_accepted", // cevap yazarı: en iyi cevap (yorum:{id})
        "resource_accepted", // öneren: ek kaynak kabul (kaynak:{id})
        // Kurs daveti (Faz 2) — bekleyen → kurs aktivasyonunda kesinleşir; davet tavanı 300/7g
        "course_invite_welcome", // davetli: davetle katıldığı kursta aktive oldu (course:{id})
        "course_invite_activated", // davet eden: davetlisi aktive oldu (course:{id}:u:{invitee})
        "course_invite_completed", // davet eden: davetlisi bitirdi (course:{id}:u:{invitee})
        // Etkinlik (Faz 3) — event_attended refId'si String(eventId) AYNEN kalır (ADR K1.4)
        "event_invite_welcome", // davetli: davetle geldiği etkinlikte giriş yaptı (event:{id}) — anında
        "event_invite_attended", // davet eden: davetlisi giriş yaptı (event:{id}:u:{invitee}) — bekleyen, ends_at'te düşer
        "event_hosted", // her host: ends_at+48s cron'u, min(giriş,100)×5 eşit bölünür (event:{id}) — bekleyen satır YOK
        "event_well_rated", // her host: ort ≥ 4,0 ve ≥ 10 değerlendirme, 7. gün cron'u (event:{id})
        // Faz 5
        "invite_second_level", // üst davetçi: davetlinin davetlisi ilk kez bir kursta aktive oldu (u:{invitee}) — davet tavanında
        "vitality_pool", // haftalık canlılık havuzu payı, kişi başına TEK satır (course:{id}:{YYYY-Www}) — tavana girmez
      ],
    }).notNull(),
    refId: text("ref_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    /**
     * Idempotency: aynı (üye, sebep, referans) ödülü/harcaması iki kez
     * yazılamaz — çift tık, paralel istek ve yeniden gönderim tek satıra
     * düşer. like_received HARİÇTİR: orada refId gönderi id'sidir ama
     * alıcı yazardır; farklı kişilerin aynı gönderiye beğenisi meşru
     * biçimde aynı üçlüyü üretir (fren zaten economy.ts'te günlük sayaç).
     */
    uniqueIndex("points_ledger_idem_idx")
      .on(t.userId, t.reason, t.refId)
      .where(sql`${t.refId} is not null and ${t.reason} <> 'like_received'`),
    index("points_ledger_user_idx").on(t.userId),
    index("points_ledger_created_idx").on(t.createdAt),
  ],
);

/** Kitap erişimleri (book_id = content collection'daki kitap id'si) */
export const bookAccess = pgTable(
  "book_access",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    bookId: text("book_id").notNull(),
    source: text("source", { enum: ["gift", "points", "reward", "level"] }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("book_access_user_book_idx").on(t.userId, t.bookId)],
);

/** Üye yazıları (Medium tarzı, onaylı yayın) */
export const memberPosts = pgTable(
  "member_posts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    bookId: text("book_id"),
    title: text("title").notNull(),
    markdown: text("markdown").notNull(),
    slug: text("slug").notNull(),
    status: text("status", {
      enum: ["draft", "pending", "published", "rejected"],
    })
      .notNull()
      .default("draft"),
    /** Görünürlük: herkese açık | yalnız üyeler (Medium'daki kitle seçimi) */
    visibility: text("visibility", { enum: ["public", "members"] })
      .notNull()
      .default("public"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    publishedAt: timestamp("published_at"),
  },
  (t) => [uniqueIndex("member_posts_slug_idx").on(t.slug)],
);

/** Topluluk akışı: kısa gönderiler (Skool feed) */
export const feedPosts = pgTable(
  "feed_posts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    bookId: text("book_id"),
    category: text("category", {
      enum: ["soru", "kaynak", "ilerleme", "duyuru"],
    })
      .notNull()
      .default("ilerleme"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // Akış son 30 gönderiyi tarihe göre çeker; hız sınırı (userId, createdAt) sorar
    index("feed_posts_created_idx").on(t.createdAt),
    index("feed_posts_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    feedPostId: integer("feed_post_id").references(() => feedPosts.id),
    memberPostId: integer("member_post_id").references(() => memberPosts.id),
    /** Kurs öğesi altı soru-cevap (3. nullable hedef; "tam biri dolu" kodda doğrulanır) */
    courseItemId: integer("course_item_id").references(() => courseItems.id),
    body: text("body").notNull(),
    /** Üretici "en iyi cevap" seçti (öğe başına tek — kısmi unique) */
    acceptedAt: timestamp("accepted_at"),
    /** Şikâyetle gizlendi (moderasyon) */
    hiddenAt: timestamp("hidden_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("comments_feed_post_idx").on(t.feedPostId),
    index("comments_course_item_idx").on(t.courseItemId),
    index("comments_user_created_idx").on(t.userId, t.createdAt),
    uniqueIndex("comments_accepted_idx")
      .on(t.courseItemId)
      .where(sql`${t.acceptedAt} is not null`),
  ],
);

/** Beğeni: alan üyeye 1 puan (Skool kuralı) */
export const likes = pgTable(
  "likes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    feedPostId: integer("feed_post_id").references(() => feedPosts.id),
    memberPostId: integer("member_post_id").references(() => memberPosts.id),
    /** Kurs soru-cevabındaki yoruma beğeni (puan: begeniPuaniVer, refId yorum:{id}) */
    commentId: integer("comment_id").references(() => comments.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("likes_user_feed_idx").on(t.userId, t.feedPostId),
    uniqueIndex("likes_user_member_idx").on(t.userId, t.memberPostId),
    uniqueIndex("likes_user_comment_idx").on(t.userId, t.commentId),
  ],
);

/** Kitap quiz'leri */
export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  bookId: text("book_id").notNull(),
  title: text("title").notNull(),
  createdBy: integer("created_by").references(() => users.id),
  status: text("status", { enum: ["pending", "published", "rejected"] })
    .notNull()
    .default("published"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const quizQuestions = pgTable("quiz_questions", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id")
    .notNull()
    .references(() => quizzes.id),
  question: text("question").notNull(),
  options: text("options").notNull(), // JSON: string[4]
  correctIndex: integer("correct_index").notNull(),
  durationSec: integer("duration_sec").notNull().default(20),
  order: integer("order").notNull().default(0),
});

export const quizAttempts = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id")
    .notNull()
    .references(() => quizzes.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  score: integer("score").notNull(),
  correctCount: integer("correct_count").notNull(),
  totalCount: integer("total_count").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Davetler */
export const referrals = pgTable(
  "referrals",
  {
    id: serial("id").primaryKey(),
    inviterId: integer("inviter_id")
      .notNull()
      .references(() => users.id),
    invitedId: integer("invited_id")
      .notNull()
      .references(() => users.id),
    status: text("status", { enum: ["joined", "activated"] })
      .notNull()
      .default("joined"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("referrals_invited_idx").on(t.invitedId)],
);

/** Temsilcilik başvuruları */
export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  kind: text("kind", {
    enum: ["city", "university", "universite_kulubu", "lise_temsilciligi"],
  }).notNull(),
  place: text("place").notNull(),
  message: text("message"),
  status: text("status", { enum: ["pending", "approved", "rejected"] })
    .notNull()
    .default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Etkinlikler. Herkese açık SSR sayfası /etkinlik/[slug].
 * slug NULLABLE kalır: şema canlıya Faz 3 kodundan ÖNCE push'lanır ve o aradaki eski kod
 * slug'sız insert eder; boş slug ilk görüntülemede atanır (lib/etkinlik.ts slugGaranti).
 * NOT NULL adımı deploy sonrası: drizzle/canli-index-uygula.sql.
 */
export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id"),
    clubId: integer("club_id"),
    slug: text("slug"),
    title: text("title").notNull(),
    description: text("description"),
    startsAt: timestamp("starts_at").notNull(),
    /** Boşsa starts_at + 2 saat sayılır (lib/etkinlik.ts etkinlikBitis) */
    endsAt: timestamp("ends_at"),
    kind: text("kind", { enum: ["bulusma", "atolye", "konferans", "cevrimici"] }),
    location: text("location"),
    /** Harita pini; kulüp etkinliğinde kulübün ili */
    il: text("il"),
    /** Boş = sınırsız. RSVP tek SQL'de count < capacity koşuluyla yazılır */
    capacity: integer("capacity"),
    rsvpClosesAt: timestamp("rsvp_closes_at"),
    coverUrl: text("cover_url"),
    createdBy: integer("created_by").references(() => users.id),
  },
  (t) => [uniqueIndex("events_slug_idx").on(t.slug)],
);

export const eventRsvps = pgTable(
  "event_rsvps",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    /** Puanla alınan öncelikli koltuk (listede üstte ⭐) */
    priority: boolean("priority").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    /**
     * Giriş doğrulaması (ADR K1.4): tek SQL UPDATE … WHERE checked_in_at IS NULL RETURNING —
     * satır döndüyse girişi BU istek yaptı (puanlar yalnız o zaman). Bilet kolonsuz:
     * token = {rsvpId}.{base32(HMAC("t:"+rsvpId))}.
     */
    checkedInAt: timestamp("checked_in_at"),
    checkinMethod: text("checkin_method", { enum: ["ticket", "rotating", "manual"] }),
    /** Okutan görevli (dönen QR'da katılımcının kendisi) — 120/dk freni ve denetim */
    checkedInBy: integer("checked_in_by").references(() => users.id),
    /** Davetle kayıt olduysa kod (atıf; "ilk geçerli davet kazanır") */
    inviteCodeId: integer("invite_code_id"),
  },
  (t) => [uniqueIndex("event_rsvps_idx").on(t.eventId, t.userId)],
);

/**
 * Etkinlik görevlileri. host: düzenleyen (event_hosted payı; açan + en çok 3 ortak);
 * scanner: yalnız bilet okutur, puan almaz. Etkinliği açan otomatik host yazılır.
 */
export const eventStaff = pgTable(
  "event_staff",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role", { enum: ["host", "scanner"] }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("event_staff_idx").on(t.eventId, t.userId)],
);

/** Takip (Medium tarzı): yazarını takip et, yeni yazısında bildirim al */
export const follows = pgTable(
  "follows",
  {
    id: serial("id").primaryKey(),
    followerId: integer("follower_id")
      .notNull()
      .references(() => users.id),
    followedId: integer("followed_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("follows_idx").on(t.followerId, t.followedId)],
);

/** Bilgi Hazinesi: üyenin "öğrenip hakkında yazacağım" 5 kitaplık listesi */
export const learningList = pgTable(
  "learning_list",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    bookId: text("book_id").notNull(),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("learning_list_idx").on(t.userId, t.bookId)],
);

/** Kulüpler: platformun hücresi — üniversite/lise/şehir toplulukları */
export const clubs = pgTable(
  "clubs",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: text("kind", {
      enum: ["universite", "lise", "sehir", "vakif", "dernek", "kurum"],
    }).notNull(),
    place: text("place").notNull(),
    il: text("il").notNull(),
    description: text("description"),
    presidentId: integer("president_id")
      .notNull()
      .references(() => users.id),
    status: text("status", { enum: ["pending", "approved", "archived"] })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("clubs_slug_idx").on(t.slug)],
);

export const clubMembers = pgTable(
  "club_members",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubs.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role", { enum: ["president", "mod", "member"] })
      .notNull()
      .default("member"),
    /** Kulüp içi grup ataması (19+ üyede hiyerarşik yönetim) */
    groupId: integer("group_id"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("club_members_idx").on(t.clubId, t.userId)],
);

/** Kulüp içi gruplar: başkan kurar, lider (mod) yönetir */
export const clubGroups = pgTable("club_groups", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id")
    .notNull()
    .references(() => clubs.id),
  name: text("name").notNull(),
  leaderId: integer("leader_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Kulüp ortak kütüphanesi: katalogdan kitap VEYA serbest not/kaynak */
export const clubBooks = pgTable("club_books", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id")
    .notNull()
    .references(() => clubs.id),
  /** Katalog kitabı (books.json id'si) — not eklenirken null */
  bookId: text("book_id"),
  /** Serbest not/kaynak başlığı (bookId yoksa zorunlu) */
  title: text("title"),
  url: text("url"),
  note: text("note"),
  addedBy: integer("added_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Okuma kampanyaları (gündem) — clubId null ise site geneli */
export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id").references(() => clubs.id),
  bookId: text("book_id").notNull(),
  title: text("title").notNull(),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id),
  status: text("status", { enum: ["planning", "active", "done"] })
    .notNull()
    .default("planning"),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const campaignVotes = pgTable(
  "campaign_votes",
  {
    id: serial("id").primaryKey(),
    bookId: text("book_id").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("campaign_votes_idx").on(t.bookId, t.userId)],
);

/** Jira tarzı kampanya görevleri */
export const campaignTasks = pgTable("campaign_tasks", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  title: text("title").notNull(),
  description: text("description"),
  kind: text("kind", {
    enum: [
      "yazi",
      "ozet",
      "quiz_seti",
      "ceviri",
      "tanitim",
      "etkinlik",
      "sosyal_medya",
      "slayt",
      "podcast",
      "egitim",
    ],
  }).notNull(),
  status: text("status", {
    enum: ["backlog", "claimed", "review", "done"],
  })
    .notNull()
    .default("backlog"),
  assigneeId: integer("assignee_id").references(() => users.id),
  /** Grup hedefli görev: ilk 48 saat yalnız grup üyeleri üstlenir */
  groupId: integer("group_id"),
  rewardPoints: integer("reward_points").notNull().default(50),
  dueAt: timestamp("due_at"),
  claimedAt: timestamp("claimed_at"),
  submissionUrl: text("submission_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Site içi bildirimler */
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  // Bildirim zili her sayfa görüntülemesinde okunmamış sayar → index şart
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

/** Eğitimler: YouTube-gömülü müfredat (video barındırılmaz) */
/**
 * Kurs (eski "eğitim/ders" — CONTEXT.md). Herkese açık SSR sayfası /kurslar/[slug].
 * slug: canlı backfill'den sonra NOT NULL'a çekilir (drizzle/canli-index-uygula.sql).
 */
export const courses = pgTable(
  "courses",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id").references(() => clubs.id),
    bookId: text("book_id"),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    /** Kısa vaat (≤140): kartta "bu kurs sana ne katar" */
    summary: text("summary"),
    /** Boşsa bağlı kitabın kapağı kullanılır */
    coverUrl: text("cover_url"),
    level: text("level", { enum: ["baslangic", "orta", "ileri"] }),
    estMinutes: integer("est_minutes"),
    /** hidden: 3 farklı Sv4+ şikâyetiyle inceleme gizlemesi; rejected: admin reddi */
    status: text("status", {
      enum: ["draft", "pending", "published", "rejected", "hidden"],
    })
      .notNull()
      .default("published"),
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("courses_slug_idx").on(t.slug)],
);

/** Müfredat öğesi: YouTube videosu, üye yazısı veya quiz — tek karışık sıra */
export const courseItems = pgTable("course_items", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id),
  order: integer("order").notNull().default(0),
  kind: text("kind", { enum: ["youtube", "yazi", "quiz"] }).notNull(),
  title: text("title").notNull(),
  youtubeId: text("youtube_id"),
  memberPostId: integer("member_post_id").references(() => memberPosts.id),
  quizId: integer("quiz_id").references(() => quizzes.id),
});

/** Ders ilerlemesi (classroom) */
export const courseProgress = pgTable(
  "course_progress",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id),
    itemId: integer("item_id")
      .notNull()
      .references(() => courseItems.id),
    completedAt: timestamp("completed_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("course_progress_idx").on(t.userId, t.itemId)],
);

/**
 * Kurs katılımı. Kurs aktivasyonu = ilk öğe tamamlandı (activated_at);
 * bitirme = tüm öğeler (completed_at). İki geçiş de tek SQL UPDATE … WHERE … IS NULL
 * RETURNING ile "bu istek mi yaptı?" sorusunu yarışsız cevaplar (ADR 0001 K1 C).
 * joined_at asgari süre (öğe × 60 sn) için şart.
 */
export const courseEnrollments = pgTable(
  "course_enrollments",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
    activatedAt: timestamp("activated_at"),
    completedAt: timestamp("completed_at"),
    /** Faz 2: davetle katıldıysa kod (atıf; "ilk geçerli davet kazanır") */
    inviteCodeId: integer("invite_code_id"),
  },
  (t) => [
    uniqueIndex("course_enrollments_idx").on(t.userId, t.courseId),
    index("course_enrollments_course_act_idx").on(t.courseId, t.activatedAt),
  ],
);

/** Ek kaynak önerisi: katılımcı bağlantı + not önerir, üretici onaylar (+15 önerene) */
export const courseResources = pgTable(
  "course_resources",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    url: text("url").notNull(),
    note: text("note"),
    status: text("status", { enum: ["pending", "accepted", "rejected"] })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at"),
  },
  (t) => [index("course_resources_course_status_idx").on(t.courseId, t.status)],
);

/**
 * Değerlendirme (1-5), puan üretmez. Kurs: yalnız aktive olmuş katılımcı.
 * Etkinlik: yalnız giriş yapan, bitişten sonraki 7 gün ("tam biri dolu" kodda doğrulanır).
 */
export const ratings = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    courseId: integer("course_id").references(() => courses.id),
    eventId: integer("event_id").references(() => events.id),
    stars: integer("stars").notNull(),
    body: text("body"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ratings_user_course_idx").on(t.userId, t.courseId),
    uniqueIndex("ratings_user_event_idx").on(t.userId, t.eventId),
  ],
);

/**
 * Şikâyet kuyruğu — polimorfik hedef (course | comment | user | message).
 * FK yok (bilinçli): moderasyon kuyruğunda bütünlük değil, izlenebilirlik gerekir.
 */
export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    reporterId: integer("reporter_id")
      .notNull()
      .references(() => users.id),
    targetType: text("target_type", {
      enum: ["course", "comment", "user", "message"],
    }).notNull(),
    targetId: integer("target_id").notNull(),
    reason: text("reason"),
    status: text("status", { enum: ["open", "resolved", "dismissed"] })
      .notNull()
      .default("open"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reports_idx").on(t.reporterId, t.targetType, t.targetId),
    index("reports_status_idx").on(t.status, t.createdAt),
  ],
);

/**
 * Birebir mesaj (DM v1, ADR K6): tek tablo; konuşma = (gönderen, alıcı) çiftinin iki yönü.
 * Gövde DÜZ METİN (markdown yok); okundu = read_at. Puan üretmez, notifications'a yazılmaz.
 * Gönderim tek SQL (lib/mesaj.ts): engel, hız ve izin koşulları INSERT'in WHERE'inde.
 */
export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    senderId: integer("sender_id")
      .notNull()
      .references(() => users.id),
    recipientId: integer("recipient_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    readAt: timestamp("read_at"),
  },
  (t) => [
    // Bildirim zili her sayfa görüntülemesinde okunmamış mesaj sayar → index şart
    index("messages_recipient_read_idx").on(t.recipientId, t.readAt),
    index("messages_pair_idx").on(t.senderId, t.recipientId, t.createdAt),
    index("messages_pair_rev_idx").on(t.recipientId, t.senderId, t.createdAt),
  ],
);

/** Engel: etkisi İKİ YÖNLÜ (mesaj, harita üye ızgarası, Mesaj düğmesi) — sorgular iki yöne de bakar */
export const blocks = pgTable(
  "blocks",
  {
    id: serial("id").primaryKey(),
    blockerId: integer("blocker_id")
      .notNull()
      .references(() => users.id),
    blockedId: integer("blocked_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("blocks_idx").on(t.blockerId, t.blockedId)],
);

/**
 * Davet kodu (Faz 2): (davet eden, hedef) başına tek aktif kod. 7 karakter
 * Crockford Base32 (I, L, O, U yok). /d/{kod} bağlantısının ve QR'ın içeriği;
 * kişisel veri taşımaz. note: kartın ≤80 karakterlik kişisel notu.
 */
export const inviteCodes = pgTable(
  "invite_codes",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    inviterId: integer("inviter_id")
      .notNull()
      .references(() => users.id),
    targetType: text("target_type", { enum: ["course", "event"] }).notNull(),
    targetId: integer("target_id").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    revokedAt: timestamp("revoked_at"),
  },
  (t) => [
    uniqueIndex("invite_codes_code_idx").on(t.code),
    uniqueIndex("invite_codes_aktif_idx")
      .on(t.inviterId, t.targetType, t.targetId)
      .where(sql`${t.revokedAt} is null`),
  ],
);

/** Davet bağlantısı ziyareti: huni "görüntülenme" + IP hız sınırı; 30 gün sonra cron siler */
export const inviteVisits = pgTable(
  "invite_visits",
  {
    id: serial("id").primaryKey(),
    inviteCodeId: integer("invite_code_id")
      .notNull()
      .references(() => inviteCodes.id),
    ipHash: text("ip_hash").notNull(),
    uaHash: text("ua_hash"),
    kanal: text("kanal", { enum: ["qr", "link"] }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("invite_visits_ip_idx").on(t.ipHash, t.createdAt),
    index("invite_visits_code_idx").on(t.inviteCodeId),
  ],
);

/**
 * Bekleyen puan (ADR 0001 K2): ledger'a GİRMEZ → seviyeye sayılmaz.
 * matures_at: zamanla kesinleşir (hesap yaşı 24 s); expires_at: olay gelmezse düşer.
 * Kesinleşme sırası ZORUNLU: önce awardPoints (idempotent), sonra status=confirmed.
 * Kırpma ayrı status değil: confirmed + yazilan < delta.
 */
export const pendingPoints = pgTable(
  "pending_points",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    refId: text("ref_id").notNull(),
    delta: integer("delta").notNull(),
    yazilan: integer("yazilan").notNull().default(0),
    status: text("status", { enum: ["pending", "confirmed", "expired"] })
      .notNull()
      .default("pending"),
    /** Panoda "neye bağlı" metni (ör. "Elif ilk öğeyi bitirince") */
    note: text("note"),
    maturesAt: timestamp("matures_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (t) => [
    uniqueIndex("pending_points_idx").on(t.userId, t.reason, t.refId),
    index("pending_points_matures_idx").on(t.status, t.maturesAt),
    index("pending_points_expires_idx").on(t.status, t.expiresAt),
  ],
);

/* ============================================================
   Lig, sezon, rozet, cron — topluluk motoru
   ============================================================ */

/** Site geneli sezonlar (aylık): kulüpler ligi bu pencerede yarışır */
export const seasons = pgTable("seasons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // örn. "2026 Ağustos"
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  status: text("status", { enum: ["active", "closed"] })
    .notNull()
    .default("active"),
  /** Kapanışta kazanan kulüp (rozet + duyuru için) */
  championClubId: integer("champion_club_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Başkanın kulüp içi özel ligleri */
export const clubLeagues = pgTable("club_leagues", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id")
    .notNull()
    .references(() => clubs.id),
  name: text("name").notNull(),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  /** Serbest metin ödül vaadi: "Şampiyona kitap hediye" */
  rewardNote: text("reward_note"),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id),
  status: text("status", { enum: ["active", "closed"] })
    .notNull()
    .default("active"),
  winnerId: integer("winner_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Rozetler: başarı anlarında bir kez verilir */
export const badges = pgTable(
  "badges",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind", {
      enum: [
        "ilk-yazi",
        "streak-7",
        "streak-30",
        "gorev-10",
        "quiz-ustasi",
        "davetci-5",
        "kulup-kurucu",
        "sezon-sampiyonu",
        "lig-birincisi",
        "usta-okur",
      ],
    }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("badges_idx").on(t.userId, t.kind)],
);

/** Cron idempotency: her iş+dönem bir kez çalışır */
export const cronRuns = pgTable(
  "cron_runs",
  {
    id: serial("id").primaryKey(),
    job: text("job").notNull(),
    periodKey: text("period_key").notNull(), // örn. "2026-08" veya "2026-08-09"
    ranAt: timestamp("ran_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("cron_runs_idx").on(t.job, t.periodKey)],
);
