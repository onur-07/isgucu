"use client";

import { useEffect, useState } from "react";
import { JobCard } from "@/components/jobs/job-card";
import { supabase } from "@/lib/supabase";

interface Job {
    id: string | number;
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
                // 1. Fetch from Supabase
                const { data: dbData, error: dbError } = await supabase
                    .from('jobs')
                    .select('*')
                    .order('created_at', { ascending: false });

                // 2. Fetch from LocalStorage (Mock/Fallback)
                const localJobs = JSON.parse(localStorage.getItem("isgucu_jobs") || "[]");

                let combinedRows = dbData ? [...dbData] : [];

                // Fetch profiles for database jobs
                let profileMap: Record<string, any> = {};
                if (dbData && dbData.length > 0) {
                    const userIds = Array.from(new Set(dbData.map(j => j.user_id).filter(Boolean)));
                    if (userIds.length > 0) {
                        const { data: profiles } = await supabase
                            .from('profiles')
                            .select('id, username, avatar_url, full_name')
                            .in('id', userIds);

                        if (profiles) {
                            profiles.forEach(p => {
                                profileMap[p.id] = p;
                            });
                        }
                    }
                }

                const normalizedDbJobs: Job[] = (dbData || []).map((j: any) => ({
                    id: j.id,
                    title: j.title,
                    description: j.description,
                    category: j.category,
                    budget: j.budget,
                    createdAt: j.created_at,
                    user_id: j.user_id,
                    owner: profileMap[j.user_id] ? {
                        username: profileMap[j.user_id].username,
                        avatar_url: profileMap[j.user_id].avatar_url,
                        full_name: profileMap[j.user_id].full_name
                    } : null
                }));

                const normalizedLocalJobs: Job[] = localJobs.map((j: any) => ({
                    ...j,
                    owner: null // Mock local storage jobs don't have profile joins
                }));

                const mergedJobs = [...normalizedDbJobs, ...normalizedLocalJobs];
                // Sort by date
                mergedJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                setJobs(limit ? mergedJobs.slice(0, limit) : mergedJobs);
                if (onTotalChange) onTotalChange(mergedJobs.length);

            } catch (err) {
                console.error("Job list fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchJobs();
    }, [limit, onTotalChange]);

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
