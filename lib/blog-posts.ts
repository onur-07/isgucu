export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  coverImage: string;
  date: string;
  readingMinutes: number;
  content: string[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "freelance-tecrubesizken-baslamak-7-adim",
    title: "7 Adımda Tecrübesizken Freelance Çalışmaya Başlamak",
    excerpt:
      "Sıfırdan başlayıp ilk müşterini bulmaya kadar, portföy, fiyatlama ve iletişim adımlarını netleştiren pratik bir rehber.",
    category: "Freelancerlık",
    coverImage: "/blog/tecrubesizken-baslamak.webp",
    date: "2026-02-25",
    readingMinutes: 6,
    content: [
      "Freelance dünyasına girmenin en zor tarafı, nereden başlayacağını bilememektir. Bu yazıda ‘hazırım’ demeyi beklemeden, adım adım ilerleyebileceğin bir yol haritası paylaşacağım.",
      "1) Tek bir hizmet seç: Her şeyi yapmak yerine bir başlangıç hizmeti belirle (örn: logo tasarım, WordPress kurulum, sosyal medya görseli). Netlik; teklif verirken, portföy hazırlarken ve müşteriyle konuşurken hız kazandırır.",
      "2) Mini portföy hazırla: Gerçek müşteri bekleme. 3-5 örnek çalışma üret. Öncesi/sonrası, süreç ekran görüntüleri veya kısa açıklamalar ekle.",
      "3) Basit bir profil oluştur: Kullandığın platformlarda açıklamanı 2-3 cümleye indir, uzmanlığını ve çözümünü yaz. ‘Ne yapıyorum?’ kadar ‘kime ne sonuç sağlıyorum?’ da önemli.",
      "4) İlk tekliflerinde hız + netlik: Uzun uzun anlatmak yerine, 3 maddede yaklaşımını yaz: kapsam, teslim süresi, ihtiyaçların. Müşteri için karar vermek kolaylaşır.",
      "5) Fiyatlamayı basitleştir: Başlangıç için paket fiyat mantığı işe yarar. Küçük paket / standart paket / hızlı teslim gibi.",
      "6) Süreç şablonları hazırla: Brief soruları, teslim checklist’i, revizyon sınırları. Böylece iş büyüdüğünde de dağılmazsın.",
      "7) Referans topla ve görünür ol: İlk 2-3 işten sonra yorum istemeyi unutma. Referans; tecrübenin yerini en hızlı dolduran şeydir.",
      "Tecrübe zamanla geliyor; sistem kurarsan daha hızlı gelir. Önemli olan küçük ama istikrarlı adımlar atmak."
    ],
  },
  {
    slug: "freelance-vergi-gereklilikleri-maliyetler",
    title: "Freelance Vergi Gereklilikleri ve Doğabilecek Maliyetler",
    excerpt:
      "Fatura, stopaj, muhasebe ve olası gider kalemleri… Freelance çalışırken mali tarafta sürpriz yaşamamak için temel bir çerçeve.",
    category: "Finans",
    coverImage: "/blog/vergi-gereklilikleri.webp",
    date: "2026-02-25",
    readingMinutes: 7,
    content: [
      "Freelance çalışmak özgürlük getirir; ama mali tarafı yönetmezsen stres de getirir. Bu yazı bir mali müşavir danışmanlığının yerini tutmaz; ancak başlarken aklında bir çerçeve oluşmasını sağlar.",
      "1) Gelirini kayıt altına al: İster bireysel ister şirketli çalış, kazançların takibini düzenli yap. Aylık gelir-gider tablosu bile büyük fark yaratır.",
      "2) Fatura/Belgelendirme: Müşterilerin çoğu fatura ister. Çalışma modeline göre serbest meslek makbuzu veya fatura gibi seçenekler gündeme gelir.",
      "3) Muhasebe gideri: Genelde sabit bir muhasebe ücreti olur. Bunu fiyatlamana dahil etmeyi unutma.",
      "4) Vergi ve primler: Gelire göre değişen vergiler ve sosyal güvenlik primleri olabilir. Net kazanç hesabını ‘brüt gelir’ değil, ‘vergiler sonrası’ üzerinden yap.",
      "5) Olası maliyetler: Yazılım lisansları, ekipman (bilgisayar/monitör), internet/telefon, eğitim ve abonelikler düzenli gider kalemlerine dönüşebilir.",
      "6) Fiyatlama stratejisi: ‘Sadece emeğim’ değil, işletme giderlerin ve risk payın da fiyatın içinde olmalı.",
      "Mali tarafı erkenden düzene sokarsan, büyüdükçe daha rahat edersin. Şüphede kaldığın her konuda bir uzmana danışman en sağlıklısıdır."
    ],
  },
  {
    slug: "freelancer-olmak-nedir",
    title: "Freelancer Olmak: Kendi İşinin Patronu Olmanın Gerçekleri",
    excerpt:
      "Özgürlük kadar disiplin de ister. Freelance çalışmanın artıları, eksileri ve sürdürülebilir hale getirmek için ipuçları.",
    category: "Freelancerlık",
    coverImage: "/blog/isgucu.webp",
    date: "2026-02-25",
    readingMinutes: 5,
    content: [
      "Freelancer olmak; tek başına çalışmak değil, küçük bir işletme gibi düşünmektir. Satış, iletişim, teslimat, muhasebe ve itibar yönetimi aynı paketin içindedir.",
      "Artıları: Esnek zaman, proje seçme özgürlüğü, farklı sektörlerle çalışma ve ölçeklenebilir gelir.",
      "Zorlukları: Gelir dalgalanması, ‘hayır’ diyememe, müşteri yönetimi ve yalnız çalışma.",
      "Sürdürülebilirlik için 3 alışkanlık: (1) Haftalık plan + teslim tarihleri, (2) Teklif/brief şablonları, (3) Düzenli portföy güncellemesi.",
      "Freelance kariyer, doğru sistem kurulduğunda uzun vadeli bir mesleğe dönüşür."
    ],
  },
  {
    slug: "isten-ayrilip-freelance-baslamak-6-neden",
    title: "İşinden Ayrılman ve Freelance Çalışma Hayatına Başlaman İçin 6 Neden",
    excerpt:
      "Tam zamanlı işten freelance’e geçiş herkes için doğru olmayabilir. Karar vermeden önce motivasyonunu ve planını netleştir.",
    category: "Kariyer",
    coverImage: "/blog/isten-ayrilma-6-neden.webp",
    date: "2026-02-25",
    readingMinutes: 6,
    content: [
      "Freelance’e geçiş bir ‘kaçış planı’ değil, ‘geçiş planı’ olmalı. Aşağıdaki nedenler seni heyecanlandırıyorsa, doğru hazırlıkla geçişi kolaylaştırabilirsin.",
      "1) Zaman kontrolü: Gününü ve enerjini daha verimli planlayabilirsin.",
      "2) Geliri çeşitlendirme: Tek işverene bağlı kalmadan farklı müşterilerle çalışırsın.",
      "3) Uzmanlaşma: Sevdiğin alanda derinleşip marka olma şansın artar.",
      "4) Öğrenme hızı: Farklı projeler farklı problemler demektir; gelişim hızlanır.",
      "5) Yaşam tarzı uyumu: Uzaktan çalışma ve lokasyon esnekliği hayat kaliteni etkileyebilir.",
      "6) Uzun vadede ölçekleme: Paket hizmet, ekip kurma, ürünleştirme gibi seçenekler doğar.",
      "Geçmeden önce: en az 2-3 aylık birikim, düzenli müşteri kanalı ve net bir hizmet alanı belirlemek büyük avantaj sağlar."
    ],
  },
  {
    slug: "isgucu-neden-var",
    title: "İşgücü Neden Var? Güvenli ve Şeffaf Freelance Deneyimi İçin",
    excerpt:
      "Doğru eşleşme, güvenli ödeme ve şeffaf süreç… İşgücü’nün hedefi freelancer ve iş veren için hızlı, net ve güvenli bir çalışma modeli sunmak.",
    category: "Platform",
    coverImage: "/blog/isgucu-neden-var.webp",
    date: "2026-02-25",
    readingMinutes: 4,
    content: [
      "Freelance piyasasında en büyük problem, belirsizliktir: ‘İş doğru tarif edildi mi? Ödeme zamanında gelecek mi? Revizyon sınırı ne?’ İşgücü bu belirsizliği azaltmak için var.",
      "1) Doğru eşleşme: Kategori ve arama yapısıyla iş verenin ihtiyacı ile freelancer’ın yeteneği daha hızlı buluşur.",
      "2) Güvenli ödeme yaklaşımı: Süreç netleştiğinde iki tarafın da içi rahat eder. Hedef; karşılıklı güveni artıran bir akış sunmak.",
      "3) Şeffaf teslim süreci: Brief, teklif, teslim ve onay adımlarının görünür olması; anlaşmazlıkları azaltır.",
      "4) Kaliteli portföy ve profil: Freelancer’ların işlerini daha iyi sergileyebilmesi, iş verenin daha doğru karar vermesini sağlar.",
      "Sonuç: İşgücü; zaman kaybını azaltan, iletişimi sadeleştiren ve güveni yükselten bir freelance deneyimi tasarlamayı amaçlar."
    ],
  },
];

export function getBlogPosts() {
  return BLOG_POSTS.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getBlogPostBySlug(slug: string) {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
