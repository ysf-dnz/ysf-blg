# NotebookLM eşleştirme adayları (DRY-RUN — uygulanmadı)

> Üreten: `scripts/notebook-eslestir-dry.ts` (2026-10-14). Kaynak: `books.json` 884 kitap, `kutuphanem.json` 438 defter (syncedAt 2026-07-21T11:52:36.721Z). Kural `titleMatchScore` = ortak anlamlı sözcük ÷ KÜÇÜK küme (`sync-drive-books.ts` ile aynı): tek sözcüklü başlık tek ortak sözcükle 1.00 alır → "ortak/küçük" sütunu 1 ise eşleşme şüphelidir. "Paylaşım" anlık görüntüdeki `shared`; kapalı defterin bağlantısı üyeye erişim hatası verir.

**Özet:** ≥ 0.85: 15 · 0.6–0.85 aday: 23 · < 0.6 (eşleşmeyen): 846 · books.json ile uyumsuz: 0 · birden çok kitaba aday defter: 3

## 1. ≥ 0.85 — doğrulama (books.json'da notebookId'li olanlar bunlar olmalı)

| Kitap | Defter | Skor | Ortak/küçük | books.json | Paylaşım |
|---|---|---|---|---|---|
| Argo CD | Argo CD: Kurulum ve Çalıştırma | 1.00 | 1/1 | aynı | kapalı |
| Bilimler Tarihcisi Fuat Sezgin | Fuat Sezgin | 1.00 | 2/2 | aynı | açık |
| sezgin fuat | Fuat Sezgin | 1.00 | 2/2 | aynı | açık |
| The Coder Cafe | The Coder Cafe: Yazılımcılar için 66 Zamansız Kavram | 1.00 | 3/3 | aynı | kapalı |
| Kızıl İcaz -Risalei Nur | Kızıl İcâz | 1.00 | 1/1 | aynı | kapalı |
| Mektubat | Mektubat | 1.00 | 1/1 | aynı | kapalı |
| Umre Rehberi 12.04.2025 | Umre 1 | 1.00 | 1/1 | aynı | kapalı |
| Jules Payot Irade Terbiyesi | Jules Payot: İrade Terbiyesi | 1.00 | 4/4 | aynı | açık |
| Mindset | Zihniyet (Mindset) | 1.00 | 1/1 | aynı | açık |
| Ted Gibi Konuş | TED Gibi Konuş | 1.00 | 3/3 | aynı | kapalı |
| Quantum Qiskit | Qiskit ve IBM Quantum ile Python Kuantum Pratiği | 1.00 | 2/2 | aynı | kapalı |
| Kafka | İş Başında Apache Kafka: Temellerden Üretime | 1.00 | 1/1 | aynı | kapalı |
| FastAPI | FastAPI ile Üretici YZ Servisleri Kurma | 1.00 | 1/1 | aynı | kapalı |
| Claude Code Полное руководство по AI-ассистенту для разработчиков | Ürün Yöneticileri için Claude Code | 1.00 | 2/2 | aynı | kapalı |
| Data Governance with Unity Catalog on Databricks Implement Data and AI Governance with Databricks Data Intelligence Platform | Databricks'te Unity Catalog | 1.00 | 3/3 | aynı | kapalı |

## 2. 0.6–0.85 adaylar — Yusuf onayı ister (onaylanan satırlar küçük bir betikle yazılır, elle değil)

