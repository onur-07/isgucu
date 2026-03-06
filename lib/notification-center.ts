import { usernameKey } from "@/lib/utils";

export type LocalNotification = {
    id: string;
    type: "message" | "order" | "review" | "system";
    title: string;
    description: string;
    time: string;
    read: boolean;
    actionUrl?: string;
    actionLabel?: string;
};

const keyForUser = (username: string) => `isgucu_notifications_${usernameKey(username)}`;
const initKeyForUser = (username: string) => `isgucu_notifications_init_${usernameKey(username)}`;

export const pushLocalNotification = (
    username: string,
    notif: Omit<LocalNotification, "time" | "read"> & { read?: boolean; time?: string }
) => {
    if (typeof window === "undefined") return;
    const safeUsername = String(username || "").trim();
    if (!safeUsername) return;

    const key = keyForUser(safeUsername);
    const initKey = initKeyForUser(safeUsername);

    let list: LocalNotification[] = [];
    try {
        const raw = localStorage.getItem(key);
        list = raw ? (JSON.parse(raw) as LocalNotification[]) : [];
    } catch {
        list = [];
    }

    if (list.some((n) => String(n?.id) === String(notif.id))) return;

    const next: LocalNotification[] = [
        {
            id: String(notif.id),
            type: notif.type,
            title: String(notif.title || ""),
            description: String(notif.description || ""),
            time: String(notif.time || new Date().toLocaleString("tr-TR")),
            read: Boolean(notif.read ?? false),
            actionUrl: notif.actionUrl,
            actionLabel: notif.actionLabel,
        },
        ...list,
    ].slice(0, 100);

    localStorage.setItem(key, JSON.stringify(next));
    localStorage.setItem(initKey, "1");
    window.dispatchEvent(new Event("storage_updated"));
};

