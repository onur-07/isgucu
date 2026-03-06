import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { restoreArchivedUser } from "@/lib/admin-user-archive";

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

export async function GET(req: Request) {
    try {
        const v = await verifyAdmin(req);
        if ("error" in v) return v.error;

        const { data, error } = await v.supabaseAdmin
            .from("deleted_users")
            .select("id, original_user_id, username, email, role, delete_reason, source, deleted_at, restore_status, restored_at, restored_user_id")
            .order("deleted_at", { ascending: false })
            .limit(500);

        if (error) {
            return NextResponse.json({ error: "deleted_users_fetch_failed", details: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, deletedUsers: data || [] });
    } catch (e: any) {
        return NextResponse.json({ error: "server_error", details: e?.message || String(e) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const v = await verifyAdmin(req);
        if ("error" in v) return v.error;

        const body = await req.json().catch(() => ({}));
        const archiveId = Number(body?.archiveId);
        if (!Number.isFinite(archiveId) || archiveId <= 0) {
            return NextResponse.json({ error: "invalid_archive_id" }, { status: 400 });
        }

        const restored = await restoreArchivedUser(v.supabaseAdmin, archiveId, v.callerId);
        if (!restored.ok) {
            return NextResponse.json({ error: restored.error, details: (restored as any).details || "" }, { status: 400 });
        }

        return NextResponse.json({
            ok: true,
            userId: restored.userId,
            email: restored.email,
            username: restored.username,
            tempPassword: restored.tempPassword,
        });
    } catch (e: any) {
        return NextResponse.json({ error: "server_error", details: e?.message || String(e) }, { status: 500 });
    }
}

