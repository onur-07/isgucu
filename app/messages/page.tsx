"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { supabase } from "@/lib/supabase";
import { displayUsername, usernameFold, usernameKey } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Check, CheckCheck } from "lucide-react";

export default function MessagesPage() {
    const router = useRouter();
    const { user, loading } = useAuth();

    const [items, setItems] = useState<
        Array<{
            otherUsername: string;
            lastText: string;
            lastAt: string;
            unreadCount: number;
            lastFromMe: boolean;
            lastRead: boolean;
        }>
    >([]);
    const [error, setError] = useState<string>("");
    const [pageLoading, setPageLoading] = useState<boolean>(true);

    const inFlightRef = useMemo(() => ({ running: false }), []);

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
        let cancelled = false;
        let channel: any = null;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const run = async (opts?: { silent?: boolean }) => {
            if (inFlightRef.running) return;
            inFlightRef.running = true;
            if (!user?.username) {
                setItems([]);
                setPageLoading(false);
                inFlightRef.running = false;
                return;
            }

            if (!opts?.silent) {
                setPageLoading(true);
            }
            setError("");

            try {
                const meKey = usernameKey(user.username || "");
                const meFold = usernameFold(user.username || "");
                const res = (await withTimeout(
                    supabase
                        .from("messages")
                        .select("id, sender_username, receiver_username, text, read, created_at")
                        .or(
                            `sender_username.ilike.${meKey},receiver_username.ilike.${meKey},sender_username.ilike.${meFold},receiver_username.ilike.${meFold}`
                        )
                        .order("created_at", { ascending: false })
                        .limit(120),
                    8000,
                    "Mesajlar"
                )) as any;

                const data = res?.data;
                const fetchError = res?.error;
                if (fetchError) {
                    setError(fetchError.message);
                    setItems([]);
                    return;
                }

                if (cancelled) return;

                const byOther = new Map<
                    string,
                    {
                        otherUsername: string;
                        lastText: string;
                        lastAt: string;
                        unreadCount: number;
                        lastFromMe: boolean;
                        lastRead: boolean;
                    }
                >();

                for (const m of data || []) {
                    const senderRaw = String((m as any).sender_username || "");
                    const receiverRaw = String((m as any).receiver_username || "");
                    const sender = usernameKey(senderRaw);
                    const receiver = usernameKey(receiverRaw);
                    const otherKey = sender === meKey ? receiver : sender;
                    if (!otherKey) continue;

                    const otherDisplay = sender === meKey ? receiverRaw : senderRaw;
                    const isUnread = receiver === meKey && !(m as any).read;
                    const existing = byOther.get(otherKey);
                    if (!existing) {
                        byOther.set(otherKey, {
                            otherUsername: otherKey,
                            lastText: String((m as any).text || ""),
                            lastAt: String((m as any).created_at || ""),
                            unreadCount: isUnread ? 1 : 0,
                            lastFromMe: sender === meKey,
                            lastRead: !!(m as any).read,
                        });
                    } else {
                        if (isUnread) existing.unreadCount += 1;
                    }
                }

                setItems(Array.from(byOther.values()));
            } catch (err: any) {
                setError(err?.message ? String(err.message) : "Mesajlar yüklenemedi");
                setItems([]);
            } finally {
                if (!cancelled) setPageLoading(false);
                inFlightRef.running = false;
            }
        };

        run();

        // Realtime refresh (if enabled) + polling fallback
        const meKey = usernameKey(user?.username || "");
        if (meKey) {
            channel = supabase
                .channel(`messages-inbox-${meKey}`)
                .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
                    run({ silent: true });
                })
                .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () => {
                    run({ silent: true });
                })
                .subscribe();

            intervalId = setInterval(() => run({ silent: true }), 15000);
        }

        return () => {
            cancelled = true;
            if (intervalId) clearInterval(intervalId);
            if (channel) supabase.removeChannel(channel);
        };
    }, [user?.username]);

    const title = useMemo(() => {
        if (pageLoading || loading) return "Yükleniyor...";
        if (!user) return "";
        return "Mesajlar";
    }, [pageLoading, loading, user]);

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
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            </div>

            {error && (
                <div className="mb-4 p-4 text-xs font-black text-red-600 bg-red-50 border-2 border-red-100 rounded-xl uppercase tracking-tight">
                    {error}
                </div>
            )}

            {items.length === 0 ? (
                <Card className="p-10 text-center border rounded-2xl bg-white">
                    <div className="text-sm font-black text-gray-800">Henüz mesaj yok.</div>
                    <div className="text-xs text-gray-500 mt-2">Bir kullanıcıyla konuşma başlatınca burada görünecek.</div>
                </Card>
            ) : (
                <div className="grid gap-3">
                    {items.map((c) => (
                        <Link key={c.otherUsername} href={`/messages/${encodeURIComponent(c.otherUsername)}`}>
                            <Card className="p-5 rounded-2xl border bg-white hover:shadow-lg hover:border-gray-200 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black shrink-0">
                                        {displayUsername(c.otherUsername).charAt(0).toUpperCase()}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="font-black text-gray-900 truncate">
                                                {displayUsername(c.otherUsername)}
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 whitespace-nowrap shrink-0">
                                                {c.lastFromMe && (
                                                    <span className="inline-flex items-center">
                                                        {c.lastRead ? (
                                                            <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
                                                        ) : (
                                                            <Check className="h-3.5 w-3.5 text-gray-400" />
                                                        )}
                                                    </span>
                                                )}
                                                <span>{c.lastAt ? new Date(c.lastAt).toLocaleString("tr-TR") : ""}</span>
                                            </div>
                                        </div>
                                        <div className="mt-1 flex items-center justify-between gap-3">
                                            <div className="text-xs text-gray-500 line-clamp-1 min-w-0">
                                                {c.lastText || "(dosya/teklif)"}
                                            </div>
                                            {c.unreadCount > 0 && (
                                                <div className="h-6 min-w-6 px-2 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shrink-0">
                                                    {c.unreadCount}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
