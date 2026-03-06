"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { usernameFold } from "@/lib/utils";

export function LoginForm() {
    const [identifier, setIdentifier] = useState(""); // email or username
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const loadingRef = useRef(false);
    useEffect(() => {
        loadingRef.current = loading;
    }, [loading]);

    useEffect(() => {
        let cancelled = false;
        supabase.auth.getSession().then(({ data }) => {
            if (cancelled) return;
            if (data?.session) router.push("/");
        });
        return () => {
            cancelled = true;
        };
    }, [router]);

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

    const submitLogin = async () => {
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
                const folded = usernameFold(identifierNormalized);
                const profileRes = (await withTimeout(
                    supabase
                        .from('profiles')
                        .select('email')
                        .or(`username.eq.${identifierNormalized},username.ilike.${identifierNormalized},username.ilike.${folded}`)
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
                    clearTimeout(timeoutId);
                    setLoading(false);
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

    const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (loadingRef.current) return;
        submitLogin();
    };

    return (
        <div className="space-y-6">
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
                    <Label htmlFor="identifier" className="text-[10px] font-black uppercase text-gray-400">
                        Kullanıcı Adı / E-posta
                    </Label>
                    <div className="relative">
                        <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            id="identifier"
                            type="text"
                            required
                            className="h-14 rounded-2xl bg-gray-50 border-gray-100 pl-11 font-bold text-sm"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            onKeyDown={onEnter}
                            placeholder="Kullanıcı adı veya e-posta"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="password" className="font-black text-xs uppercase tracking-widest text-gray-600">
                        Şifre
                    </Label>
                    <div className="relative">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            required
                            className="h-14 rounded-2xl bg-gray-50 border-gray-100 pl-11 pr-11 font-bold text-sm"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={onEnter}
                            placeholder="••••••••"
                        />
                        <button
                            type="button"
                            aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            onClick={() => setShowPassword((v) => !v)}
                            disabled={loading}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            </div>

            <Button
                type="button"
                onClick={() => {
                    if (loadingRef.current) return;
                    submitLogin();
                }}
                disabled={loading}
                className="w-full h-14 text-white bg-blue-600 hover:bg-blue-700 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-100 transition-all hover:scale-[1.02] active:scale-95"
            >
                {loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
            </Button>

            <div className="text-center">
                <Link href="/forgot-password" className="text-[10px] font-black uppercase text-gray-400 hover:text-blue-600">
                    Şifremi Unuttum
                </Link>
            </div>
        </div>
    );
}
