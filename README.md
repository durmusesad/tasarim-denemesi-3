# KG Tahmin — Demo (Kupon'lu)

Karşılıklı Gol (KG) tahmin sitesi için bağımsız, statik bir **tasarım denemesi**. Önceki
"tasarım-denemesi-2" projesinden hem görsel dil hem kod tabanı olarak tamamen ayrıdır.

- Gerçek bir backend/API/veritabanı yoktur; tüm veri `data.json` içinde üretilmiş örnek veridir.
- Kesin/Olası etiketleri `app.js` içindeki `guvenHesapla()` fonksiyonu ile istemci tarafında,
  ham oranlar ve istatistik tablosu üzerinden gerçek zamanlı hesaplanır.
- **Kupon** özelliği tamamen istemci taraflı çalışan gerçek bir hesap makinesidir: maç ekle/çıkar
  (localStorage'da saklanır), oranlar `× 1.037` katsayısıyla "iddaa.com karşılığı" değere çevrilir,
  toplam oran tüm oranların çarpımıdır, olası kazanç = tutar × toplam oran. Gerçek bahis değildir.
- Yerleşim: mobilde ekranı tam dolduran, masaüstünde ~860px genişlikte ortalanan tek sütun
  ("mobil öncelikli, sabit genişlikte ortalanmış" — Instagram/Twitter tarzı).

## Yerel çalıştırma

```bash
python3 -m http.server 8000
# http://localhost:8000
```
