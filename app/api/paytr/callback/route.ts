import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getPaytrConfig, verifyPaytrCallbackHash } from "@/lib/paytr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function textResponse(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  try {
    const cfg = getPaytrConfig();
    const admin = getSupabaseAdmin();
    if (!cfg || !admin) return textResponse("FAIL", 500);

    const form = await req.formData();
    const merchantOid = String(form.get("merchant_oid") || "");
    const status = String(form.get("status") || "");
    const totalAmount = String(form.get("total_amount") || "");
    const receivedHash = String(form.get("hash") || "");
    const failedReason = String(form.get("failed_reason_msg") || form.get("failed_reason_code") || "");

    if (!merchantOid || !status || !receivedHash) return textResponse("FAIL", 400);

    const valid = verifyPaytrCallbackHash({
      merchantOid,
      status,
      totalAmount,
      receivedHash,
      merchantSalt: cfg.merchantSalt,
      merchantKey: cfg.merchantKey,
    });
    if (!valid) return textResponse("FAIL", 403);

    const { data: order } = await admin
      .from("orders")
      .select("id, status, payment_status")
      .eq("payment_merchant_oid", merchantOid)
      .limit(1)
      .maybeSingle();

    const orderId = Number((order as any)?.id || 0);
    if (Number.isFinite(orderId) && orderId > 0) {
      if (status === "success") {
        await admin
          .from("orders")
          .update({
            payment_status: "paid",
            payment_paid_at: new Date().toISOString(),
            payment_last_error: null,
            status: String((order as any)?.status || "").toLowerCase() === "pending" ? "active" : (order as any)?.status || "active",
          })
          .eq("id", orderId);
      } else {
        await admin
          .from("orders")
          .update({
            payment_status: "failed",
            payment_last_error: failedReason || "Odeme basarisiz",
          })
          .eq("id", orderId);
      }
    }

    await admin.from("paytr_events").insert({
      merchant_oid: merchantOid,
      order_id: Number.isFinite(orderId) && orderId > 0 ? orderId : null,
      status,
      total_amount: totalAmount || null,
      raw_payload: Object.fromEntries(form.entries()),
    });

    return textResponse("OK");
  } catch {
    return textResponse("FAIL", 500);
  }
}
