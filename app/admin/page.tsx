"use client";

import { useAuth } from "@/components/auth/auth-context";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { getAllUsers, getPlatformStats, updateUserInfo, type PlatformUser, type PlatformStats } from "@/lib/data-service";
import { Users, Briefcase, TrendingUp, Shield, Trash2, Headphones, MessageCircle, CheckCircle2, Clock, Send, Settings, Globe, Layout, Palette, Plus, Save, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { getSiteConfig, hydrateSiteConfigFromRemote, saveSiteConfig, type SiteConfig, type NavLink } from "@/lib/site-config";
import { Input } from "@/components/ui/input";
import Link from "next/link";

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

interface SupportTicketReply {
    id: string;
    ticket_id: string;
    author_role: "admin" | "user";
    message: string;
    created_at: string;
}

interface DeletedUserRow {
    id: number;
    original_user_id: string;
    username: string;
    email: string;
    role: string;
    delete_reason?: string;
    source?: string;
    deleted_at: string;
    restore_status?: string;
    restored_at?: string;
    restored_user_id?: string;
}

const DELETED_USERS_CACHE_KEY = "isgucu_admin_deleted_users_cache";

function AdminPageContent() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [users, setUsers] = useState<PlatformUser[]>([]);
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [totalUsersCount, setTotalUsersCount] = useState(0);
    const [activeTab, setActiveTab] = useState<"overview" | "users" | "support" | "payouts" | "categories" | "deletions" | "site_settings">("overview");
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [ticketReplies, setTicketReplies] = useState<Record<string, SupportTicketReply[]>>({});

    const [usernameToId, setUsernameToId] = useState<Record<string, string>>({});
    const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
    const [replySuccess, setReplySuccess] = useState<string | null>(null);
    const [deletionRequests, setDeletionRequests] = useState<any[]>([]);
    const [deletedUsers, setDeletedUsers] = useState<DeletedUserRow[]>([]);
    const [siteConfig, setSiteConfig] = useState<SiteConfig>(getSiteConfig());

    const parseTabFromUrl = (raw: string | null) => {
        const v = String(raw || "").trim();
        if (v === "overview" || v === "users" || v === "support" || v === "payouts" || v === "deletions" || v === "site_settings") return v;
        return null;
    };

    const withTimeout = async <T,>(p: PromiseLike<T>, ms: number, label: string): Promise<T> => {
        const wrapped = Promise.resolve(p as any as Promise<T>);
        return await Promise.race([
            wrapped,
            new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error(`timeout:${label}`)), ms)
            ),
        ]);
    };

    const parseSecurityMeta = (message: string) => {
        const rows = String(message || "").split("\n");
        const grab = (key: string) => {
            const found = rows.find((r) => r.startsWith(`${key}:`));
            return found ? found.slice(key.length + 1).trim() : "";
        };
        const callerId = grab("CALLER_ID");
        const callerUsername = grab("CALLER_USERNAME");
        const callerRole = grab("CALLER_ROLE");
        const otherId = grab("OTHER_ID");
        const otherUsername = grab("OTHER_USERNAME");
        const otherRole = grab("OTHER_ROLE");
        return { callerId, callerUsername, callerRole, otherId, otherUsername, otherRole };
    };

    const callModeration = async (payload: Record<string, any>) => {
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !sessionData?.session?.access_token) {
            throw new Error("Oturum alinamadi. Lutfen tekrar giris yapin.");
        }

        const resp = await fetch("/api/admin/moderation", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify(payload),
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            throw new Error(String((json as any)?.details || (json as any)?.error || resp.status));
        }
        return json;
    };

    const fetchUsersFromAdminApi = async (): Promise<PlatformUser[]> => {
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !sessionData?.session?.access_token) {
            throw new Error("Oturum alınamadı. Lütfen tekrar giriş yapın.");
        }

        const resp = await fetch(`/api/admin/users?t=${Date.now()}`,
            {
                method: "GET",
                cache: "no-store",
                headers: {
                    "Authorization": `Bearer ${sessionData.session.access_token}`,
                },
            }
        );

        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            throw new Error(String(json?.details || json?.error || resp.status));
        }

        const rows = Array.isArray((json as any)?.users) ? (json as any).users : [];
        return rows.map((u: any) => ({
            id: u.id,
            username: u.username,
            email: u.email,
            role: u.role,
            createdAt: u.createdAt,
            isBanned: u.isBanned,
        })) as PlatformUser[];
    };

    const fetchDeletedUsersFromAdminApi = async (): Promise<DeletedUserRow[]> => {
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !sessionData?.session?.access_token) {
            throw new Error("Oturum alınamadı. Lütfen tekrar giriş yapın.");
        }

        const resp = await fetch(`/api/admin/deleted-users?t=${Date.now()}`, {
            method: "GET",
            cache: "no-store",
            headers: {
                Authorization: `Bearer ${sessionData.session.access_token}`,
            },
        });

        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(String((json as any)?.details || (json as any)?.error || resp.status));
        return Array.isArray((json as any)?.deletedUsers) ? (json as any).deletedUsers : [];
    };

    const readDeletedUsersCache = (): DeletedUserRow[] => {
        try {
            const raw = localStorage.getItem(DELETED_USERS_CACHE_KEY);
            if (!raw) return [];
            const rows = JSON.parse(raw);
            return Array.isArray(rows) ? rows : [];
        } catch {
            return [];
        }
    };

    const writeDeletedUsersCache = (rows: DeletedUserRow[]) => {
        try {
            localStorage.setItem(DELETED_USERS_CACHE_KEY, JSON.stringify(rows.slice(0, 500)));
        } catch { }
    };

    const fetchApprovedDeletionRequestsAsDeleted = async (): Promise<DeletedUserRow[]> => {
        const approvedRes = await withTimeout(
            supabase
                .from("account_deletion_requests")
                .select("id, user_id, username, email, reason, created_at")
                .eq("status", "approved")
                .order("created_at", { ascending: false }),
            10000,
            "approvedDeletionRequests"
        );

        if ((approvedRes as any)?.error) return [];
        const rows = ((approvedRes as any)?.data || []) as Array<any>;
        return rows.map((r) => ({
            id: Number(r.id || 0),
            original_user_id: String(r.user_id || ""),
            username: String(r.username || ""),
            email: String(r.email || ""),
            role: "",
            delete_reason: String(r.reason || ""),
            source: "legacy_approved_request",
            deleted_at: String(r.created_at || ""),
            restore_status: "unknown",
        }));
    };

    const mergeDeletedRows = (...groups: DeletedUserRow[][]) => {
        const merged = new Map<string, DeletedUserRow>();
        for (const arr of groups) {
            for (const r of arr || []) {
                const k = `${String(r.original_user_id || "")}-${String(r.deleted_at || "")}-${String(r.email || "")}`;
                if (!merged.has(k)) merged.set(k, r);
            }
        }
        return Array.from(merged.values()).sort((a, b) => {
            const ta = new Date(String(a.deleted_at || 0)).getTime();
            const tb = new Date(String(b.deleted_at || 0)).getTime();
            return tb - ta;
        });
    };

    const loadData = async (opts?: { fetchUsers?: boolean }) => {
        console.log("AdminPage: Veri çekme işlemi başladı...");
        try {
            const fetchUsers = !!opts?.fetchUsers;

            // 1) Hızlı sayım + istatistikler + destek + silme talepleri paralel
            console.log("AdminPage: İstatistikler / talepler / sayımlar isteniyor...");
            const results = await Promise.allSettled([
                withTimeout(getPlatformStats(), 7000, "platformStats"),
                withTimeout(supabase.from('profiles').select('*', { count: 'exact', head: true }), 7000, "profilesCount"),
                withTimeout(
                    supabase
                        .from('support_tickets')
                        .select('id, from_user, from_email, subject, category, message, status, created_at, reply, replied_at')
                        .order('created_at', { ascending: false }),
                    7000,
                    "supportTickets"
                ),
                withTimeout(
                    supabase
                        .from('account_deletion_requests')
                        .select('id, user_id, username, email, reason, status, created_at')
                        .eq('status', 'pending')
                        .order('created_at', { ascending: false }),
                    7000,
                    "deletionRequests"
                ),
            ]);

            const [statsRes, usersCountRes, ticketsRes, deletionsRes] = results;

            if (statsRes.status === 'fulfilled') {
                setStats(statsRes.value as any);
            } else {
                console.error("AdminPage: Stats load failed:", statsRes.reason);
            }

            if (usersCountRes.status === 'fulfilled') {
                setTotalUsersCount((usersCountRes.value as any)?.count || 0);
            } else {
                console.error("AdminPage: User count load failed:", usersCountRes.reason);
            }

            if (ticketsRes.status === 'fulfilled') {
                const t = ticketsRes.value as any;
                if (t?.error) console.error("AdminPage: Destek talebi çekme hatası:", t.error);
                const ticketRows: SupportTicket[] = t?.data || [];
                setTickets(ticketRows);

                const ids = ticketRows.map((x) => String(x.id)).filter(Boolean);
                if (ids.length > 0) {
                    const idsNum = ids.map((v) => Number(v)).filter((n) => Number.isFinite(n));
                    const repliesRes = await supabase
                        .from("support_ticket_replies")
                        .select("id, ticket_id, author_role, message, created_at")
                        .in("ticket_id", idsNum)
                        .order("created_at", { ascending: true });

                    if (repliesRes.error) {
                        console.error("AdminPage: Ticket replies load error:", repliesRes.error);
                        setTicketReplies({});
                    } else {
                        const grouped: Record<string, SupportTicketReply[]> = {};
                        for (const r of (repliesRes.data || []) as any[]) {
                            const k = String((r as any)?.ticket_id || "");
                            if (!k) continue;
                            if (!grouped[k]) grouped[k] = [];
                            grouped[k].push({
                                id: String((r as any)?.id),
                                ticket_id: k,
                                author_role: String((r as any)?.author_role) as any,
                                message: String((r as any)?.message || ""),
                                created_at: String((r as any)?.created_at || ""),
                            });
                        }
                        setTicketReplies(grouped);
                    }
                } else {
                    setTicketReplies({});
                }

                const usernames = Array.from(new Set(ticketRows.map((x) => String(x.from_user || "").trim()).filter(Boolean)));
                if (usernames.length > 0) {
                    const { data: profileRows } = await supabase.from("profiles").select("id, username").in("username", usernames);
                    const nextMap: Record<string, string> = {};
                    for (const row of profileRows || []) {
                        const k = String((row as any)?.username || "");
                        const id = String((row as any)?.id || "");
                        if (k && id) nextMap[k] = id;
                    }
                    setUsernameToId(nextMap);
                } else {
                    setUsernameToId({});
                }
            } else {
                console.error("AdminPage: Tickets load failed:", ticketsRes.reason);
                setTickets([]);
                setUsernameToId({});
            }

            if (deletionsRes.status === 'fulfilled') {
                const d = deletionsRes.value as any;
                if (d?.error) console.error("AdminPage: Silme talepleri çekme hatası:", d.error);
                setDeletionRequests(d?.data || []);
            } else {
                console.error("AdminPage: Deletions load failed:", deletionsRes.reason);
                setDeletionRequests([]);
            }

            // 2) Kullanıcılar listesi sadece gerektiğinde
            if (fetchUsers) {
                console.log("AdminPage: Kullanıcılar listesi isteniyor...");
                try {
                    const uData = await withTimeout(fetchUsersFromAdminApi(), 10000, "usersListApi");
                    console.log("AdminPage: Kullanıcılar (api):", uData?.length || 0);
                    setUsers(uData || []);
                } catch (e) {
                    console.warn("AdminPage: users api failed, falling back to profiles:", e);
                    const uData = await withTimeout(getAllUsers(), 10000, "usersList");
                    console.log("AdminPage: Kullanıcılar (fallback):", uData?.length || 0);
                    setUsers(uData || []);
                }

                try {
                    const dData = await withTimeout(fetchDeletedUsersFromAdminApi(), 10000, "deletedUsersApi");
                    const approvedRows = await fetchApprovedDeletionRequestsAsDeleted();
                    const cache = readDeletedUsersCache();
                    const mergedRows = mergeDeletedRows(dData || [], approvedRows, cache);
                    setDeletedUsers(mergedRows);
                    writeDeletedUsersCache(mergedRows);
                } catch (e) {
                    console.warn("AdminPage: deleted users api failed, trying approved deletion requests fallback:", e);
                    const approvedRows = await fetchApprovedDeletionRequestsAsDeleted();
                    const cache = readDeletedUsersCache();
                    const mergedRows = mergeDeletedRows(approvedRows, cache);
                    setDeletedUsers(mergedRows);
                    writeDeletedUsersCache(mergedRows);
                }
            }

        } catch (err) {
            console.error("AdminPage: Veri yükleme sırasında kritik hata:", err);
        } finally {
            console.log("AdminPage: Yükleme bitti.");
            setLoading(false);
        }
    };

    const handleApproveDeletion = async (requestId: string, targetUserId: string) => {
        if (!confirm("BU HESABI KALICI OLARAK SİLMEK İSTEDİĞİNİZE EMİN MİSİNİZ? Bu işlem geri alınamaz.")) return;
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !sessionData?.session?.access_token) {
            alert("Oturum alınamadı. Lütfen tekrar giriş yapın.");
            return;
        }
        const resp = await fetch(`/api/admin/deletion-requests?t=${Date.now()}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({ requestId: Number(requestId), action: "approve", targetUserId }),
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            alert("Silme talebi onaylanamadı: " + String((json as any)?.details || (json as any)?.error || resp.status));
            return;
        }
        alert("Hesap silme talebi onaylandı ve kullanıcı silindi.");
        loadData({ fetchUsers: true });
    };

    const handleRejectDeletion = async (requestId: string) => {
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !sessionData?.session?.access_token) {
            alert("Oturum alınamadı. Lütfen tekrar giriş yapın.");
            return;
        }
        const resp = await fetch(`/api/admin/deletion-requests?t=${Date.now()}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({ requestId: Number(requestId), action: "reject" }),
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            alert("Silme talebi reddedilemedi: " + String((json as any)?.details || (json as any)?.error || resp.status));
            return;
        }
        loadData({ fetchUsers: true });
    };

    const handleRestoreDeletedUser = async (row: DeletedUserRow) => {
        if (!confirm(`${row.username} kullanıcısını geri almak istiyor musunuz?`)) return;
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !sessionData?.session?.access_token) {
            alert("Oturum alınamadı. Lütfen tekrar giriş yapın.");
            return;
        }
        const resp = await fetch(`/api/admin/deleted-users?t=${Date.now()}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({ archiveId: Number(row.id) }),
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            alert("Kullanıcı geri alınamadı: " + String((json as any)?.details || (json as any)?.error || resp.status));
            return;
        }
        alert(`Kullanıcı geri alındı.\nKullanıcı adı: ${String((json as any)?.username || "")}\nE-posta: ${String((json as any)?.email || "")}\nGeçici şifre: ${String((json as any)?.tempPassword || "")}`);
        loadData({ fetchUsers: true });
    };

    useEffect(() => {
        console.log("AdminPage: Auth Durumu:", { authLoading, userCode: user?.username, userRole: user?.role });

        if (authLoading) return;

        if (!user) {
            console.log("AdminPage: Kullanıcı yok, login'e gidiliyor.");
            router.push("/login");
            return;
        }

        if (user.role !== "admin") {
            console.log("AdminPage: YETKİSİZ GİRİŞ! Rol:", user.role);
            alert("Bu sayfaya erişim yetkiniz yok. Yönetici değilsiniz.");
            router.push("/");
            return;
        }

        console.log("AdminPage: Veriler yükleniyor...");
        loadData({ fetchUsers: false });
    }, [user, router, authLoading]);

    useEffect(() => {
        const next = parseTabFromUrl(searchParams.get("tab"));
        if (!next) return;
        if (activeTab === next) return;
        setActiveTab(next);
    }, [searchParams]);

    useEffect(() => {
        const current = parseTabFromUrl(searchParams.get("tab"));
        if (current === activeTab) return;
        router.replace(`/admin?tab=${activeTab}`);
    }, [activeTab]);

    useEffect(() => {
        if (!user || user.role !== 'admin') return;
        if (activeTab !== 'users') return;
        if (users.length > 0) return;
        loadData({ fetchUsers: true });
    }, [activeTab]);

    useEffect(() => {
        let isMounted = true;
        hydrateSiteConfigFromRemote().then((remoteConfig) => {
            if (!isMounted || !remoteConfig) return;
            setSiteConfig(remoteConfig);
        });
        return () => {
            isMounted = false;
        };
    }, []);

    const handleBan = async (u: PlatformUser) => {
        if (!u.id) return;
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !sessionData?.session?.access_token) {
            alert("Oturum alınamadı. Lütfen tekrar giriş yapın.");
            return;
        }
        const resp = await fetch(`/api/admin/users/${u.id}?t=${Date.now()}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({ isBanned: !u.isBanned }),
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            alert("Engelleme işlemi başarısız: " + String((json as any)?.details || (json as any)?.error || resp.status));
            return;
        }
        loadData({ fetchUsers: true });
    };

    const handleDelete = async (u: PlatformUser) => {
        if (!u.id || !confirm(`${u.username} kullanıcısını silmek istediğinize emin misiniz?`)) return;
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !sessionData?.session?.access_token) {
            alert("Oturum alınamadı. Lütfen tekrar giriş yapın.");
            return;
        }
        const resp = await fetch(`/api/admin/users/${u.id}?t=${Date.now()}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${sessionData.session.access_token}`,
            },
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            alert("Kullanıcı silme işlemi başarısız: " + String((json as any)?.details || (json as any)?.error || resp.status));
            return;
        }
        const nowIso = new Date().toISOString();
        const newRow: DeletedUserRow = {
            id: -Date.now(),
            original_user_id: String(u.id || ""),
            username: String(u.username || ""),
            email: String(u.email || ""),
            role: String(u.role || ""),
            delete_reason: "Admin panelinden manuel silindi",
            source: "local_cache",
            deleted_at: nowIso,
            restore_status: "deleted",
        };
        const nextDeleted = [newRow, ...deletedUsers];
        setDeletedUsers(nextDeleted);
        writeDeletedUsersCache(nextDeleted);
        loadData({ fetchUsers: true });
    };

    const handleUpdate = async (u: PlatformUser, field: "email" | "password" | "username") => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!u.id || !uuidRegex.test(u.id)) {
            alert(`Geçersiz kullanıcı ID (UUID değil): ${String(u.id)}`);
            return;
        }
        const newValue = prompt(
            `${u.username} için yeni ${field}:`,
            field === "email" ? u.email : field === "username" ? u.username : ""
        );
        if (newValue && u.id) {
            if (field === "password" || field === "email" || field === "username") {
                const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
                if (sessionErr || !sessionData?.session?.access_token) {
                    alert("Oturum alınamadı. Lütfen tekrar giriş yapın.");
                    return;
                }

                const resp = await fetch(`/api/admin/users/${u.id}?t=${Date.now()}`,
                    {
                        method: "PATCH",
                        cache: "no-store",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${sessionData.session.access_token}`,
                        },
                        body: JSON.stringify(
                            field === "password"
                                ? { password: newValue }
                                : field === "email"
                                    ? { email: newValue }
                                    : { username: newValue }
                        ),
                    }
                );

                const json = await resp.json().catch(() => ({}));
                if (!resp.ok) {
                    const received = Object.prototype.hasOwnProperty.call(json || {}, "received")
                        ? ` (gelen id: ${String((json as any).received)})`
                        : "";
                    const label = field === "password" ? "Şifre" : "E-posta";
                    alert(label + " güncelleme başarısız: " + (json?.details || json?.error || resp.status) + received + ` (ui id: ${u.id})`);
                    return;
                }

                const authEmail = json?.email ? String(json.email) : "";
                if (field === "password") {
                    alert("Şifre güncellendi." + (authEmail ? ` Giriş için e-posta: ${authEmail}` : ""));
                } else {
                    const label = field === "email" ? "E-posta" : "Kullanıcı adı";
                    alert(label + " güncellendi." + (field === "email" && authEmail ? ` Yeni e-posta: ${authEmail}` : ""));
                }
                loadData({ fetchUsers: true });
                return;
            }

            const res = await updateUserInfo(u.id, { [field]: newValue });
            if ((res as any)?.ok === false) {
                alert("Güncelleme başarısız: " + (((res as any)?.error?.message) || "RLS/izin hatası"));
                return;
            }

            loadData();
        }
    };

    const replyToTicket = async (ticketId: string) => {
        const replyText = replyInputs[ticketId];
        if (!replyText?.trim()) return;

        const nowIso = new Date().toISOString();
        const ticketIdNum = Number(ticketId);
        if (!Number.isFinite(ticketIdNum)) {
            alert("Hata: Geçersiz ticket id");
            return;
        }

        const insertReplyRes = await supabase
            .from("support_ticket_replies")
            .insert({
                ticket_id: ticketIdNum,
                author_role: "admin",
                message: replyText,
            })
            .select("id")
            .maybeSingle();

        if (insertReplyRes.error) {
            alert("Hata: " + insertReplyRes.error.message);
            return;
        }

        const { error: touchErr } = await supabase
            .from("support_tickets")
            .update({
                status: "replied",
                replied_at: nowIso,
                reply: replyText,
            })
            .eq("id", ticketId);

        if (touchErr) {
            alert("Hata: " + touchErr.message);
            return;
        }

        setReplyInputs((prev) => ({ ...prev, [ticketId]: "" }));
        setReplySuccess(ticketId);
        setTimeout(() => setReplySuccess(null), 3000);
        loadData();
    };

    const closeTicket = async (ticketId: string) => {
        await supabase.from('support_tickets').update({ status: 'closed' }).eq('id', ticketId);
        loadData();
    };

    const deleteTicket = async (ticketId: string) => {
        if (!ticketId) return;
        if (!confirm("Bu destek talebini kalıcı olarak silmek istediğinize emin misiniz?")) return;

        try {
            const ticketIdNum = Number(ticketId);
            if (!Number.isFinite(ticketIdNum) || ticketIdNum <= 0) {
                throw new Error("Geçersiz ticket id");
            }
            await callModeration({ action: "delete_support_ticket", ticketId: ticketIdNum });

            setTickets((prev) => prev.filter((t) => String(t.id) !== String(ticketId)));
            setTicketReplies((prev) => {
                const next = { ...prev };
                delete next[String(ticketId)];
                return next;
            });
            alert("Destek talebi silindi.");
            loadData();
        } catch (e: any) {
            alert("Ticket silinemedi: " + String(e?.message || e));
        }
    };

    const handleDeactivateFreelancerGigs = async (freelancerId: string) => {
        if (!freelancerId) return;
        if (!confirm("Freelancer kullanicisinin tum aktif ilanlarini pasife almak istediginize emin misiniz?")) return;
        try {
            await callModeration({ action: "deactivate_user_gigs", targetUserId: freelancerId });
            alert("Freelancer ilanlari pasife alindi.");
        } catch (e: any) {
            alert("Islem basarisiz: " + String(e?.message || e));
        }
    };

    const handleBanEmployer = async (employerId: string) => {
        if (!employerId) return;
        if (!confirm("Musteri hesabini engellemek istediginize emin misiniz?")) return;
        try {
            await callModeration({ action: "set_user_ban", targetUserId: employerId, banned: true });
            alert("Musteri hesabi engellendi.");
            loadData({ fetchUsers: true });
        } catch (e: any) {
            alert("Islem basarisiz: " + String(e?.message || e));
        }
    };

    // Auth hâlâ yükleniyor - bekle
    if (authLoading) return (
        <div className="h-screen flex items-center justify-center bg-gray-50 uppercase font-black text-xs tracking-widest animate-pulse">
            Oturum Kontrol Ediliyor...
        </div>
    );

    // Auth yüklendi ama user yok veya admin değil - useEffect zaten yönlendirecek
    if (!user || user.role !== "admin") return (
        <div className="h-screen flex items-center justify-center bg-gray-50 uppercase font-black text-xs tracking-widest animate-pulse">
            Yetki Kontrol Ediliyor...
        </div>
    );

    // Admin verisi yükleniyor
    if (loading) return (
        <div className="h-screen flex items-center justify-center bg-gray-50 uppercase font-black text-xs tracking-widest animate-pulse">
            Veriler Yükleniyor...
        </div>
    );

    const openTicketsCount = tickets.filter(t => t.status === "open").length;
    const bannedUsers = users.filter((u) => !!u.isBanned);

    return (
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading flex items-center gap-3 uppercase">
                    <Shield className="h-8 w-8 text-red-600" /> Yönetim Paneli
                </h1>
                <p className="text-[10px] sm:text-xs text-gray-400 font-bold mt-1">Hoş geldiniz, {user.username}. Platform yönetim alanı.</p>
            </div>

            {/* Tabs */}
            <div className="mb-8 border-b -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
                <div className="flex w-max min-w-full gap-1 sm:gap-2">
                    {[
                    { key: "overview" as const, label: "📊 Genel Bakış", count: null },
                    { key: "users" as const, label: "👥 Üyeler", count: totalUsersCount },
                    { key: "support" as const, label: "🎧 Destek", count: openTicketsCount > 0 ? openTicketsCount : null },
                    { key: "payouts" as const, label: "💸 Ödeme Talepleri", count: null },
                    { key: "deletions" as const, label: "⚠️ Silme Talepleri", count: deletionRequests.length > 0 ? deletionRequests.length : null },
                    { key: "categories" as const, label: "📂 Kategoriler", count: null },
                    { key: "site_settings" as const, label: "⚙️ Site Ayarları", count: null },
                    ].map(tab => (
                    tab.key === "categories" ? (
                        <Link
                            key={tab.key}
                            href="/admin/categories"
                            prefetch
                            className={`px-3 sm:px-5 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors relative whitespace-nowrap ${activeTab === tab.key
                                ? "border-blue-600 text-blue-600"
                                : "border-transparent text-gray-400 hover:text-gray-700"
                                }`}
                        >
                            {tab.label}
                        </Link>
                    ) : tab.key === "payouts" ? (
                        <Link
                            key={tab.key}
                            href="/admin/payouts"
                            prefetch
                            className={`px-3 sm:px-5 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors relative whitespace-nowrap ${activeTab === tab.key
                                ? "border-blue-600 text-blue-600"
                                : "border-transparent text-gray-400 hover:text-gray-700"
                                }`}
                        >
                            {tab.label}
                        </Link>
                    ) : (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-3 sm:px-5 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors relative whitespace-nowrap ${activeTab === tab.key
                                ? "border-blue-600 text-blue-600"
                                : "border-transparent text-gray-400 hover:text-gray-700"
                                }`}
                        >
                            {tab.label}
                            {tab.count !== null && (
                                <span className={`ml-2 text-[8px] px-1.5 py-0.5 rounded-full font-bold ${tab.key === "support" && openTicketsCount > 0
                                    ? "bg-red-100 text-red-600"
                                    : "bg-gray-100 text-gray-500"
                                    }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    )
                ))}
                </div>
            </div>

            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div className="bg-white border rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                                    <Users className="h-5 w-5" />
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase">Toplam Üye</span>
                            </div>
                            <div className="text-3xl font-black text-gray-900">{users.length}</div>
                        </div>

                        <div className="bg-white border rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                    <Users className="h-5 w-5" />
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase">Freelancerlar</span>
                            </div>
                            <div className="text-3xl font-black text-gray-900">{stats?.totalFreelancers || 0}</div>
                        </div>

                        <div className="bg-white border rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                    <Briefcase className="h-5 w-5" />
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase">İş Verenler</span>
                            </div>
                            <div className="text-3xl font-black text-gray-900">{stats?.totalEmployers || 0}</div>
                        </div>

                        <div className="bg-white border rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-10 w-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                                    <Headphones className="h-5 w-5" />
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase">Açık Destek</span>
                            </div>
                            <div className="text-3xl font-black text-gray-900">{openTicketsCount}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 text-black">
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-6 sm:p-8 text-white shadow-2xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 group cursor-pointer hover:scale-[1.02] transition-all" onClick={() => router.push("/admin/categories")}>
                            <div>
                                <h3 className="text-2xl font-black uppercase mb-2">Kategori Yönetimi</h3>
                                <p className="text-white/80 font-bold text-sm leading-relaxed">Platformdaki tüm hizmet ve kategorileri buradan düzenleyebilir veya yeni eklemeler yapabilirsin.</p>
                                <Button className="mt-6 bg-white text-blue-700 font-black rounded-xl group-hover:bg-blue-50 px-8 h-12">HEMEN YÖNET →</Button>
                            </div>
                            <TrendingUp className="h-16 w-16 sm:h-24 sm:w-24 opacity-20 transition-transform group-hover:scale-110 self-end lg:self-auto" />
                        </div>

                        <div className="bg-white border-2 border-red-100 rounded-[2rem] p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 group cursor-pointer hover:bg-red-50 transition-all" onClick={() => setActiveTab("deletions")}>
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 uppercase mb-2">Silme Talepleri</h3>
                                <p className="text-gray-400 font-bold text-sm leading-relaxed">Hesabını kapatmak isteyen {deletionRequests.length} kullanıcı bekliyor.</p>
                                <Button variant="outline" className="mt-6 border-red-200 text-red-600 font-black rounded-xl hover:bg-red-600 hover:text-white px-8 h-12">TALEPLERİ GÖR</Button>
                            </div>
                            <Trash2 className="h-16 w-16 sm:h-24 sm:w-24 text-red-100 transition-transform group-hover:scale-110 self-end lg:self-auto" />
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-white border rounded-[2rem] p-5 sm:p-8 shadow-sm">
                        <h3 className="font-black text-gray-900 text-lg uppercase mb-6 tracking-tight">Son Destek Talepleri</h3>
                        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                            {tickets.slice(0, 5).map(ticket => (
                                <div key={ticket.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all">
                                    <div className={`h-12 w-12 rounded-full flex items-center justify-center text-xs font-black text-white ${ticket.status === "open" ? "bg-orange-500" : ticket.status === "replied" ? "bg-emerald-500" : "bg-gray-400"
                                        }`}>
                                        {ticket.from_user.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-gray-900 uppercase truncate">{ticket.subject}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase truncate">{ticket.from_user} • {ticket.category}</p>
                                    </div>
                                    <div className="flex items-center gap-2 sm:ml-2">
                                        <span className={`text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest w-fit ${ticket.status === "open" ? "bg-orange-50 text-orange-600" :
                                            ticket.status === "replied" ? "bg-emerald-50 text-emerald-600" :
                                                "bg-gray-50 text-gray-400"
                                            }`}>
                                            {ticket.status === "open" ? "Açık" : ticket.status === "replied" ? "Yanıtlandı" : "Kapandı"}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 px-3 rounded-lg border-red-100 text-red-600 hover:bg-red-600 hover:text-white font-black text-[10px] uppercase tracking-widest"
                                            onClick={() => deleteTicket(ticket.id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Sil
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {tickets.length === 0 && (
                                <div className="text-center py-12">
                                    <MessageCircle className="h-12 w-12 text-gray-100 mx-auto mb-3" />
                                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Henüz aktivite yok.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* USERS TAB */}
            {activeTab === "users" && (
                <div className="bg-white border rounded-[2rem] overflow-hidden shadow-sm">
                    <div className="p-5 sm:p-8 border-b flex items-center justify-between bg-gray-50/30">
                        <div>
                            <h3 className="font-black text-gray-900 text-lg uppercase tracking-tight">Kayıtlı Üyeler ({users.length})</h3>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Platformdaki tüm kullanıcıları yönetin</p>
                        </div>
                    </div>

                    <div className="p-5 sm:p-8 border-b bg-white">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-700 mb-3">
                                    Engellenmiş Üyeler ({bannedUsers.length})
                                </h4>
                                {bannedUsers.length === 0 ? (
                                    <p className="text-xs font-bold text-orange-500">Engelli kullanıcı bulunmuyor.</p>
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-auto pr-1">
                                        {bannedUsers.map((u) => (
                                            <div key={`banned-${u.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-white border border-orange-100 px-3 py-2">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black text-gray-900 truncate">{u.username}</p>
                                                    <p className="text-[10px] text-gray-500 truncate">{u.email}</p>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 px-3 text-[10px] font-black rounded-lg bg-emerald-50 text-emerald-700 border-emerald-100"
                                                    onClick={() => handleBan(u)}
                                                >
                                                    Engel Kaldır
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-700 mb-3">
                                    Silinmiş Üyeler ({deletedUsers.length})
                                </h4>
                                {deletedUsers.length === 0 ? (
                                    <p className="text-xs font-bold text-blue-500">Silinmiş kullanıcı arşivi boş.</p>
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-auto pr-1">
                                        {deletedUsers.map((d) => (
                                            <div key={`deleted-${d.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-white border border-blue-100 px-3 py-2">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black text-gray-900 truncate">{d.username}</p>
                                                    <p className="text-[10px] text-gray-500 truncate">{d.email}</p>
                                                    {d.source === "legacy_approved_request" && (
                                                        <p className="text-[10px] text-orange-600 font-black">Eski kayıt (arşiv yok)</p>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={d.source === "legacy_approved_request" || d.restore_status !== "deleted"}
                                                    className="h-8 px-3 text-[10px] font-black rounded-lg bg-blue-600 text-white border-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-500 disabled:border-gray-200"
                                                    onClick={() => handleRestoreDeletedUser(d)}
                                                >
                                                    Geri Al
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 border-b">
                                    <th className="p-6">Kullanıcı</th>
                                    <th className="p-6">Rol</th>
                                    <th className="p-6">Durum</th>
                                    <th className="p-6">Kayıt</th>
                                    <th className="p-6 text-right">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {users.map((u) => (
                                    <tr key={u.id} className="hover:bg-gray-50/80 transition-colors">
                                        <td className="p-6">
                                            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => router.push(`/admin/users/${u.id}`)}>
                                                <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-black text-sm shadow-sm group-hover:ring-2 group-hover:ring-blue-400 transition-all ${u.role === "admin" ? "bg-red-600" : u.role === "freelancer" ? "bg-emerald-500" : "bg-blue-600"}`}>
                                                    {u.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-black text-sm text-gray-900 group-hover:text-blue-600 transition-colors">{u.username}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold">{u.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest ${u.role === "admin" ? "bg-red-50 text-red-600" : u.role === "freelancer" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}>
                                                {u.role === "admin" ? "Yönetici" : u.role === "freelancer" ? "Freelancer" : "İş Veren"}
                                            </span>
                                        </td>
                                        <td className="p-6">
                                            {u.isBanned ? (
                                                <span className="text-[10px] font-black text-red-500 bg-red-100 px-3 py-1 rounded-lg uppercase">Engelli</span>
                                            ) : (
                                                <span className="text-[10px] font-black text-emerald-500 bg-emerald-100 px-3 py-1 rounded-lg uppercase">Aktif</span>
                                            )}
                                        </td>
                                        <td className="p-6 text-[10px] font-black uppercase text-gray-400">
                                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString("tr-TR") : "—"}
                                        </td>
                                        <td className="p-6 text-right">
                                            <div className="flex flex-wrap items-center justify-end gap-2">
                                                <Button variant="outline" size="sm" className="h-9 px-4 text-[10px] font-black border-gray-100 hover:bg-black hover:text-white rounded-xl uppercase" onClick={() => handleUpdate(u, 'username')}>Kullanıcı</Button>
                                                <Button variant="outline" size="sm" className="h-9 px-4 text-[10px] font-black border-gray-100 hover:bg-black hover:text-white rounded-xl uppercase" onClick={() => handleUpdate(u, 'email')}>E-posta</Button>
                                                <Button variant="outline" size="sm" className="h-9 px-4 text-[10px] font-black border-gray-100 hover:bg-black hover:text-white rounded-xl uppercase" onClick={() => handleUpdate(u, 'password')}>Şifre</Button>
                                                <Button variant="outline" size="sm" disabled={u.role === "admin"} className={`h-9 px-4 text-[10px] font-black rounded-xl uppercase ${u.isBanned ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-orange-50 text-orange-600 border-orange-100"}`} onClick={() => handleBan(u)}>{u.isBanned ? "Kaldır" : "Engelle"}</Button>
                                                <Button variant="outline" size="icon" disabled={u.role === "admin"} className="h-9 w-9 text-gray-300 hover:text-red-500 hover:bg-red-50 border-gray-100 rounded-xl" onClick={() => handleDelete(u)}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* SUPPORT TAB */}
            {activeTab === "support" && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6 text-center shadow-sm">
                            <Clock className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                            <div className="text-3xl font-black text-orange-700">{openTicketsCount}</div>
                            <div className="text-[10px] font-black uppercase tracking-widest">Açık Talepler</div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center shadow-sm">
                            <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                            <div className="text-3xl font-black text-emerald-700">{tickets.filter(t => t.status === 'replied').length}</div>
                            <div className="text-[10px] font-black uppercase tracking-widest">Yanıtlanan</div>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center shadow-sm">
                            <MessageCircle className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                            <div className="text-3xl font-black text-blue-700">{tickets.length}</div>
                            <div className="text-[10px] font-black uppercase tracking-widest">Toplam</div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {tickets.map(ticket => {
                            const sec = parseSecurityMeta(ticket.message);
                            const fromUserId = sec.callerId || usernameToId[ticket.from_user] || "";
                            const freelancerId = sec.callerRole === "freelancer" ? sec.callerId : sec.otherRole === "freelancer" ? sec.otherId : "";
                            const employerId = sec.callerRole === "employer" ? sec.callerId : sec.otherRole === "employer" ? sec.otherId : "";
                            const ticketMessageUrls = extractUrls(ticket.message);
                            const ticketMessageBody = stripUrls(ticket.message);
                            return (
                            <div key={ticket.id} className={`bg-white border rounded-[2rem] overflow-hidden shadow-sm transition-all ${ticket.status === 'open' ? 'border-l-8 border-l-orange-500' : 'border-l-8 border-l-emerald-500'}`}>
                                <div className="p-5 sm:p-8">
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="h-14 w-14 rounded-full bg-black text-white flex items-center justify-center text-xl font-black uppercase">
                                                {ticket.from_user.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-black text-gray-900 uppercase tracking-tight">
                                                    {fromUserId ? (
                                                        <Link href={`/admin/users/${fromUserId}`} className="hover:underline text-blue-700">
                                                            {ticket.from_user}
                                                        </Link>
                                                    ) : (
                                                        ticket.from_user
                                                    )}
                                                </p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{ticket.from_email} • {new Date(ticket.created_at).toLocaleString("tr-TR")}</p>
                                                {sec.otherUsername && (
                                                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">
                                                        Hedef: {sec.otherId ? (
                                                            <Link href={`/admin/users/${sec.otherId}`} className="text-blue-700 hover:underline">
                                                                {sec.otherUsername}
                                                            </Link>
                                                        ) : sec.otherUsername}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest ${ticket.status === 'open' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                {ticket.status === 'open' ? '⏳ Açık' : '✅ Yanıtlandı'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <h4 className="font-black text-gray-900 text-lg uppercase mb-3 tracking-tight">{ticket.subject}</h4>
                                        <div className="bg-gray-50 border border-gray-100 p-6 rounded-2xl text-sm font-bold text-gray-600 leading-relaxed shadow-inner">
                                            {ticketMessageBody || (ticketMessageUrls.length > 0 ? "" : ticket.message)}
                                        </div>
                                        {ticketMessageUrls.length > 0 ? (
                                            <div className="mt-4">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Ek Dosyalar</p>
                                                <div className="space-y-2">
                                                    {ticketMessageUrls.map((u) => (
                                                        <div key={u} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                                            <a
                                                                href={u}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="flex items-center gap-3 hover:opacity-90"
                                                            >
                                                                <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                                                                    <FileText className="h-5 w-5 text-blue-600" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-black text-slate-900 truncate">{displayNameFromUrl(u)}</p>
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                                        {isImageUrl(u) ? "Görsel" : "Dosya"}
                                                                    </p>
                                                                </div>
                                                            </a>
                                                            {isImageUrl(u) ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img src={u} alt="Ek görsel" className="mt-3 rounded-xl max-h-72 w-auto border border-slate-200 bg-white" />
                                                            ) : null}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>

                                    {Array.isArray(ticketReplies[String(ticket.id)]) && ticketReplies[String(ticket.id)].length > 0 && (
                                        <div className="mt-6 p-6 bg-slate-50 border border-slate-100 rounded-2xl">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Konuşma Geçmişi</p>
                                            <div className="space-y-3">
                                                {ticketReplies[String(ticket.id)].map((r) => {
                                                    const urls = extractUrls(r.message);
                                                    const body = stripUrls(r.message);
                                                    return (
                                                        <div
                                                            key={r.id}
                                                            className={`rounded-2xl p-4 border ${
                                                                r.author_role === "user"
                                                                    ? "bg-white border-gray-100"
                                                                    : "bg-slate-900 border-slate-700"
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                                                <div className={`text-[10px] font-black uppercase tracking-widest ${
                                                                    r.author_role === "user" ? "text-gray-500" : "text-white"
                                                                }`}>
                                                                    {r.author_role === "user" ? "Kullanıcı" : "Admin"}
                                                                </div>
                                                                <div className={`text-[10px] font-black uppercase tracking-widest ${
                                                                    r.author_role === "user" ? "text-gray-300" : "text-white"
                                                                }`}>
                                                                    {r.created_at ? new Date(r.created_at).toLocaleString("tr-TR") : ""}
                                                                </div>
                                                            </div>

                                                            <div className={`mt-2 text-sm font-bold whitespace-pre-wrap leading-relaxed ${
                                                                r.author_role === "user" ? "text-gray-700" : "text-white"
                                                            }`}>{body || (urls.length > 0 ? "" : r.message)}</div>

                                                            {urls.length > 0 ? (
                                                                <div className="mt-3 space-y-2">
                                                                    {urls.map((u) => (
                                                                        <div key={u} className="rounded-xl border border-slate-200 bg-white/80 p-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ek</span>
                                                                                <a
                                                                                    href={u}
                                                                                    target="_blank"
                                                                                    rel="noreferrer"
                                                                                    className="text-sm font-black text-blue-700 hover:underline break-all"
                                                                                >
                                                                                    {displayNameFromUrl(u)}
                                                                                </a>
                                                                            </div>
                                                                            {isImageUrl(u) ? (
                                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                                <img src={u} alt="Ek" className="mt-3 rounded-xl max-h-72 w-auto" />
                                                                            ) : null}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {(freelancerId || employerId) && (
                                        <div className="mt-6 flex flex-wrap items-center gap-3">
                                            {freelancerId && (
                                                <Button
                                                    variant="outline"
                                                    className="h-10 px-4 text-[10px] font-black uppercase rounded-xl bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                                                    onClick={() => handleDeactivateFreelancerGigs(freelancerId)}
                                                >
                                                    Freelancer ilanlarini pasife al
                                                </Button>
                                            )}
                                            {employerId && (
                                                <Button
                                                    variant="outline"
                                                    className="h-10 px-4 text-[10px] font-black uppercase rounded-xl bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                                                    onClick={() => handleBanEmployer(employerId)}
                                                >
                                                    Musteriyi engelle
                                                </Button>
                                            )}
                                        </div>
                                    )}

                                    {ticket.reply && (
                                        <div className="mt-6 p-6 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">📩 Gönderilen Yanıt:</p>
                                            <p className="text-sm font-bold text-emerald-800 leading-relaxed">{ticket.reply}</p>
                                            <p className="text-[9px] text-emerald-400 mt-4 font-black uppercase tracking-widest">{new Date(ticket.replied_at!).toLocaleString("tr-TR")}</p>
                                        </div>
                                    )}

                                    {ticket.status !== 'closed' && (
                                    <div className="mt-8 space-y-4">
                                            <Textarea
                                                placeholder="Resmi yanıtınızı buraya yazın..."
                                                value={replyInputs[ticket.id] || ""}
                                                onChange={(e) => setReplyInputs(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                                                className="min-h-[120px] rounded-2xl border-gray-100 font-bold text-sm bg-gray-50/30 focus:bg-white transition-all shadow-inner"
                                            />
                                            <div className="flex flex-col sm:flex-row gap-4">
                                                <Button onClick={() => replyToTicket(ticket.id)} className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest h-14 px-8 rounded-2xl shadow-xl shadow-blue-100 transition-all hover:scale-[1.02] w-full sm:w-auto">
                                                    <Send className="h-5 w-5 mr-3" /> Yanıtı Gönder
                                                </Button>
                                                <Button variant="outline" onClick={() => closeTicket(ticket.id)} className="h-14 px-8 rounded-2xl border-gray-100 text-gray-400 font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all w-full sm:w-auto">
                                                    Talebi Kapat
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {/* DELETIONS TAB */}
            {activeTab === "deletions" && (
                <div className="bg-white border rounded-[2rem] overflow-hidden shadow-sm">
                    <div className="p-5 sm:p-8 border-b bg-red-50/30">
                        <h3 className="font-black text-gray-900 text-lg uppercase tracking-tight">Hesap Silme Talepleri ({deletionRequests.length})</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Kullanıcıların hesap kapatma isteklerini onaylayın veya reddedin.</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 border-b">
                                    <th className="p-6">Kullanıcı</th>
                                    <th className="p-6">Sebep</th>
                                    <th className="p-6">Tarih</th>
                                    <th className="p-6 text-right">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {deletionRequests.map((req) => (
                                    <tr key={req.id} className="hover:bg-red-50/20 transition-colors">
                                        <td className="p-6">
                                            <p className="font-black text-sm text-gray-900 uppercase">{req.username}</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase">{req.email}</p>
                                        </td>
                                        <td className="p-6 text-sm font-bold text-gray-600">
                                            {req.reason || "Belirtilmedi"}
                                        </td>
                                        <td className="p-6 text-[10px] font-black uppercase text-gray-400">
                                            {new Date(req.created_at).toLocaleDateString("tr-TR")}
                                        </td>
                                        <td className="p-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="outline"
                                                    className="h-10 px-6 bg-red-600 text-white border-transparent hover:bg-red-700 font-black rounded-xl uppercase text-[10px] tracking-widest"
                                                    onClick={() => handleApproveDeletion(req.id, req.user_id)}
                                                >
                                                    Onayla & Sil
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="h-10 px-6 border-gray-100 text-gray-400 font-black rounded-xl uppercase text-[10px] tracking-widest hover:bg-gray-50"
                                                    onClick={() => handleRejectDeletion(String(req.id))}
                                                >
                                                    Reddet
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {deletionRequests.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <CheckCircle2 className="h-12 w-12 text-emerald-100" />
                                                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Bekleyen silme talebi bulunmuyor.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {/* SITE SETTINGS TAB */}
            {activeTab === "site_settings" && (
                <div className="space-y-8 animate-in fade-in duration-500">
                    <div className="bg-white border rounded-[2.5rem] p-5 sm:p-10 shadow-sm border-slate-100">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 pb-4 border-b">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase">Genel Site Yapılandırması</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Sitenin ismini, logosunu ve temel bilgilerini buradan yönetin.</p>
                            </div>
                            <Button
                                onClick={async () => {
                                    await saveSiteConfig(siteConfig);
                                    alert("Site ayarları kaydedildi.");
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl px-6 sm:px-10 h-12 sm:h-14 w-full sm:w-auto"
                            >
                                <Save className="w-5 h-5 mr-3" /> AYARLARI KAYDET
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Site İsmi</label>
                                    <Input
                                        value={siteConfig.siteName}
                                        onChange={(e) => setSiteConfig({ ...siteConfig, siteName: e.target.value })}
                                        className="h-14 rounded-2xl border-slate-200 font-bold text-lg px-6"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Logo Yolu (URL)</label>
                                    <Input
                                        value={siteConfig.logoUrl}
                                        onChange={(e) => setSiteConfig({ ...siteConfig, logoUrl: e.target.value })}
                                        className="h-14 rounded-2xl border-slate-200 font-bold text-lg px-6"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Favicon Yolu (URL)</label>
                                    <Input
                                        value={siteConfig.faviconUrl || ""}
                                        onChange={(e) => setSiteConfig({ ...siteConfig, faviconUrl: e.target.value })}
                                        className="h-14 rounded-2xl border-slate-200 font-bold text-lg px-6"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Footer Açıklaması</label>
                                    <Textarea
                                        value={siteConfig.footerDescription || ""}
                                        onChange={(e) => setSiteConfig({ ...siteConfig, footerDescription: e.target.value })}
                                        className="rounded-2xl border-slate-200 font-semibold text-sm px-6 min-h-[100px]"
                                    />
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">İletişim E-postası</label>
                                    <Input
                                        value={siteConfig.contactEmail}
                                        onChange={(e) => setSiteConfig({ ...siteConfig, contactEmail: e.target.value })}
                                        className="h-14 rounded-2xl border-slate-200 font-bold text-lg px-6"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">İletişim Telefonu</label>
                                    <Input
                                        value={siteConfig.contactPhone}
                                        onChange={(e) => setSiteConfig({ ...siteConfig, contactPhone: e.target.value })}
                                        className="h-14 rounded-2xl border-slate-200 font-bold text-lg px-6"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">İletişim Adresi</label>
                                    <Textarea
                                        value={siteConfig.contactAddress || ""}
                                        onChange={(e) => setSiteConfig({ ...siteConfig, contactAddress: e.target.value })}
                                        className="rounded-2xl border-slate-200 font-semibold text-sm px-6 min-h-[100px]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Özel CSS</label>
                                    <Textarea
                                        value={siteConfig.customCss || ""}
                                        onChange={(e) => setSiteConfig({ ...siteConfig, customCss: e.target.value })}
                                        placeholder=".hero-title { letter-spacing: 0.02em; }"
                                        className="rounded-2xl border-slate-200 font-mono text-xs px-6 min-h-[120px]"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white border rounded-[2.5rem] p-5 sm:p-10 shadow-sm border-slate-100">
                            <h3 className="text-xl font-black text-slate-900 uppercase mb-6 flex items-center gap-3">
                                <Layout className="w-6 h-6 text-blue-600" /> Üst Menü (Header)
                            </h3>
                            <div className="space-y-4">
                                {siteConfig.headerLinks.map((link, i) => (
                                    <div key={i} className="flex gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <Input
                                            value={link.label}
                                            onChange={(e) => {
                                                const next = [...siteConfig.headerLinks];
                                                next[i].label = e.target.value;
                                                setSiteConfig({ ...siteConfig, headerLinks: next });
                                            }}
                                            placeholder="Menü Adı"
                                            className="flex-1 bg-white border-slate-200 font-bold"
                                        />
                                        <Input
                                            value={link.href}
                                            onChange={(e) => {
                                                const next = [...siteConfig.headerLinks];
                                                next[i].href = e.target.value;
                                                setSiteConfig({ ...siteConfig, headerLinks: next });
                                            }}
                                            placeholder="/sayfa"
                                            className="flex-1 bg-white border-slate-200 font-mono text-xs"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                const next = siteConfig.headerLinks.filter((_, idx) => idx !== i);
                                                setSiteConfig({ ...siteConfig, headerLinks: next });
                                            }}
                                            className="text-red-400 hover:text-red-600"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    variant="outline"
                                    className="w-full h-14 border-dashed border-2 rounded-2xl font-bold uppercase text-[10px] tracking-widest text-slate-400 hover:border-blue-500 hover:text-blue-500"
                                    onClick={() => {
                                        setSiteConfig({ ...siteConfig, headerLinks: [...siteConfig.headerLinks, { label: "Yeni Link", href: "/" }] });
                                    }}
                                >
                                    <Plus className="w-4 h-4 mr-2" /> Yeni Menü Öğesi Ekle
                                </Button>
                            </div>
                        </div>

                        <div className="bg-white border rounded-[2.5rem] p-5 sm:p-10 shadow-sm border-slate-100">
                            <h3 className="text-xl font-black text-slate-900 uppercase mb-6 flex items-center gap-3">
                                <Palette className="w-6 h-6 text-purple-600" /> Alt Menü (Footer)
                            </h3>
                            <div className="space-y-4">
                                {siteConfig.footerLinks.map((link, i) => (
                                    <div key={i} className="flex gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <Input
                                            value={link.label}
                                            onChange={(e) => {
                                                const next = [...siteConfig.footerLinks];
                                                next[i].label = e.target.value;
                                                setSiteConfig({ ...siteConfig, footerLinks: next });
                                            }}
                                            className="flex-1 bg-white border-slate-200 font-bold"
                                        />
                                        <Input
                                            value={link.href}
                                            onChange={(e) => {
                                                const next = [...siteConfig.footerLinks];
                                                next[i].href = e.target.value;
                                                setSiteConfig({ ...siteConfig, footerLinks: next });
                                            }}
                                            className="flex-1 bg-white border-slate-200 font-mono text-xs"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                const next = siteConfig.footerLinks.filter((_, idx) => idx !== i);
                                                setSiteConfig({ ...siteConfig, footerLinks: next });
                                            }}
                                            className="text-red-400 hover:text-red-600"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    variant="outline"
                                    className="w-full h-14 border-dashed border-2 rounded-2xl font-bold uppercase text-[10px] tracking-widest text-slate-400 hover:border-purple-500 hover:text-purple-500"
                                    onClick={() => {
                                        setSiteConfig({ ...siteConfig, footerLinks: [...siteConfig.footerLinks, { label: "Yeni Link", href: "/" }] });
                                    }}
                                >
                                    <Plus className="w-4 h-4 mr-2" /> Yeni Menü Öğesi Ekle
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white border rounded-[2.5rem] p-5 sm:p-10 shadow-sm border-slate-100">
                            <h3 className="text-xl font-black text-slate-900 uppercase mb-6 flex items-center gap-3">
                                <Globe className="w-6 h-6 text-cyan-600" /> Sosyal Linkler
                            </h3>
                            <div className="space-y-4">
                                {(siteConfig.socialLinks || []).map((link, i) => (
                                    <div key={i} className="flex gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <Input
                                            value={link.label}
                                            onChange={(e) => {
                                                const next = [...(siteConfig.socialLinks || [])];
                                                next[i].label = e.target.value;
                                                setSiteConfig({ ...siteConfig, socialLinks: next });
                                            }}
                                            placeholder="Platform"
                                            className="flex-1 bg-white border-slate-200 font-bold"
                                        />
                                        <Input
                                            value={link.href}
                                            onChange={(e) => {
                                                const next = [...(siteConfig.socialLinks || [])];
                                                next[i].href = e.target.value;
                                                setSiteConfig({ ...siteConfig, socialLinks: next });
                                            }}
                                            placeholder="https://..."
                                            className="flex-1 bg-white border-slate-200 font-mono text-xs"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                const next = (siteConfig.socialLinks || []).filter((_, idx) => idx !== i);
                                                setSiteConfig({ ...siteConfig, socialLinks: next });
                                            }}
                                            className="text-red-400 hover:text-red-600"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    variant="outline"
                                    className="w-full h-14 border-dashed border-2 rounded-2xl font-bold uppercase text-[10px] tracking-widest text-slate-400 hover:border-cyan-500 hover:text-cyan-500"
                                    onClick={() => {
                                        setSiteConfig({ ...siteConfig, socialLinks: [...(siteConfig.socialLinks || []), { label: "Yeni Sosyal", href: "https://" }] });
                                    }}
                                >
                                    <Plus className="w-4 h-4 mr-2" /> Sosyal Link Ekle
                                </Button>
                            </div>
                        </div>

                        <div className="bg-white border rounded-[2.5rem] p-5 sm:p-10 shadow-sm border-slate-100">
                            <h3 className="text-xl font-black text-slate-900 uppercase mb-6 flex items-center gap-3">
                                <Layout className="w-6 h-6 text-emerald-600" /> Sayfa Yönetimi
                            </h3>
                            <div className="space-y-4">
                                {(siteConfig.managedPages || []).map((page, i) => (
                                    <div key={page.id || i} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <Input
                                                value={page.title}
                                                onChange={(e) => {
                                                    const next = [...(siteConfig.managedPages || [])];
                                                    next[i] = { ...next[i], title: e.target.value };
                                                    setSiteConfig({ ...siteConfig, managedPages: next });
                                                }}
                                                placeholder="Sayfa Başlığı"
                                                className="bg-white border-slate-200 font-bold"
                                            />
                                            <Input
                                                value={page.menuLabel}
                                                onChange={(e) => {
                                                    const next = [...(siteConfig.managedPages || [])];
                                                    next[i] = { ...next[i], menuLabel: e.target.value };
                                                    setSiteConfig({ ...siteConfig, managedPages: next });
                                                }}
                                                placeholder="Menü Etiketi"
                                                className="bg-white border-slate-200 font-bold"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <Input
                                                value={page.slug}
                                                onChange={(e) => {
                                                    const next = [...(siteConfig.managedPages || [])];
                                                    next[i] = { ...next[i], slug: e.target.value.startsWith("/") ? e.target.value : `/${e.target.value}` };
                                                    setSiteConfig({ ...siteConfig, managedPages: next });
                                                }}
                                                placeholder="/pages/ornek"
                                                className="bg-white border-slate-200 font-mono text-xs"
                                                disabled={page.system}
                                            />
                                            <Input
                                                value={page.summary}
                                                onChange={(e) => {
                                                    const next = [...(siteConfig.managedPages || [])];
                                                    next[i] = { ...next[i], summary: e.target.value };
                                                    setSiteConfig({ ...siteConfig, managedPages: next });
                                                }}
                                                placeholder="Kısa açıklama"
                                                className="bg-white border-slate-200"
                                            />
                                        </div>
                                        <Textarea
                                            value={page.content}
                                            onChange={(e) => {
                                                const next = [...(siteConfig.managedPages || [])];
                                                next[i] = { ...next[i], content: e.target.value };
                                                setSiteConfig({ ...siteConfig, managedPages: next });
                                            }}
                                            placeholder="Sayfa içeriği..."
                                            className="bg-white border-slate-200 min-h-[120px]"
                                        />
                                        <div className="flex flex-wrap items-center gap-4 text-xs font-black uppercase tracking-wider text-slate-500">
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={!!page.enabled}
                                                    onChange={(e) => {
                                                        const next = [...(siteConfig.managedPages || [])];
                                                        next[i] = { ...next[i], enabled: e.target.checked };
                                                        setSiteConfig({ ...siteConfig, managedPages: next });
                                                    }}
                                                />
                                                Aktif
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={!!page.showInHeader}
                                                    onChange={(e) => {
                                                        const next = [...(siteConfig.managedPages || [])];
                                                        next[i] = { ...next[i], showInHeader: e.target.checked };
                                                        setSiteConfig({ ...siteConfig, managedPages: next });
                                                    }}
                                                />
                                                Header menüde göster
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={!!page.showInFooter}
                                                    onChange={(e) => {
                                                        const next = [...(siteConfig.managedPages || [])];
                                                        next[i] = { ...next[i], showInFooter: e.target.checked };
                                                        setSiteConfig({ ...siteConfig, managedPages: next });
                                                    }}
                                                />
                                                Footer menüde göster
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={!!page.overrideBuiltIn}
                                                    onChange={(e) => {
                                                        const next = [...(siteConfig.managedPages || [])];
                                                        next[i] = { ...next[i], overrideBuiltIn: e.target.checked };
                                                        setSiteConfig({ ...siteConfig, managedPages: next });
                                                    }}
                                                />
                                                Mevcut sayfayı bu içerikle değiştir
                                            </label>
                                            {!page.system && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-500 hover:text-red-600 ml-auto"
                                                    onClick={() => {
                                                        const next = (siteConfig.managedPages || []).filter((_, idx) => idx !== i);
                                                        setSiteConfig({ ...siteConfig, managedPages: next });
                                                    }}
                                                >
                                                    Sil
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <Button
                                    variant="outline"
                                    className="w-full h-14 border-dashed border-2 rounded-2xl font-bold uppercase text-[10px] tracking-widest text-slate-400 hover:border-emerald-500 hover:text-emerald-500"
                                    onClick={() => {
                                        const id = `page-${Date.now()}`;
                                        setSiteConfig({
                                            ...siteConfig,
                                            managedPages: [
                                                ...(siteConfig.managedPages || []),
                                                {
                                                    id,
                                                    title: "Yeni Sayfa",
                                                    menuLabel: "Yeni Sayfa",
                                                    slug: `/pages/${id}`,
                                                    summary: "Kısa açıklama",
                                                    content: "Bu sayfayı buradan düzenleyebilirsiniz.",
                                                    enabled: true,
                                                    showInHeader: true,
                                                    showInFooter: false,
                                                    overrideBuiltIn: false,
                                                } as any,
                                            ],
                                        });
                                    }}
                                >
                                    <Plus className="w-4 h-4 mr-2" /> Yeni Sayfa Ekle
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-[3rem] p-6 sm:p-12 text-white shadow-2xl relative overflow-hidden">
                        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
                            <div className="max-w-xl">
                                <h3 className="text-3xl font-black uppercase italic mb-4">Duyuru Yönetimi</h3>
                                <p className="text-white/60 font-medium leading-relaxed">Sitenin en üstünde kurumsal bir duyuru bandı yayınlayarak önemli gelişmeleri bildirin.</p>

                                <div className="mt-8 space-y-6">
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="checkbox"
                                            checked={siteConfig.announcement.enabled}
                                            onChange={(e) => setSiteConfig({ ...siteConfig, announcement: { ...siteConfig.announcement, enabled: e.target.checked } })}
                                            className="w-6 h-6 rounded accent-blue-600"
                                        />
                                        <span className="font-bold uppercase text-[10px] tracking-widest">Duyuruyu Aktifleştir</span>
                                    </div>
                                    <Textarea
                                        value={siteConfig.announcement.text}
                                        onChange={(e) => setSiteConfig({ ...siteConfig, announcement: { ...siteConfig.announcement, text: e.target.value } })}
                                        placeholder="Duyuru metni..."
                                        className="bg-white/5 border-white/10 rounded-2xl p-6 font-bold text-lg min-h-[120px] text-white"
                                    />
                                </div>
                            </div>
                            <div className="w-full md:w-[320px] bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem]">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-6">Tema Seçimi</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    {["blue", "red", "orange", "slate"].map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setSiteConfig({ ...siteConfig, announcement: { ...siteConfig.announcement, theme: t as any } })}
                                            className={`h-16 rounded-2xl flex items-center justify-center font-black uppercase text-xs transition-all ${siteConfig.announcement.theme === t ? 'ring-4 ring-white shadow-xl scale-105' : 'opacity-40 hover:opacity-100'
                                                } ${t === 'blue' ? 'bg-blue-600' : t === 'red' ? 'bg-red-600' : t === 'orange' ? 'bg-orange-600' : 'bg-slate-700'
                                                }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AdminPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>Yükleniyor...</p></div>}>
            <AdminPageContent />
        </Suspense>
    );
}


