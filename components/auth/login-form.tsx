"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export function LoginForm() {
    const [identifier, setIdentifier] = useState(""); // email or username
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const loadingRef = useRef(false);
    useEffect(() => {
        loadingRef.current = loading;
    }, [loading]);

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

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const identifierNormalized = identifier.trim();
        const passwordNormalized = password.trim();

        console.log("--- GİRİŞ DENEMESİ ---");

        // 15 Saniyelik Güvenlik Zaman Aşımı
        const timeoutId = setTimeout(() => {
            if (loadingRef.current) {
                setLoading(false);
                setError("HATA: Sunucudan cevap alınamadı. Lütfen internetini kontrol et veya tekrar dene.");
            }
        }, 15000);

        try {
            if (!identifierNormalized || !passwordNormalized) {
                setError("Lütfen kullanıcı adı/e-posta ve şifre alanlarını doldurun.");
                setLoading(false);
                clearTimeout(timeoutId);
                return;
            }

            let email = identifierNormalized;

            // 1. Kullanıcı adı ise e-postayı bul
            if (!identifierNormalized.includes("@")) {
                const profileRes = (await withTimeout(
                    supabase
                        .from('profiles')
                        .select('email')
                        .eq('username', identifierNormalized)
                        .maybeSingle(),
                    10000,
                    "Kullanıcı profili"
                )) as any;

                const profile = profileRes?.data;
                const profileErr = profileRes?.error;

                if (profileErr) {
                    console.error("Login: profile email lookup error:", profileErr);
                    setError("Profil bilgisi alınamadı. (RLS/Policy kontrol et)");
                    setLoading(false);
                    clearTimeout(timeoutId);
                    return;
                }

                if (profile?.email) {
                    email = profile.email;
                } else {
                    setError("Bu kullanıcı adına ait hesap bulunamadı.");
                    setLoading(false);
                    clearTimeout(timeoutId);
                    return;
                }
            }

            // 2. İşlemi Başlat
            const authRes = (await withTimeout(
                supabase.auth.signInWithPassword({
                    email: email.trim().toLowerCase(),
                    password: passwordNormalized,
                }),
                12000,
                "Giriş"
            )) as any;

            const data = authRes?.data;
            const authError = authRes?.error;

            if (authError) {
                if (authError.message.toLowerCase().includes("email not confirmed")) {
                    setError("Giriş Başarısız: Lütfen e-posta adresinizi onaylayın.");
                } else if (authError.message.toLowerCase().includes("invalid login credentials")) {
                    setError("Hatalı e-posta veya şifre girdiniz.");
                } else {
                    setError(authError.message);
                }
                setLoading(false);
                clearTimeout(timeoutId);
                return;
            }

            if (data.user) {
                // 3. Profil bilgilerini çek
                const profRes = (await withTimeout(
                    supabase
                        .from('profiles')
                        .select('is_banned, role')
                        .eq('id', data.user.id)
                        .maybeSingle(),
                    10000,
                    "Profil"
                )) as any;

                const profile = profRes?.data;
                const profErr = profRes?.error;

                if (profErr) {
                    console.error("Login: profile fetch error:", profErr);
                    await supabase.auth.signOut();
                    setError("Profil bilgisi alınamadı. (RLS/Policy) SQL policy'leri kontrol et.");
                    setLoading(false);
                    clearTimeout(timeoutId);
                    return;
                }

                if (!profile) {
                    console.warn("Login: session var ama profiles kaydı yok.");
                    await supabase.auth.signOut();
                    setError("Bu hesaba ait profil kaydı bulunamadı. Register tetikleyicisi/policy bozulmuş olabilir.");
                    setLoading(false);
                    clearTimeout(timeoutId);
                    return;
                }

                if (profile?.is_banned) {
                    await supabase.auth.signOut();
                    setError("Hesabınız engellenmiştir.");
                    setLoading(false);
                    clearTimeout(timeoutId);
                    return;
                } else {
                    const target = profile?.role === 'admin' ? "/admin" : "/";
                    router.push(target);
                    // Fallback: bazen router.push gecikebiliyor; oturum varsa /'a gitmeyi zorla
                    setTimeout(() => {
                        supabase.auth.getSession().then(({ data }) => {
                            if (data?.session) router.push(target);
                        });
                    }, 800);
                    // Hard fallback: eğer hala login sayfasında takıldıysa tam sayfa yönlendirme
                    setTimeout(() => {
                        if (!loadingRef.current) return;
                        supabase.auth.getSession().then(({ data }) => {
                            const hasSession = !!data?.session;
                            const stillOnLogin = typeof window !== "undefined" && window.location?.pathname?.includes("/login");
                            if (hasSession && stillOnLogin) {
                                window.location.assign(target);
                            } else if (stillOnLogin) {
                                setLoading(false);
                                setError("Giriş yapıldı ama yönlendirme tamamlanamadı. Sayfayı yenileyip tekrar deneyin.");
                            }
                        });
                    }, 2500);
                    // Important: Don't setLoading(false) here because if redirect is fast, 
                    // we want the user to see the loading state until they move pages.
                    // But if it takes time, the redirect will happen eventually.
                }
            } else {
                setError("Giriş başarısız. Lütfen tekrar deneyin.");
                setLoading(false);
                clearTimeout(timeoutId);
                return;
            }
            clearTimeout(timeoutId);
        } catch (err: any) {
            console.error("Giriş hatası:", err);
            setError("Beklenmedik bir sorun oluştu. Lütfen tekrar deneyin.");
            clearTimeout(timeoutId);
            setLoading(false);
        }
    };

    return (
        <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 uppercase">
                    Giriş Yap
                </h2>
                <p className="mt-2 text-xs text-gray-400 font-bold uppercase tracking-widest">
                    Hesabınız yok mu?{" "}
                    <Link
                        href="/register"
                        className="text-blue-600 hover:text-blue-500 underline"
                    >
                        Üye Ol
                    </Link>
                </p>
            </div>

            {error && (
                <div className="p-4 text-xs font-black text-red-600 bg-red-50 border-2 border-red-100 rounded-xl uppercase tracking-tight">
                    {error}
                </div>
            )}

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="identifier" className="text-[10px] font-black uppercase text-gray-400">Kullanıcı Adı / E-posta</Label>
                    <Input
                        id="identifier"
                        type="text"
                        required
                        className="h-14 rounded-2xl bg-gray-50 border-gray-100 font-bold text-sm"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="Kullanıcı adınız veya e-postanız"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password" id="password-label" className="text-[10px] font-black uppercase text-gray-400">Şifre</Label>
                    <Input
                        id="password"
                        type="password"
                        required
                        className="h-14 rounded-2xl bg-gray-50 border-gray-100 font-bold text-sm"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                    />
                </div>
            </div>

            <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 text-white bg-blue-600 hover:bg-blue-700 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-100 transition-all hover:scale-[1.02] active:scale-95"
            >
                {loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
            </Button>

            <div className="text-center">
                <Link
                    href="/forgot-password"
                    className="text-[10px] font-black uppercase text-gray-400 hover:text-blue-600"
                >
                    Şifremi Unuttum
                </Link>
            </div>
        </form>
    );
}
