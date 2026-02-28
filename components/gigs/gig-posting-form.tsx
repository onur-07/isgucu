"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ImagePlus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { sanitizeListingText } from "@/lib/utils";
import {
    CATEGORIES_DETAILED as DEFAULT_CATEGORIES,
    SUB_CATEGORIES_DATA as DEFAULT_SUB_CATEGORIES,
    SERVICE_TYPES_DATA as DEFAULT_SERVICE_TYPES
} from "@/lib/categories-data";

// These are now handled by local state or shared lib to allow admin edits
// We create helper functions to get the merged data
const getMergedCategories = () => {
    if (typeof window === "undefined") return DEFAULT_CATEGORIES;
    const adminData = JSON.parse(localStorage.getItem("isgucu_admin_categories") || "[]");
    return [...DEFAULT_CATEGORIES, ...adminData];
};

const getMergedSubCategories = () => {
    if (typeof window === "undefined") return DEFAULT_SUB_CATEGORIES;
    const adminData = JSON.parse(localStorage.getItem("isgucu_admin_subcategories") || "{}");
    const merged = { ...DEFAULT_SUB_CATEGORIES };
    Object.keys(adminData).forEach(cat => {
        merged[cat] = [...(merged[cat] || []), ...adminData[cat]];
    });
    return merged;
};

const getMergedServiceTypes = () => {
    if (typeof window === "undefined") return DEFAULT_SERVICE_TYPES;
    const adminData = JSON.parse(localStorage.getItem("isgucu_admin_servicetypes") || "{}");
    const merged = { ...DEFAULT_SERVICE_TYPES };
    Object.keys(adminData).forEach(sub => {
        merged[sub] = [...(merged[sub] || []), ...adminData[sub]];
    });
    return merged;
};

const buildServiceTypeFallback = (subCategory: string) => {
    const safeSub = String(subCategory || "Hizmet").trim() || "Hizmet";
    return [
        `${safeSub} Dan\u0131\u015fmanl\u0131\u011f\u0131`,
        `${safeSub} \u00d6zel Projesi`,
        `${safeSub} Teknik Deste\u011fi`,
        `${safeSub} Analiz ve Raporlama`,
    ];
};

const getServiceTypesForSubCategory = (subCategory: string) => {
    const merged = getMergedServiceTypes();
    const direct = merged[subCategory];
    if (Array.isArray(direct) && direct.length > 0) return direct;
    return buildServiceTypeFallback(subCategory);
};


const CATEGORY_ADDONS: Record<string, ExtraItem[]> = {
    yazilim: [
        { id: "fast_delivery", title: "Süper Hızlı Teslimat (24 Saat)", price: "1500", additionalDays: "1", selected: false },
        { id: "maintenance_3", title: "3 Aylık Teknik Bakım & Destek", price: "5000", additionalDays: "0", selected: false },
        { id: "source_code", title: "Tüm Kaynak Kodların Teslimi", price: "2000", additionalDays: "0", selected: false },
        { id: "hosting_setup", title: "Sunucu ve Domain Kurulumu", price: "750", additionalDays: "1", selected: false },
    ],
    grafik: [
        { id: "fast_delivery", title: "Ekspres Teslimat (12 Saat)", price: "750", additionalDays: "1", selected: false },
        { id: "brand_guide", title: "Kurumsal Marka Rehberi (PDF)", price: "1250", additionalDays: "2", selected: false },
        { id: "social_media", title: "Sosyal Medya Görsel Uyarlamaları", price: "500", additionalDays: "1", selected: false },
        { id: "print_ready", title: "Baskıya Hazır Format Hazırlığı", price: "300", additionalDays: "0", selected: false },
    ],
    is: [
        { id: "fast_process", title: "Acil İşlem (Öncelikli)", price: "1000", additionalDays: "0", selected: false },
        { id: "live_consulting", title: "Ekstra 1 Saat Zoom Danışmanlığı", price: "1500", additionalDays: "0", selected: false },
        { id: "custom_doc", title: "Özel Antetli Kağıt Tasarımı", price: "500", additionalDays: "1", selected: false },
    ],
    ses: [
        { id: "fast_delivery", title: "Süper Hızlı Teslimat", price: "500", additionalDays: "1", selected: false },
        { id: "redaksiyon", title: "Redaksiyon", price: "300", additionalDays: "1", selected: false },
        { id: "telif", title: "Telif Hakları", price: "1000", additionalDays: "0", selected: false },
        { id: "yayin", title: "Yayın Hakları", price: "2000", additionalDays: "0", selected: false },
        { id: "wav", title: "HQ Ses Dosyası (WAV)", price: "100", additionalDays: "0", selected: false },
        { id: "sync", title: "Senkronize Seslendirme (Her 60 S)", price: "500", additionalDays: "1", selected: false },
        { id: "bg_music", title: "Fon Müziği", price: "250", additionalDays: "0", selected: false },
        { id: "split", title: "Bölünmüş Dosya (5 Parçaya Kadar)", price: "150", additionalDays: "0", selected: false },
        { id: "extra_rev", title: "Ekstra Revizyon", price: "200", additionalDays: "1", selected: false },
    ],
};

