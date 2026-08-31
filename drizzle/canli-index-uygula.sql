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
