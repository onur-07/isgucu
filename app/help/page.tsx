import Link from "next/link";
import { Search, Book, User, CreditCard, ShieldCheck, Mail, Zap, Target } from "lucide-react";

export default function HelpPage() {
    const categories = [
        { icon: <User className="w-6 h-6" />, title: "Hesap & Profil", desc: "Üyelik süreçleri, kimlik doğrulama ve veri güvenliği." },
        { icon: <Zap className="w-6 h-6" />, title: "Freelancer Başarısı", desc: "Profilinizi öne çıkarma, ilk işi alma ve müşteri yönetimi." },
        { icon: <Target className="w-6 h-6" />, title: "İş Veren Rehberi", desc: "Doğru yeteneği bulma, iş ilanı optimizasyonu ve ödeme süreçleri." },
        { icon: <CreditCard className="w-6 h-6" />, title: "Finansal İşlemler", desc: "Güvenli ödeme sistemi, komisyonlar ve para çekme takvimi." },
    ];

    const questions = [
        { q: "İşgücü komisyon oranları nedir?", a: "Sistemimizin sürdürülebilirliği ve güvenliği için başarılı siparişlerden %15 oranında hizmet bedeli alınmaktadır. Aylık Pro üyelerimiz için bu oran %10'a düşmektedir." },
        { q: "Müşterimle platform dışı iletişim kurabilir miyim?", a: "Hayır. Güvenliğiniz ve uyuşmazlık çözümü garantimiz için tüm iletişim İşgücü üzerinden yapılmalıdır. Dışarıdan iletişim kurmak hesabınızın askıya alınmasına neden olabilir." },
        { q: "Ödememi ne zaman çekebilirim?", a: "Müşteri onayından sonra bakiye hesabınıza tanımlanır. Çarşamba günleri verilen çekim talepleri, takip eden iş günü banka hesabınıza aktarılır." },
        { q: "İş teslim edildi ama müşteri onaylamıyor?", a: "Eğer işi tam ve eksiksiz teslim ettiyseniz ancak 3 gün boyunca alıcıdan yanıt gelmezse, tarafımızdan otomatik onay süreci başlatılmaktadır." },
    ];

    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <div className="bg-blue-950 py-24 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <div className="absolute top-10 left-10 w-64 h-64 bg-blue-400 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-600 rounded-full blur-3xl"></div>
                </div>
                <div className="container mx-auto px-4 relative z-10">
                    <h1 className="text-4xl md:text-6xl font-black font-heading text-white mb-6">İşgücü Destek <span className="text-blue-400">Merkezi</span></h1>
                    <p className="text-blue-200 text-lg md:text-xl max-w-2xl mx-auto mb-10 font-medium italic">Sorularınızın yanıtları burada. Yetenek dünyasında kaybolmayın.</p>
                    <div className="max-w-2xl mx-auto relative group">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-blue-400 w-6 h-6" />
                        <input
                            type="text"
                            placeholder="Bir konu veya soru yazın..."
                            className="w-full pl-16 pr-8 py-6 rounded-[2rem] bg-white/10 border-2 border-white/20 text-white placeholder:text-blue-300 focus:outline-none focus:ring-4 focus:ring-blue-500/30 focus:bg-white/20 transition-all shadow-2xl"
                        />
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-20 max-w-6xl">
                {/* Categories */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
                    {categories.map((cat, i) => (
                        <div key={i} className="p-8 rounded-[2.5rem] bg-slate-50 border-2 border-transparent hover:border-blue-600 hover:bg-white hover:shadow-2xl transition-all cursor-pointer group">
                            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform shadow-lg">
                                {cat.icon}
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-3">{cat.title}</h3>
                            <p className="text-sm text-slate-600 leading-relaxed font-medium">{cat.desc}</p>
                        </div>
                    ))}
                </div>

                {/* FAQ */}
                <div className="max-w-4xl mx-auto mb-24">
                    <h2 className="text-3xl font-black font-heading text-center mb-12 text-slate-900 uppercase tracking-tight">En Çok Merulanlar</h2>
                    <div className="space-y-6">
                        {questions.map((faq, i) => (
                            <div key={i} className="bg-white border-2 border-slate-100 rounded-[2rem] p-8 hover:border-blue-50 transition-all">
                                <h4 className="text-lg font-bold text-slate-900 mb-3 flex items-center">
                                    <span className="w-3 h-3 bg-blue-600 rounded-full mr-4"></span>
                                    {faq.q}
                                </h4>
                                <p className="text-slate-600 pl-7 leading-relaxed font-medium">{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CTA Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="bg-blue-600 rounded-[3rem] p-12 text-white shadow-2xl shadow-blue-200 relative overflow-hidden group">
                        <div className="relative z-10">
                            <h3 className="text-3xl font-black mb-4 italic">İşgücü Akademi</h3>
                            <p className="text-blue-100 mb-8 text-lg font-medium">Freelancerlıkta nasıl bir marka olursunuz? Ücretsiz rehberlerimizi keşfedin.</p>
                            <Link href="/blog" className="inline-flex items-center justify-center px-8 py-4 bg-white text-blue-600 font-black rounded-2xl hover:bg-blue-50 transition-all hover:scale-105">
                                Rehbere Göz At
                            </Link>
                        </div>
                        <Book className="absolute -bottom-10 -right-10 w-64 h-64 text-blue-500/20 rotate-12 group-hover:scale-110 transition-transform" />
                    </div>

                    <div className="bg-slate-900 rounded-[3rem] p-12 text-white shadow-2xl shadow-slate-200 relative overflow-hidden group">
                        <div className="relative z-10">
                            <h3 className="text-3xl font-black mb-4 italic">Hala Çözemedik mi?</h3>
                            <p className="text-slate-400 mb-8 text-lg font-medium">Destek ekibimiz 7/24 yanınızda. Bize bir mesaj kadar yakınsınız.</p>
                            <Link href="/contact" className="inline-flex items-center justify-center px-8 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all hover:scale-105">
                                Destek Talebi Aç
                            </Link>
                        </div>
                        <Mail className="absolute -bottom-10 -right-10 w-64 h-64 text-slate-800 rotate-12 group-hover:scale-110 transition-transform" />
                    </div>
                </div>
            </div>
        </div>
    );
}
