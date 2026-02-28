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

type GigRow = {
    title?: unknown;
    description?: unknown;
    category?: unknown;
    sub_category?: unknown;
    service_type?: unknown;
    tags?: unknown;
    is_active?: unknown;
};

const STOPWORDS = new Set([
    "ve", "ile", "icin", "için", "veya", "ya", "da", "de", "bir", "bu", "o", "su", "şu", "en", "cok", "çok",
    "hizmet", "ilan", "is", "iş", "proje", "freelancer", "uzman", "teklif", "yeni", "gibi", "olan", "olur",
]);

const CATEGORY_SEO_MAP: Record<string, string[]> = {
    "web tasarim": ["web", "tasarim", "ui", "ux", "wordpress", "shopify", "seo", "landing", "page"],
    "logo grafik": ["logo", "grafik", "kurumsal", "kimlik", "brand", "sosyal", "medya", "tasarim"],
    "yazilim mobil": ["yazilim", "mobil", "react", "nextjs", "ios", "android", "api"],
    "video animasyon": ["video", "edit", "kurgu", "animasyon", "reels", "youtube"],
    "ceviri icerik": ["ceviri", "icerik", "metin", "seo", "blog", "yazi"],
    "yapay zeka": ["ai", "yapay", "zeka", "prompt", "chatgpt", "otomasyon"],
};

const trMap: Record<string, string> = {
    ç: "c",
    ğ: "g",
    ı: "i",
    İ: "i",
    ö: "o",
    ş: "s",
    ü: "u",
};

const fold = (value: string) =>
    String(value || "")
        .replace(/[çğıİöşü]/g, (m) => trMap[m] || m)
        .toLocaleLowerCase("tr-TR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

const tokenize = (value: string) =>
    fold(value)
        .replace(/[^\p{L}0-9]+/gu, " ")
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && !STOPWORDS.has(t));

