"use client";

import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Clock, FileText, Paperclip, Send } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface SupportTicket {
    id: string;
    from_user: string;
    from_email: string;
    subject: string;
    category: string;
    message: string;
    status: "open" | "replied" | "closed";
    created_at: string;
    reply?: string;
    replied_at?: string;
}

interface SupportTicketReplyRow {
    id: string;
    ticket_id: string;
    author_role: "admin" | "user";
    message: string;
    created_at: string;
}

type UiReply = {
    id: string;
    authorRole: "admin" | "user";
    message: string;
    createdAt: string;
};

const BUCKET = "support_attachments";

const extractUrls = (text: string) => {
    const s = String(text || "");
    const matches = s.match(/https?:\/\/[^\s)\]]+/g);
    return Array.isArray(matches) ? matches : [];
};

const stripUrls = (text: string) => {
    const s = String(text || "");
    return s.replace(/https?:\/\/[^\s)\]]+/g, "").replace(/\n{3,}/g, "\n\n").trim();
};

const isImageUrl = (url: string) => {
    try {
        const parsed = new URL(String(url || ""));
        const p = decodeURIComponent(parsed.pathname || "").toLowerCase();
        return p.endsWith(".png") || p.endsWith(".jpg") || p.endsWith(".jpeg") || p.endsWith(".webp") || p.endsWith(".gif");
    } catch {
        const u = String(url || "").toLowerCase();
        return u.endsWith(".png") || u.endsWith(".jpg") || u.endsWith(".jpeg") || u.endsWith(".webp") || u.endsWith(".gif");
    }
};

const displayNameFromUrl = (url: string) => {
    try {
        const parsed = new URL(String(url || ""));
        const parts = decodeURIComponent(parsed.pathname || "").split("/").filter(Boolean);
        const last = parts[parts.length - 1] || url;
        return last.length > 60 ? `${last.slice(0, 20)}...${last.slice(-25)}` : last;
    } catch {
        return url;
    }
};

