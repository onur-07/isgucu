"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-context";
import { displayUsername, friendlySupabaseError, sanitizeMessage, usernameFold, usernameKey } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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

export default function MessageThreadPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
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
    const [offers, setOffers] = useState<OfferRow[]>([]);
    const [myAvatar, setMyAvatar] = useState<string>("");
    const [otherAvatar, setOtherAvatar] = useState<string>("");
    const [text, setText] = useState<string>("");
    const [error, setError] = useState<string>("");
    const [sending, setSending] = useState<boolean>(false);
    const [pageLoading, setPageLoading] = useState<boolean>(true);
    const [realtimeReady, setRealtimeReady] = useState<boolean>(false);

    const [otherUserId, setOtherUserId] = useState<string>("");
    const [offerOpen, setOfferOpen] = useState<boolean>(false);
    const [offerPrice, setOfferPrice] = useState<string>("");
    const [offerDays, setOfferDays] = useState<string>("");
    const [offerNote, setOfferNote] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const prefillKeyRef = useRef<string>("");

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

    const handleAdminClearThread = async () => {
        if (!user || user.role !== "admin") return;
        if (!meKey || !otherKey) return;

        const ok = window.confirm("Bu konuşmadaki tüm mesajları silmek istiyor musun? Bu işlem geri alınamaz.");
        if (!ok) return;

        setSending(true);
        setError("");
        try {
            const { data, error: sessErr } = await supabase.auth.getSession();
            if (sessErr) throw sessErr;
            const token = data?.session?.access_token;
            if (!token) throw new Error("Oturum bulunamadı");

            const res = await fetch("/api/admin/messages/clear", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ a: meKey, b: otherKey }),
            });

            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                try {
                    const j = JSON.parse(txt);
                    if (j?.error === "missing_service_role") {
                        throw new Error("Admin temizleme çalışmıyor: Vercel'de SUPABASE_SERVICE_ROLE_KEY eklenmemiş.");
                    }
                    throw new Error(j?.details || j?.error || txt || `HTTP ${res.status}`);
                } catch {
                    throw new Error(txt || `HTTP ${res.status}`);
                }
            }

            setMessages([]);
            setOffers((prev) => prev);

            // Best-effort refresh after delete
            const r = await supabase
                .from("messages")
                .select("id, sender_username, receiver_username, text, file_data, read, created_at")
                .or(threadOr)
                .order("created_at", { ascending: true })
                .limit(200);
            if (!r?.error && Array.isArray((r as any)?.data)) setMessages((r as any).data);
        } catch (e: any) {
            setError(e?.message ? String(e.message) : "Temizleme başarısız");
        } finally {
            setSending(false);
        }
    };

    const insertMessageRest = async (
        payload: { sender_username: string; receiver_username: string; text?: string | null; file_data?: any; read: boolean },
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

    useEffect(() => {
        if (!meKey || !otherKey || !meFold || !otherFold) return;
        let cancelled = false;

        const or = [
            `username.ilike.${meKey}`,
            `username.ilike.${meFold}`,
            `username.ilike.${otherKey}`,
            `username.ilike.${otherFold}`,
        ].join(",");

        supabase
            .from("profiles")
            .select("username, avatar_url")
            .or(or)
            .limit(4)
            .then((res: any) => {
                if (cancelled) return;
                if (res?.error || !Array.isArray(res?.data)) return;
                for (const row of res.data) {
                    const u = usernameKey(String(row?.username || ""));
                    const url = String(row?.avatar_url || "");
                    if (!u || !url) continue;
                    if (u === meKey) setMyAvatar(url);
                    if (u === otherKey) setOtherAvatar(url);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [meKey, otherKey, meFold, otherFold]);

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
                setOffers([]);
                setOtherUserId("");
                setPageLoading(false);
                return;
            }

            setPageLoading(true);
            setError("");

            try {
                const [msgRes, offerRes, otherProfileRes] = await Promise.all([
                    withTimeout(
                        supabase
                            .from("messages")
                            .select("id, sender_username, receiver_username, text, file_data, read, created_at")
                            .or(threadOr)
                            .order("created_at", { ascending: true })
                            .limit(200),
                        12000,
                        "Mesaj geçmişi"
                    ),
                    withTimeout(
                        supabase
                            .from("offers")
                            .select("id, sender_id, receiver_id, sender_username, receiver_username, message, price, delivery_days, status, created_at, responded_at")
                            .or(
                                `and(sender_username.ilike.${meFold},receiver_username.ilike.${otherFold}),and(sender_username.ilike.${otherFold},receiver_username.ilike.${meFold}),and(sender_username.ilike.${meKey},receiver_username.ilike.${otherKey}),and(sender_username.ilike.${otherKey},receiver_username.ilike.${meKey}),and(sender_username.ilike.${meFold},receiver_username.ilike.${otherKey}),and(sender_username.ilike.${otherKey},receiver_username.ilike.${meFold}),and(sender_username.ilike.${meKey},receiver_username.ilike.${otherFold}),and(sender_username.ilike.${otherFold},receiver_username.ilike.${meKey})`
                            )
                            .order("created_at", { ascending: true })
                            .limit(100),
                        12000,
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

                const msgs = (msgRes as any)?.data;
                const msgErr = (msgRes as any)?.error;
                if (msgErr) {
                    setError(msgErr.message);
                    setMessages([]);
                    setOffers([]);
                    return;
                }
                setMessages((msgs || []) as any);

                const offersData = (offerRes as any)?.data;
                const offerErr = (offerRes as any)?.error;
                if (!offerErr) setOffers((offersData || []) as any);

                const otherProfile = (otherProfileRes as any)?.data;
                if (otherProfile?.id) setOtherUserId(String(otherProfile.id));

                supabase
                    .from("messages")
                    .update({ read: true })
                    .or(
                        `and(receiver_username.ilike.${meKey},sender_username.ilike.${otherKey}),and(receiver_username.ilike.${meFold},sender_username.ilike.${otherFold})`
                    )
                    .eq("read", false)
                    .then(() => {});
            } catch (err: any) {
                setError(err?.message ? String(err.message) : "Mesajlar yüklenemedi");
                setMessages([]);
                setOffers([]);
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
                        .select("id, sender_username, receiver_username, text, file_data, read, created_at")
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
            file_data: null,
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
                    .select("id, sender_username, receiver_username, text, file_data, read, created_at")
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
                    .select("id, sender_username, receiver_username, text, file_data, read, created_at")
                    .or(threadOr)
                    .order("created_at", { ascending: true })
                    .limit(500)
                    .then((r: any) => {
                        if (!r?.error && Array.isArray(r?.data)) setMessages(r.data as any);
                    });
            }, 2500);
        } catch (err: any) {
            setMessages((prev) => prev.filter((m) => String(m.id) !== String(tempId)));
            const friendly = friendlySupabaseError(err, "Mesaj gönderilemedi");
            setError(friendly);

            // Best-effort: notify admin (support ticket) on PII attempts
            try {
                const msg = String(err?.message || "").toLowerCase();
                if (msg.includes("pii_blocked")) {
                    const { data } = await supabase.auth.getSession();
                    const token = data?.session?.access_token;
                    if (token) {
                        fetch("/api/security/pii-attempt", {
                            method: "POST",
                            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                            body: JSON.stringify({ kind: msg.includes("phone") ? "phone" : msg.includes("iban") ? "iban" : msg.includes("email") ? "email" : "pii", other: otherUsername, path: `/messages/${otherUsername}` }),
                        }).catch(() => {});
                    }
                }
            } catch {
                // ignore
            }
        } finally {
            setSending(false);
        }
    };

    const handleComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key !== "Enter" || e.shiftKey) return;
        e.preventDefault();
        if (sending || !text.trim()) return;
        void handleSend();
    };

    useEffect(() => {
        const key = searchParams?.toString() || "";
        if (!key || prefillKeyRef.current === key) return;

        const qText = searchParams.get("text");
        const qOfferPrice = searchParams.get("offerPrice");
        const qOfferDays = searchParams.get("offerDays");
        const qOfferNote = searchParams.get("offerNote");
        const qOpenOffer = searchParams.get("openOffer");

        if (qText && !text.trim()) setText(qText);
        if (qOfferPrice) setOfferPrice(qOfferPrice);
        if (qOfferDays) setOfferDays(qOfferDays);
        if (qOfferNote) setOfferNote(qOfferNote);
        if (qOpenOffer === "1" || qOfferPrice || qOfferDays || qOfferNote) setOfferOpen(true);

        prefillKeyRef.current = key;
    }, [searchParams, text]);

    const refreshOffers = async () => {
        if (!meFold || !otherFold) return;
        const res = (await withTimeout(
            supabase
                .from("offers")
                .select("id, sender_id, receiver_id, sender_username, receiver_username, message, price, delivery_days, status, created_at, responded_at")
                .or(
                    `and(sender_username.ilike.${meFold},receiver_username.ilike.${otherFold}),and(sender_username.ilike.${otherFold},receiver_username.ilike.${meFold}),and(sender_username.ilike.${meKey},receiver_username.ilike.${otherKey}),and(sender_username.ilike.${otherKey},receiver_username.ilike.${meKey}),and(sender_username.ilike.${meFold},receiver_username.ilike.${otherKey}),and(sender_username.ilike.${otherKey},receiver_username.ilike.${meFold}),and(sender_username.ilike.${meKey},receiver_username.ilike.${otherFold}),and(sender_username.ilike.${otherFold},receiver_username.ilike.${meKey})`
                )
                .order("created_at", { ascending: true })
                .limit(100),
            12000,
            "Teklifler"
        )) as any;

        if (!res?.error && Array.isArray(res?.data)) setOffers(res.data as any);
    };

    const handleSendOffer = async () => {
        if (!user?.id || !otherUserId || !meKey || !otherKey) return;

        const price = Number(String(offerPrice || "").replace(",", "."));
        const days = Number(String(offerDays || "").trim());
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(days) || days <= 0) {
            setError("Teklif için fiyat ve teslim günü gir.");
            return;
        }

        if (offerNote.trim()) {
            const mod = sanitizeMessage(offerNote.trim());
            if (!mod.allowed) {
                setError(mod.reason || "Bu içerik gönderilemez");
                return;
            }
        }

        setSending(true);
        setError("");
        try {
            const payload = {
                gig_id: null,
                sender_id: user.id,
                receiver_id: otherUserId,
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
            await refreshOffers();
        } catch (e: any) {
            setError(e?.message ? String(e.message) : "Teklif gönderilemedi");
        } finally {
            setSending(false);
        }
    };

    const handleRespondOffer = async (offerId: string | number, status: "accepted" | "rejected") => {
        setSending(true);
        setError("");
        try {
            const res = (await withTimeout(
                supabase.from("offers").update({ status, responded_at: new Date().toISOString() }).eq("id", offerId),
                15000,
                "Teklif yanıt"
            )) as any;
            if (res?.error) throw res.error;
            await refreshOffers();
        } catch (e: any) {
            setError(e?.message ? String(e.message) : "Teklif güncellenemedi");
        } finally {
            setSending(false);
        }
    };

    const handlePickFile = () => {
        fileInputRef.current?.click();
    };

    const handleUploadFile = async (file: File) => {
        if (!meKey || !otherKey) return;
        setSending(true);
        setError("");

        const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const optimistic: ChatMessage = {
            id: tempId,
            sender_username: meKey,
            receiver_username: otherKey,
            text: file.name,
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
                file_data: {
                    name: file.name,
                    size: file.size,
                    contentType: file.type || "application/octet-stream",
                    url,
                    path,
                },
                read: false,
            };

            const ok = await withTimeout(insertMessageRest(payload as any, 20000), 20000, "Dosya mesajı");
            if (!ok) throw new Error("Dosya mesajı gönderilemedi");

            setError("");
        } catch (e: any) {
            setMessages((prev) => prev.filter((m) => String(m.id) !== String(tempId)));
            const msg = e?.message ? String(e.message) : "Dosya gönderilemedi";
            if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("bucket")) {
                setError("Dosya gönderilemedi: Supabase Storage'da 'chat-files' bucket yok. Supabase -> Storage -> New bucket: chat-files (Public) oluştur.");
            } else {
                setError(msg);
            }
        } finally {
            setSending(false);
        }
    };

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
                <div className="flex items-center gap-3 min-w-0">
                    <div className="text-xs text-gray-500 font-bold uppercase tracking-widest">Sohbet</div>
                    <h1 className="text-2xl font-bold tracking-tight truncate">{displayUsername(otherUsername)}</h1>
                </div>
                {user?.role === "admin" && (
                    <Button
                        disabled={sending}
                        onClick={handleAdminClearThread}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        Konuşmayı Temizle
                    </Button>
                )}
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
                <div ref={listRef} className="h-[60vh] overflow-auto p-4 space-y-3 bg-gray-50">
                    {timeline.length === 0 ? (
                        <div className="text-sm text-gray-500 font-semibold">Henüz mesaj yok.</div>
                    ) : (
                        timeline.map((it) => {
                            if (it.type === "message") {
                                const m = it.data;
                                const mine = usernameKey(m.sender_username) === meKey;
                                const fd = (m as any)?.file_data;
                                const isFile = !!fd?.url;
                                return (
                                    <div key={it.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                                        {!mine && (
                                            <div className="mr-2 mt-1 h-9 w-9 rounded-full bg-white border flex items-center justify-center overflow-hidden shrink-0">
                                                {otherAvatar ? (
                                                    <img src={otherAvatar} alt="" className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="text-[10px] font-black text-gray-600">{displayUsername(otherUsername).charAt(0).toUpperCase()}</div>
                                                )}
                                            </div>
                                        )}

                                        <div className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${mine ? "bg-blue-600 text-white" : "bg-white border text-gray-900"}`}>
                                            {isFile ? (
                                                <div>
                                                    <div className="text-sm font-black">Dosya</div>
                                                    <a
                                                        className={`text-sm font-semibold underline break-all ${mine ? "text-white" : "text-blue-600"}`}
                                                        href={String(fd.url)}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        {String(fd.name || "dosya")}
                                                    </a>
                                                    <div className={`text-[10px] font-bold mt-2 ${mine ? "text-blue-100" : "text-gray-400"}`}>
                                                        {m.created_at ? new Date(m.created_at).toLocaleString("tr-TR") : ""}
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="text-sm font-semibold whitespace-pre-wrap break-words">{m.text || ""}</div>
                                                    <div className={`text-[10px] font-bold mt-2 ${mine ? "text-blue-100" : "text-gray-400"}`}>
                                                        {m.created_at ? new Date(m.created_at).toLocaleString("tr-TR") : ""}
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {mine && (
                                            <div className="ml-2 mt-1 h-9 w-9 rounded-full bg-white border border-blue-100 flex items-center justify-center overflow-hidden shrink-0">
                                                {myAvatar ? (
                                                    <img src={myAvatar} alt="" className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="text-[10px] font-black text-blue-700">{displayUsername(user?.username).charAt(0).toUpperCase()}</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            const o = it.data;
                            const mine = usernameKey(o.sender_username) === meKey;
                            const receiverIsMe = String(o.receiver_id || "") === String(user?.id || "");
                            const pending = String(o.status) === "pending";

                            return (
                                <div key={it.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[92%] rounded-2xl px-4 py-3 border ${mine ? "bg-blue-50 border-blue-100" : "bg-white border-gray-200"}`}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="text-xs font-black uppercase tracking-widest text-gray-500">Teklif</div>
                                            <div
                                                className={`text-[10px] font-black uppercase tracking-widest ${
                                                    o.status === "accepted"
                                                        ? "text-emerald-600"
                                                        : o.status === "rejected"
                                                        ? "text-red-600"
                                                        : "text-gray-500"
                                                }`}
                                            >
                                                {String(o.status || "pending")}
                                            </div>
                                        </div>

                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                            <div className="rounded-xl bg-gray-50 p-3">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Fiyat</div>
                                                <div className="text-sm font-black text-gray-900">{String(o.price)} ₺</div>
                                            </div>
                                            <div className="rounded-xl bg-gray-50 p-3">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Teslim</div>
                                                <div className="text-sm font-black text-gray-900">{String(o.delivery_days)} gün</div>
                                            </div>
                                        </div>

                                        {o.message && <div className="mt-2 text-sm font-semibold text-gray-700 whitespace-pre-wrap break-words">{o.message}</div>}

                                        {pending && receiverIsMe && (
                                            <div className="mt-3 flex gap-2 justify-end">
                                                <Button type="button"
                                                    disabled={sending}
                                                    onClick={() => handleRespondOffer(o.id, "rejected")}
                                                    className="bg-gray-200 hover:bg-gray-300 text-gray-900"
                                                >
                                                    Reddet
                                                </Button>
                                                <Button type="button" disabled={sending} onClick={() => handleRespondOffer(o.id, "accepted")} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                                    Kabul Et
                                                </Button>
                                            </div>
                                        )}

                                        <div className="text-[10px] font-bold mt-2 text-gray-400">
                                            {o.created_at ? new Date(o.created_at).toLocaleString("tr-TR") : ""}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="border-t bg-gray-50 p-4">
                    <div className="grid gap-3">
                        {offerOpen && (
                            <div className="rounded-2xl border bg-white p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="text-xs font-black uppercase tracking-widest text-gray-500">Teklif gönder</div>
                                    <Button type="button"
                                        disabled={sending}
                                        onClick={() => setOfferOpen(false)}
                                        className="bg-gray-200 hover:bg-gray-300 text-gray-900"
                                    >
                                        Kapat
                                    </Button>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-3">
                                    <input
                                        value={offerPrice}
                                        onChange={(e) => setOfferPrice(e.target.value)}
                                        placeholder="Fiyat (₺)"
                                        className="h-10 rounded-xl border px-3 text-sm font-semibold"
                                        disabled={sending}
                                    />
                                    <input
                                        value={offerDays}
                                        onChange={(e) => setOfferDays(e.target.value)}
                                        placeholder="Teslim (gün)"
                                        className="h-10 rounded-xl border px-3 text-sm font-semibold"
                                        disabled={sending}
                                    />
                                </div>
                                <Textarea
                                    value={offerNote}
                                    onChange={(e) => setOfferNote(e.target.value)}
                                    placeholder="Not (opsiyonel)"
                                    className="mt-3 min-h-[80px] resize-none bg-white"
                                    disabled={sending}
                                />
                                <div className="mt-3 flex justify-end gap-2">
                                    <Button type="button"
                                        disabled={sending}
                                        onClick={handleSendOffer}
                                        className="bg-blue-600 hover:bg-blue-700 text-white"
                                    >
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
                            <div className="flex gap-2">
                                <Button type="button"
                                    disabled={sending}
                                    onClick={handlePickFile}
                                    className="bg-gray-200 hover:bg-gray-300 text-gray-900"
                                >
                                    Dosya
                                </Button>
                                <Button type="button"
                                    disabled={sending || !otherUserId}
                                    onClick={() => setOfferOpen((v) => !v)}
                                    className="bg-gray-200 hover:bg-gray-300 text-gray-900"
                                >
                                    Teklif
                                </Button>
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                {otherUserId ? "" : "Kullanıcı bulunamadı"}
                            </div>
                        </div>

                        <Textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            onKeyDown={handleComposerKeyDown}
                            placeholder="Mesaj yaz..."
                            className="min-h-[90px] resize-none bg-white"
                            disabled={sending}
                        />
                        <div className="flex justify-end">
                            <Button type="button" onClick={handleSend} disabled={sending || !text.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
                                {sending ? "Gönderiliyor..." : "Gönder"}
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
