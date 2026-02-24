"use client";

import { GigPostingForm } from "@/components/gigs/gig-posting-form";
import { useAuth } from "@/components/auth/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PostGigPage() {
    const { user, isAuthenticated, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            router.push("/login");
        }
    }, [isAuthenticated, loading, router]);

    if (loading) return null;
    if (!isAuthenticated) return null;

    return (
        <div className="container mx-auto px-4 max-w-5xl py-12">
            <div className="mb-8 space-y-2 text-center">
                <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">✨ Yeni İlan</span>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-heading mt-4">
                    Hizmet İlanı Oluştur
                </h1>
                <p className="text-gray-500 max-w-xl mx-auto">
                    Profesyonel hizmet ilanı oluşturun. Yeteneklerinizi sergileyin ve müşterilere ulaşın.
                </p>
            </div>

            <div className="rounded-[2.5rem] border-4 border-gray-100 bg-white p-6 md:p-12 shadow-2xl transition-all duration-500 hover:border-blue-50/50">
                <GigPostingForm />
            </div>
        </div>
    );
}
