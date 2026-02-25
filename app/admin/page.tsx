"use client";

import { useAuth } from "@/components/auth/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAllUsers, getPlatformStats, toggleBanUser, deleteUserAccount, updateUserInfo, type PlatformUser, type PlatformStats } from "@/lib/data-service";
import { Users, Briefcase, TrendingUp, Shield, Trash2, Headphones, MessageCircle, CheckCircle2, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
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

export default function AdminPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState<PlatformUser[]>([]);
    const [usersSource, setUsersSource] = useState<"api" | "fallback" | "">("");
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [totalUsersCount, setTotalUsersCount] = useState(0);
    const [activeTab, setActiveTab] = useState<"overview" | "users" | "support" | "categories" | "deletions">("overview");
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [usernameToId, setUsernameToId] = useState<Record<string, string>>({});
    const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
    const [replySuccess, setReplySuccess] = useState<string | null>(null);
    const [deletionRequests, setDeletionRequests] = useState<any[]>([]);

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
        if (!confirm("BU HESABI KALICI OLARAK SİLMEK İSTEDİĞİNİZE EMİN MİSİNİZ? Bu işlem geri alınamaz.")) return;

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
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-8 text-white shadow-2xl flex items-center justify-between group cursor-pointer hover:scale-[1.02] transition-all" onClick={() => router.push("/admin/categories")}>
                            <div>
                                <h3 className="text-2xl font-black uppercase mb-2">Kategori Yönetimi</h3>
                                <p className="text-white/80 font-bold text-sm leading-relaxed">Platformdaki tüm hizmet ve kategorileri buradan düzenleyebilir veya yeni eklemeler yapabilirsin.</p>
                                <Button className="mt-6 bg-white text-blue-700 font-black rounded-xl group-hover:bg-blue-50 px-8 h-12">HEMEN YÖNET →</Button>
                            </div>
                            <TrendingUp className="h-24 w-24 opacity-20 transition-transform group-hover:scale-110" />
                        </div>

                        <div className="bg-white border-2 border-red-100 rounded-[2rem] p-8 flex items-center justify-between group cursor-pointer hover:bg-red-50 transition-all" onClick={() => setActiveTab("deletions")}>
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 uppercase mb-2">Silme Talepleri</h3>
                                <p className="text-gray-400 font-bold text-sm leading-relaxed">Hesabını kapatmak isteyen {deletionRequests.length} kullanıcı bekliyor.</p>
                                <Button variant="outline" className="mt-6 border-red-200 text-red-600 font-black rounded-xl hover:bg-red-600 hover:text-white px-8 h-12">TALEPLERİ GÖR</Button>
                            </div>
                            <Trash2 className="h-24 w-24 text-red-100 transition-transform group-hover:scale-110" />
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-white border rounded-[2rem] p-8 shadow-sm">
                        <h3 className="font-black text-gray-900 text-lg uppercase mb-6 tracking-tight">Son Destek Talepleri</h3>
                        <div className="space-y-4">
                            {tickets.slice(0, 5).map(ticket => (
                                <div key={ticket.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all">
                                    <div className={`h-12 w-12 rounded-full flex items-center justify-center text-xs font-black text-white ${ticket.status === "open" ? "bg-orange-500" : ticket.status === "replied" ? "bg-emerald-500" : "bg-gray-400"
                                        }`}>
                                        {ticket.from_user.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-gray-900 uppercase truncate">{ticket.subject}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">{ticket.from_user} • {ticket.category}</p>
                                    </div>
                                    <span className={`text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest ${ticket.status === "open" ? "bg-orange-50 text-orange-600" :
                                        ticket.status === "replied" ? "bg-emerald-50 text-emerald-600" :
                                            "bg-gray-50 text-gray-400"
                                        }`}>
                                        {ticket.status === "open" ? "Açık" : ticket.status === "replied" ? "Yanıtlandı" : "Kapandı"}
                                    </span>
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
                    <div className="p-8 border-b flex items-center justify-between bg-gray-50/30">
                        <div>
                            <h3 className="font-black text-gray-900 text-lg uppercase tracking-tight">Kayıtlı Üyeler ({users.length})</h3>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Platformdaki tüm kullanıcıları yönetin</p>
                            {usersSource === "fallback" && (
                                <p className="text-[10px] text-orange-600 font-black uppercase mt-2">
                                    Uyarı: Kullanıcı listesi Auth API yerine sadece profiles tablosundan geldiği için e-posta/kullanıcı adı yanlış görünebilir.
                                </p>
                            )}
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
                                            <div className="flex items-center justify-end gap-2">
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
                            <div className="text-[10px] text-orange-600 font-black uppercase tracking-widest">Açık Talepler</div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center shadow-sm">
                            <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                            <div className="text-3xl font-black text-emerald-700">{tickets.filter(t => t.status === 'replied').length}</div>
                            <div className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Yanıtlanan</div>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center shadow-sm">
                            <MessageCircle className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                            <div className="text-3xl font-black text-blue-700">{tickets.length}</div>
                            <div className="text-[10px] text-blue-600 font-black uppercase tracking-widest">Toplam</div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {tickets.map(ticket => {
                            const sec = parseSecurityMeta(ticket.message);
                            const fromUserId = sec.callerId || usernameToId[ticket.from_user] || "";
                            const freelancerId = sec.callerRole === "freelancer" ? sec.callerId : sec.otherRole === "freelancer" ? sec.otherId : "";
                            const employerId = sec.callerRole === "employer" ? sec.callerId : sec.otherRole === "employer" ? sec.otherId : "";
                            return (
                            <div key={ticket.id} className={`bg-white border rounded-[2rem] overflow-hidden shadow-sm transition-all ${ticket.status === 'open' ? 'border-l-8 border-l-orange-500' : 'border-l-8 border-l-emerald-500'}`}>
                                <div className="p-8">
                                    <div className="flex items-start justify-between gap-4 mb-6">
                                        <div className="flex items-center gap-4">
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
                                        <div className="bg-gray-50 border border-gray-100 p-6 rounded-2xl text-sm font-bold text-gray-600 leading-relaxed shadow-inner whitespace-pre-wrap break-words">
                                            {ticket.message}
                                        </div>
                                        {(freelancerId || employerId) && (
                                            <div className="mt-4 flex flex-wrap gap-2">
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
                                    </div>

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
                                            <div className="flex gap-4">
                                                <Button onClick={() => replyToTicket(ticket.id)} className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest h-14 px-8 rounded-2xl shadow-xl shadow-blue-100 transition-all hover:scale-[1.02]">
                                                    <Send className="h-5 w-5 mr-3" /> Yanıtı Gönder
                                                </Button>
                                                <Button variant="outline" onClick={() => closeTicket(ticket.id)} className="h-14 px-8 rounded-2xl border-gray-100 text-gray-400 font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all">
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
                    <div className="p-8 border-b bg-red-50/30">
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
                                                    onClick={async () => {
                                                        await supabase.from('account_deletion_requests').update({ status: 'rejected' }).eq('id', req.id);
                                                        loadData();
                                                    }}
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
        </div>
    );
}
