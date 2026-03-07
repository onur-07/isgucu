"use client";

import { useEffect, useState } from "react";
import { GigCard } from "@/components/gigs/gig-card";
import { supabase } from "@/lib/supabase";

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
    title: string;
    description: string;
    category: string;
    subCategory?: string;
    serviceType?: string;
    price: string;
    createdAt: string;
    isActive?: boolean;
    seller?: string;
    sellerAvatarUrl?: string;
    sellerVerified?: boolean;
    images?: string[];
    tags?: string[];
    packages?: Record<string, PackageData>;
}

export function GigList({ category, categoryId, limit, verifiedOnly }: { category?: string; categoryId?: string; limit?: number; verifiedOnly?: boolean }) {
    const [gigs, setGigs] = useState<Gig[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string>("");

    const lowerTr = (value: unknown) =>
        String(value || "")
            .toLocaleLowerCase("tr-TR")
            .normalize("NFC")
            .replace(/\u0307/g, "");

    useEffect(() => {
        const fetchGigs = async () => {
            try {
                const withTimeout = async <T,>(p: PromiseLike<T>, ms: number, label: string): Promise<T> => {
                    let timeoutId: ReturnType<typeof setTimeout> | undefined;
                    try {
                        return await Promise.race([
                            Promise.resolve(p),
                            new Promise<T>((_, reject) => {
                                timeoutId = setTimeout(() => {
                                    reject(new Error(`${label} zaman aşımına uğradı (${ms}ms)`));
                                }, ms);
                            }),
                        ]);
                    } finally {
                        if (timeoutId) clearTimeout(timeoutId);
                    }
                };

                const TIMEOUT_MS = 10000;

                const gigsRes = (await withTimeout(
                    supabase
                        .from('gigs')
                        .select('id, user_id, title, description, category, sub_category, service_type, price, created_at, images, packages')
                        .order('created_at', { ascending: false }),
                    TIMEOUT_MS,
                    "Gigs sorgusu"
                )) as any;

                const data = gigsRes?.data;
                const error = gigsRes?.error;

                if (error) {
                    const details = (error as any)?.details ? String((error as any).details) : "";
                    const hint = (error as any)?.hint ? String((error as any).hint) : "";
                    const code = (error as any)?.code ? String((error as any).code) : "";
                    const msg = [error.message, details, hint, code].filter(Boolean).join(" | ");
                    throw new Error(msg || "Gigs yüklenemedi.");
                }

                if (data) {
                    const userIds = Array.from(
                        new Set(
                            data
                                .map((g: any) => g.user_id)
                                .filter((id: any) => typeof id === "string" && id.length > 0)
                        )
                    );

                    let usernameById: Record<string, string> = {};
                    let avatarById: Record<string, string> = {};
                    let verifiedById: Record<string, boolean> = {};
                    if (userIds.length > 0) {
                        const profilesRes = (await withTimeout(
                            supabase
                                .from("profiles")
                                .select("id, username, avatar_url, kyc_verified")
                                .in("id", userIds),
                            TIMEOUT_MS,
                            "Profiles sorgusu"
                        )) as any;

                        const profiles = profilesRes?.data;
                        const profilesErr = profilesRes?.error;

                        if (profilesErr) {
                            console.error("Profiles fetch error (seller map):", profilesErr);
                        } else {
                            usernameById = (profiles || []).reduce((acc: any, p: any) => {
                                if (p?.id && p?.username) acc[String(p.id)] = String(p.username);
                                return acc;
                            }, {} as Record<string, string>);

                            avatarById = (profiles || []).reduce((acc: any, p: any) => {
                                if (p?.id && p?.avatar_url) acc[String(p.id)] = String(p.avatar_url);
                                return acc;
                            }, {} as Record<string, string>);

                            verifiedById = (profiles || []).reduce((acc: any, p: any) => {
                                if (p?.id) acc[String(p.id)] = !!p?.kyc_verified;
                                return acc;
                            }, {} as Record<string, boolean>);
                        }
                    }

                    const normalized: Gig[] = data.map((g: any) => ({
                        id: g.id,
                        title: g.title,
                        description: g.description,
                        category: g.category,
                        subCategory: g.sub_category || "",
                        serviceType: g.service_type || "",
                        price: g.price,
                        createdAt: g.created_at,
                        images: g.images || [],
                        packages: g.packages || undefined,
                        seller: usernameById[String(g.user_id)] || "Anonim",
                        sellerAvatarUrl: avatarById[String(g.user_id)] || "",
                        sellerVerified: !!verifiedById[String(g.user_id)],
                    }));
                    setGigs(normalized);
                }
            } catch (err) {
                console.error("Gigs fetch error:", err);
                const anyErr: any = err as any;
                const msg = anyErr?.message
                    ? String(anyErr.message)
                    : (() => {
                        try {
                            return JSON.stringify(anyErr);
                        } catch {
                            return "Gigs yüklenemedi.";
                        }
                    })();
                setLoadError(msg);
            } finally {
                setLoading(false);
            }
        };

        fetchGigs();
    }, []);

    if (loading) return <div className="text-center py-8 text-gray-400">Yükleniyor...</div>;

    if (loadError) {
        return (
            <div className="text-center py-12">
                <p className="text-red-600 font-bold">Hizmetler yüklenemedi.</p>
                <p className="text-gray-500 text-sm mt-2">{loadError}</p>
            </div>
        );
    }

    let filteredGigs = gigs;
    if (categoryId) {
        filteredGigs = gigs.filter(g => String(g.category) === String(categoryId));
    } else if (category) {
        const catLower = lowerTr(category);
        filteredGigs = gigs.filter(g => lowerTr(g.category).includes(catLower) ||
            (category === 'yazilim-mobil' && g.category === 'Yazılım & Mobil') ||
            (category === 'logo-grafik' && g.category === 'Logo & Grafik') ||
            (category === 'web-tasarim' && g.category === 'Web Tasarım') ||
            (category === 'video-animasyon' && g.category === 'Video & Animasyon') ||
            (category === 'ceviri-icerik' && g.category === 'Çeviri & İçerik')
        );
    }

    const displayGigs = limit ? filteredGigs.slice(0, limit) : filteredGigs;
    const finalGigs = verifiedOnly ? displayGigs.filter((g) => !!g.sellerVerified) : displayGigs;

    if (finalGigs.length === 0) {
        return (
            <div className="w-full py-14">
                <div className="mx-auto max-w-xl rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-gray-50 flex items-center justify-center text-2xl">
                        🧾
                    </div>
                    <p className="text-gray-900 font-semibold text-lg">İlan bulunamadı</p>
                    <p className="text-gray-500 text-sm mt-2">
                        Bu filtrede henüz ilan yok. Farklı bir kategori seçebilir veya filtreyi temizleyebilirsiniz.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {finalGigs.map((gig) => (
                <GigCard key={gig.id} gig={gig} />
            ))}
        </div>
    );
}
