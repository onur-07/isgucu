import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE_CONFIG_SUBJECT = "SITE_CONFIG_V1";
const SITE_CONFIG_CATEGORY = "site_config";

type SiteConfigPayload = Record<string, unknown>;

function getBearerToken(req: Request) {
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) return "";
    return authHeader.slice(7).trim();
}

export async function GET() {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        if (!supabaseAdmin) {
            return NextResponse.json({ error: "missing_service_role" }, { status: 500 });
        }

        const { data, error } = await supabaseAdmin
            .from("support_tickets")
            .select("id, message, created_at")
            .eq("subject", SITE_CONFIG_SUBJECT)
            .eq("category", SITE_CONFIG_CATEGORY)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            return NextResponse.json({ error: "site_config_read_failed", details: error.message }, { status: 500 });
        }

        if (!data?.message) {
            return NextResponse.json({ config: null }, { status: 200 });
        }

        const parsed = JSON.parse(String(data.message)) as SiteConfigPayload;
        return NextResponse.json({ config: parsed }, { status: 200 });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: "server_error", details: e instanceof Error ? e.message : String(e) },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        if (!supabaseAdmin) {
            return NextResponse.json({ error: "missing_service_role" }, { status: 500 });
        }

        const token = getBearerToken(req);
        if (!token) return NextResponse.json({ error: "missing_token" }, { status: 401 });

        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
        if (!url || !anon) {
            return NextResponse.json({ error: "missing_supabase_public_env" }, { status: 500 });
        }

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

        const body = (await req.json().catch(() => null)) as { config?: SiteConfigPayload } | null;
        if (!body?.config || typeof body.config !== "object") {
            return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
        }

        const { error: insertError } = await supabaseAdmin.from("support_tickets").insert({
            from_user: "system",
            from_email: "system@isgucu.local",
            subject: SITE_CONFIG_SUBJECT,
            category: SITE_CONFIG_CATEGORY,
            message: JSON.stringify(body.config),
            status: "closed",
        });

        if (insertError) {
            return NextResponse.json({ error: "site_config_write_failed", details: insertError.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: "server_error", details: e instanceof Error ? e.message : String(e) },
            { status: 500 }
        );
    }
}
