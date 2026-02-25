export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-slate-50 py-16">
            <div className="container mx-auto px-4 max-w-4xl">
                <div className="bg-white rounded-2xl shadow-sm border p-8 md:p-12">
                    <h1 className="text-4xl font-bold font-heading mb-8 text-slate-900 border-b pb-4">Gizlilik Politikası</h1>

                    <div className="space-y-8 text-slate-700 leading-relaxed">
                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Veri Toplama</h2>
                            <p>İşgücü platformu olarak, size daha iyi hizmet verebilmek için üyelik sırasında ad, soyad, e-posta adresi ve profil bilgileriniz gibi temel verileri topluyoruz. Ayrıca platform kullanım alışkanlıklarınız ve tercihleriniz de anonim olarak analiz edilmektedir.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 mb-3">2. Bilgilerin Kullanımı</h2>
                            <p>Topladığımız bilgiler şu amaçlarla kullanılır:</p>
                            <ul className="list-disc pl-6 mt-2 space-y-2">
                                <li>Hesabınızın güvenliğini sağlamak ve doğrulamak.</li>
                                <li>İş ilanları ve freelancer eşleşmelerini optimize etmek.</li>
                                <li>Ödeme süreçlerini güvenli bir şekilde yönetmek.</li>
                                <li>Sistem güncellemeleri ve önemli duyurular hakkında sizi bilgilendirmek.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 mb-3">3. Veri Güvenliği</h2>
                            <p>Verileriniz, endüstri standardı şifreleme yöntemleri (SSL) ile korunmaktadır. Kişisel bilgileriniz, yasal zorunluluklar haricinde asla üçüncü şahıslarla paylaşılmaz. Ödeme bilgileriniz doğrudan lisanslı ödeme aracıları tarafından işlenir.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 mb-3">4. Kullanıcı Hakları (KVKK)</h2>
                            <p>6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) uyarınca;</p>
                            <ul className="list-disc pl-6 mt-2 space-y-2">
                                <li>Verilerinizin işlenip işlenmediğini öğrenme,</li>
                                <li>Verileriniz işlenmişse bilgi talep etme,</li>
                                <li>Eksik veya yanlış işlenen verilerin düzeltilmesini isteme,</li>
                                <li>Verilerinizin silinmesini veya yok edilmesini isteme haklarına sahipsiniz.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 mb-3">5. Çerezler (Cookies)</h2>
                            <p>Deneyiminizi geliştirmek için çerezler kullanıyoruz. Tarayıcı ayarlarınızdan çerezleri yönetebilirsiniz ancak bu durum bazı site özelliklerinin çalışmasını etkileyebilir.</p>
                        </section>

                        <section className="pt-8 border-t">
                            <p className="text-sm text-slate-500">Son güncelleme: 25 Şubat 2026. Sorularınız için destek ekibimizle iletişime geçebilirsiniz.</p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
