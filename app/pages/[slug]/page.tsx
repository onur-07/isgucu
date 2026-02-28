"use client";

import { useMemo } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import { getSiteConfig } from "@/lib/site-config";

export default function ManagedPage() {
    const params = useParams<{ slug: string }>();
    const slug = String(params?.slug || "").trim().toLowerCase();
    const config = getSiteConfig();

    const page = useMemo(() => {
        return (config.managedPages || []).find((p) => {
            const normalized = String(p.slug || "")
                .replace(/^\/+/, "")
                .toLowerCase();
            return normalized === slug;
        });
    }, [config, slug]);

    if (!page || !page.enabled) return notFound();

    return (
        <div className="container max-w-4xl py-12 space-y-8">
            <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight">{page.title}</h1>
                <p className="text-gray-500 font-medium">{page.summary}</p>
            </div>
            <article className="rounded-3xl border bg-white p-8 md:p-10 leading-8 text-gray-700 whitespace-pre-wrap">
                {page.content}
            </article>
            <Link href="/" className="inline-flex text-sm font-black uppercase tracking-wider text-blue-600 hover:underline">
                Anasayfaya dön
            </Link>
        </div>
    );
}

