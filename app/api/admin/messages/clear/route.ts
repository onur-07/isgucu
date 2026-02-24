import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "missing_service_role" }, { status: 500 });
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

    const callerId = authData.user.id;
    const { data: callerProfile, error: callerProfileErr } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .maybeSingle();

    if (callerProfileErr) {
      return NextResponse.json(
        { error: "caller_profile_error", details: callerProfileErr.message },
        { status: 500 }
      );
    }

    if (!callerProfile || callerProfile.role !== "admin") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as any;
    const a = body?.a ? String(body.a).trim() : "";
    const b = body?.b ? String(body.b).trim() : "";

    if (!a || !b) {
      return NextResponse.json({ error: "missing_params" }, { status: 400 });
    }

    if (a.length > 64 || b.length > 64) {
      return NextResponse.json({ error: "invalid_params" }, { status: 400 });
    }

    const safe = /^[a-zA-Z0-9_.\-]+$/;
    if (!safe.test(a) || !safe.test(b)) {
      return NextResponse.json({ error: "invalid_params" }, { status: 400 });
    }

    const { error: delErr, count } = await supabaseAdmin
      .from("messages")
      .delete({ count: "exact" })
      .or(`and(sender_username.ilike.${a},receiver_username.ilike.${b}),and(sender_username.ilike.${b},receiver_username.ilike.${a})`);

    if (delErr) {
      return NextResponse.json({ error: "delete_failed", details: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deleted: count || 0 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "unexpected", details: err?.message ? String(err.message) : String(err) },
      { status: 500 }
    );
  }
}
