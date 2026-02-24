# Freelancer Projesi için Gerçek Zamanlı Mesajlaşma + Teklif Sistemi Tasarımı

Bu doküman, istediğin özellikleri üretim seviyesinde nasıl kurabileceğini adım adım anlatır:

- Anlık mesajlaşma (real-time)
- Küfür/hakaret ve kişisel bilgi paylaşımı engelleme
- İsim-soyisim, IBAN, telefon, e-posta tespiti (boşluk, noktalama, özel karakterle kaçırma dahil)
- Dosya gönderimi (resim, PDF, Word, Excel)
- Sohbet içinden çift yönlü teklif akışı (freelancer -> müşteri veya müşteri -> freelancer)
- Teklif kabulünden sonra müşteriyi ödeme akışına yönlendirme

---

## 1) Yüksek Seviye Mimari

Önerilen servisler:

1. **API + WebSocket sunucusu**
   - REST: geçmiş mesajlar, dosya metadata, teklifler
   - WebSocket (veya Socket.IO): anlık mesaj/teklif eventleri
2. **Mesaj Moderasyon Servisi**
   - Mesaj normalize eder
   - Yasaklı desenleri tarar
   - Sonucu API’ye döner (ALLOW / BLOCK / REVIEW)
3. **Dosya Servisi (Object Storage)**
   - S3/MinIO vb.
   - Dosya yükleme için pre-signed URL
4. **Ödeme Servisi entegrasyonu**
   - İyzico/PayTR/Stripe benzeri
   - Teklif kabulünden sonra ödeme intent oluşturur
5. **Veritabanı (PostgreSQL önerilir)**
   - konuşmalar, mesajlar, teklifler, ödeme kayıtları

> Trafik büyürse WebSocket ölçeklemesi için Redis Pub/Sub veya NATS eklenir.

---

## 2) Veritabanı Modeli (Özet)

### `conversations`
- `id`
- `project_id`
- `client_id`
- `freelancer_id`
- `status` (active, archived)

### `messages`
- `id`
- `conversation_id`
- `sender_id`
- `type` (text, file, offer, system)
- `content`
- `moderation_status` (allowed, blocked, review)
- `blocked_reason` (profanity, iban, phone, email, full_name)
- `created_at`

### `message_files`
- `id`
- `message_id`
- `storage_key`
- `original_name`
- `mime_type`
- `size_bytes`
- `virus_scan_status`

### `offers`
- `id`
- `conversation_id`
- `message_id` (teklifin mesaj karşılığı)
- `project_id`
- `from_user_id`
- `to_user_id`
- `amount`
- `currency` (TRY)
- `revision_count`
- `delivery_days`
- `status` (pending, accepted, rejected, expired, canceled)
- `accepted_at`

### `payments`
- `id`
- `offer_id`
- `payer_user_id` (müşteri)
- `amount`
- `status` (pending, paid, failed)
- `provider`
- `provider_payment_id`

---

## 3) Gerçek Zamanlı Mesajlaşma Akışı

1. Kullanıcı sohbet odasına bağlanır (`conversation:{id}` channel).
2. Mesaj gönderince önce sunucu tarafında moderasyon pipeline çalışır.
3. Sonuç:
   - **ALLOW**: veritabanına yaz, karşı tarafa anında yayınla.
   - **BLOCK**: veritabanına `blocked` olarak logla, kullanıcıya sebep göster.
   - **REVIEW**: gerekirse insan moderasyona düşür.
4. Teslim/okundu bilgisi event ile güncellenir.

### WebSocket Event Önerileri
- `message:send`
- `message:new`
- `message:blocked`
- `message:delivered`
- `message:read`
- `offer:new`
- `offer:accepted`
- `offer:rejected`
- `payment:redirect`

---

## 4) Moderasyon Kuralları (Senin İsteklerine Göre)

Engellenecek içerikler:

1. **Küfür/hakaret**
2. **IBAN paylaşımı**
3. **Telefon numarası**
4. **E-posta adresi**
5. **Ad Soyad paylaşımı** (örn. Ahmet Yılmaz)

### Kritik nokta: Kaçırmayı engelleme
Kullanıcılar şu şekilde kaçırmaya çalışabilir:
- `0 5 3 9 ...`
- `a h m e t`
- `ah.met` / `ah-met`
- `ahmet_yilmaz`
- `a h m e t y ı l m a z`

Bunu engellemek için mesajı analizden önce normalize et:

1. Lowercase yap.
2. Türkçe karakter normalize et (`ı->i`, `ş->s`, vb. opsiyonel).
3. Boşluk, noktalama, özel karakterleri kaldırılmış ikinci bir kopya üret.
4. Hem **orijinal metin** hem **sıkıştırılmış metin** üzerinde desen kontrolü yap.

