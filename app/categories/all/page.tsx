"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES_DETAILED } from "@/lib/categories-data";
import { GigList } from "@/components/gigs/gig-list";
import { JobList } from "@/components/jobs/job-list";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-context";

export default function CategoriesAllPage() {
    const { user } = useAuth();
    const [query, setQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"services" | "jobs" | "freelancers">("services");
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
    const [gigCountsByCategory, setGigCountsByCategory] = useState<Record<string, number>>({});
    const [freelancers, setFreelancers] = useState<Array<{ id: string; username: string; fullName?: string; avatarUrl?: string; skills?: string[] }>>([]);
    const [freelancersLoading, setFreelancersLoading] = useState(false);

    const categories = useMemo(() => {
        return [{ id: "all", title: "Tümü", icon: "✨", color: "bg-gray-50" }, ...CATEGORIES_DETAILED];
    }, []);

    useEffect(() => {
        let cancelled = false;

        const fetchFreelancers = async () => {
            setFreelancersLoading(true);
            try {
                const res = await supabase
                    .from("profiles")
                    .select("id, username, full_name, avatar_url, skills, role")
                    .eq("role", "freelancer")
                    ;

                if (res.error) throw res.error;
                const rows = (res.data || []) as Array<any>;

                const normalized = rows
                    .filter((r) => r?.id && r?.username)
                    .map((r) => ({
                        id: String(r.id),
                        username: String(r.username),
                        fullName: r.full_name ? String(r.full_name) : undefined,
                        avatarUrl: r.avatar_url ? String(r.avatar_url) : undefined,
                        skills: Array.isArray(r.skills) ? (r.skills as string[]) : undefined,
                    }));

                if (!cancelled) setFreelancers(normalized);
            } catch (e) {
                console.error("Freelancer listesi yüklenemedi:", e);
                if (!cancelled) setFreelancers([]);
            } finally {
                if (!cancelled) setFreelancersLoading(false);
            }
        };

        if (activeTab === "freelancers") {
            fetchFreelancers();
        }

        return () => {
            cancelled = true;
        };
    }, [activeTab]);

    useEffect(() => {
        let cancelled = false;

        const fetchCounts = async () => {
            try {
                const res = await supabase.from("gigs").select("category");
                if (res.error) throw res.error;

                const rows = (res.data || []) as Array<{ category?: string | null }>;
                const next: Record<string, number> = {};
                for (const r of rows) {
                    const key = String(r?.category || "").trim();
                    if (!key) continue;
                    next[key] = (next[key] || 0) + 1;
                }

                if (!cancelled) setGigCountsByCategory(next);
            } catch (e) {
                console.error("Kategori ilan sayıları yüklenemedi:", e);
                if (!cancelled) setGigCountsByCategory({});
            }
        };

        fetchCounts();
        return () => {
            cancelled = true;
        };
    }, []);

    const filteredCategories = useMemo(() => {
        const q = query.trim().toLocaleLowerCase("tr-TR").normalize("NFC").replace(/\u0307/g, "");
        if (!q) return categories;
        return categories.filter((c) =>
            String(c.title || "")
                .toLocaleLowerCase("tr-TR")
                .normalize("NFC")
                .replace(/\u0307/g, "")
                .includes(q)
        );
    }, [categories, query]);

    const filteredFreelancers = useMemo(() => {
        const q = query.trim().toLocaleLowerCase("tr-TR").normalize("NFC").replace(/\u0307/g, "");
        if (!q) return freelancers;

        const fold = (v: unknown) =>
            String(v || "")
                .toLocaleLowerCase("tr-TR")
                .normalize("NFC")
                .replace(/\u0307/g, "");

        return freelancers.filter((f) => {
            const text = [f.username, f.fullName, Array.isArray(f.skills) ? f.skills.join(" ") : ""].map(fold).join(" ");
            return text.includes(q);
        });
    }, [freelancers, query]);

    const popularCategories = useMemo(() => {
        const list = CATEGORIES_DETAILED.map((c) => ({
            ...c,
            count: gigCountsByCategory[String(c.id)] || 0,
        }));

        return list.sort((a, b) => b.count - a.count).slice(0, 6);
    }, [gigCountsByCategory]);

    const totalGigCount = useMemo(() => {
        return Object.values(gigCountsByCategory).reduce((acc, n) => acc + (Number(n) || 0), 0);
    }, [gigCountsByCategory]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
                <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 shadow-sm">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
                        <div className="absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" />
                    </div>

                    <div className="relative px-6 py-10 sm:px-10 sm:py-12">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                            <div className="max-w-2xl">
                                <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 shadow-sm">
                                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                                    Kategori Kataloğu
                                </div>
                                <h1 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
                                    Tüm Kategorileri Keşfet
                                </h1>
                                <p className="mt-3 text-slate-600 font-semibold">
                                    İhtiyacına uygun hizmeti seç, ilanları incele ve hemen teklif al.
                                </p>

                                <div className="mt-5 inline-flex flex-wrap gap-2 rounded-2xl border border-white/60 bg-white/70 p-2 shadow-sm">
                                    {[
                                        { key: "services" as const, label: "Hizmetler" },
                                        { key: "jobs" as const, label: "İşler" },
                                        { key: "freelancers" as const, label: "Freelancers" },
                                    ].map((t) => {
                                        const active = activeTab === t.key;
                                        return (
                                            <button
                                                key={t.key}
                                                type="button"
                                                onClick={() => {
                                                    setActiveTab(t.key);
                                                    if (t.key !== "services") setSelectedCategoryId("all");
                                                }}
                                                className={`h-10 rounded-2xl px-5 text-[10px] font-black uppercase tracking-widest transition-all ${
                                                    active
                                                        ? "bg-blue-600 text-white shadow"
                                                        : "bg-white/70 text-slate-700 hover:bg-white"
                                                }`}
                                            >
                                                {t.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                                    <div className="flex-1">
                                        <Input
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            placeholder={
                                                activeTab === "services"
                                                    ? "Kategori ara (örn: Yazılım, Tasarım, SEO)"
                                                    : activeTab === "jobs"
                                                        ? "İş ara (örn: Tasarım, Next.js, SEO)"
                                                        : "Uzman ara (örn: UI/UX, React, SEO)"
                                            }
                                            className="h-12 rounded-2xl border-slate-200 bg-white/80 font-semibold shadow-sm"
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-12 rounded-2xl border-slate-200 bg-white/80 font-black uppercase tracking-widest text-[10px] text-slate-700"
                                            onClick={() => {
                                                setQuery("");
                                                setSelectedCategoryId("all");
                                            }}
                                        >
                                            Temizle
                                        </Button>
                                        {user?.role === "admin" ? (
                                            <Link href={activeTab === "jobs" ? "/post-job" : "/post-gig"} className="h-12">
                                                <Button className="h-12 rounded-2xl font-black uppercase tracking-widest text-[10px]">
                                                    {activeTab === "jobs" ? "İş İlanı Ekle" : "Hizmet Ekle"}
                                                </Button>
                                            </Link>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            <div className="hidden lg:block">
                                <div className="rounded-[2rem] border border-white/60 bg-white/70 px-6 py-5 shadow-sm">
                                    <div className="text-xs font-black uppercase tracking-widest text-slate-500">Hızlı Filtre</div>
                                    <div className="mt-2 text-sm font-bold text-slate-900">Kategori seç, ilanları filtrele</div>
                                    <div className="mt-1 text-xs text-slate-600 font-semibold">Aşağıdaki grid veya chip’leri kullan.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-10">
                    {activeTab === "services" && (
                        <>
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                <div className="lg:col-span-7">
                                    <div className="flex items-center justify-between gap-4 flex-wrap">
                                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Kategoriler</h2>
                                        {selectedCategoryId !== "all" && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedCategoryId("all")}
                                                className="text-xs font-black uppercase tracking-widest text-blue-700 hover:text-blue-800"
                                            >
                                                Filtreyi Temizle
                                            </button>
                                        )}
                                    </div>

                                    <div className="mt-4 hidden sm:flex gap-2 overflow-x-auto pb-2">
                                        {categories.map((c) => {
                                            const active = selectedCategoryId === c.id;
                                            const count = c.id === "all" ? totalGigCount : (gigCountsByCategory[String(c.id)] || 0);
                                            return (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => setSelectedCategoryId(c.id)}
                                                    className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${
                                                        active
                                                            ? "bg-blue-600 text-white border-blue-600 shadow"
                                                            : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                                    }`}
                                                >
                                                    <span className="mr-2">{c.icon}</span>
                                                    {c.title}
                                                    <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"}`}>
                                                        {count}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                                        {filteredCategories.map((c) => {
                                            const count = c.id === "all" ? totalGigCount : (gigCountsByCategory[String(c.id)] || 0);
                                            return (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => setSelectedCategoryId(c.id)}
                                                    className={`group text-left rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 ${
                                                        selectedCategoryId === c.id ? "ring-2 ring-blue-200" : ""
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className={`h-12 w-12 rounded-2xl ${c.color} flex items-center justify-center text-2xl border border-white shadow-sm`}>
                                                            {c.icon}
                                                        </div>
                                                        <div className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 border border-slate-100">
                                                            {count} ilan
                                                        </div>
                                                    </div>
                                                    <div className="mt-4">
                                                        <div className="text-sm font-black text-slate-900 group-hover:text-blue-700 transition-colors">
                                                            {c.title}
                                                        </div>
                                                        <div className="mt-1 text-xs text-slate-500 font-semibold">
                                                            Bu kategorideki hizmetleri incele
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="lg:col-span-5">
                                    <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
                                        <div className="flex items-center justify-between gap-4">
                                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Popüler Kategoriler</h3>
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Top 6</div>
                                        </div>
                                        <div className="mt-6 space-y-3">
                                            {popularCategories.map((c) => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => setSelectedCategoryId(c.id)}
                                                    className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                                                        selectedCategoryId === c.id
                                                            ? "border-blue-200 bg-blue-50"
                                                            : "border-slate-100 bg-white hover:bg-slate-50"
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className={`h-10 w-10 rounded-2xl ${c.color} flex items-center justify-center text-xl border border-white shadow-sm`}>
                                                                {c.icon}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="text-sm font-black text-slate-900 truncate">{c.title}</div>
                                                                <div className="text-xs font-semibold text-slate-500">{c.count} ilan</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-xs font-black text-blue-700">Filtrele →</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="mt-12">
                    {activeTab === "services" && (
                        <>
                            <div className="flex items-end justify-between gap-4 flex-wrap">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Hizmet İlanları</h3>
                                    <p className="text-sm text-slate-600 font-semibold mt-1">
                                        {selectedCategoryId === "all" ? "Tüm ilanlar" : "Seçili kategoriye göre ilanlar"}
                                    </p>
                                </div>
                                <Link href="/freelancers" className="text-xs font-black uppercase tracking-widest text-blue-700 hover:text-blue-800">
                                    Tüm hizmetler →
                                </Link>
                            </div>

                            <div className="mt-6">
                                <GigList categoryId={selectedCategoryId === "all" ? undefined : selectedCategoryId} />
                            </div>
                        </>
                    )}

                    {activeTab === "jobs" && (
                        <>
                            <div className="flex items-end justify-between gap-4 flex-wrap">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">İş İlanları</h3>
                                    <p className="text-sm text-slate-600 font-semibold mt-1">Aradığın projeyi bul ve teklif ver.</p>
                                </div>
                                <Link href={query ? `/jobs?q=${encodeURIComponent(query)}` : "/jobs"} className="text-xs font-black uppercase tracking-widest text-blue-700 hover:text-blue-800">
                                    Tam sayfada aç →
                                </Link>
                            </div>
                            <div className="mt-6">
                                <JobList searchQuery={query.trim()} />
                            </div>
                        </>
                    )}

                    {activeTab === "freelancers" && (
                        <>
                            <div className="flex items-end justify-between gap-4 flex-wrap">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Freelancerlar</h3>
                                    <p className="text-sm text-slate-600 font-semibold mt-1">Uzmanları kategoriye göre keşfet.</p>
                                </div>
                                <Link href="/freelancers" className="text-xs font-black uppercase tracking-widest text-blue-700 hover:text-blue-800">
                                    Freelancer sayfası →
                                </Link>
                            </div>

                            <div className="mt-6">
                                {freelancersLoading ? (
                                    <div className="py-12 text-center text-sm font-bold text-gray-500">Yükleniyor...</div>
                                ) : filteredFreelancers.length === 0 ? (
                                    <div className="bg-white border rounded-2xl p-10 text-center">
                                        <div className="text-sm font-bold text-gray-700">Freelancer bulunamadı.</div>
                                        <div className="text-xs text-gray-400 mt-2">Arama kriterlerini değiştirip tekrar deneyebilirsin.</div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {filteredFreelancers.slice(0, 18).map((f) => (
                                            <Link
                                                key={f.id}
                                                href={`/profile/${f.username}`}
                                                className="group rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="h-14 w-14 rounded-2xl border border-slate-100 bg-slate-50 overflow-hidden flex items-center justify-center text-sm font-black text-slate-600">
                                                        {f.avatarUrl ? (
                                                            <img src={f.avatarUrl} alt={f.username} className="h-full w-full object-cover" />
                                                        ) : (
                                                            (f.username || "A").charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-black text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                                                            {f.fullName || f.username}
                                                        </div>
                                                        <div className="text-xs font-bold text-slate-500 truncate">@{f.username}</div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    {(Array.isArray(f.skills) ? f.skills : []).slice(0, 3).map((s) => (
                                                        <span key={s} className="rounded-full bg-slate-50 border border-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                                            {s}
                                                        </span>
                                                    ))}
                                                    {(Array.isArray(f.skills) ? f.skills : []).length > 3 ? (
                                                        <span className="rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700">
                                                            +{(f.skills || []).length - 3}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
