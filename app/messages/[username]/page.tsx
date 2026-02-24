"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-context";
import { sanitizeMessage, usernameFold, usernameKey } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = {
    id: string | number;
    sender_username: string;
    receiver_username: string;
    text: string | null;
    read: boolean | null;
    created_at: string;
};

export default function MessageThreadPage() {
    const router = useRouter();
    const params = useParams<{ username: string }>();
    const { user, loading } = useAuth();

    const otherUsername = useMemo(() => {
        const raw = params?.username ? String(params.username) : "";
        try {
            return decodeURIComponent(raw);
        } catch {
            return raw;
        }
    }, [params?.username]);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [text, setText] = useState<string>("");
    const [error, setError] = useState<string>("");
    const [sending, setSending] = useState<boolean>(false);
    const [pageLoading, setPageLoading] = useState<boolean>(true);
    const [realtimeReady, setRealtimeReady] = useState<boolean>(false);

    const listRef = useRef<HTMLDivElement | null>(null);
    const scrollRafRef = useRef<number | null>(null);

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

    const insertMessageRest = async (
        payload: { sender_username: string; receiver_username: string; text: string; read: boolean },
        timeoutMs: number = 15000
    ) => {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error("Supabase ortam değişkenleri eksik");
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const accessToken = data?.session?.access_token;
        if (!accessToken) throw new Error("Oturum bulunamadı (token yok)");

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
        } catch (e: any) {
            const name = e?.name ? String(e.name) : "";
            if (name === "AbortError") {
                throw new Error(`Network timeout (${timeoutMs}ms)`);
            }
            throw e;
        } finally {
            if (timeoutId) window.clearTimeout(timeoutId);
        }
    };

    const meFold = usernameFold(user?.username || "");
    const otherFold = usernameFold(otherUsername || "");
    const meKey = usernameKey(user?.username || "");
    const otherKey = usernameKey(otherUsername || "");

    const threadOr = useMemo(() => {
        const combos: Array<[string, string]> = [
            [meFold, otherFold],
            [meKey, otherKey],
            [meFold, otherKey],
            [meKey, otherFold],
        ];

        const clauses: string[] = [];
        for (const [a, b] of combos) {
            if (!a || !b) continue;
            clauses.push(`and(sender_username.ilike.${a},receiver_username.ilike.${b})`);
            clauses.push(`and(sender_username.ilike.${b},receiver_username.ilike.${a})`);
        }
        return clauses.join(",");
    }, [meFold, otherFold, meKey, otherKey]);

    const scrollToBottom = () => {
        const el = listRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    };

    const scheduleScrollToBottom = () => {
        if (scrollRafRef.current) return;
        scrollRafRef.current = window.requestAnimationFrame(() => {
            scrollRafRef.current = null;
            scrollToBottom();
        });
    };

    useEffect(() => {
        if (loading) return;
        if (user) return;

        let cancelled = false;
        const check = async () => {
            // Grace period: on hard refresh auth context may lag behind persisted session.
            await new Promise((r) => setTimeout(r, 400));
            if (cancelled) return;

            const { data } = await supabase.auth.getSession();
            if (cancelled) return;

            if (!data?.session) router.push("/login");
        };

        check();
        return () => {
            cancelled = true;
        };
    }, [loading, user, router]);

    useEffect(() => {
        const run = async () => {
            if (!meFold || !otherFold) {
                setMessages([]);
                setPageLoading(false);
                return;
            }

            setPageLoading(true);
            setError("");

            try {
                const res = (await withTimeout(
                    supabase
                        .from("messages")
                        .select("id, sender_username, receiver_username, text, read, created_at")
                        .or(threadOr)
                        .order("created_at", { ascending: true })
                        .limit(500),
                    12000,
                    "Mesaj geçmişi"
                )) as any;

                const data = res?.data;
                const fetchError = res?.error;
                if (fetchError) {
                    setError(fetchError.message);
                    setMessages([]);
                    return;
                }

                setMessages((data || []) as any);

                supabase
                    .from("messages")
                    .update({ read: true })
                    .or(`receiver_username.ilike.${meFold},receiver_username.ilike.${meKey}`)
                    .or(`sender_username.ilike.${otherFold},sender_username.ilike.${otherKey}`)
                    .eq("read", false)
                    .then(() => {});
            } catch (err: any) {
                setError(err?.message ? String(err.message) : "Mesajlar yüklenemedi");
                setMessages([]);
            } finally {
                setPageLoading(false);
            }
        };

        run();
    }, [meFold, otherFold, meKey, otherKey, threadOr]);

    useEffect(() => {
        if (!meFold || !otherFold) return;

        let cancelled = false;
        const tick = async () => {
            try {
                const res = (await withTimeout(
                    supabase
                        .from("messages")
                        .select("id, sender_username, receiver_username, text, read, created_at")
                        .or(threadOr)
                        .order("created_at", { ascending: true })
                        .limit(200),
                    8000,
                    "Mesaj senkron"
                )) as any;

                if (cancelled) return;
                const data = res?.data;
                const fetchError = res?.error;
                if (!fetchError && Array.isArray(data)) {
                    setMessages((prev) => {
                        const server = data as any[];
                        const temp = prev.filter((m) => String(m.id || "").startsWith("temp-"));
                        const serverHasTempEquivalent = (t: any) =>
                            server.some(
                                (s) =>
                                    usernameKey(s?.sender_username || "") === usernameKey(t?.sender_username || "") &&
                                    usernameKey(s?.receiver_username || "") === usernameKey(t?.receiver_username || "") &&
                                    String(s?.text || "") === String(t?.text || "") &&
                                    // same created_at is best, but allow small drift
                                    Math.abs(new Date(String(s?.created_at || 0)).getTime() - new Date(String(t?.created_at || 0)).getTime()) <= 15000
                            );

                        const merged = [...server, ...temp.filter((t) => !serverHasTempEquivalent(t))];
                        merged.sort((a: any, b: any) => new Date(String(a?.created_at || 0)).getTime() - new Date(String(b?.created_at || 0)).getTime());

                        const prevLast = prev.length ? String(prev[prev.length - 1]?.id) : "";
                        const nextLast = merged.length ? String(merged[merged.length - 1]?.id) : "";
                        if (prevLast === nextLast && prev.length === merged.length) return prev;
                        return merged as any;
                    });
                }
            } catch {
                // ignore polling errors
            }
        };

        // Polling is safety net; realtime should make the UI instant.
        const intervalId = window.setInterval(() => {
            tick();
        }, realtimeReady ? 12000 : 6000);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [meFold, otherFold, threadOr, realtimeReady]);

    useEffect(() => {
        if (!pageLoading) {
            setTimeout(scheduleScrollToBottom, 0);
        }
    }, [pageLoading]);

    useEffect(() => {
        setTimeout(scheduleScrollToBottom, 0);
    }, [messages.length]);

    useEffect(() => {
        if (!meFold || !meKey || !otherKey) return;

        let unsubscribed = false;
        const channel = supabase
            .channel(`messages-thread-${meKey}-${otherKey}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                },
                async (payload) => {
                    const row = payload.new as any;
                    const senderKey = usernameKey(row?.sender_username || "");
                    const receiverKey = usernameKey(row?.receiver_username || "");

                    const isThisThread =
                        (senderKey === meKey && receiverKey === otherKey) || (senderKey === otherKey && receiverKey === meKey);
                    if (!isThisThread) return;

                    console.log("[realtime] thread INSERT", { id: row?.id, sender: row?.sender_username, receiver: row?.receiver_username });

                    setMessages((prev) => {
                        const withoutTempDup = prev.filter((m) => {
                            const isTemp = String(m.id || "").startsWith("temp-");
                            if (!isTemp) return true;
                            const sameUsers =
                                usernameKey(m?.sender_username || "") === senderKey && usernameKey(m?.receiver_username || "") === receiverKey;
                            const sameText = String(m?.text || "") === String(row?.text || "");
                            const within =
                                Math.abs(new Date(String(m?.created_at || 0)).getTime() - new Date(String(row?.created_at || 0)).getTime()) <= 15000;
                            return !(sameUsers && sameText && within);
                        });
                        const exists = prev.some((m) => String(m.id) === String(row?.id));
                        if (exists) return withoutTempDup;
                        return [...withoutTempDup, row as ChatMessage];
                    });

                    if (receiverKey === meKey) {
                        await supabase.from("messages").update({ read: true }).eq("id", row.id);
                    }
                }
            )
            .subscribe((status) => {
                if (unsubscribed) return;
                console.log("[realtime] thread status", status, { meKey, otherKey });
                setRealtimeReady(status === "SUBSCRIBED");
            });

        return () => {
            unsubscribed = true;
            supabase.removeChannel(channel);
        };
    }, [meFold, meKey, otherKey]);

    const handleSend = async () => {
        if (!meFold || !otherFold || !meKey || !otherKey) return;
        const trimmed = text.trim();
        if (!trimmed) return;

        const mod = sanitizeMessage(trimmed);
        if (!mod.allowed) {
            setError(mod.reason || "Mesaj gönderilemedi.");
            return;
        }

        setSending(true);
        setError("");

        const payload = {
            sender_username: meKey,
            receiver_username: otherKey,
            text: mod.cleanedText || trimmed,
            read: false,
        };

        // Optimistic UI: unblock the user immediately; realtime will bring the server row.
        const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const optimistic: ChatMessage = {
            id: tempId,
            sender_username: meKey,
            receiver_username: otherKey,
            text: payload.text,
            read: true,
            created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, optimistic]);
        setText("");

        try {
            const startedAt = performance.now();
            console.log("[send] start", { meKey, otherKey, textLen: payload.text?.length || 0 });
            let finished = false;
            let slowTimer: ReturnType<typeof setTimeout> | null = null;
            slowTimer = setTimeout(() => {
                if (!finished) setError("Mesaj gönderiliyor... (bağlantı yavaş olabilir)");
            }, 8000);

            let ok = false;
            let firstErr: string | null = null;
            try {
                ok = await withTimeout(insertMessageRest(payload as any, 20000), 20000, "Mesaj gönderme");
            } catch (e: any) {
                firstErr = e?.message ? String(e.message) : "Mesaj gönderilemedi";
                console.log("[send] insert attempt-1 failed", firstErr);
                // 1 retry (short)
                ok = await withTimeout(insertMessageRest(payload as any, 8000), 8000, "Mesaj yeniden deneme");
            } finally {
                if (slowTimer) clearTimeout(slowTimer);
                finished = true;
            }

            console.log("[send] insert resolved", { ms: Math.round(performance.now() - startedAt), ok });

            if (!ok) {
                setMessages((prev) => prev.filter((m) => String(m.id) !== String(tempId)));
                setError(firstErr ? `Mesaj gönderilemedi: ${firstErr}` : "Mesaj gönderilemedi");
                return;
            }

            setError("");

            // Realtime should append instantly; polling will keep it consistent.
            // Do a best-effort sync shortly after to ensure persistence even if realtime is flaky.
            setTimeout(() => {
                supabase
                    .from("messages")
                    .select("id, sender_username, receiver_username, text, read, created_at")
                    .or(threadOr)
                    .order("created_at", { ascending: true })
                    .limit(500)
                    .then((r: any) => {
                        if (!r?.error && Array.isArray(r?.data)) setMessages(r.data as any);
                    });
            }, 400);

            // Extra safety: if realtime is "SUBSCRIBED" but events are not received, force one more sync.
            setTimeout(() => {
                supabase
                    .from("messages")
                    .select("id, sender_username, receiver_username, text, read, created_at")
                    .or(threadOr)
                    .order("created_at", { ascending: true })
                    .limit(500)
                    .then((r: any) => {
                        if (!r?.error && Array.isArray(r?.data)) setMessages(r.data as any);
                    });
            }, 2500);
        } catch (err: any) {
            setMessages((prev) => prev.filter((m) => String(m.id) !== String(tempId)));
            setError(err?.message ? String(err.message) : "Mesaj gönderilemedi");
        } finally {
            setSending(false);
        }
    };

    if (loading || pageLoading) {
        return (
            <div className="container py-10">
                <div className="text-sm text-gray-500 font-semibold">Yükleniyor...</div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="container py-10">
            <div className="flex items-center justify-between gap-4 mb-6">
                <div className="min-w-0">
                    <div className="text-xs text-gray-500 font-bold uppercase tracking-widest">Sohbet</div>
                    <h1 className="text-2xl font-bold tracking-tight truncate">{otherUsername}</h1>
                </div>
                <div className={`text-[10px] font-black uppercase tracking-widest ${realtimeReady ? "text-emerald-600" : "text-gray-400"}`}>
                    {realtimeReady ? "Canlı: Açık" : "Canlı: Kapalı"}
                </div>
                <Link href="/messages" className="text-sm font-bold text-blue-600 hover:text-blue-700">
                    Mesajlara dön
                </Link>
            </div>

            {error && (
                <div className="mb-4 p-4 text-xs font-black text-red-600 bg-red-50 border-2 border-red-100 rounded-xl uppercase tracking-tight">
                    {error}
                </div>
            )}

            <Card className="p-0 overflow-hidden">
                <div ref={listRef} className="h-[60vh] overflow-auto p-4 space-y-3 bg-white">
                    {messages.length === 0 ? (
                        <div className="text-sm text-gray-500 font-semibold">Henüz mesaj yok.</div>
                    ) : (
                        messages.map((m) => {
                            const mine = usernameKey(m.sender_username) === meKey;
                            return (
                                <div key={String(m.id)} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${mine ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"}`}>
                                        <div className="text-sm font-semibold whitespace-pre-wrap break-words">{m.text || ""}</div>
                                        <div className={`text-[10px] font-bold mt-2 ${mine ? "text-blue-100" : "text-gray-400"}`}>
                                            {m.created_at ? new Date(m.created_at).toLocaleString("tr-TR") : ""}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="border-t bg-gray-50 p-4">
                    <div className="grid gap-3">
                        <Textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Mesaj yaz..."
                            className="min-h-[90px] resize-none bg-white"
                            disabled={sending}
                        />
                        <div className="flex justify-end">
                            <Button onClick={handleSend} disabled={sending || !text.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
                                {sending ? "Gönderiliyor..." : "Gönder"}
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
