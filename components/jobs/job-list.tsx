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
}

export function JobList({ limit }: { limit?: number }) {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                const { data, error } = await supabase
                    .from('jobs')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;

                if (data) {
                    const formattedJobs = data.map((j: any) => ({
                        id: j.id,
                        title: j.title,
                        description: j.description,
                        category: j.category,
                        budget: j.budget,
                        createdAt: j.created_at
                    }));
                    setJobs(formattedJobs);
                }
            } catch (err) {
                console.error("Jobs fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchJobs();
    }, []);

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
