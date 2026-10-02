# Katkı rehberi

- Node.js 22.12+ ve `npm ci` kullanın; lockfile'ı birlikte güncelleyin.
- İş kuralı değişikliği için bağımsız beklenen sonuç ve sınır testi ekleyin.
- Onay, stok sürümü veya idempotency değişirse uçtan uca testi çalıştırın.
- `npm run check` ve `npm run test:e2e` geçmeli. Fixture sonucu LLM sonucu diye adlandırılmamalı.
- Metrik değişikliğinde pay, payda, kohort, eksik veri davranışı ve `docs/metrics.md` güncellenmeli.
- Secret, kişisel müşteri verisi ve gerçek hesap kimliklerini commit etmeyin.
- Ayrılmış değerlendirme seti üzerinde ayarlama yaparsanız yeni ayrılmış set hazırlayın.
- UI Türkçe; kod tanımlayıcıları İngilizce; erişilebilir isimler ve hata durumları açık olmalı.
- Devam eden Workflows ile uyumluluğu, schema migration etkisini ve geri alma yolunu PR açıklamasına yazın.
