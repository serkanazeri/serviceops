# Metrik sözlüğü

## Kapsam

Dashboard seçili 7/30 günlük dönemde **başlatılmış** vakalardan bir kohort oluşturur. Bitiş zamanına göre başka bir kohortla pay/payda karıştırılmaz. Yalnızca oturum sahibinin `source=visitor` kayıtları dahildir. `mode=live` ve `mode=fixture` filtreleri ayrıdır. Canlı değerlendirme `source=evaluation` kullanır.

En fazla son 500 vaka işlenir. API toplam ve örneklenen sayıyı, UI kesilme uyarısını gösterir. Her oran için örneklem ve her maliyet için raporlama kapsamı önemlidir. Zaman serisinin gün sınırları UTC'dir; kullanıcıya gösterilen zaman damgaları tarayıcının yerel saat dilimindedir.

| Ölçüm                        | Tanım                                                       | Sınır                                                                                    |
| ---------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Doğrulanmış sonuç oranı      | `verified=1 / verified IS NOT NULL`                         | İşlem sonrası deterministik kontrol; yanıt metninin insan kalite puanı değildir          |
| Sonuç değerlendirme kapsamı  | `verified IS NOT NULL / tüm kohort`                         | Başarısız/değerlendirilmemiş vakaları görünür kılar                                      |
| Rezervasyon tamamlanma oranı | Doğrulanmış rezervasyon / sonlanan akış                     | Ret, devir ve bilgi isteme ayrı durumlar olarak gösterilir; her düşük oran hata değildir |
| İnsan kararları              | Onay / düzenleme / ret adetleri                             | Karar verilmiş öneriler esas alınır; bekleyenler paydada değildir                        |
| Aktif süre                   | `finished_at − created_at − wait_ms`                        | Model ve araç beklemelerini içerir; insan beklemesini çıkarır                            |
| Toplam süre                  | `finished_at − created_at`                                  | Yalnızca sonlanan akışlar                                                                |
| Bekleme süresi               | Onay yayınından karar kaydına kadar geçen sürelerin toplamı | Yeniden planlama birden fazla onay beklemesi yaratabilir                                 |
| Model hata oranı             | Hatalı deneme / tüm model denemeleri                        | Timeout hatanın alt kümesidir; iki kez toplanmaz                                         |
| Araç başarısı                | Başarılı deneme / başarılı + araç hatası + politika engeli  | Güvenlik engeli başarı metriğini düşürebilir; ayrıca incelenmelidir                      |
| Maliyet                      | Bilinen `usage.cost` değerlerinin toplamı                   | Bilinmeyen maliyetler sıfır değildir; kısmi toplam olduğu açıklanır                      |
| Maliyet kapsamı              | Maliyeti raporlanmış deneme / tüm model denemeleri          | Kapsam %100 olmadan tam maliyet iddiası yok                                              |
| Çözüm başına maliyet         | Kohorttaki tüm model maliyetleri / doğrulanmış rezervasyon  | Başarısız çalıştırmaların maliyetini de içerir; eksik raporda `null`                     |
| Token                        | Raporlanan giriş ve çıkış tokenlarının toplamı              | Reasoning veya cached tokenlar üst toplamla yeniden toplanmaz                            |
| En eski onay                 | Şimdi − en eski bekleyen onayın başlangıcı                  | Süresi dolan onayla işlem yapılmaz                                                       |
| Takılı olabilecek akış       | 5 dakikadır güncellenmeyen queued/running/executing         | Teşhis sinyali; kesin platform arızası sayılmaz                                          |
| Web Vitals                   | Oturumdaki LCP/INP/CLS gözlemlerinin p75'i                  | Küçük ve temsili olmayan demo örneklemi tüm kullanıcıları temsil etmez                   |

p50/p95 için nearest-rank yöntemi kullanılır. `n=0` sonucu `null` / `—` olur. İnsan onayı sayısı veya devir oranı otomatik olarak başarısızlık değildir: iş kuralı gereği doğru devir, doğru sonuç kabul edilir.

## Bütçe sayacı ve maliyet raporu aynı şey değildir

Durable Object sayacı, raporlanmış maliyetin yanında henüz sonucu bilinmeyen çağrı rezervasyonlarını da tutar. Bu yüzden dashboard'daki raporlanmış maliyet ile işletim ekranındaki bütçe tüketimi farklı olabilir. Model sağlayıcısının faturası nihai referanstır. Uygulama timeout olduğunda sağlayıcı tarafında işlem devam etmiş olabilir.

## İddia edilmeyen ölçümler

- Manuel baz ölçüm olmadan zaman tasarrufu, ROI veya insan yerine geçen iş miktarı.
- İlk token akışı ölçülmeden TTFT.
- Politika kontrolü sonucundan türetilmiş genel LLM doğruluğu.
- Yerel test sağlayıcısından model gecikmesi veya model kalitesi.
- Sıfır gözlenen ihlalden türetilmiş mutlak güvenlik garantisi.
