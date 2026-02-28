"use client";

export interface NavLink {
    label: string;
    href: string;
}

export interface ManagedPage {
    id: string;
    title: string;
    slug: string;
    menuLabel: string;
    summary: string;
    content: string;
    enabled: boolean;
    showInHeader: boolean;
    showInFooter: boolean;
    system?: boolean;
}

export interface SiteConfig {
    siteName: string;
    logoUrl: string;
    faviconUrl: string;
    headerLinks: NavLink[];
    footerLinks: NavLink[];
    footerDescription: string;
    socialLinks: NavLink[];
    contactEmail: string;
    contactPhone: string;
    contactAddress: string;
    customCss: string;
    managedPages: ManagedPage[];
    announcement: {
        enabled: boolean;
        text: string;
        theme: "blue" | "red" | "orange" | "slate";
    };
}

const DEFAULT_CONFIG: SiteConfig = {
    siteName: "İŞGÜCÜ",
    logoUrl: "/logo.png",
    faviconUrl: "/logo.png",
    headerLinks: [
        { href: "/jobs", label: "İlanlar" },
        { href: "/freelancers", label: "Freelancerlar" },
        { href: "/blog", label: "Blog" },
        { href: "/support", label: "Destek" },
    ],
    footerLinks: [
        { href: "/about", label: "Biz Kimiz?" },
        { href: "/blog", label: "Akademi / Blog" },
        { href: "/contact", label: "Bize Ulaşın" },
        { href: "/help", label: "Destek Merkezi" },
        { href: "/rules", label: "Platform Kuralları" },
        { href: "/privacy", label: "Veri Gizliliği" },
    ],
    footerDescription: "Türkiye'nin iş gücü potansiyelini dijital dünyaya taşıyoruz. Yetenek ve projenin en güvenli buluşma noktası.",
    socialLinks: [
        { label: "Twitter", href: "https://twitter.com" },
        { label: "LinkedIn", href: "https://linkedin.com" },
        { label: "Instagram", href: "https://instagram.com" },
        { label: "Github", href: "https://github.com" },
    ],
    contactEmail: "merhaba@isgucu.com",
    contactPhone: "0850 555 0101",
    contactAddress: "Levent, Büyükdere Cad. No:199, İstanbul",
    customCss: "",
    managedPages: [
        {
            id: "home-system",
            title: "Anasayfa",
            slug: "/",
            menuLabel: "Anasayfa",
            summary: "Landing hero ve SEO metin ayarları",
            content: "Anasayfa hero içeriğini buradan yönetebilirsin.",
            enabled: true,
            showInHeader: false,
            showInFooter: false,
            system: true,
        },
        {
            id: "about-system",
            title: "Hakkımızda",
            slug: "/about",
            menuLabel: "Hakkımızda",
            summary: "Kurumsal hikaye ve marka anlatımı",
            content: "Hakkımızda sayfası içeriğini buradan yönetebilirsin.",
            enabled: true,
            showInHeader: false,
            showInFooter: true,
            system: true,
        },
    ],
    announcement: {
        enabled: false,
        text: "Yeni platformumuzu keşfedin! Çok yakında mobil uygulamamız yayında.",
        theme: "blue"
    }
};

export function getSiteConfig(): SiteConfig {
    if (typeof window === "undefined") return DEFAULT_CONFIG;
    const raw = localStorage.getItem("isgucu_site_config");
    if (!raw) return DEFAULT_CONFIG;
    try {
        const parsed = JSON.parse(raw);
        return {
            ...DEFAULT_CONFIG,
            ...parsed,
            headerLinks: Array.isArray(parsed?.headerLinks) ? parsed.headerLinks : DEFAULT_CONFIG.headerLinks,
            footerLinks: Array.isArray(parsed?.footerLinks) ? parsed.footerLinks : DEFAULT_CONFIG.footerLinks,
            socialLinks: Array.isArray(parsed?.socialLinks) ? parsed.socialLinks : DEFAULT_CONFIG.socialLinks,
            managedPages: Array.isArray(parsed?.managedPages) ? parsed.managedPages : DEFAULT_CONFIG.managedPages,
            announcement: {
                ...DEFAULT_CONFIG.announcement,
                ...(parsed?.announcement || {}),
            },
        };
    } catch {
        return DEFAULT_CONFIG;
    }
}

export function saveSiteConfig(config: SiteConfig) {
    if (typeof window === "undefined") return;
    localStorage.setItem("isgucu_site_config", JSON.stringify(config));
    window.dispatchEvent(new Event("site_config_updated"));
}
