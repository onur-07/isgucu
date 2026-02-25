"use client";

import { useAuth } from "@/components/auth/auth-context";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { getAllUsers, getPlatformStats, toggleBanUser, deleteUserAccount, updateUserInfo, type PlatformUser, type PlatformStats } from "@/lib/data-service";
import { Users, Briefcase, TrendingUp, Shield, Trash2, Headphones, MessageCircle, CheckCircle2, Clock, Send, Settings, Globe, Layout, Palette, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { getSiteConfig, saveSiteConfig, type SiteConfig, type NavLink } from "@/lib/site-config";
import { Input } from "@/components/ui/input";
import Link from "next/link";

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

function AdminPageContent() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [users, setUsers] = useState<PlatformUser[]>([]);
    const [usersSource, setUsersSource] = useState<"api" | "fallback" | "">("");
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [totalUsersCount, setTotalUsersCount] = useState(0);
    const [activeTab, setActiveTab] = useState<"overview" | "users" | "support" | "categories" | "deletions" | "site_settings">("overview");
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [usernameToId, setUsernameToId] = useState<Record<string, string>>({});
    const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
    const [replySuccess, setReplySuccess] = useState<string | null>(null);
    const [deletionRequests, setDeletionRequests] = useState<any[]>([]);
    const [siteConfig, setSiteConfig] = useState<SiteConfig>(getSiteConfig());

    const parseTabFromUrl = (raw: string | null) => {
        const v = String(raw || "").trim();
        if (v === "overview" || v === "users" || v === "support" || v === "deletions" || v === "site_settings") return v;
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
                    setUsersSource("api");
                } catch (e) {
                    console.warn("AdminPage: users api failed, falling back to profiles:", e);
                    const uData = await withTimeout(getAllUsers(), 10000, "usersList");
                    console.log("AdminPage: Kullanıcılar (fallback):", uData?.length || 0);
                    setUsers(uData || []);
                    setUsersSource("fallback");
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
        if (!confirm("BU HESABI KALICI OLARAK SİLMEK İSTEDİĞİNİZE EMİN MİSİZ? Bu işlem geri alınamaz.")) return;

        // 1. Mark request as approved
        await supabase.from('account_deletion_requests').update({ status: 'approved' }).eq('id', requestId);

        // 2. Delete from profiles
        const { error } = await supabase.from('profiles').delete().eq('id', targetUserId);

        if (!error) {
            alert("Hesap başarıyla silindi.");
            loadData();
        } else {
            alert("Hata: " + error.message);
        }
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    useEffect(() => {
        const current = parseTabFromUrl(searchParams.get("tab"));
        if (current === activeTab) return;
        router.replace(`/admin?tab=${activeTab}`);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    useEffect(() => {
        if (!user || user.role !== 'admin') return;
        if (activeTab !== 'users') return;
        if (users.length > 0) return;
        loadData({ fetchUsers: true });
    }, [activeTab]);

    const handleBan = async (u: PlatformUser) => {
        if (!u.id) return;
        await toggleBanUser(u.id, !!u.isBanned);
        loadData();
    };

    const handleDelete = async (u: PlatformUser) => {
        if (!u.id || !confirm(`${u.username} kullanıcısını silmek istediğinize emin misiniz?`)) return;
        await deleteUserAccount(u.id);
        loadData();
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

        const { error } = await supabase
            .from('support_tickets')
            .update({
                reply: replyText,
                status: 'replied',
                replied_at: new Date().toISOString()
            })
            .eq('id', ticketId);

        if (!error) {
            setReplyInputs(prev => ({ ...prev, [ticketId]: "" }));
            setReplySuccess(ticketId);
            setTimeout(() => setReplySuccess(null), 3000);
            loadData();
        }
    };

    const closeTicket = async (ticketId: string) => {
        await supabase.from('support_tickets').update({ status: 'closed' }).eq('id', ticketId);
        loadData();
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

    // Auth hâlâ yükleniyor — bekle
    if (authLoading) return (
        <div className="h-screen flex items-center justify-center bg-gray-50 uppercase font-black text-xs tracking-widest animate-pulse">
            Oturum Kontrol Ediliyor...
        </div>
    );

    // Auth yüklendi ama user yok veya admin değil — useEffect zaten yönlendirecek
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

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-heading flex items-center gap-3 uppercase">
                    <Shield className="h-8 w-8 text-red-600" /> Yönetim Paneli
                </h1>
                <p className="text-[10px] text-gray-400 font-bold mt-1">Hoş geldiniz, {user.username}. Platform yönetim alanı.</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-8 border-b">
                {[
                    { key: "overview" as const, label: "📊 Genel Bakış", count: null },
                    { key: "users" as const, label: "👥 Üyeler", count: totalUsersCount },
                    { key: "support" as const, label: "🎧 Destek", count: openTicketsCount > 0 ? openTicketsCount : null },
                    { key: "deletions" as const, label: "⚠️ Silme Talepleri", count: deletionRequests.length > 0 ? deletionRequests.length : null },
                    { key: "categories" as const, label: "📂 Kategoriler", count: null },
                    { key: "site_settings" as const, label: "⚙️ Site Ayarları", count: null },
                ].map(tab => (
                    tab.key === "categories" ? (
                        <Link
                            key={tab.key}
                            href="/admin/categories"
                            prefetch
                            className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors relative whitespace-nowrap ${activeTab === tab.key
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
                            className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors relative whitespace-nowrap ${activeTab === tab.key
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

            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
                <>
                    {/* (Overview code same as before) */}
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
                        {/* ... rest of overview ... */}
                    </div>
                </>
            )}

            {/* USERS TAB */}
            {activeTab === "users" && (
                <div className="bg-white border rounded-[2rem] overflow-hidden shadow-sm">
                    {/* ... users table code ... */}
                </div>
            )}

            {/* SUPPORT TAB */}
            {activeTab === "support" && (
                <div className="space-y-6">
                    {/* ... support tickets code ... */}
                </div>
            )}

            {/* DELETIONS TAB */}
            {activeTab === "deletions" && (
                <div className="bg-white border rounded-[2rem] overflow-hidden shadow-sm">
                    {/* ... deletions code ... */}
                </div>
            )}

            {/* SITE SETTINGS TAB */}
            {activeTab === "site_settings" && (
                <div className="space-y-8 animate-in fade-in duration-500">
                    <div className="bg-white border rounded-[2.5rem] p-10 shadow-sm border-slate-100">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase">Genel Site Yapılandırması</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Sitenin ismini, logosunu ve temel bilgilerini buradan yönetin.</p>
                            </div>
                            <Button
                                onClick={() => {
                                    saveSiteConfig(siteConfig);
                                    alert("Site ayarları başarıyla kaydedildi ve tüm kullanıcılara yansıtıldı!");
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl px-10 h-14"
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
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white border rounded-[2.5rem] p-10 shadow-sm border-slate-100">
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

                        <div className="bg-white border rounded-[2.5rem] p-10 shadow-sm border-slate-100">
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

                    <div className="bg-slate-900 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden">
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
