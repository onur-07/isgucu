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
import { pushLocalNotification } from "@/lib/notification-center";
import { canTransitionOrderStatus, transitionGuardMessage } from "@/lib/order-state";
import { logAuditEvent } from "@/lib/audit-log";

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

type OrderDeliveryRow = {
    order_id: string | number;
    kind: "delivery" | "revision_request" | "accept" | string;
    message: string | null;
    created_at: string;
};

type WorkspaceItemRow = {
    id: string | number;
    order_id: string | number;
    author_id: string;
    author_role: "employer" | "freelancer";
    content: string;
    is_done: boolean;
    created_at: string;
};

type ScheduleRequestRow = {
    id: string | number;
    order_id: string | number;
    requester_id: string;
    requester_role: "employer" | "freelancer";
    responder_id: string;
    requested_days: number;
    reason: string | null;
    status: "pending" | "accepted" | "rejected";
    created_at: string;
};

type ScheduleDecision = "accepted" | "rejected";

const cancellationStatusLabel = (status: string | null | undefined) => {
    const s = String(status || "").toLowerCase();
    if (s === "pending") return "Bekliyor";
    if (s === "accepted") return "Onaylandı";
    if (s === "rejected") return "Reddedildi";
    if (s === "admin_approved") return "Admin Onayladı";
    if (s === "admin_rejected") return "Admin Reddetti";
    return "Bilinmiyor";
};

