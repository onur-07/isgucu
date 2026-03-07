"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSiteConfig } from "@/lib/site-config";

// Türkçe yolları İngilizce karşılıklarına eşleştir (nested path'ler için)
const NESTED_SLUG_MAPPING: Record<string, string> = {
    // Kategoriler
    "kategoriler/tum": "/categories/tum",
    "kategoriler/tumu": "/categories/tum",
    "kategoriler/tümü": "/categories/tum",
    "kategoriler/hepsi": "/categories/tum",
    
    // Diğer nested yollar buraya eklenebilir
};

export default function NestedDynamicPage() {
    const params = useParams();
    const router = useRouter();
    const [config, setConfig] = useState(getSiteConfig());

    useEffect(() => {
        const onUpdate = () => setConfig(getSiteConfig());
        window.addEventListener("site_config_updated", onUpdate);
        return () => window.removeEventListener("site_config_updated", onUpdate);
    }, []);

    // Catch-all slug'ları birleştir
    const slugArray = Array.isArray(params?.slug) ? params.slug : [params?.slug];
    const fullPath = slugArray.filter(Boolean).join("/").toLowerCase();

    // Mapping'ten İngilizce karşılığını bul
    const mappedPath = NESTED_SLUG_MAPPING[fullPath];

    if (mappedPath) {
        // Client-side redirect to the English path
        router.replace(mappedPath);
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <p className="text-lg text-slate-600">Yönlendiriliyor...</p>
                </div>
            </div>
        );
    }

    // 404 - Sayfa bulunamadı
    return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="text-center">
                <h1 className="text-6xl font-black text-slate-900 mb-4">404</h1>
                <p className="text-xl text-slate-600">Sayfa bulunamadı</p>
            </div>
        </div>
    );
}
