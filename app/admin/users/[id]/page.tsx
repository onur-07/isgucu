"use client";

import { useAuth } from "@/components/auth/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
    ArrowLeft, User, Mail, Phone, Globe, MapPin, CreditCard, Shield,
    Briefcase, Package, CheckCircle2, XCircle, Clock, AlertTriangle,
    Star, MessageCircle, Calendar, TrendingUp, Ban, Eye, Trash2
} from "lucide-react";
import Link from "next/link";
import { toggleBanUser, deleteUserAccount } from "@/lib/data-service";
import { maskFullName } from "@/lib/utils";

interface UserDetail {
    id: string;
    username: string;
    email: string;
    fullName: string;
    role: string;
    bio: string;
    skills: string[];
    location: string;
    hourlyRate: string;
    phone: string;
    website: string;
    iban: string;
    avatarUrl: string;
    isBanned: boolean;
    createdAt: string;
}

interface Order {
    id: number;
    gig_id: number;
    buyer_id: string;
    seller_id: string;
    buyer_username: string;
    seller_username: string;
    package_key: string;
    total_price: number;
    total_days: number;
    status: "pending" | "active" | "delivered" | "completed" | "cancelled";
    created_at: string;
}

interface Ticket {
    id: number;
    from_user: string;
    from_email: string;
    subject: string;
    category: string;
    message: string;
    status: "open" | "replied" | "closed";
    reply?: string;
    created_at: string;
}

