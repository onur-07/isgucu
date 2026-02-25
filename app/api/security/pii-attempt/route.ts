import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function warningTextForRole(role: string) {
  if (role === "freelancer") {
    return "Uyaridir: Lutfen IBAN, telefon ve mail bilgisi vermeyiniz. Devam edilmesi durumunda ilanlariniz pasif hale getirilecektir.";
  }
  if (role === "employer") {
    return "Uyaridir: Lutfen IBAN, telefon ve mail bilgisi vermeyiniz. Devam edilmesi durumunda hesabiniz engellenecektir.";
  }
  return "Uyaridir: Lutfen IBAN, telefon ve mail bilgisi vermeyiniz. Devam edilmesi durumunda hesabiniza yaptirim uygulanacaktir.";
}

function kindLabel(kind: string) {
  if (kind === "phone") return "Telefon numarasi";
  if (kind === "iban") return "IBAN";
  if (kind === "email") return "E-posta / iletisim bilgisi";
  return "Kisisel bilgi";
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error: "missing_service_role",
          details:
            "SUPABASE_SERVICE_ROLE_KEY ortam degiskeni eksik. Vercel Project Settings -> Environment Variables bolumune ekleyin.",
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
      .select("username, role")
      .eq("id", callerId)
      .maybeSingle();

    const callerUsername = String(callerProfile?.username || "(unknown)");
    const callerRole = String(callerProfile?.role || "guest");

    const otherKey = other.toLowerCase();
    const { data: otherProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, username, role, email")
      .ilike("username", otherKey)
      .maybeSingle();

    const otherId = String(otherProfile?.id || "");
    const otherUsername = String(otherProfile?.username || other || "");
    const otherRole = String(otherProfile?.role || "guest");
    const otherEmail = String(otherProfile?.email || "");

    const systemMessages: Array<{
      sender_username: string;
      receiver_username: string;
      text: string;
      read: boolean;
    }> = [];

    if (callerUsername && callerUsername !== "(unknown)") {
      systemMessages.push({
        sender_username: "sistem",
        receiver_username: callerUsername.toLowerCase(),
        text: warningTextForRole(callerRole),
        read: false,
      });
    }

    if (otherUsername) {
      systemMessages.push({
        sender_username: "sistem",
        receiver_username: otherUsername.toLowerCase(),
        text: warningTextForRole(otherRole),
        read: false,
      });
    }

    if (systemMessages.length > 0) {
      await supabaseAdmin.from("messages").insert(systemMessages);
    }

    const pair = [callerUsername.toLowerCase(), otherKey].sort().join("|");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count: repeatCount } = await supabaseAdmin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("category", "security")
      .eq("from_user", callerUsername)
      .gte("created_at", since)
      .ilike("message", `%PAIR:${pair}%`);

    const isRepeat = Number(repeatCount || 0) > 0;

    const msg = [
      "YASAKLI ILETISIM BILGISI PAYLASIM DENEMESI ENGELLENDI",
      `Ihlal turu: ${kindLabel(kind)}`,
      `Ihlali yapan kullanici: ${callerUsername} (${callerEmail || "email yok"})`,
      otherUsername ? `Karsi taraf: ${otherUsername} (${otherEmail || "email yok"})` : "",
      `Kaynak sayfa: ${path || "-"}`,
      `Son 24 saatte tekrar deneme: ${isRepeat ? "Evet" : "Hayir"}`,
      "",
      "Teknik detaylar (admin):",
      `CALLER_ID:${callerId}`,
      `CALLER_USERNAME:${callerUsername}`,
      `CALLER_ROLE:${callerRole}`,
      otherId ? `OTHER_ID:${otherId}` : "",
      otherUsername ? `OTHER_USERNAME:${otherUsername}` : "",
      `OTHER_ROLE:${otherRole}`,
      `PAIR:${pair}`,
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
          subject: isRepeat ? "Yasakli Bilgi - Tekrar Deneme" : "Yasakli Bilgi Denemesi",
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

    return NextResponse.json({ ok: true, id: ins?.data?.id || null, repeat: isRepeat });
  } catch (err: any) {
    return NextResponse.json(
      { error: "unexpected", details: err?.message ? String(err.message) : String(err) },
      { status: 500 }
    );
  }
}