### Örnek tespit stratejisi
- Telefon: rakamları çek, 10-11 haneli ve TR mobil/prefix yapısını eşle.
- E-posta: regex + normalize edilmiş formda `at`, `dot` kaçamaklarına karşı ikinci kontrol.
- IBAN: `TR` + 24 hane, boşluk/işaret temizlenmiş metinde kontrol.
- Ad Soyad: iki kelime ve her biri sözlükte kişi adı/soyadı olasılığı yüksekse block.
  - Yanlış pozitifleri azaltmak için kullanıcı profilindeki gerçek ad ile de karşılaştır.

> Not: Ad-soyad tespitinde NLP destekli model (NER) kullanmak doğruluğu artırır.

---

## 5) Kullanıcı Adı Maskeleme

İstek: kullanıcı adında ad-soyad varsa `Ahmet Y.` formatında görünsün.

Kural:
- `Ad Soyad` ise `Ad S.` göster.
- Tek kelime ise aynen bırak.
- 3+ kelime ise ilk kelime + son kelimenin baş harfi (`Ali Veli Demir` -> `Ali D.`).

Bu maskeleme:
- UI render katmanında yapılmalı.
- API response’da ayrıca `display_name` alanı dönebilir.

---

## 6) Dosya Gönderimi (Resim/PDF/Word/Excel)

İzin verilen MIME türleri:
- Resim: `image/jpeg`, `image/png`, `image/webp`
- PDF: `application/pdf`
- Word: `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Excel: `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

Güvenlik kontrolleri:
1. Uzantı + MIME birlikte doğrula.
2. Maks dosya boyutu (örn. 20 MB).
3. Antivirüs taraması (ClamAV veya bulut AV).
4. Orijinal dosya adını sanitize et.
5. İndirme URL’lerini süreli (signed URL) ver.

---

## 7) Sohbet İçi Teklif + Ödeme Akışı

### Senaryo A: Freelancer -> Müşteri teklif
1. Freelancer sohbetten teklif oluşturur (örn. 800 TL, 5 gün).
2. Müşteriye `offer:new` event gider.
3. Müşteri kabul ederse `offer:accepted`.
4. Sistem müşteriyi ödeme sayfasına yönlendirir (`payment:redirect`).
5. Ödeme başarılı olunca sipariş/iş emri aktifleşir.

### Senaryo B: Müşteri -> Freelancer teklif
1. Müşteri sohbetten teklif gönderir.
2. Freelancer kabul eder.
3. Yine müşteri ödeme ekranına yönlendirilir.
4. Ödeme sonrası iş başlatılır.

### İş Kuralları
- `pending` teklif varken aynı konuşmada paralel aktif teklif limiti koy (örn. 1).
- Teklifin son geçerlilik süresi olsun (örn. 24 saat).
- Kabul sonrası tutar kilitlenir; yeni pazarlık yeni teklif ile yapılır.

---

## 8) Örnek API Taslağı

- `POST /conversations/:id/messages`
- `POST /conversations/:id/files/presign`
- `POST /conversations/:id/offers`
- `POST /offers/:id/accept`
- `POST /offers/:id/reject`
- `POST /offers/:id/payment-intent`
- `GET /conversations/:id/messages?cursor=...`

---

## 9) Güvenlik ve Uyum

- Rate limit (mesaj spam ve brute-force engeli)
- WAF ve IP bazlı kötüye kullanım takibi
- Audit log (kim neyi ne zaman engelledi)
- KVKK/GDPR açısından mesaj saklama ve silme politikası
- Moderasyon kararlarını açıklanabilir reason code ile dön

---

## 10) Uygulama Planı (Sprint bazlı)

### Sprint 1
- Conversation + Message tabloları
- WebSocket bağlantısı
- Basit text mesaj gönder/al

### Sprint 2
- Moderasyon motoru (küfür, telefon, email, IBAN, ad-soyad)
- Block reason dönüşleri

### Sprint 3
- Dosya yükleme + güvenlik kontrolleri
- Sohbette dosya mesajı

### Sprint 4
- Teklif modeli + teklif eventleri
- Kabul/reddet
- Ödeme yönlendirme

### Sprint 5
- Okundu bilgisi, bildirimler, edge case’ler
- Penetrasyon + yük testleri

---

## 11) Kısa Teknik Öneri (Stack)

Eğer hızlı çıkmak istersen:
- Backend: **NestJS** (WebSocket gateway + REST)
- DB: **PostgreSQL + Prisma**
- Queue: **BullMQ + Redis** (bildirim, AV tarama, async işler)
- Storage: **S3/MinIO**
- Frontend: **Next.js**

---

## 12) Başlangıç için Net Checklist

1. Mesaj gönderimi server-side moderasyondan geçmeden yayınlama.
2. Normalize + regex + sözlük + (opsiyonel) NER ile PII engelle.
3. Kullanıcı adını `Ad S.` formatında maskele.
4. Dosya yüklemede MIME/uzantı/AV kontrolü şart koş.
5. Teklif kabulü sonrası **her zaman müşteriyi ödeme adımına gönder**.
6. Tüm adımlar için event + audit log üret.

Bu şekilde hem canlı konuşma deneyimi korunur hem de platform dışına kaçış (telefon/iban/mail) büyük oranda engellenir.
