import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: "missing_service_role" }, { status: 500 });

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return NextResponse.json({ error: "missing_token" }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    if (!url || !anon) return NextResponse.json({ error: "missing_supabase_public_env" }, { status: 500 });

    const supabase = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData?.user) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (!callerProfile || callerProfile.role !== "admin") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as any;
    const action = String(body?.action || "").trim();

    if (action === "deactivate_user_gigs") {
      const targetUserId = String(body?.targetUserId || "");
      if (!isUuid(targetUserId)) return NextResponse.json({ error: "invalid_target_user_id" }, { status: 400 });

      const { error } = await supabaseAdmin
        .from("gigs")
        .update({ is_active: false })
        .eq("user_id", targetUserId)
        .eq("is_active", true);

      if (error) return NextResponse.json({ error: "deactivate_gigs_failed", details: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === "set_user_ban") {
      const targetUserId = String(body?.targetUserId || "");
      const banned = !!body?.banned;
      if (!isUuid(targetUserId)) return NextResponse.json({ error: "invalid_target_user_id" }, { status: 400 });

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ is_banned: banned })
        .eq("id", targetUserId);

      if (error) return NextResponse.json({ error: "ban_update_failed", details: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === "set_gig_active") {
      const gigId = Number(body?.gigId);
      const active = !!body?.active;
      if (!Number.isFinite(gigId) || gigId <= 0) return NextResponse.json({ error: "invalid_gig_id" }, { status: 400 });

      const { error } = await supabaseAdmin
        .from("gigs")
        .update({ is_active: active })
        .eq("id", gigId);

      if (error) return NextResponse.json({ error: "gig_update_failed", details: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === "delete_gig") {
      const gigId = Number(body?.gigId);
      if (!Number.isFinite(gigId) || gigId <= 0) return NextResponse.json({ error: "invalid_gig_id" }, { status: 400 });

      const { error } = await supabaseAdmin
        .from("gigs")
        .delete()
        .eq("id", gigId);

      if (error) return NextResponse.json({ error: "gig_delete_failed", details: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === "delete_user_gigs") {
      const targetUserId = String(body?.targetUserId || "");
      if (!isUuid(targetUserId)) return NextResponse.json({ error: "invalid_target_user_id" }, { status: 400 });

      const { error } = await supabaseAdmin
        .from("gigs")
        .delete()
        .eq("user_id", targetUserId);

      if (error) return NextResponse.json({ error: "gigs_delete_failed", details: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === "delete_job") {
      const jobId = Number(body?.jobId);
      if (!Number.isFinite(jobId) || jobId <= 0) return NextResponse.json({ error: "invalid_job_id" }, { status: 400 });

      const { error } = await supabaseAdmin
        .from("jobs")
        .delete()
        .eq("id", jobId);

      if (error) return NextResponse.json({ error: "job_delete_failed", details: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === "delete_user_jobs") {
      const targetUserId = String(body?.targetUserId || "");
      if (!isUuid(targetUserId)) return NextResponse.json({ error: "invalid_target_user_id" }, { status: 400 });

      const { error } = await supabaseAdmin
        .from("jobs")
        .delete()
        .eq("user_id", targetUserId);

      if (error) return NextResponse.json({ error: "jobs_delete_failed", details: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: "server_error", details: e?.message || String(e) }, { status: 500 });
  }
}
