"use client";

import { supabase } from "@/lib/supabase";

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
    sectionTitle?: string;
    sectionAccent?: string;
    enabled: boolean;
    showInHeader: boolean;
    showInFooter: boolean;
    overrideBuiltIn?: boolean;
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
    catalog: {
        categories: Array<{ id: string; title: string; icon: string; color: string }>;
        subCategories: Record<string, string[]>;
        serviceTypes: Record<string, string[]>;
        gigExtras: Record<string, Array<{ label: string; key: string; type: "select" | "toggle" | "input"; options?: Array<string | number> }>>;
        pricingTable: {
            showRevisionsRow: boolean;
        };
    };
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
    catalog: {
        categories: [],
        subCategories: {},
        serviceTypes: {},
        gigExtras: {},
        pricingTable: {
            showRevisionsRow: true,
        },
    },
    managedPages: [
        {
            id: "home-system",
            title: "Anasayfa",
            slug: "/",
            menuLabel: "Anasayfa",
            summary: "",
            content: "Anasayfa hero içeriğini buradan yönetebilirsin.",
            enabled: true,
            showInHeader: false,
            showInFooter: false,
            system: true,
        },
        {
            id: "about-system",
            title: "Biz Kimiz",
            slug: "/about",
            menuLabel: "Biz Kimiz",
            summary: "Kurumsal hikaye ve marka anlatımı",
            content: "Biz Kimiz sayfası içeriğini buradan yönetebilirsin.",
            sectionTitle: "Bir Garajdan",
            sectionAccent: "Global Vizyona",
            enabled: true,
            showInHeader: false,
            showInFooter: true,
            overrideBuiltIn: false,
            system: true,
        },
        {
            id: "jobs-system",
            title: "İlanlar",
            slug: "/jobs",
            menuLabel: "İlanlar",
            summary: "İlan listesi üst açıklama metni",
            content: "İlanlar sayfası içerik override metni.",
            enabled: true,
            showInHeader: false,
            showInFooter: false,
            overrideBuiltIn: false,
            system: true,
        },
        {
            id: "freelancers-system",
            title: "Freelancerlar",
            slug: "/freelancers",
            menuLabel: "Freelancerlar",
            summary: "Freelancer liste sayfası açıklaması",
            content: "Freelancerlar sayfası içerik override metni.",
            enabled: true,
            showInHeader: false,
            showInFooter: false,
            overrideBuiltIn: false,
            system: true,
        },
        {
            id: "blog-system",
            title: "Blog",
            slug: "/blog",
            menuLabel: "Blog",
            summary: "Blog sayfası açıklaması",
            content: "Blog sayfası içerik override metni.",
            enabled: true,
            showInHeader: false,
            showInFooter: false,
            overrideBuiltIn: false,
            system: true,
        },
        {
            id: "support-system",
            title: "Destek",
            slug: "/support",
            menuLabel: "Destek",
            summary: "Destek merkezi açıklaması",
            content: "Destek sayfası içerik override metni.",
            enabled: true,
            showInHeader: false,
            showInFooter: false,
            overrideBuiltIn: false,
            system: true,
        },
        {
            id: "contact-system",
            title: "İletişim",
            slug: "/contact",
            menuLabel: "İletişim",
            summary: "İletişim sayfası açıklaması",
            content: "İletişim sayfası içerik override metni.",
            enabled: true,
            showInHeader: false,
            showInFooter: false,
            overrideBuiltIn: false,
            system: true,
        },
        {
            id: "help-system",
            title: "Yardım Merkezi",
            slug: "/help",
            menuLabel: "Yardım Merkezi",
            summary: "Yardım merkezi açıklaması",
            content: "Yardım merkezi içerik override metni.",
            enabled: true,
            showInHeader: false,
            showInFooter: false,
            overrideBuiltIn: false,
            system: true,
        },
        {
            id: "rules-system",
            title: "Platform Kuralları",
            slug: "/rules",
            menuLabel: "Platform Kuralları",
            summary: "Kural sayfası açıklaması",
            content: "Kural sayfası içerik override metni.",
            enabled: true,
            showInHeader: false,
            showInFooter: false,
            overrideBuiltIn: false,
            system: true,
        },
        {
            id: "privacy-system",
            title: "Veri Gizliliği",
            slug: "/privacy",
            menuLabel: "Veri Gizliliği",
            summary: "Gizlilik sayfası açıklaması",
            content: "Gizlilik sayfası içerik override metni.",
            enabled: true,
            showInHeader: false,
            showInFooter: false,
            overrideBuiltIn: false,
            system: true,
        },
    ],
    announcement: {
        enabled: false,
        text: "Yeni platformumuzu keşfedin! Çok yakında mobil uygulamamız yayında.",
        theme: "blue",
    },
};

const SITE_CONFIG_STORAGE_KEY = "isgucu_site_config";
const SITE_CONFIG_REMOTE_ENDPOINT = "/api/site-config";

function normalizeNavLabel(label: string): string {
    const raw = String(label || "").trim();
    const k = raw.toLowerCase();
    if (k === "about" || k === "about us" || k === "hakkımızda" || k === "hakkimizda") return "Biz Kimiz";
    if (k === "contact" || k === "contact us" || k === "iletisim" || k === "iletişim") return "İletişim";
    if (k === "help" || k === "support" || k === "destek") return "Destek";
    if (k === "rules" || k === "terms" || k === "kurallar") return "Platform Kuralları";
    if (k === "privacy" || k === "privacy policy" || k === "gizlilik") return "Veri Gizliliği";
    if (k === "blog" || k === "academy" || k === "akademi") return "Akademi / Blog";
    return raw;
}

