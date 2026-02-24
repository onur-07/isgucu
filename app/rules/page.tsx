export default function RulesPage() {
    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <h1 className="text-3xl font-bold font-heading mb-6">Kurallar ve Koşullar</h1>
            <div className="prose max-w-none text-gray-600 space-y-4">
                <p>Platformumuzu kullanarak aşağıdaki kuralları kabul etmiş sayılırsınız.</p>
                <ul className="list-disc pl-5 space-y-2">
                    <li>Tüm kullanıcılar birbirine saygılı davranmalıdır.</li>
                    <li>Yasa dışı hizmet talepleri yasaktır.</li>
                    <li>Ödeme işlemleri platform üzerinden yapılmalıdır.</li>
                </ul>
            </div>
        </div>
    );
}
