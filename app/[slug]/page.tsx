"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSiteConfig } from "@/lib/site-config";
import SupportPageContent from "../support/page";
import AboutPageContent from "../about/page";
import ContactPageContent from "../contact/page";
import HelpPageContent from "../help/page";
import PrivacyPageContent from "../privacy/page";
import RulesPageContent from "../rules/page";

// Türkçe slug'ları İngilizce karşılıklarına eşleştir
const SLUG_MAPPING: Record<string, string> = {
    // Destek sayfaları
    "destek": "/support",
    "yardim": "/help",
    "yardım": "/help",
    "iletisim": "/contact",
    "iletişim": "/contact",
    "bize-ulasin": "/contact",
    "bizeulaşın": "/contact",
    
    // Kurumsal sayfalar
    "hakkimizda": "/about",
    "hakkımızda": "/about",
    "biz-kimiz": "/about",
    "bizkimiz": "/about",
    "hakkinda": "/about",
    "hakkında": "/about",
    
    // Kurallar ve gizlilik
    "kurallar": "/rules",
    "platform-kurallari": "/rules",
    "platformkuralları": "/rules",
    "kullanim-kosullari": "/rules",
    "kullanımkosulları": "/rules",
    "gizlilik": "/privacy",
    "veri-gizliligi": "/privacy",
    "verigizliliği": "/privacy",
    "privacy-policy": "/privacy",
    
    // Diğer
    "blog": "/blog",
    "akademi": "/blog",
    "kariyer": "/careers",
    "iş-ilanlari": "/jobs",
    "işilanları": "/jobs",
    "ilanlar": "/jobs",
    "freelancerlar": "/freelancers",
    "freelancer": "/freelancers",
};

// Next.js static sayfa yolları (İngilizce)
const STATIC_PAGES: Record<string, React.ComponentType> = {
    "/support": SupportPageContent,
    "/help": HelpPageContent,
    "/contact": ContactPageContent,
    "/about": AboutPageContent,
    "/privacy": PrivacyPageContent,
    "/rules": RulesPageContent,
};

export default function DynamicPage() {
    const params = useParams();
    const slug = String(params?.slug || "").toLowerCase();
    const [config, setConfig] = useState(getSiteConfig());

    useEffect(() => {
        const onUpdate = () => setConfig(getSiteConfig());
        window.addEventListener("site_config_updated", onUpdate);
        return () => window.removeEventListener("site_config_updated", onUpdate);
    }, []);

    // Slug'ı normalize et (başındaki /'ı kaldır)
    const normalizedSlug = slug.replace(/^\//, "");

    // Önce siteConfig managedPages'te bu slug var mı diye bak
    const managedPage = config.managedPages?.find(
        (p) => p.slug?.replace(/^\//, "").toLowerCase() === normalizedSlug && p.enabled
    );

    // Slug mapping'ten İngilizce karşılığını bul
    const mappedPath = SLUG_MAPPING[normalizedSlug];

    // Eğer managedPage varsa ve overrideBuiltIn ise, onun içeriğini göster
    // Yoksa mapping'ten bulunan sayfayı göster
    // Hiçbiri yoksa 404

    if (managedPage?.overrideBuiltIn && mappedPath) {
        // Managed page içeriğini göster ama mevcut sayfa layoutunu kullan
        const PageComponent = STATIC_PAGES[mappedPath];
        if (PageComponent) {
            return <PageComponent />;
        }
    }

    // Mapping'ten bulunan sayfayı göster
    if (mappedPath && STATIC_PAGES[mappedPath]) {
        const PageComponent = STATIC_PAGES[mappedPath];
        return <PageComponent />;
    }

    // Managed page varsa ve özel içerik göstermesi gerekiyorsa
    if (managedPage) {
        // Basit bir içerik sayfası göster
        return (
            <div className="min-h-screen bg-white">
                <div className="container mx-auto px-4 py-24">
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-6">
                        {managedPage.title}
                    </h1>
                    <p className="text-xl text-slate-600 mb-8">{managedPage.summary}</p>
                    <div className="prose max-w-none">
                        {managedPage.content?.split("\n").map((paragraph: string, idx: number) => (
                            <p key={idx} className="mb-4 text-slate-700">{paragraph}</p>
                        ))}
                    </div>
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
