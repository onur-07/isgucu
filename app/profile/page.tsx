"use client";

import { useAuth } from "@/components/auth/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { formatDistance } from "date-fns";
import { tr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Star, MapPin, Calendar, Briefcase, Award, TrendingUp,
    DollarSign, Clock, CheckCircle, Globe, Phone, Mail,
    Edit3, Save, X, Trash2, Camera, ShieldCheck
} from "lucide-react";
import { getUserStats, getUserReviews, type UserStats, type Review } from "@/lib/data-service";
import { GigCard } from "@/components/gigs/gig-card";
import { JobCard } from "@/components/jobs/job-card";
import { supabase } from "@/lib/supabase";
import { maskFullName, cn } from "@/lib/utils";

interface ProfileData {
    fullName: string;
    bio: string;
    skills: string[];
    location: string;
    hourlyRate: string;
    portfolio: string;
    phone: string;
    website: string;
    iban: string;
    createdAt: string;
    avatarUrl: string;
}

export default function ProfilePage() {
    const { user, refreshProfile, loading: authLoading } = useAuth();
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [avatarRetryCount, setAvatarRetryCount] = useState(0);
    const [avatarRetryKey, setAvatarRetryKey] = useState<number>(() => Date.now());
    const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [userJobs, setUserJobs] = useState<any[]>([]);
    const [userGigs, setUserGigs] = useState<any[]>([]);
    const [gigsLoading, setGigsLoading] = useState(false);
    const [profile, setProfile] = useState<ProfileData>({
        fullName: "",
        bio: "",
        skills: [],
        location: "",
        hourlyRate: "",
        portfolio: "",
        phone: "",
        website: "",
        iban: "",
        createdAt: "",
        avatarUrl: "",
    });
    const [skillInput, setSkillInput] = useState("");
    const [deletionReason, setDeletionReason] = useState("");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const sanitizeUrl = (url: string) => {
        return (url || "")
            .trim()
            .replace(/^[\s"'`“”]+|[\s"'`“”]+$/g, "")
            .replace(/[\r\n\t]/g, "");
    };

    const avatarTimestamp = (url: string) => {
        const clean = sanitizeUrl(url);
        const match = clean.match(/-(\d+)\.(png|jpg|jpeg|webp)(\?|$)/i);
        if (!match) return 0;
        const ts = Number(match[1]);
        return Number.isFinite(ts) ? ts : 0;
    };

    const fetchWithTimeout = async (url: string, ms: number) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), ms);
        try {
            const res = await fetch(url, { method: "GET", cache: "no-store", signal: controller.signal });
            return res;
        } finally {
            clearTimeout(id);
        }
    };

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            router.push("/login");
            return;
        }

        const fetchProfile = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (error) {
                console.error("Profil çekme hatası:", error);
            }

            if (!data) {
                // İlk yüklemede bazen session/profile senkronu gecikebiliyor; 1 kez kısa retry
                await new Promise((r) => setTimeout(r, 400));
                const retry = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .maybeSingle();
                if (retry?.data) {
                    const d: any = retry.data;
                    const dbAvatar = sanitizeUrl(d.avatar_url || "");
                    const lsAvatar = sanitizeUrl(localStorage.getItem(`isgucu_avatar_${user.username}`) || "");
                    const avatarUrl = avatarTimestamp(lsAvatar) > avatarTimestamp(dbAvatar) ? lsAvatar : dbAvatar;
                    setProfile({
                        fullName: d.full_name || "",
                        bio: d.bio || "",
                        skills: d.skills || [],
                        location: d.location || "",
                        hourlyRate: d.hourly_rate || "",
                        portfolio: d.portfolio || "",
                        phone: d.phone || "",
                        website: d.website || "",
                        iban: d.iban || "",
                        createdAt: d.created_at || "",
                        avatarUrl,
                    });
                    localStorage.setItem(`isgucu_avatar_${user.username}`, avatarUrl);
                }
                return;
            }

            if (data) {
                const dbAvatar = sanitizeUrl(data.avatar_url || "");
                const lsAvatar = sanitizeUrl(localStorage.getItem(`isgucu_avatar_${user.username}`) || "");
                const avatarUrl = avatarTimestamp(lsAvatar) > avatarTimestamp(dbAvatar) ? lsAvatar : dbAvatar;
                setProfile({
                    fullName: data.full_name || "",
                    bio: data.bio || "",
                    skills: data.skills || [],
                    location: data.location || "",
                    hourlyRate: data.hourly_rate || "",
                    portfolio: data.portfolio || "",
                    phone: data.phone || "",
                    website: data.website || "",
                    iban: data.iban || "",
                    createdAt: data.created_at || "",
                    avatarUrl,
                });
                // Persist to local storage as fallback
                localStorage.setItem(`isgucu_avatar_${user.username}`, avatarUrl);
            }
        };

        const fetchUserJobs = async () => {
            const { data } = await supabase
                .from('jobs')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (data) setUserJobs(data);
        };

        fetchProfile();
        fetchUserJobs();
        if (user?.role === "freelancer") {
            (async () => {
                setGigsLoading(true);
                try {
                    const { data, error } = await supabase
                        .from('gigs')
                        .select('id, user_id, title, description, category, price, created_at, images, packages')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false });

                    if (error) {
                        console.error("Profil gigs çekme hatası:", error);
                        setUserGigs([]);
                        return;
                    }
                    setUserGigs(data || []);
                } finally {
                    setGigsLoading(false);
                }
            })();
        }
        setStats(getUserStats(user.username, user.role as "employer" | "freelancer" | "admin"));
        setReviews(getUserReviews(user.username));
    }, [user, router, authLoading]);

    const refreshMyGigs = async () => {
        if (!user?.id) return;
        setGigsLoading(true);
        try {
            const { data, error } = await supabase
                .from('gigs')
                .select('id, user_id, title, description, category, price, created_at, images, packages, is_active')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (error) {
                console.error("Profil gigs refresh hatası:", error);
                return;
            }
            setUserGigs(data || []);
        } finally {
            setGigsLoading(false);
        }
    };

    const toggleGigActive = async (gigId: any, nextActive: boolean) => {
        if (!user?.id) return;
        const { error } = await supabase
            .from('gigs')
            .update({ is_active: nextActive })
            .eq('id', gigId)
            .eq('user_id', user.id);
        if (error) {
            alert("Güncellenemedi: " + error.message);
            return;
        }
        await refreshMyGigs();
    };

    const deleteGig = async (gigId: any) => {
        if (!user?.id) return;
        if (!confirm("Bu ilanı kaldırmak istediğinize emin misiniz?")) return;
        const { error } = await supabase
            .from('gigs')
            .delete()
            .eq('id', gigId)
            .eq('user_id', user.id);
        if (error) {
            alert("Silinemedi: " + error.message);
            return;
        }
        await refreshMyGigs();
    };

    useEffect(() => {
        setAvatarRetryCount(0);
        setAvatarRetryKey(Date.now());
        setAvatarLoadFailed(false);
    }, [profile.avatarUrl]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);

        const avatarUrlSanitized = (profile.avatarUrl || "").trim().replace(/^"+|"+$/g, "");

        const { data, error } = await supabase
            .from('profiles')
            .update({
                full_name: profile.fullName,
                bio: profile.bio,
                skills: profile.skills,
                location: profile.location,
                hourly_rate: profile.hourlyRate,
                phone: profile.phone,
                website: profile.website,
                iban: profile.iban,
                avatar_url: avatarUrlSanitized
            })
            .eq('id', user.id)
            .select('*')
            .single();

        if (!error) {
            if (data) {
                setProfile({
                    fullName: data.full_name || "",
                    bio: data.bio || "",
                    skills: data.skills || [],
                    location: data.location || "",
                    hourlyRate: data.hourly_rate || "",
                    portfolio: data.portfolio || "",
                    phone: data.phone || "",
                    website: data.website || "",
                    iban: data.iban || "",
                    createdAt: data.created_at || "",
                    avatarUrl: sanitizeUrl(data.avatar_url || ""),
                });
                // Persist to local storage as fallback
                localStorage.setItem(`isgucu_avatar_${user.username}`, sanitizeUrl(data.avatar_url || ""));
            }
            await refreshProfile();
            setEditing(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } else {
            console.error("Profil güncellenemedi:", error);
            if (error.message.includes("avatar_url")) {
                alert("HATA: Veritabanında 'avatar_url' sütunu bulunamadı. Lütfen SQL kodunu Supabase SQL Editor'de tekrar çalıştırın.");
            } else {
                alert("Güncelleme sırasında hata oluştu: " + error.message);
            }
        }
        setSaving(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        e.currentTarget.value = "";

        if (!file.type?.startsWith("image/")) {
            alert("Lütfen bir görsel dosyası seçin (png/jpg/webp).");
            return;
        }

        console.log("Avatar upload dosyası:", {
            name: file.name,
            type: file.type,
            size: file.size,
        });

        // --- 1. Hemen Önizleme Göster (Kullanıcı Beklemesin) ---
        const reader = new FileReader();
        reader.onloadend = () => {
            setProfile(prev => ({ ...prev, avatarUrl: reader.result as string }));
        };
        reader.readAsDataURL(file);

        setSaving(true);
        try {
            const fileExt = (file.name.split('.').pop() || "").toLowerCase();
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const contentType = fileExt === "png"
                ? "image/png"
                : fileExt === "webp"
                    ? "image/webp"
                    : "image/jpeg";

            const bytes = new Uint8Array(await file.arrayBuffer());

            // --- 2. Supabase'e Yüklemeyi Dene ---
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, bytes, { upsert: true, contentType, cacheControl: "3600" });

            if (uploadError) {
                console.error("Yükleme Hatası:", uploadError);
                if (uploadError.message.includes("not found")) {
                    alert("⚠️ DİKKAT: Supabase üzerinde 'avatars' adında bir STORAGE BUCKET bulunamadı.\n\nÇözüm:\n1. Supabase Dashboard'a gir.\n2. Sol menüden 'Storage' seç.\n3. 'New Bucket' butonuna bas.\n4. İsmine 'avatars' yaz ve 'Public' seçeneğini işaretle.\n5. Kaydet.");
                } else {
                    throw uploadError;
                }
                return;
            }

            // --- 2.1. Dosyanın gerçekten yazıldığını doğrula ---
            const { error: downloadErr } = await supabase.storage
                .from('avatars')
                .download(filePath);

            if (downloadErr) {
                console.error("Upload sonrası doğrulama başarısız:", downloadErr);
                alert(
                    "Resim yüklendi gibi görünüyor ama dosya Storage'da bulunamadı. " +
                    "Lütfen bucket'ın Public olduğundan ve Storage policy'lerinin izin verdiğinden emin olun."
                );
                return;
            }

            // --- 3. Public URL Al ve Profili Güncelle ---
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            console.log("Supabase'den gelen Public URL:", publicUrl);

            // --- 3.1 Public URL gerçekten image/* mı dönüyor kontrol et ---
            try {
                const res = await fetchWithTimeout(publicUrl, 3500);
                const contentType = res.headers.get("content-type") || "";
                const isImage = contentType.toLowerCase().includes("image/");
                console.log("Avatar public URL check:", { status: res.status, ok: res.ok, contentType, url: publicUrl });

                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    console.log("Avatar public URL body snippet:", text.slice(0, 200));
                    // Do not block the save flow on transient CDN/storage issues.
                    // We'll still persist the URL and let the UI retry on render.
                }

                if (!isImage) {
                    const text = await res.text().catch(() => "");
                    console.log("Avatar public URL non-image snippet:", text.slice(0, 200));
                    // Do not block; surface via console and let avatar probe handle fallback.
                }
            } catch (e: any) {
                console.log("Avatar public URL check failed:", e?.name === "AbortError" ? "timeout" : (e?.message || e));
            }

            // Veritabanına kaydet (Sütun adının avatar_url olduğundan emin olun)
            const { data: updatedProfile, error: dbError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id)
                .select('avatar_url')
                .single();

            if (dbError) {
                console.error("Veritabanı Güncelleme Hatası:", dbError);
                // Eğer burada hata alıyorsan SQL Editor'de "avatar_url" sütununu eklememiş olabilirsin
                alert("Veritabanı Kayıt Hatası: " + dbError.message + "\n\nLütfen SQL Editor kısmında 'avatar_url' kolonunu eklediğinden emin ol.");
            } else {
                console.log("Veritabanı Başarıyla Güncellendi!");
                const finalUrl = sanitizeUrl(updatedProfile?.avatar_url || publicUrl);
                // Yerel state'i güncelle
                setProfile(prev => ({ ...prev, avatarUrl: finalUrl }));
                localStorage.setItem(`isgucu_avatar_${user.username}`, finalUrl);
                // Global Auth Context'i yenile (Header vb. yerler için)
                await refreshProfile();
                setSaved(true);
            }

            setTimeout(() => setSaved(false), 3000);
        } catch (error: any) {
            console.error("Dosya yükleme sürecinde genel hata:", error);
            alert("Resim yüklenirken bir hata oluştu: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const requestDeletion = async () => {
        if (!user) return;
        const { error } = await supabase.from('account_deletion_requests').insert({
            user_id: user.id,
            username: user.username,
            email: user.email,
            reason: deletionReason
        });

        if (!error) {
            alert("Hesap silme talebiniz iletildi.");
            setShowDeleteConfirm(false);
        }
    };

    const addSkill = () => {
        if (skillInput.trim() && !profile.skills.includes(skillInput.trim())) {
            setProfile((prev) => ({ ...prev, skills: [...prev.skills, skillInput.trim()] }));
            setSkillInput("");
        }
    };

    const removeSkill = (skill: string) => {
        setProfile((prev) => ({ ...prev, skills: prev.skills.filter((s) => s !== skill) }));
    };

    const isFreelancer = user?.role === "freelancer";
    const isEmployer = user?.role === "employer";
    const memberSince = profile.createdAt
        ? formatDistance(new Date(profile.createdAt), new Date(), { addSuffix: true, locale: tr })
        : "Yeni Üye";

    const sanitizedAvatarUrl = sanitizeUrl(profile.avatarUrl || "");
    const avatarSrc = sanitizedAvatarUrl && !avatarLoadFailed
        ? (sanitizedAvatarUrl.startsWith('data:')
            ? sanitizedAvatarUrl
            : `${sanitizedAvatarUrl}${sanitizedAvatarUrl.includes('?') ? '&' : '?'}u=${avatarRetryKey}`)
        : "";

    useEffect(() => {
        const urlToProbe = avatarSrc;
        if (!urlToProbe || urlToProbe.startsWith("data:")) return;

        (async () => {
            try {
                const res = await fetchWithTimeout(urlToProbe, 2500);
                const contentType = res.headers.get("content-type");
                const isImage = String(contentType || "").toLowerCase().includes("image/");
                if (!res.ok || !isImage) {
                    const text = await res.text().catch(() => "");
                    console.log("Avatar probe:", { status: res.status, ok: res.ok, contentType, url: urlToProbe, snippet: text.slice(0, 200) });
                } else {
                    console.log("Avatar probe:", { status: res.status, ok: res.ok, contentType, url: urlToProbe });
                }
            } catch (e: any) {
                console.log("Avatar probe failed:", e?.name === "AbortError" ? "timeout" : (e?.message || e));
            }
        })();
    }, [avatarSrc]);

    if (!user || !stats) return null;

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-20">
            {/* Rich Background Decor */}
            <div className="absolute top-0 left-0 w-full h-80 bg-gradient-to-b from-blue-50 to-transparent -z-10" />

            <div className="container max-w-6xl mx-auto px-4 pt-10">
                {saved && (
                    <div className="fixed top-24 right-4 z-50 animate-in slide-in-from-right duration-500">
                        <div className="bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold">
                            <CheckCircle className="h-5 w-5" />
                            Profil Başarıyla Güncellendi
                        </div>
                    </div>
                )}

                {/* Hero Profile Card */}
                <div className="relative mb-10">
                    <div className={cn(
                        "rounded-[2.5rem] overflow-hidden shadow-2xl transition-all duration-700 relative",
                        isFreelancer ? "bg-blue-600" : isEmployer ? "bg-orange-500" : "bg-slate-900"
                    )}>
                        {/* Decorative Patterns */}
                        <div className="absolute inset-0 opacity-20 pointer-events-none">
                            <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/20 rounded-full blur-3xl" />
                            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-black/10 rounded-full blur-3xl" />
                            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
                        </div>

                        <div className="relative z-10 p-8 md:p-12 lg:flex lg:items-center lg:justify-between gap-8">
                            <div className="flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                                {/* Avatar with Glow */}
                                <div className="relative group">
                                    <div className="h-32 w-32 md:h-40 md:w-40 rounded-full bg-white p-1.5 shadow-2xl group-hover:scale-105 transition-transform duration-500 overflow-hidden">
                                        <div className={cn(
                                            "w-full h-full rounded-full flex items-center justify-center text-4xl md:text-6xl font-black text-white overflow-hidden relative",
                                            isFreelancer ? "bg-gradient-to-br from-blue-400 to-indigo-600" :
                                                isEmployer ? "bg-gradient-to-br from-orange-400 to-red-500" :
                                                    "bg-slate-700"
                                        )}>
                                            {avatarSrc ? (
                                                <img
                                                    src={avatarSrc}
                                                    alt="Profil"
                                                    className="w-full h-full object-cover animate-in fade-in duration-700"
                                                    onLoad={() => {
                                                        console.log("Görsel başarıyla yüklendi.");
                                                        setAvatarRetryCount(0);
                                                        setAvatarLoadFailed(false);
                                                    }}
                                                    onError={(e) => {
                                                        console.error("Görsel yükleme hatası (Link kırık veya RLS engeli):", sanitizedAvatarUrl);

                                                        // Supabase Storage bazen upload sonrası public URL'yi hemen servis edemeyebiliyor.
                                                        // Bu yüzden birkaç kez retry yapıyoruz.
                                                        setAvatarRetryCount((prev) => {
                                                            if (prev >= 2) {
                                                                setAvatarLoadFailed(true);
                                                                return prev;
                                                            }

                                                            const next = prev + 1;
                                                            setTimeout(() => setAvatarRetryKey(Date.now()), 500 * next);
                                                            return next;
                                                        });
                                                    }}
                                                />
                                            ) : (
                                                <span className="animate-in fade-in duration-500 select-none">
                                                    {maskFullName(profile.fullName || user.username).charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {editing && (
                                        <>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleFileUpload}
                                            />
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={saving}
                                                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-wait"
                                            >
                                                <Camera className="h-8 w-8 text-white" />
                                            </button>
                                        </>
                                    )}
                                </div>

                                <div className="space-y-3 text-white">
                                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full border border-white/30 text-[10px] font-black uppercase tracking-widest leading-none">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        {isFreelancer ? "Freelancer" : isEmployer ? "İş Veren" : "Yönetici"}
                                    </div>
                                    <h1 className="text-4xl md:text-5xl font-black font-heading tracking-tight italic">
                                        {maskFullName(profile.fullName || user.username)}
                                    </h1>
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-white/80 text-xs font-bold uppercase tracking-widest">
                                        <span className="flex items-center gap-2 bg-black/10 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                                            <MapPin className="h-3.5 w-3.5" /> {profile.location || "Konum Belirtilmemiş"}
                                        </span>
                                        <span className="flex items-center gap-2 bg-black/10 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                                            <Calendar className="h-3.5 w-3.5" /> {memberSince === "Yeni Üye" ? memberSince : `${memberSince} katıldı`}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 lg:mt-0 flex flex-col gap-3 min-w-[200px]">
                                {!editing ? (
                                    <Button
                                        onClick={() => setEditing(true)}
                                        className="h-14 bg-white text-gray-900 hover:bg-white/90 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl hover:translate-y-[-2px] transition-all"
                                    >
                                        <Edit3 className="mr-2 h-4 w-4" /> PROFİLİ DÜZENLE
                                    </Button>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                                        <Button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="h-14 bg-emerald-500 text-white hover:bg-emerald-600 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl hover:translate-y-[-2px] transition-all disabled:opacity-50 disabled:translate-y-0"
                                        >
                                            {saving ? "KAYDEDİLİYOR..." : <><Save className="mr-2 h-4 w-4" /> KAYDET</>}
                                        </Button>
                                        <Button
                                            onClick={() => setEditing(false)}
                                            variant="outline"
                                            className="h-14 bg-white/10 text-white border-white/20 hover:bg-white/20 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl transition-all"
                                        >
                                            <X className="mr-2 h-4 w-4" /> İPTAL
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Sidebar */}
                    <div className="lg:col-span-1 space-y-8">
                        {/* Stats Card */}
                        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Award className="h-4 w-4 text-blue-500" /> Hesap Özeti
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-5 bg-slate-50 rounded-2xl text-center space-y-1">
                                    <div className="text-2xl font-black text-slate-900">{stats.completedJobs}</div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase">Tamamlanan</div>
                                </div>
                                <div className="p-5 bg-slate-50 rounded-2xl text-center space-y-1">
                                    <div className="text-2xl font-black text-slate-900">{stats.activeJobs}</div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase">Aktif İş</div>
                                </div>
                                <div className="p-5 bg-amber-50 rounded-2xl text-center space-y-1 border border-amber-100/50">
                                    <div className="text-2xl font-black text-amber-600 flex items-center justify-center gap-1">
                                        {stats.averageRating > 0 ? stats.averageRating : "—"} <Star className="h-4 w-4 fill-amber-600" />
                                    </div>
                                    <div className="text-[9px] font-black text-amber-500 uppercase">Puan</div>
                                </div>
                                <div className="p-5 bg-blue-50 rounded-2xl text-center space-y-1 border border-blue-100/50">
                                    <div className="text-xl font-black text-blue-700 leading-none py-1">
                                        ₺{(isFreelancer ? stats.totalEarnings : stats.totalSpent).toLocaleString("tr-TR")}
                                    </div>
                                    <div className="text-[9px] font-black text-blue-500 uppercase">
                                        {isFreelancer ? "Kazanç" : "Harcama"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Contact Info Card */}
                        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-50 pb-4">
                                İletişim & Sosyal
                            </h3>
                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                                        <Mail className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">E-Posta Adresi</p>
                                        <p className="text-sm font-bold text-slate-900 truncate">{user.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 text-slate-400">
                                        <Phone className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Telefon</p>
                                        {editing ? (
                                            <Input
                                                value={profile.phone}
                                                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                                className="h-8 p-0 border-0 border-b-2 bg-transparent text-sm font-bold rounded-none focus-visible:ring-0 focus-visible:border-blue-500"
                                            />
                                        ) : (
                                            <p className="text-sm font-bold text-slate-900">{profile.phone || "Eklenmemiş"}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                                        <Globe className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Web Sitesi</p>
                                        {editing ? (
                                            <Input
                                                value={profile.website}
                                                onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                                                className="h-8 p-0 border-0 border-b-2 bg-transparent text-sm font-bold rounded-none focus-visible:ring-0 focus-visible:border-blue-500"
                                            />
                                        ) : (
                                            <p className="text-sm font-bold text-blue-600 truncate">{profile.website || "Eklenmemiş"}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* IBAN Protection Info (Freelancer Only) */}
                        {isFreelancer && (
                            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-8 text-white shadow-xl shadow-blue-100">
                                <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4" /> Ödeme Güvenliği
                                </h3>
                                <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 space-y-4">
                                    <div>
                                        <p className="text-[8px] font-black uppercase opacity-60">Tanımlı IBAN</p>
                                        {editing ? (
                                            <Input
                                                value={profile.iban}
                                                onChange={(e) => setProfile({ ...profile, iban: e.target.value })}
                                                className="mt-1 h-10 bg-white text-blue-900 font-mono font-black text-xs rounded-xl border-0"
                                            />
                                        ) : (
                                            <p className="text-xs font-mono font-black tracking-wider mt-1">{profile.iban || "TR00..."}</p>
                                        )}
                                    </div>
                                    <p className="text-[9px] font-medium opacity-80 leading-relaxed italic">
                                        IBAN bilgileriniz sadece ödemeler için sistem tarafından kullanılır, diğer üyeler göremez.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Main Content */}
                    <div className="lg:col-span-2 space-y-8 text-center sm:text-left">
                        {/* Main Info Card */}
                        <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-slate-100 flex flex-col items-center">
                            <div className="space-y-10 w-full max-w-2xl">
                                {/* Ad Soyad Editing */}
                                {editing && (
                                    <div className="space-y-3">
                                        <Label className="text-xs font-black uppercase text-slate-500 tracking-[0.2em] block text-center">Görünen İsim / Ünvan</Label>
                                        <Input
                                            value={profile.fullName}
                                            onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                                            className="h-14 rounded-2xl text-center font-black text-xl border-2 border-slate-100 focus:border-blue-500 transition-all shadow-inner bg-slate-50"
                                        />
                                    </div>
                                )}

                                {/* Bio Section */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center justify-center sm:justify-start gap-2">
                                        <Edit3 className="h-4 w-4" /> Hakkımda
                                    </h4>
                                    {editing ? (
                                        <Textarea
                                            value={profile.bio}
                                            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                                            rows={6}
                                            placeholder="Kendinizi tanıtın, yeteneklerinizden ve deneyimlerinizden bahsedin..."
                                            className="rounded-2xl font-medium text-base border-2 border-slate-100 p-6 shadow-inner bg-slate-50"
                                        />
                                    ) : (
                                        <div className="bg-slate-50/50 rounded-3xl p-8 border border-slate-50">
                                            <p className="text-slate-700 font-medium text-lg leading-relaxed italic">
                                                {profile.bio || "Üye henüz biyografisini doldurmamış."}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Skills Section */}
                                <div className="space-y-6">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center justify-center sm:justify-start gap-2">
                                        <TrendingUp className="h-4 w-4" /> Uzmanlık Alanları
                                    </h4>
                                    <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                                        {profile.skills.length > 0 ? profile.skills.map((skill) => (
                                            <div key={skill} className="group relative">
                                                <div className="bg-gradient-to-br from-slate-100 to-slate-200 text-slate-800 text-[10px] font-black uppercase px-6 py-2.5 rounded-2xl flex items-center gap-2 border border-white shadow-sm transition-all group-hover:shadow-md group-hover:translate-y-[-2px]">
                                                    {skill}
                                                    {editing && (
                                                        <button
                                                            onClick={() => removeSkill(skill)}
                                                            className="text-slate-400 hover:text-red-500 transition-colors font-black text-lg leading-none"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )) : (
                                            <p className="text-slate-400 text-xs italic">Henüz yetenek eklenmemiş.</p>
                                        )}
                                    </div>

                                    {editing && (
                                        <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                            <div className="relative flex-1">
                                                <Input
                                                    placeholder="Yeni yetenek ekle (örn: Photoshop)"
                                                    value={skillInput}
                                                    onChange={(e) => setSkillInput(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                                                    className="h-12 rounded-xl pl-4 pr-12 font-bold text-sm bg-slate-50 border-2 border-slate-100"
                                                />
                                                <Button
                                                    size="sm"
                                                    onClick={addSkill}
                                                    type="button"
                                                    className="absolute right-1.5 top-1.5 h-9 rounded-lg px-4 font-black"
                                                >
                                                    EKLE
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Location Editing Block (Hidden in view, only shown in edit) */}
                                {editing && (
                                    <div className="grid grid-cols-1 gap-8 pt-8 border-t border-slate-100">
                                        {/* Avatar Selection Block */}
                                        <div className="space-y-4">
                                            <Label className="text-[10px] font-black uppercase text-slate-400">Profil Resmi Ayarları</Label>

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                                <div className="space-y-3">
                                                    <Label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Resim URL</Label>
                                                    <div className="relative">
                                                        <Input
                                                            value={profile.avatarUrl}
                                                            onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })}
                                                            placeholder="Bir resim linki yapıştırın..."
                                                            className="h-12 rounded-xl font-bold bg-slate-50 border-2 border-slate-100 pl-10"
                                                        />
                                                        <Camera className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <Label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Hızlı Seçim (Önerilenler)</Label>
                                                    <div className="flex gap-3">
                                                        {[
                                                            "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&auto=format&fit=crop",
                                                            "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&auto=format&fit=crop",
                                                            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
                                                            "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop"
                                                        ].map((url, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => setProfile({ ...profile, avatarUrl: url })}
                                                                className={cn(
                                                                    "h-12 w-12 rounded-xl overflow-hidden border-2 transition-all hover:scale-110",
                                                                    profile.avatarUrl === url ? "border-emerald-500 shadow-lg scale-110" : "border-transparent opacity-60 hover:opacity-100"
                                                                )}
                                                            >
                                                                <img src={url} alt={`Preset ${idx}`} className="w-full h-full object-cover" />
                                                            </button>
                                                        ))}
                                                        <button
                                                            onClick={() => setProfile({ ...profile, avatarUrl: "" })}
                                                            className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 hover:bg-slate-200"
                                                            title="Resmi Kaldır"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-slate-400">Konum / Şehir</Label>
                                                <Input
                                                    value={profile.location}
                                                    onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                                                    className="h-12 rounded-xl font-bold bg-slate-50 border-2 border-slate-100"
                                                />
                                            </div>
                                            {isFreelancer && (
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black uppercase text-slate-400">Saatlik Ücret (₺)</Label>
                                                    <Input
                                                        value={profile.hourlyRate}
                                                        onChange={(e) => setProfile({ ...profile, hourlyRate: e.target.value })}
                                                        className="h-12 rounded-xl font-bold bg-slate-50 border-2 border-slate-100"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Additional Content Tabs (Gigs/Reviews) */}
                        <div className="space-y-8">
                            {isFreelancer && (
                                <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-slate-100 flex flex-col items-center w-full">
                                    <div className="w-full flex items-center justify-between mb-10 pb-4 border-b border-slate-50">
                                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                            <Briefcase className="h-5 w-5 text-blue-600" /> Hizmet İlanlarım (Gig)
                                        </h3>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-[10px] font-black uppercase tracking-widest rounded-xl border-blue-100 text-blue-600 px-6 h-10 hover:bg-blue-50"
                                            onClick={() => router.push("/post-gig")}
                                        >
                                            + YENİ GİG
                                        </Button>
                                    </div>

                                    {(function () {
                                        if (gigsLoading) {
                                            return (
                                                <div className="text-center py-16 border-4 border-dashed border-slate-50 rounded-[3rem] bg-slate-50/30 w-full">
                                                    <p className="text-slate-400 text-xs font-black uppercase">Yükleniyor...</p>
                                                </div>
                                            );
                                        }

                                        if (userGigs.length === 0) {
                                            return (
                                                <div className="text-center py-16 border-4 border-dashed border-slate-50 rounded-[3rem] bg-slate-50/30 w-full">
                                                    <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                                        <PlusIcon size={24} className="text-slate-200" />
                                                    </div>
                                                    <p className="text-slate-400 text-xs font-black uppercase">Henüz bir hizmet ilanınız yok.</p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                                                {userGigs.map((gig: any) => (
                                                    <div key={gig.id} className="hover:scale-[1.02] transition-transform duration-300">
                                                        <GigCard gig={{
                                                            id: gig.id,
                                                            title: gig.title,
                                                            description: gig.description,
                                                            category: gig.category,
                                                            price: gig.price,
                                                            createdAt: gig.created_at,
                                                            images: gig.images,
                                                            packages: gig.packages,
                                                            seller: user.username,
                                                            isActive: gig.is_active,
                                                        }} />

                                                        <div className="mt-4 flex gap-2">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                className="h-10 rounded-xl text-[10px] font-black uppercase tracking-widest"
                                                                onClick={() => toggleGigActive(gig.id, !gig.is_active)}
                                                            >
                                                                {gig.is_active ? "Pasife Al" : "Aktife Al"}
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                className="h-10 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-600 border-red-100 hover:bg-red-50"
                                                                onClick={() => deleteGig(gig.id)}
                                                            >
                                                                Kaldır
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {isEmployer && (
                                <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-slate-100 flex flex-col items-center w-full">
                                    <div className="w-full flex items-center justify-between mb-10 pb-4 border-b border-slate-50">
                                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                            <Briefcase className="h-5 w-5 text-orange-600" /> Yayınladığım İşler
                                        </h3>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-[10px] font-black uppercase tracking-widest rounded-xl border-orange-100 text-orange-600 px-6 h-10 hover:bg-orange-50"
                                            onClick={() => router.push("/post-job")}
                                        >
                                            + YENİ İŞ İLANI
                                        </Button>
                                    </div>

                                    {userJobs.length === 0 ? (
                                        <div className="text-center py-16 border-4 border-dashed border-slate-50 rounded-[3rem] bg-slate-50/30 w-full">
                                            <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                                <PlusIcon size={24} className="text-slate-200" />
                                            </div>
                                            <p className="text-slate-400 text-xs font-black uppercase">Henüz bir iş ilanı yayınlamadınız.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                                            {userJobs.map((job: any) => (
                                                <div key={job.id} className="hover:scale-[1.02] transition-transform duration-300">
                                                    <JobCard job={job} isOwner={true} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Reviews Section Card */}
                            <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-slate-100 flex flex-col items-center">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-10 pb-4 border-b border-slate-50 w-full flex items-center justify-center sm:justify-start gap-2">
                                    <Star className="h-5 w-5 text-amber-500 fill-amber-500" /> Müşteri Yorumları
                                </h3>

                                {reviews.length === 0 ? (
                                    <div className="text-center py-16 w-full">
                                        <div className="bg-slate-50 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <Star className="h-10 w-10 text-slate-100" />
                                        </div>
                                        <p className="text-xs font-black text-slate-300 uppercase">Bu profil için henüz değerlendirme yapılmamış.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6 w-full">
                                        {reviews.map((review) => (
                                            <div key={review.id} className="p-8 bg-slate-50/50 border border-slate-50 rounded-[2rem] transition-all hover:bg-white hover:shadow-xl group">
                                                <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 text-lg font-black shadow-inner">
                                                            {review.fromUser.charAt(0)}
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="font-black text-sm uppercase text-slate-900 leading-tight">{review.fromUser}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-1.5">
                                                                <Calendar className="h-3 w-3" /> {review.date}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1.5 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-50">
                                                        {[...Array(5)].map((_, j) => (
                                                            <Star key={j} className={`h-4 w-4 ${j < review.rating ? "fill-amber-400 text-amber-400" : "text-slate-100"}`} />
                                                        ))}
                                                    </div>
                                                </div>
                                                <p className="text-slate-700 font-medium text-base leading-relaxed italic relative">
                                                    <span className="text-slate-200 text-6xl absolute -top-8 -left-2 select-none">"</span>
                                                    {review.comment}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ACCOUNT DELETION UI */}
                            {!editing && (
                                <div className="mt-12 flex flex-col items-center">
                                    {!showDeleteConfirm ? (
                                        <Button
                                            variant="ghost"
                                            className="text-slate-300 hover:text-red-500 hover:bg-red-50 font-black text-[10px] uppercase tracking-[0.3em] transition-all py-8 rounded-[2rem] w-full border border-dashed border-transparent hover:border-red-100"
                                            onClick={() => setShowDeleteConfirm(true)}
                                        >
                                            🗑️ Hesabımı Kapatmak İstiyorum
                                        </Button>
                                    ) : (
                                        <div className="w-full bg-red-50 rounded-[3rem] p-10 space-y-6 text-center animate-in zoom-in-95 border-2 border-red-100">
                                            <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-100">
                                                <Trash2 className="h-8 w-8 text-red-500" />
                                            </div>
                                            <div className="space-y-2">
                                                <h4 className="text-sm font-black text-red-700 uppercase">HESAP SİLME TALEBİ</h4>
                                                <p className="text-[10px] font-bold text-red-600 uppercase">Bizi üzüyorsun Onur... Hesabını neden kapatmak istiyorsun?</p>
                                            </div>
                                            <Textarea
                                                placeholder="Buraya bir sebep yazabilirsin (isteğe bağlı)..."
                                                value={deletionReason}
                                                onChange={(e) => setDeletionReason(e.target.value)}
                                                className="rounded-2xl border-red-100 bg-white font-bold text-sm text-center p-6 h-32 focus-visible:ring-red-200"
                                            />
                                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                                <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase h-14 rounded-2xl shadow-xl hover:translate-y-[-2px] transition-all" onClick={requestDeletion}>
                                                    SİLMEYİ ONAYLA
                                                </Button>
                                                <Button variant="outline" className="flex-1 bg-white border-red-100 text-red-400 font-black text-xs uppercase h-14 rounded-2xl" onClick={() => setShowDeleteConfirm(false)}>
                                                    VAZGEÇ
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PlusIcon({ size, className }: { size: number, className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M5 12h14" />
            <path d="M12 5v14" />
        </svg>
    );
}