export default function AdminUserDetailPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const userId = params?.id as string;

    const [detail, setDetail] = useState<UserDetail | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [gigs, setGigs] = useState<any[]>([]);
    const [jobs, setJobs] = useState<any[]>([]);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeSection, setActiveSection] = useState<"overview" | "orders" | "gigs" | "tickets">("overview");

    useEffect(() => {
        if (authLoading) return;
        if (!user || user.role !== "admin") {
            router.push("/");
            return;
        }
        if (!userId) return;

        const fetchDetail = async () => {
            try {
                const { data: sessionData } = await supabase.auth.getSession();
                if (!sessionData?.session?.access_token) {
                    setError("Oturum bulunamadı.");
                    setLoading(false);
                    return;
                }

                const resp = await fetch(`/api/admin/users/${userId}`, {
                    headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
                });

                const json = await resp.json();
                if (!resp.ok) {
                    setError(json?.error || "Bilinmeyen hata");
                    setLoading(false);
                    return;
                }

                setDetail(json.user);
                setOrders(json.orders || []);
                setGigs(json.gigs || []);
                setJobs(json.jobs || []);
                setTickets(json.tickets || []);
            } catch (err: any) {
                setError(err.message || "Bağlantı hatası");
            } finally {
                setLoading(false);
            }
        };

        fetchDetail();
    }, [authLoading, user, userId, router]);

    const handleToggleBan = async () => {
        if (!detail) return;
        const confirmMsg = detail.isBanned
            ? `${detail.username} kullanıcısının engelini kaldırmak istediğinize emin misiniz?`
            : `${detail.username} kullanıcısını engellemek istediğinize emin misiniz? Platforma giriş yapamayacaktır.`;

        if (!confirm(confirmMsg)) return;

        try {
            await toggleBanUser(detail.id, detail.isBanned);
            setDetail(prev => prev ? { ...prev, isBanned: !prev.isBanned } : null);
        } catch (err: any) {
            alert("İşlem başarısız: " + err.message);
        }
    };

    const handleDeleteUser = async () => {
        if (!detail) return;
        if (!confirm(`DİKKAT! ${detail.username} kullanıcısını ve TÜM verilerini (ilanlar, mesajlar vb.) kalıcı olarak silmek üzeresiniz. Bu işlem GERİ ALINAMAZ. Emin misiniz?`)) return;

        try {
            await deleteUserAccount(detail.id);
            alert("Kullanıcı başarıyla silindi.");
            router.push("/admin");
        } catch (err: any) {
            alert("Silme işlemi başarısız: " + err.message);
        }
    };

    const callModeration = async (payload: Record<string, any>) => {
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !sessionData?.session?.access_token) {
            throw new Error("Oturum alinamadi.");
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
    };

    const handleDeactivateGig = async (gigId: number) => {
        if (!confirm("Bu freelancer ilanini pasife almak istediginize emin misiniz?")) return;
        try {
            await callModeration({ action: "set_gig_active", gigId, active: false });
            setGigs((prev) =>
                (prev || []).map((g: any) => (Number(g?.id) === Number(gigId) ? { ...g, is_active: false } : g))
            );
        } catch (e: any) {
            alert("Islem basarisiz: " + String(e?.message || e));
        }
    };

    if (authLoading || loading) return (
        <div className="h-screen flex items-center justify-center bg-gray-50 uppercase font-black text-xs tracking-widest animate-pulse">
            Kullanıcı Bilgileri Yükleniyor...
        </div>
    );

    if (error) return (
        <div className="h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
            <AlertTriangle className="h-12 w-12 text-red-500" />
            <p className="text-sm font-bold text-red-600 uppercase">{error}</p>
            <Button onClick={() => router.push("/admin")} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" /> Geri Dön
            </Button>
        </div>
    );

    if (!detail) return null;

    // Order stats
    const completedOrders = orders.filter(o => o.status === "completed");
    const activeOrders = orders.filter(o => o.status === "active" || o.status === "pending");
    const cancelledOrders = orders.filter(o => o.status === "cancelled");
    const deliveredOrders = orders.filter(o => o.status === "delivered");
    const totalEarnings = orders.filter(o => o.seller_id === detail.id && o.status === "completed").reduce((sum, o) => sum + Number(o.total_price || 0), 0);
    const totalSpending = orders.filter(o => o.buyer_id === detail.id && o.status === "completed").reduce((sum, o) => sum + Number(o.total_price || 0), 0);

    const roleBadge = {
        admin: { label: "YÖNETİCİ", color: "bg-red-100 text-red-700 border-red-200" },
        freelancer: { label: "FREELANCER", color: "bg-blue-100 text-blue-700 border-blue-200" },
        employer: { label: "İŞ VEREN", color: "bg-orange-100 text-orange-700 border-orange-200" },
        guest: { label: "MİSAFİR", color: "bg-gray-100 text-gray-700 border-gray-200" },
    }[detail.role] || { label: detail.role, color: "bg-gray-100 text-gray-700" };

    const statusBadge = (status: string) => {
        const map: Record<string, { label: string; color: string; icon: any }> = {
            pending: { label: "Beklemede", color: "bg-yellow-100 text-yellow-700", icon: Clock },
            active: { label: "Aktif", color: "bg-blue-100 text-blue-700", icon: TrendingUp },
            delivered: { label: "Teslim Edildi", color: "bg-purple-100 text-purple-700", icon: Package },
            completed: { label: "Tamamlandı", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
            cancelled: { label: "İptal", color: "bg-red-100 text-red-700", icon: XCircle },
            open: { label: "Açık", color: "bg-yellow-100 text-yellow-700", icon: Clock },
            replied: { label: "Yanıtlandı", color: "bg-green-100 text-green-700", icon: MessageCircle },
            closed: { label: "Kapatıldı", color: "bg-gray-100 text-gray-700", icon: XCircle },
        };
        const s = map[status] || { label: status, color: "bg-gray-100 text-gray-700", icon: Eye };
        const Icon = s.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${s.color}`}>
                <Icon className="h-3 w-3" /> {s.label}
            </span>
        );
    };

    const formatDate = (d: string) => {
        try { return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
        catch { return d; }
    };

    const sections = [
        { key: "overview" as const, label: "Genel Bilgi", icon: User, count: null },
        { key: "orders" as const, label: "Siparişler", icon: Package, count: orders.length },
        { key: "gigs" as const, label: "Hizmetler / İlanlar", icon: Briefcase, count: gigs.length + jobs.length },
        { key: "tickets" as const, label: "Destek Talepleri", icon: MessageCircle, count: tickets.length },
    ];

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            {/* Back Button */}
            <Button variant="ghost" className="mb-6 text-xs font-bold uppercase tracking-widest" onClick={() => router.push("/admin")}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Yönetim Paneline Dön
            </Button>

            {/* User Header */}
            <div className={`rounded-3xl p-8 mb-8 text-white relative overflow-hidden ${detail.role === "freelancer" ? "bg-gradient-to-br from-blue-600 to-indigo-700" :
                detail.role === "employer" ? "bg-gradient-to-br from-orange-500 to-red-600" :
                    detail.role === "admin" ? "bg-gradient-to-br from-slate-700 to-slate-900" :
                        "bg-gradient-to-br from-gray-500 to-gray-700"
                }`}>
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
                <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        {/* Avatar */}
                        <div className="h-24 w-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl font-black border-4 border-white/30 overflow-hidden shrink-0">
                            {detail.avatarUrl ? (
                                <img src={detail.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                                detail.username.charAt(0).toUpperCase()
                            )}
                        </div>
                        <div className="text-center md:text-left">
                            <div className="flex items-center gap-3 justify-center md:justify-start flex-wrap">
                                <h1 className="text-3xl font-black uppercase tracking-tight">{maskFullName(detail.fullName) || detail.username}</h1>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${roleBadge.color}`}>
                                    {roleBadge.label}
                                </span>
                                {detail.isBanned && (
                                    <span className="px-3 py-1 rounded-full text-[10px] font-black bg-red-500 text-white flex items-center gap-1">
                                        <Ban className="h-3 w-3" /> ENGELLİ
                                    </span>
                                )}
                            </div>
                            <p className="text-white/70 text-sm mt-1">@{detail.username} · {detail.email}</p>
                            <p className="text-white/50 text-xs mt-1 flex items-center gap-1 justify-center md:justify-start">
                                <Calendar className="h-3 w-3" /> Kayıt: {formatDate(detail.createdAt)}
                                {detail.location && <> · <MapPin className="h-3 w-3" /> {detail.location}</>}
                            </p>
                        </div>
                    </div>

                    {/* Admin Actions */}
                    <div className="flex flex-wrap gap-2 justify-center">
                        <Button
                            variant="outline"
                            size="sm"
                            className={`h-11 px-6 text-[10px] font-black uppercase rounded-xl border-white/20 hover:bg-white hover:text-black transition-all ${detail.isBanned ? "bg-green-500 text-white border-0" : "bg-white/10 text-white backdrop-blur-md"}`}
                            onClick={handleToggleBan}
                        >
                            {detail.isBanned ? <><CheckCircle2 className="h-4 w-4 mr-2" /> Engeli Kaldır</> : <><Ban className="h-4 w-4 mr-2" /> Kullanıcıyı Engelle</>}
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            className="h-11 px-6 text-[10px] font-black uppercase rounded-xl shadow-lg"
                            onClick={handleDeleteUser}
                        >
                            <Trash2 className="h-4 w-4 mr-2" /> Hesabı Sil
                        </Button>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                {[
                    { label: "Toplam Sipariş", value: orders.length, icon: Package, color: "text-blue-600" },
                    { label: "Tamamlanan", value: completedOrders.length, icon: CheckCircle2, color: "text-green-600" },
                    { label: "Devam Eden", value: activeOrders.length, icon: Clock, color: "text-yellow-600" },
                    { label: "İptal", value: cancelledOrders.length, icon: XCircle, color: "text-red-600" },
                    { label: detail.role === "freelancer" ? "Kazanç" : "Harcama", value: `₺${detail.role === "freelancer" ? totalEarnings : totalSpending}`, icon: TrendingUp, color: "text-emerald-600" },
                ].map((s, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm hover:shadow-md transition-shadow">
                        <s.icon className={`h-5 w-5 mx-auto mb-2 ${s.color}`} />
                        <div className="text-2xl font-black">{s.value}</div>
                        <div className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Section Tabs */}
            <div className="flex gap-2 mb-8 border-b overflow-x-auto pb-1">
                {sections.map((s) => (
                    <button
                        key={s.key}
                        onClick={() => setActiveSection(s.key)}
                        className={`flex items-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${activeSection === s.key
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-gray-400 hover:text-gray-600"
                            }`}
                    >
                        <s.icon className="h-4 w-4" /> {s.label}
                        {s.count !== null && s.count > 0 && (
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px]">{s.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* SECTION: Overview */}
            {activeSection === "overview" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Contact & Financial Info */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <h3 className="text-sm font-black uppercase tracking-wider text-gray-800 mb-4 flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-blue-600" /> İletişim & Finansal Bilgiler
                        </h3>
                        <div className="space-y-4">
                            {[
                                { icon: Mail, label: "E-posta", value: detail.email },
                                { icon: Phone, label: "Telefon", value: detail.phone || "Belirtilmemiş" },
                                { icon: Globe, label: "Website", value: detail.website || "Belirtilmemiş" },
                                { icon: MapPin, label: "Konum", value: detail.location || "Belirtilmemiş" },
                                { icon: Star, label: "Saat Ücreti", value: detail.hourlyRate ? `₺${detail.hourlyRate}/saat` : "Belirtilmemiş" },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <item.icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                    <div>
                                        <div className="text-[10px] font-bold uppercase text-gray-400">{item.label}</div>
                                        <div className="text-sm font-semibold text-gray-800">{item.value}</div>
                                    </div>
                                </div>
                            ))}
                            {/* IBAN - Highlighted with copy feature */}
                            <div
                                className="mt-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100 transition-all group relative"
                                onClick={() => {
                                    if (detail.iban) {
                                        navigator.clipboard.writeText(detail.iban);
                                        alert("IBAN kopyalandı!");
                                    }
                                }}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <CreditCard className="h-4 w-4 text-amber-600" />
                                        <span className="text-[10px] font-black uppercase text-amber-600">IBAN NUMARASI (Kopyalamak için tıkla)</span>
                                    </div>
                                    <Eye className="h-3 w-3 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="text-sm font-mono font-bold text-gray-900 tracking-wider">
                                    {detail.iban || "Kayıtlı IBAN bulunamadı"}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bio & Skills */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <h3 className="text-sm font-black uppercase tracking-wider text-gray-800 mb-4 flex items-center gap-2">
                            <User className="h-4 w-4 text-blue-600" /> Hakkında & Yetenekler
                        </h3>
                        <div className="mb-4">
                            <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Biyografi</div>
                            <p className="text-sm text-gray-700 leading-relaxed italic">
                                {detail.bio || "Henüz biyografi eklenmemiş."}
                            </p>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold uppercase text-gray-400 mb-2">Yetenekler</div>
                            {detail.skills.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {detail.skills.map((skill, i) => (
                                        <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 italic">Yetenek eklenmemiş.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION: Orders */}
            {activeSection === "orders" && (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="text-sm font-black uppercase tracking-wider text-gray-800 mb-6 flex items-center gap-2">
                        <Package className="h-4 w-4 text-blue-600" /> Tüm Siparişler ({orders.length})
                    </h3>
                    {orders.length === 0 ? (
                        <p className="text-center text-gray-400 py-12 uppercase text-xs font-bold">Henüz sipariş bulunmuyor.</p>
                    ) : (
                        <div className="space-y-3">
                            {orders.map((order) => (
                                <div key={order.id} className="border border-gray-100 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <div>
                                            <div className="text-xs font-black text-gray-800 uppercase">
                                                Sipariş #{order.id}
                                            </div>
                                            <div className="text-[10px] text-gray-400 mt-1">
                                                {order.buyer_id === detail.id ? (
                                                    <span>Alıcı → Satıcı: <strong>{order.seller_username}</strong></span>
                                                ) : (
                                                    <span>Satıcı → Alıcı: <strong>{order.buyer_username}</strong></span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {statusBadge(order.status)}
                                            <span className="text-sm font-black text-emerald-600">₺{order.total_price}</span>
                                            <span className="text-[10px] text-gray-400">{formatDate(order.created_at)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* SECTION: Gigs & Jobs */}
            {activeSection === "gigs" && (
                <div className="space-y-6">
                    {/* Gigs */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <h3 className="text-sm font-black uppercase tracking-wider text-gray-800 mb-4 flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-blue-600" /> Freelancer Hizmetleri ({gigs.length})
                        </h3>
                        {gigs.length === 0 ? (
                            <p className="text-center text-gray-400 py-8 uppercase text-xs font-bold">Hizmet bulunamadı.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {gigs.map((gig) => (
                                    <div key={gig.id} className="border border-gray-100 rounded-xl p-4 hover:border-blue-200 transition-all">
                                        <div className="text-sm font-bold text-gray-800">{gig.title}</div>
                                        <div className="text-[10px] text-gray-400 mt-1 uppercase">{gig.category}</div>
                                        <div className="flex items-center justify-between mt-3">
                                            <span className="text-sm font-black text-emerald-600">₺{gig.price}</span>
                                            <span className="text-[10px] text-gray-400">{formatDate(gig.created_at)}</span>
                                        </div>
                                        <div className="mt-3">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-9 px-3 text-[10px] font-black uppercase rounded-xl border-orange-200 text-orange-700 hover:bg-orange-50"
                                                disabled={!gig?.is_active}
                                                onClick={() => handleDeactivateGig(Number(gig.id))}
                                            >
                                                {gig?.is_active ? "Pasife Al" : "Pasif"}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Jobs */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <h3 className="text-sm font-black uppercase tracking-wider text-gray-800 mb-4 flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-orange-600" /> Yayınlanan İş İlanları ({jobs.length})
                        </h3>
                        {jobs.length === 0 ? (
                            <p className="text-center text-gray-400 py-8 uppercase text-xs font-bold">İş ilanı bulunamadı.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {jobs.map((job) => (
                                    <div key={job.id} className="border border-gray-100 rounded-xl p-4 hover:border-orange-200 transition-all">
                                        <div className="text-sm font-bold text-gray-800">{job.title}</div>
                                        <div className="text-[10px] text-gray-400 mt-1 uppercase">{job.category}</div>
                                        <div className="flex items-center justify-between mt-3">
                                            <span className="text-sm font-black text-orange-600">{job.budget}</span>
                                            <span className="text-[10px] text-gray-400">{formatDate(job.created_at)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SECTION: Support Tickets */}
            {activeSection === "tickets" && (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="text-sm font-black uppercase tracking-wider text-gray-800 mb-6 flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-purple-600" /> Destek Talepleri ({tickets.length})
                    </h3>
                    {tickets.length === 0 ? (
                        <p className="text-center text-gray-400 py-12 uppercase text-xs font-bold">Bu kullanıcıya ait destek talebi bulunamadı.</p>
                    ) : (
                        <div className="space-y-4">
                            {tickets.map((ticket) => (
                                <div key={ticket.id} className="border border-gray-100 rounded-xl p-5 hover:border-purple-200 transition-all">
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                {statusBadge(ticket.status)}
                                                <span className="text-[10px] text-gray-400 uppercase">{ticket.category}</span>
                                            </div>
                                            <h4 className="text-sm font-bold text-gray-800">{ticket.subject}</h4>
                                            <p className="text-xs text-gray-500 mt-2 leading-relaxed">{ticket.message}</p>
                                            {ticket.reply && (
                                                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                                    <div className="text-[10px] font-bold uppercase text-green-600 mb-1">Admin Yanıtı:</div>
                                                    <p className="text-xs text-green-800">{ticket.reply}</p>
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-gray-400 flex-shrink-0">{formatDate(ticket.created_at)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
