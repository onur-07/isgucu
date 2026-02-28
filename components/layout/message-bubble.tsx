"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { usernameKey } from "@/lib/utils";

type IncomingToast = {
    sender: string;
    text: string;
    at: number;
};

const getRecordString = (value: unknown, key: string) => {
    if (!value || typeof value !== "object") return "";
    const rec = value as Record<string, unknown>;
    const v = rec[key];
    return typeof v === "string" ? v : v == null ? "" : String(v);
};

export function MessageBubble() {
    const { user, loading } = useAuth();
    const [unread, setUnread] = useState<number>(0);
    const [toast, setToast] = useState<IncomingToast | null>(null);

    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevUnreadRef = useRef<number>(0);

    const me = usernameKey(user?.username || "");

    const showToast = (sender: string, text: string) => {
        setToast({ sender, text, at: Date.now() });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 3000);
    };

    const fetchUnread = useCallback(async () => {
        if (!me) return;
        const { count, error } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .ilike("receiver_username", me)
            .eq("read", false);

        if (error) return;

        const next = count || 0;
        const prev = prevUnreadRef.current;
        prevUnreadRef.current = next;
        setUnread(next);

        // Fallback toast: if realtime is not working, show a toast when unread increases
        if (next > prev) {
            const latest = await supabase
                .from("messages")
                .select("sender_username, text, created_at")
                .ilike("receiver_username", me)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            const sender = getRecordString((latest as unknown as { data?: unknown })?.data, "sender_username");
            const text = getRecordString((latest as unknown as { data?: unknown })?.data, "text");
            if (sender) showToast(sender, text);
        }
    }, [me]);

    useEffect(() => {
        if (loading) return;
        if (!me) {
            prevUnreadRef.current = 0;
            return;
        }

        const initialId = window.setTimeout(() => {
            fetchUnread();
        }, 0);

        const intervalId = window.setInterval(() => {
            fetchUnread();
        }, 8000);

        const onFocus = () => {
            fetchUnread();
        };

        window.addEventListener("focus", onFocus);
        return () => {
            window.clearTimeout(initialId);
            window.clearInterval(intervalId);
            window.removeEventListener("focus", onFocus);
        };
    }, [loading, me, fetchUnread]);

    useEffect(() => {
        if (!me) return;

        const channel = supabase
            .channel(`messages-bubble-${me}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "messages" },
                (payload) => {
                    const row = (payload as unknown as { new?: unknown })?.new;
                    const receiver = usernameKey(getRecordString(row, "receiver_username"));
                    if (receiver !== me) return;

                    const sender = getRecordString(row, "sender_username");
                    const text = getRecordString(row, "text");

                    setUnread((u) => {
                        const next = u + 1;
                        prevUnreadRef.current = next;
                        return next;
                    });

                    showToast(sender, text);
                }
            )
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "messages" },
                (payload) => {
                    const row = (payload as unknown as { new?: unknown })?.new;
                    const receiver = usernameKey(getRecordString(row, "receiver_username"));
                    if (receiver !== me) return;
                    fetchUnread();
                }
            )
            .subscribe();

        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            supabase.removeChannel(channel);
        };
    }, [me, fetchUnread]);

    const show = useMemo(() => {
        if (loading) return false;
        return !!me;
    }, [loading, me]);

    if (!show) return null;

    return (
        <>
            {toast && (
                <div className="fixed bottom-24 right-6 z-[60] w-[320px] max-w-[85vw] rounded-2xl border bg-white shadow-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Yeni Mesaj</div>
                    <div className="mt-1 text-sm font-bold text-gray-900 truncate">{toast.sender}</div>
                    <div className="mt-1 text-xs text-gray-600 line-clamp-2">{toast.text || "(içerik)"}</div>
                </div>
            )}

            <div className="fixed bottom-6 right-6 z-[60]">
                <Link href="/messages">
                    <Button className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-200 relative">
                        <MessageCircle className="h-6 w-6" />
                        {unread > 0 && (
                            <span className="absolute -top-1 -right-1 h-6 min-w-6 px-2 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                                {unread}
                            </span>
                        )}
                    </Button>
                </Link>
            </div>
        </>
    );
}