const extractTags = (value: string) => {
    const tags = new Set<string>();
    const text = String(value || "");
    const hashMatches = text.match(/#([^\s#.,;!?]+)/g) || [];
    for (const match of hashMatches) {
        tags.add(fold(match.replace(/^#/, "")));
    }
    return Array.from(tags);
};

const getSeoKeywordsForCategory = (category: string) => {
    const c = fold(category);
    for (const [key, words] of Object.entries(CATEGORY_SEO_MAP)) {
        const keyTokens = tokenize(key);
        if (keyTokens.some((k) => c.includes(k))) return words;
    }
    return [];
};

const buildSearchFields = (job: Job) => {
    const seoWords = getSeoKeywordsForCategory(job.category);
    const tags = extractTags(job.description);
    return {
        title: fold(job.title),
        description: fold(job.description),
        category: fold(job.category),
        tags: tags.join(" "),
        all: [job.title, job.description, job.category, ...seoWords, ...tags].map((v) => fold(String(v || ""))).join(" "),
    };
};

const matchesQuery = (job: Job, query: string) => {
    const qTokens = tokenize(query);
    if (qTokens.length === 0) return true;

    const fields = buildSearchFields(job);
    const matchedCount = qTokens.filter((t) => fields.all.includes(t)).length;
    const titleMatched = qTokens.some((t) => fields.title.includes(t));
    const categoryMatched = qTokens.some((t) => fields.category.includes(t));
    const tagMatched = qTokens.some((t) => fields.tags.includes(t));

    if (qTokens.length === 1) return matchedCount >= 1;
    if (titleMatched || categoryMatched || tagMatched) return true;

    // Cok kelimeli aramada tum kelimeler yerine en az %50 eslesme yeterli.
    const minRequired = Math.max(1, Math.ceil(qTokens.length * 0.5));
    return matchedCount >= minRequired;
};

export function JobList({
    limit,
    onTotalChange,
    searchQuery,
    recommendedForFreelancer,
}: {
    limit?: number;
    onTotalChange?: (count: number) => void;
    searchQuery?: string;
    recommendedForFreelancer?: { id?: string; username?: string } | null;
}) {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchJobs = async () => {
            try {
                const [{ data: dbData }, { data: activeOfferOrders }] = await Promise.all([
                    supabase.from("jobs").select("*").order("created_at", { ascending: false }),
                    supabase
                        .from("orders")
                        .select("package_key, status")
                        .like("package_key", "offer:%")
                        .in("status", ["pending", "active", "delivered", "completed"]),
                ]);

                const profileMap: Record<string, { id?: string; username?: string; avatar_url?: string; full_name?: string }> = {};
                if (dbData && dbData.length > 0) {
                    const userIds = Array.from(new Set(dbData.map((j) => j.user_id).filter(Boolean)));
                    if (userIds.length > 0) {
                        const { data: profilesById } = await supabase
                            .from("profiles")
                            .select("id, username, avatar_url, full_name")
                            .in("id", userIds);
                        if (profilesById) {
                            profilesById.forEach((p) => {
                                profileMap[String(p.id)] = p;
                            });
                        }

                        const unmatchedIds = userIds.filter((uid) => !profileMap[String(uid)]);
                        if (unmatchedIds.length > 0) {
                            const { data: profilesByUsername } = await supabase
                                .from("profiles")
                                .select("id, username, avatar_url, full_name")
                                .in("username", unmatchedIds);
                            if (profilesByUsername) {
                                profilesByUsername.forEach((p) => {
                                    profileMap[String(p.username)] = p;
                                    profileMap[String(p.username).toLowerCase()] = p;
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
                        owner: prof
                            ? {
                                  username: String(prof.username || ""),
                                  avatar_url: String(prof.avatar_url || ""),
                                  full_name: String(prof.full_name || ""),
                              }
                            : null,
                    };
                });

                const occupiedJobIds = new Set<string>();
                const offerOrderIds = Array.from(
                    new Set(
                        (activeOfferOrders || [])
                            .map((r: { package_key?: string }) => String(r?.package_key || ""))
                            .filter((k: string) => k.startsWith("offer:"))
                            .map((k: string) => Number(k.slice("offer:".length)))
                            .filter((n: number) => Number.isFinite(n) && n > 0)
                    )
                );

                if (offerOrderIds.length > 0) {
                    const { data: linkedOffers } = await supabase.from("offers").select("id, extras").in("id", offerOrderIds);
                    for (const offer of (linkedOffers || []) as Array<{ extras?: { source?: string; job_id?: string | number } | null }>) {
                        const extras = offer?.extras;
                        if (!extras || String(extras.source || "") !== "job") continue;
                        const jobIdNum = Number(extras.job_id);
                        if (Number.isFinite(jobIdNum) && jobIdNum > 0) occupiedJobIds.add(String(jobIdNum));
                    }
                }

                let mergedJobs = normalizedDbJobs
                    .filter((j) => {
                        const status = String(j.status || "open").toLowerCase();
                        if (status !== "open") return false;
                        if (occupiedJobIds.has(String(j.id))) return false;
                        return true;
                    })
                    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

                const q = String(searchQuery || "").trim();
                if (q) {
                    mergedJobs = mergedJobs.filter((job) => matchesQuery(job, q));
                }

                if (recommendedForFreelancer?.id || recommendedForFreelancer?.username) {
                    const uid = String(recommendedForFreelancer.id || "").trim();
                    const uname = String(recommendedForFreelancer.username || "").trim();

                    const [gigsById, gigsByUsername, profileById, profileByUsername] = await Promise.all([
                        uid ? supabase.from("gigs").select("title, description, category, sub_category, service_type, tags, is_active").eq("user_id", uid) : Promise.resolve({ data: [] } as { data: GigRow[] }),
                        uname ? supabase.from("gigs").select("title, description, category, sub_category, service_type, tags, is_active").eq("user_id", uname) : Promise.resolve({ data: [] } as { data: GigRow[] }),
                        uid ? supabase.from("profiles").select("skills").eq("id", uid).maybeSingle() : Promise.resolve({ data: null } as { data: { skills?: string[] } | null }),
                        uname ? supabase.from("profiles").select("skills").eq("username", uname).maybeSingle() : Promise.resolve({ data: null } as { data: { skills?: string[] } | null }),
                    ]);

                    const allGigs = [...(gigsById?.data || []), ...(gigsByUsername?.data || [])] as GigRow[];
                    const activeGigs = allGigs.filter((g) => g?.is_active !== false);

                    const serviceTokens = new Set<string>();
                    for (const gig of activeGigs) {
                        const textParts = [
                            String(gig.title || ""),
                            String(gig.description || ""),
                            String(gig.category || ""),
                            String(gig.sub_category || ""),
                            String(gig.service_type || ""),
                            Array.isArray(gig.tags) ? gig.tags.join(" ") : String(gig.tags || ""),
                        ];
                        tokenize(textParts.join(" ")).forEach((t) => serviceTokens.add(t));
                    }

                    const skillsRaw = profileById?.data?.skills || profileByUsername?.data?.skills || [];
                    const skillsText = Array.isArray(skillsRaw) ? skillsRaw.join(" ") : String(skillsRaw || "");
                    const skillsTokens = new Set(tokenize(skillsText));

                    let effectiveTokens = new Set<string>(serviceTokens);
                    if (skillsTokens.size > 0) {
                        const intersect = new Set<string>();
                        for (const t of serviceTokens) {
                            if (skillsTokens.has(t)) intersect.add(t);
                        }
                        if (intersect.size >= 2) effectiveTokens = intersect;
                    }

                    if (effectiveTokens.size > 0) {
                        mergedJobs = mergedJobs.filter((job) => {
                            const searchable = buildSearchFields(job).all;
                            for (const t of effectiveTokens) {
                                if (searchable.includes(t)) return true;
                            }
                            return false;
                        });
                    } else {
                        mergedJobs = [];
                    }
                }

                setJobs(mergedJobs);
                if (onTotalChange) onTotalChange(mergedJobs.length);
            } catch (err) {
                console.error("Job list fetch error:", err);
                setJobs([]);
                if (onTotalChange) onTotalChange(0);
            } finally {
                setLoading(false);
            }
        };

        fetchJobs();
    }, [limit, onTotalChange, searchQuery, recommendedForFreelancer?.id, recommendedForFreelancer?.username]);

    if (loading) {
        return <div className="py-10 text-center text-sm font-bold text-gray-500">Yükleniyor...</div>;
    }

    const displayJobs = limit ? jobs.slice(0, limit) : jobs;
    if (displayJobs.length === 0) {
        return (
            <div className="bg-white border rounded-2xl p-10 text-center">
                <div className="text-sm font-bold text-gray-700">Uygun ilan bulunamadı.</div>
                <div className="text-xs text-gray-400 mt-2">Arama kriterine uygun yeni ilanlar eklendiğinde burada görünecek.</div>
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

