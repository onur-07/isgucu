import { supabase } from "./supabase";

// Centralized data service for İşgücü platform - Supabase Backend
// Migrated from localStorage to persistent SQL storage

// ===== TYPES =====
export interface PlatformUser {
    id?: string;
    username: string;
    email: string;
    role: "employer" | "freelancer" | "admin";
    createdAt: string;
    isBanned?: boolean;
}

export interface PlatformStats {
    totalFreelancers: number;
    totalEmployers: number;
    totalProjects: number;
    totalPayments: number;
    satisfactionRate: number;
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
    price: number;
    status: "pending" | "active" | "delivered" | "completed" | "cancelled";
    createdAt: string;
    dueDate: string;
}

// ===== PLATFORM-WIDE STATS =====
export async function getPlatformStats(): Promise<PlatformStats> {
    const { count: freelancerCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'freelancer');
    const { count: employerCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'employer');

    // Default placeholders for now
    return {
        totalFreelancers: freelancerCount || 0,
        totalEmployers: employerCount || 0,
        totalProjects: 0,
        totalPayments: 0,
        satisfactionRate: 100,
    };
}

// ===== ALL USERS =====
export async function getAllUsers(): Promise<PlatformUser[]> {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, username, email, role, created_at, is_banned')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching users:", error);
        return [];
    }

    return data.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role as any,
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

export async function updateUserInfo(userId: string, updates: any) {
    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

    if (error) {
        console.error("Error updating user:", {
            message: (error as any)?.message,
            details: (error as any)?.details,
            hint: (error as any)?.hint,
            code: (error as any)?.code,
        });
        return { ok: false, error };
    }

    return { ok: true };
}

// ===== TRANSACTIONS & BALANCE =====
export function getUserTransactions(username: string): Transaction[] {
    return [];
}

export function getUserBalance(username: string) {
    return { balance: 0, totalEarned: 0, pending: 0 };
}

// ===== STATS & REVIEWS =====
export function getUserStats(username: string, role: "employer" | "freelancer" | "admin"): UserStats {
    return {
        completedJobs: 0,
        activeJobs: 0,
        totalEarnings: 0,
        totalSpent: 0,
        averageRating: 0,
        reviewCount: 0,
        onTimeDelivery: 0
    };
}

export function getUserReviews(username: string): Review[] {
    return [];
}

export async function getUserOrders(username: string, role: "employer" | "freelancer" | "guest" | "admin"): Promise<Order[]> {
    if (!username) return [];
    const { data, error } = await supabase
        .from("orders")
        .select("id, gig_id, buyer_username, seller_username, total_price, total_days, status, created_at, gigs(title)")
        .or(`buyer_username.eq.${username},seller_username.eq.${username}`)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching orders:", error);
        return [];
    }

    return (data || []).map((o: any) => {
        const title = o?.gigs?.title ? String(o.gigs.title) : "Sipariş";
        const createdAt = o?.created_at ? new Date(o.created_at).toLocaleDateString("tr-TR") : "";
        const dueDate = o?.total_days ? `${o.total_days} gün` : "";
        const priceNum = Number(o?.total_price || 0);

        return {
            id: String(o.id),
            title,
            client: String(o.buyer_username || ""),
            freelancer: String(o.seller_username || ""),
            price: Number.isFinite(priceNum) ? priceNum : 0,
            status: (o.status || "pending") as any,
            createdAt,
            dueDate,
        } as Order;
    });
}
