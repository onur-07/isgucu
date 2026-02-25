import { Gavel, ShieldAlert, CheckCircle2 } from "lucide-react";

export default function RulesPage() {
    const rules = [
        {
            title: "Genel Kullanım Kuralları",
            items: [
                "Tüm kullanıcılar diğer üyelere karşı saygılı ve profesyonel davranmalıdır.",
                "Platform üzerinde yanıltıcı, asılsız veya yasa dışı içerik paylaşımı yasaktır.",
                "Birden fazla hesap açarak sistemi suistimal etmek hesap kapatma sebebidir."
            ]
        },
        {
            title: "İş ve Ödeme Kuralları",
            items: [
                "Tüm finansal işlemler platformun güvenli ödeme sistemi üzerinden yapılmalıdır.",
                "Platform dışı ödeme teklif etmek veya kabul etmek güvenlik riski oluşturur ve yasaktır.",
                "İş teslimleri belirlenen süreler içerisinde ve anlaşılan kriterlere uygun yapılmalıdır."
            ]
        },
        {
            title: "Yasaklı Hizmetler",
            items: [
                "Akademik dürüstlüğü ihlal eden (tez yazımı, ödev yaptırma vb.) hizmetler yasaktır.",
                "Yasa dışı yazılım, hack hizmetleri veya telif hakkı ihlali içeren işler kabul edilmez.",
                "Spam, sahte takipçi veya yanıltıcı dijital pazarlama hizmetleri yasaktır."
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 py-16">
            <div className="container mx-auto px-4 max-w-4xl text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 text-blue-600 mb-6">
                    <Gavel className="w-10 h-10" />
                </div>
                <h1 className="text-4xl font-bold font-heading mb-4 text-slate-900">Platform Kuralları</h1>
                <p className="text-slate-600 mb-12 max-w-2xl mx-auto">İşgücü topluluğunun güvenli ve verimli kalmasını sağlamak için lütfen aşağıdaki kurallara uyunuz.</p>

                <div className="space-y-8 text-left">
                    {rules.map((section, idx) => (
                        <div key={idx} className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
                                <ShieldAlert className="w-6 h-6 mr-3 text-amber-500" />
                                {section.title}
                            </h2>
                            <ul className="space-y-4">
                                {section.items.map((item, i) => (
                                    <li key={i} className="flex items-start">
                                        <CheckCircle2 className="w-5 h-5 mr-3 text-green-500 shrink-0 mt-0.5" />
                                        <span className="text-slate-700">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="mt-12 p-8 bg-blue-50 rounded-3xl border border-blue-100">
                    <p className="text-blue-800 font-medium">Bu kuralların ihlali durumunda İşgücü, kullanıcı hesaplarını askıya alma veya kalıcı olarak kapatma hakkını saklı tutar.</p>
                </div>
            </div>
        </div>
    );
}
