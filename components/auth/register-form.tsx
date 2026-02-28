"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function RegisterForm() {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState<"employer" | "freelancer">("employer");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [hasSession, setHasSession] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        console.log("--- KAYIT DENEMESİ BAŞLADI ---");

        // 15 Saniyelik Güvenlik Zaman Aşımı
        const timeoutId = setTimeout(() => {
            if (loading) {
                setLoading(false);
                setError("HATA: Sunucudan 15 saniyedir cevap alınamadı. Lütfen internetini kontrol et veya sayfayı yenileyip tekrar dene.");
            }
        }, 15000);

        try {
            // Adım 1: Kayıt
            console.log("Adım 1: Supabase Auth'a gönderiliyor...");
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        role,
                        username,
                    },
                },
            });

            if (authError) {
                console.error("Auth Hatası:", authError);
                setError("Kayıt Hatası: " + authError.message);
                clearTimeout(timeoutId);
                setLoading(false);
                return;
            }

            console.log("Adım 1 Başarılı. ID:", authData.user?.id);

            if (authData.user) {
                // Adım 2: Profil Oluşturma veya Mevcut Olanı Güncelleme
                console.log("Adım 2: Profil kontrol ediliyor/ekleniyor...");

                // Önce bu e-posta ile bir "imported" profil var mı diye bakalım
                const { data: legacyProfile } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('email', email)
                    .maybeSingle();

                if (legacyProfile) {
                    // Varsa, eski (geçici UUID'li) profili silelim ki yenisini (Auth ID'li) ekleyebilelim
                    await supabase.from('profiles').delete().eq('id', legacyProfile.id);
                }

                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert([
                        {
                            id: authData.user.id,
                            username,
                            email,
                            role,
                            is_banned: false
                        }
                    ]);

                if (profileError) {
                    console.error("Profil Hatası:", profileError);
                    setError("Hesap oluşturuldu ama profil detayları kaydedilemedi: " + profileError.message);
                } else {
                    console.log("Kayıt TAMAM!");
                    setSuccess(true);
                    if (authData.session) {
                        setHasSession(true);
                        setTimeout(() => {
                            if (role === "freelancer") {
                                router.push("/profile?onboarding=skills");
                            } else {
                                router.push("/");
                            }
                        }, 1500);
                    } else {
                        setHasSession(false);
                        // User needs to confirm email or just go to login
                        setTimeout(() => router.push("/login"), 3000);
                    }
                }
            }
            clearTimeout(timeoutId);
        } catch (err: any) {
            console.error("Beklenmedik Hata:", err);
            setError("BİR HATA OLUŞTU: " + (err.message || "Lütfen internet bağlantınızı kontrol edin."));
            clearTimeout(timeoutId);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 uppercase">
                    Kayıt Ol
                </h2>
                <p className="mt-2 text-xs text-gray-400 font-bold uppercase tracking-widest">
                    Zaten üye misiniz?{" "}
                    <Link
                        href="/login"
                        className="text-blue-600 hover:text-blue-500 underline"
                    >
                        Giriş Yap
                    </Link>
                </p>
            </div>

            {error && (
                <div className="p-4 text-xs font-black text-red-600 bg-red-50 border-2 border-red-100 rounded-xl uppercase tracking-tight animate-in shake duration-300">
                    ⚠️ {error}
                </div>
            )}

            {success && (
                <div className="p-4 text-xs font-black text-emerald-600 bg-emerald-50 border-2 border-emerald-100 rounded-xl uppercase tracking-tight animate-in zoom-in-95">
                    ✅ KAYIT BAŞARILI! {hasSession ? "Yönlendiriliyorsunuz..." : "Lütfen e-postanızı kontrol edin veya giriş yapın."}
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div
                    className={`cursor-pointer rounded-2xl border-2 p-6 text-center transition-all ${role === "employer"
                        ? "border-blue-600 bg-blue-50/50 shadow-lg shadow-blue-100"
                        : "border-gray-100 hover:border-gray-200"
                        }`}
                    onClick={() => setRole("employer")}
                >
                    <div className="font-black text-xs text-gray-900 uppercase">İş Veren</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">Proje Yayınla</div>
                </div>
                <div
                    className={`cursor-pointer rounded-2xl border-2 p-6 text-center transition-all ${role === "freelancer"
                        ? "border-blue-600 bg-blue-50/50 shadow-lg shadow-blue-100"
                        : "border-gray-100 hover:border-gray-200"
                        }`}
                    onClick={() => setRole("freelancer")}
                >
                    <div className="font-black text-xs text-gray-900 uppercase">Freelancer</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">İş Bul</div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="username" className="text-[10px] font-black uppercase text-gray-400">Kullanıcı Adı</Label>
                    <Input
                        id="username"
                        type="text"
                        required
                        className="h-14 rounded-2xl bg-gray-50 border-gray-100 font-bold text-sm"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="orn: onur123"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email" className="text-[10px] font-black uppercase text-gray-400">E-posta</Label>
                    <Input
                        id="email"
                        type="email"
                        required
                        className="h-14 rounded-2xl bg-gray-50 border-gray-100 font-bold text-sm"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ornegin@mail.com"
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
                {loading ? "Hesap Oluşturuluyor..." : "Hesap Oluştur"}
            </Button>

            <div className="pt-4 border-t-2 border-dashed border-gray-100 mt-4">
                <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-[10px] font-black uppercase text-gray-400 hover:text-blue-600"
                    onClick={async () => {
                        const start = Date.now();
                        try {
                            const { data, error } = await supabase.from('profiles').select('count');
                            const duration = Date.now() - start;
                            if (error) alert("BAĞLANTI HATASI: " + error.message);
                            else alert("BAĞLANTI BAŞARILI! (Hız: " + duration + "ms) - Sistem seni duyuyor Onur, kaydolabilirsin.");
                        } catch (err: any) {
                            alert("KRİTİK HATA: Supabase'e hiç ulaşılamıyor. İnternetini veya .env.local dosyasını kontrol et! \n\nDetay: " + err.message);
                        }
                    }}
                >
                    🔍 SİSTEM BAĞLANTISINI TEST ET (DEBUG)
                </Button>
            </div>
        </form>
    );
}
