export type OrderStatus = "pending" | "active" | "delivered" | "completed" | "cancelled";

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["active", "cancelled"],
  active: ["delivered", "cancelled"],
  delivered: ["active", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransitionOrderStatus(fromStatus: string, toStatus: string): boolean {
  const from = String(fromStatus || "").toLowerCase() as OrderStatus;
  const to = String(toStatus || "").toLowerCase() as OrderStatus;
  if (!TRANSITIONS[from]) return false;
  return TRANSITIONS[from].includes(to);
}

export function transitionGuardMessage(fromStatus: string, toStatus: string): string {
  return `Gecersiz siparis durum gecisi: ${String(fromStatus || "-")} -> ${String(toStatus || "-")}`;
}