export default function SupportTicketDetailPage() {
    const { user } = useAuth();
    const params = useParams();
    const router = useRouter();

    const ticketId = useMemo(() => String((params as any)?.id || ""), [params]);

    const [ticket, setTicket] = useState<SupportTicket | null>(null);
    const [replies, setReplies] = useState<UiReply[]>([]);
    const [loading, setLoading] = useState(true);

    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);

    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const ticketIdNum = useMemo(() => {
        const n = Number(ticketId);
        return Number.isFinite(n) ? n : NaN;
    }, [ticketId]);

    const normalizeReplies = useCallback((t: SupportTicket | null, rows: SupportTicketReplyRow[]) => {
        const normalized: UiReply[] = (rows || []).map((r) => ({
            id: String(r.id),
            authorRole: r.author_role,
            message: String(r.message || ""),
            createdAt: String(r.created_at || ""),
        }));

        const hasAdmin = normalized.some((r) => r.authorRole === "admin");
        if (t && t.reply && !hasAdmin) {
            normalized.push({
                id: `legacy-${String(t.id)}`,
                authorRole: "admin",
                message: String(t.reply),
                createdAt: String(t.replied_at || t.created_at || ""),
            });
        }

        normalized.sort((a, b) => {
            const ta = new Date(String(a.createdAt || 0)).getTime();
            const tb = new Date(String(b.createdAt || 0)).getTime();
            return ta - tb;
        });

        return normalized;
    }, []);

    const load = useCallback(async () => {
        if (!user) return;
        if (!ticketId || !Number.isFinite(ticketIdNum)) {
            setTicket(null);
            setReplies([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const tRes = await supabase
                .from("support_tickets")
                .select("id, from_user, from_email, subject, category, message, status, created_at, reply, replied_at")
                .eq("id", ticketIdNum)
                .maybeSingle();
            if (tRes.error) throw tRes.error;

            const t = (tRes.data || null) as any as SupportTicket | null;
            setTicket(t);

            const rRes = await supabase
                .from("support_ticket_replies")
                .select("id, ticket_id, author_role, message, created_at")
                .eq("ticket_id", ticketIdNum)
                .order("created_at", { ascending: true });
            if (rRes.error) throw rRes.error;

            const rows = ((rRes.data || []) as any[]) as SupportTicketReplyRow[];
            setReplies(normalizeReplies(t, rows));
        } catch (e) {
            console.error("Support ticket detail load error:", e);
            setTicket(null);
            setReplies([]);
        } finally {
            setLoading(false);
        }
    }, [normalizeReplies, ticketId, ticketIdNum, user]);

    useEffect(() => {
        if (!user) {
            router.push("/login");
            return;
        }
        load();
    }, [user, router, load]);

    const onPickFile = () => {
        fileInputRef.current?.click();
    };

    const uploadFile = async (file: File) => {
        if (!user) throw new Error("Giriş yapmanız gerekiyor.");
        if (!Number.isFinite(ticketIdNum)) throw new Error("Geçersiz talep.");

        const type = String(file.type || "");
        const isPdf = type === "application/pdf";
        const isImg = type.startsWith("image/");
        if (!isPdf && !isImg) throw new Error("Sadece resim veya PDF yükleyebilirsiniz.");
        if (file.size > 10 * 1024 * 1024) throw new Error("Dosya boyutu 10MB'dan küçük olmalı.");

        const safeName = String(file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${String(user.id)}/${String(ticketIdNum)}/${Date.now()}-${safeName}`;

        setUploading(true);
        try {
            const up = await supabase.storage.from(BUCKET).upload(path, file, {
                upsert: false,
                contentType: file.type || undefined,
                cacheControl: "3600",
            });
            if (up.error) throw up.error;

            const pub = supabase.storage.from(BUCKET).getPublicUrl(path);
            const url = String(pub?.data?.publicUrl || "");
            if (!url) throw new Error("Dosya linki alınamadı.");
            return url;
        } finally {
            setUploading(false);
        }
    };

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const url = await uploadFile(file);
            setText((prev) => {
                const base = String(prev || "").trim();
                const addition = `\n${url}`;
                return base ? `${base}${addition}` : url;
            });
        } catch (err: any) {
            alert(err?.message ? String(err.message) : "Dosya yüklenemedi.");
        } finally {
            e.target.value = "";
        }
    };

    const send = async () => {
        if (!user) return;
        if (!ticket) return;
        if (!Number.isFinite(ticketIdNum)) return;
        if (!text.trim()) return;

        setSending(true);
        try {
            const ins = await supabase
                .from("support_ticket_replies")
                .insert({
                    ticket_id: ticketIdNum,
                    author_role: "user",
                    message: text,
                });
            if (ins.error) throw ins.error;

            const touch = await supabase
                .from("support_tickets")
                .update({ status: "open" })
                .eq("id", ticketIdNum);
            if (touch.error) console.error("Support ticket status touch error:", touch.error);

            setText("");
            await load();
        } catch (e: any) {
            console.error("Support followup insert error:", e);
            alert(e?.message ? String(e.message) : "Mesaj gönderilemedi.");
        } finally {
            setSending(false);
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            <div className="bg-slate-900 py-14">
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <Button
                            type="button"
                            variant="outline"
                            className="rounded-2xl border-white/20 !text-white hover:bg-white/10 hover:!text-white font-black uppercase tracking-widest text-[10px] h-11 px-6"
                            onClick={() => router.push("/support")}
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" /> Geri
                        </Button>
                        <div className="text-white/40 text-[10px] font-black uppercase tracking-widest">Destek Detayı</div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 -mt-8">
                <div className="bg-white rounded-[3rem] shadow-xl shadow-slate-200 border border-slate-100 overflow-hidden">
                    {loading ? (
                        <div className="p-10 text-center">
                            <div className="inline-flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase tracking-widest">
                                <Clock className="h-4 w-4" /> Yükleniyor...
                            </div>
                        </div>
                    ) : !ticket ? (
                        <div className="p-10 text-center">
                            <div className="text-slate-600 font-black uppercase tracking-widest text-[10px]">Talep bulunamadı.</div>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            <div className="p-8 sm:p-10 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">#{ticket.id}</div>
                                <div className="mt-2 text-2xl font-black text-slate-900 uppercase tracking-tight">{ticket.subject}</div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
                                        {ticket.category}
                                    </span>
                                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                                        ticket.status === "open"
                                            ? "bg-amber-50 text-amber-700"
                                            : ticket.status === "replied"
                                                ? "bg-blue-50 text-blue-700"
                                                : "bg-slate-50 text-slate-500"
                                    }`}>
                                        {ticket.status === "open" ? "Bekliyor" : ticket.status === "replied" ? "Cevaplandı" : "Kapalı"}
                                    </span>
                                    <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        {new Date(ticket.created_at).toLocaleString("tr-TR")}
                                    </span>
                                </div>
                            </div>

                            <div className="p-8 sm:p-10 space-y-6">
                                <div className="rounded-[2rem] border border-slate-100 bg-white p-6">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mesajın</div>
                                    <div className="mt-3 text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{ticket.message}</div>
                                </div>

                                <div className="rounded-[2rem] border border-blue-100 bg-blue-50/60 p-6">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-blue-700">Konuşma</div>
                                    <div className="mt-4 space-y-4">
                                        {replies.length === 0 ? (
                                            <div className="rounded-2xl border border-slate-100 bg-white p-4 text-slate-600 font-medium">Henüz mesaj yok.</div>
                                        ) : (
                                            replies.map((r) => {
                                                const urls = extractUrls(r.message);
                                                const body = stripUrls(r.message);
                                                return (
                                                    <div
                                                        key={r.id}
                                                        className={`rounded-2xl border p-4 ${
                                                            r.authorRole === "admin"
                                                                ? "bg-slate-900 border-slate-700"
                                                                : "bg-white border-slate-200"
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                                            <div
                                                                className={`text-[10px] font-black uppercase tracking-widest ${
                                                                    r.authorRole === "admin" ? "text-white" : "text-slate-700"
                                                                }`}
                                                            >
                                                                {r.authorRole === "user" ? "Sen" : "Destek"}
                                                            </div>
                                                            <div
                                                                className={`text-[10px] font-black uppercase tracking-widest ${
                                                                    r.authorRole === "admin" ? "text-white" : "text-slate-600"
                                                                }`}
                                                            >
                                                                {r.createdAt ? new Date(r.createdAt).toLocaleString("tr-TR") : ""}
                                                            </div>
                                                        </div>
                                                        <div
                                                            className={`mt-2 font-medium leading-relaxed whitespace-pre-wrap ${
                                                                r.authorRole === "admin" ? "text-white" : "text-slate-900"
                                                            }`}
                                                        >
                                                            {body || (urls.length > 0 ? "" : r.message)}
                                                        </div>

                                                        {urls.length > 0 ? (
                                                            <div className="mt-3 space-y-2">
                                                                {urls.map((u) => (
                                                                    <div key={u} className="rounded-xl border border-slate-200 bg-white/70 p-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <FileText className="h-4 w-4 text-slate-500" />
                                                                            <a
                                                                                href={u}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="text-sm font-bold text-blue-700 hover:underline break-all"
                                                                            >
                                                                                {displayNameFromUrl(u)}
                                                                            </a>
                                                                        </div>
                                                                        {isImageUrl(u) ? (
                                                                            // eslint-disable-next-line @next/next/no-img-element
                                                                            <img src={u} alt="Ek" className="mt-3 rounded-xl max-h-64 w-auto" />
                                                                        ) : null}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {ticket.status !== "closed" ? (
                                    <div className="rounded-[2rem] border border-slate-100 bg-white p-6">
                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mesaj Yaz</div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/*,application/pdf"
                                                    className="hidden"
                                                    onChange={onFileChange}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-10 px-4 rounded-2xl border-slate-200 text-slate-700 font-black uppercase tracking-widest text-[10px]"
                                                    onClick={onPickFile}
                                                    disabled={uploading}
                                                >
                                                    <Paperclip className="h-4 w-4 mr-2" /> {uploading ? "Yükleniyor" : "Dosya Ekle"}
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="mt-3 space-y-3">
                                            <Textarea
                                                placeholder="Destek ekibine ek bilgi/cevap yaz..."
                                                className="min-h-[140px] rounded-[2rem] bg-slate-50 border-transparent focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-lg p-6 leading-relaxed"
                                                value={text}
                                                onChange={(e) => setText(e.target.value)}
                                            />
                                            <Button
                                                type="button"
                                                disabled={sending || uploading || !text.trim()}
                                                className="w-full bg-slate-900 hover:bg-black text-white h-14 rounded-[2rem] text-sm font-black uppercase tracking-widest"
                                                onClick={send}
                                            >
                                                <Send className="h-5 w-5 mr-3" /> Mesajı Gönder
                                            </Button>
                                        </div>

                                        <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Dosya: resim veya PDF (max 10MB). Link mesajın içine eklenecek.
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-6">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Talep Kapalı</div>
                                        <div className="mt-2 text-slate-600 font-medium">Bu talep kapatılmış. Yeni bir talep açabilirsin.</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