const CATEGORY_EXTRAS: Record<string, { label: string, key: string, type: "select" | "toggle" | "input", options?: unknown[] }[]> = {
    // Software Sub-categories
    "Web Yazılım": [
        { label: "Sayfa Sayısı", key: "pageCount", type: "select", options: [1, 2, 3, 5, 10, 15, 20, 30] },
        { label: "Veritabanı Entegrasyonu", key: "dbIntegration", type: "toggle" },
        { label: "Admin Paneli", key: "adminPanel", type: "toggle" },
        { label: "E-Ticaret Özellikleri", key: "ecommerce", type: "toggle" },
        { label: "SEO Uyumluluk", key: "seoReady", type: "toggle" },
        { label: "API Entegrasyonu", key: "apiCount", type: "select", options: [0, 1, 2, 3, 5] },
        { label: "Responsive (Mobil) Dizayn", key: "responsive", type: "toggle" },
    ],
    "Mobil Uygulama": [
        { label: "Ekran Sayısı", key: "screens", type: "select", options: [3, 5, 10, 15, 25] },
        { label: "iOS & Android (Cross)", key: "crossPlatform", type: "toggle" },
        { label: "Mağaza Yayını", key: "storeApp", type: "toggle" },
        { label: "Push Bildirimleri", key: "pushNotif", type: "toggle" },
        { label: "Üyelik Sistemi", key: "authSystem", type: "toggle" },
        { label: "Uygulama İçi Satın Alma", key: "inAppPurchase", type: "toggle" },
    ],
    // Design Sub-categories
    "Logo Tasarımı": [
        { label: "Konsept Sayısı", key: "concepts", type: "select", options: [1, 2, 3, 4, 5] },
        { label: "Vektörel Format (AI/EPS)", key: "vector", type: "toggle" },
        { label: "Logo Transparanlık", key: "transparent", type: "toggle" },
        { label: "3D Mockup Sunumu", key: "mockup3d", type: "toggle" },
        { label: "Sosyal Medya Kit", key: "socialKit", type: "toggle" },
        { label: "Brand Guide", key: "brandGuide", type: "toggle" },
    ],
    "Kurumsal Kimlik": [
        { label: "Materyal Sayısı", key: "materials", type: "select", options: [3, 5, 8, 12] },
        { label: "Kartvizit Tasarımı", key: "bizCard", type: "toggle" },
        { label: "Antetli Kağıt/Zarf", key: "envelope", type: "toggle" },
        { label: "Dijital Katalog", key: "catalog", type: "toggle" },
    ],
    // Business Sub-categories
    "Hukuki Danışmanlık": [
        { label: "İnceleme Saati", key: "reviewHours", type: "select", options: [1, 2, 3, 5, 10] },
        { label: "Dilekçe Yazımı", key: "petition", type: "toggle" },
        { label: "Sözleşme Hazırlama", key: "contract", type: "toggle" },
        { label: "KVKK Uyumluluk Raporu", key: "kvkk", type: "toggle" },
        { label: "Resmi Onay/Mühür Yardımı", key: "officialStamp", type: "toggle" },
    ],
    "Yazılım Danışmanlığı": [
        { label: "Görüşme Saati", key: "meetingHours", type: "select", options: [1, 2, 4, 8] },
        { label: "Mimari Analiz Raporu", key: "archReport", type: "toggle" },
        { label: "Kod İnceleme (Review)", key: "codeReview", type: "toggle" },
        { label: "Teknoloji Seçimi", key: "techStack", type: "toggle" },
    ],
    "Seslendirme": [
        { label: "Kelime Sayısı", key: "wordCount", type: "input" },
        { label: "Arka Plan Müziği", key: "bgMusic", type: "toggle" },
        { label: "Mixing & Mastering", key: "mixMast", type: "toggle" },
        { label: "HQ Ses Dosyası (WAV)", key: "hqFile", type: "toggle" },
        { label: "Ticari Kullanım Hakları", key: "commercial", type: "toggle" },
        { label: "Tam Yayın Hakları", key: "broadcast", type: "toggle" },
    ],
    // Generic Category Fallbacks
    yazilim: [
        { label: "Dosya Sayısı", key: "files", type: "select", options: [1, 2, 5, 10] },
        { label: "Kurulum Desteği", key: "setupSupport", type: "toggle" },
    ],
    grafik: [
        { label: "Revizyon Sayısı", key: "revisions_extra", type: "select", options: [1, 2, 3, 5] },
        { label: "Kaynak Dosya", key: "sourceFile", type: "toggle" },
    ],
    yazi: [
        { label: "Kelime Sayısı", key: "wordCount", type: "select", options: [500, 1000, 2000, 5000] },
        { label: "SEO Anahtar Kelime", key: "keywords", type: "select", options: [1, 3, 5, 10] },
        { label: "Araştırma", key: "research", type: "toggle" },
        { label: "Özgünlük Raporu", key: "plagiarism", type: "toggle" },
    ],
    video: [
        { label: "Süre (Dakika)", key: "duration_v", type: "select", options: [1, 2, 3, 5, 10, 20] },
        { label: "Alt Yazı (Subtitle)", key: "subtitles", type: "toggle" },
        { label: "Seslendirme", key: "voice", type: "toggle" },
        { label: "Özel Müzik/SFX", key: "music", type: "toggle" },
        { label: "4K Çözünürlük", key: "resolution", type: "toggle" },
    ],
    ses: [
        { label: "Süre (Dakika)", key: "duration_s", type: "select", options: [1, 2, 5, 15, 30] },
        { label: "Arka Plan Müziği", key: "bgMusic", type: "toggle" },
        { label: "Mixing & Mastering", key: "mixMast", type: "toggle" },
        { label: "HQ Wave Dosyası", key: "hqFile", type: "toggle" },
    ],
    reklam: [
        { label: "Yönetim Gün Sayısı", key: "manageDays", type: "select", options: [7, 14, 30, 60] },
        { label: "Reklam Seti Sayısı", key: "adSets", type: "select", options: [1, 2, 3, 5] },
        { label: "Raporlama", key: "report_r", type: "toggle" },
        { label: "Pixel/Etiket Kurulumu", key: "pixel", type: "toggle" },
    ],
    is: [
        { label: "Çalışma Saati", key: "workHours", type: "select", options: [1, 2, 5, 10, 20] },
        { label: "Dokümantasyon", key: "documentation", type: "toggle" },
        { label: "Sunum Hazırlama", key: "slides", type: "toggle" },
    ],
};

interface PackageData {
    name: string;
    description: string;
    price: string;
    deliveryDays: string;
    revisions: string;
    features: string[];
    // Dynamic fields
    [key: string]: unknown;
}

interface ExtraItem {
    id: string;
    title: string;
    price: string;
    additionalDays: string;
    selected: boolean;
    isCustom?: boolean;
}

const emptyPackage = (name: string): PackageData => {
    void name;
    return {
    name: "",
    description: "",
    price: "",
    deliveryDays: "",
    revisions: "1",
    features: [],
    };
};

const numberToTurkishWords = (num: number): string => {
    if (num === 0) return "Sıfır";
    const units = ["", "Bir", "İki", "Üç", "Dört", "Beş", "Altı", "Yedi", "Sekiz", "Dokuz"];
    const tens = ["", "On", "Yirmi", "Otuz", "Kırk", "Elli", "Altmış", "Yetmiş", "Seksen", "Doksan"];

    const convertUnderThousand = (n: number) => {
        let res = "";
        if (n >= 100) {
            res += (n >= 200 ? units[Math.floor(n / 100)] : "") + "Yüz";
            n %= 100;
        }
        if (n >= 10) {
            res += tens[Math.floor(n / 10)];
            n %= 10;
        }
        if (n > 0) res += units[n];
        return res;
    };

    let result = "";
    if (num >= 1000) {
        const thousands = Math.floor(num / 1000);
        result += (thousands > 1 ? convertUnderThousand(thousands) : "") + "Bin";
        num %= 1000;
    }
    result += convertUnderThousand(num);
    return result + " Türk Lirası";
};

const formatNumberWithDots = (val: string) => {
    if (!val) return "";
    return parseInt(val).toLocaleString("tr-TR");
};

const VOICE_OPTIONS = {
    gender: ["Erkek", "Kadın"],
    language: ["Türkçe", "İngilizce", "Almanca", "Fransızca", "Arapça", "Rusça", "İspanyolca", "İtalyanca", "Çince", "Japonca", "Korece", "Azerice", "Diğer Diller"],
    usage: ["Reklam", "Dublaj", "E-Kitap", "Santral (IVR)", "Youtube", "Haber", "Oyun", "Belgesel", "Eğitim", "Meditasyon", "Animasyon", "Anons"],
    age: ["Çocuk (5-12)", "Genç (13-20)", "Yetişkin (21-50)", "Yaşlı (50+)"],
    tone: ["Alaycı", "Beceriksiz", "Çekici", "Dramatik", "Duygusal", "Eğlenceli", "Enerjik", "Gündelik", "Güvenilir", "Kızgın", "Korkutucu", "Kurumsal", "Sakinleştirici", "Sert", "Sevimli"]
};

