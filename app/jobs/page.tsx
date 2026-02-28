"use client";

import { JobList } from "@/components/jobs/job-list";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function JobsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const urlQuery = String(searchParams?.get("q") || "").trim();
    const [query, setQuery] = useState(urlQuery);

    useEffect(() => {
        setQuery(urlQuery);
    }, [urlQuery]);

    return (
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
            <div className="mb-8 space-y-4 text-center md:text-left">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 font-heading">
                    Açık İş İlanları
                </h1>
                <p className="text-muted-foreground">
                    Yeteneklerinize uygun projeleri keşfedin ve teklif verin.
                </p>

                <form
                    className="max-w-2xl md:max-w-3xl"
                    onSubmit={(e) => {
                        e.preventDefault();
                        const next = query.trim();
                        router.push(next ? `/jobs?q=${encodeURIComponent(next)}` : "/jobs");
                    }}
                >
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                        <Search className="h-4 w-4 text-slate-400" />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Örn: logo, web tasarım, SEO, wordpress"
                            className="h-10 border-0 shadow-none focus-visible:ring-0"
                        />
                    </div>
                </form>

                {urlQuery.length > 0 && (
                    <p className="text-sm font-semibold text-blue-600">
                        Arama: <span className="font-black">{urlQuery}</span>
                    </p>
                )}
            </div>

            <JobList searchQuery={urlQuery} />
        </div>
    );
}

export default function JobsPage() {
    return (
        <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12 text-sm font-bold text-gray-500">Yükleniyor...</div>}>
            <JobsPageContent />
        </Suspense>
    );
}

