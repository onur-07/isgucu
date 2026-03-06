import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

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

    const profileClient = supabaseAdmin || supabase;
    const { data: callerProfile, error: callerProfileErr } = await profileClient
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

    const { data: profiles, error: profilesErr } = await profileClient
      .from("profiles")
      .select("id, username, email, role, created_at, is_banned")
      .order("created_at", { ascending: false });

    if (profilesErr) {
      return NextResponse.json(
        { error: "profiles_fetch_failed", details: profilesErr.message },
        { status: 500 }
      );
    }

    // Service role varsa auth user listesini birleştir, yoksa profiles verisi ile devam et.
    let authById: Record<string, any> = {};
    if (supabaseAdmin) {
      const { data: authUsersRes, error: authUsersErr } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (!authUsersErr) {
        authById = (authUsersRes?.users || []).reduce((acc: Record<string, any>, u: any) => {
          if (u?.id) acc[String(u.id)] = u;
          return acc;
        }, {});
      }
    }

    const merged = (profiles || []).map((p: any) => {
      const authU = authById[String(p.id)];
      const authEmail = authU?.email ? String(authU.email) : "";
      const metaUsername = authU?.user_metadata?.username ? String(authU.user_metadata.username).trim() : "";

      const profileUsername = String(p.username || "").trim();
      const looksGenerated = /^[a-z0-9._-]+_[a-f0-9]{6}$/i.test(profileUsername);

      // Eğer profildeki username bozuk görünüyorsa VE metadata'da gerçek username varsa → düzelt
      let finalUsername = profileUsername;
      if (supabaseAdmin && metaUsername && (looksGenerated || !profileUsername)) {
        finalUsername = metaUsername;
        // Arka planda veritabanını da düzelt (fire-and-forget)
        supabaseAdmin
          .from("profiles")
          .update({ username: metaUsername })
          .eq("id", p.id)
          .then(({ error }: any) => {
            if (error) console.error(`Admin API: Username düzeltme hatası (${p.id}):`, error.message);
            else console.log(`Admin API: Username düzeltildi: "${profileUsername}" → "${metaUsername}"`);
          });
      }

      const finalEmail = String(authEmail || p.email || "").trim();

      return {
        id: String(p.id),
        username: finalUsername || "(isimsiz)",
        email: finalEmail || "",
        role: p.role,
        createdAt: p.created_at,
        isBanned: !!p.is_banned,
      };
    });

    return NextResponse.json({ ok: true, users: merged, source: supabaseAdmin ? "auth+profiles" : "profiles_only" });
  } catch (err: any) {
    return NextResponse.json(
      { error: "unexpected", details: err?.message ? String(err.message) : String(err) },
      { status: 500 }
    );
  }
}
