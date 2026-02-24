export default function HelpPage() {
    return (
        <div className="container py-12 max-w-4xl">
            <h1 className="text-3xl font-bold font-heading mb-6">Yardım Merkezi</h1>
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <h3 className="font-semibold text-lg mb-2">Nasıl ilan veririm?</h3>
                    <p className="text-gray-600">Üye olduktan sonra "İş İlanı Ver" butonuna tıklayarak projenizi detaylandırabilirsiniz.</p>
                </div>
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <h3 className="font-semibold text-lg mb-2">Freelancer nasıl olurum?</h3>
                    <p className="text-gray-600">Kayıt olurken "Freelancer" seçeneğini işaretleyerek profilinizi oluşturabilirsiniz.</p>
                </div>
            </div>
        </div>
    );
}
