"use client";

import { useAuth } from "@/components/auth/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, XCircle, MessageCircle, Star, PackageOpen } from "lucide-react";
import { getUserOrders, type Order } from "@/lib/data-service";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type CancellationRequestRow = {
    id: string | number;
    order_id: string | number;
    requester_id: string;
    requester_username: string;
    requester_role: "employer" | "freelancer";
    responder_id: string;
    responder_username: string;
    responder_role: "employer" | "freelancer";
    compensation_rate: number;
    reason: string | null;
    status: "pending" | "accepted" | "rejected" | "admin_approved" | "admin_rejected";
    created_at: string;
    responded_at: string | null;
};

const statusConfig = {
    pending: { label: "Bekliyor", icon: Clock, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
    active: { label: "Devam Ediyor", icon: Clock, color: "text-blue-600 bg-blue-50 border-blue-200" },
    delivered: { label: "Teslim Edildi", icon: CheckCircle2, color: "text-purple-600 bg-purple-50 border-purple-200" },
    completed: { label: "Tamamlandı", icon: CheckCircle2, color: "text-green-600 bg-green-50 border-green-200" },
    cancelled: { label: "İptal Edildi", icon: XCircle, color: "text-red-600 bg-red-50 border-red-200" },
};

export default function OrdersPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [cancelRequests, setCancelRequests] = useState<CancellationRequestRow[]>([]);
    const [busyId, setBusyId] = useState<string>("");

    const [reviewOpen, setReviewOpen] = useState(false);
    const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
    const [reviewRating, setReviewRating] = useState<string>("5");
    const [reviewComment, setReviewComment] = useState<string>("");

    const loadCancellationRequests = async (orderRows: Order[]) => {
        const ids = orderRows.map((o) => Number(o.id)).filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length === 0) {
            setCancelRequests([]);
            return;
        }

        const { data, error } = await supabase
            .from("order_cancellation_requests")
            .select("id, order_id, requester_id, requester_username, requester_role, responder_id, responder_username, responder_role, compensation_rate, reason, status, created_at, responded_at")
            .in("order_id", ids)
            .order("created_at", { ascending: false });

        if (error) {
            setCancelRequests([]);
            return;
        }
        setCancelRequests((data || []) as unknown as CancellationRequestRow[]);
    };

    useEffect(() => {
        if (!user) { router.push("/login"); return; }
        (async () => {
            const rows = await getUserOrders(user.username, user.role as "employer" | "freelancer" | "admin");
            setOrders(rows);
            await loadCancellationRequests(rows);
        })();
    }, [user, router]);

    const refresh = async () => {
        if (!user) return;
        const rows = await getUserOrders(user.username, user.role as "employer" | "freelancer" | "admin");
        setOrders(rows);
        await loadCancellationRequests(rows);
    };

    const handleRequestCancellation = async (order: Order) => {
        if (!user) return;
        if (busyId) return;
        if (!order.id) return;
        if (order.status !== "active" && order.status !== "delivered") return;

        const reason = (window.prompt("Iptal gerekcesini yazin:", "") || "").trim();
        if (!reason) return;

        const ratioRaw = (window.prompt("Odeme payi secin: 0, 25, 50, 75, 100", "50") || "").trim();
        const ratio = Number(ratioRaw);
        if (!Number.isFinite(ratio) || ratio < 0 || ratio > 100) {
            window.alert("Gecerli bir oran secin (0-100).");
            return;
        }
        const compensationRate = ratio / 100;

        const requesterRole = user.role === "employer" ? "employer" : "freelancer";
        const responderRole = requesterRole === "employer" ? "freelancer" : "employer";
        const requesterUsername = user.username;
        const responderUsername = requesterRole === "employer" ? order.freelancer : order.client;
        const responderId = requesterRole === "employer" ? (order.sellerId || "") : (order.buyerId || "");
        if (!responderId) {
            window.alert("Karsi taraf bilgisi bulunamadi.");
            return;
        }

        const existingPending = cancelRequests.find(
            (r) => Number(r.order_id) === Number(order.id) && String(r.status) === "pending"
        );
        if (existingPending) {
            window.alert("Bu siparis icin zaten bekleyen bir iptal talebi var.");
            return;
        }

        setBusyId(order.id);
        try {
            const { error } = await supabase.from("order_cancellation_requests").insert([
                {
                    order_id: Number(order.id),
                    requester_id: user.id,
                    requester_username: requesterUsername,
                    requester_role: requesterRole,
                    responder_id: responderId,
                    responder_username: responderUsername,
                    responder_role: responderRole,
                    compensation_rate: compensationRate,
                    reason,
                    status: "pending",
                },
            ]);
            if (error) throw error;
            await refresh();
        } catch (e: any) {
            window.alert("Iptal talebi olusturulamadi: " + String(e?.message || e));
        } finally {
            setBusyId("");
        }
    };

    const handleRespondCancellation = async (req: CancellationRequestRow, decision: "accepted" | "rejected") => {
        if (!user) return;
        if (busyId) return;
        if (String(req.status) !== "pending") return;
        if (String(req.responder_id) !== String(user.id)) return;

        const key = `cancel-${String(req.id)}`;
        setBusyId(key);
        try {
            const { error: updErr } = await supabase
                .from("order_cancellation_requests")
                .update({ status: decision, responded_at: new Date().toISOString() })
                .eq("id", Number(req.id));
            if (updErr) throw updErr;

            if (decision === "accepted") {
                const { error: ordErr } = await supabase
                    .from("orders")
                    .update({ status: "cancelled" })
                    .eq("id", Number(req.order_id));
                if (ordErr) throw ordErr;
            }

            await refresh();
            if (typeof window !== "undefined") window.dispatchEvent(new Event("orders_updated"));
        } catch (e: any) {
            window.alert("Iptal talebi guncellenemedi: " + String(e?.message || e));
        } finally {
            setBusyId("");
        }
    };

    const handleSendDelivery = async (order: Order) => {
        if (!user) return;
        if (busyId) return;
        if (user.role !== "freelancer") return;
        if (!order.id) return;

        const message = window.prompt("Teslim notu (opsiyonel):", "") ?? "";

        setBusyId(order.id);
        try {
            const { error: insErr } = await supabase.from("order_deliveries").insert([
                {
                    order_id: Number(order.id),
                    sender_id: user.id,
                    sender_role: "freelancer",
                    kind: "delivery",
                    message: message.trim() || null,
                    files: null,
                },
            ]);
            if (insErr) throw insErr;

            const { error: updErr } = await supabase
                .from("orders")
                .update({ status: "delivered" })
                .eq("id", Number(order.id));
            if (updErr) throw updErr;

            await refresh();
            if (typeof window !== "undefined") window.dispatchEvent(new Event("orders_updated"));
        } catch (e: any) {
            window.alert("Teslim gönderilemedi: " + String(e?.message || e));
        } finally {
            setBusyId("");
        }
    };

    const insertReview = async (order: Order, rating: number, comment: string) => {
        if (!user) return;
        if (busyId) return;
        if (order.status !== "completed") return;

        const otherId = user.role === "employer" ? order.sellerId : order.buyerId;
        if (!otherId) {
            window.alert("Karşı taraf bilgisi bulunamadı.");
            return;
        }

        setBusyId(order.id);
        try {
            const { error } = await supabase.from("reviews").insert([
                {
                    order_id: Number(order.id),
                    from_user_id: user.id,
                    to_user_id: otherId,
                    rating,
                    comment: comment.trim() || null,
                },
            ]);
            if (error) {
                const msg = String(error.message || "");
                if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique")) {
                    window.alert("Bu sipariş için zaten değerlendirme yapmışsın.");
                } else {
                    window.alert("Değerlendirme kaydedilemedi: " + msg);
                }
                return;
            }
            window.alert("Değerlendirmen kaydedildi.");
        } catch (e: any) {
            window.alert("Değerlendirme kaydedilemedi: " + String(e?.message || e));
        } finally {
            setBusyId("");
        }
    };

    const handleReviewPrompt = async (order: Order) => {
        if (!user) return;
        if (busyId) return;
        if (order.status !== "completed") return;

        const ratingRaw = window.prompt("Puan (1-5):", "5");
        if (ratingRaw === null) return;
        const rating = Math.round(Number(String(ratingRaw).trim()));
        if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
            window.alert("Puan 1 ile 5 arasında olmalıdır.");
            return;
        }

        const comment = (window.prompt("Yorum (opsiyonel):", "") ?? "").trim();

        await insertReview(order, rating, comment);
    };

    const openReviewModal = (order: Order) => {
        if (!user) return;
        if (busyId) return;
        if (order.status !== "completed") return;
        setReviewOrder(order);
        setReviewRating("5");
        setReviewComment("");
        setReviewOpen(true);
    };

    const submitReviewModal = async () => {
        if (!reviewOrder) return;
        const rating = Math.round(Number(String(reviewRating).trim()));
        if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
            window.alert("Puan 1 ile 5 arasında olmalıdır.");
            return;
        }
        setReviewOpen(false);
        const o = reviewOrder;
        setReviewOrder(null);
        await insertReview(o, rating, reviewComment);
    };

    const handleRequestRevision = async (order: Order) => {
        if (!user) return;
        if (busyId) return;
        if (user.role !== "employer") return;
        if (order.status !== "delivered") return;

        const reason = window.prompt("Revizyon isteği (gerekçe):", "") ?? "";
        if (!reason.trim()) return;

        setBusyId(order.id);
        try {
            const { error: insErr } = await supabase.from("order_deliveries").insert([
                {
                    order_id: Number(order.id),
                    sender_id: user.id,
                    sender_role: "employer",
                    kind: "revision_request",
                    message: reason.trim(),
                    files: null,
                },
            ]);
            if (insErr) throw insErr;

            const { error: updErr } = await supabase
                .from("orders")
                .update({ status: "active" })
                .eq("id", Number(order.id));
            if (updErr) throw updErr;

            await refresh();
            if (typeof window !== "undefined") window.dispatchEvent(new Event("orders_updated"));
        } catch (e: any) {
            window.alert("Revizyon isteği gönderilemedi: " + String(e?.message || e));
        } finally {
            setBusyId("");
        }
    };

    const handleAcceptDelivery = async (order: Order) => {
        if (!user) return;
        if (busyId) return;
        if (user.role !== "employer") return;
        if (order.status !== "delivered") return;
        if (order.paidToSeller) {
            window.alert("Bu sipariş için ödeme zaten cüzdana aktarılmış.");
            return;
        }

        const ok = window.confirm("Teslimi onaylayıp siparişi tamamlamak istiyor musun?");
        if (!ok) return;

        setBusyId(order.id);
        try {
            const { error: insErr } = await supabase.from("order_deliveries").insert([
                {
                    order_id: Number(order.id),
                    sender_id: user.id,
                    sender_role: "employer",
                    kind: "accept",
                    message: null,
                    files: null,
                },
            ]);
            if (insErr) throw insErr;

            const { error: updErr } = await supabase
                .from("orders")
                .update({ status: "completed" })
                .eq("id", Number(order.id));
            if (updErr) throw updErr;

            if (!order.sellerId) throw new Error("Satıcı bilgisi bulunamadı");
            const creditAmount = Number(order.price);
            if (!Number.isFinite(creditAmount) || creditAmount <= 0) throw new Error("Tutar geçersiz");

            const { error: ledErr } = await supabase.from("wallet_ledger").insert([
                {
                    user_id: order.sellerId,
                    order_id: Number(order.id),
                    type: "credit",
                    amount: creditAmount,
                    description: `Sipariş kazancı (#${order.id})`,
                },
            ]);
            if (ledErr) throw ledErr;

            const { error: paidErr } = await supabase
                .from("orders")
                .update({ paid_to_seller: true })
                .eq("id", Number(order.id));
            if (paidErr) throw paidErr;

            await refresh();
            if (typeof window !== "undefined") window.dispatchEvent(new Event("orders_updated"));
        } catch (e: any) {
            window.alert("Onay işlemi başarısız: " + String(e?.message || e));
        } finally {
            setBusyId("");
        }
    };

    if (!user) return null;

    const pending = orders.filter(o => o.status === "pending").length;
    const active = orders.filter(o => o.status === "active").length;
    const delivered = orders.filter(o => o.status === "delivered").length;
    const completed = orders.filter(o => o.status === "completed").length;

    return (
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {reviewOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Star className="h-5 w-5 text-amber-500" />
                                <h3 className="font-black text-slate-900">Değerlendirme</h3>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setReviewOpen(false);
                                    setReviewOrder(null);
                                }}
                            >
                                Kapat
                            </Button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <div className="text-xs font-black uppercase tracking-widest text-slate-500">Puan (1-5)</div>
                                <Input value={reviewRating} onChange={(e) => setReviewRating(e.target.value)} className="h-11" />
                            </div>

                            <div className="space-y-2">
                                <div className="text-xs font-black uppercase tracking-widest text-slate-500">Yorum (opsiyonel)</div>
                                <Textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} className="min-h-[110px]" />
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    const o = reviewOrder;
                                    setReviewOpen(false);
                                    setReviewOrder(null);
                                    if (o) void handleReviewPrompt(o);
                                }}
                            >
                                Prompt ile hızlı değerlendir
                            </Button>
                            <Button onClick={submitReviewModal} disabled={!!busyId} className="bg-slate-900 hover:bg-slate-800 text-white">
                                Kaydet
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            <div className="mb-8 text-center sm:text-left">
                <h1 className="text-3xl font-bold font-heading">📋 Siparişlerim</h1>
                <p className="text-gray-500 mt-1">Tüm siparişlerini buradan takip edebilirsin.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mb-8">
                {[
                    { label: "Toplam", count: orders.length, color: "bg-gray-50 text-gray-800" },
                    { label: "Bekliyor", count: pending, color: "bg-yellow-50 text-yellow-700" },
                    { label: "Devam Ediyor", count: active, color: "bg-blue-50 text-blue-700" },
                    { label: "Teslim Edildi", count: delivered, color: "bg-purple-50 text-purple-700" },
                    { label: "Tamamlandı", count: completed, color: "bg-green-50 text-green-700" },
                ].map((stat) => (
                    <div key={stat.label} className={`${stat.color} rounded-xl p-4 text-center border`}>
                        <div className="text-2xl font-bold">{stat.count}</div>
                        <div className="text-xs font-medium mt-1">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Orders List */}
            {orders.length === 0 ? (
                <div className="bg-white border rounded-2xl p-8 sm:p-12 text-center">
                    <PackageOpen className="h-16 w-16 mx-auto mb-4 text-gray-200" />
                    <h3 className="font-semibold text-gray-700 text-lg">Henüz sipariş yok</h3>
                    <p className="text-gray-400 mt-2 max-w-md mx-auto">
                        {user.role === "freelancer"
                            ? "Hizmet ilanlarınız üzerinden sipariş aldığınızda burada görünecek."
                            : "Bir freelancer'dan hizmet satın aldığınızda burada listelenecek."
                        }
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map((order) => {
                        const config = statusConfig[order.status];
                        const StatusIcon = config.icon;
                        const isMineFreelancer = user.role === "freelancer" && user.username === order.freelancer;
                        const isMineEmployer = user.role === "employer" && user.username === order.client;
                        const latestCancelReq = cancelRequests.find((r) => Number(r.order_id) === Number(order.id));
                        const cancelPending = !!latestCancelReq && String(latestCancelReq.status) === "pending";
                        const canRespondCancel =
                            !!latestCancelReq &&
                            String(latestCancelReq.status) === "pending" &&
                            String(latestCancelReq.responder_id || "") === String(user.id || "");
                        const busy = busyId === order.id;

                        return (
                            <div key={order.id} className="bg-white border rounded-xl p-6 hover:shadow-md transition-shadow">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-xs font-mono text-gray-400">{order.id}</span>
                                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${config.color}`}>
                                                <StatusIcon className="h-3 w-3" />
                                                {config.label}
                                            </span>
                                        </div>
                                        <h3 className="font-semibold text-gray-900 text-lg">{order.title}</h3>
                                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-2">
                                            <span>👤 {user.role === "freelancer" ? `İş Veren: ${order.client}` : `Freelancer: ${order.freelancer}`}</span>
                                            <span>📅 {order.createdAt}</span>
                                            <span>⏰ Teslim: {order.dueDate}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-end">
                                        <div className="text-center sm:text-right">
                                            <div className="text-xl font-bold text-gray-900">₺{order.price.toLocaleString("tr-TR")}</div>
                                            <span className="text-xs text-gray-400">Toplam Tutar</span>
                                        </div>
                                        <div className="flex gap-2 justify-center sm:justify-end">
                                            <Button variant="ghost" size="icon" title="Mesaj Gönder">
                                                <MessageCircle className="h-4 w-4" />
                                            </Button>
                                            {order.status === "active" && isMineFreelancer && (
                                                <Button
                                                    size="sm"
                                                    disabled={busy}
                                                    onClick={() => handleSendDelivery(order)}
                                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                                >
                                                    📦 Teslim Gönder
                                                </Button>
                                            )}
                                            {order.status === "delivered" && (
                                                <>
                                                    {isMineEmployer && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                disabled={busy}
                                                                onClick={() => handleRequestRevision(order)}
                                                                className="bg-gray-200 hover:bg-gray-300 text-gray-900"
                                                            >
                                                                🔁 Revizyon
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                disabled={busy}
                                                                onClick={() => handleAcceptDelivery(order)}
                                                                className="bg-green-600 hover:bg-green-700 text-white"
                                                            >
                                                                ✅ Onayla
                                                            </Button>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                            {order.status === "completed" && (
                                                <Button variant="outline" size="sm" disabled={busy} onClick={() => openReviewModal(order)}>
                                                    <Star className="h-4 w-4 mr-1" /> Değerlendir
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
