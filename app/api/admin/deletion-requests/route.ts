import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { archiveUserAndDelete } from "@/lib/admin-user-archive";

async function verifyAdmin(req: Request) {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return { error: NextResponse.json({ error: "missing_service_role" }, { status: 500 }) };

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return { error: NextResponse.json({ error: "missing_token" }, { status: 401 }) };

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    if (!url || !anon) return { error: NextResponse.json({ error: "missing_supabase_public_env" }, { status: 500 }) };

    const supabase = createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData?.user) return { error: NextResponse.json({ error: "invalid_token" }, { status: 401 }) };

    const { data: callerProfile, error: callerErr } = await supabaseAdmin
        .from("profiles")
        .select("id, role")
        .eq("id", authData.user.id)
        .maybeSingle();
    if (callerErr) return { error: NextResponse.json({ error: "caller_profile_error", details: callerErr.message }, { status: 500 }) };
    if (!callerProfile || callerProfile.role !== "admin") return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };

    return { supabaseAdmin, callerId: String(callerProfile.id) };
}

export async function POST(req: Request) {
    try {
        const v = await verifyAdmin(req);
        if ("error" in v) return v.error;

        const body = await req.json().catch(() => ({}));
        const requestId = Number(body?.requestId);
        const action = String(body?.action || "").toLowerCase();

        if (!Number.isFinite(requestId) || requestId <= 0) {
            return NextResponse.json({ error: "invalid_request_id" }, { status: 400 });
        }
        if (action !== "approve" && action !== "reject") {
            return NextResponse.json({ error: "invalid_action" }, { status: 400 });
        }

        const { data: reqRow, error: reqErr } = await v.supabaseAdmin
            .from("account_deletion_requests")
            .select("id, user_id, username, email, reason, status")
            .eq("id", requestId)
            .maybeSingle();

        if (reqErr) return NextResponse.json({ error: "request_fetch_failed", details: reqErr.message }, { status: 500 });
        if (!reqRow) return NextResponse.json({ error: "request_not_found" }, { status: 404 });

        if (action === "reject") {
            const { error: rejectErr } = await v.supabaseAdmin
                .from("account_deletion_requests")
                .update({ status: "rejected" })
                .eq("id", requestId);
            if (rejectErr) return NextResponse.json({ error: "request_reject_failed", details: rejectErr.message }, { status: 500 });
            return NextResponse.json({ ok: true, status: "rejected" });
        }

        const archived = await archiveUserAndDelete({
            supabaseAdmin: v.supabaseAdmin,
            targetUserId: String(reqRow.user_id),
            deletedByAdminId: v.callerId,
            source: "deletion_request",
            deleteReason: String(reqRow.reason || "Kullanici hesap silme talebi"),
        });
        if (!archived.ok) {
            return NextResponse.json({ error: archived.error, details: (archived as any).details || "" }, { status: 400 });
        }

        const { error: approveErr } = await v.supabaseAdmin
            .from("account_deletion_requests")
            .update({ status: "approved" })
            .eq("id", requestId);
        if (approveErr) {
            return NextResponse.json({ error: "request_approve_failed", details: approveErr.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, status: "approved" });
    } catch (e: any) {
        return NextResponse.json({ error: "server_error", details: e?.message || String(e) }, { status: 500 });
    }
}

