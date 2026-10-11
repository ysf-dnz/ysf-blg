-- Canlı Neon veritabanına YENİ INDEX'leri güvenle uygulama betiği.
--
-- NEDEN AYRI BİR DOSYA: `drizzle/0000_*.sql` bu şema için üretilen BASELINE
-- migration'dır (her tabloyu CREATE eder) — zaten var olan canlı veritabanına
-- uygulanamaz. Aşağıdakiler yalnızca eksik index'leri ekler ve tekrar
-- çalıştırılabilir (IF NOT EXISTS).
--
-- Kullanım:
--   psql "$POSTGRES_URL" -f drizzle/canli-index-uygula.sql
--
-- ⚠️ ÖNCE ADIM 1'İ ÇALIŞTIR: idempotency unique index'i, mevcut veride
-- çift kayıt varsa BAŞARISIZ olur. Çıktı boş değilse önce çiftleri temizle.

-- ---------------------------------------------------------------------------
-- ADIM 1 — Ön kontrol: idempotency index'ini engelleyecek çift kayıtlar
-- Boş sonuç bekleriz. Satır dönerse bunlar geçmişte çift yazılmış
-- ödül/harcamalardır (çift tık, paralel istek); en yenisini bırakıp
-- eskileri silmeye karar vermek ADMİNE aittir.
-- ---------------------------------------------------------------------------
SELECT user_id, reason, ref_id, count(*) AS adet, array_agg(id ORDER BY id) AS satirlar
FROM points_ledger
WHERE ref_id IS NOT NULL AND reason <> 'like_received'
GROUP BY user_id, reason, ref_id
HAVING count(*) > 1
ORDER BY adet DESC;

-- Çift kayıt VARSA ve temizlemeye karar verdiysen (EN ESKİSİNİ TUT):
-- DELETE FROM points_ledger p USING (
--   SELECT user_id, reason, ref_id, min(id) AS tutulacak
--   FROM points_ledger
--   WHERE ref_id IS NOT NULL AND reason <> 'like_received'
--   GROUP BY user_id, reason, ref_id HAVING count(*) > 1
-- ) d
-- WHERE p.user_id = d.user_id AND p.reason = d.reason
--   AND p.ref_id = d.ref_id AND p.id <> d.tutulacak;

-- ---------------------------------------------------------------------------
-- ADIM 2 — Idempotency: aynı (üye, sebep, referans) ödülü/harcaması bir kez.
-- like_received HARİÇ: orada refId gönderi id'sidir ama alıcı yazardır;
-- farklı kişilerin aynı gönderiye beğenisi meşru olarak aynı üçlüyü üretir.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "points_ledger_idem_idx"
  ON "points_ledger" USING btree ("user_id", "reason", "ref_id")
  WHERE "ref_id" IS NOT NULL AND "reason" <> 'like_received';

-- ---------------------------------------------------------------------------
-- ADIM 3 — Sıcak sorgu yolları (bakiye, lider tablosu, lig, feed, zil).
-- Bunlar olmadan her sayfa görüntülemesi seq scan'e dönüyordu.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "points_ledger_user_idx"
  ON "points_ledger" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "points_ledger_created_idx"
  ON "points_ledger" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "feed_posts_created_idx"
  ON "feed_posts" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "feed_posts_user_created_idx"
  ON "feed_posts" USING btree ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "comments_feed_post_idx"
  ON "comments" USING btree ("feed_post_id");
CREATE INDEX IF NOT EXISTS "comments_user_created_idx"
  ON "comments" USING btree ("user_id", "created_at");

-- Bildirim zili her sayfa görüntülemesinde okunmamış sayar
CREATE INDEX IF NOT EXISTS "notifications_user_idx"
  ON "notifications" USING btree ("user_id", "read_at");

-- ---------------------------------------------------------------------------
-- ADIM 4 — Doğrulama: index'ler yerinde mi?
-- ---------------------------------------------------------------------------
SELECT tablename, indexname
FROM pg_indexes
WHERE indexname IN (
  'points_ledger_idem_idx', 'points_ledger_user_idx', 'points_ledger_created_idx',
  'feed_posts_created_idx', 'feed_posts_user_created_idx',
  'comments_feed_post_idx', 'comments_user_created_idx', 'notifications_user_idx'
)
ORDER BY tablename, indexname;

