import { Briefcase, Code, Palette, Laptop, Sparkles, Heart, Zap, Globe } from "lucide-react";

export default function CareersPage() {
    const roles = [
        {
            title: "Frontend Geliştirici",
            dept: "Teknoloji",
            type: "Remote / Tam Zamanlı",
            desc: "Next.js, React ve Tailwind konusunda uzman, kullanıcı deneyimini her şeyin önünde tutan çalışma arkadaşları arıyoruz."
        },
        {
            title: "Ürün Tasarımcısı (UI/UX)",
            dept: "Tasarım",
            type: "Remote / Tam Zamanlı",
            desc: "Freelancer ve iş verenin yolculuğunu pürüzsüzleştirecek, estetik ve fonksiyonelliği birleştirecek tasarımcılar..."
        },
        {
            title: "Operasyon Uzmanı",
            dept: "Müşteri Deneyimi",
            type: "İstanbul Ofis / Hibrit",
            desc: "Platform içindeki uyuşmazlıkları çözecek, topluluk standartlarımızı koruyacak ve üyelerimize rehberlik edecek dinamik bir rol."
        }
    ];

    const perks = [
        { icon: <Globe className="w-8 h-8 text-blue-500" />, title: "%100 Özgürlük", desc: "Nerede çalıştığınızla değil, ne ürettiğinizle ilgileniyoruz." },
        { icon: <Heart className="w-8 h-8 text-red-500" />, title: "Wellness Desteği", desc: "Zihinsel ve fiziksel sağlık en büyük önceliğimiz." },
        { icon: <Zap className="w-8 h-8 text-yellow-500" />, title: "Eğitim Fonu", desc: "Kendinizi geliştirmek için alacağınız her eğitim bizden." },
        { icon: <Briefcase className="w-8 h-8 text-purple-500" />, title: "Modern Ekipman", desc: "Çalışırken ihtiyacınız olan en iyi donanım kapınızda." },
    ];

    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <div className="bg-slate-950 py-32 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-20">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600 rounded-full blur-[120px] -mr-64 -mt-64"></div>
                    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600 rounded-full blur-[120px] -ml-64 -mb-64"></div>
                </div>
                <div className="container mx-auto px-4 relative z-10 text-center">
                    <div className="inline-flex items-center px-6 py-2 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 font-black text-sm uppercase tracking-widest mb-8">
                        Ekibimize Katılın
                    </div>
                    <h1 className="text-5xl md:text-8xl font-black font-heading text-white mb-8 tracking-tighter uppercase leading-none">
                        Geleceği <span className="text-blue-500 italic underline decoration-blue-500/30">İnşa Et</span>
                    </h1>
                    <p className="text-slate-400 text-xl md:text-2xl max-w-3xl mx-auto font-medium">
                        İşgücü'nde biz sadece kod yazmıyoruz; yeteneğin özgürleşme hikayesini yazıyoruz. Sınırların olmadığı bu sistemde bize katılın.
                    </p>
                </div>
            </div>

            {/* Perks Section */}
            <div className="py-24 bg-slate-50">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {perks.map((perk, i) => (
                            <div key={i} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                                <div className="mb-6 group-hover:scale-110 transition-transform">{perk.icon}</div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{perk.title}</h3>
                                <p className="text-slate-600 font-medium text-sm leading-relaxed">{perk.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Open Positions */}
            <div className="py-32">
                <div className="container mx-auto px-4">
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
                        <div className="max-w-xl">
                            <h2 className="text-4xl md:text-6xl font-black text-slate-900 mb-6 uppercase tracking-tighter">Açık Pozisyonlar</h2>
                            <p className="text-slate-500 text-xl font-medium">Birlikte büyümek ve üretmek için en uygun fırsatları inceleyin.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="px-6 py-3 rounded-full bg-slate-100 text-slate-900 font-bold text-sm uppercase">Tüm Departmanlar</div>
                            <div className="px-6 py-3 rounded-full bg-slate-900 text-white font-bold text-sm uppercase italic">Hızla Büyüyoruz</div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {roles.map((role, i) => (
                            <div key={i} className="group relative bg-white border-2 border-slate-100 rounded-[3rem] p-8 md:p-12 hover:border-blue-600 transition-all flex flex-col md:flex-row md:items-center justify-between gap-8 cursor-pointer overflow-hidden">
                                <div className="absolute top-0 right-0 w-2 h-full bg-blue-600 -translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                                <div className="space-y-4">
                                    <div className="flex items-center space-x-3">
                                        <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-600 text-[10px] font-black uppercase tracking-widest">{role.dept}</span>
                                        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">{role.type}</span>
                                    </div>
                                    <h3 className="text-3xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{role.title}</h3>
                                    <p className="text-slate-500 font-medium max-w-xl leading-relaxed">{role.desc}</p>
                                </div>
                                <div>
                                    <button className="w-full md:w-auto px-10 py-5 bg-slate-900 text-white font-black rounded-2xl group-hover:bg-blue-600 transition-all uppercase tracking-widest text-sm italic">Hemen Başvur</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-24 text-center">
                        <div className="p-12 bg-blue-50 rounded-[4rem] border-4 border-dashed border-blue-200">
                            <Sparkles className="w-12 h-12 text-blue-600 mx-auto mb-6" />
                            <h3 className="text-2xl font-black text-slate-900 mb-4 italic">Aradığın Rolü Bulamadın mı?</h3>
                            <p className="text-slate-500 font-medium max-w-lg mx-auto mb-8">Yeni yeteneklere her zaman kapımız açık. Bize özgeçmişini gönder, sana en uygun pozisyon açıldığında ilk haberin olsun.</p>
                            <a href="mailto:kariyer@isgucu.com" className="text-blue-600 font-black text-lg border-b-2 border-blue-600 hover:text-blue-700 transition-all tracking-widest uppercase">kariyer@isgucu.com</a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Culture Image / Placeholder */}
            <div className="container mx-auto px-4 pb-32">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-[600px]">
                    <div className="md:col-span-2 bg-slate-900 rounded-[4rem] overflow-hidden relative group">
                        <div className="absolute inset-0 bg-blue-600/20 group-hover:bg-blue-600/0 transition-all duration-500"></div>
                        <div className="absolute bottom-16 left-16 z-10">
                            <h4 className="text-4xl font-black text-white italic mb-2 uppercase">Ekip Kültürü</h4>
                            <p className="text-white/60 font-bold uppercase tracking-widest text-xs">Yenilikçi, Hızlı ve Şeffaf</p>
                        </div>
                        <Code className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 text-white/5 opacity-50" />
                    </div>
                    <div className="flex flex-col gap-8">
                        <div className="flex-1 bg-blue-600 rounded-[4rem] flex flex-col items-center justify-center p-12 text-center text-white">
                            <Zap className="w-12 h-12 mb-4" />
                            <div className="text-3xl font-black uppercase">Start-Up Ruhu</div>
                        </div>
                        <div className="flex-1 bg-slate-100 rounded-[4rem] flex flex-col items-center justify-center p-12 text-center text-slate-900">
                            <Palette className="w-12 h-12 mb-4 text-blue-600" />
                            <div className="text-3xl font-black uppercase italic">Sınırsız Sanat</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
