"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatDistance } from "date-fns";
import { tr } from "date-fns/locale";
import { Briefcase, Clock, Send, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { sanitizeMessage, usernameKey } from "@/lib/utils";

type JobRow = {
    id: number;
    user_id: string | null;
    title: string;
    description: string;
    category: string;
    budget: string;
    created_at: string;
    status?: string | null;
};

type LocalJobRow = {
    id?: number | string;
    user_id?: string | null;
    title?: string;
    description?: string;
    category?: string;
    budget?: string;
    created_at?: string;
    createdAt?: string;
    status?: string;
};

type JobDetail = {
    id: number;
    userId: string;
    title: string;
    description: string;
    category: string;
    budget: string;
    createdAt: string;
    status: string;
    employerUsername: string;
    employerId: string;
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

    const jobId = useMemo(() => {
        const raw = params?.id ? String(params.id) : "";
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : NaN;
    }, [params?.id]);

    useEffect(() => {
        const fetchJob = async () => {
            if (!Number.isFinite(jobId)) {
                setError("Geçersiz ilan ID.");
                setLoading(false);
                return;
            }

            setLoading(true);
            setError("");

            try {
                const { data, error: dbErr } = await supabase
                    .from("jobs")
                    .select("id, user_id, title, description, category, budget, created_at, status")
                    .eq("id", jobId)
                    .maybeSingle();

                let row = (data || null) as JobRow | null;

                if (dbErr || !row) {
                    const localJobs = JSON.parse(localStorage.getItem("isgucu_jobs") || "[]") as LocalJobRow[];
                    const localRow = localJobs.find((x) => Number(x.id) === jobId);
                    if (localRow) {
                        row = {
                            id: Number(localRow.id),
                            user_id: localRow.user_id ? String(localRow.user_id) : null,
                            title: String(localRow.title || ""),
                            description: String(localRow.description || ""),
                            category: String(localRow.category || ""),
                            budget: String(localRow.budget || ""),
                            created_at: String(localRow.created_at || localRow.createdAt || new Date().toISOString()),
                            status: String(localRow.status || "open"),
                        };
                    }
                }

                if (!row) {
                    setError("İlan bulunamadı.");
                    setJob(null);
                    return;
                }

                let employerUsername = "";
                let employerId = "";
                const ownerRaw = String(row.user_id || "").trim();

                if (ownerRaw) {
                    const byId = await supabase
                        .from("profiles")
                        .select("id, username")
                        .eq("id", ownerRaw)
                        .maybeSingle();

                    if (byId.data?.username) {
                        employerUsername = String(byId.data.username);
                        employerId = String(byId.data.id || "");
                    } else {
                        const byUsername = await supabase
                            .from("profiles")
                            .select("id, username")
                            .eq("username", ownerRaw)
                            .maybeSingle();
                        if (byUsername.data?.username) {
                            employerUsername = String(byUsername.data.username);
                            employerId = String(byUsername.data.id || "");
                        } else {
                            employerUsername = ownerRaw;
                        }
                    }
                }

                setJob({
                    id: Number(row.id),
                    userId: ownerRaw,
                    title: String(row.title || ""),
                    description: String(row.description || ""),
                    category: String(row.category || ""),
                    budget: String(row.budget || ""),
                    createdAt: String(row.created_at || new Date().toISOString()),
                    status: String(row.status || "open"),
                    employerUsername,
                    employerId,
                });
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "İlan yüklenemedi.");
                setJob(null);
            } finally {
                setLoading(false);
            }
        };

        void fetchJob();
    }, [jobId]);

    const goToThread = () => {
        if (!job?.employerUsername) return;
        router.push(`/messages/${encodeURIComponent(job.employerUsername)}`);
    };

    const handleSendProposal = async () => {
        if (!job) return;
        if (!user) {
            router.push("/login");
            return;
        }
        if (user.role !== "freelancer") {
            setError("Sadece freelancer kullanıcılar teklif gönderebilir.");
            return;
        }

        const otherUsername = String(job.employerUsername || "").trim();
        if (!otherUsername) {
            setError("İlan sahibinin kullanıcı adı bulunamadı.");
            return;
        }
        if (usernameKey(otherUsername) === usernameKey(user.username)) {
            setError("Kendi ilanınıza teklif gönderemezsiniz.");
            return;
        }

        const price = Number(String(offerPrice || "").replace(",", "."));
        const days = Number(String(offerDays || "").trim());
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(days) || days <= 0) {
            setError("Teklif için fiyat ve teslim günü giriniz.");
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
            let receiverId = job.employerId;
            if (!receiverId) {
                const receiverProfile = await supabase
                    .from("profiles")
                    .select("id, username")
                    .eq("username", otherUsername)
                    .maybeSingle();
                if (!receiverProfile.data?.id) {
                    throw new Error("İlan sahibinin profili bulunamadı. Lütfen mesajla iletişim kurmayı deneyin.");
                }
                receiverId = String(receiverProfile.data.id);
            }

            const meKey = usernameKey(user.username);
            const otherKey = usernameKey(otherUsername);

            const summary = `Merhaba, "${job.title}" ilanı için ${price} TL bütçe ve ${days} gün teslim süresi ile çalışabilirim.`;
            const messageText = noteTrimmed ? `${summary}\nNot: ${noteTrimmed}` : summary;
            const msgMod = sanitizeMessage(messageText);
            if (!msgMod.allowed) {
                throw new Error(msgMod.reason || "Mesaj içeriği kurallara uygun değil.");
            }

            const offerPayload = {
                gig_id: null,
                sender_id: user.id,
                receiver_id: receiverId,
                sender_username: meKey,
                receiver_username: otherKey,
                message: noteTrimmed || summary,
                price,
                delivery_days: days,
                extras: null,
                status: "pending",
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

            router.push(`/messages/${encodeURIComponent(otherUsername)}`);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Teklif gönderilemedi.");
        } finally {
            setSending(false);
        }
    };

    if (loading || authLoading) {
        return (
            <div className="container py-12">
                <div className="text-sm font-bold text-gray-500">Yükleniyor...</div>
            </div>
        );
    }

    if (!job) {
        return (
            <div className="container py-12 space-y-4">
                <h1 className="text-2xl font-black text-gray-900">İlan bulunamadı</h1>
                <p className="text-sm font-semibold text-gray-500">{error || "Bu ilan kaldırılmış olabilir."}</p>
                <Link href="/jobs">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">İlanlara Dön</Button>
                </Link>
            </div>
        );
    }

    const canInteract =
        !!user &&
        user.role === "freelancer" &&
        !!job.employerUsername &&
        usernameKey(job.employerUsername) !== usernameKey(user.username);

    return (
        <div className="container py-10 md:py-12">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 text-[11px] font-black uppercase tracking-widest">
                            <Briefcase className="h-3.5 w-3.5" />
                            İş İlanı
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-gray-900 leading-tight">{job.title}</h1>
                        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-gray-500">
                            <span className="inline-flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {formatDistance(new Date(job.createdAt), new Date(), { addSuffix: true, locale: tr })}
                            </span>
                            <span className="rounded-full border border-gray-200 bg-white px-3 py-1">{job.category}</span>
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                                Bütçe: ₺{job.budget}
                            </span>
                        </div>
                    </div>

                    <Card className="rounded-3xl border-gray-100 p-6 md:p-8">
                        <h2 className="text-lg font-black text-gray-900 mb-3">İş Detayları</h2>
                        <p className="text-sm md:text-base font-medium text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {job.description}
                        </p>
                    </Card>
                </div>

                <div className="space-y-5">
                    <Card className="rounded-3xl border-gray-100 p-5">
                        <div className="text-xs font-black uppercase tracking-widest text-gray-400">İlan Sahibi</div>
                        <div className="mt-2 text-base font-black text-gray-900">{job.employerUsername || "Bilinmiyor"}</div>

                        <div className="mt-4 grid gap-2">
                            <Button
                                onClick={goToThread}
                                disabled={!job.employerUsername}
                                className="w-full bg-gray-900 hover:bg-black text-white font-black"
                            >
                                <MessageCircle className="h-4 w-4 mr-2" />
                                Mesaja Git
                            </Button>
                        </div>
                    </Card>

                    <Card className="rounded-3xl border-gray-100 p-5 space-y-3">
                        <div className="text-xs font-black uppercase tracking-widest text-gray-400">Hızlı Teklif</div>
                        <p className="text-xs font-semibold text-gray-500">
                            Bu teklif gönderildiğinde mesajlaşma ekranında normal mesaj olarak da görünecektir.
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                            <input
                                value={offerPrice}
                                onChange={(e) => setOfferPrice(e.target.value)}
                                placeholder="Fiyat (₺)"
                                className="h-11 rounded-xl border px-3 text-sm font-semibold"
                                disabled={!canInteract || sending}
                            />
                            <input
                                value={offerDays}
                                onChange={(e) => setOfferDays(e.target.value)}
                                placeholder="Teslim (gün)"
                                className="h-11 rounded-xl border px-3 text-sm font-semibold"
                                disabled={!canInteract || sending}
                            />
                        </div>

                        <Textarea
                            value={offerNote}
                            onChange={(e) => setOfferNote(e.target.value)}
                            placeholder="Örn: Bu projeyi şu teknolojiyle, şu teslim planıyla tamamlayabilirim."
                            className="min-h-[100px] resize-none"
                            disabled={!canInteract || sending}
                        />

                        <Button
                            onClick={handleSendProposal}
                            disabled={!canInteract || sending}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black"
                        >
                            <Send className="h-4 w-4 mr-2" />
                            {sending ? "Gönderiliyor..." : "Teklif + Mesaj Gönder"}
                        </Button>

                        {!canInteract && (
                            <div className="text-xs font-semibold text-gray-500">
                                Teklif göndermek için freelancer hesabı ile giriş yapmalısınız.
                            </div>
                        )}
                    </Card>

                    {error && <div className="text-sm font-semibold text-red-600">{error}</div>}
                </div>
            </div>
        </div>
    );
}
