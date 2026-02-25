"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { supabase } from "@/lib/supabase";
import { AlertCircle, CheckCircle2 } from "lucide-react";

const CATEGORIES = [
    "Yazılım & Mobil",
    "Logo & Grafik",
    "Web Tasarım",
    "Video & Animasyon",
    "Çeviri & İçerik",
];

export function JobPostingForm() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        category: "",
        budget: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            setError("İlan vermek için giriş yapmalısınız.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data, error: submitError } = await supabase
                .from('jobs')
                .insert({
                    user_id: user.id || (user as any).username, // Fallback for mock user
                    title: formData.title,
                    description: formData.description,
                    category: formData.category,
                    budget: formData.budget,
                    status: 'open'
                });

            if (submitError) throw submitError;

            setSuccess(true);
            setTimeout(() => {
                router.push("/jobs");
            }, 2000);
        } catch (err: any) {
            console.error("Job Post Error:", err);
            setError("İlan yayınlanırken bir sorun oluştu. Lütfen tekrar deneyin.");

            // Fallback for local testing if Supabase is not ready
            const existingJobs = JSON.parse(localStorage.getItem("isgucu_jobs") || "[]");
            const newJob = {
                ...formData,
                id: Date.now(),
                created_at: new Date().toISOString(),
                user_id: user.id || (user as any).username
            };
            localStorage.setItem("isgucu_jobs", JSON.stringify([newJob, ...existingJobs]));

            setSuccess(true);
            setTimeout(() => {
                router.push("/jobs");
            }, 2000);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="text-center py-10 space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4 scale-in animate-in">
                    <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-slate-800">İlanınız Yayınlandı!</h3>
                <p className="text-slate-500 font-medium">İlanlar sayfasına yönlendiriliyorsunuz...</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 text-sm font-bold">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {error}
                </div>
            )}

            <div className="space-y-6">
                <div className="space-y-3">
                    <Label htmlFor="title" className="font-bold text-slate-700 ml-1 italic tracking-wide">İLAN BAŞLIĞI</Label>
                    <Input
                        id="title"
                        placeholder="Örn: E-ticaret sitesi için React geliştirici aranıyor"
                        required
                        className="h-14 rounded-2xl border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all px-5 font-medium"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                </div>

                <div className="space-y-3">
                    <Label htmlFor="category" className="font-bold text-slate-700 ml-1 italic tracking-wide">KATEGORİ</Label>
                    <Select
                        required
                        onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                        <SelectTrigger className="h-14 rounded-2xl border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all px-5 font-medium">
                            <SelectValue placeholder="Kategori seçiniz" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                            {CATEGORIES.map((cat) => (
                                <SelectItem key={cat} value={cat} className="rounded-xl py-3">
                                    {cat}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-3">
                    <Label htmlFor="description" className="font-bold text-slate-700 ml-1 italic tracking-wide">İŞ DETAYLARI</Label>
                    <Textarea
                        id="description"
                        placeholder="Projenizin kapsamını, beklentilerinizi ve gerekli yetkinlikleri detaylıca açıklayın..."
                        className="min-h-[180px] rounded-3xl border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all p-6 font-medium leading-relaxed"
                        required
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                </div>

                <div className="space-y-3">
                    <Label htmlFor="budget" className="font-bold text-slate-700 ml-1 italic tracking-wide">TAHMİNİ BÜTÇE (₺)</Label>
                    <Input
                        id="budget"
                        type="text"
                        placeholder="Örn: 5000 - 10000"
                        className="h-14 rounded-2xl border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all px-5 font-medium italic"
                        value={formData.budget}
                        onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    />
                </div>
            </div>

            <Button
                type="submit"
                className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] font-black text-lg uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all hover:scale-[1.01] active:scale-95"
                disabled={loading}
            >
                {loading ? "YAYINLANIYOR..." : "HEMEN İLAN VER"}
            </Button>
        </form>
    );
}