const scheduleStatusLabel = (status: string | null | undefined) => {
    const s = String(status || "").toLowerCase();
    if (s === "pending") return "Onay Bekliyor";
    if (s === "accepted") return "Onaylandı";
    if (s === "rejected") return "Reddedildi";
    return "Bilinmiyor";
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
    const [revisionNotesByOrder, setRevisionNotesByOrder] = useState<Record<string, string>>({});
    const [workspaceByOrder, setWorkspaceByOrder] = useState<Record<string, WorkspaceItemRow[]>>({});
    const [workspaceInputByOrder, setWorkspaceInputByOrder] = useState<Record<string, string>>({});
    const [scheduleRequests, setScheduleRequests] = useState<ScheduleRequestRow[]>([]);
    const [busyId, setBusyId] = useState<string>("");

    const [reviewOpen, setReviewOpen] = useState(false);
    const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
    const [reviewRating, setReviewRating] = useState<string>("5");
    const [reviewHover, setReviewHover] = useState<number>(0);
    const [reviewComment, setReviewComment] = useState<string>("");
    const [reviewCommunication, setReviewCommunication] = useState<string>("5");
    const [reviewQuality, setReviewQuality] = useState<string>("5");
    const [reviewSpeed, setReviewSpeed] = useState<string>("5");
    const norm = (v: string | null | undefined) => String(v || "").trim().toLowerCase();

    const [deliveryOpen, setDeliveryOpen] = useState(false);
    const [deliveryOrder, setDeliveryOrder] = useState<Order | null>(null);
    const [deliveryMessage, setDeliveryMessage] = useState("");

    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
    const [cancelReason, setCancelReason] = useState("");
    const [cancelRatio, setCancelRatio] = useState("50");

    const [revisionOpen, setRevisionOpen] = useState(false);
    const [revisionOrder, setRevisionOrder] = useState<Order | null>(null);
    const [revisionReason, setRevisionReason] = useState("");

    const [acceptOpen, setAcceptOpen] = useState(false);
    const [acceptOrder, setAcceptOrder] = useState<Order | null>(null);
    const [openedFromNotif, setOpenedFromNotif] = useState(false);
    const [disputeOpen, setDisputeOpen] = useState(false);
    const [disputeOrder, setDisputeOrder] = useState<Order | null>(null);
    const [disputeReason, setDisputeReason] = useState("");
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [scheduleOrder, setScheduleOrder] = useState<Order | null>(null);
    const [scheduleDays, setScheduleDays] = useState("1");
    const [scheduleReason, setScheduleReason] = useState("");
    const [scheduleDecisionOpen, setScheduleDecisionOpen] = useState(false);
    const [scheduleDecisionRequest, setScheduleDecisionRequest] = useState<ScheduleRequestRow | null>(null);
    const [scheduleDecisionType, setScheduleDecisionType] = useState<ScheduleDecision>("accepted");

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

    const loadRevisionNotes = async (orderRows: Order[]) => {
        const ids = orderRows.map((o) => Number(o.id)).filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length === 0) {
            setRevisionNotesByOrder({});
            return;
        }

        const { data, error } = await supabase
            .from("order_deliveries")
            .select("order_id, kind, message, created_at")
            .eq("kind", "revision_request")
            .in("order_id", ids)
            .order("created_at", { ascending: false });

        if (error) {
            setRevisionNotesByOrder({});
            return;
        }

        const rows = (data || []) as unknown as OrderDeliveryRow[];
        const next: Record<string, string> = {};
        for (const row of rows) {
            const key = String(row.order_id || "");
            if (!key || next[key]) continue;
            const msg = String(row.message || "").trim();
            if (msg) next[key] = msg;
        }
        setRevisionNotesByOrder(next);
    };

    const loadWorkspace = async (orderRows: Order[]) => {
        const ids = orderRows.map((o) => Number(o.id)).filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length === 0) {
            setWorkspaceByOrder({});
            return;
        }
        const { data, error } = await supabase
            .from("order_workspace_items")
            .select("id, order_id, author_id, author_role, content, is_done, created_at")
            .in("order_id", ids)
            .order("created_at", { ascending: false });
        if (error) {
            setWorkspaceByOrder({});
            return;
        }
        const rows = (data || []) as unknown as WorkspaceItemRow[];
        const map: Record<string, WorkspaceItemRow[]> = {};
        for (const r of rows) {
            const k = String(r.order_id || "");
            if (!k) continue;
            if (!map[k]) map[k] = [];
            map[k].push(r);
        }
        setWorkspaceByOrder(map);
    };

    const loadScheduleRequests = async (orderRows: Order[]) => {
        const ids = orderRows.map((o) => Number(o.id)).filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length === 0) {
            setScheduleRequests([]);
            return;
        }
        const { data, error } = await supabase
            .from("order_schedule_requests")
            .select("id, order_id, requester_id, requester_role, responder_id, requested_days, reason, status, created_at")
            .in("order_id", ids)
            .order("created_at", { ascending: false });
        if (error) {
            setScheduleRequests([]);
            return;
        }
        setScheduleRequests((data || []) as unknown as ScheduleRequestRow[]);
    };

    useEffect(() => {
        if (!user) { router.push("/login"); return; }
        (async () => {
            const rows = await getUserOrders(user.username, user.role as "employer" | "freelancer" | "admin", user.id);
            setOrders(rows);
            await loadCancellationRequests(rows);
            await loadRevisionNotes(rows);
            await loadWorkspace(rows);
            await loadScheduleRequests(rows);
        })();
    }, [user, router]);

    useEffect(() => {
        if (!user || (user.role !== "employer" && user.role !== "freelancer")) return;
        let cancelled = false;

        const runReminderScan = async () => {
            const rawUsername = String(user.username || "").trim();
            if (!rawUsername) return;

            const seenKey = `isgucu_order_reminder_seen_${norm(rawUsername)}`;
            let seen: Record<string, string> = {};
            try {
                const raw = localStorage.getItem(seenKey);
                seen = raw ? (JSON.parse(raw) as Record<string, string>) : {};
            } catch {
                seen = {};
            }

            const filter =
                user.role === "employer"
                    ? `buyer_id.eq.${user.id},buyer_username.ilike.${rawUsername}`
                    : `seller_id.eq.${user.id},seller_username.ilike.${rawUsername}`;

            const res = await supabase
                .from("orders")
                .select("id, status, created_at, buyer_username, seller_username")
                .or(filter)
                .order("created_at", { ascending: false })
                .limit(200);

            if (cancelled || res.error) return;

            const rows = (res.data || []) as Array<{
                id?: string | number;
                status?: string;
                created_at?: string;
                buyer_username?: string;
                seller_username?: string;
            }>;

            const now = Date.now();
            const nextSeen = { ...seen };

            for (const row of rows) {
                const id = String(row.id || "");
                const status = String(row.status || "").toLowerCase();
                const created = new Date(String(row.created_at || "")).getTime();
                if (!id || !Number.isFinite(created)) continue;

                if (user.role === "employer" && status === "delivered" && now - created >= 48 * 60 * 60 * 1000) {
                    const marker = `${id}:delivered`;
                    if (nextSeen[marker]) continue;
                    pushLocalNotification(rawUsername, {
                        id: `order-reminder-employer-${id}`,
                        type: "order",
                        title: "Teslim Bekleyen Sipariş",
                        description: `#${id} numaralı sipariş teslim edildi. Onaylayabilir veya revizyon isteyebilirsiniz.`,
                        actionUrl: "/orders",
                        actionLabel: "Siparişe Git",
                    });
                    nextSeen[marker] = new Date().toISOString();
                }

                if (user.role === "freelancer" && (status === "pending" || status === "active") && now - created >= 72 * 60 * 60 * 1000) {
                    const marker = `${id}:active`;
                    if (nextSeen[marker]) continue;
                    pushLocalNotification(rawUsername, {
                        id: `order-reminder-freelancer-${id}`,
                        type: "order",
                        title: "Devam Eden Sipariş Hatırlatması",
                        description: `#${id} numaralı siparişiniz uzun süredir açık. Teslim adımını kontrol edin.`,
                        actionUrl: "/orders",
                        actionLabel: "Siparişe Git",
                    });
                    nextSeen[marker] = new Date().toISOString();
                }
            }

            localStorage.setItem(seenKey, JSON.stringify(nextSeen));
        };

        runReminderScan();
        const interval = window.setInterval(runReminderScan, 10 * 60 * 1000);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [user]);

    const refresh = async () => {
        if (!user) return;
        const rows = await getUserOrders(user.username, user.role as "employer" | "freelancer" | "admin", user.id);
        setOrders(rows);
        await loadCancellationRequests(rows);
        await loadRevisionNotes(rows);
        await loadWorkspace(rows);
        await loadScheduleRequests(rows);
    };

    const safeTransitionOrderStatus = async (orderId: number, nextStatus: "active" | "delivered" | "completed" | "cancelled") => {
        const { data: current, error: currentErr } = await supabase
            .from("orders")
            .select("id, status")
            .eq("id", orderId)
            .maybeSingle();
        if (currentErr) throw currentErr;
        const fromStatus = String((current as any)?.status || "");
        if (!canTransitionOrderStatus(fromStatus, nextStatus)) {
            throw new Error(transitionGuardMessage(fromStatus, nextStatus));
        }
        const { error: updErr } = await supabase
            .from("orders")
            .update({ status: nextStatus })
            .eq("id", orderId);
        if (updErr) throw updErr;

        await logAuditEvent(supabase, {
            actorId: user?.id,
            actorRole: user?.role,
            action: "order_status_transition",
            targetType: "order",
            targetId: String(orderId),
            metadata: { fromStatus, toStatus: nextStatus },
        });
    };

    const reopenRelatedJobIfAny = async (orderId: number) => {
        const { data: orderRow, error: ordSelErr } = await supabase
            .from("orders")
            .select("package_key")
            .eq("id", orderId)
            .maybeSingle();
        if (ordSelErr) throw ordSelErr;

        const packageKey = String((orderRow as any)?.package_key || "");
        if (!packageKey.startsWith("offer:")) return;

        const offerIdRaw = packageKey.slice("offer:".length);
        const offerIdNum = Number(offerIdRaw);
        const offerFilter = Number.isFinite(offerIdNum) && offerIdNum > 0
            ? supabase.from("offers").select("extras").eq("id", offerIdNum).maybeSingle()
            : supabase.from("offers").select("extras").eq("id", offerIdRaw).maybeSingle();
        const { data: offerRow, error: offerSelErr } = await offerFilter;
        if (offerSelErr) throw offerSelErr;

        const extras = (offerRow as any)?.extras as { source?: string; job_id?: string | number } | null | undefined;
        if (!extras || String(extras.source || "") !== "job") return;

        const jobIdNum = Number(extras.job_id);
        if (!Number.isFinite(jobIdNum) || jobIdNum <= 0) return;

        const { error: jobUpdErr } = await supabase
            .from("jobs")
            .update({ status: "open" })
            .eq("id", jobIdNum);
        if (jobUpdErr) throw jobUpdErr;
    };

    const handleRequestCancellation = async (order: Order, reasonInput: string, ratioInput: string) => {
        if (!user) return;
        if (busyId) return;
        if (!order.id) return;
        if (order.status !== "active" && order.status !== "pending" && order.status !== "delivered") return;

        const reason = String(reasonInput || "").trim();
        if (!reason) return;

        const ratioRaw = String(ratioInput || "").trim();
        const ratio = Number(ratioRaw);
        if (!Number.isFinite(ratio) || ratio < 0 || ratio > 100) {
            window.alert("Geçerli bir oran seçin (0-100).");
            return;
        }
        const compensationRate = ratio / 100;

        const requesterRole = user.role === "employer" ? "employer" : "freelancer";
        const responderRole = requesterRole === "employer" ? "freelancer" : "employer";
        const requesterUsername = user.username;
        const responderUsername = requesterRole === "employer" ? order.freelancer : order.client;
        const responderId = requesterRole === "employer" ? (order.sellerId || "") : (order.buyerId || "");
        if (!responderId) {
            window.alert("Karşı taraf bilgisi bulunamadı.");
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
            await logAuditEvent(supabase, {
                actorId: user.id,
                actorRole: user.role,
                action: "order_cancel_request_created",
                targetType: "order",
                targetId: String(order.id),
                metadata: { compensationRate, requesterRole, responderRole },
            });
            await refresh();
        } catch (e: any) {
            window.alert("İptal talebi oluşturulamadı: " + String(e?.message || e));
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
                await safeTransitionOrderStatus(Number(req.order_id), "cancelled");
                await reopenRelatedJobIfAny(Number(req.order_id));
            }

            await refresh();
            if (typeof window !== "undefined") window.dispatchEvent(new Event("orders_updated"));
        } catch (e: any) {
            window.alert("İptal talebi güncellenemedi: " + String(e?.message || e));
        } finally {
            setBusyId("");
        }
    };

    const handleOpenDispute = async (order: Order, reasonInput: string) => {
        if (!user || !order?.id || busyId) return;
        const reason = String(reasonInput || "").trim();
        if (!reason) return;
        setBusyId(String(order.id));
        try {
            const openedByRole = user.role === "employer" ? "employer" : "freelancer";
            const { error } = await supabase.from("order_disputes").insert([
                {
                    order_id: Number(order.id),
                    opened_by_id: user.id,
                    opened_by_role: openedByRole,
                    reason: reason.trim(),
                    status: "open",
                },
            ]);
            if (error) throw error;

            const counterpartyUsername = openedByRole === "employer" ? order.freelancer : order.client;
            const openerLabel = openedByRole === "employer" ? "İş veren" : "Freelancer";
            pushLocalNotification(counterpartyUsername, {
                id: `dispute-open-counterparty-${Date.now()}-${String(order.id)}`,
                type: "system",
                title: "Sipariş için anlaşmazlık bildirimi",
                description: `${openerLabel} #${order.id} siparişi için anlaşmazlık başlattı. Detayları sipariş ekranından takip edebilirsiniz.`,
                actionUrl: "/orders",
                actionLabel: "Siparişe Git",
            });
            pushLocalNotification(user.username, {
                id: `dispute-open-self-${Date.now()}-${String(order.id)}`,
                type: "system",
                title: "Anlaşmazlık kaydı oluşturuldu",
                description: `#${order.id} siparişiniz için anlaşmazlık talebiniz alındı. Yönetici ekibe iletildi.`,
                actionUrl: "/orders",
                actionLabel: "Siparişe Git",
            });
            await supabase.from("support_tickets").insert([
                {
                    from_user: "SYSTEM",
                    from_email: "system@isgucu.local",
                    subject: `Anlaşmazlık Bildirimi #${String(order.id)}`,
                    category: "Sipariş Sorunu",
                    message: `Sipariş #${String(order.id)} için anlaşmazlık açıldı.\nAçan: ${String(user.username)} (${openedByRole})\nTaraflar: ${String(order.client)} ↔ ${String(order.freelancer)}\nGerekçe: ${reason}`,
                    status: "open",
                    priority: "high",
                },
            ]);

            await logAuditEvent(supabase, {
                actorId: user.id,
                actorRole: user.role,
                action: "order_dispute_opened",
                targetType: "order",
                targetId: String(order.id),
                metadata: { reason: reason.trim().slice(0, 180) },
            });
            await refresh();
        } catch (e: any) {
            window.alert("Anlaşmazlık oluşturulamadı: " + String(e?.message || e));
        } finally {
            setBusyId("");
        }
    };

    const handleAddWorkspaceItem = async (order: Order) => {
        if (!user || !order?.id || busyId) return;
        const content = String(workspaceInputByOrder[String(order.id)] || "").trim();
        if (!content) return;
        setBusyId(`ws-${String(order.id)}`);
        try {
            const role = user.role === "employer" ? "employer" : "freelancer";
            const { error } = await supabase.from("order_workspace_items").insert([
                {
                    order_id: Number(order.id),
                    author_id: user.id,
                    author_role: role,
                    kind: "todo",
                    content,
                    is_done: false,
                },
            ]);
            if (error) throw error;
            setWorkspaceInputByOrder((prev) => ({ ...prev, [String(order.id)]: "" }));
            await refresh();
        } catch (e: any) {
            window.alert("Çalışma alanı kaydı eklenemedi: " + String(e?.message || e));
        } finally {
            setBusyId("");
        }
    };

    const handleToggleWorkspaceDone = async (item: WorkspaceItemRow) => {
        if (busyId) return;
        setBusyId(`ws-item-${String(item.id)}`);
        try {
            const { error } = await supabase
                .from("order_workspace_items")
                .update({ is_done: !item.is_done, updated_at: new Date().toISOString() })
                .eq("id", Number(item.id));
            if (error) throw error;
            await refresh();
        } catch (e: any) {
            window.alert("Çalışma alanı kaydı güncellenemedi: " + String(e?.message || e));
        } finally {
            setBusyId("");
        }
    };

    const handleCreateScheduleRequest = async (order: Order) => {
        if (!user || !order?.id || busyId) return;
        if (user.role !== "freelancer") {
            window.alert("Teslim tarihi uzatma talebini sadece freelancer oluşturabilir.");
            return;
        }
        const days = Number(String(scheduleDays || "").trim());
        if (!Number.isFinite(days) || days <= 0) {
            window.alert("Lütfen geçerli bir gün sayısı girin.");
            return;
        }
        const reason = String(scheduleReason || "").trim();

        const requesterRole = "freelancer";
        const responderId = order.buyerId || "";
        if (!responderId) return;

        setBusyId(`sch-${String(order.id)}`);
        try {
            const { error } = await supabase.from("order_schedule_requests").insert([
                {
                    order_id: Number(order.id),
                    requester_id: user.id,
                    requester_role: requesterRole,
                    responder_id: responderId,
                    requested_days: days,
                    reason: reason || null,
                    status: "pending",
                },
            ]);
            if (error) throw error;

            pushLocalNotification(order.client, {
                id: `schedule-request-employer-${Date.now()}-${String(order.id)}`,
                type: "order",
                title: "Teslim tarihi onay talebi",
                description: `#${order.id} siparişi için freelancer +${days} gün ek süre talep etti. Onayınız bekleniyor.`,
                actionUrl: "/orders",
                actionLabel: "Talebi İncele",
            });
            pushLocalNotification(order.freelancer, {
                id: `schedule-request-freelancer-${Date.now()}-${String(order.id)}`,
                type: "order",
                title: "Teslim tarihi talebiniz gönderildi",
                description: `#${order.id} siparişiniz için +${days} gün talebiniz iş verene iletildi.`,
                actionUrl: "/orders",
                actionLabel: "Siparişe Git",
            });
            await refresh();
        } catch (e: any) {
            window.alert("Tarih uzatma talebi oluşturulamadı: " + String(e?.message || e));
        } finally {
            setBusyId("");
        }
    };

    const handleRespondScheduleRequest = async (req: ScheduleRequestRow, decision: "accepted" | "rejected") => {
        if (!user || busyId) return;
        if (String(req.responder_id) !== String(user.id)) return;
        setBusyId(`sch-req-${String(req.id)}`);
        try {
            const { error: updErr } = await supabase
                .from("order_schedule_requests")
                .update({ status: decision, responded_at: new Date().toISOString() })
                .eq("id", Number(req.id));
            if (updErr) throw updErr;
            const { data: ordDetails, error: ordDetErr } = await supabase
                .from("orders")
                .select("id, total_days, buyer_username, seller_username, created_at")
                .eq("id", Number(req.order_id))
                .maybeSingle();
            if (ordDetErr) throw ordDetErr;

            let newDueText = "";
            if (decision === "accepted") {
                const { data: ord, error: ordErr } = await supabase
                    .from("orders")
                    .select("id, total_days")
                    .eq("id", Number(req.order_id))
                    .maybeSingle();
                if (ordErr) throw ordErr;
                const currentDays = Number((ord as any)?.total_days || 0);
                const updatedTotalDays = currentDays + Number(req.requested_days || 0);
                const { error: ordUpdErr } = await supabase
                    .from("orders")
                    .update({ total_days: updatedTotalDays })
                    .eq("id", Number(req.order_id));
                if (ordUpdErr) throw ordUpdErr;

                const createdAtRaw = String((ordDetails as any)?.created_at || "");
                const createdAt = new Date(createdAtRaw);
                if (Number.isFinite(createdAt.getTime())) {
                    const due = new Date(createdAt.getTime() + updatedTotalDays * 24 * 60 * 60 * 1000);
                    newDueText = due.toLocaleDateString("tr-TR");
                }
            }

            const buyerUsername = String((ordDetails as any)?.buyer_username || "");
            const sellerUsername = String((ordDetails as any)?.seller_username || "");
            const decisionLabel = decision === "accepted" ? "onaylandı" : "reddedildi";
            const baseDesc =
                decision === "accepted"
                    ? `Teslim tarihi talebi onaylandı.${newDueText ? ` Yeni teslim tarihi: ${newDueText}.` : ""}`
                    : "Teslim tarihi talebi reddedildi.";
            pushLocalNotification(buyerUsername, {
                id: `schedule-response-buyer-${Date.now()}-${String(req.id)}`,
                type: "order",
                title: "Teslim tarihi talebi sonuçlandı",
                description: `#${String(req.order_id)} siparişindeki talep ${decisionLabel}. ${baseDesc}`,
                actionUrl: "/orders",
                actionLabel: "Siparişe Git",
            });
            pushLocalNotification(sellerUsername, {
                id: `schedule-response-seller-${Date.now()}-${String(req.id)}`,
                type: "order",
                title: "Teslim tarihi talebi sonuçlandı",
                description: `#${String(req.order_id)} siparişindeki talep ${decisionLabel}. ${baseDesc}`,
                actionUrl: "/orders",
                actionLabel: "Siparişe Git",
            });
            await refresh();
        } catch (e: any) {
            window.alert("Tarih talebi güncellenemedi: " + String(e?.message || e));
        } finally {
            setBusyId("");
        }
    };

    const handleSendDelivery = async (order: Order, messageInput: string) => {
        if (!user) return;
        if (busyId) return;
        if (user.role !== "freelancer") return;
        if (!order.id) return;
        if (order.status !== "active") return;
        const message = String(messageInput || "");

        setBusyId(order.id);
        try {
            const { data: deliveryRows } = await supabase
                .from("order_deliveries")
                .select("id")
                .eq("order_id", Number(order.id))
                .eq("kind", "delivery");
            const version = (Array.isArray(deliveryRows) ? deliveryRows.length : 0) + 1;

            const { error: insErr } = await supabase.from("order_deliveries").insert([
                {
                    order_id: Number(order.id),
                    sender_id: user.id,
                    sender_role: "freelancer",
                    kind: "delivery",
                    message: message.trim() || null,
                    files: { version },
                },
            ]);
            if (insErr) throw insErr;

            await safeTransitionOrderStatus(Number(order.id), "delivered");

            await refresh();
            const actionUrl = `/orders?reviewOrder=${encodeURIComponent(String(order.id))}`;
            pushLocalNotification(order.client, {
                id: `review-employer-${Date.now()}-${String(order.id)}`,
                type: "review",
                title: "Siparişinizi Değerlendirin",
                description: "Teslim alındıktan sonra süreci değerlendirmeniz iki taraf için de çok kıymetli.",
                actionUrl,
                actionLabel: "Değerlendir",
            });
            pushLocalNotification(order.freelancer, {
                id: `review-freelancer-${Date.now()}-${String(order.id)}`,
                type: "review",
                title: "İşinizi Değerlendirin",
                description: "Bu sipariş için kısa bir değerlendirme bırakabilirsiniz. Geri bildiriminiz önemlidir.",
                actionUrl,
                actionLabel: "Değerlendir",
            });
            if (typeof window !== "undefined") window.dispatchEvent(new Event("storage_updated"));
            if (typeof window !== "undefined") window.dispatchEvent(new Event("orders_updated"));
        } catch (e: any) {
            window.alert("Teslim gönderilemedi: " + String(e?.message || e));
        } finally {
            setBusyId("");
        }
    };

    const insertReview = async (
        order: Order,
        rating: number,
        comment: string,
        communicationRating: number,
        qualityRating: number,
        speedRating: number
    ) => {
        if (!user) return;
        if (busyId) return;
        if (order.status !== "completed" && order.status !== "delivered") return;

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
                    communication_rating: communicationRating,
                    quality_rating: qualityRating,
                    speed_rating: speedRating,
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

    const openReviewModal = (order: Order) => {
        if (!user) return;
        if (busyId) return;
        if (order.status !== "completed" && order.status !== "delivered") return;
        setReviewOrder(order);
        setReviewRating("5");
        setReviewCommunication("5");
        setReviewQuality("5");
        setReviewSpeed("5");
        setReviewHover(0);
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
        const c = Math.round(Number(reviewCommunication));
        const q = Math.round(Number(reviewQuality));
        const s = Math.round(Number(reviewSpeed));
        if (![c, q, s].every((v) => Number.isFinite(v) && v >= 1 && v <= 5)) {
            window.alert("Alt puanlar 1-5 arasinda olmalidir.");
            return;
        }
        await insertReview(o, rating, reviewComment, c, q, s);
    };

    const handleRequestRevision = async (order: Order, reasonInput: string) => {
        if (!user) return;
        if (busyId) return;
        if (user.role !== "employer") return;
        if (order.status !== "delivered") return;

        const reason = String(reasonInput || "");
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

            await safeTransitionOrderStatus(Number(order.id), "active");

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

            await safeTransitionOrderStatus(Number(order.id), "completed");

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

    const openDeliveryModal = (order: Order) => {
        setDeliveryOrder(order);
        setDeliveryMessage("");
        setDeliveryOpen(true);
    };

    const submitDeliveryModal = async () => {
        if (!deliveryOrder) return;
        const order = deliveryOrder;
        setDeliveryOpen(false);
        setDeliveryOrder(null);
        await handleSendDelivery(order, deliveryMessage);
    };

    const openCancelModal = (order: Order) => {
        setCancelOrder(order);
        setCancelReason("");
        setCancelRatio("50");
        setCancelOpen(true);
    };

    const submitCancelModal = async () => {
        if (!cancelOrder) return;
        const reason = cancelReason.trim();
        const ratioNum = Number(cancelRatio);
        if (!reason) {
            window.alert("Lütfen iptal gerekçesini yazın.");
            return;
        }
        if (!Number.isFinite(ratioNum) || ratioNum < 0 || ratioNum > 100) {
            window.alert("Geçerli bir oran girin (0-100).");
            return;
        }
        const order = cancelOrder;
        setCancelOpen(false);
        setCancelOrder(null);
        await handleRequestCancellation(order, reason, String(ratioNum));
    };

    const openRevisionModal = (order: Order) => {
        setRevisionOrder(order);
        setRevisionReason("");
        setRevisionOpen(true);
    };

    const submitRevisionModal = async () => {
        if (!revisionOrder) return;
        const reason = revisionReason.trim();
        if (!reason) {
            window.alert("Lütfen revizyon gerekçesini yazın.");
            return;
        }
        const order = revisionOrder;
        setRevisionOpen(false);
        setRevisionOrder(null);
        await handleRequestRevision(order, reason);
    };

    const openAcceptModal = (order: Order) => {
        setAcceptOrder(order);
        setAcceptOpen(true);
    };

    const submitAcceptModal = async () => {
        if (!acceptOrder) return;
        const order = acceptOrder;
        setAcceptOpen(false);
        setAcceptOrder(null);
        await handleAcceptDelivery(order);
    };

    const openDisputeModal = (order: Order) => {
        setDisputeOrder(order);
        setDisputeReason("");
        setDisputeOpen(true);
    };

    const submitDisputeModal = async () => {
        if (!disputeOrder) return;
        const reason = disputeReason.trim();
        if (!reason) {
            window.alert("Lütfen anlaşmazlık gerekçesini yazın.");
            return;
        }
        const order = disputeOrder;
        setDisputeOpen(false);
        setDisputeOrder(null);
        await handleOpenDispute(order, reason);
    };

    const openScheduleModal = (order: Order) => {
        if (user?.role !== "freelancer") {
            window.alert("Teslim tarihi talebini sadece freelancer açabilir.");
            return;
        }
        setScheduleOrder(order);
        setScheduleDays("1");
        setScheduleReason("");
        setScheduleOpen(true);
    };

    const submitScheduleModal = async () => {
        if (!scheduleOrder) return;
        const dayNum = Number(scheduleDays);
        if (!Number.isFinite(dayNum) || dayNum <= 0) {
            window.alert("Lütfen geçerli bir gün sayısı girin.");
            return;
        }
        const order = scheduleOrder;
        setScheduleOpen(false);
        setScheduleOrder(null);
        await handleCreateScheduleRequest(order);
    };

    const openScheduleDecisionModal = (req: ScheduleRequestRow, decision: ScheduleDecision) => {
        setScheduleDecisionRequest(req);
        setScheduleDecisionType(decision);
        setScheduleDecisionOpen(true);
    };

    const submitScheduleDecisionModal = async () => {
        if (!scheduleDecisionRequest) return;
        const req = scheduleDecisionRequest;
        const decision = scheduleDecisionType;
        setScheduleDecisionOpen(false);
        setScheduleDecisionRequest(null);
        await handleRespondScheduleRequest(req, decision);
    };

    useEffect(() => {
        if (openedFromNotif) return;
        if (typeof window === "undefined") return;
        const reviewOrderId = String(new URLSearchParams(window.location.search).get("reviewOrder") || "").trim();
        if (!reviewOrderId) return;
        const target = orders.find((o) => String(o.id) === reviewOrderId);
        if (!target) return;
        setOpenedFromNotif(true);
        openReviewModal(target);
    }, [orders, openedFromNotif]);

    if (!user) return null;

    const pending = orders.filter(o => o.status === "pending").length;
    const active = orders.filter(o => o.status === "active").length;
    const delivered = orders.filter(o => o.status === "delivered").length;
    const completed = orders.filter(o => o.status === "completed").length;
    const pageTitle = user.role === "freelancer" ? "İşlerim" : "Siparişlerim";
    const pageDescription =
        user.role === "freelancer"
            ? "Aldığın işleri buradan takip edebilirsin."
            : "Tüm siparişlerini buradan takip edebilirsin.";

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
                                <div className="text-xs font-black uppercase tracking-widest text-slate-500">Puan</div>
                                <div className="flex items-center gap-2">
                                    {[1, 2, 3, 4, 5].map((v) => {
                                        const active = (reviewHover || Number(reviewRating)) >= v;
                                        return (
                                            <button
                                                key={v}
                                                type="button"
                                                onMouseEnter={() => setReviewHover(v)}
                                                onMouseLeave={() => setReviewHover(0)}
                                                onClick={() => setReviewRating(String(v))}
                                                className="rounded-lg p-1 transition-transform hover:scale-110"
                                                aria-label={`${v} yıldız`}
                                            >
                                                <Star className={`h-7 w-7 ${active ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                                            </button>
                                        );
                                    })}
                                    <span className="text-sm font-bold text-slate-600">{Number(reviewRating).toFixed(1)} / 5.0</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-xs font-black uppercase tracking-widest text-slate-500">Yorum (opsiyonel)</div>
                                <Textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} className="min-h-[110px]" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <div className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">İletişim</div>
                                    <Input value={reviewCommunication} onChange={(e) => setReviewCommunication(e.target.value.replace(/[^\d]/g, "").slice(0, 1) || "5")} />
                                </div>
                                <div>
                                    <div className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Kalite</div>
                                    <Input value={reviewQuality} onChange={(e) => setReviewQuality(e.target.value.replace(/[^\d]/g, "").slice(0, 1) || "5")} />
                                </div>
                                <div>
                                    <div className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Hız</div>
                                    <Input value={reviewSpeed} onChange={(e) => setReviewSpeed(e.target.value.replace(/[^\d]/g, "").slice(0, 1) || "5")} />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
                            <Button variant="outline" onClick={() => setReviewOpen(false)}>Vazgeç</Button>
                            <Button onClick={submitReviewModal} disabled={!!busyId} className="bg-slate-900 hover:bg-slate-800 text-white">
                                Kaydet
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            {deliveryOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-black text-slate-900">Siparişi Teslim Et</h3>
                            <Button variant="outline" size="sm" onClick={() => setDeliveryOpen(false)}>Kapat</Button>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className="text-xs text-gray-500">Teslim notu (opsiyonel)</div>
                            <Textarea
                                value={deliveryMessage}
                                onChange={(e) => setDeliveryMessage(e.target.value)}
                                className="min-h-[120px]"
                                placeholder="Yaptığınız işleri, teslim dosyalarını veya kısa notunuzu yazın."
                            />
                        </div>
                        <div className="p-5 border-t border-slate-100 flex flex-col sm:flex-row gap-2 sm:justify-end">
                            <Button variant="outline" onClick={() => setDeliveryOpen(false)}>Vazgeç</Button>
                            <Button onClick={submitDeliveryModal} disabled={!!busyId} className="bg-purple-600 hover:bg-purple-700 text-white">Teslim Et</Button>
                        </div>
                    </div>
                </div>
            )}
            {cancelOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-black text-slate-900">İade / İptal Talebi</h3>
                            <Button variant="outline" size="sm" onClick={() => setCancelOpen(false)}>Kapat</Button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="space-y-2">
                                <div className="text-xs text-gray-500">Gerekçe</div>
                                <Textarea
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                    className="min-h-[120px]"
                                    placeholder="İptal/iade talebinin nedenini yazın."
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="text-xs text-gray-500">Ödeme Payı (%)</div>
                                <Input
                                    value={cancelRatio}
                                    onChange={(e) => setCancelRatio(e.target.value.replace(/[^\d]/g, ""))}
                                    inputMode="numeric"
                                    placeholder="0 - 100"
                                />
                            </div>
                        </div>
                        <div className="p-5 border-t border-slate-100 flex flex-col sm:flex-row gap-2 sm:justify-end">
                            <Button variant="outline" onClick={() => setCancelOpen(false)}>Vazgeç</Button>
                            <Button onClick={submitCancelModal} disabled={!!busyId} className="bg-red-600 hover:bg-red-700 text-white">Talep Gönder</Button>
                        </div>
                    </div>
                </div>
            )}
            {revisionOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-black text-slate-900">Revizyon Gerekçesi</h3>
                            <Button variant="outline" size="sm" onClick={() => setRevisionOpen(false)}>Kapat</Button>
                        </div>
                        <div className="p-5 space-y-2">
                            <div className="text-xs text-gray-500">Freelancer'a gönderilecek not</div>
                            <Textarea
                                value={revisionReason}
                                onChange={(e) => setRevisionReason(e.target.value)}
                                className="min-h-[130px]"
                                placeholder="Nelerin düzenlenmesini istediğinizi net yazın."
                            />
                        </div>
                        <div className="p-5 border-t border-slate-100 flex flex-col sm:flex-row gap-2 sm:justify-end">
                            <Button variant="outline" onClick={() => setRevisionOpen(false)}>Vazgeç</Button>
                            <Button onClick={submitRevisionModal} disabled={!!busyId} className="bg-gray-800 hover:bg-gray-900 text-white">Revizyon İste</Button>
                        </div>
                    </div>
                </div>
            )}
            {acceptOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100">
                        <div className="p-5 border-b border-slate-100">
                            <h3 className="font-black text-slate-900">Teslim Onayı</h3>
                            <p className="text-sm text-gray-500 mt-1">Siparişi onaylayınca tamamlandı durumuna geçer.</p>
                        </div>
                        <div className="p-5 flex flex-col sm:flex-row gap-2 sm:justify-end">
                            <Button variant="outline" onClick={() => setAcceptOpen(false)}>Vazgeç</Button>
                            <Button onClick={submitAcceptModal} disabled={!!busyId} className="bg-green-600 hover:bg-green-700 text-white">Onayla</Button>
                        </div>
                    </div>
                </div>
            )}
            {disputeOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-black text-slate-900">Anlaşmazlık Bildirimi</h3>
                            <Button variant="outline" size="sm" onClick={() => setDisputeOpen(false)}>Kapat</Button>
                        </div>
                        <div className="p-5 space-y-2">
                            <div className="text-xs text-gray-500">Gerekçe</div>
                            <Textarea
                                value={disputeReason}
                                onChange={(e) => setDisputeReason(e.target.value)}
                                className="min-h-[140px]"
                                placeholder="Anlaşmazlık nedenini net ve kısa şekilde yazın."
                            />
                        </div>
                        <div className="p-5 border-t border-slate-100 flex flex-col sm:flex-row gap-2 sm:justify-end">
                            <Button variant="outline" onClick={() => setDisputeOpen(false)}>Vazgeç</Button>
                            <Button onClick={submitDisputeModal} disabled={!!busyId} className="bg-rose-600 hover:bg-rose-700 text-white">Gönder</Button>
                        </div>
                    </div>
                </div>
            )}
            {scheduleOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-black text-slate-900">Teslim Tarihi Talebi</h3>
                            <Button variant="outline" size="sm" onClick={() => setScheduleOpen(false)}>Kapat</Button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="space-y-2">
                                <div className="text-xs text-gray-500">Ek gün sayısı</div>
                                <Input
                                    value={scheduleDays}
                                    onChange={(e) => setScheduleDays(e.target.value.replace(/[^\d]/g, ""))}
                                    inputMode="numeric"
                                    placeholder="Örn: 2"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="text-xs text-gray-500">Açıklama (opsiyonel)</div>
                                <Textarea
                                    value={scheduleReason}
                                    onChange={(e) => setScheduleReason(e.target.value)}
                                    className="min-h-[120px]"
                                    placeholder="Neden ek süreye ihtiyaç duyduğunuzu yazın."
                                />
                            </div>
                        </div>
                        <div className="p-5 border-t border-slate-100 flex flex-col sm:flex-row gap-2 sm:justify-end">
                            <Button variant="outline" onClick={() => setScheduleOpen(false)}>Vazgeç</Button>
                            <Button onClick={submitScheduleModal} disabled={!!busyId} className="bg-sky-600 hover:bg-sky-700 text-white">İş Veren Onayına Gönder</Button>
                        </div>
                    </div>
                </div>
            )}
            {scheduleDecisionOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100">
                        <div className="p-5 border-b border-slate-100">
                            <h3 className="font-black text-slate-900">Teslim Tarihi Talebi</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                {scheduleDecisionType === "accepted" ? "Bu talebi onaylarsanız teslim günü otomatik güncellenir." : "Bu talebi reddetmek istediğinize emin misiniz?"}
                            </p>
                        </div>
                        <div className="p-5 flex flex-col sm:flex-row gap-2 sm:justify-end">
                            <Button variant="outline" onClick={() => setScheduleDecisionOpen(false)}>Vazgeç</Button>
                            <Button
                                onClick={submitScheduleDecisionModal}
                                disabled={!!busyId}
                                className={scheduleDecisionType === "accepted" ? "bg-sky-600 hover:bg-sky-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
                            >
                                {scheduleDecisionType === "accepted" ? "Onayla" : "Reddet"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            <div className="mb-8 text-center sm:text-left">
                <h1 className="text-3xl font-bold font-heading">📋 {pageTitle}</h1>
                <p className="text-gray-500 mt-1">{pageDescription}</p>
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
                        const isMineFreelancer =
                            user.role === "freelancer" &&
                            (String(order.sellerId || "") === String(user.id || "") || norm(user.username) === norm(order.freelancer));
                        const isMineEmployer =
                            user.role === "employer" &&
                            (String(order.buyerId || "") === String(user.id || "") || norm(user.username) === norm(order.client));
                        const latestCancelReq = cancelRequests.find((r) => Number(r.order_id) === Number(order.id));
                        const cancelPending = !!latestCancelReq && String(latestCancelReq.status) === "pending";
                        const canRespondCancel =
                            !!latestCancelReq &&
                            String(latestCancelReq.status) === "pending" &&
                            String(latestCancelReq.responder_id || "") === String(user.id || "");
                        const busy = busyId === order.id;
                        const paymentStatus = String(order.paymentStatus || "unpaid").toLowerCase();
                        const paymentPending = order.status === "pending" && paymentStatus !== "paid";

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
                                            {paymentPending ? <span className="text-amber-700 font-semibold">💳 Ödeme bekleniyor</span> : null}
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
                                            {(order.status === "active" || order.status === "pending" || order.status === "delivered") && (
                                                <Button
                                                    size="sm"
                                                    disabled={busy || cancelPending}
                                                    onClick={() => openCancelModal(order)}
                                                    className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                                                >
                                                    İptal Talebi
                                                </Button>
                                            )}
                                            {order.status === "pending" && isMineEmployer && paymentPending && (
                                                <Button
                                                    size="sm"
                                                    disabled={busy}
                                                    onClick={() => router.push(`/orders/pay/${encodeURIComponent(String(order.id))}`)}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                >
                                                    💳 Ödemeyi Tamamla
                                                </Button>
                                            )}
                                            {order.status === "active" && isMineFreelancer && (
                                                <Button
                                                    size="sm"
                                                    disabled={busy}
                                                    onClick={() => openDeliveryModal(order)}
                                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                                >
                                                    📦 Siparişi Teslim Et
                                                </Button>
                                            )}
                                            {order.status === "delivered" && (
                                                <>
                                                    {isMineEmployer && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                disabled={busy}
                                                                onClick={() => openRevisionModal(order)}
                                                                className="bg-gray-200 hover:bg-gray-300 text-gray-900"
                                                            >
                                                                🔁 Revizyon
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                disabled={busy}
                                                                onClick={() => openAcceptModal(order)}
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
                                            {(order.status === "active" || order.status === "delivered") && (
                                                <Button
                                                    size="sm"
                                                    disabled={busy}
                                                    onClick={() => openDisputeModal(order)}
                                                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                                                >
                                                    Anlaşmazlık
                                                </Button>
                                            )}
                                            {(order.status === "active" || order.status === "delivered") && (
                                                <Button
                                                    size="sm"
                                                    disabled={busy}
                                                    onClick={() => openScheduleModal(order)}
                                                    className="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200"
                                                >
                                                    Tarih Talebi
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {isMineFreelancer && revisionNotesByOrder[String(order.id)] && (
                                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-amber-700">Revizyon Notu</div>
                                        <div className="mt-1 text-sm font-medium text-amber-900 whitespace-pre-wrap break-words">
                                            {revisionNotesByOrder[String(order.id)]}
                                        </div>
                                    </div>
                                )}
                                {latestCancelReq && (
                                    <div className="mt-4 rounded-xl border border-red-100 bg-red-50/50 p-4">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-red-600">
                                            İptal Talebi - {cancellationStatusLabel(latestCancelReq.status)}
                                        </div>
                                        <div className="mt-2 text-xs text-gray-700">
                                            Talep: <strong>{latestCancelReq.requester_username}</strong> - Pay orani:{" "}
                                            <strong>%{Math.round(Number(latestCancelReq.compensation_rate || 0) * 100)}</strong>
                                        </div>
                                        {latestCancelReq.reason && (
                                            <div className="mt-1 text-xs text-gray-600">{latestCancelReq.reason}</div>
                                        )}
                                        {canRespondCancel && (
                                            <div className="mt-3 flex gap-2 justify-end">
                                                <Button
                                                    size="sm"
                                                    disabled={busyId === `cancel-${String(latestCancelReq.id)}`}
                                                    onClick={() => handleRespondCancellation(latestCancelReq, "rejected")}
                                                    className="bg-gray-200 hover:bg-gray-300 text-gray-900"
                                                >
                                                    Reddet
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    disabled={busyId === `cancel-${String(latestCancelReq.id)}`}
                                                    onClick={() => handleRespondCancellation(latestCancelReq, "accepted")}
                                                    className="bg-red-600 hover:bg-red-700 text-white"
                                                >
                                                    İptali Onayla
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sipariş Çalışma Alanı</div>
                                    <div className="mt-3 flex gap-2">
                                        <Input
                                            value={workspaceInputByOrder[String(order.id)] || ""}
                                            onChange={(e) => setWorkspaceInputByOrder((prev) => ({ ...prev, [String(order.id)]: e.target.value }))}
                                            placeholder="Yapılacak veya not ekle..."
                                        />
                                        <Button
                                            size="sm"
                                            disabled={busyId === `ws-${String(order.id)}`}
                                            onClick={() => handleAddWorkspaceItem(order)}
                                            className="bg-slate-900 hover:bg-slate-800 text-white"
                                        >
                                            Ekle
                                        </Button>
                                    </div>
                                    <div className="mt-3 space-y-2">
                                        {(workspaceByOrder[String(order.id)] || []).slice(0, 5).map((item) => (
                                            <div key={String(item.id)} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                                                <div className={`text-sm ${item.is_done ? "line-through text-slate-400" : "text-slate-700"}`}>{item.content}</div>
                                                <Button variant="outline" size="sm" onClick={() => handleToggleWorkspaceDone(item)}>
                                                    {item.is_done ? "Geri Al" : "Tamamla"}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {scheduleRequests.filter((r) => Number(r.order_id) === Number(order.id)).slice(0, 1).map((sr) => (
                                    <div key={String(sr.id)} className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-sky-700">
                                            Tarih Talebi - {scheduleStatusLabel(sr.status)}
                                        </div>
                                        <div className="text-sm text-sky-900 mt-1">Ek süre: {sr.requested_days} gün</div>
                                        {sr.reason ? <div className="text-xs text-sky-800 mt-1">{sr.reason}</div> : null}
                                        {String(sr.status) === "pending" && String(sr.responder_id) === String(user.id) ? (
                                            <div className="mt-2 flex gap-2 justify-end">
                                                <Button size="sm" variant="outline" onClick={() => openScheduleDecisionModal(sr, "rejected")}>Reddet</Button>
                                                <Button size="sm" className="bg-sky-600 hover:bg-sky-700 text-white" onClick={() => openScheduleDecisionModal(sr, "accepted")}>Onayla</Button>
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

