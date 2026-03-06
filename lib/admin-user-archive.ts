import type { SupabaseClient } from "@supabase/supabase-js";

type ArchiveInput = {
    supabaseAdmin: SupabaseClient;
    targetUserId: string;
    deletedByAdminId: string;
    deleteReason?: string;
    source?: string;
};

const randomPassword = () => {
    const p = Math.random().toString(36).slice(2);
    const q = Math.random().toString(36).slice(2);
    return `Isgucu!${p}${q}A1`;
};

export async function archiveUserAndDelete(input: ArchiveInput) {
    const { supabaseAdmin, targetUserId, deletedByAdminId, deleteReason = "", source = "admin_manual" } = input;

    const [{ data: profile }, { data: authUserData, error: authGetErr }] = await Promise.all([
        supabaseAdmin.from("profiles").select("*").eq("id", targetUserId).maybeSingle(),
        supabaseAdmin.auth.admin.getUserById(targetUserId),
    ]);

    const authUser = authUserData?.user || null;
    if (!profile && !authUser) {
        return { ok: false as const, error: "user_not_found" };
    }

    const archivePayload = {
        original_user_id: targetUserId,
        username: String(profile?.username || authUser?.user_metadata?.username || ""),
        email: String(profile?.email || authUser?.email || ""),
        role: String(profile?.role || authUser?.user_metadata?.role || "employer"),
        full_name: String(profile?.full_name || ""),
        bio: String(profile?.bio || ""),
        skills: Array.isArray(profile?.skills) ? profile?.skills : [],
        location: String(profile?.location || ""),
        hourly_rate: String(profile?.hourly_rate || ""),
        phone: String(profile?.phone || ""),
        website: String(profile?.website || ""),
        iban: String(profile?.iban || ""),
        avatar_url: String(profile?.avatar_url || ""),
        created_at_profile: profile?.created_at || null,
        deleted_by_admin_id: deletedByAdminId,
        delete_reason: deleteReason,
        source,
        raw_profile: profile || null,
        raw_auth_user: authUser || null,
        restore_status: "deleted",
    };

    const { error: archiveErr } = await supabaseAdmin.from("deleted_users").insert(archivePayload);
    if (archiveErr) {
        return {
            ok: false as const,
            error: "archive_failed",
            details: archiveErr.message,
        };
    }

    const [profileDeleteRes, authDeleteRes] = await Promise.allSettled([
        supabaseAdmin.from("profiles").delete().eq("id", targetUserId),
        supabaseAdmin.auth.admin.deleteUser(targetUserId),
    ]);

    const profileErr = profileDeleteRes.status === "fulfilled" ? profileDeleteRes.value.error : profileDeleteRes.reason;
    const authErr = authDeleteRes.status === "fulfilled" ? authDeleteRes.value.error : authDeleteRes.reason;

    if (profileErr && authErr && !authGetErr) {
        return {
            ok: false as const,
            error: "delete_failed",
            details: `profile=${String((profileErr as any)?.message || profileErr)}; auth=${String((authErr as any)?.message || authErr)}`,
        };
    }

    return { ok: true as const };
}

export async function restoreArchivedUser(supabaseAdmin: SupabaseClient, archiveId: number, restoredByAdminId: string) {
    const { data: row, error: rowErr } = await supabaseAdmin
        .from("deleted_users")
        .select("*")
        .eq("id", archiveId)
        .maybeSingle();

    if (rowErr) return { ok: false as const, error: "archive_row_fetch_failed", details: rowErr.message };
    if (!row) return { ok: false as const, error: "archive_row_not_found" };
    if (String(row.restore_status || "") === "restored") return { ok: false as const, error: "already_restored" };

    const baseUsername = String(row.username || "kullanici").trim() || "kullanici";
    let nextUsername = baseUsername;
    for (let i = 0; i < 10; i++) {
        const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("username", nextUsername).maybeSingle();
        if (!existing) break;
        nextUsername = `${baseUsername}-${Date.now().toString().slice(-5)}-${i + 1}`;
    }

    const password = randomPassword();
    const email = String(row.email || "").trim();
    if (!email) return { ok: false as const, error: "missing_email" };

    const { data: createdAuth, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
            username: nextUsername,
            role: String(row.role || "employer"),
        },
    });
    if (createErr || !createdAuth?.user?.id) {
        return { ok: false as const, error: "auth_create_failed", details: createErr?.message || "unknown" };
    }

    const newUserId = createdAuth.user.id;
    const { error: profileInsertErr } = await supabaseAdmin.from("profiles").insert({
        id: newUserId,
        username: nextUsername,
        email,
        role: String(row.role || "employer"),
        full_name: String(row.full_name || ""),
        bio: String(row.bio || ""),
        skills: Array.isArray(row.skills) ? row.skills : [],
        location: String(row.location || ""),
        hourly_rate: String(row.hourly_rate || ""),
        phone: String(row.phone || ""),
        website: String(row.website || ""),
        iban: String(row.iban || ""),
        avatar_url: String(row.avatar_url || ""),
        is_banned: false,
    });

    if (profileInsertErr) {
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        return { ok: false as const, error: "profile_restore_failed", details: profileInsertErr.message };
    }

    const { error: archiveUpdateErr } = await supabaseAdmin
        .from("deleted_users")
        .update({
            restore_status: "restored",
            restored_at: new Date().toISOString(),
            restored_user_id: newUserId,
            restored_by_admin_id: restoredByAdminId,
        })
        .eq("id", archiveId);

    if (archiveUpdateErr) {
        return { ok: false as const, error: "archive_update_failed", details: archiveUpdateErr.message };
    }

    return { ok: true as const, userId: newUserId, email, username: nextUsername, tempPassword: password };
}

