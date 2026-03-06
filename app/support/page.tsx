"use client";

import { useAuth } from "@/components/auth/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import { Headphones, Send, CheckCircle2, MessageCircle, ShieldCheck, Clock, AlertCircle, FileText, ChevronRight, Paperclip, X } from "lucide-react";
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
    replies?: Array<SupportTicketReply>;
}

interface SupportTicketReply {
    id: string;
    message: string;
    createdAt: string;
    authorRole: "admin" | "user";
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
const SUPPORT_ATTACHMENTS_BUCKET = "support_attachments";

export default function SupportPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [submitted, setSubmitted] = useState(false);
    const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [submitError, setSubmitError] = useState<string>("");
    const [form, setForm] = useState({
        subject: "",
        category: "",
        message: "",
    });
    const [uploading, setUploading] = useState(false);
    const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const uploadSupportAttachment = async (file: File) => {
        if (!user) throw new Error("Giriş yapmanız gerekiyor.");
        const type = String(file.type || "");
        const isPdf = type === "application/pdf";
        const isImg = type.startsWith("image/");
        if (!isPdf && !isImg) throw new Error("Sadece resim veya PDF yükleyebilirsiniz.");
        if (file.size > 10 * 1024 * 1024) throw new Error("Dosya boyutu 10MB'dan küçük olmalı.");

        const safeName = String(file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${String(user.id)}/new-ticket/${Date.now()}-${safeName}`;

        setUploading(true);
        try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            const up = await supabase.storage.from(SUPPORT_ATTACHMENTS_BUCKET).upload(path, bytes, {
                upsert: false,
                contentType: file.type || "application/octet-stream",
                cacheControl: "3600",
            });
            if (up.error) throw up.error;

            const pub = supabase.storage.from(SUPPORT_ATTACHMENTS_BUCKET).getPublicUrl(path);
            const url = String(pub?.data?.publicUrl || "");
            if (!url) throw new Error("Dosya linki alınamadı.");
            return url;
        } finally {
            setUploading(false);
        }
    };

    const onPickAttachment = () => fileInputRef.current?.click();

    const onAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const url = await uploadSupportAttachment(file);
            setAttachmentUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));
        } catch (err: any) {
            alert(err?.message ? String(err.message) : "Dosya yüklenemedi.");
        } finally {
            e.target.value = "";
        }
    };

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
                            const normalizedRows = rows as any[];
                            const hasAdmin = normalizedRows.some((rr) => rr?.authorRole === "admin");
                            if (!hasAdmin && t.reply) {
                                normalizedRows.push({
                                    id: `legacy-${String(t.id)}`,
                                    message: String(t.reply),
                                    createdAt: t.repliedAt || t.createdAt,
                                    authorRole: "admin",
                                });
                            }
                            t.replies = normalizedRows as any;
                            const last = normalizedRows[normalizedRows.length - 1];
                            if (!t.reply && last?.message) t.reply = String(last.message);
                        } else if (t.reply) {
                            t.replies = [{ id: String(t.id), message: t.reply, createdAt: t.repliedAt || t.createdAt, authorRole: "admin" }];
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
                                const normalizedRows = rows as any[];
                                const hasAdmin = normalizedRows.some((rr) => rr?.authorRole === "admin");
                                if (!hasAdmin && t.reply) {
                                    normalizedRows.push({
                                        id: `legacy-${String(t.id)}`,
                                        message: String(t.reply),
                                        createdAt: t.repliedAt || t.createdAt,
                                        authorRole: "admin",
                                    });
                                }
                                t.replies = normalizedRows as any;
                                const last = normalizedRows[normalizedRows.length - 1];
                                if (!t.reply && last?.message) t.reply = String(last.message);
                            } else if (t.reply) {
                                t.replies = [{ id: String(t.id), message: t.reply, createdAt: t.repliedAt || t.createdAt, authorRole: "admin" }];
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

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitError("");

    try {
        const composedMessage = [
            String(form.message || "").trim(),
            ...attachmentUrls,
        ].filter(Boolean).join("\n");

        const insertRes = await supabase
            .from("support_tickets")
            .insert({
                from_user: user.username,
                from_email: user.email,
                subject: form.subject,
                category: form.category,
                message: composedMessage,
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
            message: String(t?.message || composedMessage),
            status: (String(t?.status || "open") as any) as SupportTicket["status"],
            createdAt: String(t?.created_at || new Date().toISOString()),
            reply: t?.reply ? String(t.reply) : undefined,
            repliedAt: t?.replied_at ? String(t.replied_at) : undefined,
        };

        setSubmitted(true);
        setMyTickets((prev) => [nextTicket, ...prev]);
        setForm({ subject: "", category: "", message: "" });
        setAttachmentUrls([]);
        setTimeout(() => setSubmitted(false), 5000);
    } catch (e: any) {
        console.error("Support ticket insert error:", e);
        setSubmitError(e?.message ? String(e.message) : "Destek talebi gönderilemedi.");
    }
};

if (!user) return null;

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

                <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 uppercase tracking-tighter italic">
                    Destek
                </h1>
                <p className="text-white/50 text-base sm:text-lg font-medium max-w-2xl mx-auto leading-relaxed">
                    Bir sorunun mu var? Talep oluştur, durumunu takip et ve destek ekibiyle yazış.
                </p>
            </div>
        </div>

        <div className="container mx-auto px-4 -mt-16 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white rounded-[3rem] p-8 sm:p-10 shadow-xl shadow-slate-200 border border-slate-100">
                    <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Yeni Destek Talebi</h2>
                            <p className="text-slate-500 text-sm font-medium">Konu ve mesajı yaz, ekibimiz dönüş yapsın.</p>
                        </div>
                        <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <ShieldCheck className="h-4 w-4" /> Güvenli Destek
                        </div>
                    </div>

                    {submitError ? (
                        <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-5 py-4">
                            <div className="flex items-center gap-2 text-red-600 font-black text-sm">
                                <AlertCircle className="h-5 w-5" /> {submitError}
                            </div>
                        </div>
                    ) : null}

                    {submitted ? (
                        <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4">
                            <div className="flex items-center gap-2 text-emerald-700 font-black text-sm">
                                <CheckCircle2 className="h-5 w-5" /> Talebiniz alındı.
                            </div>
                        </div>
                    ) : null}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Konu</Label>
                            <Input
                                value={form.subject}
                                onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                                className="h-14 rounded-[2rem] border-slate-200 font-semibold px-6"
                                placeholder="Örn: Ödeme sorunu"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Kategori</Label>
                            <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                                <SelectTrigger className="h-14 rounded-[2rem] border-slate-200 font-semibold px-6">
                                    <SelectValue placeholder="Kategori seç" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SUPPORT_CATEGORIES.map((c) => (
                                        <SelectItem key={c} value={c}>
                                            {c}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mesaj</Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*,application/pdf"
                                        className="hidden"
                                        onChange={onAttachmentChange}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-9 px-3 rounded-xl border-slate-200 text-slate-700 font-black uppercase tracking-widest text-[10px]"
                                        onClick={onPickAttachment}
                                        disabled={uploading}
                                    >
                                        <Paperclip className="h-4 w-4 mr-2" /> {uploading ? "Yükleniyor" : "Dosya Ekle"}
                                    </Button>
                                </div>
                            </div>
                            <Textarea
                                value={form.message}
                                onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                                className="min-h-[160px] rounded-[2rem] border-slate-200 font-medium px-6 py-5 leading-relaxed"
                                placeholder="Detayları yaz..."
                            />
                            {attachmentUrls.length > 0 ? (
                                <div className="space-y-2">
                                    {attachmentUrls.map((url) => (
                                        <div key={url} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                            <a href={url} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-700 truncate hover:underline">
                                                {url}
                                            </a>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                                                onClick={() => setAttachmentUrls((prev) => prev.filter((x) => x !== url))}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>

                        <Button
                            type="submit"
                            disabled={!form.subject.trim() || !form.category.trim() || !form.message.trim() || uploading}
                            className="w-full bg-slate-900 hover:bg-black text-white h-14 rounded-[2rem] text-sm font-black uppercase tracking-widest"
                        >
                            <Send className="h-5 w-5 mr-3" /> Gönder
                        </Button>
                    </form>
                </div>

                <div className="bg-white rounded-[3rem] p-8 sm:p-10 shadow-xl shadow-slate-200 border border-slate-100">
                    <div className="flex items-start justify-between gap-4 mb-8">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-1">Taleplerim</h3>
                            <p className="text-slate-500 text-sm font-medium">Taleplerine tıklayıp konuşmayı açabilirsin.</p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            className="rounded-2xl border-slate-200 text-slate-700 hover:bg-slate-50 font-black uppercase tracking-widest text-[10px] h-11 px-6"
                            onClick={() => reloadTickets()}
                            disabled={loadingTickets}
                        >
                            {loadingTickets ? "Yükleniyor" : "Yenile"}
                        </Button>
                    </div>

                    {loadingTickets ? (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center">
                            <div className="inline-flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase tracking-widest">
                                <Clock className="h-4 w-4" /> Yükleniyor...
                            </div>
                        </div>
                    ) : myTickets.length === 0 ? (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center">
                            <div className="inline-flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase tracking-widest">
                                <MessageCircle className="h-4 w-4" /> Henüz talep yok
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-[520px] overflow-y-auto pr-2 custom-scrollbar">
                            {myTickets.map((ticket) => (
                                <button
                                    key={ticket.id}
                                    type="button"
                                    onClick={() => router.push(`/support/${String(ticket.id)}`)}
                                    className="w-full text-left rounded-[2rem] p-6 border border-slate-100 hover:bg-slate-50 transition-all"
                                >
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                                            ticket.status === "open"
                                                ? "bg-amber-50 text-amber-700"
                                                : ticket.status === "replied"
                                                    ? "bg-blue-50 text-blue-700"
                                                    : "bg-slate-50 text-slate-500"
                                        }`}>
                                            {ticket.status === "open" ? "Bekliyor" : ticket.status === "replied" ? "Cevaplandı" : "Kapalı"}
                                        </span>

                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] text-slate-300 font-black">#{ticket.id}</span>
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-700">
                                                Aç <ChevronRight className="h-4 w-4" />
                                            </span>
                                        </div>
                                    </div>
                                    <div className="font-black text-slate-900 uppercase tracking-tight line-clamp-1">{ticket.subject}</div>
                                    <div className="mt-2 text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed">{ticket.message}</div>
                                    {ticket.reply ? (
                                        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                                            <div className="flex items-center gap-2 text-blue-700 text-[10px] font-black uppercase tracking-widest mb-2">
                                                <FileText className="h-4 w-4" /> Son Yanıt
                                            </div>
                                            <div className="text-xs text-blue-900 font-medium line-clamp-2">{ticket.reply}</div>
                                        </div>
                                    ) : null}
                                    <div className="mt-4 text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center justify-between">
                                        <span>{new Date(ticket.createdAt).toLocaleDateString("tr-TR")}</span>
                                        <span className="text-slate-500">{ticket.category}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>

        <style jsx>{`
            .custom-scrollbar::-webkit-scrollbar {
                width: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
                background: transparent;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
                background: rgba(15, 23, 42, 0.18);
                border-radius: 20px;
            }
        `}</style>
    </div>
);

}
