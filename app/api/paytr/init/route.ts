import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildPaytrToken, getPaytrConfig, paytrIframeUrl } from "@/lib/paytr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return "";
  return authHeader.slice(7).trim();
}

function getUserIp(req: Request) {
  const xf = req.headers.get("x-forwarded-for") || "";
  const first = xf.split(",").map((x) => x.trim()).filter(Boolean)[0];
  if (first) return first;
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

export async function POST(req: Request) {
  try {
    const cfg = getPaytrConfig();
    if (!cfg) {
      return NextResponse.json({ error: "paytr_env_missing" }, { status: 500 });
    }

    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "missing_token" }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    if (!url || !anon) return NextResponse.json({ error: "missing_supabase_public_env" }, { status: 500 });

    const supabase = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData?.user) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as { orderId?: string | number } | null;
    const orderId = Number(body?.orderId);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "invalid_order_id" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "missing_service_role" }, { status: 500 });

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, buyer_id, seller_id, buyer_username, total_price, status, payment_status, payment_merchant_oid, gigs(title)")
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr) return NextResponse.json({ error: "order_read_failed", details: orderErr.message }, { status: 500 });
    if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
    if (String(order.buyer_id || "") !== String(authData.user.id || "")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const paymentStatus = String((order as any).payment_status || "unpaid").toLowerCase();
    if (paymentStatus === "paid") {
      return NextResponse.json({ ok: true, alreadyPaid: true, orderId, iframeUrl: null }, { status: 200 });
    }

    const amount = Number((order as any).total_price || 0);
    const paymentAmountMinor = Math.round(amount * 100);
    if (!Number.isFinite(paymentAmountMinor) || paymentAmountMinor <= 0) {
      return NextResponse.json({ error: "invalid_order_amount" }, { status: 400 });
    }

    const merchantOid =
      String((order as any).payment_merchant_oid || "").trim() ||
      `ISGUCU-${orderId}-${Date.now()}-${Math.floor(Math.random() * 9999)}`;

    const basket = [[String((order as any)?.gigs?.title || `Siparis #${orderId}`), String(amount.toFixed(2)), 1]];
    const userBasketBase64 = Buffer.from(JSON.stringify(basket)).toString("base64");
    const email = String(authData.user.email || "buyer@isgucu.com");
    const userIp = getUserIp(req);

    const paytrToken = buildPaytrToken({
      merchantId: cfg.merchantId,
      userIp,
      merchantOid,
      email,
      paymentAmountMinor,
      userBasketBase64,
      noInstallment: "0",
      maxInstallment: "0",
      currency: "TL",
      testMode: cfg.testMode,
      merchantSalt: cfg.merchantSalt,
      merchantKey: cfg.merchantKey,
    });

    const form = new URLSearchParams();
    form.set("merchant_id", cfg.merchantId);
    form.set("user_ip", userIp);
    form.set("merchant_oid", merchantOid);
    form.set("email", email);
    form.set("payment_amount", String(paymentAmountMinor));
    form.set("paytr_token", paytrToken);
    form.set("user_basket", userBasketBase64);
    form.set("debug_on", cfg.debugOn);
    form.set("no_installment", "0");
    form.set("max_installment", "0");
    form.set("user_name", String((order as any).buyer_username || "Musteri"));
    form.set("user_address", "Türkiye");
    form.set("user_phone", "0000000000");
    form.set("merchant_ok_url", cfg.okUrl);
    form.set("merchant_fail_url", cfg.failUrl);
    form.set("timeout_limit", cfg.timeoutLimit);
    form.set("currency", "TL");
    form.set("test_mode", cfg.testMode);
    form.set("lang", "tr");

    const paytrRes = await fetch("https://www.paytr.com/odeme/api/get-token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    });
    const paytrJson = (await paytrRes.json().catch(() => null)) as any;
    if (!paytrRes.ok || !paytrJson || String(paytrJson.status || "") !== "success") {
      const reason = String(paytrJson?.reason || paytrJson?.err_msg || paytrRes.statusText || "paytr_error");
      await admin
        .from("orders")
        .update({
          payment_provider: "paytr",
          payment_status: "failed",
          payment_last_error: reason,
          payment_merchant_oid: merchantOid,
          payment_amount_minor: paymentAmountMinor,
        })
        .eq("id", orderId);
      return NextResponse.json({ error: "paytr_init_failed", details: reason }, { status: 502 });
    }

    const tokenStr = String(paytrJson.token || "");
    await admin
      .from("orders")
      .update({
        payment_provider: "paytr",
        payment_status: "initiated",
        payment_merchant_oid: merchantOid,
        payment_amount_minor: paymentAmountMinor,
        payment_last_error: null,
      })
      .eq("id", orderId);

    return NextResponse.json({
      ok: true,
      orderId,
      merchantOid,
      token: tokenStr,
      iframeUrl: paytrIframeUrl(tokenStr),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: "server_error", details: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
