"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type UserRole = "admin" | "employer" | "freelancer" | "guest";

interface User {
    id: string;
    username: string;
    fullName?: string;
    role: UserRole;
    email: string;
    isBanned?: boolean;
    avatarUrl?: string;
}

type ProfileRow = {
    id: string;
    username: string;
    full_name?: string | null;
    role?: string | null;
    email?: string | null;
    is_banned?: boolean | null;
    avatar_url?: string | null;
};

const getMetaString = (meta: unknown, key: string) => {
    if (!meta || typeof meta !== "object") return "";
    const rec = meta as Record<string, unknown>;
    const v = rec[key];
    return typeof v === "string" ? v : "";
};

const normalizeRole = (value: unknown): UserRole => {
    const v = String(value || "").toLowerCase();
    if (v === "admin" || v === "employer" || v === "freelancer" || v === "guest") return v;
    return "employer";
};

interface AuthContextType {
    user: User | null;
    setUser: (user: User | null) => void;
    refreshProfile: () => Promise<void>;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const withTimeout = async <T,>(p: PromiseLike<T>, ms: number, label: string): Promise<T> => {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        try {
            return await Promise.race([
                Promise.resolve(p),
                new Promise<T>((_, reject) => {
                    timeoutId = setTimeout(() => reject(new Error(`${label} zaman aşımına uğradı (${ms}ms)`)), ms);
                }),
            ]);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    };

    useEffect(() => {
        const checkUser = async () => {
            try {
                const { data: { session } } = await withTimeout(supabase.auth.getSession(), 8000, "Oturum");

                if (session?.user) {
                    console.log("AuthContext: Oturum bulundu, profil çekiliyor...");
                    const authEmail = session.user.email || "";
                    const { data: profile, error } = await withTimeout(
                        supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
                        8000,
                        "Profil"
                    );

                    if (error) console.error("AuthContext: Profil çekme hatası:", error);

                    let resolvedProfile: ProfileRow | null = (profile as ProfileRow | null);

                    if (!resolvedProfile && authEmail) {
                        const byEmail = await withTimeout(
                            supabase.from('profiles').select('*').eq('email', authEmail).maybeSingle(),
                            8000,
                            "Profil (email)"
                        );
                        if (byEmail?.data) resolvedProfile = byEmail.data;
                    }

                    if (!resolvedProfile && session.user?.id && authEmail) {
                        // Profile row might not exist (e.g. broken register flow). Try to create a minimal one.
                        // ÖNCE user_metadata'dan gerçek username'i al
                        const metaUsername = getMetaString(session.user.user_metadata, "username");
                        let candidateUsername: string;

                        if (metaUsername && typeof metaUsername === 'string' && metaUsername.trim().length > 0) {
                            candidateUsername = metaUsername.trim();
                        } else {
                            // Sadece gerçek username yoksa email bazlı fallback
                            const emailPrefix = String(authEmail).split("@")[0] || "user";
                            const safePrefix = emailPrefix
                                .toLowerCase()
                                .replace(/[^a-z0-9_\-\.]/g, "")
                                .slice(0, 24) || "user";
                            candidateUsername = `${safePrefix}_${String(session.user.id).slice(0, 6)}`;
                        }

                        const metaRole = normalizeRole(getMetaString(session.user.user_metadata, "role"));

                        const insertRes = await supabase
                            .from("profiles")
                            .insert([
                                {
                                    id: session.user.id,
                                    username: candidateUsername,
                                    email: authEmail,
                                    role: metaRole,
                                },
                            ])
                            .select("*")
                            .maybeSingle();

                        if (insertRes?.data) {
                            resolvedProfile = insertRes.data as unknown as ProfileRow;
                        } else if (insertRes?.error) {
                            console.error("AuthContext: Profil otomatik oluşturma hatası:", insertRes.error);
                        }
                    }

                    if (resolvedProfile) {
                        const resolvedEmail = resolvedProfile?.email ? String(resolvedProfile.email) : "";
                        if (authEmail && resolvedEmail && resolvedEmail.trim() !== String(authEmail).trim()) {
                            supabase
                                .from('profiles')
                                .update({ email: authEmail })
                                .eq('id', session.user.id)
                                .then(({ error: updateErr }) => {
                                    if (updateErr) console.error("AuthContext: Profil email senkron hatası:", updateErr);
                                });
                        }

                        // OTOMATİK USERNAME DÜZELTME
                        // Eğer veritabanındaki username "email_uuid" formatında (bozuk) ise
                        // ve user_metadata'da gerçek username varsa, otomatik düzelt
                        const metaUsername = getMetaString(session.user.user_metadata, "username");
                        const currentUsername = String(resolvedProfile.username || "");
                        const looksGenerated = /^[a-z0-9._-]+_[a-f0-9]{6}$/i.test(currentUsername);

                        if (metaUsername && typeof metaUsername === 'string' && metaUsername.trim().length > 0) {
                            const realUsername = metaUsername.trim();
                            if (currentUsername !== realUsername && (looksGenerated || !currentUsername)) {
                                console.log(`AuthContext: Bozuk username düzeltiliyor: "${currentUsername}" → "${realUsername}"`);
                                resolvedProfile.username = realUsername;
                                supabase
                                    .from('profiles')
                                    .update({ username: realUsername })
                                    .eq('id', session.user.id)
                                    .then(({ error: fixErr }) => {
                                        if (fixErr) console.error("AuthContext: Username düzeltme hatası:", fixErr);
                                        else console.log("AuthContext: Username başarıyla düzeltildi!");
                                    });
                            }
                        }

                        console.log("AuthContext: Profil yüklendi:", resolvedProfile.username);
                        setUser({
                            id: resolvedProfile.id,
                            username: resolvedProfile.username,
                            fullName: resolvedProfile.full_name ?? undefined,
                            role: normalizeRole(resolvedProfile.role),
                            email: String(authEmail || resolvedProfile.email || ""),
                            isBanned: resolvedProfile.is_banned ?? undefined,
                            avatarUrl: resolvedProfile.avatar_url ?? undefined
                        });
                    } else {
                        console.warn("AuthContext: Oturum var ama profil bulunamadı. (id/email ile de yok)");
                    }
                }
            } catch (err) {
                console.error("AuthContext: Kritik hata:", err);
            } finally {
                setLoading(false);
            }
        };

        checkUser();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log("AuthContext: Auth Değişimi:", event);
            if (event === 'SIGNED_IN' && session) {
                const authEmail = session.user.email || "";
                const { data: profile } = await withTimeout(
                    supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
                    8000,
                    "Profil (SIGNED_IN)"
                );

                let resolvedProfile: ProfileRow | null = (profile as ProfileRow | null);
                if (!resolvedProfile && authEmail) {
                    // ÖNCE user_metadata'dan gerçek username'i al
                    const metaUsername = getMetaString(session.user.user_metadata, "username");
                    let candidateUsername: string;

                    if (metaUsername && typeof metaUsername === 'string' && metaUsername.trim().length > 0) {
                        candidateUsername = metaUsername.trim();
                    } else {
                        const emailPrefix = String(authEmail).split("@")[0] || "user";
                        const safePrefix = emailPrefix
                            .toLowerCase()
                            .replace(/[^a-z0-9_\-\.]/g, "")
                            .slice(0, 24) || "user";
                        candidateUsername = `${safePrefix}_${String(session.user.id).slice(0, 6)}`;
                    }

                    const metaRole = normalizeRole(getMetaString(session.user.user_metadata, "role"));
                    const insertRes = await supabase
                        .from("profiles")
                        .insert([
                            {
                                id: session.user.id,
                                username: candidateUsername,
                                email: authEmail,
                                role: metaRole,
                            },
                        ])
                        .select("*")
                        .maybeSingle();
                    if (insertRes?.data) resolvedProfile = insertRes.data as unknown as ProfileRow;
                    if (insertRes?.error) console.error("AuthContext: Profil otomatik oluşturma hatası (SIGNED_IN):", insertRes.error);
                }

                if (resolvedProfile) {
                    const resolvedEmail = resolvedProfile?.email ? String(resolvedProfile.email) : "";
                    if (authEmail && resolvedEmail && resolvedEmail.trim() !== String(authEmail).trim()) {
                        supabase
                            .from('profiles')
                            .update({ email: authEmail })
                            .eq('id', session.user.id)
                            .then(({ error: updateErr }) => {
                                if (updateErr) console.error("AuthContext: Profil email senkron hatası:", updateErr);
                            });
                    }

                    // OTOMATİK USERNAME DÜZELTME (SIGNED_IN)
                    const metaUsernameSignIn = getMetaString(session.user.user_metadata, "username");
                    const currentUsernameSignIn = String(resolvedProfile.username || "");
                    const looksGeneratedSignIn = /^[a-z0-9._-]+_[a-f0-9]{6}$/i.test(currentUsernameSignIn);

                    if (metaUsernameSignIn && typeof metaUsernameSignIn === 'string' && metaUsernameSignIn.trim().length > 0) {
                        const realUsernameSignIn = metaUsernameSignIn.trim();
                        if (currentUsernameSignIn !== realUsernameSignIn && (looksGeneratedSignIn || !currentUsernameSignIn)) {
                            console.log(`AuthContext: Bozuk username düzeltiliyor (SIGNED_IN): "${currentUsernameSignIn}" → "${realUsernameSignIn}"`);
                            resolvedProfile.username = realUsernameSignIn;
                            supabase
                                .from('profiles')
                                .update({ username: realUsernameSignIn })
                                .eq('id', session.user.id)
                                .then(({ error: fixErr }) => {
                                    if (fixErr) console.error("AuthContext: Username düzeltme hatası:", fixErr);
                                    else console.log("AuthContext: Username başarıyla düzeltildi!");
                                });
                        }
                    }

                    setUser({
                        id: resolvedProfile.id,
                        username: resolvedProfile.username,
                        fullName: resolvedProfile.full_name ?? undefined,
                        role: normalizeRole(resolvedProfile.role),
                        email: String(authEmail || resolvedProfile.email || ""),
                        isBanned: resolvedProfile.is_banned ?? undefined,
                        avatarUrl: resolvedProfile.avatar_url ?? undefined
                    });
                }
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const refreshProfile = async () => {
        if (!user?.id) return;
        const { data: { session } } = await supabase.auth.getSession();
        const authEmail = session?.user?.email || "";
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        if (profile) {
            if (authEmail && profile.email && String(profile.email).trim() !== String(authEmail).trim()) {
                supabase
                    .from('profiles')
                    .update({ email: authEmail })
                    .eq('id', user.id)
                    .then(({ error: updateErr }) => {
                        if (updateErr) console.error("AuthContext: Profil email senkron hatası:", updateErr);
                    });
            }
            setUser({
                id: profile.id,
                username: profile.username,
                fullName: profile.full_name,
                role: normalizeRole(profile.role),
                email: String(authEmail || profile.email || ""),
                isBanned: profile.is_banned ?? undefined,
                avatarUrl: profile.avatar_url ?? undefined
            });
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        router.push("/login");
    };

    return (
        <AuthContext.Provider value={{ user, setUser, refreshProfile, logout, isAuthenticated: !!user, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
