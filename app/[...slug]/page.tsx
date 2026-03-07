"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSiteConfig } from "@/lib/site-config";
import CategoriesAllPageContent from "../categories/all/page";

// Türkçe nested yollar için hangi sayfa component'i render edilecek?
const NESTED_STATIC_PAGES: Record<string, React.ComponentType> = {
    // Kategoriler
    "kategoriler/tum": CategoriesAllPageContent,
    "kategoriler/tumu": CategoriesAllPageContent,
    "kategoriler/tümü": CategoriesAllPageContent,
    "kategoriler/hepsi": CategoriesAllPageContent,
    "kategoriler/all": CategoriesAllPageContent,
};

export default function NestedDynamicPage() {
    const params = useParams();
    const [config, setConfig] = useState(getSiteConfig());

    useEffect(() => {
        const onUpdate = () => setConfig(getSiteConfig());
        window.addEventListener("site_config_updated", onUpdate);
        return () => window.removeEventListener("site_config_updated", onUpdate);
    }, []);

    // Catch-all slug'ları birleştir
    const slugArray = Array.isArray(params?.slug) ? params.slug : [params?.slug];
    const fullPath = slugArray.filter(Boolean).join("/").toLowerCase();

    const PageComponent = NESTED_STATIC_PAGES[fullPath];
    if (PageComponent) return <PageComponent />;

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
