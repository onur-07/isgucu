"use client";

import { JobList } from "@/components/jobs/job-list";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function JobsPageContent() {
    const searchParams = useSearchParams();
    const query = String(searchParams?.get("q") || "").trim();

    return (
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
            <div className="mb-8 space-y-2 text-center md:text-left">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 font-heading">
                    Açık İş İlanları
                </h1>
                <p className="text-muted-foreground">
                    Yeteneklerinize uygun projeleri keşfedin ve teklif verin.
                </p>
                {query.length > 0 && (
                    <p className="text-sm font-semibold text-blue-600">
                        Arama: <span className="font-black">{query}</span>
                    </p>
                )}
            </div>

            <JobList searchQuery={query} />
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

