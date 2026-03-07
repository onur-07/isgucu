import { supabase } from "./supabase";
import { usernameFold, usernameKey } from "./utils";

// Centralized data service for İşgücü platform - Supabase Backend
// Migrated from localStorage to persistent SQL storage

// ===== TYPES =====
export interface PlatformUser {
    id?: string;
    username: string;
    email: string;
    role: "employer" | "freelancer" | "admin";
    staffRoles?: string[];
    createdAt: string;
    isBanned?: boolean;
}

export interface PlatformStats {
    totalFreelancers: number;
    totalEmployers: number;
    totalProjects: number;
    totalPayments: number;
    satisfactionRate: number;
    activeOrders: number;
    completedOrders: number;
    averageRating: number;
}

export interface UserStats {
    completedJobs: number;
    activeJobs: number;
    totalEarnings: number;
    totalSpent: number;
    averageRating: number;
    reviewCount: number;
    onTimeDelivery: number;
}

export interface Transaction {
    id: string;
    user: string;
    type: "income" | "withdrawal" | "pending";
    description: string;
    amount: number;
    date: string;
}

export interface Review {
    id: string;
    fromUser: string;
    toUser: string;
    rating: number;
    comment: string;
    date: string;
    projectTitle: string;
}

export interface Order {
    id: string;
    title: string;
    client: string;
    freelancer: string;
    buyerId?: string;
    sellerId?: string;
    price: number;
    status: "pending" | "active" | "delivered" | "completed" | "cancelled";
    paymentStatus?: "unpaid" | "initiated" | "paid" | "failed" | string;
    paidToSeller?: boolean;
    createdAt: string;
    dueDate: string;
}

// ===== PLATFORM-WIDE STATS =====
export async function getPlatformStats(): Promise<PlatformStats> {
    const [{ count: freelancerCount }, { count: employerCount }, ordersRes, reviewsRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'freelancer'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'employer'),
        supabase.from("orders").select("id, status, total_price"),
        supabase.from("reviews").select("rating"),
    ]);

    const orders = Array.isArray((ordersRes as any)?.data) ? ((ordersRes as any).data as any[]) : [];
    const reviews = Array.isArray((reviewsRes as any)?.data) ? ((reviewsRes as any).data as any[]) : [];

    const activeOrders = orders.filter((o) => {
        const s = String(o?.status || "").toLowerCase();
        return s === "pending" || s === "active" || s === "delivered";
    }).length;
    const completedOrders = orders.filter((o) => String(o?.status || "").toLowerCase() === "completed").length;
    const totalPayments = orders
        .filter((o) => String(o?.status || "").toLowerCase() === "completed")
        .reduce((sum, o) => sum + (Number.isFinite(Number(o?.total_price)) ? Number(o?.total_price) : 0), 0);
    const averageRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (Number.isFinite(Number(r?.rating)) ? Number(r?.rating) : 0), 0) / reviews.length
        : 0;

    return {
        totalFreelancers: freelancerCount || 0,
        totalEmployers: employerCount || 0,
        totalProjects: orders.length,
        totalPayments: Math.round(totalPayments),
        satisfactionRate: Math.round((averageRating / 5) * 100),
        activeOrders,
        completedOrders,
        averageRating: Number.isFinite(averageRating) ? Math.round(averageRating * 10) / 10 : 0,
    };
}

// ===== ALL USERS =====
export async function getAllUsers(): Promise<PlatformUser[]> {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, username, email, role, staff_roles, created_at, is_banned')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching users:", error);
        return [];
    }

    return data.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: (u.role === "employer" || u.role === "freelancer" || u.role === "admin") ? u.role : "freelancer",
        staffRoles: Array.isArray((u as any).staff_roles) ? (u as any).staff_roles : [],
        createdAt: u.created_at,
        isBanned: u.is_banned
    }));
}