-- ---------------------------------------------------------------------------
-- ADIM 5 — Faz 1 Kurslar (2026-10-11). Dev ve canlı AYNI Neon DB olduğu için
-- `drizzle-kit push` + aşağıdaki backfill o gün uygulandı; burada yeniden
-- çalıştırılabilir kayıt olarak durur (hepsi idempotent).
-- Yeni tablolar: course_enrollments, course_resources, ratings, reports,
-- pending_points. Yeni kolonlar: courses(slug UNIQUE NOT NULL, summary, cover_url,
-- level, est_minutes), comments(course_item_id, accepted_at, hidden_at),
-- likes(comment_id).
-- ---------------------------------------------------------------------------
-- Ön kontrol: slug çifti olmamalı (backfill '-{id}' ekiyle tekilliği garanti eder)
SELECT slug, count(*) FROM courses GROUP BY slug HAVING count(*) > 1;

UPDATE courses
SET slug = trim(both '-' from lower(regexp_replace(translate(title,'çğıöşüÇĞİÖŞÜ','cgiosuCGIOSU'),'[^a-zA-Z0-9]+','-','g'))) || '-' || id
WHERE slug IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "courses_slug_idx" ON "courses" USING btree ("slug");
ALTER TABLE courses ALTER COLUMN slug SET NOT NULL;

-- Katılım backfill: mevcut ilerlemelerden (puan tetiklemez; joined_at = ilk tamamlama)
INSERT INTO course_enrollments (user_id, course_id, joined_at, activated_at)
SELECT p.user_id, p.course_id, min(p.completed_at), min(p.completed_at)
FROM course_progress p JOIN courses c ON c.id = p.course_id
WHERE p.user_id <> c.created_by            -- üretici kendi kursuna katılamaz (kendine puan yok)
GROUP BY p.user_id, p.course_id
ON CONFLICT DO NOTHING;
DELETE FROM course_enrollments e USING courses c WHERE c.id = e.course_id AND e.user_id = c.created_by;
UPDATE course_enrollments e
SET completed_at = (SELECT max(p.completed_at) FROM course_progress p WHERE p.user_id = e.user_id AND p.course_id = e.course_id)
WHERE e.completed_at IS NULL
  AND (SELECT count(*) FROM course_progress p WHERE p.user_id = e.user_id AND p.course_id = e.course_id)
    = (SELECT count(*) FROM course_items i WHERE i.course_id = e.course_id);

CREATE UNIQUE INDEX IF NOT EXISTS "comments_accepted_idx" ON "comments" USING btree ("course_item_id") WHERE "accepted_at" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "likes_user_comment_idx" ON "likes" USING btree ("user_id", "comment_id");
CREATE UNIQUE INDEX IF NOT EXISTS "pending_points_idx" ON "pending_points" USING btree ("user_id", "reason", "ref_id");
CREATE UNIQUE INDEX IF NOT EXISTS "reports_idx" ON "reports" USING btree ("reporter_id", "target_type", "target_id");

-- ---------------------------------------------------------------------------
-- ADIM 6 — Faz 2 Kurs daveti (2026-10-11). `drizzle-kit push` ile uygulandı; kayıt.
-- Yeni tablolar: invite_codes (code UNIQUE; kısmi unique (inviter_id,target_type,
-- target_id) WHERE revoked_at IS NULL), invite_visits (ip_hash+created_at index; 30
-- gün sonra cron siler). Yeni reason: course_invite_welcome/activated/completed.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "invite_codes_code_idx" ON "invite_codes" USING btree ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "invite_codes_aktif_idx" ON "invite_codes" USING btree ("inviter_id", "target_type", "target_id") WHERE "revoked_at" IS NULL;
CREATE INDEX IF NOT EXISTS "invite_visits_ip_idx" ON "invite_visits" USING btree ("ip_hash", "created_at");
CREATE INDEX IF NOT EXISTS "invite_visits_code_idx" ON "invite_visits" USING btree ("invite_code_id");
