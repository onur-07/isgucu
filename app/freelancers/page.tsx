"use client";

import { useMemo, useState } from "react";
import { GigList } from "@/components/gigs/gig-list";
import { CATEGORIES_DETAILED } from "@/lib/categories-data";

export default function FreelancersPage() {
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");

    const categories = useMemo(() => {
        return [{ id: "all", title: "Tümü", icon: "✨", color: "bg-gray-50" }, ...CATEGORIES_DETAILED];
    }, []);

    return (
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
            <div className="mb-10 overflow-hidden rounded-3xl border border-gray-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
                <div className="px-6 py-8 sm:px-10 sm:py-10">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden">
                                <img src="/logo.png" alt="Logo" className="h-10 w-10 sm:h-11 sm:w-11 object-contain" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 font-heading">
                                    Tüm Hizmetler & Freelancerlar
                                </h1>
                                <p className="text-gray-600 mt-2">
                                    Projeniz için uzman desteği alın.
                                </p>
                            </div>
                        </div>

                        <div className="hidden lg:flex items-center gap-3">
                            <div className="rounded-2xl bg-white/70 border border-gray-100 px-4 py-3 shadow-sm">
                                <p className="text-sm font-semibold text-gray-900">Hızlı keşfet</p>
                                <p className="text-xs text-gray-600 mt-0.5">Kategori seç, ilanları hemen filtrele</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mb-8">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <h2 className="text-sm font-semibold text-gray-700">Kategoriler</h2>
                    {selectedCategoryId !== "all" && (
                        <button
                            type="button"
                            onClick={() => setSelectedCategoryId("all")}
                            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                        >
                            Filtreyi Temizle
                        </button>
                    )}
                </div>

                <div className="mt-4 sm:hidden">
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Kategori Seç</label>
                    <select
                        value={selectedCategoryId}
                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.title}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="hidden sm:flex mt-4 gap-3 overflow-x-auto pb-2">
                    {categories.map((c) => {
                        const active = selectedCategoryId === c.id;
                        return (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => setSelectedCategoryId(c.id)}
                                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                                    active
                                        ? "bg-blue-600 text-white border-blue-600 shadow"
                                        : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                }`}
                            >
                                <span className="mr-2">{c.icon}</span>
                                {c.title}
                            </button>
                        );
                    })}
                </div>
            </div>

            <GigList categoryId={selectedCategoryId === "all" ? undefined : selectedCategoryId} />
        </div>
    );
}
