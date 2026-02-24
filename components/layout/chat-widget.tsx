"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { usernameFold, usernameKey } from "@/lib/utils";

type InboxItem = {
    otherUsername: string;
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
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [text, setText] = useState("");
    const [error, setError] = useState("");
    const [sending, setSending] = useState(false);
    const [toast, setToast] = useState<IncomingToast | null>(null);

    const listRef = useRef<HTMLDivElement | null>(null);
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

                const isUnread = receiver === meKey && !m?.read;
                if (isUnread) unread += 1;

                if (!byOther.has(otherKey)) {
                    byOther.set(otherKey, {
                        otherUsername: otherKey,
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
                if (latest) showToast(latest.otherUsername, latest.lastText);
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

            const res = (await withTimeout(
                supabase
                    .from("messages")
                    .select("id, sender_username, receiver_username, text, file_data, read, created_at")
                    .or(threadOr)
                    .order("created_at", { ascending: true })
                    .limit(80),
                8000,
                "Sohbet"
            )) as any;

            if (!res?.error && Array.isArray(res?.data)) {
                setMessages(res.data as any);
                setTimeout(scrollToBottom, 0);
            }
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

    const unreadTotal = useMemo(() => items.reduce((acc, x) => acc + (x.unreadCount || 0), 0), [items]);

    const handleSend = async () => {
        if (!meKey || !activeOther) return;
        const trimmed = text.trim();
        if (!trimmed) return;

        setSending(true);
        setError("");

        const otherKey = usernameKey(activeOther);
        const payload = {
            sender_username: meKey,
            receiver_username: otherKey,
            text: trimmed,
            read: false,
        };

        const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const optimistic: ChatMessage = {
            id: tempId,
            sender_username: meKey,
            receiver_username: otherKey,
            text: trimmed,
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
            setError(e?.message ? String(e.message) : "Mesaj gönderilemedi");
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
                    <div className="mt-1 text-sm font-bold text-gray-900 truncate">{toast.sender}</div>
                    <div className="mt-1 text-xs text-gray-600 line-clamp-2">{toast.text || "(içerik)"}</div>
                </div>
            )}

            {open && (
                <div className="fixed bottom-24 right-6 z-[70] w-[380px] max-w-[92vw] h-[520px] max-h-[70vh]">
                    <Card className="h-full overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-white">
                            <div className="min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sohbet</div>
                                <div className="text-sm font-bold text-gray-900 truncate">{activeOther || "Mesajlar"}</div>
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

                        <div className="grid grid-cols-[150px_1fr] h-[calc(100%-56px)]">
                            <div className="border-r bg-white overflow-auto">
                                {items.length === 0 ? (
                                    <div className="p-3 text-xs font-semibold text-gray-500">Henüz mesaj yok.</div>
                                ) : (
                                    <div className="p-2 grid gap-2">
                                        {items.map((c) => (
                                            <button
                                                key={c.otherUsername}
                                                onClick={() => setActiveOther(c.otherUsername)}
                                                className={`text-left rounded-xl p-2 border transition-colors ${
                                                    activeOther === c.otherUsername ? "bg-blue-50 border-blue-100" : "bg-white hover:bg-gray-50 border-gray-100"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-xs font-black text-gray-900 truncate">{c.otherUsername}</div>
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

                            <div className="flex flex-col bg-gray-50">
                                <div ref={listRef} className="flex-1 overflow-auto p-3 space-y-2">
                                    {activeOther ? (
                                        messages.length === 0 ? (
                                            <div className="text-xs font-semibold text-gray-500">Mesaj yok.</div>
                                        ) : (
                                            messages.map((m) => {
                                                const mine = usernameKey(m.sender_username) === meKey;
                                                return (
                                                    <div key={String(m.id)} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                                                        <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? "bg-blue-600 text-white" : "bg-white border text-gray-900"}`}>
                                                            <div className="text-xs font-semibold whitespace-pre-wrap break-words">{m.text || ""}</div>
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

                                <div className="p-3 border-t bg-white">
                                    <div className="grid gap-2">
                                        <Textarea
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