export function GigPostingForm() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [step]);

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        category: "",
        subCategory: "",
        serviceType: "",
        tags: [] as string[],
        images: [] as string[],
        voiceDetails: {
            activeTab: "gender",
            gender: "Erkek",
            language: ["Türkçe"] as string[],
            usage: [] as string[],
            age: "Yetişkin (21-50)",
            tone: ["Kurumsal"] as string[],
            otherLanguageInput: ""
        }
    });

    useEffect(() => {
        if (!formData.serviceType) return;
        setFormData((prev) => {
            if (prev.title.trim()) return prev;
            return { ...prev, title: `${prev.serviceType} yapıyorum` };
        });
    }, [formData.serviceType]);

    const [activePackages, setActivePackages] = useState<Record<string, boolean>>({
        basic: true,
        standard: false,
        premium: false,
    });

    const [packages, setPackages] = useState<Record<string, PackageData>>({
        basic: emptyPackage("Temel"),
        standard: emptyPackage("Standart"),
        premium: emptyPackage("Pro"),
    });

    const [extras, setExtras] = useState<ExtraItem[]>([]);

    useEffect(() => {
        if (formData.category && CATEGORY_ADDONS[formData.category]) {
            setExtras(CATEGORY_ADDONS[formData.category]);
        } else {
            setExtras([
                { id: "fast_delivery", title: "Süper Hızlı Teslimat", price: "500", additionalDays: "1", selected: false },
                { id: "extra_revision", title: "Ekstra Revizyon", price: "200", additionalDays: "1", selected: false },
            ]);
        }
    }, [formData.category]);

    const [tagInput, setTagInput] = useState("");

    const sanitizeGigTitle = (value: string) => value.replace(/^ben,\s*/i, "").trimStart();

    const wordCount = (value: string) => String(value || "").trim().split(/\s+/).filter(Boolean).length;

    const getErrorMessage = (err: unknown) => {
        if (err instanceof Error) return err.message;
        if (typeof err === "string") return err;
        if (err && typeof err === "object" && "message" in err) return String((err as { message?: unknown }).message || "");
        return "";
    };

    const activePackageKeys = (["basic", "standard", "premium"] as const).filter((key) => activePackages[key]);

    const isStep3Valid = () => {
        const baseValid =
            formData.title.trim().length >= 10 &&
            formData.description.trim().length >= 30 &&
            formData.tags.length > 0;

        if (!baseValid) return false;

        if (formData.subCategory === "Seslendirme") {
            return (
                formData.voiceDetails.language.length > 0 &&
                formData.voiceDetails.usage.length > 0 &&
                formData.voiceDetails.tone.length > 0
            );
        }

        return true;
    };

    const isPackageComplete = (pkg: PackageData, key: "basic" | "standard" | "premium") => {
        if (formData.subCategory === "Seslendirme" && key === "basic") {
            return Boolean(
                pkg.wordCount &&
                pkg.extraWordCount &&
                pkg.extraWordPrice &&
                pkg.deliveryDays &&
                pkg.revisions &&
                pkg.price &&
                parseInt(pkg.price, 10) >= 100
            );
        }

        return Boolean(
            pkg.name.trim() &&
            pkg.description.trim() &&
            pkg.deliveryDays &&
            pkg.revisions &&
            pkg.features.length > 0 &&
            pkg.price &&
            parseInt(pkg.price, 10) >= 100
        );
    };

    const areExtrasValid = () =>
        extras
            .filter((ex) => ex.selected)
            .every((ex) => ex.title.trim() && ex.price && ex.additionalDays !== "");

    const isStep4Valid = () => activePackageKeys.every((key) => isPackageComplete(packages[key], key)) && areExtrasValid();

    const isStep5Valid = () => formData.images.length > 0;

    const getValidationMessage = () => {
        if (!formData.category) return "Kategori seçimi zorunludur.";
        if (!formData.subCategory || !formData.serviceType) return "Alt kategori ve hizmet türü seçimi zorunludur.";
        if (!isStep3Valid()) return "Genel bilgiler bölümündeki tüm zorunlu alanları doldurun (başlık, açıklama, en az 1 etiket).";
        if (!isStep4Valid()) return "Paket ve ekstra alanlarındaki tüm zorunlu bilgileri eksiksiz doldurun.";
        if (!isStep5Valid()) return "En az 1 görsel yüklemek zorunludur.";
        return "";
    };

    const addTag = () => {
        if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
            setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
            setTagInput("");
        }
    };

    const removeTag = (tag: string) => {
        setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
    };

    const addNewExtra = () => {
        const newExtra: ExtraItem = {
            id: `custom_${Date.now()}`,
            title: "",
            price: "50",
            additionalDays: "1",
            selected: true,
            isCustom: true
        };
        setExtras(prev => [...prev, newExtra]);
    };

    const removeCustomExtra = (id: string) => {
        setExtras(prev => prev.filter(e => e.id !== id));
    };


    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    setFormData(prev => ({
                        ...prev,
                        images: [...prev.images, ev.target!.result as string].slice(0, 5)
                    }));
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const removeImage = (idx: number) => {
        setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (user?.role !== "freelancer") {
            alert("Hizmet ilanı vermek için Freelancer hesabına sahip olmalısınız.");
            return;
        }

        const validationMessage = getValidationMessage();
        if (validationMessage) {
            alert(validationMessage);
            return;
        }

        const titleValue = sanitizeGigTitle(formData.title);
        const titleMod = sanitizeListingText(titleValue);
        if (!titleMod.allowed) {
            alert(titleMod.reason || "Başlık kurallara uygun değil.");
            return;
        }
        const descMod = sanitizeListingText(formData.description);
        if (!descMod.allowed) {
            alert(descMod.reason || "Açıklama kurallara uygun değil.");
            return;
        }
        const titleWords = wordCount(titleMod.cleanedText || titleValue);
        const descWords = wordCount(descMod.cleanedText || formData.description);
        if (titleWords < 2 || titleWords > 12) {
            alert("Baslik 2-12 kelime araliginda olmalidir.");
            return;
        }
        if (descWords < 20 || descWords > 200) {
            alert("Açıklama 20-200 kelime aralığında olmalıdır.");
            return;
        }
        setLoading(true);
        const activePks: Record<string, PackageData> = {};
        Object.keys(activePackages).forEach(key => {
            if (activePackages[key]) {
                activePks[key] = packages[key];
            }
        });

        const selectedExtras = extras
            .filter((ex) => ex.selected)
            .map((ex) => ({
                title: ex.title,
                price: ex.price,
                additionalDays: ex.additionalDays,
            }));

        const packagesPayload: Record<string, unknown> = {
            ...activePks,
            _extras: selectedExtras,
        };

        try {
            if (!user?.id) {
                throw new Error("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
            }

            const withTimeout = async <T,>(p: PromiseLike<T>, ms: number, label: string): Promise<T> => {
                let timeoutId: ReturnType<typeof setTimeout> | undefined;
                try {
                    return await Promise.race([
                        Promise.resolve(p),
                        new Promise<T>((_, reject) => {
                            timeoutId = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
                        }),
                    ]);
                } finally {
                    if (timeoutId) clearTimeout(timeoutId);
                }
            };

            const TIMEOUT_MS = 12000;
            const insertRes = (await withTimeout(
                supabase
                    .from("gigs")
                    .insert({
                        user_id: user.id,
                        title: titleMod.cleanedText || titleValue,
                        description: descMod.cleanedText || formData.description,
                        category: formData.category,
                        price: packages.basic.price,
                        is_active: true,
                        images: formData.images,
                        packages: packagesPayload,
                    }),
                TIMEOUT_MS,
                "gig_insert"
            )) as unknown;

            const error = (insertRes && typeof insertRes === "object" && "error" in insertRes)
                ? (insertRes as { error?: unknown }).error
                : null;

            if (error) {
                throw error;
            }

            router.push("/freelancers");
        } catch (err: unknown) {
            console.error("Gig oluşturma hatası:", err);
            const msg = getErrorMessage(err) || "Bilinmeyen hata";
            if (msg.startsWith("timeout:")) {
                alert("İlan kaydı zaman aşımına uğradı. İnternet bağlantınızı kontrol edin ve tekrar deneyin.");
            } else {
                alert("İlan kaydedilemedi: " + msg + "\n\nNot: Supabase RLS policy INSERT izni vermiyor olabilir.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            {/* Step Indicator */}
            <div className="flex items-center justify-between gap-2 mb-12 overflow-x-auto pb-4 no-scrollbar">
                {[
                    { n: 1, label: "Kategori" },
                    { n: 2, label: "Alt Kategori" },
                    { n: 3, label: "Genel Bilgiler" },
                    { n: 4, label: "Paketler & Fiyatlar" },
                    { n: 5, label: "Görseller" },
                ].map((s) => (
                    <button
                        key={s.n}
                        type="button"
                        onClick={() => {
                            if (step > s.n || (s.n === 2 && formData.category) || (s.n === 3 && formData.subCategory && formData.serviceType)) {
                                setStep(s.n);
                            }
                        }}
                        className={`flex flex-col items-center gap-2 min-w-[100px] transition-all ${step === s.n ? "opacity-100" : "opacity-60"}`}
                    >
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step === s.n
                            ? "bg-blue-600 text-white ring-4 ring-blue-100"
                            : step > s.n
                                ? "bg-green-500 text-white"
                                : "bg-gray-200 text-gray-500"
                            }`}>
                            {step > s.n ? "✓" : s.n}
                        </div>
                        <span className={`text-[11px] font-black uppercase tracking-wider whitespace-nowrap ${step === s.n ? "text-blue-600" : "text-gray-400"}`}>{s.label}</span>
                    </button>
                ))}
            </div>

            {/* STEP 1: Category Selection */}
            {step === 1 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center mb-12">
                        <h3 className="text-3xl font-black text-gray-900 font-heading tracking-tight mb-2">Hangi Hizmeti Sunuyorsun?</h3>
                        <p className="text-black font-black">Sana en uygun kategoriyi seçerek başla.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {getMergedCategories().map((cat) => (
                            <div
                                key={cat.id}
                                onClick={() => {
                                    setFormData(prev => ({ ...prev, category: cat.id }));
                                    setStep(2);
                                }}
                                className={`group cursor-pointer p-8 rounded-[2.5rem] bg-white border-4 transition-all hover:shadow-2xl hover:-translate-y-2 ${formData.category === cat.id ? "border-blue-600 bg-blue-50/10 shadow-xl" : "border-gray-100 hover:border-blue-200"}`}
                            >
                                <div className={`h-20 w-20 ${cat.color} rounded-[1.5rem] flex items-center justify-center text-4xl mb-6 shadow-inner group-hover:scale-110 transition-transform`}>
                                    {cat.icon}
                                </div>
                                <h4 className="text-xl font-black text-gray-900 mb-2">{cat.title}</h4>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* STEP 2: Sub-category Panel */}
            {step === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 max-w-5xl mx-auto">
                    {/* Category Banner */}
                    <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-[2.5rem] p-10 mb-10 flex items-center justify-between text-white relative overflow-hidden shadow-2xl">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                        <div className="relative z-10 flex items-center gap-8">
                            <div className="h-24 w-24 bg-gray-800 border-4 border-gray-700/50 rounded-3xl flex items-center justify-center text-4xl shadow-2xl">
                                {getMergedCategories().find(c => c.id === formData.category)?.icon}
                            </div>
                            <div>
                                <h3 className="text-3xl font-black mb-1">{getMergedCategories().find(c => c.id === formData.category)?.title}</h3>
                                <p className="text-white font-black text-lg">Bu kategoride hizmet veren uzman freelancerlar projeni bekliyor.</p>
                            </div>
                        </div>
                    </div>

                    {/* Sub-category Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
                        {(getMergedSubCategories()[formData.category] || getMergedSubCategories().yazilim).map((sub) => (
                            <button
                                key={sub}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, subCategory: sub }))}
                                className={`p-8 text-left rounded-3xl border-4 font-black transition-all hover:shadow-xl hover:-translate-y-1 ${formData.subCategory === sub
                                    ? "bg-green-50 border-green-500 text-green-700 shadow-xl shadow-green-100"
                                    : "bg-white border-gray-100 text-black hover:border-blue-200"}`}
                            >
                                {sub}
                                {formData.subCategory === sub && <span className="float-right text-green-500">✓</span>}
                            </button>
                        ))}
                    </div>

                    {/* Service Type Selection */}
                    <div className="space-y-8 bg-white p-10 rounded-[3rem] border-4 border-gray-50 shadow-2xl mb-16 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                        <div className="relative">
                            <h4 className="text-2xl font-black text-gray-900 mb-2">Hizmet Türü</h4>
                            <p className="text-black text-sm font-black flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
                                <span className="text-blue-600 font-black">{formData.subCategory || "Bir alt kategori seçin"}</span> kategorisinde vereceğin hizmet türü hangisi?
                            </p>
                        </div>
                        <Select
                            value={formData.serviceType}
                            onValueChange={(val) => setFormData(prev => ({ ...prev, serviceType: val }))}
                        >
                            <SelectTrigger className="h-16 rounded-[1.25rem] border-4 border-gray-100 text-black font-black text-lg focus:ring-blue-500 focus:border-blue-500 shadow-sm">
                                <SelectValue placeholder="Bir hizmet türü seçiniz..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-4 border-gray-50">
                                {getServiceTypesForSubCategory(formData.subCategory).map((type) => (
                                    <SelectItem key={type} value={type} className="py-4 font-bold">{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Bottom Progress Bar / Navigation */}
                    <div className="flex items-center justify-between bg-gray-900 rounded-[2.5rem] px-10 py-6 mb-12 shadow-2xl">
                        <div className="flex items-center gap-6">
                            <div className="h-14 w-14 bg-gray-800 rounded-2xl flex flex-col items-center justify-center border-2 border-gray-700">
                                <span className="text-[10px] font-black text-white/50 leading-none">ADIM</span>
                                <span className="text-lg font-black text-white leading-none">02 / 05</span>
                            </div>
                            <div className="hidden sm:block">
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 mb-1">Şu Anki Aşama</div>
                                <div className="text-sm font-black text-white uppercase tracking-widest">Alt Kategori Seçimi</div>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setStep(1)}
                                className="font-black text-xs uppercase text-white/50 hover:text-white hover:bg-white/10 rounded-2xl py-8 px-6"
                            >GERİ DÖN</Button>
                            <Button
                                type="button"
                                disabled={!formData.subCategory || !formData.serviceType}
                                onClick={() => setStep(3)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase px-12 py-8 rounded-[1.5rem] shadow-2xl shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            >DEVAM ET →</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 3: General Info */}
            {step === 3 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="text-center">
                        <h3 className="text-2xl font-black text-gray-900 font-heading tracking-tight">İş İlanı Temel Bilgiler</h3>
                        <p className="text-black font-bold mt-2 text-base">Alıcıların seni <span className="text-blue-600">daha kolay bulabilmesi</span> için aşağıdaki bilgileri dikkatle doldurmalısın.</p>
                    </div>

                    {/* Specialized Voiceover Form (Bionluk Style) */}
                    {formData.subCategory === "Seslendirme" && (
                        <div className="bg-white border-4 border-gray-100 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[550px]">
                            {/* Left Side Navigation (Vertical Tabs) */}
                            <div className="w-full md:w-[320px] bg-gray-50/50 border-r-4 border-gray-100 p-6 flex flex-col gap-3">
                                {[
                                    { id: "gender", label: "Seslendirmen", icon: "🎙️" },
                                    { id: "language", label: "Seslendirme Dili", icon: "🌐" },
                                    { id: "usage", label: "Kullanım Alanı", icon: "📢" },
                                    { id: "age", label: "Yaş Aralığı", icon: "🎂" },
                                    { id: "tone", label: "Ses Tonu", icon: "🎵" },
                                ].map((tab) => {
                                    const isCompleted = (tab.id === "gender" && formData.voiceDetails.gender) ||
                                        (tab.id === "language" && formData.voiceDetails.language.length > 0) ||
                                        (tab.id === "usage" && formData.voiceDetails.usage.length > 0) ||
                                        (tab.id === "age" && formData.voiceDetails.age) ||
                                        (tab.id === "tone" && formData.voiceDetails.tone.length > 0);

                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setFormData(p => ({ ...p, voiceDetails: { ...p.voiceDetails, activeTab: tab.id } }))}
                                            className={`flex items-center justify-between p-6 rounded-2xl font-black transition-all ${formData.voiceDetails.activeTab === tab.id
                                                ? "bg-white text-blue-600 shadow-xl border-2 border-blue-500 -translate-y-0.5"
                                                : "text-black hover:bg-white/50 font-black"}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <span className="text-xl">{tab.icon}</span>
                                                <span className="text-sm uppercase tracking-wide">{tab.label}</span>
                                            </div>
                                            {isCompleted && <span className="text-green-500 font-bold">✓</span>}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Right Side Content (Dynamic Panels) */}
                            <div className="flex-1 p-8 md:p-10 bg-white">
                                <h4 className="text-xl font-black text-black mb-8 flex items-center gap-3">
                                    <div className="h-8 w-1.5 bg-blue-600 rounded-full"></div>
                                    {formData.voiceDetails.activeTab === "gender" && "Seslendirmen Türü Seç"}
                                    {formData.voiceDetails.activeTab === "language" && "Hangi Dilde Hizmet Veriyorsun?"}
                                    {formData.voiceDetails.activeTab === "usage" && "Kullanım Alanlarını Belirle"}
                                    {formData.voiceDetails.activeTab === "age" && "Sesinin Hitap Ettiği Yaş Aralığı?"}
                                    {formData.voiceDetails.activeTab === "tone" && "Karakteristik Ses Tonun"}
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    {formData.voiceDetails.activeTab === "gender" && VOICE_OPTIONS.gender.map(g => (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => setFormData(p => ({ ...p, voiceDetails: { ...p.voiceDetails, gender: g } }))}
                                            className={`group p-6 rounded-2xl border-2 text-left transition-all ${formData.voiceDetails.gender === g ? "border-green-500 bg-green-50/50" : "border-gray-50 hover:border-blue-100 bg-gray-50/30"}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${formData.voiceDetails.gender === g ? "bg-green-500 border-green-200" : "bg-white border-gray-200"}`}>
                                                    {formData.voiceDetails.gender === g && <div className="h-2 w-2 bg-white rounded-full"></div>}
                                                </div>
                                                <span className={`text-lg font-black ${formData.voiceDetails.gender === g ? "text-green-800" : "text-black"}`}>{g}</span>
                                            </div>
                                        </button>
                                    ))}

                                    {formData.voiceDetails.activeTab === "language" && (
                                        <div className="col-span-full space-y-6">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {VOICE_OPTIONS.language.map(l => {
                                                    const isSelected = formData.voiceDetails.language.includes(l);
                                                    return (
                                                        <button
                                                            key={l}
                                                            type="button"
                                                            onClick={() => {
                                                                let next = [...formData.voiceDetails.language];
                                                                if (isSelected) next = next.filter(x => x !== l);
                                                                else if (next.length < 5) next.push(l);
                                                                setFormData((p) => ({
                                                                    ...p,
                                                                    voiceDetails: {
                                                                        ...p.voiceDetails,
                                                                        language: next,
                                                                    },
                                                                }));
                                                            }}
                                                            className={`p-5 rounded-2xl border-2 font-black transition-all flex items-center justify-between ${isSelected ? "bg-blue-600 border-blue-600 text-white shadow-lg" : "border-gray-100 hover:border-blue-200 bg-gray-50/30 text-black"}`}
                                                        >
                                                            <span>{l}</span>
                                                            {isSelected && <span>✓</span>}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {formData.voiceDetails.language.includes("Diğer Diller") && (
                                                <div className="p-6 bg-blue-50/50 rounded-2xl border-2 border-dashed border-blue-200 animate-in fade-in slide-in-from-top-2">
                                                    <p className="text-xs font-black text-blue-700 uppercase mb-3 px-1">Diğer Dilleri Ekle (Virgül ile ayırın)</p>
                                                    <Input
                                                        placeholder="Örn: İtalyanca, Portekizce..."
                                                        value={formData.voiceDetails.otherLanguageInput}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setFormData((prev) => ({
                                                                ...prev,
                                                                voiceDetails: {
                                                                    ...prev.voiceDetails,
                                                                    otherLanguageInput: val,
                                                                },
                                                            }));
                                                        }}
                                                        className="h-14 rounded-2xl border-2 border-blue-200 font-bold"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {formData.voiceDetails.activeTab === "usage" && VOICE_OPTIONS.usage.map(u => {
                                        const isSelected = formData.voiceDetails.usage.includes(u);
                                        return (
                                            <button
                                                key={u}
                                                type="button"
                                                onClick={() => {
                                                    const current = formData.voiceDetails.usage;
                                                    const next = isSelected ? current.filter(x => x !== u) : (current.length < 5 ? [...current, u] : current);
                                                    setFormData(p => ({ ...p, voiceDetails: { ...p.voiceDetails, usage: next } }));
                                                }}
                                                className={`p-5 rounded-2xl border-2 font-black transition-all flex items-center justify-between ${isSelected ? "bg-blue-600 border-blue-600 text-white shadow-lg" : "border-gray-100 hover:border-blue-200 bg-gray-50/30 text-black"}`}
                                            >
                                                <span>{u}</span>
                                                {isSelected && <span>✓</span>}
                                            </button>
                                        );
                                    })}

                                    {formData.voiceDetails.activeTab === "age" && VOICE_OPTIONS.age.map(a => (
                                        <button
                                            key={a}
                                            type="button"
                                            onClick={() => setFormData(p => ({ ...p, voiceDetails: { ...p.voiceDetails, age: a } }))}
                                            className={`p-5 rounded-2xl border-2 font-black transition-all ${formData.voiceDetails.age === a ? "bg-blue-600 border-blue-600 text-white shadow-lg" : "border-gray-100 hover:border-blue-200 bg-gray-50/30 text-black"}`}
                                        >
                                            {a}
                                        </button>
                                    ))}

                                    {formData.voiceDetails.activeTab === "tone" && VOICE_OPTIONS.tone.map(t => {
                                        const isSelected = formData.voiceDetails.tone.includes(t);
                                        return (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => {
                                                    let next = [...formData.voiceDetails.tone];
                                                    if (isSelected) next = next.filter(x => x !== t);
                                                    else if (next.length < 5) next.push(t);
                                                    setFormData(p => ({ ...p, voiceDetails: { ...p.voiceDetails, tone: next } }));
                                                }}
                                                className={`p-5 rounded-2xl border-2 font-black transition-all flex items-center justify-between ${isSelected ? "bg-blue-600 border-blue-600 text-white shadow-lg" : "border-gray-100 hover:border-blue-200 bg-gray-50/30 text-black"}`}
                                            >
                                                <span>{t}</span>
                                                {isSelected && <span>✓</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Meta Fields for non-voice categories could go here, but focusing on Voiceover now */}

                    {/* Standard Title & Description */}
                    <div className="space-y-10 bg-white p-8 md:p-10 rounded-3xl border-2 border-gray-100 shadow-xl">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center text-lg">💡</div>
                                <h4 className="text-xl font-black text-gray-900 tracking-tight">Etkileyici Bir Başlık Oluştur</h4>
                            </div>
                            <div className="relative">
                                <div className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-lg text-gray-300">Ben,</div>
                                <Input
                                    placeholder={`${formData.serviceType || "Web tasarımı"} yapıyorum`}
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: sanitizeGigTitle(e.target.value) })}
                                    className="h-14 pl-16 text-lg font-bold border-2 border-gray-100 focus:border-blue-500 rounded-xl shadow-inner bg-gray-50/10"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-lg">📝</div>
                                <h4 className="text-xl font-black text-gray-900 tracking-tight">Hizmetini Detaylandır</h4>
                            </div>
                            <Textarea
                                placeholder="Tecrübelerinizden, kullandığınız ekipmanlardan ve müşteriye sunacağınız avantajlardan bahsedin..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="min-h-[250px] text-base p-6 border-2 border-gray-100 focus:border-blue-500 rounded-2xl shadow-inner leading-relaxed font-medium"
                            />
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center text-lg">#️⃣</div>
                                <h4 className="text-xl font-black text-gray-900 tracking-tight">Etiketler (Popülerlik İçin)</h4>
                            </div>
                            <div className="flex flex-wrap gap-3 mb-4">
                                {formData.tags.map((tag) => (
                                    <span key={tag} className="bg-blue-600 text-white px-5 py-2.5 rounded-full text-sm font-black flex items-center gap-2 shadow-xl hover:scale-105 transition-all">
                                        #{tag}
                                        <X className="h-4 w-4 cursor-pointer text-white/80 hover:text-white" onClick={() => removeTag(tag)} />
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-4">
                                <Input
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    placeholder="Örn: reklam, dublaj, kurumsal"
                                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                                    className="h-16 rounded-[1.25rem] border-4 border-gray-50 font-bold text-lg"
                                />
                                <Button type="button" onClick={addTag} className="h-16 px-10 rounded-[1.25rem] bg-blue-600 text-white font-black hover:bg-blue-700 shadow-lg">EKLE</Button>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center py-6">
                        <Button type="button" variant="ghost" onClick={() => setStep(2)} className="px-6 py-4 rounded-xl font-black text-gray-400 hover:text-gray-900 hover:bg-gray-100">← GERİ</Button>
                        <Button
                            type="button"
                            onClick={() => setStep(4)}
                            disabled={!isStep3Valid()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-5 rounded-2xl font-black text-base shadow-xl shadow-blue-500/20 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                        >
                            FİYATLANDIRMAYA GEÇ →
                        </Button>
                    </div>
                </div>
            )}

            {/* STEP 4: Packages (formerly Step 2) */}
            {step === 4 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="text-center">
                        <h3 className="text-2xl font-black text-gray-900 font-heading tracking-tight">Fiyatlandırma</h3>
                        <p className="text-gray-500 font-bold mt-2 text-base">Hizmet paketlerinin detaylarını ve fiyatlarını belirle.</p>
                    </div>

                    {formData.subCategory === "Seslendirme" ? (
                        <div className="max-w-4xl mx-auto">
                            {/* Unified Voiceover Pricing Card */}
                            <div className="bg-white border-4 border-gray-100 rounded-[3rem] shadow-2xl p-10 md:p-14 space-y-12 animate-in zoom-in-95 duration-500 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/20 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>

                                <div className="space-y-12 relative">
                                    {/* Row: Word Count */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-10 border-b-2 border-gray-50">
                                        <div className="max-w-sm">
                                            <h4 className="text-2xl font-black text-gray-900 leading-tight">Paket Kelime Sayısı</h4>
                                            <p className="text-gray-400 font-bold mt-1">Bu fiyata dahil olan maksimum kelime miktarı.</p>
                                        </div>
                                        <div className="flex items-center gap-4 w-full md:w-auto">
                                            <div className="relative flex-1 md:flex-none">
                                                <Input
                                                    type="number"
                                                    placeholder="0"
                                                    value={String(packages.basic.wordCount ?? "")}
                                                    onChange={(e) => setPackages(p => ({ ...p, basic: { ...p.basic, wordCount: e.target.value } }))}
                                                    className="h-16 w-full md:w-36 rounded-2xl border-4 border-gray-50 font-black text-center text-xl bg-gray-50/30 focus:border-blue-200 transition-all"
                                                />
                                            </div>
                                            <span className="font-black text-gray-300 uppercase tracking-widest text-sm">kelime</span>
                                        </div>
                                    </div>

                                    {/* Row: Extra Pricing */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-10 border-b-2 border-gray-50">
                                        <div className="max-w-sm">
                                            <h4 className="text-2xl font-black text-gray-900 leading-tight">Ekstra Ücretlendirme</h4>
                                            <p className="text-gray-400 font-bold mt-1">Kelime limiti aşıldığında uygulanacak tarife.</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 bg-blue-50/50 p-6 rounded-3xl border-2 border-blue-100/50">
                                            <span className="text-xs font-black text-blue-700 uppercase tracking-widest">Ekstra Her</span>
                                            <Input
                                                type="number"
                                                placeholder="50"
                                                value={String(packages.basic.extraWordCount ?? "")}
                                                onChange={(e) => setPackages(p => ({ ...p, basic: { ...p.basic, extraWordCount: e.target.value } }))}
                                                className="w-20 h-10 rounded-lg border-2 border-blue-200 font-black text-center bg-white text-blue-600"
                                            />
                                            <span className="text-xs font-black text-blue-700 uppercase tracking-widest">Kelime için</span>
                                            <div className="relative">
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-black text-green-600">₺</span>
                                                <Input
                                                    type="number"
                                                    placeholder="100"
                                                    value={String(packages.basic.extraWordPrice ?? "")}
                                                    onChange={(e) => setPackages(p => ({ ...p, basic: { ...p.basic, extraWordPrice: e.target.value } }))}
                                                    className="w-24 h-10 rounded-lg border-2 border-blue-200 font-black text-center bg-white text-green-600 pl-5"
                                                />
                                            </div>
                                            <span className="text-xs font-black text-blue-700 uppercase tracking-widest">Ekle</span>
                                        </div>
                                    </div>

                                    {/* Row: Revisions & Delivery */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pb-10 border-b-2 border-gray-50">
                                        <div className="space-y-4">
                                            <h4 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                                <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">↻</span>
                                                Revizyon Sayısı
                                            </h4>
                                            <Select
                                                value={packages.basic.revisions}
                                                onValueChange={(val) => setPackages(p => ({ ...p, basic: { ...p.basic, revisions: val } }))}
                                            >
                                                <SelectTrigger className="h-14 rounded-2xl border-4 border-gray-50 font-black text-lg bg-gray-50/30">
                                                    <SelectValue placeholder="Seç" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl border-4 border-gray-50">
                                                    {[0, 1, 2, 3, 5, 99].map(r => (
                                                        <SelectItem key={r} value={r.toString()} className="font-bold py-3">{r === 99 ? "∞ SINIRSIZ" : `${r} ADET`}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-4">
                                            <h4 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                                <span className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">🚚</span>
                                                Teslim Süresi
                                            </h4>
                                            <Select
                                                value={packages.basic.deliveryDays}
                                                onValueChange={(val) => setPackages(p => ({ ...p, basic: { ...p.basic, deliveryDays: val } }))}
                                            >
                                                <SelectTrigger className="h-14 rounded-2xl border-4 border-gray-50 font-black text-lg bg-gray-50/30">
                                                    <SelectValue placeholder="Süre Seçin" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl border-4 border-gray-50">
                                                    {[1, 2, 3, 5, 7, 10, 14, 21, 30].map(d => (
                                                        <SelectItem key={d} value={d.toString()} className="font-bold py-3 uppercase">{d} GÜN İÇİNDE</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Final Price Row */}
                                    <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-8">
                                        <div className="text-center md:text-left">
                                            <h4 className="text-3xl font-black text-gray-900 tracking-tight">Hizmet Taban Fiyatı</h4>
                                            <p className="text-gray-400 font-bold mt-1 italic leading-relaxed">Kelime sınırı içindeki tüm seslendirme için talep ettiğin ücret.</p>
                                        </div>
                                        <div className="relative w-full md:w-64">
                                            <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-4xl text-blue-600">₺</span>
                                            <Input
                                                type="number"
                                                placeholder="0"
                                                min={100}
                                                value={packages.basic.price}
                                                onChange={(e) => setPackages(p => ({ ...p, basic: { ...p.basic, price: e.target.value } }))}
                                                className="h-24 w-full rounded-[2rem] border-8 border-blue-50 font-black text-right text-4xl pr-10 pl-16 shadow-2xl bg-gray-900 text-white focus:border-blue-100 transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white border-4 border-gray-300 rounded-3xl overflow-hidden shadow-xl overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-separate border-spacing-0 min-w-[800px] table-fixed">
                                <thead>
                                    <tr className="bg-gray-50/80">
                                        <th className="p-6 border-r border-gray-300 border-b border-gray-300 w-[19%] bg-blue-600 text-center">
                                            <div className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Hizmet Birimi</div>
                                        </th>
                                        {(["basic", "standard", "premium"] as const).map((key) => (
                                            <th key={key} className={`relative p-8 pb-10 border-r border-gray-300 border-b border-gray-300 w-[27%] text-center transition-all duration-500 ${!activePackages[key] ? "bg-gray-100/20 opacity-40 grayscale" : "bg-white"}`}>
                                                {key !== "basic" && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setActivePackages(prev => ({ ...prev, [key]: !prev[key] }))}
                                                        className={`absolute top-3 right-3 px-3 py-1 rounded-lg text-[9px] font-black shadow-sm transition-all border-2 z-10 ${activePackages[key] ? "bg-green-500 text-white border-green-600 hover:bg-green-600" : "bg-gray-100 text-black border-gray-200 hover:bg-gray-200"
                                                            }`}
                                                    >
                                                        {activePackages[key] ? "✓ KAPAT" : "PAKETİ AÇ"}
                                                    </button>
                                                )}

                                                <div className="flex flex-col items-center gap-4 mt-2">
                                                    <div className={`text-[13px] font-black uppercase tracking-[0.25em] ${key === "basic" ? "text-black" :
                                                        key === "standard" ? "text-blue-500" : "text-indigo-600"
                                                        }`}>
                                                        {key === "basic" ? "Temel" : key === "standard" ? "Pro" : "Elmas"}
                                                    </div>

                                                    {activePackages[key] && (
                                                        <Input
                                                            placeholder="Paket Adı"
                                                            value={packages[key].name}
                                                            onChange={(e) => setPackages(prev => ({ ...prev, [key]: { ...prev[key], name: e.target.value } }))}
                                                            className="text-center font-bold border-none shadow-inner focus-visible:ring-2 focus-visible:ring-blue-100 h-11 bg-dark-100/80 text-black rounded-xl p-4 text-sm placeholder:text-gray-400 transition-all animate-in zoom-in-95 duration-300"
                                                        />
                                                    )}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-300">
                                    <tr>
                                        <td className="p-6 bg-blue-600 font-bold text-white text-[11px] uppercase border-r border-gray-300 border-b border-white/20 text-center align-top pt-10">Paket Özet Açıklaması</td>
                                        {(["basic", "standard", "premium"] as const).map((key) => (
                                            <td key={key} className={`p-5 border-r border-gray-300 last:border-r-0 transition-colors ${!activePackages[key] ? "bg-gray-50/30" : ""}`}>
                                                {activePackages[key] ? (
                                                    <Textarea
                                                        placeholder="Bu pakette sunacağınız hizmetleri detaylandırın..."
                                                        value={packages[key].description}
                                                        onChange={(e) => setPackages(prev => ({ ...prev, [key]: { ...prev[key], description: e.target.value } }))}
                                                        className="min-h-[120px] text-[13px] border-none shadow-none focus-visible:ring-0 resize-none bg-transparent p-4 leading-relaxed placeholder:text-gray-400 text-black font-medium"
                                                    />
                                                ) : (
                                                    <div className="h-24 flex items-center justify-center text-[11px] text-gray-200 font-bold italic uppercase tracking-widest">—</div>
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td className="p-6 bg-blue-600 font-bold text-white text-[11px] uppercase border-r border-gray-300 border-b border-white/20 text-center">Teslimat Süresi</td>
                                        {(["basic", "standard", "premium"] as const).map((key) => (
                                            <td key={key} className={`p-4 border-r border-gray-300 last:border-r-0 transition-colors ${!activePackages[key] ? "bg-gray-50/30" : ""}`}>
                                                {activePackages[key] && (
                                                    <Select
                                                        value={packages[key].deliveryDays}
                                                        onValueChange={(val) => setPackages(prev => ({ ...prev, [key]: { ...prev[key], deliveryDays: val } }))}
                                                    >
                                                        <SelectTrigger className="border-none shadow-none focus:ring-2 focus:ring-blue-50 text-center text-xs font-black bg-gray-100/50 text-black h-12 rounded-xl">
                                                            <SelectValue placeholder="Süre" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {[1, 2, 3, 5, 7, 10, 14, 21, 30].map(d => (
                                                                <SelectItem key={d} value={d.toString()}>{d} GÜN İÇİNDE TESLİMAT</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </td>
                                        ))}
                                    </tr>

                                    <tr>
                                        <td className="p-6 bg-blue-600 font-bold text-white text-[11px] uppercase border-r border-gray-300 border-b border-white/20 text-center">Revizyon Hakkı</td>
                                        {(["basic", "standard", "premium"] as const).map((key) => (
                                            <td key={key} className={`p-4 border-r border-gray-300 last:border-r-0 transition-colors ${!activePackages[key] ? "bg-gray-50/20" : ""}`}>
                                                {activePackages[key] && (
                                                    <Select
                                                        value={packages[key].revisions}
                                                        onValueChange={(val) => setPackages(prev => ({ ...prev, [key]: { ...prev[key], revisions: val } }))}
                                                    >
                                                        <SelectTrigger className="border-none shadow-none focus:ring-2 focus:ring-blue-50 text-center text-xs font-black bg-gray-100/50 text-black h-12 rounded-xl">
                                                            <SelectValue placeholder="Rev" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {[0, 1, 2, 3, 5, 99].map(r => (
                                                                <SelectItem key={r} value={r.toString()}>{r === 99 ? "∞ SINIRSIZ" : `${r} ADET`} REVİZYON</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </td>
                                        ))}
                                    </tr>

                                    {/* Dynamic Category Specific Rows */}
                                    {(CATEGORY_EXTRAS[formData.subCategory] || CATEGORY_EXTRAS[formData.category] || []).map((row) => (
                                        <tr key={row.key as string}>
                                            <td className="p-6 bg-blue-600 font-bold text-white text-[11px] uppercase border-r border-gray-300 border-b border-white/20 text-center">
                                                {row.label}
                                            </td>
                                            {(["basic", "standard", "premium"] as const).map((key) => (
                                                <td key={key} className={`p-4 border-r border-gray-300 last:border-r-0 text-center transition-colors ${!activePackages[key] ? "bg-gray-50/20" : ""}`}>
                                                    {activePackages[key] && (
                                                        <>
                                                            {row.type === "toggle" ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setPackages((prev) => ({
                                                                            ...prev,
                                                                            [key]: {
                                                                                ...prev[key],
                                                                                [row.key]: !Boolean(prev[key][row.key]),
                                                                            },
                                                                        }))
                                                                    }
                                                                    className={`h-8 w-8 rounded-xl border-2 flex items-center justify-center mx-auto transition-all ${Boolean(packages[key][row.key]) ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100 scale-110" : "bg-white border-gray-400 hover:border-blue-500"}`}
                                                                >
                                                                    {Boolean(packages[key][row.key]) && <span className="text-[14px]">✓</span>}
                                                                </button>
                                                            ) : row.type === "select" ? (
                                                                <Select
                                                                    value={String(packages[key][row.key] ?? "")}
                                                                    onValueChange={(val) => setPackages(prev => ({ ...prev, [key]: { ...prev[key], [row.key]: val } }))}
                                                                >
                                                                    <SelectTrigger className="border-none shadow-none focus:ring-2 focus:ring-blue-50 text-center text-xs font-black bg-gray-100/50 text-black h-12 rounded-xl">
                                                                        <SelectValue placeholder="..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {row.options?.map((opt) => {
                                                                            const optValue = typeof opt === "string" || typeof opt === "number" ? String(opt) : String(opt ?? "");
                                                                            return (
                                                                                <SelectItem key={optValue} value={optValue}>
                                                                                    {optValue}{" "}{
                                                                                    row.label.includes("Dakika") ? "DK" :
                                                                                        row.label.includes("Saniye") ? "SN" :
                                                                                            row.label.includes("Kelime") ? "KELİME" :
                                                                                                row.label.includes("Hafta") ? "HAFTA" :
                                                                                                    row.label.includes("Saati") ? "SAAT" : ""
                                                                                    }
                                                                                </SelectItem>
                                                                            );
                                                                        })}
                                                                    </SelectContent>
                                                                </Select>
                                                            ) : row.type === "input" ? (
                                                                <div className="relative flex items-center justify-center gap-2">
                                                                    <Input
                                                                        type="number"
                                                                        placeholder="0"
                                                                        value={String(packages[key][row.key] ?? "")}
                                                                        onChange={(e) => setPackages(prev => ({ ...prev, [key]: { ...prev[key], [row.key]: e.target.value } }))}
                                                                        className="w-20 h-10 text-center font-black bg-gray-100/50 border-none shadow-none focus-visible:ring-2 focus-visible:ring-blue-100 rounded-xl"
                                                                    />
                                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                                                                        {row.label.includes("Kelime") ? "Kelime" : ""}
                                                                    </span>
                                                                </div>
                                                            ) : null}
                                                        </>
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}

                                    <tr>
                                        <td className="p-8 bg-blue-600 font-extrabold text-white text-[13px] uppercase border-r border-gray-300 text-center italic">Paket Fiyatı</td>
                                        {(["basic", "standard", "premium"] as const).map((key) => (
                                            <td key={key} className={`p-6 border-r border-gray-300 last:border-r-0 transition-colors ${!activePackages[key] ? "bg-gray-50/30" : "bg-blue-50/10"}`}>
                                                {activePackages[key] && (
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="flex items-center justify-center gap-2 group/price px-4 py-2 bg-white rounded-xl shadow-md border border-gray-300">
                                                            <span className="font-black text-blue-600 text-xl">₺</span>
                                                            <Input
                                                                type="number"
                                                                placeholder="0"
                                                                min={100}
                                                                max={100000}
                                                                value={packages[key].price}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    if (val.length <= 6) {
                                                                        setPackages(prev => ({ ...prev, [key]: { ...prev[key], price: val } }));
                                                                    }
                                                                }}
                                                                className="font-black text-black border-none bg-transparent shadow-none focus-visible:ring-0 text-2xl h-10 p-0 w-28 text-center transition-all"
                                                            />
                                                        </div>

                                                        {packages[key].price && parseInt(packages[key].price) >= 100 && (
                                                            <div className="flex flex-col items-center animate-in fade-in slide-in-from-top-1">
                                                                <div className="text-[12px] font-black text-blue-700 bg-blue-50 px-3 py-0.5 rounded-full border border-blue-100 shadow-sm">
                                                                    {formatNumberWithDots(packages[key].price)} ₺
                                                                </div>
                                                                <div className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-tight italic">
                                                                    ({numberToTurkishWords(parseInt(packages[key].price))})
                                                                </div>
                                                            </div>
                                                        )}

                                                        {!packages[key].price || parseInt(packages[key].price) < 100 ? (
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Min: 100 ₺</span>
                                                        ) : null}
                                                    </div>
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Extras Section */}
                    <div className="space-y-6 pt-10">
                        <h4 className="text-xl font-bold text-gray-900 font-heading tracking-tight">Hizmet Ekstraları</h4>

                        <div className="border-2 border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm divide-y divide-gray-100">
                            {extras.map((extra, idx) => (
                                <div key={extra.id} className={`group transition-all ${extra.selected ? "bg-blue-50/20" : "hover:bg-gray-50/50"}`}>
                                    <div className="p-5 flex flex-col md:flex-row items-start md:items-center gap-6">
                                        <div className="flex items-center gap-4 flex-1">
                                            <button
                                                type="button"
                                                onClick={() => setExtras(prev => prev.map((e, i) => i === idx ? { ...e, selected: !e.selected } : e))}
                                                className={`h-6 w-6 rounded border-2 flex items-center justify-center transition-all ${extra.selected ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300 group-hover:border-blue-400"}`}
                                            >
                                                {extra.selected && <span className="text-[10px] font-black">âœ“</span>}
                                            </button>

                                            {extra.isCustom ? (
                                                <Input
                                                    placeholder="Ekstra hizmet adı (örn: +1 Revizyon)"
                                                    value={extra.title}
                                                    onChange={(e) => setExtras(prev => prev.map((item, i) => i === idx ? { ...item, title: e.target.value } : item))}
                                                    className="h-10 font-bold text-gray-800 bg-transparent border-none shadow-none focus-visible:ring-0 p-0 text-lg"
                                                />
                                            ) : (
                                                <span className={`font-bold transition-colors text-lg ${extra.selected ? "text-blue-700" : "text-gray-700"}`}>{extra.title}</span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {extra.selected && (
                                                <div className="flex flex-wrap items-center gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-blue-600">₺</span>
                                                        <Input
                                                            type="number"
                                                            className="w-28 h-11 pl-7 text-sm font-black rounded-xl border-2 border-blue-100 focus:border-blue-500 transition-all bg-white"
                                                            placeholder="Fiyat"
                                                            value={extra.price}
                                                            onChange={(evt) => setExtras(prev => prev.map((item, i) => i === idx ? { ...item, price: evt.target.value } : item))}
                                                        />
                                                    </div>
                                                    <Select
                                                        value={extra.additionalDays}
                                                        onValueChange={(val) => setExtras(prev => prev.map((item, i) => i === idx ? { ...item, additionalDays: val } : item))}
                                                    >
                                                        <SelectTrigger className="w-36 h-11 rounded-xl border-2 border-blue-100 font-bold bg-white">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl border-2 border-gray-50">
                                                            {[0, 1, 2, 3, 5, 7].map(d => (
                                                                <SelectItem key={d} value={d.toString()} className="font-bold">{d === 0 ? "AynÄ± GÃ¼n" : `+${d} GÃ¼n`}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}

                                            {extra.isCustom && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeCustomExtra(extra.id)}
                                                    className="p-2.5 text-red-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                >
                                                    <X className="h-5 w-5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={addNewExtra}
                            className="text-blue-600 font-black flex items-center gap-2 hover:bg-blue-50 px-4 py-2 rounded-xl transition-all -ml-2 group"
                        >
                            <span className="text-xl group-hover:scale-125 transition-transform">+</span>
                            <span className="border-b-2 border-transparent group-hover:border-blue-600">Ekstra Ekle</span>
                        </button>
                    </div>

                    <div className="flex justify-between items-center pt-8 border-t border-gray-300 mt-12 bg-white/50 p-6 rounded-3xl">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setStep(3)}
                            className="px-10 py-6 rounded-xl font-bold border-2"
                        >
                            â† Geri
                        </Button>
                        <Button
                            type="button"
                            onClick={() => setStep(5)}
                            disabled={!isStep4Valid()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-6 rounded-xl font-bold shadow-xl shadow-blue-100 disabled:opacity-50"
                        >
                            Devam Et â†’
                        </Button>
                    </div>
                </div>
            )}

            {/* STEP 5: Images (formerly Step 3) */}
            {
                step === 5 && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="text-center">
                            <h3 className="text-2xl font-bold text-gray-900 font-heading">Vitrin Görselleri</h3>
                            <p className="text-gray-500 text-sm mt-1">İşinizi en iyi şekilde yansıtan en fazla 5 görsel yükleyin.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                            {formData.images.map((img, i) => (
                                <div key={i} className="relative group aspect-video rounded-2xl overflow-hidden border-2 shadow-sm bg-gray-50">
                                    <Image src={img} alt={`Vitrin ${i + 1}`} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button
                                            type="button"
                                            onClick={() => removeImage(i)}
                                            className="bg-white text-red-600 p-2 rounded-full shadow-xl hover:scale-110 transition-transform"
                                        >
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>
                                    {i === 0 && (
                                        <div className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg uppercase tracking-wider">
                                            Kapak Görseli
                                        </div>
                                    )}
                                </div>
                            ))}

                            {formData.images.length < 5 && (
                                <label className="aspect-video rounded-2xl border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/30 flex flex-col items-center justify-center cursor-pointer transition-all gap-2 group">
                                    <div className="h-12 w-12 rounded-full bg-gray-100 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600 flex items-center justify-center transition-colors shadow-inner">
                                        <ImagePlus className="h-6 w-6" />
                                    </div>
                                    <span className="text-sm font-bold text-gray-500 group-hover:text-blue-600">Görsel Seç</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} multiple />
                                </label>
                            )}
                        </div>

                        {/* Final Polish Summary */}
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden group">
                            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                            <h4 className="text-xl font-bold mb-6 flex items-center gap-3">
                                <span className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-sm">âœ¨</span>
                                Hizmet Özeti
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-blue-200 text-[10px] font-black uppercase tracking-widest">Başlık</span>
                                        <span className="text-lg font-bold leading-tight">Ben, {formData.title || "â€”"}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-blue-200 text-[10px] font-black uppercase tracking-widest">Kategori</span>
                                        <span className="font-semibold text-white/90">{formData.category || "â€”"}</span>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-blue-200 text-[10px] font-black uppercase tracking-widest">Başlangıç Fiyatı</span>
                                        <span className="text-3xl font-black italic">₺{packages.basic.price || "0"}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-blue-200 text-[10px] font-black uppercase tracking-widest">Vitrin Verisi</span>
                                        <span className="font-semibold">{formData.images.length} Görsel • {formData.tags.length} Etiket</span>
                                    </div>
                                </div>
                            </div>
                        </div>


                        <div className="flex gap-4 pt-4">
                            <Button type="button" variant="outline" onClick={() => setStep(4)} className="flex-1 h-14 rounded-2xl border-2 font-bold">
                                ← Fiyatlandırmaya Dön
                            </Button>
                            <Button type="submit" className="flex-1 bg-green-500 hover:bg-green-600 text-white h-14 rounded-2xl shadow-xl font-black text-lg transition-all hover:-translate-y-1 hover:shadow-2xl disabled:opacity-50" disabled={loading || !isStep5Valid()}>
                                {loading ? "Yükleniyor..." : "🚀 HİZMETİ YAYINLA"}
                            </Button>
                        </div>
                    </div>
                )}
        </form>
    );
}

