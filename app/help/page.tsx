import Link from "next/link";
import { Search, Book, User, CreditCard, ShieldCheck, Mail } from "lucide-react";

export default function HelpPage() {
    const categories = [
        { icon: <User className="w-6 h-6" />, title: "Profil & Hesap", desc: "Hesap ayarları, profil doğrulama ve güvenlik." },
        { icon: <Book className="w-6 h-6" />, title: "Freelancer Rehberi", desc: "İş bulma, teklif verme ve başarılı profil oluşturma." },
        { icon: <CreditCard className="w-6 h-6" />, title: "Ödemeler & Faturalar", desc: "Ödeme alma, para çekme ve vergilendirme." },
        { icon: <ShieldCheck className="w-6 h-6" />, title: "Güvenlik & Kurallar", desc: "Platform kuralları, hakem süreci ve topluluk standartları." },
    ];

    const faqs = [
        { q: "Nasıl ilan veririm?", a: "Üye olduktan sonra kontrol panelinizden 'Yeni İlan Ver' butonuna tıklayarak projenizin detaylarını, bütçesini ve süresini belirleyip hemen ilan verebilirsiniz." },
        { q: "Freelancer olarak nasıl iş alırım?", a: "Profilinizi eksiksiz doldurun ve yeteneklerinizi sergileyen bir portfolyo ekleyin. İlgilendiğiniz ilanlara profesyonel bir ön yazı ile teklif vererek başlayabilirsiniz." },
        { q: "Ödemeler ne zaman yatar?", a: "Müşteri işi onayladıktan sonra ödeme İşgücü bakiyenize aktarılır. Bakiyenizi her Çarşamba günü banka hesabınıza çekebilirsiniz." },
        { q: "Uyuşmazlık durumunda ne yapmalıyım?", a: "Eğer proje sırasında bir anlaşmazlık yaşarsanız, sipariş sayfasındaki 'Destek Talebi' butonunu kullanarak ekibimizden yardım isteyebilirsiniz." },
    ];

    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <div className="bg-slate-900 py-20 text-center">
                <div className="container mx-auto px-4">
                    <h1 className="text-4xl md:text-5xl font-bold font-heading text-white mb-6">Size nasıl yardımcı olabiliriz?</h1>
                    <div className="max-w-2xl mx-auto relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Soru veya konu arayın..."
                            className="w-full pl-12 pr-4 py-4 rounded-full bg-white/10 border border-white/20 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-xl"
                        />
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-16 max-w-6xl">
                {/* Categories */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
                    {categories.map((cat, i) => (
                        <div key={i} className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer group">
                            <div className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                {cat.icon}
                            </div>
                            <h3 className="font-bold text-slate-900 mb-2">{cat.title}</h3>
                            <p className="text-sm text-slate-600 leading-relaxed">{cat.desc}</p>
                        </div>
                    ))}
                </div>

                {/* Popular Questions */}
                <div className="max-w-3xl mx-auto mb-20">
                    <h2 className="text-3xl font-bold font-heading text-center mb-10 text-slate-900">Sıkça Sorulan Sorular</h2>
                    <div className="space-y-4 text-center items-center">
                        {faqs.map((faq, i) => (
                            <div key={i} className="bg-white border border-slate-100 rounded-2xl p-6 text-left hover:border-blue-100 transition-colors">
                                <h4 className="font-semibold text-slate-900 mb-2 flex items-center">
                                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                                    {faq.q}
                                </h4>
                                <p className="text-slate-600 pl-5 text-sm md:text-base leading-relaxed">{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Blog Suggestion & Contact */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-blue-600 rounded-3xl p-10 text-white relative overflow-hidden group">
                        <div className="relative z-10">
                            <h3 className="text-2xl font-bold mb-4">Blog sayfamıza göz atın</h3>
                            <p className="text-blue-100 mb-6">Freelance hayatı, bütçe yönetimi ve yeni teknolojiler hakkında ipuçları.</p>
                            <Link href="/blog" className="inline-flex items-center justify-center px-6 py-3 bg-white text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-colors">
                                Blog'u Keşfet
                            </Link>
                        </div>
                        <Book className="absolute -bottom-10 -right-10 w-48 h-48 text-blue-500/30 rotate-12 group-hover:scale-110 transition-transform" />
                    </div>

                    <div className="bg-slate-100 rounded-3xl p-10 text-slate-900 relative overflow-hidden group">
                        <div className="relative z-10">
                            <h3 className="text-2xl font-bold mb-4">Hala yardıma mı ihtiyacınız var?</h3>
                            <p className="text-slate-600 mb-6">Destek ekibimiz sorularınızı yanıtlamak için burada.</p>
                            <Link href="/contact" className="inline-flex items-center justify-center px-6 py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors">
                                Bize Yazın
                            </Link>
                        </div>
                        <Mail className="absolute -bottom-10 -right-10 w-48 h-48 text-slate-300/30 -rotate-12 group-hover:scale-110 transition-transform" />
                    </div>
                </div>
            </div>
        </div>
    );
}
