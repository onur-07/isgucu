"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORIES_DETAILED } from "@/lib/categories-data";
import { GigList } from "@/components/gigs/gig-list";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function CategoriesAllPage() {
    const [query, setQuery] = useState("");
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");

    const categories = useMemo(() => {
        return [{ id: "all", title: "Tümü", icon: "✨", color: "bg-gray-50" }, ...CATEGORIES_DETAILED];
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

                                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                                    <div className="flex-1">
                                        <Input
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            placeholder="Kategori ara (örn: Yazılım, Tasarım, SEO)"
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
                                        <Link href="/post-gig" className="h-12">
                                            <Button className="h-12 rounded-2xl font-black uppercase tracking-widest text-[10px]">
                                                Hizmet Ekle
                                            </Button>
                                        </Link>
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
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {filteredCategories.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => setSelectedCategoryId(c.id)}
                                className={`group text-left rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 ${
                                    selectedCategoryId === c.id ? "ring-2 ring-blue-200" : ""
                                }`}
                            >
                                <div className={`h-12 w-12 rounded-2xl ${c.color} flex items-center justify-center text-2xl border border-white shadow-sm`}>
                                    {c.icon}
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
                        ))}
                    </div>
                </div>

                <div className="mt-12">
                    <div className="flex items-end justify-between gap-4 flex-wrap">
                        <div>
                            <h3 className="text-xl font-black text-slate-900">İlanlar</h3>
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
                </div>
            </div>
        </div>
    );
}
