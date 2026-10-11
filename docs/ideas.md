# Fikir havuzu (kapsam dışı)

PRD §0.7: belgede olmayan fikirler burada bekler; hiçbiri onaysız uygulanmaz.

| # | Tarih | Fikir | Neden şimdi değil |
|---|---|---|---|
| 1 | 2026-10-11 | Kitap sayfasındaki istemci canvas davet kartını (`OkumaKapisi.astro` 🎴) sunucu satori hattına taşımak; tek şablon ailesi. | PRD §4.3 açıkça kapsam dışı bıraktı; Faz 2 hattı oturduktan sonra küçük iş. |
| 2 | 2026-10-11 | Ana sayfayı SSR yapıp `?ref=` çerezini sunucuda kurmak. | CLAUDE.md "kitap/içerik sayfaları statik" kararı; 3 satırlık istemci hotfix'i (F1-00) yeter. |
| 3 | 2026-10-11 | Kazanılan-puan formülünü "delta>0 OR reason='admin_adjust'" yaparak iadenin seviyeyi düşürmesi. | 10 ayrı sorguda formül değişikliği; Faz 5 ekonomi kartında ihtiyaç ölçülürse. |
| 4 | 2026-10-11 | `pg_advisory_xact_lock(user_id)` ile toplam-tabanlı tavanların yarışını tamamen kapatmak. | ADR K1.5: tavan en fazla bir ödül aşılabilir; ölçümde görünürse. |
| 5 | 2026-10-11 | Haftalık tavanlar için ortak `since` yardımcısı yerine tüm tavanları `cron_runs` dönem anahtarıyla takvim haftasına bağlamak. | Mevcut tavanlar kayan 7 gün; iki sistem karışır. |
| 6 | 2026-10-11 | Kulüp adı gibi kullanıcı metinleri için merkezi uzunluk/karakter doğrulayıcısı. | Faz 4 güvenlik önkoşulunda (F4-01) yalnız kulüp adı yapılır. |
| 7 | 2026-10-11 | `events.club_id` ve `campaign_id`'ye FK eklemek. | Mevcut veride yetim kontrolü gerekir; F3-02'de isteğe bağlı. |
| 8 | 2026-10-11 | `@lhci/cli` ile LCP bütçesini `npm run qa`'ya bağlamak (PRD §4.3 performans ölçütü). | Kurulu ama bağlı değil; ayrı iş. |
| 9 | 2026-10-11 | PostToolUse/Stop hook ile `graphify update .` otomasyonu. | Bugün yalnız elle; CLAUDE.md talimatı yeter. |
