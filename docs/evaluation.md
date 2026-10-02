# Değerlendirme yöntemi

## Ölçülen görev

Modelin her vakada servis, stok ve politika araçlarını okuyarak doğru ilk çözüm seçeneğini önermesi; onay gerektiren işlemlerin yalnızca onaydan sonra uygulanması; son durumun iş kurallarına uyması beklenir. Akıcı Türkçe tek başına görev başarısı sayılmaz.

## Veri seti

`serviceops-tr-v1`: 8 aile × 5 varyant = 40 sentetik vaka. Her ailede ilk 3 varyant geliştirme (24), son 2 varyant ayrılmış test (16) olarak işaretlidir. Beklenen seçenekler `shared/oracles.ts` içinde, karar fonksiyonundan bağımsız etiketlenir ve modele gönderilmez.

Ayrılmış varyantlar aynı aileleri paylaşır. Bu, bilinmeyen gerçek dünya dağılımına genelleme testi değildir. Gerçek müşteri kullanımı öncesinde farklı kaynaklardan bağımsız örneklem, alan uzmanı etiketleri ve veri gizliliği değerlendirmesi gerekir. Ayrılmış örnekler prompt ayarlamak için kullanılırsa artık regresyon setidir; yeni ayrılmış set gerekir.

## Üç kanıt katmanı

1. **Birim/politika testleri:** eksik kimlik, garanti ve gecikme sınırları, stok yokluğu, çelişki, bilinmeyen araç, başka vaka seçme girişimi ve kaynak kanıtları.
2. **Uçtan uca testler:** gerçek yerel D1 ve Workflows ile onay, tekrar, stok değişimi, ret, timeout kurtarma, sahiplik kontrolü, responsive UI ve PWA.
3. **Canlı model değerlendirmesi:** OpenRouter üzerinden aynı araç sözleşmeleri ve Workflow kullanılır. Her model denemesi ve son durum raporlanır. Değerlendirme onayları otomatik ve açıkça etiketlidir; insan onayı kalitesi gibi raporlanmaz.

`npm run evaluate` ilk katmanın deterministik sağlayıcısını sınar. 40/40 sonucu LLM'in 40 vakayı çözdüğü anlamına gelmez. Canlı rapor ayrı dosyadır. Bu ayrım UI'da, JSON'da ve README'de korunur.

## Canlı rapor

Rapor; model, prompt/veri seti sürümü, veri seti SHA-256 hash'i, her vakanın beklenen/üretilen ilk seçeneği, nihai durumu, sağlayıcıları, çağrı sayısı, maliyet kapsamı, toplam süre ve hata kodlarını içerir. Geçici hatalar ve başarısız denemeler dışlanmaz. Stok değişimi senaryosunda ilk öneri ve nihai doğrulama birlikte değerlendirilir.

Başlangıç kalite hedefi ayrılmış vakalarda ≥%90 doğru sonuçtur. 16 örnekte tek hata yaklaşık 6,25 yüzde puanı etkiler; küçük örneklemle kesin genelleme yapılmaz. Model değişiklikleri aynı veri ve prompt sürümüyle karşılaştırılmalıdır. Bir çalıştırma stochastic varyansı ölçmez; tekrarlar ayrı raporlanmalıdır.

## Yayın kriterleri

- Onaysız yazma, mükerrer rezervasyon ve başka oturumun vakasına erişim testleri geçmeli.
- Plan değişince yeni onay gerekli olmalı; önceki onay yeni işlem için kullanılamamalı.
- Yerel test ve canlı sonuçlar ayırt edilebilir olmalı.
- Maliyet eksikliği ve başarısız vaka görünür olmalı.
- Canlı örnek uçtan uca tamamlanmadan uygulama “canlı doğrulandı” diye sunulmamalı.

Müşteri mesajının üslubu ve anlaşılabilirliği için insan değerlendirmesi henüz yapılmış sayılmaz. Otomatik politika kontrolü bu değerlendirmeyi yerine geçmez.
