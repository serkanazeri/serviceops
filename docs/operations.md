# İşletim rehberi

## Cloudflare kaynakları

ServiceOps, RAGNA'dan ayrı Worker, D1, Workflow ve Durable Object kullanır. Mevcut uygulamaların secret veya veritabanı bağları yeniden kullanılmaz.

```bash
npx wrangler login
npx wrangler d1 create serviceops
```

`wrangler.jsonc` dosyasını `wrangler.production.json` olarak kopyalayın; gerçek account/database ID'lerini yazın. Üretim değişkenlerini `ENVIRONMENT=production`, `MODEL_MODE=live` yapın. Üretim dosyası `.gitignore` kapsamındadır.

```bash
npx wrangler d1 migrations apply serviceops --remote --config wrangler.production.json
npm run check
npx wrangler deploy --config wrangler.production.json
npx wrangler secret put OPENROUTER_API_KEY --config wrangler.production.json
npx wrangler secret put EVALUATION_TOKEN --config wrangler.production.json
```

Secret'ları komut argümanına veya repoya yazmayın. Üretim modeli yapılandırılana kadar yeni canlı çalışmalar 503 döner. Harici eval token yalnızca değerlendirme trafiğini yetkilendirir; vaka okuma ve onayda oturum sahipliği kontrolü yine uygulanır.

## Yayın sonrası doğrulama

`/api/health` yalnızca uygulamanın yanıt verdiğini gösterir. Gerçek model entegrasyonunu kanıtlamak için:

1. Yeni tarayıcı oturumunda canlı mod etiketini görün.
2. Bir normal vaka başlatın; üç kaynak ve model çağrıları kaydedilsin.
3. Onay öncesi rezervasyon olmadığını doğrulayın.
4. Onaylayın; stok ve rezervasyon doğrulamasını inceleyin.
5. Değişen stok senaryosunda ikinci onay gerektiğini doğrulayın.
6. Hata ve maliyet kapsamını kontrol edin; ardından canlı değerlendirmeyi çalıştırın.

Worker planı Free ise CPU/adım kotaları ve hesapta paylaşılan toplam kullanım kontrol edilmelidir. Ücretli plana geçiş ayrı maliyet kararıdır. Uygulama fiyatlandırma planını otomatik yükseltmez.

## Arıza durumları

| Belirti                     | İnceleme / davranış                                                               |
| --------------------------- | --------------------------------------------------------------------------------- |
| 401/402 sağlayıcı hatası    | Secret/hesap kredisi kontrol edilir; kör tekrar yok                               |
| Model timeout               | Deneme hata olarak saklanır, olası maliyet rezervasyonu korunur; sınırlı tekrar   |
| Stok servisi timeout        | Araç adımı sınırlı tekrar edilir; başarısız girişim günlükte kalır                |
| Bütçe dolu                  | Yeni model denemesi durur, eski vakalar okunabilir                                |
| 24 saat onay yok            | Akış `expired`; işlem yapılmaz                                                    |
| 5 dakika ilerleme yok       | Vaka takip kimliğiyle Workflow durumunu ve platform loglarını inceleyin           |
| Yazıldı fakat doğrulanamadı | `POSTCONDITION_FAILED`; rezervasyon kaydını incelemeden yeniden işlem başlatmayın |

```bash
npx wrangler workflows instances describe serviceops-cases RUN_ID --config wrangler.production.json
npx wrangler tail --config wrangler.production.json
npx wrangler deployments list --config wrangler.production.json
```

## Geri alma

Worker sürümleri Cloudflare deployment geçmişinden veya `wrangler rollback` ile geri alınabilir. D1 şeması ve devam eden Workflow durumları koddan bağımsızdır: eski kodun şemayla uyumlu olduğunu doğrulamadan geri alma yapmayın. Migration'lar eklemeli hazırlanmalı; veri silen migration ayrı onay ve yedek gerektirir. Devam eden onayları korumak için Workflow adım adlarını sürümler arasında keyfi değiştirmeyin.

## Veriler ve saklama

Tüm vaka verisi sentetiktir. Oturum cookie'si 7 gün yaşar. Tamamlanmış vaka/çağrı/olay/onay kayıtları saatlik temizlikle 30 gün sonra silinir; web performans kayıtları da 30 gündür. Oturum cookie'sini silmek eski kayıtlara erişimi kaybettirir. Ortak bütçe sayaçları vaka kayıtlarından ayrı tutulur; bilinmeyen maliyet rezervasyonları geriye dönük kendiliğinden iade edilmez.

Cloudflare Workflow kendi saklama süresine sahiptir. D1 olay günlüğü bu süreden bağımsızdır. Yeni gerçek müşteri entegrasyonunda veri sınıflandırması, saklama süresi, silme hakkı ve erişim modeli yeniden tasarlanmalıdır.

## CI ve secret sınırı

GitHub Actions yalnızca yerel fixture modu çalıştırır; PR'lara model veya Cloudflare secret'ı açılmaz. Otomatik production deploy kurulmaz. Başarılı testler tek başına bir canlı değerlendirme sonucu veya saha performans garantisi değildir.

## Yerel runtime uyarısı

Wrangler 4.146.0 ile onay bekleyen akışlarda `code had hung` şeklinde runtime logları gözlendi. Aynı testlerde HTTP yanıtları, rezervasyon postcondition'ları ve ayrı Workflow status sorgusundaki `complete` durumu doğrulandı. Bu gözlem production davranışı için kanıt sayılmaz; canlı yayın smoke testinde Workflow durumu ayrıca kontrol edilmelidir. Logu bastırmak yerine tamamlanma durumu ve iş verisi birlikte doğrulanır.
