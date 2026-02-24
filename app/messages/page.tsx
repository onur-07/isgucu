"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { supabase } from "@/lib/supabase";
import { usernameFold, usernameKey } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export default function MessagesPage() {
    const router = useRouter();
    const { user, loading } = useAuth();

    const [items, setItems] = useState<
        Array<{
            otherUsername: string;
            lastText: string;
            lastAt: string;
            unreadCount: number;
        }>
    >([]);
    const [error, setError] = useState<string>("");
    const [pageLoading, setPageLoading] = useState<boolean>(true);

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
            if (!user?.username) {
                setItems([]);
                setPageLoading(false);
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
                        .limit(250),
                    12000,
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
                if (!cancelled && !opts?.silent) setPageLoading(false);
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

            intervalId = setInterval(() => run({ silent: true }), 5000);
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
                <Card className="p-6">
                    <div className="text-sm font-semibold text-gray-700">Henüz mesaj yok.</div>
                    <div className="text-xs text-gray-500 mt-1">Bir kullanıcıyla konuşma başlatınca burada görünecek.</div>
                </Card>
            ) : (
                <div className="grid gap-3">
                    {items.map((c) => (
                        <Link key={c.otherUsername} href={`/messages/${encodeURIComponent(c.otherUsername)}`}>
                            <Card className="p-4 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="font-bold text-gray-900 truncate">{c.otherUsername}</div>
                                        <div className="text-xs text-gray-500 truncate mt-1">{c.lastText || "(dosya/teklif)"}</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {c.unreadCount > 0 && (
                                            <div className="h-6 min-w-6 px-2 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                                                {c.unreadCount}
                                            </div>
                                        )}
                                        <div className="text-[10px] font-bold text-gray-400 whitespace-nowrap">
                                            {c.lastAt ? new Date(c.lastAt).toLocaleString("tr-TR") : ""}
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
