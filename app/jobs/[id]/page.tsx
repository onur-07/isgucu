"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatDistance } from "date-fns";
import { tr } from "date-fns/locale";
import {
    Briefcase,
    Clock,
    Send,
    MessageCircle,
    ChevronLeft,
    Calendar,
    User,
    ShieldCheck,
    FileText,
    AlertCircle,
    CheckCircle2,
    Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { sanitizeMessage, usernameKey } from "@/lib/utils";
import Image from "next/image";

type JobDetail = {
    id: string | number;
    userId: string;
    title: string;
    description: string;
    category: string;
    budget: string;
    createdAt: string;
    status: string;
    attachments?: string[];
    owner: {
        id: string;
        username: string;
        fullName?: string;
        avatarUrl?: string;
    } | null;
};

export default function JobDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [job, setJob] = useState<JobDetail | null>(null);
    const [sending, setSending] = useState(false);
    const [offerPrice, setOfferPrice] = useState("");
    const [offerDays, setOfferDays] = useState("");
    const [offerNote, setOfferNote] = useState("");
    const [success, setSuccess] = useState(false);

    const jobId = useMemo(() => {
        return params?.id ? String(params.id) : "";
    }, [params?.id]);

    useEffect(() => {
        const fetchJob = async () => {
            if (!jobId) {
                setError("İlan ID bulunamadı.");
                setLoading(false);
                return;
            }

            setLoading(true);
            setError("");

            try {
                console.log("Fetching job with ID:", jobId);

                // 1. Fetch Job
                const { data: row, error: dbErr } = await supabase
                    .from("jobs")
                    .select("*")
                    .eq("id", jobId)
                    .maybeSingle();

                if (dbErr) {
                    console.error("Supabase job fetch error:", dbErr);
                }

                let finalJob: JobDetail | null = null;

                if (row) {
                    // 2. Fetch Owner Profile - try by ID first, then by username
                    let profileData: any = null;

                    // Try UUID match first
                    const { data: byId } = await supabase
                        .from('profiles')
                        .select('id, username, full_name, avatar_url')
                        .eq('id', row.user_id)
                        .maybeSingle();

                    if (byId) {
                        profileData = byId;
                    } else {
                        // user_id might be a username string, try matching by username
                        const { data: byUsername } = await supabase
                            .from('profiles')
                            .select('id, username, full_name, avatar_url')
                            .ilike('username', row.user_id)
                            .maybeSingle();

                        if (byUsername) {
                            profileData = byUsername;
                        }
                    }

                    finalJob = {
                        id: row.id,
                        userId: row.user_id,
                        title: row.title,
                        description: row.description,
                        category: row.category,
                        budget: row.budget,
                        createdAt: row.created_at,
                        status: row.status || "open",
                        attachments: row.attachments || [],
                        owner: profileData ? {
                            id: profileData.id,
                            username: profileData.username,
                            fullName: profileData.full_name,
                            avatarUrl: profileData.avatar_url
                        } : null
                    };
                }

                // 3. Fallback to LocalStorage
                if (!finalJob) {
                    console.log("Job not found in Supabase, checking local storage...");
                    const localJobs = JSON.parse(localStorage.getItem("isgucu_jobs") || "[]");
                    const numericId = Number(jobId);

                    const localRow = localJobs.find((x: any) =>
                        String(x.id) === String(jobId) || (Number.isFinite(numericId) && Number(x.id) === numericId)
                    );

                    if (localRow) {
                        // Try to fetch profile for local job's user_id too
                        let localProfile: any = null;
                        const localUserId = String(localRow.user_id || "");

                        if (localUserId) {
                            const { data: byId2 } = await supabase
                                .from('profiles')
                                .select('id, username, full_name, avatar_url')
                                .eq('id', localUserId)
                                .maybeSingle();

                            if (byId2) {
                                localProfile = byId2;
                            } else {
                                const { data: byUn2 } = await supabase
                                    .from('profiles')
                                    .select('id, username, full_name, avatar_url')
                                    .ilike('username', localUserId)
                                    .maybeSingle();
                                if (byUn2) localProfile = byUn2;
                            }
                        }

                        finalJob = {
                            id: localRow.id,
                            userId: localUserId,
                            title: String(localRow.title || ""),
                            description: String(localRow.description || ""),
                            category: String(localRow.category || ""),
                            budget: String(localRow.budget || ""),
                            createdAt: String(localRow.created_at || localRow.createdAt || new Date().toISOString()),
                            status: String(localRow.status || "open"),
                            attachments: localRow.attachments || [],
                            owner: localProfile ? {
                                id: localProfile.id,
                                username: localProfile.username,
                                fullName: localProfile.full_name,
                                avatarUrl: localProfile.avatar_url
                            } : null
                        };
                    }
                }

                if (!finalJob) {
                    setError(`İlan bulunamadı. (ID: ${jobId})`);
                } else {
                    setJob(finalJob);
                }
            } catch (e: any) {
                console.error("Critical Job fetch error:", e);
                setError("İlan yüklenirken sistem hatası oluştu.");
            } finally {
                setLoading(false);
            }
        };

        void fetchJob();
    }, [jobId]);

    const handleSendProposal = async () => {
        if (!job) return;
        if (!user) {
            router.push("/login");
            return;
        }

        // IMPROVED ROLE CHECK: Allow admin and freelancer, but warn if not freelancer
        if (user.role !== "freelancer" && user.role !== "admin") {
            setError("Teklif göndermek için Freelancer hesabına sahip olmalısınız.");
            return;
        }

        const employerUsername = job.owner?.username || job.userId;
        if (!employerUsername) {
            setError("İlan sahibine ulaşılamıyor.");
            return;
        }

        if (usernameKey(employerUsername) === usernameKey(user.username)) {
            setError("Kendi ilanınıza teklif gönderemezsiniz.");
            return;
        }

        const price = Number(String(offerPrice || "").replace(",", "."));
        const days = Number(String(offerDays || "").trim());

        if (!offerPrice || !offerDays) {
            setError("Lütfen fiyat ve teslim süresi giriniz.");
            return;
        }

        if (!Number.isFinite(price) || price <= 0) {
            setError("Geçerli bir fiyat giriniz.");
            return;
        }

        if (!Number.isFinite(days) || days <= 0) {
            setError("Geçerli bir teslim süresi giriniz.");
            return;
        }

        const noteTrimmed = offerNote.trim();
        if (noteTrimmed) {
            const noteMod = sanitizeMessage(noteTrimmed);
            if (!noteMod.allowed) {
                setError(noteMod.reason || "Mesaj içeriği kurallara uygun değil.");
                return;
            }
        }

        setSending(true);
        setError("");

        try {
            const meKey = usernameKey(user.username);
            const otherKey = usernameKey(employerUsername);

            const summary = `Merhaba, "${job.title}" ilanı için ₺${price} bütçe ve ${days} gün teslim süresi ile teklifimi iletiyorum.`;
            const messageText = noteTrimmed ? `${summary}\n\nNot: ${noteTrimmed}` : summary;

            const msgMod = sanitizeMessage(messageText);

            const offerPayload = {
                sender_id: user.id,
                receiver_id: job.owner?.id || job.userId,
                sender_username: meKey,
                receiver_username: otherKey,
                message: noteTrimmed || summary,
                price,
                delivery_days: days,
                status: "pending",
                job_id: job.id
            };

            const messagePayload = {
                sender_username: meKey,
                receiver_username: otherKey,
                text: msgMod.cleanedText || messageText,
                read: false,
            };

            const [offerIns, msgIns] = await Promise.all([
                supabase.from("offers").insert([offerPayload]),
                supabase.from("messages").insert([messagePayload]),
            ]);

            if (offerIns.error) throw offerIns.error;
            if (msgIns.error) throw msgIns.error;

            setSuccess(true);
            setTimeout(() => {
                router.push(`/messages/${encodeURIComponent(employerUsername)}`);
            }, 1500);
        } catch (e: any) {
            console.error("Proposal error:", e);
            setError("Teklif gönderilirken bir hata oluştu: " + (e.message || "Bilinmiyor"));
        } finally {
            setSending(false);
        }
    };

    if (loading || authLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                    <p className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">İlan Detayları Yükleniyor...</p>
                </div>
            </div>
        );
    }

    if (!job) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
                <div className="max-w-md space-y-6">
                    <div className="h-20 w-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-red-100">
                        <AlertCircle className="h-10 w-10" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">İlan Bulunamadı</h1>
                    <p className="text-slate-500 font-medium leading-relaxed">{error || "Bu ilan arşivlenmiş veya sahibi tarafından kaldırılmış olabilir."}</p>
                    <Link href="/jobs" className="inline-block">
                        <Button className="h-14 px-8 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all">
                            İLANLARA GERİ DÖN
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    const isOwner = user && usernameKey(user.username) === usernameKey(job.owner?.username || job.userId);
    const canBid = user && user.role === "freelancer" && !isOwner;

    return (
        <div className="min-h-screen bg-[#f8fafc] pb-24">
            {/* Top Navigation / Breadcrumb */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-20">
                <div className="container h-20 flex items-center justify-between">
                    <Link href="/jobs" className="flex items-center gap-2 group text-slate-400 hover:text-slate-900 transition-colors">
                        <div className="h-9 w-9 rounded-xl border border-slate-100 flex items-center justify-center group-hover:bg-slate-50">
                            <ChevronLeft className="h-5 w-5" />
                        </div>
                        <span className="font-black text-[10px] uppercase tracking-widest">Geri Dön</span>
                    </Link>
                    <div className="hidden md:flex items-center gap-3">
                        <div className="flex -space-x-3">
                            <div className="h-9 w-9 rounded-full border-2 border-white bg-blue-500 flex items-center justify-center text-white text-[10px] font-black italic">İŞ</div>
                            <div className="h-9 w-9 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-slate-400"><User className="h-4 w-4" /></div>
                        </div>
                        <span className="font-bold text-[10px] text-slate-400 uppercase tracking-widest">İlan Detayı</span>
                    </div>
                </div>
            </div>

            <main className="container pt-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

                    {/* LEFT COLUMN: Main Content */}
                    <div className="lg:col-span-8 space-y-8">

                        {/* Title Section */}
                        <div className="space-y-6">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="px-4 py-1.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg shadow-blue-200">
                                    {job.category}
                                </span>
                                <span className="px-4 py-1.5 bg-white border border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-full">
                                    AÇIK İLAN
                                </span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-[1.1] tracking-tight">
                                {job.title}
                            </h1>
                            <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-slate-100">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-10 w-10 bg-slate-50 text-slate-500 rounded-xl flex items-center justify-center">
                                        <Clock className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">YAYINLANMA</p>
                                        <p className="text-xs font-bold text-slate-700 mt-1">{formatDistance(new Date(job.createdAt), new Date(), { addSuffix: true, locale: tr })}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                                        <span className="text-lg font-black">₺</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">BÜTÇE ARALIĞI</p>
                                        <p className="text-sm font-black text-emerald-700 mt-0.5 whitespace-nowrap">₺{job.budget}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Description Card */}
                        <Card className="rounded-[2.5rem] border-slate-100 p-8 md:p-12 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <Briefcase className="h-32 w-32" />
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8 flex items-center gap-3">
                                    <div className="h-1 bg-blue-600 w-8 rounded-full" />
                                    İŞİN DETAYLARI VE KAPSAMI
                                </h3>
                                <div className="prose prose-slate max-w-none">
                                    <p className="text-slate-600 font-medium leading-[1.8] text-lg lg:text-xl whitespace-pre-wrap">
                                        {job.description}
                                    </p>
                                </div>

                                {job.attachments && job.attachments.length > 0 && (
                                    <div className="mt-12 space-y-4">
                                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">EK DOSYALAR</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {job.attachments.map((file, i) => {
                                                const fileName = file.split('/').pop() || file;
                                                const isUrl = file.startsWith('http') || file.startsWith('blob:');
                                                const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName);
                                                return (
                                                    <a
                                                        key={i}
                                                        href={isUrl ? file : "javascript:void(0)"}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => { if (!isUrl) e.preventDefault(); }}
                                                        className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-blue-200 transition-colors cursor-pointer"
                                                    >
                                                        {isImage && isUrl ? (
                                                            <div className="h-10 w-10 rounded-xl overflow-hidden shadow-sm">
                                                                <img src={file} alt={fileName} className="h-full w-full object-cover" />
                                                            </div>
                                                        ) : (
                                                            <div className="h-10 w-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600">
                                                                <FileText className="h-5 w-5" />
                                                            </div>
                                                        )}
                                                        <div className="flex-1 overflow-hidden">
                                                            <p className="text-xs font-bold text-slate-700 truncate">{fileName}</p>
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase">{isImage ? 'Görsel' : 'Ek Dosya'}</p>
                                                        </div>
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* RIGHT COLUMN: Sidebar */}
                    <div className="lg:col-span-4 space-y-6">

                        {/* Employer Info Card */}
                        <Card className="rounded-[2.5rem] border-slate-100 p-8 shadow-sm">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">İLAN SAHİBİ PROFİLİ</h3>
                            <Link href={`/profile/${job.owner?.username || job.userId}`} className="flex items-center gap-4 group">
                                <div className="h-16 w-16 rounded-[1.5rem] bg-slate-100 border-2 border-white shadow-lg overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                                    {job.owner?.avatarUrl ? (
                                        <Image
                                            src={job.owner.avatarUrl}
                                            alt={job.owner.username}
                                            width={64}
                                            height={64}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center bg-slate-100 italic font-black text-slate-300">
                                            {(job.owner?.fullName || job.owner?.username || "I").charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-black text-slate-1000 group-hover:underline uppercase tracking-tight">
                                        {job.owner?.fullName || job.owner?.username || "İş Veren"}
                                    </h4>
                                    <div className="flex items-center gap-1.5 mt-1 text-[10px] font-bold text-slate-400">
                                        <ShieldCheck className="h-3 w-3 text-emerald-500 fill-emerald-50" />
                                        <span>DOĞRULANMIŞ ÜYE</span>
                                    </div>
                                </div>
                            </Link>

                            <div className="mt-8">
                                <Button
                                    onClick={() => {
                                        const username = job.owner?.username || job.userId;
                                        router.push(`/messages/${encodeURIComponent(username)}`);
                                    }}
                                    className="w-full h-14 bg-slate-900 hover:bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest gap-3 shadow-xl shadow-slate-200"
                                >
                                    <MessageCircle className="h-4.5 w-4.5" /> MESAJ GÖNDER
                                </Button>
                            </div>
                        </Card>

                        {/* Proposal Card */}
                        <Card className="rounded-[2.5rem] border-blue-100 p-8 shadow-2xl shadow-blue-500/10 bg-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4">
                                <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse block" />
                            </div>

                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">HIZLI TEKLİF VER</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed mb-8 tracking-wide">
                                Freelancer olarak en iyi fiyatınızı ve teslimat sürenizi hemen iletin.
                            </p>

                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">FİYAT (₺)</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-300">₺</span>
                                            <Input
                                                value={offerPrice}
                                                onChange={(e) => setOfferPrice(e.target.value)}
                                                placeholder="0.00"
                                                className="h-12 pl-10 rounded-xl border-slate-200 font-bold focus:ring-blue-500"
                                                disabled={!canBid || sending}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">SÜRE (GÜN)</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                            <Input
                                                value={offerDays}
                                                onChange={(e) => setOfferDays(e.target.value)}
                                                placeholder="3"
                                                className="h-12 pl-10 rounded-xl border-slate-200 font-bold focus:ring-blue-500"
                                                disabled={!canBid || sending}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">TEKLİF NOTU (KISA)</label>
                                    <Textarea
                                        value={offerNote}
                                        onChange={(e) => setOfferNote(e.target.value)}
                                        placeholder="Neden bu iş için en uygun kişi sizsiniz?"
                                        className="min-h-[140px] rounded-2xl border-slate-200 p-4 font-medium text-sm focus:ring-blue-500 resize-none"
                                        disabled={!canBid || sending}
                                    />
                                </div>

                                {error && (
                                    <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 text-[10px] font-bold uppercase leading-tight animate-in slide-in-from-top-2">
                                        <AlertCircle className="h-5 w-5 shrink-0" />
                                        {error}
                                    </div>
                                )}

                                {success && (
                                    <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl flex items-center gap-3 text-[10px] font-bold uppercase leading-tight">
                                        <CheckCircle2 className="h-5 w-5 shrink-0" />
                                        TEKLİFİNİZ BAŞARIYLA İLETİLDİ!
                                    </div>
                                )}

                                <Button
                                    onClick={handleSendProposal}
                                    disabled={!canBid || sending || success}
                                    className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-blue-500/20 group transition-all"
                                >
                                    {sending ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : success ? (
                                        "TEKLİF GÖNDERİLDİ"
                                    ) : (
                                        <>
                                            TEKLİFİ ŞİMDİ GÖNDER
                                            <Send className="h-4 w-4 ml-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                        </>
                                    )}
                                </Button>

                                {!user && (
                                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">
                                            Teklif vermek için giriş yapmalısınız.
                                        </p>
                                        <Link href="/login" className="text-[10px] font-black text-blue-600 uppercase mt-2 block hover:underline underline-offset-4">Hemen Giriş Yap →</Link>
                                    </div>
                                )}

                                {user && !canBid && !isOwner && (
                                    <div className="p-5 bg-orange-50 rounded-2xl border border-orange-100">
                                        <p className="text-[10px] font-black text-orange-700 uppercase leading-relaxed flex items-center gap-2">
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            Sadece Freelancer Hesabı Gereklidir
                                        </p>
                                        <p className="text-[9px] font-bold text-orange-600/70 mt-1 uppercase leading-normal">
                                            Profil ayarlarınızdan freelancer moduna geçtiğinizden emin olun.
                                        </p>
                                    </div>
                                )}

                                {isOwner && (
                                    <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 text-center">
                                        <p className="text-[10px] font-black text-blue-700 uppercase leading-relaxed">
                                            Bu Kendi İlanınızdır
                                        </p>
                                        <p className="text-[9px] font-bold text-blue-600/70 mt-1 uppercase leading-normal">
                                            Gelen teklifleri panelinizden yönetebilirsiniz.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                </div>
            </main>
        </div>
    );
}
