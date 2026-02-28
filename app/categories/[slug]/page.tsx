import { GigList } from "@/components/gigs/gig-list";

const slugToTitle: Record<string, string> = {
    "yazilim-mobil": "Yazılım & Mobil",
    "logo-grafik": "Logo & Grafik",
    "web-tasarim": "Web Tasarım",
    "video-animasyon": "Video & Animasyon",
    "ceviri-icerik": "Çeviri & İçerik",
};

export default function CategoryPage({ params }: { params: { slug: string } }) {
    const title = slugToTitle[params.slug] || "Kategori";

    return (
        <div className="container py-12">
            <div className="mb-8 space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-heading">
                    {title} Hizmetleri
                </h1>
                <p className="text-muted-foreground">
                    En iyi {title.toLocaleLowerCase("tr-TR")} uzmanlarını inceleyin.
                </p>
            </div>

            <GigList category={params.slug} />
        </div>
    );
}
