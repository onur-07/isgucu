"use client";

import { JobPostingForm } from "@/components/jobs/job-posting-form";
import { useAuth } from "@/components/auth/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PostJobPage() {
    const { user, isAuthenticated, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            router.push("/login");
        } else if (!loading && isAuthenticated && user?.role !== "employer") {
            router.push("/");
        }
    }, [isAuthenticated, loading, user, router]);

    if (loading) return null;
    if (!isAuthenticated) return null;

    return (
        <div className="container mx-auto px-4 max-w-2xl py-12">
            <div className="mb-8 space-y-2 text-center">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 font-heading">
                    Yeni İş İlanı Oluştur
                </h1>
                <p className="text-muted-foreground">
                    Projeniz için en iyi freelancer'ları bulun.
                </p>
            </div>

            <div className="rounded-xl border bg-white p-8 shadow-sm">
                <JobPostingForm />
            </div>
        </div>
    );
}
