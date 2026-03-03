"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { maskFullName, usernameFold, usernameKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-context";
import { Menu, X, Bell, MessageCircle, User, ChevronDown } from "lucide-react";
import { getSiteConfig, hydrateSiteConfigFromRemote } from "@/lib/site-config";
import { supabase } from "@/lib/supabase";

export function Header() {
    const { user, logout, loading } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [notifCount, setNotifCount] = useState(0);
    const [orderApprovalCount, setOrderApprovalCount] = useState(0);
    const [supportReplyCount, setSupportReplyCount] = useState(0);
    const [siteConfig, setSiteConfig] = useState(getSiteConfig());

    const handleLogout = async () => {
        setProfileOpen(false);
        setMobileOpen(false);
        await logout();
    };

    const updateCounts = useCallback(() => {
        if (!user) return;
        const key = `isgucu_notifications_${usernameKey(user.username)}`;
        const legacyKey = `isgucu_notifications_${user.username}`;
        const initKey = `isgucu_notifications_init_${usernameKey(user.username)}`;

        let raw = localStorage.getItem(key);
        if (!raw) {
            const legacyRaw = localStorage.getItem(legacyKey);
            if (legacyRaw) {
                localStorage.setItem(key, legacyRaw);
                localStorage.setItem(initKey, "1");
                try {
                    localStorage.removeItem(legacyKey);
                } catch { }
                raw = legacyRaw;
            }
        }

        if (!raw) {
            if (localStorage.getItem(initKey) === "1") {
                setNotifCount(0);
                return;
            }
            const defaultNotifs = [
                {
                    id: "welcome-" + Date.now(),
                    type: "system",
                    title: "Hoş Geldiniz!",
                    description: "İşgücü platformuna hoş geldiniz. Sizi aramızda görmekten mutluyuz!",
                    time: new Date().toLocaleString("tr-TR"),
                    read: false,
                },
            ];
            localStorage.setItem(key, JSON.stringify(defaultNotifs));
            localStorage.setItem(initKey, "1");
            setNotifCount(defaultNotifs.length);
            return;
        }
        const notifications = JSON.parse(raw) as Array<{ read?: boolean }>;
        const unread = notifications.filter((n) => !n.read).length;
        setNotifCount(unread);
    }, [user]);

    const upsertLocalNotification = useCallback(
        (payload: {
            id: string;
            type: "message" | "order" | "review" | "system";
            title: string;
            description: string;
            actionUrl?: string;
            actionLabel?: string;
        }) => {
            if (!user) return;
            const key = `isgucu_notifications_${usernameKey(user.username)}`;
            const initKey = `isgucu_notifications_init_${usernameKey(user.username)}`;

            let list: any[] = [];
            try {
                const raw = localStorage.getItem(key);
                list = raw ? (JSON.parse(raw) as any[]) : [];
            } catch {
                list = [];
            }

            if (list.some((n) => String(n?.id) === String(payload.id))) return;

            const next = [
                {
                    id: payload.id,
                    type: payload.type,
                    title: payload.title,
                    description: payload.description,
                    time: new Date().toLocaleString("tr-TR"),
                    read: false,
                    actionUrl: payload.actionUrl,
                    actionLabel: payload.actionLabel,
                },
                ...list,
            ];

            localStorage.setItem(key, JSON.stringify(next));
            localStorage.setItem(initKey, "1");
            window.dispatchEvent(new Event("storage_updated"));
        },
        [user]
    );

    const handleConfigUpdate = useCallback(() => {
        setSiteConfig(getSiteConfig());
    }, []);

    const updateOrderApprovalCount = useCallback(async () => {
        if (!user || (user.role !== "employer" && user.role !== "freelancer")) {
            setOrderApprovalCount(0);
            return;
        }

        const raw = String(user.username || "").trim();
        if (!raw) {
            setOrderApprovalCount(0);
            return;
        }
        const k = usernameKey(raw);
        const f = usernameFold(raw);

        const base = supabase
            .from("orders")
            .select("id", { count: "exact", head: true });

        const res = user.role === "employer"
            ? await base
                .eq("status", "delivered")
                .or(
                    `buyer_id.eq.${user.id},buyer_username.ilike.${raw},buyer_username.ilike.${k},buyer_username.ilike.${f}`
                )
            : await base
                .in("status", ["pending", "active", "delivered"])
                .or(
                    `seller_id.eq.${user.id},seller_username.ilike.${raw},seller_username.ilike.${k},seller_username.ilike.${f}`
                );

        if (res.error) {
            setOrderApprovalCount(0);
            return;
        }
        setOrderApprovalCount(Number(res.count || 0));
    }, [user]);

    const updateSupportReplyCount = useCallback(async () => {
        if (!user) {
            setSupportReplyCount(0);
            return;
        }

        const meU = String(user.username || "").trim();
        const meE = String(user.email || "").trim();
        if (!meU && !meE) {
            setSupportReplyCount(0);
            return;
        }

        const seenKey = `isgucu_support_reply_seen_${usernameKey(user.username)}`;
        let seen: Record<string, string> = {};
        try {
            const raw = localStorage.getItem(seenKey);
            if (raw) seen = JSON.parse(raw);
        } catch {
            seen = {};
        }

        const res = await supabase
            .from("support_tickets")
            .select("id, replied_at")
            .or(`from_user.eq.${meU},from_email.eq.${meE}`)
            .not("reply", "is", null)
            .order("replied_at", { ascending: false })
            .limit(100);

        if (res.error) {
            setSupportReplyCount(0);
            return;
        }

        const rows = (res.data || []) as Array<{ id: any; replied_at: any }>;
        const unread = rows.filter((r) => {
            const id = String(r.id);
            const repliedAt = r.replied_at ? String(r.replied_at) : "";
            if (!repliedAt) return false;
            return String(seen[id] || "") !== repliedAt;
        }).length;

        setSupportReplyCount(unread);
    }, [user]);

    const pollAdminIncoming = useCallback(async () => {
        if (!user || user.role !== "admin") return;

        const baseKey = `isgucu_admin_inbox_${usernameKey(user.username)}`;
        const lastSupportKey = `${baseKey}_support_last`;
        const lastPayoutKey = `${baseKey}_payout_last`;
        const lastDeletionKey = `${baseKey}_deletion_last`;

        const lastSupport = String(localStorage.getItem(lastSupportKey) || "");
        const lastPayout = String(localStorage.getItem(lastPayoutKey) || "");
        const lastDeletion = String(localStorage.getItem(lastDeletionKey) || "");

        const [supportRes, payoutRes, deletionRes] = await Promise.all([
            supabase
                .from("support_tickets")
                .select("id, subject, created_at")
                .eq("status", "open")
                .order("created_at", { ascending: false })
                .limit(5),
            supabase
                .from("payout_requests")
                .select("id, created_at")
                .eq("status", "pending")
                .order("created_at", { ascending: false })
                .limit(5),
            supabase
                .from("account_deletion_requests")
                .select("id, created_at")
                .eq("status", "pending")
                .order("created_at", { ascending: false })
                .limit(5),
        ]);

        if (!supportRes.error) {
            const rows = (supportRes.data || []) as Array<{ id: any; subject: any; created_at: any }>;
            const newest = rows[0]?.created_at ? String(rows[0].created_at) : "";
            if (!lastSupport) {
                if (newest) localStorage.setItem(lastSupportKey, newest);
            } else {
                for (const r of rows) {
                    const createdAt = r.created_at ? String(r.created_at) : "";
                    if (!createdAt || createdAt <= lastSupport) continue;
                    upsertLocalNotification({
                        id: `admin-support-${String(r.id)}`,
                        type: "system",
                        title: "🎧 Yeni Destek Talebi",
                        description: String(r.subject || "Yeni destek talebi oluşturuldu."),
                        actionUrl: "/admin",
                        actionLabel: "Panele Git",
                    });
                }
                if (newest) localStorage.setItem(lastSupportKey, newest);
            }
        }

        if (!payoutRes.error) {
            const rows = (payoutRes.data || []) as Array<{ id: any; created_at: any }>;
            const newest = rows[0]?.created_at ? String(rows[0].created_at) : "";
            if (!lastPayout) {
                if (newest) localStorage.setItem(lastPayoutKey, newest);
            } else {
                for (const r of rows) {
                    const createdAt = r.created_at ? String(r.created_at) : "";
                    if (!createdAt || createdAt <= lastPayout) continue;
                    upsertLocalNotification({
                        id: `admin-payout-${String(r.id)}`,
                        type: "system",
                        title: "💸 Yeni Ödeme Talebi",
                        description: "Yeni bir ödeme talebi geldi.",
                        actionUrl: "/admin/payouts",
                        actionLabel: "İncele",
                    });
                }
                if (newest) localStorage.setItem(lastPayoutKey, newest);
            }
        }

        if (!deletionRes.error) {
            const rows = (deletionRes.data || []) as Array<{ id: any; created_at: any }>;
            const newest = rows[0]?.created_at ? String(rows[0].created_at) : "";
            if (!lastDeletion) {
                if (newest) localStorage.setItem(lastDeletionKey, newest);
            } else {
                for (const r of rows) {
                    const createdAt = r.created_at ? String(r.created_at) : "";
                    if (!createdAt || createdAt <= lastDeletion) continue;
                    upsertLocalNotification({
                        id: `admin-deletion-${String(r.id)}`,
                        type: "system",
                        title: "⚠️ Yeni Hesap Silme Talebi",
                        description: "Yeni bir hesap silme talebi geldi.",
                        actionUrl: "/admin",
                        actionLabel: "İncele",
                    });
                }
                if (newest) localStorage.setItem(lastDeletionKey, newest);
            }
        }
    }, [upsertLocalNotification, user]);

    useEffect(() => {
        const initialId = window.setTimeout(() => {
            updateCounts();
            void updateOrderApprovalCount();
            void updateSupportReplyCount();
            void pollAdminIncoming();
        }, 0);
        hydrateSiteConfigFromRemote().then((remoteConfig) => {
            if (!remoteConfig) return;
            setSiteConfig(remoteConfig);
        });
        window.addEventListener("storage", updateCounts);
        window.addEventListener("storage_updated", updateCounts);
        window.addEventListener("orders_updated", updateOrderApprovalCount);
        window.addEventListener("site_config_updated", handleConfigUpdate);
        window.addEventListener("support_seen_updated", updateSupportReplyCount);
        const intervalId = window.setInterval(() => {
            void updateOrderApprovalCount();
            void updateSupportReplyCount();
            void pollAdminIncoming();
        }, 10000);
        return () => {
            window.clearTimeout(initialId);
            window.clearInterval(intervalId);
            window.removeEventListener("storage", updateCounts);
            window.removeEventListener("storage_updated", updateCounts);
            window.removeEventListener("orders_updated", updateOrderApprovalCount);
            window.removeEventListener("site_config_updated", handleConfigUpdate);
            window.removeEventListener("support_seen_updated", updateSupportReplyCount);
        };
    }, [updateCounts, handleConfigUpdate, updateOrderApprovalCount, updateSupportReplyCount, pollAdminIncoming]);

    useEffect(() => {
        const faviconHref = siteConfig.faviconUrl || siteConfig.logoUrl || "/logo.png";
        let favicon = document.querySelector<HTMLLinkElement>("link[rel=\"icon\"]");
        if (!favicon) {
            favicon = document.createElement("link");
            favicon.rel = "icon";
            document.head.appendChild(favicon);
        }
        favicon.href = faviconHref;

        const styleId = "isgucu-custom-css";
        let styleTag = document.getElementById(styleId);
        if (!styleTag) {
            styleTag = document.createElement("style");
            styleTag.id = styleId;
            document.head.appendChild(styleTag);
        }
        styleTag.textContent = siteConfig.customCss || "";
    }, [siteConfig]);

    const navLinks = [
        ...siteConfig.headerLinks,
        ...(siteConfig.managedPages || [])
            .filter((p: { enabled?: boolean; showInHeader?: boolean; slug?: string; menuLabel?: string; title?: string }) =>
                Boolean(p.enabled) && Boolean(p.showInHeader) && p.slug !== "/" && p.slug !== "/about"
            )
            .map((p: { slug?: string; menuLabel?: string; title?: string }) => ({ href: String(p.slug || ""), label: String(p.menuLabel || p.title || "") })),
    ];

    const roleLinks = user?.role === "employer"
        ? [{ href: "/post-job", label: "İş İlanı Ver", color: "text-blue-600 font-semibold" }]
        : user?.role === "freelancer"
            ? [{ href: "/post-gig", label: "Hizmet İlanı Ver", color: "text-green-600 font-semibold" }]
            : user?.role === "admin"
                ? [{ href: "/admin", label: "Yönetim Paneli", color: "text-red-600 font-semibold" }]
                : [];
    const ordersLabel = user?.role === "freelancer" ? "İşlerim" : "Siparişlerim";

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            {siteConfig.announcement?.enabled && (
                <div
                    className={`w-fu<span className="flex items-center justify-between w-full">
                                        <span>ll text-w</span>
                                        {supportReplyCount > 0 && (
                                            <span className="h-5 min-w-5 px-1.5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                                                {supportReplyCount}
                                            </span>
                                        )}
                                    </span>hite text-center text-xs font-black uppercase tracking-wider py-2 ${
                        siteConfig.announcement.theme === "red"
                            ? "bg-red-600"
                            : siteConfig.announcement.theme === "orange"
                            ? "bg-orange-600"
                            : siteConfig.announcement.theme === "slate"
                            ? "bg-slate-700"
                            : "bg-blue-600"
                    }`}
                >
                    {siteConfig.announcement.text}
                </div>
            )}
            <div className="container flex h-20 md:h-24 items-center justify-between">
                {/* Logo */}
                <div className="flex items-center gap-3 md:gap-8">
                    <Link href="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <Image
                            src={siteConfig.logoUrl || "/logo.png"}
                            alt="İşgücü Logo"
                            width={160}
                            height={80}
                            className="h-14 sm:h-12 md:h-20 w-auto object-contain transition-all"
                            unoptimized
                        />
                        <span className="font-heading text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent block leading-none truncate">
                            {siteConfig.siteName || "İŞGÜCÜ"}
                        </span>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
                        {navLinks.map((link) => (
                            <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground/80 text-foreground/60">
                                {link.label}
                            </Link>
                        ))}
                        {roleLinks.map((link) => (
                            <Link key={link.href} href={link.href} className={`transition-colors hover:opacity-80 ${link.color}`}>
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>

                {/* Desktop Right Side */}
                <div className="hidden md:flex items-center gap-3 min-w-[120px] justify-end">
                    {loading ? (
                        <div className="h-8 w-8 animate-pulse bg-gray-100 rounded-full" />
                    ) : user ? (
                        <>
                            <Link href="/messages">
                                <Button variant="ghost" size="icon" className="relative">
                                    <MessageCircle className="h-5 w-5" />
                                </Button>
                            </Link>

                            {/* Notifications */}
                            <Link href="/notifications">
                                <Button variant="ghost" size="icon" className="relative">
                                    <Bell className="h-5 w-5" />
                                    {notifCount > 0 && (
                                        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                            {notifCount}
                                        </span>
                                    )}
                                </Button>
                            </Link>

                            {/* Profile Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setProfileOpen(!profileOpen)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 overflow-hidden flex items-center justify-center text-white text-sm font-bold">
                                        {user.avatarUrl ? (
                                            <Image
                                                src={user.avatarUrl}
                                                alt="Profil"
                                                width={32}
                                                height={32}
                                                className="h-full w-full object-cover"
                                                unoptimized
                                            />
                                        ) : (
                                            (maskFullName(user.fullName) || user.username).charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <span className="text-sm font-medium text-gray-700 max-w-[120px] truncate">{maskFullName(user.fullName) || user.username}</span>
                                    <ChevronDown className="h-4 w-4 text-gray-400" />
                                </button>

                                {profileOpen && (
                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="px-4 py-2 border-b border-gray-100">
                                            <p className="text-sm font-semibold text-gray-900">{maskFullName(user.fullName) || user.username}</p>
                                            <p className="text-xs text-gray-500 capitalize">{user.role === "employer" ? "İş Veren" : user.role === "freelancer" ? "Freelancer" : "Yönetici"}</p>
                                        </div>
                                        <Link href="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => setProfileOpen(false)}>
                                            <User className="h-4 w-4" /> Profilim
                                        </Link>
                                        <Link href="/orders" className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => setProfileOpen(false)}>
                                            <span>📋 {ordersLabel}</span>
                                            {orderApprovalCount > 0 && (
                                                <span className="h-5 min-w-5 px-1.5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                                                    {orderApprovalCount}
                                                </span>
                                            )}
                                        </Link>
                                        <Link href="/wallet" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => setProfileOpen(false)}>
                                            💰 Cüzdanım
                                        </Link>
                                        <Link href="/support" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => setProfileOpen(false)}>
                                            🎧 Destek
                                        </Link>
                                        {user.role === "admin" && (
                                            <Link href="/admin" className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors" onClick={() => setProfileOpen(false)}>
                                                ⚙️ Yönetim Paneli
                                            </Link>
                                        )}
                                        <div className="border-t border-gray-100 mt-1 pt-1">
                                            <button
                                                onClick={handleLogout}
                                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full text-left transition-colors"
                                            >
                                                🚪 Çıkış Yap
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <Link href="/login">
                                <Button variant="ghost" size="sm">Giriş Yap</Button>
                            </Link>
                            <Link href="/register">
                                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">Üye Ol</Button>
                            </Link>
                        </>
                    )}
                </div>

                {/* Mobile Menu Button */}
                <button
                    className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    onClick={() => setMobileOpen(!mobileOpen)}
                >
                    {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
            </div>

            {/* Mobile Menu */}
            {mobileOpen && (
                <div className="md:hidden border-t bg-white animate-in slide-in-from-top-2 duration-300">
                    <div className="container py-4 flex flex-col gap-1">
                        {navLinks.map((link) => (
                            <Link key={link.href} href={link.href} className="px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg" onClick={() => setMobileOpen(false)}>
                                {link.label}
                            </Link>
                        ))}
                        {roleLinks.map((link) => (
                            <Link key={link.href} href={link.href} className={`px-4 py-3 text-sm font-medium rounded-lg hover:bg-gray-50 ${link.color}`} onClick={() => setMobileOpen(false)}>
                                {link.label}
                            </Link>
                        ))}

                        {user ? (
                            <>
                                <div className="border-t my-2" />
                                <Link href="/profile" className="px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg" onClick={() => setMobileOpen(false)}>
                                    👤 Profilim
                                </Link>
                                <Link href="/orders" className="px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg flex items-center justify-between gap-3" onClick={() => setMobileOpen(false)}>
                                    <span>📋 {ordersLabel}</span>
                                    {orderApprovalCount > 0 && (
                                        <span className="h-5 min-w-5 px-1.5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                                            {orderApprovalCount}
                                        </span>
                                    )}
                                </Link>
                                <Link href="/wallet" className="px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg" onClick={() => setMobileOpen(false)}>
                                    💰 Cüzdanım
                                </Link>
                                <Link href="/messages" className="px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg" onClick={() => setMobileOpen(false)}>
                                    💬 Mesajlar
                                </Link>
                                <Link href="/notifications" className="px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg" onClick={() => setMobileOpen(false)}>
                                    🔔 Bildirimler
                                </Link>
                                <Link href="/support" className="px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg" onClick={() => setMobileOpen(false)}>
                                    🎧 Destek
                                </Link>
                                <div className="border-t my-2" />
                                <button onClick={handleLogout} className="px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg text-left">
                                    🚪 Çıkış Yap
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="border-t my-2" />
                                <div className="flex gap-3 px-4 py-2">
                                    <Link href="/login" className="flex-1" onClick={() => setMobileOpen(false)}>
                                        <Button variant="outline" className="w-full">Giriş Yap</Button>
                                    </Link>
                                    <Link href="/register" className="flex-1" onClick={() => setMobileOpen(false)}>
                                        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">Üye Ol</Button>
                                    </Link>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}


