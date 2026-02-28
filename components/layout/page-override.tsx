"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSiteConfig, type ManagedPage } from "@/lib/site-config";

export function PageOverride({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [config, setConfig] = useState(getSiteConfig());

    useEffect(() => {
        const refresh = () => setConfig(getSiteConfig());
        window.addEventListener("site_config_updated", refresh);
        return () => window.removeEventListener("site_config_updated", refresh);
    }, []);

    const managed = useMemo<ManagedPage | null>(() => {
        const path = String(pathname || "").trim() || "/";
        return (
            (config.managedPages || []).find(
                (p) => p.enabled && p.overrideBuiltIn && String(p.slug || "").trim() === path
            ) || null
        );
    }, [config, pathname]);

    if (!managed) return <>{children}</>;

    return (
        <div className="container max-w-4xl py-12 space-y-8">
            <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight">{managed.title}</h1>
                <p className="text-gray-500 font-medium">{managed.summary}</p>
            </div>
            <article className="rounded-3xl border bg-white p-8 md:p-10 leading-8 text-gray-700 whitespace-pre-wrap">
                {managed.content}
            </article>
            <Link href="/" className="inline-flex text-sm font-black uppercase tracking-wider text-blue-600 hover:underline">
                Anasayfaya dön
            </Link>
        </div>
    );
}

