"use client";

export interface NavLink {
    label: string;
    href: string;
}

export interface SiteConfig {
    siteName: string;
    logoUrl: string;
    headerLinks: NavLink[];
    footerLinks: NavLink[];
    contactEmail: string;
    contactPhone: string;
    contactAddress: string;
    announcement: {
        enabled: boolean;
        text: string;
        theme: "blue" | "red" | "orange" | "slate";
    };
}

const DEFAULT_CONFIG: SiteConfig = {
    siteName: "İŞGÜCÜ",
    logoUrl: "/logo.png",
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
    contactEmail: "merhaba@isgucu.com",
    contactPhone: "0850 555 0101",
    contactAddress: "Levent, Büyükdere Cad. No:199, İstanbul",
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
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
        return DEFAULT_CONFIG;
    }
}

export function saveSiteConfig(config: SiteConfig) {
    if (typeof window === "undefined") return;
    localStorage.setItem("isgucu_site_config", JSON.stringify(config));
    window.dispatchEvent(new Event("site_config_updated"));
}
