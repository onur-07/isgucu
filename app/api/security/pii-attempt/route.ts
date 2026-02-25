import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error: "missing_service_role",
          details: "SUPABASE_SERVICE_ROLE_KEY ortam değişkeni eksik. Vercel Project Settings -> Environment Variables bölümüne ekleyin.",
        },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      return NextResponse.json({ error: "missing_token" }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    if (!url || !anon) {
      return NextResponse.json({ error: "missing_supabase_public_env" }, { status: 500 });
    }

    const supabase = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as any;
    const kind = body?.kind ? String(body.kind).trim().toLowerCase() : "pii";
    const other = body?.other ? String(body.other).trim() : "";
    const path = body?.path ? String(body.path).trim() : "";

    const callerId = authData.user.id;
    const callerEmail = String(authData.user.email || "");

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("username")
      .eq("id", callerId)
      .maybeSingle();

    const callerUsername = String(callerProfile?.username || "(unknown)");

    // Rate limit: 1 ticket per 10 minutes per user
    const { data: lastTicket } = await supabaseAdmin
      .from("support_tickets")
      .select("id, created_at")
      .eq("from_user", callerUsername)
      .eq("category", "security")
      .eq("subject", "PII Attempt")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastTicket?.created_at) {
      const lastAt = new Date(String(lastTicket.created_at)).getTime();
      if (Number.isFinite(lastAt) && Date.now() - lastAt < 10 * 60 * 1000) {
        return NextResponse.json({ ok: true, throttled: true });
      }
    }

    const msg = [
      `PII denemesi engellendi: ${kind}`,
      `Kullanıcı: ${callerUsername} (${callerEmail || "no-email"})`,
      other ? `Hedef: ${other}` : "",
      path ? `Sayfa: ${path}` : "",
      `Zaman: ${new Date().toISOString()}`,
    ]
      .filter(Boolean)
      .join("\n");

    const ins = await supabaseAdmin
      .from("support_tickets")
      .insert([
        {
          from_user: callerUsername,
          from_email: callerEmail,
          subject: "PII Attempt",
          category: "security",
          message: msg,
          status: "open",
        },
      ])
      .select("id")
      .maybeSingle();

    if (ins?.error) {
      return NextResponse.json({ error: "insert_failed", details: ins.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: ins?.data?.id || null });
  } catch (err: any) {
    return NextResponse.json(
      { error: "unexpected", details: err?.message ? String(err.message) : String(err) },
      { status: 500 }
    );
  }
}
