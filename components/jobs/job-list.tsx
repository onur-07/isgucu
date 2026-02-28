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
    status?: string;
}

type DbJobRow = {
    id?: string | number;
    title?: unknown;
    description?: unknown;
    category?: unknown;
    budget?: unknown;
    created_at?: unknown;
    user_id?: unknown;
    status?: unknown;
};

export function JobList({ limit, onTotalChange }: { limit?: number; onTotalChange?: (count: number) => void }) {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                // 1. Fetch from Supabase
                const { data: dbData } = await supabase
                    .from('jobs')
                    .select('*')
                    .order('created_at', { ascending: false });

                const profileMap: Record<string, { id?: string; username?: string; avatar_url?: string; full_name?: string }> = {};
                if (dbData && dbData.length > 0) {
                    const userIds = Array.from(new Set(dbData.map(j => j.user_id).filter(Boolean)));
                    if (userIds.length > 0) {
                        // Try matching by id (UUID)
                        const { data: profilesById } = await supabase
                            .from('profiles')
                            .select('id, username, avatar_url, full_name')
                            .in('id', userIds);

                        if (profilesById) {
                            profilesById.forEach(p => {
                                profileMap[p.id] = p;
                            });
                        }

                        // For any unmatched user_ids, try matching by username
                        const unmatchedIds = userIds.filter(uid => !profileMap[String(uid)]);
                        if (unmatchedIds.length > 0) {
                            const { data: profilesByUsername } = await supabase
                                .from('profiles')
                                .select('id, username, avatar_url, full_name')
                                .in('username', unmatchedIds);

                            if (profilesByUsername) {
                                profilesByUsername.forEach(p => {
                                    // Map by the username so we can find it by user_id later
                                    profileMap[p.username] = p;
                                    profileMap[p.username.toLowerCase()] = p;
                                });
                            }
                        }
                    }
                }

                const dbRows = (dbData || []) as unknown as DbJobRow[];
                const normalizedDbJobs: Job[] = dbRows.map((row) => {
                    const key = String(row.user_id ?? "");
                    const prof = profileMap[key] || profileMap[key.toLowerCase()];
                    return {
                        id: row.id ?? "",
                        title: String(row.title ?? ""),
                        description: String(row.description ?? ""),
                        category: String(row.category ?? ""),
                        budget: String(row.budget ?? ""),
                        createdAt: String(row.created_at ?? ""),
                        user_id: key,
                        status: String(row.status ?? "open"),
                        owner: prof ? {
                            username: String(prof.username || ""),
                            avatar_url: String(prof.avatar_url || ""),
                            full_name: String(prof.full_name || ""),
                        } : null,
                    };
                });

                const mergedJobs = normalizedDbJobs
                    .filter((j) => String(j.status || "open").toLowerCase() === "open")
                    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

                setJobs(mergedJobs);
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
