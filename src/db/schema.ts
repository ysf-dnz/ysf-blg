/**
 * "Bilgi Ödüldür" topluluk platformu şeması.
 * Puanın tek gerçek kaynağı points_ledger'dır; toplamlar sorguyla türetilir.
 */
import {
  boolean,
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_clerk_id_idx").on(t.clerkId),
    uniqueIndex("users_handle_idx").on(t.handle),
  ],
);

/** Puan hareketleri — tek gerçek kaynak */
export const pointsLedger = pgTable("points_ledger", {
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
    ],
  }).notNull(),
  refId: text("ref_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
export const feedPosts = pgTable("feed_posts", {
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
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  feedPostId: integer("feed_post_id").references(() => feedPosts.id),
  memberPostId: integer("member_post_id").references(() => memberPosts.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("likes_user_feed_idx").on(t.userId, t.feedPostId),
    uniqueIndex("likes_user_member_idx").on(t.userId, t.memberPostId),
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

/** Etkinlikler */
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id"),
  clubId: integer("club_id"),
  title: text("title").notNull(),
  description: text("description"),
  startsAt: timestamp("starts_at").notNull(),
  location: text("location"),
  createdBy: integer("created_by").references(() => users.id),
});

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
  },
  (t) => [uniqueIndex("event_rsvps_idx").on(t.eventId, t.userId)],
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
    kind: text("kind", { enum: ["universite", "lise", "sehir"] }).notNull(),
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
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  kind: text("kind").notNull(),
  body: text("body").notNull(),
  href: text("href"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Eğitimler: YouTube-gömülü müfredat (video barındırılmaz) */
export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id").references(() => clubs.id),
  bookId: text("book_id"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: ["draft", "pending", "published"] })
    .notNull()
    .default("published"),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
