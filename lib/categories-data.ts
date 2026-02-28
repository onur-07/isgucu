export interface Category {
    id: string;
    title: string;
    icon: string;
    color: string;
}

export const CATEGORIES_DETAILED: Category[] = [
    { id: "grafik", title: "Grafik & Tasarım", icon: "🎨", color: "bg-blue-50" },
    { id: "reklam", title: "Dijital Pazarlama", icon: "📢", color: "bg-red-50" },
    { id: "yazi", title: "Yazı & Çeviri", icon: "✍️", color: "bg-yellow-50" },
    { id: "video", title: "Video & Animasyon", icon: "🎥", color: "bg-green-50" },
    { id: "ses", title: "Ses & Müzik", icon: "🎧", color: "bg-pink-50" },
    { id: "yazilim", title: "Yazılım & Teknoloji", icon: "💻", color: "bg-gray-100" },
    { id: "ai", title: "Yapay Zeka (AI)", icon: "🤖", color: "bg-indigo-50" },
    { id: "is", title: "İş & Yönetim", icon: "📊", color: "bg-purple-50" },
    { id: "freelancerlik", title: "Freelancerlık", icon: "🧑‍💼", color: "bg-emerald-50" },
];

export const SUB_CATEGORIES_DATA: Record<string, string[]> = {
    yazilim: [
        "Web Yazılım", "Wordpress", "Mobil Uygulamalar", "Web Sitesi Oluşturucular & CMS",
        "E-ticaret", "Oyun Geliştirme", "Siber Güvenlik", "Veri Bilimi", "Masaüstü Uygulamalar",
        "DevOps & Bulut", "QA & Test Etme"
    ],
    grafik: [
        "Logo Tasarımı", "Kurumsal Kimlik", "UI/UX Tasarımı", "Karakter Tasarımı", "İllüstrasyon",
        "Sosyal Medya Tasarımı", "NFT Tasarımı", "Ambalaj Tasarımı", "Modelleme & Render"
    ],
    reklam: [
        "Google Ads", "Meta (FB & IG) Ads", "TikTok Ads", "SEO", "Sosyal Medya Yönetimi",
        "E-mail Pazarlama", "Influencer Pazarlama", "İçerik Pazarlaması", "Pazar Araştırması"
    ],
    yazi: [
        "Makale & Blog", "Çeviri", "Senaryo Yazımı", "Teknik Yazarlık", "Yaratıcı Yazarlık",
        "Düzelti & Editörlük", "E-kitap Yazımı", "Ürün Açıklamaları"
    ],
    video: [
        "Video Düzenleme", "2D Animasyon", "3D Animasyon", "YouTube Montaj",
        "Tanıtım Videoları", "Alt Yazı & Seslendirme Montajı", "Görsel Efekt (VFX)"
    ],
    ses: [
        "Seslendirme", "Beste & Aranjman", "Podcast Düzenleme", "Mixing & Mastering",
        "Müzik Prodüksiyonu", "Ses Efekti Tasarımı", "Jingle Yapımı"
    ],
    ai: [
        "AI Sanatı & Prompt Mühendisliği", "AI Model Eğitimi", "AI Uygulama Geliştirme",
        "ChatGPT Entegrasyonu", "Veri Etiketleme", "AI Video & Ses Üretimi"
    ],
    is: [
        "Sanal Asistan", "Pazar Araştırması", "İş Planı Hazırlama", "Finansal Analiz",
        "Hukuki Danışmanlık", "Sunum Hazırlama", "İş Geliştirme", "E-ticaret Yönetimi"
    ],
    freelancerlik: [
        "Profil & Portföy", "Teklif & Fiyatlandırma", "Müşteri İletişimi", "Proje Yönetimi",
        "CV & LinkedIn", "Sözleşme & Fatura", "Zaman Yönetimi", "Kariyer Danışmanlığı"
    ]
};

export const SERVICE_TYPES_DATA: Record<string, string[]> = {
    // Yazılım
    "Web Yazılım": ["Python/Django", "React/Next.js", "PHP/Laravel", "Node.js", "Hata Giderme", "API Entegrasyonu", "Veritabanı Tasarımı"],
    "Wordpress": ["Tema Kurulumu", "E-ticaret (WooCommerce)", "Hız Optimizasyonu", "Güvenlik & Bakım", "Özel Eklenti Geliştirme"],
    "Siber Güvenlik": ["Penetrasyon Testi", "Web Güvenliği", "Zafiyet Analizi", "DDoS Koruması"],

    // Grafik
    "Logo Tasarımı": ["Minimalist Logo", "3D Logo", "Vektörel Çizim", "Maskot Tasarımı", "Tipografik Logo"],
    "UI/UX Tasarımı": ["Mobil Uygulama Arayüzü", "Web Sitesi Arayüzü", "Landing Page Tasarımı", "Prototipleme (Figma)"],

    // Dijital Pazarlama
    "Google Ads": ["Kurulum & Yönetim", "Yeniden Pazarlama", "Youtube Reklamları", "Merchant Center Kurulumu"],
    "SEO": ["Teknik SEO", "Backlink Çalışması", "Anahtar Kelime Araştırması", "Sektörel SEO"],

    // AI
    "AI Sanatı & Prompt Mühendisliği": ["Midjourney Prompts", "DALL-E Görüntü Üretimi", "Stable Diffusion Eğitimi"],
    "AI Uygulama Geliştirme": ["AI Chatbot", "OpenAI API Entegrasyonu", "Llama Model Deployment"],

    // Ses
    "Seslendirme": ["Reklam Seslendirmesi", "Kitap Seslendirmesi", "Santral Seslendirme", "Dublaj", "Oyun Karakteri"],

    // Freelancerlık
    "Profil & Portföy": ["Profil Düzenleme", "Portföy Hazırlama", "Bio Yazımı", "Profil Tasarımı"],
    "Teklif & Fiyatlandırma": ["Teklif Metni", "Paket & Fiyatlandırma", "Satış Stratejisi", "Gig Optimizasyonu"],
    "Müşteri İletişimi": ["Mesaj Şablonları", "Brief Hazırlama", "Müşteri Yönetimi", "İtiraz Yönetimi"],
    "Proje Yönetimi": ["Task Planı", "Sprint Planlama", "Teslimat Süreci", "Revizyon Yönetimi"],
    "CV & LinkedIn": ["CV Düzenleme", "LinkedIn Profil", "Ön Yazı", "ATS Uyum"],
    "Sözleşme & Fatura": ["Sözleşme Şablonu", "Fatura Süreci", "Ödeme Planı", "Teklif Şartları"],
    "Zaman Yönetimi": ["Takvim Planlama", "Odak & Verimlilik", "Çalışma Rutini", "İş Takibi"],
    "Kariyer Danışmanlığı": ["Hedef Belirleme", "Uzmanlık Seçimi", "Pazar Analizi", "Büyüme Planı"],

    "default": ["Freelance Dan\u0131\u015fmanl\u0131k", "\u00d6zel Freelancer Projesi", "Teknik Uygulama Deste\u011fi", "Analiz ve Raporlama"]
};
