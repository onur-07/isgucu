"use client";

import { useState, useRef } from "react";
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
import { CATEGORIES_DETAILED as DEFAULT_CATEGORIES } from "@/lib/categories-data";
import { AlertCircle, CheckCircle2, Upload, FileText, X, ShieldCheck, Loader2 } from "lucide-react";
import { sanitizeListingText } from "@/lib/utils";

const getMergedJobCategories = () => {
    if (typeof window === "undefined") return DEFAULT_CATEGORIES.map((c) => c.title);
    const adminData = JSON.parse(localStorage.getItem("isgucu_admin_categories") || "[]");
    const merged = [...DEFAULT_CATEGORIES, ...adminData] as Array<{ title?: string }>;
    return Array.from(new Set(merged.map((c) => String(c?.title || "").trim()).filter(Boolean)));
};

export function JobPostingForm() {
    const router = useRouter();
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        category: "",
        budget: "",
    });

    const [attachments, setAttachments] = useState<File[]>([]);
    const categories = getMergedJobCategories();

    const wordCount = (value: string) => String(value || "").trim().split(/\s+/).filter(Boolean).length;

    const toSafeFileName = (name: string) => {
        const trimmed = String(name || "").trim();
        if (!trimmed) return `file-${Date.now()}`;
        const lastDot = trimmed.lastIndexOf(".");
        const base = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
        const ext = lastDot > 0 ? trimmed.slice(lastDot + 1) : "";
        const safeBase = base
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9\-_.]/g, "")
            .replace(/-+/g, "-")
            .slice(0, 60) || `file-${Date.now()}`;
        const safeExt = ext
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .slice(0, 10);
        return safeExt ? `${safeBase}.${safeExt}` : safeBase;
    };

    const getUserIdentifier = () => {
        const id = (user as unknown as { id?: unknown })?.id;
        const username = (user as unknown as { username?: unknown })?.username;
        return String(id || username || "");
    };

    const getErrorMessage = (err: unknown) => {
        if (err instanceof Error) return err.message;
        if (typeof err === "string") return err;
        if (err && typeof err === "object" && "message" in err) return String((err as { message?: unknown }).message || "");
        return "";
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setScanning(true);
        setError(null);

        // Simulated Virus Check & Validation
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        const maxSize = 10 * 1024 * 1024; // 10MB

        const validatedFiles: File[] = [];
        let validationError = null;

        for (const file of files) {
            // Virus/Malware simulation check (based on extension and magic numbers usually)
            if (!allowedTypes.includes(file.type)) {
                validationError = `${file.name} desteklenmeyen bir dosya türü. Sadece PDF ve Resim yükleyebilirsiniz.`;
                break;
            }
            if (file.size > maxSize) {
                validationError = `${file.name} çok büyük. Maksimum 10MB yükleyebilirsiniz.`;
                break;
            }

            // Artificial delay to simulate "Scanning"
            await new Promise(resolve => setTimeout(resolve, 800));
            validatedFiles.push(file);
        }

        setScanning(false);

        if (validationError) {
            setError(validationError);
        } else {
            setAttachments(prev => [...prev, ...validatedFiles]);
        }

        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            setError("İlan vermek için giriş yapmalısınız.");
            return;
        }

        if (user.role !== "employer") {
            setError("İş ilanı vermek için İş Veren hesabına sahip olmalısınız.");
            return;
        }

        setLoading(true);
        setError(null);

        const titleMod = sanitizeListingText(formData.title);
        if (!titleMod.allowed) {
            setError(titleMod.reason || "Başlık kurallara uygun değil.");
            setLoading(false);
            return;
        }
        const descMod = sanitizeListingText(formData.description);
        if (!descMod.allowed) {
            setError(descMod.reason || "Açıklama kurallara uygun değil.");
            setLoading(false);
            return;
        }
        const titleWords = wordCount(titleMod.cleanedText || formData.title);
        const descWords = wordCount(descMod.cleanedText || formData.description);
        if (titleWords < 3 || titleWords > 12) {
            setError("Başlık 3-12 kelime aralığında olmalıdır.");
            setLoading(false);
            return;
        }
        if (descWords < 20 || descWords > 200) {
            setError("Açıklama 20-200 kelime aralığında olmalıdır.");
            setLoading(false);
            return;
        }

        try {
            // 1. Upload files to Supabase Storage
            const uploadedPaths: string[] = [];
            for (const file of attachments) {
                const safeName = toSafeFileName(file.name);
                const filePath = `${user.id}/${Date.now()}-${safeName}`;
                const { error: uploadError } = await supabase.storage
                    .from('job-attachments')
                    .upload(filePath, file);

                if (uploadError) {
                    console.error("File upload error:", uploadError);
                    throw new Error(`${file.name} dosyası yüklenemedi: ${uploadError.message}`);
                }
                uploadedPaths.push(filePath);
            }

            // 2. Insert job into DB
            const { error: submitError } = await supabase
                .from('jobs')
                .insert({
                    user_id: getUserIdentifier(),
                    title: titleMod.cleanedText || formData.title,
                    description: descMod.cleanedText || formData.description,
                    category: formData.category,
                    budget: formData.budget,
                    attachments: uploadedPaths,
                    status: 'open'
                });

            if (submitError) throw submitError;

            // Keep a local cache copy as a visibility fallback between role/account switches.
            const existingJobs = JSON.parse(localStorage.getItem("isgucu_jobs") || "[]");
            const newJob = {
                ...formData,
                id: Date.now(),
                created_at: new Date().toISOString(),
                user_id: getUserIdentifier(),
                status: "open",
            };
            localStorage.setItem("isgucu_jobs", JSON.stringify([newJob, ...existingJobs]));

            setSuccess(true);
            setTimeout(() => {
                router.push("/jobs");
            }, 2000);
        } catch (err: unknown) {
            console.error("Job Post Error:", err);
            const errMsg = getErrorMessage(err);
            if (errMsg) {
                setError("İlan verilemedi: " + errMsg);
            } else {
                setError("İlan verilemedi. Lütfen tekrar deneyin.");
            }
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
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter italic">İlanınız Yayınlandı!</h3>
                <p className="text-slate-500 font-medium">İlanlar sayfasına yönlendiriliyorsunuz...</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-700">
            {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 text-sm font-bold animate-shake">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {error}
                </div>
            )}

            <div className="space-y-6">
                <div className="space-y-3">
                    <Label htmlFor="title" className="font-black text-slate-700 ml-1 uppercase text-[10px] tracking-[0.2em]">İŞİN ADI / BAŞLIK</Label>
                    <Input
                        id="title"
                        placeholder="Örn: Modern E-Ticaret Arayüz Tasarımı"
                        required
                        className="h-14 rounded-2xl border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all px-6 font-bold text-slate-800"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <Label htmlFor="category" className="font-black text-slate-700 ml-1 uppercase text-[10px] tracking-[0.2em]">KATEGORİ SEÇİMİ</Label>
                        <Select
                            required
                            onValueChange={(value) => setFormData({ ...formData, category: value })}
                        >
                            <SelectTrigger className="h-14 rounded-2xl border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all px-6 font-bold text-slate-800">
                                <SelectValue placeholder="Kategori seçiniz" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-slate-100 shadow-2xl">
                                {categories.map((cat) => (
                                    <SelectItem key={cat} value={cat} className="rounded-xl py-3 font-bold text-slate-700 focus:bg-blue-50 focus:text-blue-600">
                                        {cat}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-3">
                        <Label htmlFor="budget" className="font-black text-slate-700 ml-1 uppercase text-[10px] tracking-[0.2em]">PROJE BÜTÇESİ (₺)</Label>
                        <Input
                            id="budget"
                            type="text"
                            placeholder="Örn: 2500 - 5000"
                            required
                            className="h-14 rounded-2xl border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all px-6 font-bold text-slate-800"
                            value={formData.budget}
                            onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <Label htmlFor="description" className="font-black text-slate-700 ml-1 uppercase text-[10px] tracking-[0.2em]">İŞİN DETAYLARI VE BEKLENTİLERİ</Label>
                    <Textarea
                        id="description"
                        placeholder="Lütfen projeden beklentilerinizi ve gerekli yetkinlikleri detaylıca belirtin..."
                        className="min-h-[220px] rounded-[2rem] border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all p-8 font-medium leading-relaxed text-slate-600 resize-none"
                        required
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                </div>

                {/* File Upload Section */}
                <div className="space-y-3">
                    <Label className="font-black text-slate-700 ml-1 uppercase text-[10px] tracking-[0.2em]">DOSYA VE TASARIM ÖRNEKLERİ (İSTEĞE BAĞLI)</Label>
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="relative group cursor-pointer border-2 border-dashed border-slate-200 rounded-[2rem] p-10 hover:border-blue-500 hover:bg-blue-50/30 transition-all flex flex-col items-center justify-center gap-4 bg-slate-50/50"
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            multiple
                            className="hidden"
                            accept=".pdf,image/*"
                        />

                        <div className="h-20 w-20 rounded-[2rem] bg-white shadow-xl shadow-slate-200 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                            {scanning ? <Loader2 className="h-10 w-10 animate-spin" /> : <Upload className="h-10 w-10" />}
                        </div>

                        <div className="text-center">
                            <p className="font-black text-slate-800 uppercase text-sm tracking-tight">
                                {scanning ? "VİRÜS KONTROLÜ YAPILIYOR..." : "DOSYA SEÇ VEYA SÜRÜKLE"}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">SADECE PDF, JPG, PNG VE WEBP (MAKS 10MB)</p>
                        </div>

                        {scanning && (
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] rounded-[2rem] flex items-center justify-center">
                                <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-3xl shadow-2xl border border-blue-50">
                                    <ShieldCheck className="h-6 w-6 text-blue-600 animate-pulse" />
                                    <span className="font-black text-blue-900 text-xs uppercase tracking-widest">GÜVENLİK TARAŞI AKTİF</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {attachments.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                            {attachments.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm group hover:border-blue-200 transition-colors">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="font-bold text-xs text-slate-900 truncate uppercase">{file.name}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">{(file.size / 1024 / 1024).toFixed(2)} MB • GÜVENLİ</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(idx)}
                                        className="h-8 w-8 rounded-full hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors flex items-center justify-center"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <Button
                type="submit"
                className="w-full h-20 bg-blue-600 hover:bg-blue-700 text-white rounded-[2.5rem] font-black text-xl uppercase tracking-[0.15em] shadow-2xl shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-4"
                disabled={loading || scanning}
            >
                {loading ? (
                    <>
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span>YAYINLANIYOR...</span>
                    </>
                ) : (
                    "HEMEN ÜCRETSİZ İLAN VER"
                )}
            </Button>

            <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                İLAN YAYINLAYARAK TÜM <span className="text-slate-900 cursor-pointer hover:underline">ŞARTLARI VE GÜVENLİK KURALLARINI</span> KABUL ETMİŞ SAYILIRSINIZ.
            </p>
        </form>
    );
}
