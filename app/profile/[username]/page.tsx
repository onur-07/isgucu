"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
    Star, MapPin, Calendar, Briefcase, Award,
    Globe, Phone, Mail, ShieldCheck, Clock,
    MessageCircle, ChevronLeft, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistance } from "date-fns";
import { tr } from "date-fns/locale";
import { maskFullName, cn } from "@/lib/utils";
import { GigCard } from "@/components/gigs/gig-card";
import { JobCard } from "@/components/jobs/job-card";
import Image from "next/image";

interface ProfileData {
    id: string;
    username: string;
    full_name: string;
    bio: string;
    skills: string[];
    location: string;
    role: string;
    avatar_url: string;
    created_at: string;
    website?: string;
}

export default function PublicProfilePage() {
    const params = useParams<{ username: string }>();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [gigs, setGigs] = useState<any[]>([]);
    const [jobs, setJobs] = useState<any[]>([]);
    const [ratingAvg, setRatingAvg] = useState<number>(0);
    const [ratingCount, setRatingCount] = useState<number>(0);

    useEffect(() => {
        const fetchData = async () => {
            if (!params?.username) return;

            setLoading(true);
            try {
                // 1. Fetch Profile
                const { data: profileData, error: profileErr } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('username', params.username)
                    .maybeSingle();

                if (profileErr) throw profileErr;
                if (!profileData) {
                    // Try by ID as fallback?
                    const { data: byId } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', params.username)
                        .maybeSingle();

                    if (byId) {
                        setProfile(byId as ProfileData);
                    } else {
                        setProfile(null);
                        setLoading(false);
                        return;
                    }
                } else {
                    setProfile(profileData as ProfileData);
                }

                const targetUser = profileData || (await supabase.from('profiles').select('*').eq('id', params.username).maybeSingle()).data;

                if (targetUser) {
                    const { data: reviewRows } = await supabase
                        .from("reviews")
                        .select("rating")
                        .eq("to_user_id", targetUser.id);
                    const ratings = Array.isArray(reviewRows)
                        ? reviewRows.map((r: any) => Number(r?.rating ?? 0)).filter((n) => Number.isFinite(n) && n > 0)
                        : [];
                    const count = ratings.length;
                    const avg = count > 0 ? ratings.reduce((s, n) => s + n, 0) / count : 0;
                    setRatingCount(count);
                    setRatingAvg(Number.isFinite(avg) ? Math.round(avg * 10) / 10 : 0);

                    // 2. Fetch Gigs if Freelancer
                    if (targetUser.role === "freelancer") {
                        const { data: gigsData } = await supabase
                            .from('gigs')
                            .select('*')
                            .eq('user_id', targetUser.id)
                            .order('created_at', { ascending: false });
                        setGigs(gigsData || []);
                    }

                    // 3. Fetch Jobs if Employer
                    if (targetUser.role === "employer" || targetUser.role === "admin") {
                        const { data: jobsData } = await supabase
                            .from('jobs')
                            .select('*')
                            .eq('user_id', targetUser.id)
                            .order('created_at', { ascending: false });
                        setJobs(jobsData || []);
                    }
                }
            } catch (err) {
                console.error("Profile fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [params?.username]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                    <p className="font-black text-[10px] uppercase tracking-widest text-slate-400">Profil YÃ¼kleniyor...</p>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
                <div className="max-w-md space-y-6">
                    <div className="h-20 w-20 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
                        <MapPin className="h-10 w-10" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">Profil BulunamadÄ±</h1>
                    <p className="text-slate-500 font-medium">BÃ¶yle bir kullanÄ±cÄ± bulunamadÄ± veya hesabÄ± pasif durumda.</p>
                    <Button onClick={() => router.back()} variant="outline" className="rounded-2xl h-14 px-8 font-black uppercase text-xs tracking-widest">
                        GERÄ° DÃ–N
                    </Button>
                </div>
            </div>
        );
    }

    const isFreelancer = profile.role === "freelancer";
    const isEmployer = profile.role === "employer" || profile.role === "admin";

    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            {/* Nav Header */}
            <div className="bg-white border-b border-slate-100 h-20 flex items-center">
                <div className="container flex items-center justify-between">
                    <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors group">
                        <div className="h-10 w-10 rounded-xl border border-slate-100 flex items-center justify-center group-hover:bg-slate-50">
                            <ChevronLeft className="h-5 w-5" />
                        </div>
                        <span className="font-black text-[10px] uppercase tracking-widest">Geri DÃ¶n</span>
                    </button>
                    <Button
                        onClick={() => router.push(`/messages/${encodeURIComponent(profile.username)}`)}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl h-12 px-6 font-black uppercase text-[10px] tracking-widest gap-3 shadow-lg shadow-blue-100"
                    >
                        <MessageCircle className="h-4 w-4" /> MESAJ GÃ–NDER
                    </Button>
                </div>
            </div>

            {/* Profile Hero Section */}
            <div className="relative pt-10 pb-20 overflow-hidden">
                {/* Background Accent */}
                <div className={cn(
                    "absolute top-0 left-0 w-full h-[400px] -z-10",
                    isFreelancer ? "bg-gradient-to-b from-blue-50 to-transparent" : "bg-gradient-to-b from-orange-50 to-transparent"
                )} />

                <div className="container">
                    <div className="max-w-5xl mx-auto">
                        <div className="bg-white rounded-[3rem] p-8 md:p-14 shadow-2xl shadow-slate-200/50 relative border border-white">
                            <div className="flex flex-col md:flex-row items-center md:items-start gap-10 md:gap-14">
                                {/* Avatar */}
                                <div className="relative group">
                                    <div className={cn(
                                        "h-40 w-40 md:h-52 md:w-52 rounded-[2.5rem] bg-white p-1.5 shadow-2xl relative z-10 overflow-hidden",
                                        isFreelancer ? "ring-4 ring-blue-50" : "ring-4 ring-orange-50"
                                    )}>
                                        {profile.avatar_url ? (
                                            <img
                                                src={profile.avatar_url}
                                                alt={profile.username}
                                                className="h-full w-full object-cover rounded-[2.2rem]"
                                            />
                                        ) : (
                                            <div className={cn(
                                                "h-full w-full flex items-center justify-center text-5xl font-black text-white rounded-[2.2rem]",
                                                isFreelancer ? "bg-blue-600" : "bg-orange-500"
                                            )}>
                                                {profile.full_name?.charAt(0) || profile.username.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className={cn(
                                        "absolute -bottom-4 -right-4 h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-xl z-20",
                                        isFreelancer ? "bg-blue-600" : "bg-orange-500"
                                    )}>
                                        <ShieldCheck className="h-6 w-6" />
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 text-center md:text-left space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                            <Badge className={cn(
                                                "px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm",
                                                isFreelancer ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-orange-50 text-orange-600 border-orange-100"
                                            )}>
                                                {isFreelancer ? "Freelancer" : "Ä°ÅŸ Veren"}
                                            </Badge>
                                            <span className="text-slate-300 font-light hidden md:block">|</span>
                                            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                                <MapPin className="h-4 w-4" /> {profile.location || "DÃ¼nya Geneli"}
                                            </div>
                                        </div>
                                        <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter italic">
                                            {profile.full_name || profile.username}
                                        </h1>
                                        <div className="text-slate-400 font-bold text-sm tracking-tight">
                                            @{profile.username} â€¢ {profile.created_at ? formatDistance(new Date(profile.created_at), new Date(), { addSuffix: true, locale: tr }) : "Yeni Ãœye"} katÄ±ldÄ±
                                        </div>`r`n                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-xs font-black uppercase tracking-widest">`r`n                                            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />`r`n                                            {ratingCount > 0 ? `${ratingAvg.toFixed(1)} / 5.0` : "0.0 / 5.0"}`r`n                                            <span className="text-[10px] text-amber-500 normal-case font-bold">({ratingCount} değerlendirme)</span>`r`n                                        </div>
                                    </div>

                                    <div className="max-w-2xl bg-slate-50/50 p-6 md:p-8 rounded-[2rem] border border-slate-100 italic">
                                        <p className="text-slate-600 font-medium leading-[1.8] text-lg">
                                            {profile.bio || "Bu kullanÄ±cÄ± henÃ¼z kendini tanÄ±tacak bir biyografi eklememiÅŸ."}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-4">
                                        {profile.skills?.map((skill, i) => (
                                            <span key={i} className="px-4 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold text-slate-700 shadow-sm">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content Sections */}
                    <div className="max-w-5xl mx-auto mt-12 space-y-12">
                        {/* Freelancer Gigs */}
                        {isFreelancer && (
                            <section className="space-y-8">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic flex items-center gap-3">
                                        <div className="h-1.5 w-8 bg-blue-600 rounded-full" />
                                        Hizmetlerim
                                    </h3>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        {gigs.length} Toplam Ä°lan
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {gigs.map((gig) => (
                                        <GigCard key={gig.id} gig={gig} />
                                    ))}
                                    {gigs.length === 0 && (
                                        <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-50 border-dashed">
                                            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">HenÃ¼z bir hizmet ilanÄ± eklememiÅŸ.</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        {/* Employer Jobs */}
                        {isEmployer && (
                            <section className="space-y-8">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic flex items-center gap-3">
                                        <div className="h-1.5 w-8 bg-orange-500 rounded-full" />
                                        AÃ§tÄ±ÄŸÄ±m Ä°ÅŸ Ä°lanlarÄ±
                                    </h3>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        {jobs.length} Aktif Ä°lan
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {jobs.map((job) => (
                                        <JobCard key={job.id} job={job} />
                                    ))}
                                    {jobs.length === 0 && (
                                        <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-50 border-dashed">
                                            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">HenÃ¼z bir iÅŸ ilanÄ± aÃ§mamÄ±ÅŸ.</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

