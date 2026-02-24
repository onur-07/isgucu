import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "missing_service_role" }, { status: 500 });
    }
    const params = await ctx.params;
    const targetUserId = String(params?.id ?? "").trim();

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(targetUserId)) {
      return NextResponse.json({ error: "invalid_user_id" }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return NextResponse.json({ error: "missing_token" }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabase = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData?.user) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

    const { data: callerProfile } = await supabaseAdmin.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
    if (!callerProfile || callerProfile.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

    // Fetch all data in parallel
    const [profileRes, ordersAsBuyerRes, ordersAsSellerRes, gigsRes, jobsRes, ticketsRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", targetUserId).maybeSingle(),
      supabaseAdmin.from("orders").select("*").eq("buyer_id", targetUserId).order("created_at", { ascending: false }),
      supabaseAdmin.from("orders").select("*").eq("seller_id", targetUserId).order("created_at", { ascending: false }),
      supabaseAdmin.from("gigs").select("*").eq("user_id", targetUserId).order("created_at", { ascending: false }),
      supabaseAdmin.from("jobs").select("*").eq("user_id", targetUserId).order("created_at", { ascending: false }),
      supabaseAdmin.from("support_tickets").select("*").eq("from_email", "").order("created_at", { ascending: false }), // placeholder, will filter by username
    ]);

    const profile = profileRes.data;
    if (!profile) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

    // Fetch tickets by username
    const { data: userTickets } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .or(`from_user.eq.${profile.username},from_email.eq.${profile.email}`)
      .order("created_at", { ascending: false });

    // Get auth user info
    const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(targetUserId);

    const allOrders = [...(ordersAsBuyerRes.data || []), ...(ordersAsSellerRes.data || [])];

    return NextResponse.json({
      ok: true,
      user: {
        id: profile.id,
        username: profile.username,
        email: authUserData?.user?.email || profile.email,
        fullName: profile.full_name || "",
        role: profile.role,
        bio: profile.bio || "",
        skills: profile.skills || [],
        location: profile.location || "",
        hourlyRate: profile.hourly_rate || "",
        phone: profile.phone || "",
        website: profile.website || "",
        iban: profile.iban || "",
        avatarUrl: profile.avatar_url || "",
        isBanned: !!profile.is_banned,
        createdAt: profile.created_at,
      },
      orders: allOrders,
      gigs: gigsRes.data || [],
      jobs: jobsRes.data || [],
      tickets: userTickets || [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: "server_error", details: e?.message || String(e) }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "missing_service_role" }, { status: 500 });
    }
    const params = await ctx.params;
    const targetUserId = String(params?.id ?? "").trim();

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(targetUserId)) {
      return NextResponse.json(
        { error: "invalid_user_id", details: "Expected UUID user id", received: targetUserId },
        { status: 400 }
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return NextResponse.json({ error: "missing_token" }, { status: 401 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "missing_service_role" }, { status: 500 });
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

    const body = await req.json().catch(() => ({}));
    const password = typeof body?.password === "string" ? body.password : "";
    const email = typeof body?.email === "string" ? body.email : "";
    const username = typeof body?.username === "string" ? body.username.trim() : "";

    if (!password && !email && !username) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    if (password) {
      const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        password,
      });
      if (pwErr) {
        return NextResponse.json(
          { error: "password_update_failed", details: pwErr.message },
          { status: 400 }
        );
      }
    }

    if (email) {
      const { error: emailErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        email,
      });
      if (emailErr) {
        return NextResponse.json(
          { error: "email_update_failed", details: emailErr.message },
          { status: 400 }
        );
      }

      await supabaseAdmin.from("profiles").update({ email }).eq("id", targetUserId);
    }

    if (username) {
      await supabaseAdmin.from("profiles").update({ username }).eq("id", targetUserId);
      await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        user_metadata: { username },
      });
    }

    const { data: updatedAuthUser, error: getUserErr } =
      await supabaseAdmin.auth.admin.getUserById(targetUserId);

    if (getUserErr) {
      return NextResponse.json({ ok: true, userId: targetUserId });
    }

    const authEmail = updatedAuthUser?.user?.email || "";
    if (authEmail) {
      await supabaseAdmin
        .from("profiles")
        .update({ email: authEmail })
        .eq("id", targetUserId);
    }

    return NextResponse.json({
      ok: true,
      userId: updatedAuthUser?.user?.id,
      email: authEmail,
    });
  } catch (e: any) {
    return NextResponse.json({ error: "server_error", details: e?.message || String(e) }, { status: 500 });
  }
}
