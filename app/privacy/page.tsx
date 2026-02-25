export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-white py-16">
            <div className="container mx-auto px-4 max-w-4xl">
                <div className="bg-slate-50 rounded-[3rem] p-8 md:p-16 border border-slate-100 shadow-sm">
                    <h1 className="text-4xl font-black font-heading mb-10 text-slate-900 border-b border-slate-200 pb-6 italic">Veri Gizliliği Manifestosu</h1>

                    <div className="space-y-10 text-slate-700 leading-relaxed font-medium">
                        <section>
                            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-black">01</span>
                                Neleri Emanet Alıyoruz?
                            </h2>
                            <p>İşgücü'ne katıldığınızda, size özel bir deneyim sunabilmemiz için temel kimlik ve iletişim bilgilerinizi bizimle paylaşırsınız. Yeteneklerinizi sergileyen portfolyo içerikleri ve platform içi etkinlik verileriniz, sistemimizi sizin için daha akıllı hale getirmek amacıyla şifrelenmiş olarak saklanır.</p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-black">02</span>
                                Bilgilerinizi Nasıl Değerlendiriyoruz?
                            </h2>
                            <p>Verileriniz, İşgücü topluluğundaki eşleşme kalitesini artırmak, ödeme süreçlerinizi güvence altına almak ve platformun genel güvenliğini optimize etmek dışında hiçbir amaçla kullanılmaz. Yapay zeka algoritmalarımız, size en uygun işleri önermek için anonimleştirilmiş kullanım verilerinden destek alır.</p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-black">03</span>
                                Üçüncü Taraflar ve Tavizsiz Güvenlik
                            </h2>
                            <p>Kişisel verileriniz, sadece yasal merciler tarafından zorunlu kılınan hallerde veya ödeme altyapısı (SSL sertifikalı kuruluşlar) gibi hizmetin doğası gereği olan iş ortaklarımızla paylaşılır. 'İşgücü Veri Güvenliği Protokolü' uyarınca, bilgileriniz asla bir meta olarak satılmaz veya pazarlama amaçlı dışarıya sızdırılmaz.</p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-black">04</span>
                                Kontrol Tamamen Sizin Elinizde
                            </h2>
                            <p>KVKK haklarınız kapsamında; verilerinizin silinmesini talep etme, işlenme detaylarını öğrenme ve hatalı bilgilerin düzeltilmesini isteme haklarınız bizim için birer kullanıcı seçeneği değil, temel sorumluluğumuzdur. Hesabınızı kapattığınız anda, yasal saklama süreleri bitiminde tüm verileriniz sunucularımızdan kalıcı olarak temizlenir.</p>
                        </section>

                        <section className="pt-10 border-t border-slate-200">
                            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Son Güncelleme: 25 Şubat 2026 • İşgücü Uyumluluk Masası</p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
