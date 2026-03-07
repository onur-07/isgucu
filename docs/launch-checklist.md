# Canliya Alma Checklist (PAYTR + Platform V2)

## 1) Odeme Altyapisi
- [x] Callback URL event log ekrani (Admin / Payouts)
- [x] Basarisiz odeme tekrar deneme akisi (pending sipariste odeme butonu)
- [ ] Kullanici + admin odeme gecmisi detay raporu
- [ ] PAYTR canli secrets / webhook imza son kontrol

## 2) Escrow / Iade
- [x] Iptal talebi 3+ gun admin escalation listesi
- [x] Admin onayli iptalde kismi iade oranini cuzdana otomatik yansitma
- [ ] Tum iptal senaryolarinda otomatik mutabakat (admin disi akislarda da)
- [ ] Escrow bakiyesi ve cikan/geri donen tutar raporu

## 3) Siparis Durum Makinesi
- [x] Yanlis gecis engeli (state transition guard)
- [x] Gecisleri audit loga yazma
- [ ] DB seviyesinde trigger ile zorunlu durum kontrolu

## 4) Destek Sistemi V2
- [x] Ticket atama/priority/SLA kolonlari (schema hazir)
- [ ] Admin UI: atama + oncelik secimi
- [ ] SLA sayaci ve geciken ticket uyarisi

## 5) Arama V2
- [ ] Server-side full-text search
- [ ] Yazim hatasi toleransi
- [ ] Baslik/etiket/kategori agirlikli siralama

## 6) Profil ve Guven
- [ ] KYC rozetleri
- [ ] Portfoy dosya dogrulama
- [ ] Dogrulanmis freelancer filtresi

## 7) Yorum ve Puan
- [ ] Zorunlu cift tarafli degerlendirme (siparis bagli)
- [ ] Yorum kalitesi moderasyonu
- [ ] Sahte puan anomalisi kontrolu

## 8) Admin Analitik + Kalite
- [ ] Donusum hunisi (ziyaret > ilan > teklif > siparis > odeme)
- [ ] En iyi kategori/uzman raporu
- [ ] Iptal nedeni ve iade analizi
- [ ] E2E test (tekliften teslime)
- [ ] Hata izleme (Sentry)
- [x] Audit log altyapisi