// ===== GIGS =====
export async function getAllGigs() {
    const { data, error } = await supabase
        .from('gigs')
        .select(`
            *,
            profiles:user_id (username)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching gigs:", error);
        return [];
    }
    return data;
}

// ===== ADMIN ACTIONS =====
export async function toggleBanUser(userId: string, currentStatus: boolean) {
    const { error } = await supabase
        .from('profiles')
        .update({ is_banned: !currentStatus })
        .eq('id', userId);

    if (error) console.error("Error banning user:", error);
}

export async function deleteUserAccount(userId: string) {
    const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

    if (error) console.error("Error deleting user profile:", error);
}

export async function updateUserInfo(userId: string, updates: Record<string, unknown>) {
    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

    if (error) {
        console.error("Error updating user:", {
            message: (error && typeof error === "object" && "message" in error) ? String((error as { message?: unknown }).message || "") : String(error),
            details: (error && typeof error === "object" && "details" in error) ? String((error as { details?: unknown }).details || "") : "",
            hint: (error && typeof error === "object" && "hint" in error) ? String((error as { hint?: unknown }).hint || "") : "",
            code: (error && typeof error === "object" && "code" in error) ? String((error as { code?: unknown }).code || "") : "",
        });
        return { ok: false, error };
    }

    return { ok: true };
}

// ===== TRANSACTIONS & BALANCE =====
export async function getUserTransactions(username: string): Promise<Transaction[]> {
    if (!username) return [];

    const { data: me, error: meErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
    if (meErr || !me?.id) {
        if (meErr) console.error("Error fetching profile id:", meErr);
        return [];
    }

    const [{ data: ledgerRows, error: ledgerErr }, { data: payoutRows, error: payoutErr }] = await Promise.all([
        supabase
            .from("wallet_ledger")
            .select("id, type, amount, description, created_at")
            .eq("user_id", me.id)
            .order("created_at", { ascending: false })
            .limit(50),
        supabase
            .from("payout_requests")
            .select("id, amount, status, created_at")
            .eq("user_id", me.id)
            .order("created_at", { ascending: false })
            .limit(50),
    ]);

    if (ledgerErr) console.error("Error fetching wallet_ledger:", ledgerErr);
    if (payoutErr) console.error("Error fetching payout_requests:", payoutErr);

    const ledger = Array.isArray(ledgerRows) ? ledgerRows : [];
    const payouts = Array.isArray(payoutRows) ? payoutRows : [];

    const txs: Transaction[] = [];
    for (const r of ledger) {
        const typeRaw = String((r as any)?.type || "").toLowerCase();
        const amountNum = Number((r as any)?.amount ?? 0);
        const txType: Transaction["type"] = typeRaw === "debit" ? "withdrawal" : "income";
        const createdAt = (r as any)?.created_at ? new Date(String((r as any).created_at)).toLocaleString("tr-TR") : "";
        txs.push({
            id: String((r as any)?.id ?? ""),
            user: username,
            type: txType,
            description: String((r as any)?.description || (txType === "income" ? "Kazanç" : "Çekim")),
            amount: Number.isFinite(amountNum) ? amountNum : 0,
            date: createdAt,
        });
    }

    for (const r of payouts) {
        const status = String((r as any)?.status || "pending").toLowerCase();
        if (status !== "pending") continue;
        const amountNum = Number((r as any)?.amount ?? 0);
        const createdAt = (r as any)?.created_at ? new Date(String((r as any).created_at)).toLocaleString("tr-TR") : "";
        txs.push({
            id: `payout-${String((r as any)?.id ?? "")}`,
            user: username,
            type: "pending",
            description: "Para çekme talebi (bekliyor)",
            amount: Number.isFinite(amountNum) ? amountNum : 0,
            date: createdAt,
        });
    }

    return txs.sort((a, b) => {
        const ta = new Date(a.date).getTime();
        const tb = new Date(b.date).getTime();
        if (Number.isFinite(ta) && Number.isFinite(tb)) return tb - ta;
        return 0;
    });
}

export async function getUserBalance(username: string) {
    if (!username) return { balance: 0, totalEarned: 0, pending: 0 };

    const { data: me, error: meErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
    if (meErr || !me?.id) {
        if (meErr) console.error("Error fetching profile id:", meErr);
        return { balance: 0, totalEarned: 0, pending: 0 };
    }

    const [{ data: ledgerRows, error: ledgerErr }, { data: pendingRows, error: pendingErr }] = await Promise.all([
        supabase
            .from("wallet_ledger")
            .select("type, amount")
            .eq("user_id", me.id),
        supabase
            .from("payout_requests")
            .select("amount")
            .eq("user_id", me.id)
            .eq("status", "pending"),
    ]);

    if (ledgerErr) console.error("Error fetching wallet_ledger:", ledgerErr);
    if (pendingErr) console.error("Error fetching payout_requests:", pendingErr);

    const ledger = Array.isArray(ledgerRows) ? ledgerRows : [];
    const pending = Array.isArray(pendingRows) ? pendingRows : [];

    let credits = 0;
    let debits = 0;
    for (const r of ledger) {
        const typeRaw = String((r as any)?.type || "").toLowerCase();
        const amountNum = Number((r as any)?.amount ?? 0);
        if (!Number.isFinite(amountNum)) continue;
        if (typeRaw === "debit") debits += amountNum;
        else credits += amountNum;
    }
    const pendingSum = pending.reduce((s, r) => {
        const n = Number((r as any)?.amount ?? 0);
        return s + (Number.isFinite(n) ? n : 0);
    }, 0);

    return {
        balance: Math.max(0, credits - debits - pendingSum),
        totalEarned: Math.max(0, credits),
        pending: Math.max(0, pendingSum),
    };
}

// ===== STATS & REVIEWS =====
export async function getUserStats(username: string, role: "employer" | "freelancer" | "admin"): Promise<UserStats> {
    if (!username) {
        return {
            completedJobs: 0,
            activeJobs: 0,
            totalEarnings: 0,
            totalSpent: 0,
            averageRating: 0,
            reviewCount: 0,
            onTimeDelivery: 0,
        };
    }

    const { data: me, error: meErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();

    if (meErr || !me?.id) {
        if (meErr) console.error("Error fetching profile id:", meErr);
        return {
            completedJobs: 0,
            activeJobs: 0,
            totalEarnings: 0,
            totalSpent: 0,
            averageRating: 0,
            reviewCount: 0,
            onTimeDelivery: 0,
        };
    }

    const isFreelancer = role === "freelancer";

    const [ordersRes, reviewsRes] = await Promise.all([
        supabase
            .from("orders")
            .select("status, total_price, created_at")
            .eq(isFreelancer ? "seller_id" : "buyer_id", me.id),
        supabase
            .from("reviews")
            .select("rating")
            .eq("to_user_id", me.id),
    ]);

    if (ordersRes.error) console.error("Error fetching orders stats:", ordersRes.error);
    if (reviewsRes.error) console.error("Error fetching reviews stats:", reviewsRes.error);

    const orders = Array.isArray(ordersRes.data) ? (ordersRes.data as any[]) : [];
    const completed = orders.filter((o) => String(o?.status || "").toLowerCase() === "completed");
    const active = orders.filter((o) => {
        const s = String(o?.status || "").toLowerCase();
        return s === "active" || s === "pending" || s === "delivered";
    });

    const totalEarnings = completed.reduce((sum, o) => sum + Number(o?.total_price ?? 0), 0);
    const totalSpent = totalEarnings;

    const ratings = Array.isArray(reviewsRes.data) ? (reviewsRes.data as any[]) : [];
    const reviewCount = ratings.length;
    const avg = reviewCount > 0
        ? (ratings.reduce((s, r) => s + Number(r?.rating ?? 0), 0) / reviewCount)
        : 0;

    return {
        completedJobs: completed.length,
        activeJobs: active.length,
        totalEarnings: isFreelancer ? (Number.isFinite(totalEarnings) ? totalEarnings : 0) : 0,
        totalSpent: !isFreelancer ? (Number.isFinite(totalSpent) ? totalSpent : 0) : 0,
        averageRating: Number.isFinite(avg) ? Math.round(avg * 10) / 10 : 0,
        reviewCount,
        onTimeDelivery: 0,
    };
}

export async function getUserReviews(username: string): Promise<Review[]> {
    if (!username) return [];

    const { data: me, error: meErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();

    if (meErr || !me?.id) {
        if (meErr) console.error("Error fetching profile id:", meErr);
        return [];
    }

    const { data, error } = await supabase
        .from("reviews")
        .select("id, order_id, from_user_id, to_user_id, rating, comment, created_at")
        .eq("to_user_id", me.id)
        .order("created_at", { ascending: false })
        .limit(50);

    if (error) {
        console.error("Error fetching reviews:", error);
        return [];
    }

    const rows = (data || []) as any[];
    const fromIds = Array.from(new Set(rows.map((r) => String(r?.from_user_id || "")).filter(Boolean)));
    const orderIds = Array.from(new Set(rows.map((r) => String(r?.order_id || "")).filter(Boolean)));

    const [fromProfilesRes, ordersRes] = await Promise.all([
        fromIds.length > 0
            ? supabase.from("profiles").select("id, username").in("id", fromIds)
            : Promise.resolve({ data: [], error: null } as any),
        orderIds.length > 0
            ? supabase.from("orders").select("id, gig_id, gigs(title)").in("id", orderIds)
            : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (fromProfilesRes?.error) console.error("Error fetching review authors:", fromProfilesRes.error);
    if (ordersRes?.error) console.error("Error fetching review orders:", ordersRes.error);

    const fromMap: Record<string, string> = {};
    for (const p of (fromProfilesRes.data || []) as any[]) {
        const id = String(p?.id || "");
        if (!id) continue;
        fromMap[id] = String(p?.username || id);
    }

    const titleMap: Record<string, string> = {};
    for (const o of (ordersRes.data || []) as any[]) {
        const id = String(o?.id || "");
        if (!id) continue;
        const t = o?.gigs?.title != null ? String(o.gigs.title) : "Sipariş";
        titleMap[id] = t;
    }

    return rows.map((r) => {
        const id = String(r?.id ?? "");
        const fromId = String(r?.from_user_id ?? "");
        const toId = String(r?.to_user_id ?? "");
        const orderId = r?.order_id != null ? String(r.order_id) : "";
        const ratingNum = Number(r?.rating ?? 0);
        const created = r?.created_at ? new Date(String(r.created_at)) : null;
        return {
            id,
            fromUser: fromMap[fromId] || fromId,
            toUser: toId,
            rating: Number.isFinite(ratingNum) ? ratingNum : 0,
            comment: String(r?.comment || ""),
            date: created ? created.toLocaleDateString("tr-TR") : "",
            projectTitle: titleMap[orderId] || "Sipariş",
        } as Review;
    });
}

export async function getUserOrders(
    username: string,
    _role: "employer" | "freelancer" | "guest" | "admin",
    userId?: string
): Promise<Order[]> {
    void _role;
    if (!username) return [];

    const rawUsername = String(username || "").trim();
    const folded = usernameFold(rawUsername);
    const keyed = usernameKey(rawUsername);

    let profileId = String(userId || "").trim();
    try {
        const { data: me } = await supabase
            .from("profiles")
            .select("id")
            .or(`username.eq.${rawUsername},username.ilike.${folded},username.ilike.${keyed}`)
            .limit(1)
            .maybeSingle();
        profileId = String((me as any)?.id || "");
    } catch {}

    const clauses = [
        `buyer_username.ilike.${rawUsername}`,
        `seller_username.ilike.${rawUsername}`,
        `buyer_username.ilike.${folded}`,
        `seller_username.ilike.${folded}`,
        `buyer_username.ilike.${keyed}`,
        `seller_username.ilike.${keyed}`,
    ];
    if (profileId) {
        clauses.push(`buyer_id.eq.${profileId}`);
        clauses.push(`seller_id.eq.${profileId}`);
    }

    const { data, error } = await supabase
        .from("orders")
        .select("id, gig_id, buyer_id, seller_id, buyer_username, seller_username, total_price, total_days, status, payment_status, created_at, paid_to_seller, gigs(title)")
        .or(clauses.join(","))
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching orders:", error);
        return [];
    }

    type OrderRow = {
        id?: unknown;
        buyer_id?: unknown;
        seller_id?: unknown;
        buyer_username?: unknown;
        seller_username?: unknown;
        total_price?: unknown;
        total_days?: unknown;
        status?: unknown;
        payment_status?: unknown;
        created_at?: unknown;
        paid_to_seller?: unknown;
        gigs?: { title?: unknown } | null;
    };

    const rows = (data || []) as unknown as OrderRow[];
    return rows.map((o) => {
        const title = o?.gigs && o.gigs.title != null ? String(o.gigs.title) : "Sipariş";
        const createdAt = o?.created_at ? new Date(String(o.created_at)).toLocaleDateString("tr-TR") : "";
        const dueDate = o?.total_days ? `${String(o.total_days)} gün` : "";
        const priceNum = Number(o?.total_price ?? 0);

        const statusRaw = String(o?.status || "pending").toLowerCase();
        const normalizedStatus: Order["status"] =
            statusRaw === "active" ||
            statusRaw === "delivered" ||
            statusRaw === "completed" ||
            statusRaw === "cancelled"
                ? (statusRaw as Order["status"])
                : "pending";

        return {
            id: String(o.id ?? ""),
            title,
            client: String(o.buyer_username || ""),
            freelancer: String(o.seller_username || ""),
            buyerId: o?.buyer_id != null ? String(o.buyer_id) : undefined,
            sellerId: o?.seller_id != null ? String(o.seller_id) : undefined,
            price: Number.isFinite(priceNum) ? priceNum : 0,
            status: normalizedStatus,
            paymentStatus: String(o?.payment_status || "unpaid").toLowerCase(),
            paidToSeller: Boolean(o?.paid_to_seller),
            createdAt,
            dueDate,
        } as Order;
    });
}
