"use client";

import { useEffect, useState } from "react";
import { JobCard } from "@/components/jobs/job-card";
import { supabase } from "@/lib/supabase";

interface Job {
    id: number;
    title: string;
    description: string;
    category: string;
    budget: string;
    createdAt: string;
    user_id?: string;
    owner?: {
        username: string;
        avatar_url: string;
        full_name: string;
    } | null;
}

export function JobList({ limit, onTotalChange }: { limit?: number; onTotalChange?: (count: number) => void }) {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                // Fetch from Supabase with profile info
                const { data: dbData, error } = await supabase
                    .from('jobs')
                    .select('*, profiles(username, avatar_url, full_name)')
                    .order('created_at', { ascending: false });

                // Fetch from LocalStorage (Mock/Fallback)
                const localJobs = JSON.parse(localStorage.getItem("isgucu_jobs") || "[]");

                let mergedJobs: Job[] = [];

                if (dbData) {
                    mergedJobs = dbData.map((j: any) => ({
                        id: j.id,
                        title: j.title,
                        description: j.description,
                        category: j.category,
                        budget: j.budget,
                        createdAt: j.created_at,
                        user_id: j.user_id,
                        owner: j.profiles ? {
                            username: j.profiles.username,
                            avatar_url: j.profiles.avatar_url,
                            full_name: j.profiles.full_name
                        } : null
                    }));
                }

                // Add local jobs that don't exist in DB
                localJobs.forEach((lj: any) => {
                    if (!mergedJobs.some(mj => mj.id === lj.id)) {
                        mergedJobs.push({
                            ...lj,
                            createdAt: lj.created_at || lj.createdAt,
                            owner: null // Local jobs usually don't have owner info in this structure
                        });
                    }
                });

                // Sort by date
                mergedJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                setJobs(mergedJobs);
            } catch (err) {
                console.error("Jobs fetch error:", err);
                const localJobs = JSON.parse(localStorage.getItem("isgucu_jobs") || "[]");
                setJobs(localJobs);
            } finally {
                setLoading(false);
            }
        };

        fetchJobs();
    }, []);

    useEffect(() => {
        onTotalChange?.(jobs.length);
    }, [jobs.length, onTotalChange]);

    if (loading) {
        return (
            <div className="py-10 text-center text-sm font-bold text-gray-500">
                Yükleniyor...
            </div>
        );
    }

    const displayJobs = limit ? jobs.slice(0, limit) : jobs;

    if (displayJobs.length === 0) {
        return (
            <div className="bg-white border rounded-2xl p-10 text-center">
                <div className="text-sm font-bold text-gray-700">Henüz ilan bulunmamaktadır.</div>
                <div className="text-xs text-gray-400 mt-2">Yeni ilanlar eklendiğinde burada görünecek.</div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayJobs.map((job) => (
                <JobCard key={job.id} job={job} />
            ))}
        </div>
    );
}
