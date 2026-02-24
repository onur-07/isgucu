"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-context";
import {
    Check,
    Star,
    Clock,
    Share2,
    Facebook,
    Twitter,
    Linkedin,
    Link2,
    MessageCircle,
    ChevronRight,
    Calendar,
    Zap,
} from "lucide-react";

interface PackageData {
    name: string;
    description: string;
    price: string;
    deliveryDays: string;
    revisions: string;
    features: string[];
}

interface Gig {
    id: number;
    userId?: string;
    title: string;
    description: string;
    category: string;
    price: string;
    createdAt: string;
    seller: string;
    sellerAvatarUrl?: string;
    images?: string[];
    tags?: string[];
    packages?: Record<string, PackageData>;
}

export default function GigDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [gig, setGig] = useState<Gig | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string>("");
    const [selectedPackage, setSelectedPackage] = useState<string>("basic");
    const [selectedExtraIndexes, setSelectedExtraIndexes] = useState<Record<number, boolean>>({});
    const [creatingOrder, setCreatingOrder] = useState(false);

    useEffect(() => {
        const idParam = Array.isArray((params as any)?.id) ? (params as any).id[0] : (params as any)?.id;
        const idNum = typeof idParam === "string" ? Number(idParam) : NaN;

        const fetchGig = async () => {
            try {
                setLoadError("");

                if (!Number.isFinite(idNum)) {
                    throw new Error("Geçersiz ilan id");
                }

                const withTimeout = async <T,>(p: PromiseLike<T>, ms: number, label: string): Promise<T> => {
                    let timeoutId: ReturnType<typeof setTimeout> | undefined;
                    try {
                        return await Promise.race([
                            Promise.resolve(p),
                            new Promise<T>((_, reject) => {
                                timeoutId = setTimeout(() => reject(new Error(`${label} zaman aşımına uğradı (${ms}ms)`)), ms);
                            }),
                        ]);
                    } finally {
                        if (timeoutId) clearTimeout(timeoutId);
                    }
                };

                const TIMEOUT_MS = 10000;

                const gigRes = (await withTimeout(
                    supabase
                        .from("gigs")
                        .select("id, user_id, title, description, category, price, created_at, images, packages")
                        .eq("id", idNum)
                        .maybeSingle(),
                    TIMEOUT_MS,
                    "Gig sorgusu"
                )) as any;

                if (gigRes?.error) {
                    throw new Error(gigRes.error?.message || "İlan yüklenemedi");
                }

                const row = gigRes?.data;
                if (!row) {
                    setGig(null);
                    return;
                }

                let sellerUsername = "";
                let sellerAvatarUrl = "";
                if (row.user_id) {
                    const profRes = (await withTimeout(
                        supabase
                            .from("profiles")
                            .select("id, username, avatar_url")
                            .eq("id", row.user_id)
                            .maybeSingle(),
                        TIMEOUT_MS,
                        "Seller profili"
                    )) as any;
                    if (profRes?.data?.username) sellerUsername = String(profRes.data.username);
                    if (profRes?.data?.avatar_url) sellerAvatarUrl = String(profRes.data.avatar_url);
                }

                const normalized: Gig = {
                    id: row.id,
                    userId: row.user_id ? String(row.user_id) : undefined,
                    title: row.title,
                    description: row.description,
                    category: row.category,
                    price: row.price,
                    createdAt: row.created_at,
                    seller: sellerUsername || "Anonim",
                    sellerAvatarUrl: sellerAvatarUrl || "",
                    images: row.images || [],
                    packages: row.packages || undefined,
                };

                setGig(normalized);

                if (normalized.packages) {
                    const keys = Object.keys(normalized.packages).filter((k) => k !== "_extras");
                    if (keys.length > 0) setSelectedPackage(keys[0]);
                }
            } catch (err: any) {
                console.error("Gig detail fetch error:", err);
                setLoadError(err?.message ? String(err.message) : "İlan yüklenemedi");
                setGig(null);
            } finally {
                setLoading(false);
            }
        };

        fetchGig();
    }, [params]);

    // useMemo hooks MUST be before any early returns (React Rules of Hooks)
    const extrasList: Array<{ title?: string; price?: string; additionalDays?: string }> = Array.isArray((gig?.packages as any)?._extras)
        ? (gig?.packages as any)?._extras
        : [];

    const toNumber = (v: any) => {
        if (v === null || v === undefined) return 0;
        const s = String(v).trim();
        if (!s) return 0;
        const normalized = s.replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.\-]/g, "");
        const n = Number(normalized);
        return Number.isFinite(n) ? n : 0;
    };

    const selectedExtrasTotalPrice = useMemo(() => {
        return extrasList.reduce((sum, ex, idx) => {
            if (!selectedExtraIndexes[idx]) return sum;
            return sum + toNumber(ex.price);
        }, 0);
    }, [extrasList, selectedExtraIndexes]);

    const selectedExtrasTotalDays = useMemo(() => {
        return extrasList.reduce((sum, ex, idx) => {
            if (!selectedExtraIndexes[idx]) return sum;
            return sum + toNumber(ex.additionalDays);
        }, 0);
    }, [extrasList, selectedExtraIndexes]);

    const selectedExtrasPayload = useMemo(() => {
        return extrasList
            .map((ex, idx) => ({ ex, idx }))
            .filter(({ idx }) => !!selectedExtraIndexes[idx])
            .map(({ ex }) => ({
                title: ex.title || "Ekstra",
                price: toNumber(ex.price),
                additionalDays: toNumber(ex.additionalDays),
            }));
    }, [extrasList, selectedExtraIndexes]);

    if (loading) return <div className="min-h-screen flex items-center justify-center font-black">YÜKLENİYOR...</div>;
    if (loadError) return <div className="min-h-screen flex items-center justify-center font-black">{loadError}</div>;
    if (!gig) return <div className="min-h-screen flex items-center justify-center font-black">İLAN BULUNAMADI</div>;

    const currentPkg = gig.packages ? gig.packages[selectedPackage] : null;

    const pkgAccent = (pk: string) => {
        if (pk === "standard") return { text: "text-[#000080]", border: "border-[#000080]", bg: "bg-[#000080]/5" };
        if (pk === "premium") return { text: "text-blue-600", border: "border-blue-200", bg: "bg-blue-50" };
        return { text: "text-gray-900", border: "border-gray-200", bg: "bg-gray-50" };
    };

    const accent = pkgAccent(selectedPackage);

    const packageEntries: Array<[string, any]> = gig.packages
        ? Object.entries(gig.packages).filter(([key, pkg]: [string, any]) => {
            if (key === "_extras") return false;
            return pkg && typeof pkg === "object" && "price" in pkg;
        })
        : [];

    const packageKeys = packageEntries.map(([k]) => k);

    const corePkgKeys = new Set([
        "name",
        "description",
        "price",
        "deliveryDays",
        "revisions",
        "features",
    ]);

    const dynamicLabelMap: Record<string, string> = {
        pageCount: "Sayfa Sayısı",
        dbIntegration: "Veritabanı Entegrasyonu",
        adminPanel: "Admin Paneli",
        ecommerce: "E-Ticaret Özellikleri",
        seoReady: "SEO Uyumluluk",
        apiCount: "API Entegrasyonu",
        responsive: "Responsive (Mobil) Dizayn",
        screens: "Ekran Sayısı",
        crossPlatform: "iOS & Android (Cross)",
        storeApp: "Mağaza Yayını",
        pushNotif: "Push Bildirimleri",
        authSystem: "Üyelik Sistemi",
        inAppPurchase: "Uygulama İçi Satın Alma",
        concepts: "Konsept Sayısı",
        vector: "Vektörel Format (AI/EPS)",
        transparent: "Logo Transparanlık",
        mockup3d: "3D Mockup Sunumu",
        socialKit: "Sosyal Medya Kiti",
        brandGuide: "Kurumsal Marka Rehberi",
        materials: "Materyal Sayısı",
        bizCard: "Kartvizit Tasarımı",
        envelope: "Antetli Kağıt/Zarf",
        catalog: "Dijital Katalog",
        wordCount: "Kelime Sayısı",
    };

    const labelForDynamicKey = (key: string) => {
        if (dynamicLabelMap[key]) return dynamicLabelMap[key];
        const spaced = key
            .replace(/_/g, " ")
            .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
            .trim();
        return spaced.length ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : key;
    };

    const dynamicKeys: string[] = Array.from(
        new Set(
            packageEntries.flatMap(([_, pkg]) =>
                Object.keys(pkg || {}).filter((k) => !corePkgKeys.has(k))
            )
        )
    ).sort((a, b) => a.localeCompare(b));

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            const offset = 100; // Account for sticky header
            const bodyRect = document.body.getBoundingClientRect().top;
            const elementRect = element.getBoundingClientRect().top;
            const elementPosition = elementRect - bodyRect;
            const offsetPosition = elementPosition - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: "smooth"
            });
        }
    };

    // Calculate all unique features across all packages for the comparison table (exclude _extras)
    const allUniqueFeatures = Array.from(
        new Set(
            packageEntries.flatMap(([_, pkg]) => (Array.isArray((pkg as any)?.features) ? (pkg as any).features : []))
        )
    );


    const toggleExtra = (idx: number) => {
        setSelectedExtraIndexes((prev) => ({ ...prev, [idx]: !prev[idx] }));
    };

    const createOrder = async () => {
        if (!user) {
            router.push("/login");
            return;
        }
        if (!gig) return;
        if (!gig.userId) return alert("Satıcı bilgisi bulunamadı.");
        if (!gig.packages || !gig.packages[selectedPackage]) return alert("Paket seçimi bulunamadı.");

        try {
            setCreatingOrder(true);
            const pkg: any = gig.packages[selectedPackage];
            const basePrice = toNumber(pkg.price);
            const baseDays = toNumber(pkg.deliveryDays);
            const extrasPrice = selectedExtrasPayload.reduce((s, x) => s + toNumber(x.price), 0);
            const extrasDays = selectedExtrasPayload.reduce((s, x) => s + toNumber(x.additionalDays), 0);
            const totalPrice = basePrice + extrasPrice;
            const totalDays = baseDays + extrasDays;

            const { error } = await supabase.from("orders").insert([
                {
                    gig_id: gig.id,
                    buyer_id: user.id,
                    seller_id: gig.userId,
                    buyer_username: user.username,
                    seller_username: gig.seller,
                    package_key: selectedPackage,
                    base_price: basePrice,
                    extras_price: extrasPrice,
                    total_price: totalPrice,
                    base_days: baseDays,
                    extras_days: extrasDays,
                    total_days: totalDays,
                    extras: selectedExtrasPayload,
                    status: "pending",
                },
            ]);

            if (error) {
                console.error("Order insert error:", error);
                alert("Sipariş oluşturulamadı: " + (error.message || "Bilinmeyen hata"));
                return;
            }

            router.push("/orders");
        } finally {
            setCreatingOrder(false);
        }
    };

    const formatRevisions = (val: any) => {
        const s = val === null || val === undefined ? "" : String(val).trim();
        const lower = s.toLowerCase();
        if (s === "99" || lower === "sinirsiz" || lower === "sınırsız") return "Sınırsız";
        return s;
    };

    return (
        <div className="bg-gray-50 min-h-screen">
            {/* Top Navigation - Dynamic Title */}
            <div className="bg-white border-b sticky top-0 z-50 py-4">
                <div className="max-w-7xl mx-auto px-4 md:px-8">
                    <h1 className="text-xl md:text-2xl font-black text-gray-900 leading-tight">
                        {gig.title}
                    </h1>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* LEFT COLUMN */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* 1. Media */}
                        <Card id="ilan-ozeti" className="border-0 shadow-sm overflow-hidden rounded-2xl">
                            <CardContent className="p-0 relative group">
                                <img
                                    src={gig.images?.[0] || "https://images.unsplash.com/photo-1557821552-17105176677c?q=80&w=1632&auto=format&fit=crop"}
                                    alt={gig.title}
                                    className="w-full aspect-[16/10] object-cover"
                                />
                                <div className="absolute top-4 right-4">
                                    <Badge className="bg-white/90 text-black font-black hover:bg-white border-0 shadow-lg px-3 py-1">
                                        <Zap className="w-3 h-3 mr-1 fill-yellow-400 text-yellow-400" /> PRO
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Navigation Tabs */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-2 flex gap-4 overflow-x-auto scrollbar-hide sticky top-[80px] z-40">
                            {[
                                { label: "İlan Özeti", id: "ilan-ozeti" },
                                { label: "Hizmet Hakkında", id: "hizmet-hakkinda" },
                                { label: "Paketleri Karşılaştır", id: "paketleri-karsilastir" }
                            ].map((tab, i) => (
                                <button
                                    key={tab.id}
                                    onClick={() => scrollToSection(tab.id)}
                                    className={`px-6 py-3 rounded-xl font-black text-sm whitespace-nowrap transition-all text-gray-500 hover:text-black hover:bg-gray-50`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* 2. Description */}
                        <section id="hizmet-hakkinda" className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-6">
                            <h2 className="text-2xl font-black text-gray-900">Hizmet Hakkında</h2>
                            <div className="text-black font-medium leading-relaxed whitespace-pre-wrap">
                                {gig.description}
                            </div>
                        </section>

                        {/* 3. Package Comparison (Dynamic) */}
                        {gig.packages && (
                            <section id="paketleri-karsilastir" className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-8 overflow-hidden">
                                <h2 className="text-2xl font-black text-gray-900">Paketleri Karşılaştırın</h2>
                                <div className="overflow-x-auto -mx-8">
                                    <table className="w-full min-w-[600px] border-collapse">
                                        <thead>
                                            <tr className="border-b-2 border-gray-50 text-black">
                                                <th className="p-6 text-left w-1/4"></th>
                                                {packageEntries.map(([key, pkg]) => {
                                                    // Dynamic Color Mapping based on package level
                                                    let headerColor = "text-black"; // Default for basic/Temel
                                                    if (key === "standard") headerColor = "text-[#000080]"; // Pro/Standard (Lacivert)
                                                    if (key === "premium") headerColor = "text-[#3b82f6]"; // Elmas/Premium (Açık Lacivert)

                                                    return (
                                                        <th key={key} className="p-6 text-center">
                                                            <div className="font-black text-2xl mb-1">₺{pkg.price}</div>
                                                            <div className={`text-sm uppercase tracking-widest font-black ${headerColor}`}>
                                                                {pkg.name}
                                                            </div>
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody className="text-black font-bold">
                                            <tr className="border-b border-gray-50">
                                                <td className="p-6 font-black text-sm">Açıklama</td>
                                                {packageEntries.map(([_, pkg], i) => (
                                                    <td key={i} className="p-6 text-xs text-center align-top font-medium opacity-70">{pkg.description}</td>
                                                ))}
                                            </tr>
                                            {/* Features Comparison Rows */}
                                            {allUniqueFeatures.map(feature => (
                                                <tr key={feature} className="border-b border-gray-50">
                                                    <td className="p-6 font-black text-sm text-gray-600">{feature}</td>
                                                    {packageEntries.map(([_, pkg], i) => (
                                                        <td key={i} className="p-6 text-center">
                                                            {pkg.features.includes(feature) ? (
                                                                <Check className="h-5 w-5 text-green-500 mx-auto" />
                                                            ) : (
                                                                <span className="text-gray-200">×</span>
                                                            )}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}

                                            {/* Dynamic fields rows (mockup, social kit etc.) */}
                                            {dynamicKeys.map((k) => (
                                                <tr key={k} className="border-b border-gray-50">
                                                    <td className="p-6 font-black text-sm text-gray-600">{labelForDynamicKey(k)}</td>
                                                    {packageEntries.map(([_, pkg], i) => {
                                                        const v = (pkg as any)?.[k];
                                                        if (typeof v === "boolean") {
                                                            return (
                                                                <td key={i} className="p-6 text-center">
                                                                    {v ? (
                                                                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                                                                    ) : (
                                                                        <span className="text-gray-200">×</span>
                                                                    )}
                                                                </td>
                                                            );
                                                        }
                                                        if (v === null || v === undefined || v === "") {
                                                            return (
                                                                <td key={i} className="p-6 text-center">
                                                                    <span className="text-gray-200">—</span>
                                                                </td>
                                                            );
                                                        }
                                                        return (
                                                            <td key={i} className="p-6 text-center font-black">
                                                                {String(v)}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                            <tr>
                                                <td className="p-6 font-black text-sm">Teslim Süresi</td>
                                                {packageEntries.map(([_, pkg], i) => (
                                                    <td key={i} className="p-6 text-center font-black">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Clock className="h-4 w-4 text-blue-500" /> {pkg.deliveryDays} Gün
                                                        </div>
                                                    </td>
                                                ))}
                                            </tr>
                                            <tr>
                                                <td className="p-6 font-black text-sm">Revizyon</td>
                                                {packageEntries.map(([_, pkg], i) => (
                                                    <td key={i} className="p-6 text-center font-black">
                                                        {formatRevisions(pkg.revisions)}
                                                    </td>
                                                ))}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}
                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="lg:col-span-4 relative">
                        <div className="sticky top-24 space-y-6">
                            {/* 1. Package Selection Sticky Card */}
                            {gig.packages ? (
                                <Card className={`border shadow-lg rounded-3xl overflow-hidden bg-white ${accent.border}`}>
                                    <CardContent className="p-0">
                                        <div className="p-4 bg-gradient-to-b from-gray-50/80 to-white border-b border-gray-100">
                                            <div className="grid grid-cols-3 gap-2">
                                                {packageKeys.map((pkKey) => (
                                                    <button
                                                        key={pkKey}
                                                        onClick={() => setSelectedPackage(pkKey)}
                                                        className={`h-11 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${selectedPackage === pkKey
                                                            ? `bg-white ${pkgAccent(pkKey).text} ${pkgAccent(pkKey).border} shadow-sm`
                                                            : "bg-transparent text-gray-500 border-transparent hover:bg-white/70"
                                                            }`}
                                                    >
                                                        {gig.packages![pkKey].name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="p-6 space-y-5 bg-white">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <h4 className={`font-black leading-tight text-lg truncate ${accent.text}`}>{gig.packages[selectedPackage].name} Paketi</h4>
                                                    <p className="text-xs font-bold text-gray-500 mt-1 leading-relaxed line-clamp-2">
                                                        {gig.packages[selectedPackage].description}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Başlangıç</div>
                                                    <div className={`text-2xl font-black leading-none ${accent.text}`}>₺{toNumber(gig.packages[selectedPackage].price).toLocaleString("tr-TR")}</div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="rounded-2xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-400">Teslim</div>
                                                    <div className="text-sm font-black text-gray-900 mt-1">
                                                        {gig.packages[selectedPackage].deliveryDays}
                                                        {selectedExtrasTotalDays > 0 ? ` + ${selectedExtrasTotalDays}` : ""} gün
                                                    </div>
                                                </div>
                                                <div className="rounded-2xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-400">Revizyon</div>
                                                    <div className="text-sm font-black text-gray-900 mt-1">{formatRevisions(gig.packages[selectedPackage].revisions)}</div>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                {(Array.isArray(gig.packages[selectedPackage].features)
                                                    ? gig.packages[selectedPackage].features
                                                    : []
                                                ).map((f: string) => (
                                                    <div key={f} className="flex items-start gap-3 text-black text-sm font-black min-w-0">
                                                        <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                                        <span className="break-words whitespace-normal">{f}</span>
                                                    </div>
                                                ))}

                                                {dynamicKeys
                                                    .filter((k) => {
                                                        const v = (gig.packages as any)?.[selectedPackage]?.[k];
                                                        return v !== null && v !== undefined && v !== "" && v !== false;
                                                    })
                                                    .map((k) => {
                                                        const v = (gig.packages as any)?.[selectedPackage]?.[k];
                                                        const label = labelForDynamicKey(k);
                                                        const tail = typeof v === "boolean" ? "" : `: ${String(v)}`;
                                                        return (
                                                            <div key={k} className="flex items-start gap-3 text-black text-sm font-black min-w-0">
                                                                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                                                <span className="break-words whitespace-normal">{label}{tail}</span>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                            {extrasList.length > 0 && (
                                                <div className="pt-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ekstralar</div>
                                                        <div className="text-[10px] font-black text-gray-400">
                                                            {selectedExtrasTotalPrice > 0 ? `+ ₺${selectedExtrasTotalPrice.toLocaleString("tr-TR")}` : "Opsiyonel"}
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 space-y-2">
                                                        {extrasList.map((ex, idx) => {
                                                            const checked = !!selectedExtraIndexes[idx];
                                                            const title = ex.title || "Ekstra";
                                                            const price = toNumber(ex.price);
                                                            const days = toNumber(ex.additionalDays);
                                                            return (
                                                                <label
                                                                    key={`${title}-${idx}`}
                                                                    className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 cursor-pointer select-none transition-all ${
                                                                        checked
                                                                            ? "border-blue-200 bg-blue-50/50"
                                                                            : "border-gray-100 bg-gray-50/40 hover:bg-gray-50"
                                                                    }`}
                                                                >
                                                                    <div className="flex items-start gap-3 min-w-0">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="mt-0.5 h-4 w-4"
                                                                            checked={checked}
                                                                            onChange={() => toggleExtra(idx)}
                                                                        />
                                                                        <div className="min-w-0">
                                                                            <p className="text-sm font-black text-gray-900 truncate">{title}</p>
                                                                            {(days > 0) && (
                                                                                <p className="text-xs font-bold text-gray-500 mt-0.5">+{days} gün</p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <p className="text-sm font-black text-gray-900 shrink-0">+₺{price.toLocaleString("tr-TR")}</p>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Toplam</div>
                                                    <div className="text-lg font-black text-gray-900">
                                                        ₺{(toNumber(gig.packages[selectedPackage].price) + selectedExtrasTotalPrice).toLocaleString("tr-TR")}
                                                    </div>
                                                </div>
                                                <div className="mt-1 text-xs font-bold text-gray-500">
                                                    Paket + seçili ekstralar
                                                </div>
                                            </div>

                                            <Button
                                                onClick={createOrder}
                                                disabled={creatingOrder}
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-7 rounded-2xl font-black text-base shadow-lg shadow-blue-100 transition-all active:scale-95 disabled:opacity-60"
                                            >
                                                <span className="flex w-full items-center justify-center gap-3 px-2">
                                                    <span>Siparişi Ver</span>
                                                    <span className="italic">₺{(toNumber(gig.packages[selectedPackage].price) + selectedExtrasTotalPrice).toLocaleString("tr-TR")}</span>
                                                </span>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card className="p-8 border-0 shadow-2xl rounded-[2.5rem] space-y-6">
                                    <div className="text-3xl font-black italic">₺{gig.price}</div>
                                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-8 rounded-xl font-black text-lg shadow-xl">Hemen Satın Al</Button>
                                </Card>
                            )}

                            {/* 2. Seller Info */}
                            <Card className="border-0 shadow-md rounded-[2.5rem] p-8 text-center space-y-6 bg-white">
                                <div className="relative inline-block mx-auto">
                                    <div className="h-32 w-32 rounded-full border-4 border-blue-50 overflow-hidden shadow-xl bg-gray-100 flex items-center justify-center text-4xl font-black text-blue-600">
                                        {gig.sellerAvatarUrl ? (
                                            <img
                                                src={gig.sellerAvatarUrl}
                                                alt={gig.seller}
                                                className="h-full w-full object-cover"
                                                onError={(e) => {
                                                    (e.currentTarget as any).style.display = "none";
                                                }}
                                            />
                                        ) : (
                                            gig.seller.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div className="absolute bottom-1 right-2 h-6 w-6 bg-green-500 border-4 border-white rounded-full"></div>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 mb-1">{gig.seller}</h3>
                                </div>
                                <Button
                                    onClick={() => {
                                        if (!user) {
                                            router.push("/login");
                                            return;
                                        }
                                        const seller = String(gig.seller || "").trim();
                                        if (!seller) return;
                                        if (seller === user.username) return;
                                        router.push(`/messages/${encodeURIComponent(seller)}`);
                                    }}
                                    disabled={!gig?.seller || !user || String(gig.seller || "").trim() === String(user?.username || "").trim()}
                                    className="w-full py-6 rounded-xl font-black bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    Mesaj At
                                </Button>
                            </Card>
                        </div>
                    </div>
                </div>
            </main>

        </div>
    );
}
