import { Globe, Star, ShieldCheck, Target, Rocket } from "lucide-react";
import Image from "next/image";

export default function AboutPage() {
    const values = [
        {
            icon: <ShieldCheck className="w-10 h-10 text-blue-600" />,
            title: "Önce Güven",
            desc: "Tüm süreçlerimizde şeffaflığı ve güvenliği en üst basamakta tutuyoruz. Ödemeleriniz ve emeğiniz bizimle güvende."
        },
        {
            icon: <Target className="w-10 h-10 text-purple-600" />,
            title: "Doğru Eşleşme",
            desc: "Yapay zeka destekli altyapımızla, projenize en uygun yeteneği veya yeteneğinize en uygun projeyi saniyeler içinde buluyoruz."
        },
        {
            icon: <Rocket className="w-10 h-10 text-orange-600" />,
            title: "Hız ve Verimlilik",
            desc: "Geleneksel iş modellerindeki bürokrasiyi ortadan kaldırıyor, fikirlerin hayata geçme süresini minimize ediyoruz."
        }
    ];

    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <div className="relative py-24 bg-slate-900 overflow-hidden">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-600/10 skew-x-12 transform origin-right"></div>
                <div className="container mx-auto px-4 relative z-10 text-center">
                    <h1 className="text-4xl md:text-7xl font-black font-heading text-white mb-6 uppercase tracking-tight">
                        İş Gücünün <span className="text-blue-500 italic">Geleceği</span>
                    </h1>
                    <p className="text-slate-400 text-lg md:text-2xl max-w-3xl mx-auto leading-relaxed font-medium">
                        İşgücü, sadece bir pazaryeri değil; yeteneğin özgürleştiği ve sınırların ortadan kalktığı global bir ekosistemdir.
                    </p>
                </div>
            </div>

            {/* Story Section */}
            <div className="container mx-auto px-4 py-24">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8">
                        <div className="inline-flex items-center space-x-2 text-blue-600 font-black uppercase tracking-widest text-sm">
                            <span className="h-px w-8 bg-blue-600"></span>
                            <span>Hikayemiz</span>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight">
                            Bir Garajdan <br /> <span className="text-blue-600">Global Vizyona</span>
                        </h2>
                        <div className="space-y-6 text-slate-600 text-lg leading-relaxed font-medium">
                            <p>
                                2024 yılında, dijital yeteneklerin hak ettiği değeri görmediği ve iş verenlerin doğru uzmana ulaşmakta zorlandığı bir dünyada yola çıktık. Amacımız basitti: "İşi ehline, en hızlı ve güvenli şekilde ulaştırmak."
                            </p>
                            <p>
                                Bugün İşgücü, binlerce yazılımcıdan tasarımcıya, seslendirme sanatçısından veri analizine kadar geniş bir spektrumda profesyoneli tek bir çatı altında topluyor. Biz, bağımsız çalışmanın gücüne ve topluluk olmanın önemine inanıyoruz.
                            </p>
                        </div>
                    </div>
                    <div className="relative">
                        <div className="aspect-square bg-blue-50 rounded-[4rem] rotate-3 absolute inset-0 -z-10"></div>
                        <div className="aspect-square bg-slate-900 rounded-[4rem] overflow-hidden shadow-2xl transform transition-transform hover:-translate-y-4 duration-500 flex items-center justify-center p-12">
                            <Image
                                src="/logo.png"
                                alt="İşgücü Logo"
                                width={400}
                                height={400}
                                className="w-full h-auto object-contain opacity-80"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Values */}
            <div className="bg-slate-50 py-24">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-black text-slate-900 mb-4">Temel Değerlerimiz</h2>
                        <p className="text-slate-500 font-medium max-w-xl mx-auto">Bizim için her proje bir sanat eseri, her freelancer bir partnerdir.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        {values.map((v, i) => (
                            <div key={i} className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
                                <div className="mb-6 group-hover:scale-110 transition-transform">{v.icon}</div>
                                <h3 className="text-2xl font-bold text-slate-900 mb-4">{v.title}</h3>
                                <p className="text-slate-600 leading-relaxed font-medium">{v.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer CTA */}
            <div className="container mx-auto px-4 py-24">
                <div className="bg-blue-600 rounded-[3rem] p-12 md:p-20 text-center text-white relative overflow-hidden group">
                    <div className="relative z-10">
                        <h2 className="text-4xl md:text-6xl font-black mb-8">Bu Yolculuğa <br /> Ortak Olun</h2>
                        <div className="flex flex-wrap justify-center gap-6">
                            <button className="px-10 py-5 bg-white text-blue-600 font-black rounded-2xl hover:bg-blue-50 transition-all text-lg">Yetenek Olarak Katıl</button>
                            <button className="px-10 py-5 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all text-lg">Proje Başlat</button>
                        </div>
                    </div>
                    <Rocket className="absolute -bottom-20 -right-20 w-80 h-80 text-blue-500/20 -rotate-12 group-hover:translate-x-4 group-hover:-translate-y-4 transition-transform duration-700" />
                </div>
            </div>
        </div>
    );
}
