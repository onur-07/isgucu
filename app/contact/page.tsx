export default function ContactPage() {
    return (
        <div className="container py-12 max-w-4xl">
            <h1 className="text-3xl font-bold font-heading mb-6">İletişim</h1>
            <p className="text-gray-600 mb-8">Bizimle iletişime geçmek için aşağıdaki bilgileri kullanabilirsiniz.</p>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="p-6 bg-white rounded-xl border shadow-sm">
                    <h3 className="font-semibold text-lg mb-2">E-posta</h3>
                    <p className="text-blue-600">destek@isgucu.com</p>
                </div>
                <div className="p-6 bg-white rounded-xl border shadow-sm">
                    <h3 className="font-semibold text-lg mb-2">Adres</h3>
                    <p className="text-gray-600">Teknoloji Vadisi, No: 123, İstanbul, Türkiye</p>
                </div>
            </div>
        </div>
    );
}
