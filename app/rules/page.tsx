import { Gavel, ShieldAlert, CheckCircle2, AlertTriangle, RefreshCcw } from "lucide-react";

export default function RulesPage() {
    const sections = [
        {
            title: "Platform Etik ve Kullanım İlkeleri",
            icon: <ShieldAlert className="w-6 h-6 mr-3 text-blue-500" />,
            items: [
                "İşgücü, profesyonel bir yetenek pazaryeridir; tüm üyeler bu vizyona uygun, yapıcı ve profesyonel bir dil kullanmalıdır.",
                "Başkasına ait portfolyo veya referansların izinsiz kullanımı kesinlikle yasaktır ve tespiti halinde hesap kalıcı olarak kapatılır.",
                "Platformun huzurunu bozan, taciz veya ayrımcılık içeren yaklaşımlar sıfır tolerans politikamız dahilindedir."
            ]
        },
        {
            title: "İletişim ve Ödeme Güvenliği (Kırmızı Çizgilerimiz)",
            icon: <AlertTriangle className="w-6 h-6 mr-3 text-red-500" />,
            items: [
                "Güvenliğiniz için tüm yazışmalar ve dosya paylaşımları sadece İşgücü mesaj paneli üzerinden gerçekleştirilmelidir.",
                "Mesajlaşma alanında IBAN, telefon numarası, e-posta adresi veya sosyal medya hesabı paylaşmak kesinlikle yasaktır.",
                "İletişim kuralları ihlallerinin tespiti veya tekrarı halinde; tüm aktif ilanlarınızın pasife alınması ve hesabınızın süresiz engellenmesi gibi ciddi yaptırımlar uygulanır.",
                "Dışarıdan (kayıt dışı) ödeme teklif edilmesi veya kabul edilmesi, her iki taraf için de platform garantisinin sona ermesi demektir."
            ]
        },
        {
            title: "Sipariş İptal ve İade Koşulları",
            icon: <RefreshCcw className="w-6 h-6 mr-3 text-green-500" />,
            items: [
                "Sipariş işlemleri başladıktan sonra, makul bir sebep olmaksızın iptal talebi oluşturulamaz.",
                "Freelancer, işi belirlenen sürede teslim etmezse; alıcı siparişi tek taraflı iptal etme ve tam iade alma hakkına sahiptir.",
                "Teslim edilen işin belirtilen kriterleri karşılamaması durumunda, 'Uyuşmazlık Çözüm Merkezi' devreye girer ve tarafsız değerlendirme yapılır.",
                "Onaylanan siparişlerde iade süreci, platformun hizmet bedeli ve vergi kesintileri düşüldükten sonra neticelendirilir."
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 py-16">
            <div className="container mx-auto px-4 max-w-4xl text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-900 text-white shadow-xl mb-6">
                    <Gavel className="w-10 h-10" />
                </div>
                <h1 className="text-4xl font-black font-heading mb-4 text-slate-900">İşgücü Kullanım Standartları</h1>
                <p className="text-slate-600 mb-12 max-w-2xl mx-auto font-medium">Birlikte daha güvenli, şeffaf ve profesyonel bir çalışma ortamı inşa ediyoruz.</p>

                <div className="space-y-8 text-left">
                    {sections.map((section, idx) => (
                        <div key={idx} className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
                                {section.icon}
                                {section.title}
                            </h2>
                            <ul className="space-y-4">
                                {section.items.map((item, i) => (
                                    <li key={i} className="flex items-start">
                                        <CheckCircle2 className="w-5 h-5 mr-3 text-blue-600 shrink-0 mt-1" />
                                        <span className="text-slate-700 leading-relaxed font-medium">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="mt-12 p-8 bg-slate-900 rounded-[2.5rem] text-white">
                    <p className="font-semibold text-slate-300">İşgücü üzerinde işlem başlatan her kullanıcı, yukarıdaki standartları ve yaptırımları peşinen kabul etmiş sayılır.</p>
                </div>
            </div>
        </div>
    );
}