| Kitap | Yazar | Defter | Skor | Ortak/küçük | Paylaşım | Kitap id |
|---|---|---|---|---|---|---|
| Vibe Coding with Cursor, Windsurf and Lovable Build Apps Fast with AI-Assisted Software Development and Testing | Greg Lim | Cursor, Windsurf ve Lovable ile Vibe Coding | 0.83 | 5/6 | kapalı | `17ZjL2AXjlDavW_NomMeG46tcNCy6a9jM` |
| Yaratıcı Eylem - Bir Var Olma Biçimi | Rick Rubin | Yaratıcı Eylem: Bir Var Olma Biçimi | 0.83 | 5/6 | kapalı | `1bc8FvyXZog-BhVBZexSRMyK9SA9Xw5Em` |
| Python量子计算实践-基于Qiskit和IBM-Quantum-Experience平台 (【美】哈西·诺伦) |  | Qiskit ve IBM Quantum ile Python Kuantum Pratiği | 0.80 | 4/5 | kapalı | `1cneVQT2pIdhSv3M9pCNghH2aOj5mKHMp` |
| Autodesk Revit MEP 2025 | Unknown | MEP için Revit 2025 | 0.75 | 3/4 | açık | `1kvOlAhZZNST6qxs_q6DYR21TCy5OXwyW` |
| Learning GitHub Actions |  | İş Başında GitHub Actions: DevOps için CI/CD ⚠️ çoklu | 0.67 | 2/3 | açık | `1qu2ZF1f8MpqcwCswH7zWoLeZIJ3TgCsA` |
| Hızlı Öğrenme Bilimi | Peter Hollins | Hızlı Öğrenme ve Bilişsel Ustalığın Bilimi | 0.67 | 2/3 | kapalı | `1Gd6osks6faShVZxdJO8AFJWElX6dE_2g` |
| Islamda Bilim ve Teknik | Fuat Sezgin | İslam'da Bilim ve Teknik | 0.67 | 2/3 | kapalı | `1lVTK3q5sP3X-C0EmddxP-POu0Q8AKjxJ` |
| Learn Python Visually |  | scikit-learn Tarif Kitabı: Python'da Makine Öğrenmesi Tarifleri | 0.67 | 2/3 | kapalı | `1MPu8Gh2FJaAF8SSQZzGktl5C74r82w_Z` |
| Learning Kali Linux |  | Kali Linux Tarif Kitabı: Üçüncü Baskı Kapsamlı Lab Kılavuzu | 0.67 | 2/3 | kapalı | `1Tvp5BIZKWtExSkzrs76mdEjoN7FFP8Kv` |
| Rust Web Development |  | Rust Web Programlama: Mikroservis ve Dağıtım Rehberi ⚠️ çoklu | 0.67 | 2/3 | kapalı | `1k0bGznKiS0sVNVpWZk_QLv1rBDL1FdOC` |
| Rust Web Programming |  | Rust Web Programlama: Mikroservis ve Dağıtım Rehberi ⚠️ çoklu | 0.67 | 2/3 | kapalı | `12Fqaib_F_6QBRuT3SCmunwjAxLRSE8Q1` |
| Beyond Vibe Coding |  | Vibe Coding: YZ Destekli Mühendisliğin Geleceği | 0.67 | 2/3 | açık | `1GJXvSpqIz1fPQhcy4g-qEjpJ9_m5U0CL` |
| Claude Code Turkce |  | Ürün Yöneticileri için Claude Code | 0.67 | 2/3 | kapalı | `1C_W7qJcs9snNasorwRjbK0svXDMocPyk` |
| GenAI on Google Cloud | Ayo Adedeji, Lavi Nigam etc. | Google Cloud'da Üretici YZ: Prototipten Üretim Mühendisliğine | 0.67 | 2/3 | kapalı | `1n7vjHelnq5xFO7866x_Ekxl_IyB1huAz` |
| YZ Senin YardIMcI Pilotun |  | YZ: Zekâ Çağında Yardımcı Pilotun | 0.67 | 2/3 | kapalı | `1snqw6HcxoemIUZSflyi2E34mVEzJrsDD` |
| GitHub Actions in Action Continuous integration and delivery for DevOps | Michael Kaufmann, Rob Bos, Marcel de Vries | İş Başında GitHub Actions: DevOps için CI/CD ⚠️ çoklu | 0.60 | 3/5 | açık | `1lYLx8tpyratRar9I5omcOW62-2sFBfIs` |
| Gerçek Tıp Yitik Şifanın İzinde | Aidin Salih | Gerçek Tıp: Yitik Şifanın İzinde | 0.60 | 3/5 | kapalı | `1L7Hl6st0lHotkd9hm6Iq6wyEJiOQ-KSy` |
| Basic Grammar In Use 4th Edition | Raymond Murphy, William R. Smalzer etc. | Basic Grammar In Use: Kısa Yanıtlar ve Fiil Zamanları | 0.60 | 3/5 | kapalı | `11V3yr8G_rjktfbhn_i7X195OYd7CkOBA` |
| Basic Grammar in Use Student’s Book with Answers • Self-study Reference and Practice for Students of American English | Raymond Murphy | English Grammar in Use — Ek Alıştırmalar, 5. Baskı ⚠️ çoklu | 0.60 | 3/5 | kapalı | `11RBDlCI4E5nnJFDSyCeMBra3pyF0UeEW` |
| English Grammar in Use Supplementary Exercises 5th Edition | Louise Hashemi Raymond Murphy | English Grammar in Use — Ek Alıştırmalar, 5. Baskı ⚠️ çoklu | 0.60 | 3/5 | kapalı | `1dt2cYWMtbRfgqSwemC0iH1D68wjlhK7w` |
| SAP ABAP 7.5 Optimization for HANA |  | HANA için SAP ABAP 7.5 Optimizasyonu | 0.60 | 3/5 | kapalı | `1MlsppNmlp1DvxRmhSvbN8EG3N7-pH5ed` |
| Model Context Protocol for LLMs Build secure, scalable, and context-aware AI agents using a standardized protocol | Naveen Krishnan | Python ile Model Context Protocol | 0.60 | 3/5 | kapalı | `1XfKq_2kM-uQuSlC9S6damCHco6KnZnAB` |
| The Optimist Sam Altman, OpenAI, and the Race to Invent the Future | Keach Hagey | İyimser: Sam Altman ve OpenAI Devrimi | 0.60 | 3/5 | kapalı | `1rKg62k1l7vpbc_BglOjLD_VAvsx2eBMT` |

## 3. Eşleşmeyen (< 0.6): 846 kitap

Bu kitaplar için defter yok. Talep öncelikli üretim planı (ONAY BEKLER): PROGRESS.md "FAZ 5 ARTIK + UX KAPANIŞI" ve GitHub #42.

