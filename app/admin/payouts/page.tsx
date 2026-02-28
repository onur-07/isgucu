"use client";

import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type PayoutRequestRow = {
    id: string | number;
    user_id: string;
    amount: number;
    status: string;
    created_at: string;
};

type ProfileMini = {
    id: string;
    username: string;
    full_name: string | null;
    iban: string | null;
};

type CancelEscalationRow = {
    id: string | number;
    order_id: string | number;
    requester_username: string;
    responder_username: string;
    compensation_rate: number;
    reason: string | null;
    status: string;
    created_at: string;
};

export default function AdminPayoutsPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [rows, setRows] = useState<PayoutRequestRow[]>([]);
    const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
    const [busyId, setBusyId] = useState<string>("");
    const [error, setError] = useState<string>("");
    const [cancelEscalations, setCancelEscalations] = useState<CancelEscalationRow[]>([]);

    const pendingRows = useMemo(
        () => rows.filter((r) => String(r.status || "").toLowerCase() === "pending"),
        [rows]
    );

    useEffect(() => {
        if (loading) return;
        if (!user) {
            router.push("/login");
            return;
        }
        if (user.role !== "admin") {
            router.push("/");
            return;
        }

        (async () => {
            setError("");
            const { data, error: qErr } = await supabase
                .from("payout_requests")
                .select("id, user_id, amount, status, created_at")
                .order("created_at", { ascending: false })
                .limit(200);

            if (qErr) {
                setError(qErr.message || "Ödeme talepleri çekilemedi");
                setRows([]);
                return;
            }

            const list = (data || []) as unknown as Array<Record<string, unknown>>;
            const mapped: PayoutRequestRow[] = list.map((r) => ({
                id: String(r.id ?? ""),
                user_id: String(r.user_id ?? ""),
                amount: Number(r.amount ?? 0),
                status: String(r.status ?? "pending"),
                created_at: String(r.created_at ?? ""),
            }));
            setRows(mapped);

            const userIds = Array.from(new Set(mapped.map((x) => x.user_id).filter(Boolean)));
            if (userIds.length === 0) {
                setProfiles({});
                return;
            }

            const { data: profRows } = await supabase
                .from("profiles")
                .select("id, username, full_name, iban")
                .in("id", userIds);

            const next: Record<string, ProfileMini> = {};
            for (const p of (profRows || []) as any[]) {
                const id = String(p?.id || "");
                if (!id) continue;
                next[id] = {
                    id,
                    username: String(p?.username || ""),
                    full_name: p?.full_name ? String(p.full_name) : null,
                    iban: p?.iban ? String(p.iban) : null,
                };
            }
            setProfiles(next);

            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
            const { data: cancelRows, error: cancelErr } = await supabase
                .from("order_cancellation_requests")
                .select("id, order_id, requester_username, responder_username, compensation_rate, reason, status, created_at")
                .eq("status", "pending")
                .lte("created_at", threeDaysAgo)
                .order("created_at", { ascending: true })
                .limit(200);

            if (cancelErr) {
                setCancelEscalations([]);
            } else {
                setCancelEscalations((cancelRows || []) as unknown as CancelEscalationRow[]);
            }
        })();
    }, [user, loading, router]);

    const approve = async (row: PayoutRequestRow) => {
        if (!user || user.role !== "admin") return;
        if (busyId) return;
        const id = String(row.id || "");
        if (!id) return;
        const amount = Number(row.amount);
        if (!Number.isFinite(amount) || amount <= 0) return;

        const ok = window.confirm(`Bu ödeme talebini onaylamak istiyor musun? (₺${amount})`);
        if (!ok) return;

        setBusyId(id);
        setError("");
        try {
            const { error: updErr } = await supabase
                .from("payout_requests")
                .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: user.id })
                .eq("id", Number(id));
            if (updErr) throw updErr;

            const { error: ledErr } = await supabase.from("wallet_ledger").insert([
                {
                    user_id: row.user_id,
                    order_id: null,
                    type: "debit",
                    amount,
                    description: `Para çekme onayı (#${id})`,
                },
            ]);
            if (ledErr) throw ledErr;

            setRows((prev) => prev.map((r) => (String(r.id) === id ? { ...r, status: "approved" } : r)));
        } catch (e: any) {
            setError(String(e?.message || e || "Onay başarısız"));
        } finally {
            setBusyId("");
        }
    };

    const resolveCancelEscalation = async (row: CancelEscalationRow, approveCancel: boolean) => {
        if (!user || user.role !== "admin") return;
        if (busyId) return;
        const rowId = String(row.id || "");
        if (!rowId) return;

        const ok = window.confirm(
            approveCancel
                ? `Bu iptal talebini onaylayip siparisi iptal etmek istiyor musun? (#${String(row.order_id)})`
                : `Bu iptal talebini reddetmek istiyor musun? (#${String(row.order_id)})`
        );
        if (!ok) return;

        setBusyId(`cancel-${rowId}`);
        setError("");
        try {
            if (approveCancel) {
                const { error: ordErr } = await supabase
                    .from("orders")
                    .update({ status: "cancelled" })
                    .eq("id", Number(row.order_id));
                if (ordErr) throw ordErr;
            }

            const nextStatus = approveCancel ? "admin_approved" : "admin_rejected";
            const { error: reqErr } = await supabase
                .from("order_cancellation_requests")
                .update({ status: nextStatus, responded_at: new Date().toISOString(), resolved_by_admin_id: user.id })
                .eq("id", Number(row.id));
            if (reqErr) throw reqErr;

            setCancelEscalations((prev) => prev.filter((x) => String(x.id) !== rowId));
        } catch (e: any) {
            setError(String(e?.message || e || "Iptal talebi guncellenemedi"));
        } finally {
            setBusyId("");
        }
    };

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-50 uppercase font-black text-xs tracking-widest animate-pulse">
                Yükleniyor...
            </div>
        );
    }

    if (!user || user.role !== "admin") return null;

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="mb-8 flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-heading uppercase">💸 Ödeme Talepleri</h1>
                    <p className="text-[10px] text-gray-400 font-bold mt-1">Freelancer para çekme taleplerini buradan onaylayabilirsin.</p>
                </div>
                <Link href="/admin" className="text-sm font-bold text-blue-600 hover:text-blue-700">
                    Yönetim Paneli
                </Link>
            </div>

            {error && (
                <div className="mb-4 p-4 text-xs font-black text-red-600 bg-red-50 border-2 border-red-100 rounded-xl uppercase tracking-tight">
                    {error}
                </div>
            )}

            <div className="bg-white border rounded-[2rem] overflow-hidden shadow-sm">
                <div className="p-8 border-b bg-gray-50/30 flex items-center justify-between">
                    <h3 className="font-black text-gray-900 text-lg uppercase tracking-tight">Bekleyen Talepler ({pendingRows.length})</h3>
                </div>

                {pendingRows.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 font-semibold">Bekleyen ödeme talebi yok.</div>
                ) : (
                    <div className="divide-y">
                        {pendingRows.map((r) => {
                            const prof = profiles[r.user_id];
                            const display = prof?.full_name || prof?.username || r.user_id;
                            const profileHref = prof?.id ? `/admin/users/${prof.id}` : undefined;
                            const busy = busyId === String(r.id);
                            return (
                                <div key={String(r.id)} className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="text-xs font-mono text-gray-400">#{String(r.id)}</div>
                                        <div className="font-black text-gray-900 truncate">
                                            {profileHref ? (
                                                <Link href={profileHref} className="text-blue-600 hover:underline">
                                                    {display}
                                                </Link>
                                            ) : (
                                                display
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500 font-bold mt-1">
                                            IBAN: <span className="font-mono">{prof?.iban || "—"}</span>
                                        </div>
                                        <div className="text-[10px] text-gray-400 font-bold mt-1">
                                            {r.created_at ? new Date(r.created_at).toLocaleString("tr-TR") : ""}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between md:justify-end gap-4">
                                        <div className="text-right">
                                            <div className="text-2xl font-black text-gray-900">₺{Number(r.amount || 0).toLocaleString("tr-TR")}</div>
                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tutar</div>
                                        </div>
                                        <Button disabled={busy} onClick={() => approve(r)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black">
                                            {busy ? "Onaylanıyor..." : "Ödemeyi Onayla"}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="mt-8 bg-white border rounded-[2rem] overflow-hidden shadow-sm">
                <div className="p-8 border-b bg-gray-50/30 flex items-center justify-between">
                    <h3 className="font-black text-gray-900 text-lg uppercase tracking-tight">3+ Gun Bekleyen Iptal Talepleri ({cancelEscalations.length})</h3>
                </div>

                {cancelEscalations.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 font-semibold">3 gunu gecen bekleyen iptal talebi yok.</div>
                ) : (
                    <div className="divide-y">
                        {cancelEscalations.map((r) => {
                            const busy = busyId === `cancel-${String(r.id)}`;
                            return (
                                <div key={String(r.id)} className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="text-xs font-mono text-gray-400">Talep #{String(r.id)} - Siparis #{String(r.order_id)}</div>
                                        <div className="font-black text-gray-900 truncate">
                                            {r.requester_username} -> {r.responder_username}
                                        </div>
                                        <div className="text-xs text-gray-500 font-bold mt-1">
                                            Pay orani: %{Math.round(Number(r.compensation_rate || 0) * 100)}
                                        </div>
                                        {r.reason && <div className="text-xs text-gray-600 mt-1">{r.reason}</div>}
                                        <div className="text-[10px] text-gray-400 font-bold mt-1">
                                            {r.created_at ? new Date(r.created_at).toLocaleString("tr-TR") : ""}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-2">
                                        <Button disabled={busy} onClick={() => resolveCancelEscalation(r, false)} className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-black">
                                            Reddet
                                        </Button>
                                        <Button disabled={busy} onClick={() => resolveCancelEscalation(r, true)} className="bg-red-600 hover:bg-red-700 text-white font-black">
                                            Iptali Onayla
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
