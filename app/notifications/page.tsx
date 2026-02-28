"use client";

import { useAuth } from "@/components/auth/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, MessageCircle, Star, Briefcase, Trash2 } from "lucide-react";
import { usernameKey } from "@/lib/utils";

interface Notification {
    id: string;
    type: "message" | "order" | "review" | "system";
    title: string;
    description: string;
    time: string;
    read: boolean;
    actionUrl?: string;
    actionLabel?: string;
}

const iconMap = {
    message: { icon: MessageCircle, color: "bg-blue-100 text-blue-600" },
    order: { icon: Briefcase, color: "bg-green-100 text-green-600" },
    review: { icon: Star, color: "bg-yellow-100 text-yellow-600" },
    system: { icon: Bell, color: "bg-purple-100 text-purple-600" },
};

const notificationInitKey = (username: string) => `isgucu_notifications_init_${usernameKey(username)}`;

function loadNotifications(username: string): Notification[] {
    const normKey = `isgucu_notifications_${usernameKey(username)}`;
    const legacyKey = `isgucu_notifications_${username}`;
    const initKey = notificationInitKey(username);

    const raw = localStorage.getItem(normKey);
    if (raw) return JSON.parse(raw);

    const legacyRaw = localStorage.getItem(legacyKey);
    if (legacyRaw) {
        localStorage.setItem(normKey, legacyRaw);
        localStorage.setItem(initKey, "1");
        return JSON.parse(legacyRaw);
    }

    if (localStorage.getItem(initKey) === "1") {
        return [];
    }

    const defaultNotifs: Notification[] = [
        {
            id: Date.now().toString(),
            type: "system",
            title: "Hoş Geldiniz!",
            description: "İşgücü platformuna hoş geldiniz. Profilinizi tamamlamayı unutmayın.",
            time: new Date().toLocaleString("tr-TR"),
            read: false,
        },
    ];
    localStorage.setItem(normKey, JSON.stringify(defaultNotifs));
    localStorage.setItem(initKey, "1");
    return defaultNotifs;
}

function saveNotifications(username: string, notifs: Notification[]) {
    const normKey = `isgucu_notifications_${usernameKey(username)}`;
    const legacyKey = `isgucu_notifications_${username}`;
    const initKey = notificationInitKey(username);
    localStorage.setItem(normKey, JSON.stringify(notifs));
    localStorage.setItem(initKey, "1");
    try {
        localStorage.removeItem(legacyKey);
    } catch {}
    window.dispatchEvent(new Event("storage_updated"));
}

export default function NotificationsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);

    useEffect(() => {
        if (!user) {
            router.push("/login");
            return;
        }
        setNotifications(loadNotifications(user.username));
    }, [user, router]);

    const markRead = (id: string) => {
        if (!user) return;
        const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
        setNotifications(updated);
        saveNotifications(user.username, updated);
    };

    const deleteNotification = (id: string) => {
        if (!user) return;
        const updated = notifications.filter((n) => n.id !== id);
        setNotifications(updated);
        saveNotifications(user.username, updated);
    };

    const markAllRead = () => {
        if (!user) return;
        const updated = notifications.map((n) => ({ ...n, read: true }));
        setNotifications(updated);
        saveNotifications(user.username, updated);
    };

    const clearAll = () => {
        if (!user) return;
        setNotifications([]);
        saveNotifications(user.username, []);
    };

    if (!user) return null;

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold font-heading">🔔 Bildirimler</h1>
                    <p className="text-gray-500 mt-1">
                        {unreadCount > 0 ? `${unreadCount} okunmamış bildiriminiz var.` : "Tüm bildirimler okundu."}
                    </p>
                </div>
                <div className="flex gap-3">
                    {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                            Tümünü oku
                        </button>
                    )}
                    {notifications.length > 0 && (
                        <button onClick={clearAll} className="text-sm text-red-500 hover:text-red-700 font-medium">
                            Tümünü sil
                        </button>
                    )}
                </div>
            </div>

            {notifications.length === 0 ? (
                <div className="bg-white border rounded-2xl p-12 text-center">
                    <Bell className="h-16 w-16 mx-auto mb-4 text-gray-200" />
                    <h3 className="font-semibold text-gray-700 text-lg">Bildirim yok</h3>
                    <p className="text-gray-400 mt-2">Yeni bildirimleriniz burada görünecek.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {notifications.map((notif) => {
                        const config = iconMap[notif.type];
                        const Icon = config.icon;

                        return (
                            <div
                                key={notif.id}
                                className={`bg-white border rounded-xl p-5 flex items-start gap-4 transition-all hover:shadow-sm group ${!notif.read ? "border-l-4 border-l-blue-500 bg-blue-50/30" : ""}`}
                            >
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${config.color}`}>
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => markRead(notif.id)}>
                                    <div className="flex items-center justify-between">
                                        <h3 className={`text-sm ${!notif.read ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                                            {notif.title}
                                        </h3>
                                        <span className="text-xs text-gray-400 shrink-0 ml-2">{notif.time}</span>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-0.5">{notif.description}</p>
                                    {notif.actionUrl && (
                                        <div className="mt-2">
                                            <Link
                                                href={notif.actionUrl}
                                                onClick={() => markRead(notif.id)}
                                                className="inline-flex items-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5"
                                            >
                                                {notif.actionLabel || "İncele"}
                                            </Link>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {!notif.read && <div className="h-2.5 w-2.5 bg-blue-500 rounded-full" />}
                                    <button
                                        onClick={() => deleteNotification(notif.id)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                                        title="Sil"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
