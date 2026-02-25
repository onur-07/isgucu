"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Handshake, MessageCircle, Paperclip, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { displayUsername, friendlySupabaseError, sanitizeMessage, usernameFold, usernameKey } from "@/lib/utils";

type InboxItem = {
    otherKey: string;
    otherRaw: string;
    lastText: string;
    lastAt: string;
    unreadCount: number;
};

type ChatMessage = {
    id: string | number;
    sender_username: string;
    receiver_username: string;
    text: string | null;
    file_data?: any;
    read: boolean | null;
    created_at: string;
};

type OfferRow = {
    id: string | number;
    sender_id: string;
    receiver_id: string;
    sender_username: string;
    receiver_username: string;
    message: string | null;
    price: number | string;
    delivery_days: number | string;
    status: "pending" | "accepted" | "rejected" | "cancelled" | string;
    created_at: string;
    responded_at: string | null;
};

type TimelineItem =
    | { type: "message"; id: string; at: number; data: ChatMessage }
    | { type: "offer"; id: string; at: number; data: OfferRow };

type IncomingToast = {
    sender: string;
    text: string;
    at: number;
};

export function ChatWidget() {
    const { user, loading } = useAuth();
    const meKey = usernameKey(user?.username || "");
    const meFold = usernameFold(user?.username || "");

    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<InboxItem[]>([]);
    const [activeOther, setActiveOther] = useState<string>("");
    const [activeOtherId, setActiveOtherId] = useState<string>("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [offers, setOffers] = useState<OfferRow[]>([]);
    const [avatarMap, setAvatarMap] = useState<Record<string, string>>({});
    const [text, setText] = useState("");
    const [error, setError] = useState("");
    const [sending, setSending] = useState(false);
    const [toast, setToast] = useState<IncomingToast | null>(null);

    const [offerOpen, setOfferOpen] = useState(false);
    const [offerPrice, setOfferPrice] = useState("");
    const [offerDays, setOfferDays] = useState("");
    const [offerNote, setOfferNote] = useState("");

    const listRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const composerRef = useRef<HTMLTextAreaElement | null>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevUnreadRef = useRef<number>(0);
    const inboxInFlight = useRef(false);
    const threadInFlight = useRef(false);

    const withTimeout = async <T,>(p: PromiseLike<T>, ms: number, label: string): Promise<T> => {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        try {
            return await Promise.race([
                Promise.resolve(p),
                new Promise<T>((_, reject) => {
                    timeoutId = setTimeout(() => reject(new Error(`${label} zaman aşımına uğradı (${ms}ms)`)), ms);
                }),
            ]);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    };

    const showToast = (sender: string, text: string) => {
        setToast({ sender, text, at: Date.now() });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 3000);
    };

    const scrollToBottom = () => {
        const el = listRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    };

    const insertMessageRest = async (
        payload: { sender_username: string; receiver_username: string; text?: string | null; file_data?: any; read: boolean },
        timeoutMs: number = 15000
    ) => {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
        if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase env eksik");

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const accessToken = data?.session?.access_token;
        if (!accessToken) throw new Error("token yok");

        const controller = new AbortController();
        const fetchPromise = fetch(`${supabaseUrl}/rest/v1/messages`, {
            method: "POST",
            headers: {
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
                Prefer: "return=minimal",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        let timeoutId: number | null = null;
        const timeoutPromise = new Promise<Response>((_, reject) => {
            timeoutId = window.setTimeout(() => {
                try {
                    controller.abort();
                } catch {}
                reject(new Error(`Network timeout (${timeoutMs}ms)`));
            }, timeoutMs);
        });

        try {
            const res = (await Promise.race([fetchPromise, timeoutPromise])) as Response;
            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                throw new Error(txt || `HTTP ${res.status}`);
            }
            return true;
        } finally {
            if (timeoutId) window.clearTimeout(timeoutId);
        }
    };

    const fetchInbox = async () => {
        if (!meKey) return;
        if (inboxInFlight.current) return;
        inboxInFlight.current = true;

        try {
            const res = (await withTimeout(
                supabase
                    .from("messages")
                    .select("id, sender_username, receiver_username, text, read, created_at")
                    .or(`sender_username.ilike.${meKey},receiver_username.ilike.${meKey},sender_username.ilike.${meFold},receiver_username.ilike.${meFold}`)
                    .order("created_at", { ascending: false })
                    .limit(120),
                8000,
                "Mesajlar"
            )) as any;

            if (res?.error) return;
            const data = res?.data || [];
            const byOther = new Map<string, InboxItem>();

            let unread = 0;
            for (const m of data) {
                const senderRaw = String(m?.sender_username || "");
                const receiverRaw = String(m?.receiver_username || "");
                const sender = usernameKey(senderRaw);
                const receiver = usernameKey(receiverRaw);
                const otherKey = sender === meKey ? receiver : sender;
                if (!otherKey) continue;

                const otherRaw = sender === meKey ? receiverRaw : senderRaw;

                const isUnread = receiver === meKey && !m?.read;
                if (isUnread) unread += 1;

                if (!byOther.has(otherKey)) {
                    byOther.set(otherKey, {
                        otherKey,
                        otherRaw,
                        lastText: String(m?.text || "(dosya/teklif)"),
                        lastAt: String(m?.created_at || ""),
                        unreadCount: isUnread ? 1 : 0,
                    });
                } else {
                    const ex = byOther.get(otherKey)!;
                    if (isUnread) ex.unreadCount += 1;
                }
            }

            const nextItems = Array.from(byOther.values());
            setItems(nextItems);

            const prev = prevUnreadRef.current;
            prevUnreadRef.current = unread;
            if (unread > prev) {
                const latest = nextItems.find((x) => x.unreadCount > 0);
                if (latest) showToast(latest.otherRaw, latest.lastText);
            }
        } finally {
            inboxInFlight.current = false;
        }
    };

    const fetchThread = async (other: string) => {
        if (!meKey || !other) return;
        if (threadInFlight.current) return;
        threadInFlight.current = true;

        try {
            const otherKey = usernameKey(other);
            const otherFold = usernameFold(other);
            const threadOr = [
                `and(sender_username.ilike.${meKey},receiver_username.ilike.${otherKey})`,
                `and(sender_username.ilike.${otherKey},receiver_username.ilike.${meKey})`,
                `and(sender_username.ilike.${meFold},receiver_username.ilike.${otherFold})`,
                `and(sender_username.ilike.${otherFold},receiver_username.ilike.${meFold})`,
            ].join(",");

            const [msgRes, offerRes, otherProfileRes] = await Promise.all([
                withTimeout(
                    supabase
                        .from("messages")
                        .select("id, sender_username, receiver_username, text, file_data, read, created_at")
                        .or(threadOr)
                        .order("created_at", { ascending: true })
                        .limit(80),
                    8000,
                    "Sohbet"
                ),
                withTimeout(
                    supabase
                        .from("offers")
                        .select("id, sender_id, receiver_id, sender_username, receiver_username, message, price, delivery_days, status, created_at, responded_at")
                        .or(
                            `and(sender_username.ilike.${meKey},receiver_username.ilike.${otherKey}),and(sender_username.ilike.${otherKey},receiver_username.ilike.${meKey}),and(sender_username.ilike.${meFold},receiver_username.ilike.${otherFold}),and(sender_username.ilike.${otherFold},receiver_username.ilike.${meFold})`
                        )
                        .order("created_at", { ascending: true })
                        .limit(40),
                    8000,
                    "Teklifler"
                ),
                withTimeout(
                    supabase
                        .from("profiles")
                        .select("id, username")
                        .or(`username.ilike.${otherFold},username.ilike.${otherKey}`)
                        .limit(1)
                        .maybeSingle(),
                    8000,
                    "Kullanıcı"
                ),
            ]);

            if (!(msgRes as any)?.error && Array.isArray((msgRes as any)?.data)) {
                setMessages((msgRes as any).data as any);
            }
            if (!(offerRes as any)?.error && Array.isArray((offerRes as any)?.data)) {
                setOffers((offerRes as any).data as any);
            }
            const otherProfile = (otherProfileRes as any)?.data;
            setActiveOtherId(otherProfile?.id ? String(otherProfile.id) : "");
            setTimeout(scrollToBottom, 0);
        } finally {
            threadInFlight.current = false;
        }
    };

    useEffect(() => {
        if (loading) return;
        if (!meKey) {
            setOpen(false);
            setItems([]);
            setActiveOther("");
            setMessages([]);
            setToast(null);
            prevUnreadRef.current = 0;
            return;
        }

        fetchInbox();
        const intervalId = window.setInterval(() => {
            fetchInbox();
        }, 15000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [loading, meKey, meFold]);

    useEffect(() => {
        if (!meKey) return;

        const channel = supabase
            .channel(`chat-widget-${meKey}`)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
                const row = payload.new as any;
                const receiver = usernameKey(row?.receiver_username || "");
                const sender = usernameKey(row?.sender_username || "");

                if (receiver !== meKey && sender !== meKey) return;

                fetchInbox();
                if (activeOther) {
                    const otherKey = usernameKey(activeOther);
                    const isThisThread = (sender === meKey && receiver === otherKey) || (sender === otherKey && receiver === meKey);
                    if (isThisThread) {
                        setMessages((prev) => {
                            const exists = prev.some((m) => String(m.id) === String(row?.id));
                            if (exists) return prev;
                            return [...prev, row as ChatMessage];
                        });
                        setTimeout(scrollToBottom, 0);
                    }
                }
            })
            .subscribe();

        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            supabase.removeChannel(channel);
        };
    }, [meKey, activeOther]);

    useEffect(() => {
        if (!activeOther) return;
        fetchThread(activeOther);
    }, [activeOther]);

    useEffect(() => {
        if (!items.length) return;
        let cancelled = false;

        const missing = items.map((x) => x.otherKey).filter(Boolean).filter((k) => !avatarMap[k]);
        if (missing.length === 0) return;

        const run = async () => {
            const unique = Array.from(new Set(missing)).slice(0, 50);
            const ors = unique
                .flatMap((k) => {
                    const raw = items.find((x) => x.otherKey === k)?.otherRaw || k;
                    const f = usernameFold(raw);
                    return [`username.ilike.${raw}`, `username.ilike.${k}`, `username.ilike.${f}`];
                })
                .join(",");

            const res = await supabase
                .from("profiles")
                .select("username, avatar_url")
                .or(ors)
                .limit(50);

            if (cancelled) return;
            if (res?.error || !Array.isArray((res as any)?.data)) return;

            setAvatarMap((prev) => {
                const next = { ...prev };
                for (const row of (res as any).data) {
                    const key = usernameKey(String(row?.username || ""));
                    const url = String(row?.avatar_url || "");
                    if (key && url) next[key] = url;
                }
                return next;
            });
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [items]);

    useEffect(() => {
        if (!open) return;
        if (!activeOther) return;
        const id = window.setTimeout(() => {
            try {
                composerRef.current?.focus();
            } catch {}
        }, 0);
        return () => window.clearTimeout(id);
    }, [open, activeOther]);

    const timeline = useMemo(() => {
        const items: TimelineItem[] = [];
        for (const m of messages) {
            const at = new Date(String(m.created_at || 0)).getTime() || 0;
            items.push({ type: "message", id: `m-${String(m.id)}`, at, data: m });
        }
        for (const o of offers) {
            const at = new Date(String(o.created_at || 0)).getTime() || 0;
            items.push({ type: "offer", id: `o-${String(o.id)}`, at, data: o });
        }
        items.sort((a, b) => a.at - b.at);
        return items;
    }, [messages, offers]);

    const unreadTotal = useMemo(() => items.reduce((acc, x) => acc + (x.unreadCount || 0), 0), [items]);

    const handleSend = async () => {
        if (!meKey || !activeOther) return;
        const trimmed = text.trim();
        if (!trimmed) return;

        const mod = sanitizeMessage(trimmed);
        if (!mod.allowed) {
            setError(mod.reason || "Bu içerik gönderilemez");
            return;
        }

        setSending(true);
        setError("");

        const otherKey = usernameKey(activeOther);
        const payload = {
            sender_username: meKey,
            receiver_username: otherKey,
            text: mod.cleanedText || trimmed,
            read: false,
        };

        const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const optimistic: ChatMessage = {
            id: tempId,
            sender_username: meKey,
            receiver_username: otherKey,
            text: mod.cleanedText || trimmed,
            read: true,
            created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimistic]);
        setText("");

        try {
            await withTimeout(insertMessageRest(payload as any, 20000), 20000, "Mesaj gönderme");
            setError("");
        } catch (e: any) {
            setMessages((prev) => prev.filter((m) => String(m.id) !== String(tempId)));
            setError(friendlySupabaseError(e, "Mesaj gönderilemedi"));
        } finally {
            setSending(false);
        }
    };

    const handlePickFile = () => {
        fileInputRef.current?.click();
    };

    const handleUploadFile = async (file: File) => {
        if (!meKey || !activeOther) return;
        setSending(true);
        setError("");

        const otherKey = usernameKey(activeOther);

        const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const optimistic: ChatMessage = {
            id: tempId,
            sender_username: meKey,
            receiver_username: otherKey,
            text: null,
            file_data: { name: file.name, size: file.size, contentType: file.type, uploading: true },
            read: true,
            created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimistic]);

        try {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "file";
            const path = `threads/${meKey}__${otherKey}/${Date.now()}_${safeName}`;
            const bytes = new Uint8Array(await file.arrayBuffer());

            const up = await withTimeout(
                supabase.storage.from("chat-files").upload(path, bytes, { contentType: file.type || "application/octet-stream" }),
                20000,
                "Dosya yükleme"
            );
            if ((up as any)?.error) throw (up as any).error;

            const { data: pub } = supabase.storage.from("chat-files").getPublicUrl(path);
            const url = String((pub as any)?.publicUrl || "");
            if (!url) throw new Error("Dosya URL alınamadı");

            const payload = {
                sender_username: meKey,
                receiver_username: otherKey,
                text: null,
                file_data: { name: file.name, size: file.size, contentType: file.type || "application/octet-stream", url, path },
                read: false,
            };

            await withTimeout(insertMessageRest(payload as any, 20000), 20000, "Dosya mesajı");
            setError("");
        } catch (e: any) {
            setMessages((prev) => prev.filter((m) => String(m.id) !== String(tempId)));
            const msg = e?.message ? String(e.message) : "Dosya gönderilemedi";
            if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("bucket")) {
                setError("Dosya gönderilemedi: Supabase Storage'da 'chat-files' bucket yok. Supabase -> Storage -> New bucket: chat-files (Public) oluştur.");
            } else {
                setError(friendlySupabaseError(e, msg));
            }
        } finally {
            setSending(false);
        }
    };

    const handleSendOffer = async () => {
        if (!user?.id || !activeOtherId || !meKey || !activeOther) return;
        const otherKey = usernameKey(activeOther);

        const price = Number(String(offerPrice || "").replace(",", "."));
        const days = Number(String(offerDays || "").trim());
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(days) || days <= 0) {
            setError("Teklif için fiyat ve teslim günü gir.");
            return;
        }

        if (offerNote.trim()) {
            const noteMod = sanitizeMessage(offerNote.trim());
            if (!noteMod.allowed) {
                setError(noteMod.reason || "Bu içerik gönderilemez");
                return;
            }
        }

        setSending(true);
        setError("");
        try {
            const payload = {
                gig_id: null,
                sender_id: user.id,
                receiver_id: activeOtherId,
                sender_username: meKey,
                receiver_username: otherKey,
                message: offerNote.trim() || null,
                price,
                delivery_days: days,
                extras: null,
                status: "pending",
            };

            const res = (await withTimeout(
                supabase.from("offers").insert([payload]).select("id").maybeSingle(),
                15000,
                "Teklif gönderme"
            )) as any;
            if (res?.error) throw res.error;

            setOfferOpen(false);
            setOfferPrice("");
            setOfferDays("");
            setOfferNote("");
            await fetchThread(activeOther);
        } catch (e: any) {
            setError(friendlySupabaseError(e, "Teklif gönderilemedi"));
        } finally {
            setSending(false);
        }
    };

    if (loading) return null;
    if (!meKey) return null;

    return (
        <>
            {toast && !open && (
                <div className="fixed bottom-24 right-6 z-[60] w-[320px] max-w-[85vw] rounded-2xl border bg-white shadow-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Yeni Mesaj</div>
                    <div className="mt-1 text-sm font-bold text-gray-900 truncate">{displayUsername(toast.sender)}</div>
                    <div className="mt-1 text-xs text-gray-600 line-clamp-2">{toast.text || "(içerik)"}</div>
                </div>
            )}

            {open && (
                <div className="fixed bottom-24 right-6 z-[70] w-[380px] max-w-[92vw] h-[520px] max-h-[70vh]">
                    <Card className="h-full overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-white">
                            <div className="min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sohbet</div>
                                <div className="text-sm font-bold text-gray-900 truncate">{activeOther ? displayUsername(activeOther) : "Mesajlar"}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                {activeOther && (
                                    <Link href={`/messages/${encodeURIComponent(activeOther)}`}>
                                        <Button className="bg-gray-200 hover:bg-gray-300 text-gray-900">Tam ekran</Button>
                                    </Link>
                                )}
                                <Button onClick={() => setOpen(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-900">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="flex h-[calc(100%-56px)] min-h-0">
                            <div className="w-[150px] border-r bg-white overflow-auto">
                                {items.length === 0 ? (
                                    <div className="p-3 text-xs font-semibold text-gray-500">Henüz mesaj yok.</div>
                                ) : (
                                    <div className="p-2 grid gap-2">
                                        {items.map((c) => (
                                            <button
                                                key={c.otherKey}
                                                onClick={() => setActiveOther(c.otherRaw)}
                                                className={`text-left rounded-xl p-2 border transition-colors ${
                                                    usernameKey(activeOther) === c.otherKey ? "bg-blue-50 border-blue-100" : "bg-white hover:bg-gray-50 border-gray-100"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="h-8 w-8 rounded-full bg-gray-100 border flex items-center justify-center overflow-hidden shrink-0">
                                                            {avatarMap[c.otherKey] ? (
                                                                <img
                                                                    src={avatarMap[c.otherKey]}
                                                                    alt=""
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="text-[10px] font-black text-gray-600">
                                                                    {displayUsername(c.otherRaw).charAt(0).toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-xs font-black text-gray-900 truncate">{displayUsername(c.otherRaw)}</div>
                                                    </div>
                                                    {c.unreadCount > 0 && (
                                                        <div className="h-5 min-w-5 px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                                                            {c.unreadCount}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="mt-1 text-[11px] text-gray-500 line-clamp-2">{c.lastText || ""}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
                                <div ref={listRef} className="flex-1 overflow-auto p-3 space-y-2 min-h-0">
                                    {activeOther ? (
                                        timeline.length === 0 ? (
                                            <div className="text-xs font-semibold text-gray-500">Mesaj yok.</div>
                                        ) : (
                                            timeline.map((it) => {
                                                if (it.type === "message") {
                                                    const m = it.data;
                                                    const mine = usernameKey(m.sender_username) === meKey;
                                                    const fd = (m as any)?.file_data;
                                                    const isFile = !!fd?.url;
                                                    return (
                                                        <div key={it.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                                                            <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? "bg-blue-600 text-white" : "bg-white border text-gray-900"}`}>
                                                                {isFile ? (
                                                                    <a className={`text-xs font-black underline break-all ${mine ? "text-white" : "text-blue-600"}`} href={String(fd.url)} target="_blank" rel="noreferrer">
                                                                        {String(fd.name || "dosya")}
                                                                    </a>
                                                                ) : (
                                                                    <div className="text-xs font-semibold whitespace-pre-wrap break-words">{m.text || ""}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                const o = it.data;
                                                const mine = usernameKey(o.sender_username) === meKey;
                                                return (
                                                    <div key={it.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                                                        <div className={`max-w-[92%] rounded-2xl px-3 py-2 border ${mine ? "bg-blue-50 border-blue-100" : "bg-white border-gray-200"}`}>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Teklif</div>
                                                                <div className="text-[10px] font-black text-gray-500">{String(o.status || "pending")}</div>
                                                            </div>
                                                            <div className="mt-2 grid grid-cols-2 gap-2">
                                                                <div className="rounded-xl bg-gray-50 p-2">
                                                                    <div className="text-[10px] font-black text-gray-400">Fiyat</div>
                                                                    <div className="text-xs font-black">{String(o.price)} ₺</div>
                                                                </div>
                                                                <div className="rounded-xl bg-gray-50 p-2">
                                                                    <div className="text-[10px] font-black text-gray-400">Teslim</div>
                                                                    <div className="text-xs font-black">{String(o.delivery_days)} gün</div>
                                                                </div>
                                                            </div>
                                                            {o.message && <div className="mt-2 text-xs font-semibold text-gray-700 whitespace-pre-wrap break-words">{o.message}</div>}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )
                                    ) : (
                                        <div className="text-xs font-semibold text-gray-500">Soldan bir konuşma seç.</div>
                                    )}
                                </div>

                                {error && <div className="px-3 pb-2 text-[11px] font-black text-red-600">{error}</div>}

                                <div className="p-3 border-t bg-white relative z-10 pointer-events-auto">
                                    <div className="grid gap-2">
                                        {offerOpen && (
                                            <div className="rounded-2xl border bg-white p-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Teklif</div>
                                                    <Button onClick={() => setOfferOpen(false)} disabled={sending} className="bg-gray-200 hover:bg-gray-300 text-gray-900">
                                                        Kapat
                                                    </Button>
                                                </div>
                                                <div className="mt-2 grid grid-cols-2 gap-2">
                                                    <input
                                                        value={offerPrice}
                                                        onChange={(e) => setOfferPrice(e.target.value)}
                                                        placeholder="Fiyat (₺)"
                                                        className="h-9 rounded-xl border px-3 text-xs font-semibold"
                                                        disabled={sending}
                                                    />
                                                    <input
                                                        value={offerDays}
                                                        onChange={(e) => setOfferDays(e.target.value)}
                                                        placeholder="Teslim (gün)"
                                                        className="h-9 rounded-xl border px-3 text-xs font-semibold"
                                                        disabled={sending}
                                                    />
                                                </div>
                                                <Textarea
                                                    value={offerNote}
                                                    onChange={(e) => setOfferNote(e.target.value)}
                                                    placeholder="Not (opsiyonel)"
                                                    className="mt-2 min-h-[60px] resize-none bg-white"
                                                    disabled={sending}
                                                />
                                                <div className="mt-2 flex justify-end">
                                                    <Button onClick={handleSendOffer} disabled={sending || !activeOtherId} className="bg-blue-600 hover:bg-blue-700 text-white">
                                                        Teklifi Gönder
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            className="hidden"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (f) handleUploadFile(f);
                                                e.currentTarget.value = "";
                                            }}
                                        />

                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handlePickFile}
                                                    disabled={sending || !activeOther}
                                                    className="h-9 w-9 rounded-xl border bg-white hover:bg-gray-50 flex items-center justify-center disabled:opacity-50"
                                                    aria-label="Dosya"
                                                >
                                                    <Paperclip className="h-4 w-4 text-gray-700" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setOfferOpen((v) => !v)}
                                                    disabled={sending || !activeOther}
                                                    className="h-9 w-9 rounded-xl border bg-white hover:bg-gray-50 flex items-center justify-center disabled:opacity-50"
                                                    aria-label="Teklif"
                                                >
                                                    <Handshake className="h-4 w-4 text-gray-700" />
                                                </button>
                                            </div>
                                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                                {activeOther ? "" : "Konuşma seç"}
                                            </div>
                                        </div>

                                        <Textarea
                                            ref={composerRef}
                                            value={text}
                                            onChange={(e) => setText(e.target.value)}
                                            placeholder={activeOther ? "Mesaj yaz..." : "Önce konuşma seç"}
                                            className="min-h-[60px] resize-none bg-white"
                                            disabled={sending || !activeOther}
                                        />
                                        <div className="flex justify-end">
                                            <Button
                                                onClick={handleSend}
                                                disabled={sending || !activeOther || !text.trim()}
                                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                            >
                                                {sending ? "Gönderiliyor..." : "Gönder"}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            <div className="fixed bottom-6 right-6 z-[60]">
                <Button
                    onClick={() => setOpen((v) => !v)}
                    className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-200 relative"
                >
                    <MessageCircle className="h-6 w-6" />
                    {unreadTotal > 0 && (
                        <span className="absolute -top-1 -right-1 h-6 min-w-6 px-2 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                            {unreadTotal}
                        </span>
                    )}
                </Button>
            </div>
        </>
    );
}
