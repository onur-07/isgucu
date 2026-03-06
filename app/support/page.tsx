"use client";

import { useAuth } from "@/components/auth/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usernameKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Headphones, Send, CheckCircle2, MessageCircle, ShieldCheck, Clock, AlertCircle, FileText } from "lucide-react";
import Link from "next/link";

interface SupportTicket {
    id: string;
    fromUser: string;
    fromEmail: string;
    subject: string;
    category: string;
    message: string;
    status: "open" | "replied" | "closed";
    createdAt: string;
    reply?: string;
    repliedAt?: string;
    replies?: Array<{ id: string; message: string; createdAt: string; authorRole: "admin" | "user" }>;
}

const SUPPORT_CATEGORIES = [
    "Genel Soru",
    "Teknik Sorun",
    "Ödeme & Finans",
    "Sipariş Sorunu",
    "Şikayet & İhbar",
    "Hesap Sorunu",
    "Öneri & Geri Bildirim",
];

export default function SupportPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [submitted, setSubmitted] = useState(false);
    const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [submitError, setSubmitError] = useState<string>("");
    const [selectedTicketId, setSelectedTicketId] = useState<string>("");
    const [followupText, setFollowupText] = useState<string>("");
    const [followupSending, setFollowupSending] = useState(false);
    const [form, setForm] = useState({
        subject: "",
        category: "",
        message: "",
    });

    const reloadTickets = async () => {
        if (!user) return;
        setLoadingTickets(true);
        try {
            const meU = String(user.username || "").trim();
            const meE = String(user.email || "").trim();
            const q = (v: string) => `"${String(v).replace(/\\/g, "\\\\").replace(/\"/g, "\\\"")}"`;
            const orParts = [
                meU ? `from_user.eq.${q(meU)}` : "",
                meE ? `from_email.eq.${q(meE)}` : "",
            ].filter(Boolean);
            const orFilter = orParts.join(",");
            if (!orFilter) {
                setMyTickets([]);
                return;
            }

            const res = await supabase
                .from("support_tickets")
                .select("id, from_user, from_email, subject, category, message, status, created_at, reply, replied_at")
                .or(orFilter)
                .order("created_at", { ascending: false })
                .limit(50);
            if (res.error) throw res.error;

            const normalized: SupportTicket[] = (res.data || []).map((t: any) => ({
                id: String(t.id),
                fromUser: String(t.from_user || ""),
                fromEmail: String(t.from_email || ""),
                subject: String(t.subject || ""),
                category: String(t.category || ""),
                message: String(t.message || ""),
                status: (String(t.status || "open") as any) as SupportTicket["status"],
                createdAt: String(t.created_at || new Date().toISOString()),
                reply: t.reply ? String(t.reply) : undefined,
                repliedAt: t.replied_at ? String(t.replied_at) : undefined,
            }));

            const ids = normalized.map((x) => String(x.id)).filter(Boolean);
            if (ids.length > 0) {
                const idsNum = ids.map((v) => Number(v)).filter((n) => Number.isFinite(n));
                const repliesRes = await supabase
                    .from("support_ticket_replies")
                    .select("id, ticket_id, author_role, message, created_at")
                    .in("ticket_id", idsNum)
                    .order("created_at", { ascending: true });
                if (repliesRes.error) {
                    console.error("Support ticket replies load error:", repliesRes.error);
                } else {
                    const grouped: Record<string, SupportTicket["replies"]> = {};
                    for (const r of (repliesRes.data || []) as any[]) {
                        const k = String((r as any)?.ticket_id || "");
                        if (!k) continue;
                        if (!grouped[k]) grouped[k] = [];
                        (grouped[k] as any[]).push({
                            id: String((r as any)?.id || ""),
                            message: String((r as any)?.message || ""),
                            createdAt: String((r as any)?.created_at || ""),
                            authorRole: String((r as any)?.author_role || "admin") as any,
                        });
                    }
                    for (const t of normalized) {
                        const k = String(t.id);
                        const rows = grouped[k] || [];
                        if (rows && rows.length > 0) {
                            t.replies = rows as any;
                            const last = (rows as any[])[(rows as any[]).length - 1];
                            if (!t.reply && last?.message) t.reply = String(last.message);
                        }
                    }
                }
            }

            setMyTickets(normalized);
        } catch (e) {
            console.error("Support tickets reload error:", e);
            setMyTickets([]);
        } finally {
            setLoadingTickets(false);
        }
    };

    useEffect(() => {
        if (!user) {
            router.push("/login");
            return;
        }

        let cancelled = false;
        const loadMyTickets = async () => {
            setLoadingTickets(true);
            try {
                const meU = String(user.username || "").trim();
                const meE = String(user.email || "").trim();
                const q = (v: string) => `"${String(v).replace(/\\/g, "\\\\").replace(/\"/g, "\\\"")}"`;
                const orParts = [
                    meU ? `from_user.eq.${q(meU)}` : "",
                    meE ? `from_email.eq.${q(meE)}` : "",
                ].filter(Boolean);
                const orFilter = orParts.join(",");

                if (!orFilter) {
                    setMyTickets([]);
                    return;
                }

                const res = await supabase
                    .from("support_tickets")
                    .select("id, from_user, from_email, subject, category, message, status, created_at, reply, replied_at")
                    .or(orFilter)
                    .order("created_at", { ascending: false })
                    .limit(50);

                if (res.error) throw res.error;

                const normalized: SupportTicket[] = (res.data || []).map((t: any) => ({
                    id: String(t.id),
                    fromUser: String(t.from_user || ""),
                    fromEmail: String(t.from_email || ""),
                    subject: String(t.subject || ""),
                    category: String(t.category || ""),
                    message: String(t.message || ""),
                    status: (String(t.status || "open") as any) as SupportTicket["status"],
                    createdAt: String(t.created_at || new Date().toISOString()),
                    reply: t.reply ? String(t.reply) : undefined,
                    repliedAt: t.replied_at ? String(t.replied_at) : undefined,
                }));

                const ids = normalized.map((x) => String(x.id)).filter(Boolean);
                if (ids.length > 0) {
                    const idsNum = ids.map((v) => Number(v)).filter((n) => Number.isFinite(n));
                    const repliesRes = await supabase
                        .from("support_ticket_replies")
                        .select("id, ticket_id, author_role, message, created_at")
                        .in("ticket_id", idsNum)
                        .order("created_at", { ascending: true });

                    if (repliesRes.error) {
                        console.error("Support ticket replies load error:", repliesRes.error);
                    } else {
                        const grouped: Record<string, SupportTicket["replies"]> = {};
                        for (const r of (repliesRes.data || []) as any[]) {
                            const k = String((r as any)?.ticket_id || "");
                            if (!k) continue;
                            if (!grouped[k]) grouped[k] = [];
                            (grouped[k] as any[]).push({
                                id: String((r as any)?.id || ""),
                                message: String((r as any)?.message || ""),
                                createdAt: String((r as any)?.created_at || ""),
                                authorRole: String((r as any)?.author_role || "admin") as any,
                            });
                        }

                        for (const t of normalized) {
                            const k = String(t.id);
                            const rows = grouped[k] || [];
                            if (rows && rows.length > 0) {
                                t.replies = rows as any;
                                const last = (rows as any[])[(rows as any[]).length - 1];
                                if (!t.reply && last?.message) t.reply = String(last.message);
                            }
                        }
                    }
                }

                if (!cancelled) setMyTickets(normalized);
            } catch (e) {
                console.error("Support tickets load error:", e);
                if (!cancelled) setMyTickets([]);
            } finally {
                if (!cancelled) setLoadingTickets(false);
            }
        };

        loadMyTickets();
        return () => {
            cancelled = true;
        };
    }, [user, router]);

    useEffect(() => {
        setFollowupText("");
    }, [selectedTicketId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSubmitError("");

        try {
            const insertRes = await supabase
                .from("support_tickets")
                .insert({
                    from_user: user.username,
                    from_email: user.email,
                    subject: form.subject,
                    category: form.category,
                    message: form.message,
                    status: "open",
                })
                .select("id, from_user, from_email, subject, category, message, status, created_at, reply, replied_at")
                .maybeSingle();

            if (insertRes.error) throw insertRes.error;
            const t: any = insertRes.data;

            const nextTicket: SupportTicket = {
                id: String(t?.id || `TKT-${Date.now()}`),
                fromUser: String(t?.from_user || user.username),
                fromEmail: String(t?.from_email || user.email || ""),
                subject: String(t?.subject || form.subject),
                category: String(t?.category || form.category),
                message: String(t?.message || form.message),
                status: (String(t?.status || "open") as any) as SupportTicket["status"],
                createdAt: String(t?.created_at || new Date().toISOString()),
                reply: t?.reply ? String(t.reply) : undefined,
                repliedAt: t?.replied_at ? String(t.replied_at) : undefined,
            };

            setSubmitted(true);
            setMyTickets((prev) => [nextTicket, ...prev]);
            setForm({ subject: "", category: "", message: "" });
            setTimeout(() => setSubmitted(false), 5000);
        } catch (e: any) {
            console.error("Support ticket insert error:", e);
            setSubmitError(e?.message ? String(e.message) : "Destek talebi gönderilemedi.");
        }
    };

    if (!user) return null;

    const selectedTicket = selectedTicketId
        ? myTickets.find((t) => String(t.id) === String(selectedTicketId)) || null
        : null;

    useEffect(() => {
        if (!user) return;
        if (!selectedTicket) return;
        if (!selectedTicket.repliedAt) return;

        const seenKey = `isgucu_support_reply_seen_${usernameKey(user.username)}`;
        try {
            const raw = localStorage.getItem(seenKey);
            const seen = raw ? (JSON.parse(raw) as Record<string, string>) : {};
            const id = String(selectedTicket.id);
            const repliedAt = String(selectedTicket.repliedAt);
            if (seen[id] !== repliedAt) {
                seen[id] = repliedAt;
                localStorage.setItem(seenKey, JSON.stringify(seen));
                window.dispatchEvent(new Event("support_seen_updated"));
            }
        } catch (e) {
            console.error("Support seen mark error:", e);
        }
    }, [selectedTicket, user]);

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Premium Header */}
            <div className="bg-slate-900 py-20 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10">
                    <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-blue-500 rounded-full blur-[100px]"></div>
                </div>
                <div className="container mx-auto px-4 relative z-10 text-center">
                    <div className="inline-flex items-center justify-center p-4 rounded-[2rem] bg-blue-600/20 text-blue-400 mb-6 border border-blue-500/20">
                        <Headphones className="h-10 w-10" />
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black font-heading text-white mb-4 uppercase tracking-tight">Resmi <span className="text-blue-500 italic">Destek</span></h1>
                    <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-medium">
                        Tüm sorunlarınız için kurumsal çözüm kanalımız. Talebiniz doğrudan uzman ekibimize iletilir.
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-4 -mt-10 relative z-20 max-w-6xl">
                {/* Stats / Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex items-center space-x-6">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <Clock className="w-7 h-7" />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 uppercase text-sm tracking-widest">Yanıt Süresi</h3>
                            <p className="text-slate-500 font-bold text-lg">~2 Saat</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex items-center space-x-6">
                        <div className="w-14 h-14 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-7 h-7" />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 uppercase text-sm tracking-widest">Güvenlik</h3>
                            <p className="text-slate-500 font-bold text-lg">SSL Korumalı</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex items-center space-x-6">
                        <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                            <MessageCircle className="w-7 h-7" />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 uppercase text-sm tracking-widest">Aktiflik</h3>
                            <p className="text-slate-500 font-bold text-lg">7/24 Destek</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* Form Area */}
                    <div className="lg:col-span-7">
                        <div className="bg-white rounded-[3.5rem] p-10 md:p-16 shadow-xl shadow-slate-200/50 border border-slate-100">
                            <div className="flex items-center justify-between mb-10">
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 italic">Talep Formu</h2>
                                    <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-xs">Ayrıntılar çözüm hızını artırır.</p>
                                </div>
                                <div className="hidden sm:block">
                                    <FileText className="w-12 h-12 text-slate-100" />
                                </div>
                            </div>

                            {submitted && (
                                <div className="mb-8 p-6 bg-green-600 rounded-[2rem] text-white font-black flex items-center gap-4 animate-in zoom-in duration-300 shadow-xl shadow-green-200">
                                    <CheckCircle2 className="h-8 w-8 shrink-0" />
                                    <div className="text-sm">
                                        Talebiniz Kaydedildi! <br />
                                        <span className="opacity-80 font-medium">Bize ulaştığınız için teşekkürler.</span>
                                    </div>
                                </div>
                            )}

                            {submitError && (
                                <div className="mb-8 p-6 bg-red-600 rounded-[2rem] text-white font-black flex items-center gap-4 animate-in zoom-in duration-300 shadow-xl shadow-red-200">
                                    <AlertCircle className="h-8 w-8 shrink-0" />
                                    <div className="text-sm">
                                        Talep gönderilemedi. <br />
                                        <span className="opacity-80 font-medium">{submitError}</span>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-8">
                                <div className="grid grid-cols-1 gap-8">
                                    <div className="space-y-3">
                                        <Label className="font-black uppercase tracking-widest text-xs text-slate-400 pl-4">Konu Başlığı</Label>
                                        <Input
                                            required
                                            placeholder="Neyle ilgili sorun yaşıyorsunuz?"
                                            value={form.subject}
                                            onChange={(e) => setForm({ ...form, subject: e.target.value })}
                                            className="h-16 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-lg px-6"
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="font-black uppercase tracking-widest text-xs text-slate-400 pl-4">Kategori Seçimi</Label>
                                        <Select required onValueChange={(val) => setForm({ ...form, category: val })}>
                                            <SelectTrigger className="h-16 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-lg px-6">
                                                <SelectValue placeholder="Bir kategori seçin..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-slate-100">
                                                {SUPPORT_CATEGORIES.map(cat => (
                                                    <SelectItem key={cat} value={cat} className="rounded-xl py-3 font-medium">{cat}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="font-black uppercase tracking-widest text-xs text-slate-400 pl-4">Detaylı Açıklama</Label>
                                        <Textarea
                                            required
                                            placeholder="Lütfen sorununuzu tüm detaylarıyla açıklayın..."
                                            className="min-h-[200px] rounded-[2rem] bg-slate-50 border-transparent focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-lg p-8 leading-relaxed"
                                            value={form.message}
                                            onChange={(e) => setForm({ ...form, message: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-20 rounded-[2rem] text-xl font-black uppercase tracking-widest shadow-2xl shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-95">
                                    <Send className="h-6 w-6 mr-3" /> Talebi Gönder
                                </Button>
                            </form>
                        </div>
                    </div>

                    {/* Dashboard Sidebar */}
                    <div className="lg:col-span-5 space-y-8">
                        <div className="bg-slate-900 rounded-[3.5rem] p-10 text-white shadow-2xl shadow-slate-300">
                            <h3 className="text-2xl font-black mb-6 italic border-b border-white/10 pb-4">Önceki Taleplerim</h3>

                            {loadingTickets ? (
                                <div className="text-center py-12">
                                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <AlertCircle className="w-10 h-10 text-white/20" />
                                    </div>
                                    <p className="text-slate-400 font-medium">Yükleniyor...</p>
                                </div>
                            ) : myTickets.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <AlertCircle className="w-10 h-10 text-white/20" />
                                    </div>
                                    <p className="text-slate-400 font-medium">Henüz bir talebiniz bulunmuyor.</p>
                                </div>
                            ) : (
                                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                    {myTickets.map(ticket => (
                                        <button
                                            key={ticket.id}
                                            type="button"
                                            onClick={() => setSelectedTicketId(String(ticket.id))}
                                            className="w-full text-left bg-white/5 rounded-[2rem] p-6 border border-white/5 hover:bg-white/10 transition-all group"
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${ticket.status === "open" ? "bg-amber-500/20 text-amber-500" :
                                                    ticket.status === "replied" ? "bg-blue-500/20 text-blue-500" :
                                                        "bg-white/10 text-white/40"
                                                    }`}>
                                                    {ticket.status === "open" ? "Bekliyor" : ticket.status === "replied" ? "Cevaplandı" : "Kapalı"}
                                                </span>
                                                <span className="text-[10px] text-white/20 font-bold">{ticket.id}</span>
                                            </div>
                                            <h4 className="font-bold text-white mb-2 line-clamp-1 group-hover:text-blue-400 transition-colors uppercase tracking-tight">{ticket.subject}</h4>
                                            <p className="text-xs text-white/40 line-clamp-2 leading-relaxed mb-4">{ticket.message}</p>

                                            {ticket.reply && (
                                                <div className="p-4 bg-blue-600/10 rounded-2xl border border-blue-600/20 mb-4">
                                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 italic">Destek Yanıtı:</p>
                                                    <p className="text-xs text-blue-100/80 leading-relaxed italic">"{ticket.reply}"</p>
                                                </div>
                                            )}

                                            <div className="text-[10px] text-white/20 font-bold flex items-center justify-between">
                                                <span>{new Date(ticket.createdAt).toLocaleDateString("tr-TR")}</span>
                                                <span className="text-white/40">{ticket.category}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-blue-600 rounded-[3rem] p-10 text-white shadow-xl shadow-blue-200">
                            <h4 className="text-xl font-black mb-4 uppercase tracking-tighter italic">Acil Durum mu?</h4>
                            <p className="text-blue-100 text-sm font-medium leading-relaxed mb-6">
                                Çok acil ödeme veya hesap güvenliği sorunları için 0850 555 0101 numaralı telefonumuzdan hafta içi 09:00 - 18:00 arası arama yapabilirsiniz.
                            </p>
                            <div className="w-full py-4 bg-white/20 rounded-2xl text-center font-black text-lg tracking-widest">0850 555 0101</div>
                        </div>
                    </div>
                </div>
            </div>

            {selectedTicket ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        onClick={() => setSelectedTicketId("")}
                        aria-label="Kapat"
                    />
                    <div className="relative w-full max-w-2xl rounded-[2.5rem] bg-white shadow-2xl border border-slate-100 overflow-hidden">
                        <div className="p-6 sm:p-8 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Destek Talebi Detayı</div>
                                    <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900 truncate">{selectedTicket.subject}</div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
                                            {selectedTicket.category}
                                        </span>
                                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                                            selectedTicket.status === "open"
                                                ? "bg-amber-50 text-amber-700"
                                                : selectedTicket.status === "replied"
                                                    ? "bg-blue-50 text-blue-700"
                                                    : "bg-slate-50 text-slate-500"
                                        }`}>
                                            {selectedTicket.status === "open" ? "Bekliyor" : selectedTicket.status === "replied" ? "Cevaplandı" : "Kapalı"}
                                        </span>
                                        <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                            {new Date(selectedTicket.createdAt).toLocaleString("tr-TR")}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-11 rounded-2xl font-black uppercase tracking-widest text-[10px]"
                                    onClick={() => setSelectedTicketId("")}
                                >
                                    Kapat
                                </Button>
                            </div>
                        </div>

                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="rounded-[2rem] border border-slate-100 bg-white p-6">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mesajın</div>
                                <div className="mt-3 text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{selectedTicket.message}</div>
                            </div>

                            {selectedTicket.replies && selectedTicket.replies.length > 0 ? (
                                <div className="rounded-[2rem] border border-blue-100 bg-blue-50/60 p-6">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-blue-700">Destek Yanıtları</div>
                                    </div>
                                    <div className="mt-4 space-y-4">
                                        {selectedTicket.replies.map((r) => (
                                            <div key={r.id} className="rounded-2xl bg-white/70 border border-blue-100 p-4">
                                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-blue-700">{r.authorRole === "user" ? "Sen" : "Destek"}</div>
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                                                        {r.createdAt ? new Date(r.createdAt).toLocaleString("tr-TR") : ""}
                                                    </div>
                                                </div>
                                                <div className="mt-2 text-blue-900 font-medium leading-relaxed whitespace-pre-wrap">{r.message}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : selectedTicket.reply ? (
                                <div className="rounded-[2rem] border border-blue-100 bg-blue-50/60 p-6">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-blue-700">Destek Yanıtı</div>
                                        {selectedTicket.repliedAt ? (
                                            <div className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                                                {new Date(selectedTicket.repliedAt).toLocaleString("tr-TR")}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="mt-3 text-blue-900 font-medium leading-relaxed whitespace-pre-wrap">{selectedTicket.reply}</div>
                                </div>
                            ) : (
                                <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Yanıt</div>
                                    <div className="mt-3 text-slate-600 font-medium">Bu talep için henüz yanıt yok.</div>
                                </div>
                            )}

                            {selectedTicket.status !== "closed" && (
                                <div className="rounded-[2rem] border border-slate-100 bg-white p-6">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mesaj Yaz</div>
                                    <div className="mt-3 space-y-3">
                                        <Textarea
                                            placeholder="Destek ekibine ek bilgi/cevap yaz..."
                                            className="min-h-[120px] rounded-[2rem] bg-slate-50 border-transparent focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-lg p-6 leading-relaxed"
                                            value={followupText}
                                            onChange={(e) => setFollowupText(e.target.value)}
                                        />
                                        <Button
                                            type="button"
                                            disabled={followupSending || !followupText.trim()}
                                            className="w-full bg-slate-900 hover:bg-black text-white h-14 rounded-[2rem] text-sm font-black uppercase tracking-widest"
                                            onClick={async () => {
                                                if (!user) return;
                                                if (!selectedTicket) return;
                                                const ticketIdNum = Number(selectedTicket.id);
                                                if (!Number.isFinite(ticketIdNum)) return;
                                                setFollowupSending(true);
                                                try {
                                                    const ins = await supabase
                                                        .from("support_ticket_replies")
                                                        .insert({
                                                            ticket_id: ticketIdNum,
                                                            author_role: "user",
                                                            message: followupText,
                                                        });
                                                    if (ins.error) throw ins.error;

                                                    const touch = await supabase
                                                        .from("support_tickets")
                                                        .update({ status: "open" })
                                                        .eq("id", ticketIdNum);
                                                    if (touch.error) console.error("Support ticket status touch error:", touch.error);

                                                    setFollowupText("");
                                                    await reloadTickets();
                                                } catch (e: any) {
                                                    console.error("Support followup insert error:", e);
                                                    alert(e?.message ? String(e.message) : "Mesaj gönderilemedi.");
                                                } finally {
                                                    setFollowupSending(false);
                                                }
                                            }}
                                        >
                                            Mesajı Gönder
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                }
            `}</style>
        </div>
    );
}