function mergeSiteConfig(parsed: Partial<SiteConfig>): SiteConfig {
    return {
        ...DEFAULT_CONFIG,
        ...parsed,
        headerLinks: (Array.isArray(parsed?.headerLinks) ? parsed.headerLinks : DEFAULT_CONFIG.headerLinks).map((l) => ({
            ...l,
            label: normalizeNavLabel(String((l as any)?.label || "")),
        })),
        footerLinks: (Array.isArray(parsed?.footerLinks) ? parsed.footerLinks : DEFAULT_CONFIG.footerLinks).map((l) => ({
            ...l,
            label: normalizeNavLabel(String((l as any)?.label || "")),
        })),
        socialLinks: Array.isArray(parsed?.socialLinks) ? parsed.socialLinks : DEFAULT_CONFIG.socialLinks,
        catalog: {
            ...DEFAULT_CONFIG.catalog,
            ...(parsed?.catalog || {}),
            categories: Array.isArray(parsed?.catalog?.categories) ? (parsed!.catalog!.categories as any) : DEFAULT_CONFIG.catalog.categories,
            subCategories: parsed?.catalog?.subCategories && typeof parsed.catalog.subCategories === "object" ? (parsed.catalog.subCategories as any) : DEFAULT_CONFIG.catalog.subCategories,
            serviceTypes: parsed?.catalog?.serviceTypes && typeof parsed.catalog.serviceTypes === "object" ? (parsed.catalog.serviceTypes as any) : DEFAULT_CONFIG.catalog.serviceTypes,
            gigExtras: parsed?.catalog?.gigExtras && typeof parsed.catalog.gigExtras === "object" ? (parsed.catalog.gigExtras as any) : DEFAULT_CONFIG.catalog.gigExtras,
            pricingTable: {
                ...DEFAULT_CONFIG.catalog.pricingTable,
                ...(parsed?.catalog?.pricingTable || {}),
                showRevisionsRow: typeof parsed?.catalog?.pricingTable?.showRevisionsRow === "boolean" ? parsed.catalog.pricingTable.showRevisionsRow : DEFAULT_CONFIG.catalog.pricingTable.showRevisionsRow,
            },
        },
        managedPages: (Array.isArray(parsed?.managedPages) ? parsed.managedPages : DEFAULT_CONFIG.managedPages).map((p: Partial<ManagedPage>) => {
            const page = { ...p };
            if (page?.id === "home-system") {
                const summaryText = String(page.summary || "");
                if (summaryText.includes("Landing hero ve SEO metin ayarları") || summaryText.includes("Anasayfa metin ayarları")) {
                    page.summary = "";
                }
            }
            if (page?.id === "about-system") {
                if (String(page.title || "").trim() === "Hakkımızda") page.title = "Biz Kimiz";
                if (String(page.menuLabel || "").trim() === "Hakkımızda") page.menuLabel = "Biz Kimiz";
            }

            const slug = String(page?.slug || "").trim();
            if (slug === "/about") {
                page.title = normalizeNavLabel(String(page.title || ""));
                page.menuLabel = normalizeNavLabel(String(page.menuLabel || ""));
            }
            if (slug === "/contact") {
                page.title = normalizeNavLabel(String(page.title || ""));
                page.menuLabel = normalizeNavLabel(String(page.menuLabel || ""));
            }
            if (slug === "/help" || slug === "/support") {
                page.title = normalizeNavLabel(String(page.title || ""));
                page.menuLabel = normalizeNavLabel(String(page.menuLabel || ""));
            }
            if (slug === "/rules") {
                page.title = normalizeNavLabel(String(page.title || ""));
                page.menuLabel = normalizeNavLabel(String(page.menuLabel || ""));
            }
            if (slug === "/privacy") {
                page.title = normalizeNavLabel(String(page.title || ""));
                page.menuLabel = normalizeNavLabel(String(page.menuLabel || ""));
            }

            return page as ManagedPage;
        }),
        announcement: {
            ...DEFAULT_CONFIG.announcement,
            ...(parsed?.announcement || {}),
        },
    };
}

export function getSiteConfig(): SiteConfig {
    if (typeof window === "undefined") return DEFAULT_CONFIG;
    const raw = localStorage.getItem(SITE_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    try {
        const parsed = JSON.parse(raw) as Partial<SiteConfig>;
        return mergeSiteConfig(parsed);
    } catch {
        return DEFAULT_CONFIG;
    }
}

export async function hydrateSiteConfigFromRemote() {
    if (typeof window === "undefined") return null;
    try {
        const resp = await fetch(`${SITE_CONFIG_REMOTE_ENDPOINT}?t=${Date.now()}`, {
            method: "GET",
            cache: "no-store",
        });
        if (!resp.ok) return null;

        const json = (await resp.json().catch(() => null)) as { config?: Partial<SiteConfig> } | null;
        if (!json?.config) return null;

        const merged = mergeSiteConfig(json.config);
        localStorage.setItem(SITE_CONFIG_STORAGE_KEY, JSON.stringify(merged));
        window.dispatchEvent(new Event("site_config_updated"));
        return merged;
    } catch {
        return null;
    }
}

export async function saveSiteConfig(config: SiteConfig) {
    if (typeof window === "undefined") return;
    // Normalize config before saving to ensure Turkish labels
    const normalized = mergeSiteConfig(config);
    localStorage.setItem(SITE_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new Event("site_config_updated"));

    try {
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !sessionData?.session?.access_token) return;

        await fetch(SITE_CONFIG_REMOTE_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({ config: normalized }),
        });
    } catch {
        // Local save is fallback; remote sync is best effort.
    }
}
