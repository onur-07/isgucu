import { Mail, Phone, MapPin, MessageCircle, Send, Clock, Headphones } from "lucide-react";
import Link from "next/link";

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header Section */}
            <div className="bg-slate-900 py-24 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                <div className="container mx-auto px-4 relative z-10">
                    <h1 className="text-4xl md:text-6xl font-black font-heading text-white mb-6 italic tracking-tight uppercase">Bize Ulaşın</h1>
                    <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-medium">Size en iyi deneyimi sunmak için her kanalda dinlemeye hazırız. Hızı ve güvenliği önceliğimiz yapıyoruz.</p>
                </div>
            </div>

            <div className="container mx-auto px-4 -mt-16 relative z-20 pb-24">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Official Channels */}
                    <div className="md:col-span-1 space-y-6">
                        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 shadow-inner">
                                <Mail className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-wide">E-Posta</h3>
                            <p className="text-slate-600 font-medium mb-4">Medyadan ortaklık tekliflerine kadar her şey için:</p>
                            <a href="mailto:merhaba@isgucu.com" className="text-blue-600 font-black text-lg border-b-2 border-blue-100 hover:border-blue-600 transition-all">merhaba@isgucu.com</a>
                        </div>

                        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-2xl bg-slate-50 text-slate-900 flex items-center justify-center mb-6 shadow-inner">
                                <MapPin className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-wide">Merkez Ofis</h3>
                            <p className="text-slate-600 font-medium leading-relaxed">Levent Plaza, Büyükdere Cad. <br /> Kat:12 No:199, Şişli <br /> İstanbul, Türkiye</p>
                        </div>

                        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center mb-6 shadow-inner">
                                <MessageCircle className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-wide">Canlı Destek</h3>
                            <p className="text-slate-600 font-medium mb-4">Hızlı sorularınız için paneldeki chatbot her an aktif!</p>
                            <span className="text-green-600 font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></span>
                                ŞU AN AKTİF
                            </span>
                        </div>
                    </div>

                    {/* Support Ticket Section (Primary) */}
                    <div className="md:col-span-2">
                        <div className="bg-white rounded-[3.5rem] shadow-2xl overflow-hidden border border-slate-100 h-full flex flex-col">
                            <div className="p-10 md:p-16 flex-1">
                                <div className="inline-flex items-center space-x-2 text-blue-600 font-black uppercase tracking-widest text-sm mb-6">
                                    <span className="h-px w-8 bg-blue-600"></span>
                                    <span>PROFESYONEL DESTEK</span>
                                </div>
                                <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-8 leading-tight">Bir Sorunun mu Var? <br /><span className="text-blue-600">Resmi Destek Talebi Aç</span></h2>

                                <p className="text-slate-600 text-lg font-medium mb-12 leading-relaxed">
                                    Ödemelerle ilgili bir uyuşmazlığın mı var ya da teknik bir sorun mu yaşıyorsun? Destek merkezimiz üzerinden açacağın "Ticket" bizzat ekibimiz tarafından incelenir ve 24 saat içinde sonuçlandırılır.
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
                                    <div className="flex items-start space-x-4">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1">
                                            <Clock className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900">Hızlı Yanıt Süresi</h4>
                                            <p className="text-sm text-slate-500 font-medium">Ortalama 2 saat içinde ilk dönüş yapılır.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start space-x-4">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1">
                                            <Headphones className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900">Uzman Ekip</h4>
                                            <p className="text-sm text-slate-500 font-medium">Sorularınız yapay zeka tarafından değil, insan uzmanlar tarafından yanıtlanır.</p>
                                        </div>
                                    </div>
                                </div>

                                <Link
                                    href="/support"
                                    className="inline-flex items-center justify-center w-full sm:w-auto px-12 py-6 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all hover:scale-105 shadow-xl shadow-blue-500/20 text-lg"
                                >
                                    DESTEK TALEBİ (TICKET) OLUŞTUR <Send className="ml-3 w-5 h-5" />
                                </Link>
                            </div>

                            <div className="bg-slate-50 p-8 border-t border-slate-100 text-center">
                                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Uyuşmazlık durumunda taraf tutmadan 'Hakem' rolü üstleniyoruz.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
