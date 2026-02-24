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

    useEffect(() => {
        const checkUser = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user) {
                    console.log("AuthContext: Oturum bulundu, profil çekiliyor...");
                    const authEmail = session.user.email || "";
                    const { data: profile, error } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .maybeSingle();

                    if (error) console.error("AuthContext: Profil çekme hatası:", error);

                    let resolvedProfile: any = profile;

                    if (!resolvedProfile && authEmail) {
                        const byEmail = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('email', authEmail)
                            .maybeSingle();
                        if (byEmail?.data) resolvedProfile = byEmail.data;
                    }

                    if (!resolvedProfile && session.user?.id && authEmail) {
                        // Profile row might not exist (e.g. broken register flow). Try to create a minimal one.
                        // ÖNCE user_metadata'dan gerçek username'i al
                        const metaUsername = (session.user.user_metadata as any)?.username;
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

                        const metaRoleRaw = (session.user.user_metadata as any)?.role;
                        const metaRole = metaRoleRaw === "freelancer" || metaRoleRaw === "employer" || metaRoleRaw === "admin"
                            ? metaRoleRaw
                            : "employer";

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
                            resolvedProfile = insertRes.data;
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
                        const metaUsername = (session.user.user_metadata as any)?.username;
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
                            fullName: resolvedProfile.full_name,
                            role: resolvedProfile.role as UserRole,
                            email: authEmail || resolvedProfile.email,
                            isBanned: resolvedProfile.is_banned,
                            avatarUrl: resolvedProfile.avatar_url
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
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .maybeSingle();

                let resolvedProfile: any = profile;
                if (!resolvedProfile && authEmail) {
                    // ÖNCE user_metadata'dan gerçek username'i al
                    const metaUsername = (session.user.user_metadata as any)?.username;
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

                    const metaRoleRaw = (session.user.user_metadata as any)?.role;
                    const metaRole = metaRoleRaw === "freelancer" || metaRoleRaw === "employer" || metaRoleRaw === "admin"
                        ? metaRoleRaw
                        : "employer";
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
                    if (insertRes?.data) resolvedProfile = insertRes.data;
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
                    const metaUsernameSignIn = (session.user.user_metadata as any)?.username;
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
                        fullName: resolvedProfile.full_name,
                        role: resolvedProfile.role as UserRole,
                        email: authEmail || resolvedProfile.email,
                        isBanned: resolvedProfile.is_banned,
                        avatarUrl: resolvedProfile.avatar_url
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
                role: profile.role as UserRole,
                email: authEmail || profile.email,
                isBanned: profile.is_banned,
                avatarUrl: profile.avatar_url
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
