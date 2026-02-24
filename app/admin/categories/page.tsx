"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Check, ChevronRight, LayoutGrid, ListTree, Tags } from "lucide-react";

export default function AdminCategoriesPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const didInit = useRef(false);
    const defaultCategoriesRef = useRef<any[]>([]);
    const defaultSubCategoriesRef = useRef<Record<string, string[]>>({});
    const defaultServiceTypesRef = useRef<Record<string, string[]>>({});
    // 1. STATE
    const [categories, setCategories] = useState<any[]>([]);
    const [subCategories, setSubCategories] = useState<Record<string, string[]>>({});
    const [serviceTypes, setServiceTypes] = useState<Record<string, string[]>>({});
    const [publishStatus, setPublishStatus] = useState<"idle" | "publishing" | "success">("idle");
    const [initStatus, setInitStatus] = useState<"loading" | "ready" | "error">("loading");

    const [newCat, setNewCat] = useState({ title: "", icon: "📁", id: "" });
    const [selectedCat, setSelectedCat] = useState<string | null>(null);
    const [newSub, setNewSub] = useState("");
    const [selectedSub, setSelectedSub] = useState<string | null>(null);
    const [newService, setNewService] = useState("");

    const slugify = (s: string) => {
        return (s || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9\-ığüşöçİĞÜŞÖÇ]/gi, "")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
    };

    // 2. INITIAL LOAD
    useEffect(() => {
        if (authLoading) return;
        if (didInit.current) return;
        if (!user || user.role !== "admin") {
            router.push("/");
            return;
        }

        didInit.current = true;

        (async () => {
            try {
                const mod = await import("@/lib/categories-data");
                const DEFAULT_CATEGORIES = (mod as any).CATEGORIES_DETAILED || [];
                const DEFAULT_SUB_CATEGORIES = (mod as any).SUB_CATEGORIES_DATA || {};
                const DEFAULT_SERVICE_TYPES = (mod as any).SERVICE_TYPES_DATA || {};

                defaultCategoriesRef.current = DEFAULT_CATEGORIES;
                defaultSubCategoriesRef.current = DEFAULT_SUB_CATEGORIES;
                defaultServiceTypesRef.current = DEFAULT_SERVICE_TYPES;

                const storedCats = JSON.parse(localStorage.getItem("isgucu_admin_categories") || "[]");
                const storedSubs = JSON.parse(localStorage.getItem("isgucu_admin_subcategories") || "{}");
                const storedServices = JSON.parse(localStorage.getItem("isgucu_admin_servicetypes") || "{}");

                setCategories([...DEFAULT_CATEGORIES, ...storedCats]);

                const mergedSubs: any = { ...DEFAULT_SUB_CATEGORIES };
                Object.keys(storedSubs).forEach((k) => {
                    mergedSubs[k] = [...(mergedSubs[k] || []), ...storedSubs[k]];
                });
                setSubCategories(mergedSubs);

                const mergedServices: any = { ...DEFAULT_SERVICE_TYPES };
                Object.keys(storedServices).forEach((k) => {
                    mergedServices[k] = [...(mergedServices[k] || []), ...storedServices[k]];
                });
                setServiceTypes(mergedServices);
                setInitStatus("ready");
            } catch (e) {
                console.error("AdminCategories: init failed", e);
                setInitStatus("error");
            }
        })();
    }, [authLoading, user, router]);

    // 3. PERSISTENCE HELPERS
    const saveToLocal = (cats: any[], subs: any, services: any) => {
        const DEFAULT_CATEGORIES = defaultCategoriesRef.current;
        const DEFAULT_SUB_CATEGORIES = defaultSubCategoriesRef.current;
        const DEFAULT_SERVICE_TYPES = defaultServiceTypesRef.current;

        const customCats = cats.filter(c => !DEFAULT_CATEGORIES.find((dc: any) => dc.id === c.id));
        localStorage.setItem("isgucu_admin_categories", JSON.stringify(customCats));

        const customSubs: any = {};
        Object.keys(subs).forEach(k => {
            const defaults = DEFAULT_SUB_CATEGORIES[k] || [];
            const customs = subs[k].filter((s: string) => !defaults.includes(s));
            if (customs.length > 0) customSubs[k] = customs;
        });
        localStorage.setItem("isgucu_admin_subcategories", JSON.stringify(customSubs));

        const customServices: any = {};
        Object.keys(services).forEach(k => {
            const defaults = DEFAULT_SERVICE_TYPES[k] || [];
            const customs = services[k].filter((s: string) => !defaults.includes(s));
            if (customs.length > 0) customServices[k] = customs;
        });
        localStorage.setItem("isgucu_admin_servicetypes", JSON.stringify(customServices));
    };

    // 4. ACTIONS
    const addCategory = () => {
        if (initStatus !== "ready") return;
        if (!newCat.title) return;
        const baseId = slugify(newCat.title);
        const exists = categories.some(c => c.id === baseId);
        const id = exists ? `${baseId}-${Date.now()}` : baseId;
        const updated = [...categories, { ...newCat, id, color: "bg-blue-50" }];
        setCategories(updated);
        saveToLocal(updated, subCategories, serviceTypes);
        setNewCat({ title: "", icon: "📁", id: "" });
    };

    const deleteCategory = (id: string) => {
        if (initStatus !== "ready") return;
        if (!confirm("Bu kategoriyi silmek istediğinizden emin misiniz? Alt kategoriler de etkilenebilir.")) return;
        const updated = categories.filter(c => c.id !== id);
        setCategories(updated);
        if (selectedCat === id) {
            setSelectedCat(null);
            setSelectedSub(null);
        }
        saveToLocal(updated, subCategories, serviceTypes);
    };

    const addSubCategory = () => {
        if (initStatus !== "ready") return;
        if (!selectedCat || !newSub) return;
        const updated = { ...subCategories, [selectedCat]: [...(subCategories[selectedCat] || []), newSub] };
        setSubCategories(updated);
        saveToLocal(categories, updated, serviceTypes);
        setNewSub("");
    };

    const deleteSubCategory = (sub: string) => {
        if (initStatus !== "ready") return;
        if (!selectedCat) return;
        if (!confirm(`${sub} alt kategorisini silmek istediğinizden emin misiniz?`)) return;
        const currentList = subCategories[selectedCat] || [];
        const updated = { ...subCategories, [selectedCat]: currentList.filter(s => s !== sub) };
        setSubCategories(updated);
        if (selectedSub === sub) setSelectedSub(null);
        saveToLocal(categories, updated, serviceTypes);
    };

    const addServiceType = () => {
        if (initStatus !== "ready") return;
        if (!selectedSub || !newService) return;
        const updated = { ...serviceTypes, [selectedSub]: [...(serviceTypes[selectedSub] || []), newService] };
        setServiceTypes(updated);
        saveToLocal(categories, subCategories, updated);
        setNewService("");
    };

    const deleteServiceType = (svc: string) => {
        if (initStatus !== "ready") return;
        if (!selectedSub) return;
        const currentList = serviceTypes[selectedSub] || serviceTypes.default || [];
        const updated = { ...serviceTypes, [selectedSub]: currentList.filter(s => s !== svc) };
        setServiceTypes(updated);
        saveToLocal(categories, subCategories, updated);
    };

    const publishChanges = () => {
        setPublishStatus("publishing");
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("storage_updated"));
            window.dispatchEvent(new Event("storage"));
        }
        setTimeout(() => {
            setPublishStatus("success");
            setTimeout(() => setPublishStatus("idle"), 3000);
        }, 800);
    };

    // 5. RENDER
    if (initStatus === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center space-y-3">
                    <div className="h-10 w-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin mx-auto" />
                    <div className="text-xs font-black uppercase tracking-widest text-gray-400">
                        Kategoriler hazırlanıyor...
                    </div>
                </div>
            </div>
        );
    }

    if (initStatus === "error") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center space-y-3">
                    <div className="text-xs font-black uppercase tracking-widest text-red-500">
                        Kategori verileri yüklenemedi.
                    </div>
                    <Button variant="outline" className="rounded-xl font-bold border-2" onClick={() => window.location.reload()}>
                        Sayfayı Yenile
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-4xl font-black text-blue-900 tracking-tight">Kategori Yönetimi</h1>
                    <p className="text-black font-black mt-1 uppercase tracking-widest text-xs">Admin Panel / İçerik Yapılandırma</p>
                </div>
                <div className="flex items-center gap-4">
                    {publishStatus === "success" && (
                        <div className="flex items-center gap-2 text-green-600 font-black animate-bounce mr-4">
                            <Check className="h-5 w-5" /> YAYINLANDI!
                        </div>
                    )}
                    <Button variant="outline" className="rounded-xl font-bold border-2">Yedeği İndir</Button>
                    <Button
                        onClick={publishChanges}
                        disabled={publishStatus !== "idle"}
                        className={`${publishStatus === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} rounded-xl font-black px-8 transition-all h-12 shadow-lg`}
                    >
                        {publishStatus === "publishing" ? "YAYINLANIYOR..." :
                            publishStatus === "success" ? "YAYINLANDI ✓" : "DEĞİŞİKLİKLERİ YAYINLA"}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-black font-black">
                {/* 1. Kategoriler */}
                <Card className="border-4 border-white shadow-2xl rounded-[2.5rem] overflow-hidden">
                    <CardHeader className="bg-blue-600 text-white p-6">
                        <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight">
                            <LayoutGrid className="h-6 w-6" /> 1. Ana Kategoriler
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="flex gap-2">
                            <Input
                                placeholder="İkon"
                                className="w-16 border-2 font-black text-center"
                                value={newCat.icon}
                                onChange={e => setNewCat({ ...newCat, icon: e.target.value })}
                            />
                            <Input
                                placeholder="Kategori Adı"
                                className="flex-1 border-2 font-bold"
                                value={newCat.title}
                                onChange={e => setNewCat({ ...newCat, title: e.target.value })}
                                onKeyPress={e => e.key === 'Enter' && addCategory()}
                            />
                            <Button onClick={addCategory} className="bg-blue-600 rounded-lg"><Plus /></Button>
                        </div>
                        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                            {categories.map(cat => (
                                <div key={cat.id} className="group flex items-center gap-2">
                                    <button
                                        onClick={() => { setSelectedCat(cat.id); setSelectedSub(null); }}
                                        className={`flex-1 flex items-center justify-between p-4 rounded-2xl font-black text-left transition-all ${selectedCat === cat.id ? "bg-blue-600 text-white shadow-xl translate-x-1" : "bg-white text-black hover:bg-gray-100 border-2 border-gray-100"}`}
                                    >
                                        <span className="flex items-center gap-3">
                                            <span className="text-xl">{cat.icon}</span> {cat.title}
                                        </span>
                                        <ChevronRight className={`h-5 w-5 ${selectedCat === cat.id ? "opacity-100" : "opacity-0"}`} />
                                    </button>
                                    <Button
                                        variant="ghost" size="icon"
                                        onClick={() => deleteCategory(cat.id)}
                                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Alt Kategoriler */}
                <Card className="border-4 border-white shadow-2xl rounded-[2.5rem] overflow-hidden">
                    <CardHeader className={`${selectedCat ? 'bg-indigo-600' : 'bg-gray-200'} text-white p-6 transition-colors`}>
                        <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight">
                            <ListTree className="h-6 w-6" /> 2. Alt Kategoriler
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        {!selectedCat ? (
                            <div className="text-center py-20 text-black/40 font-black italic uppercase text-sm tracking-widest">Lütfen soldan seçim yapın</div>
                        ) : (
                            <>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Yeni Alt Kategori..."
                                        className="flex-1 border-2 font-bold"
                                        value={newSub}
                                        onChange={e => setNewSub(e.target.value)}
                                        onKeyPress={e => e.key === 'Enter' && addSubCategory()}
                                    />
                                    <Button onClick={addSubCategory} className="bg-indigo-600 rounded-lg"><Plus /></Button>
                                </div>
                                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                                    {(subCategories[selectedCat] || []).map(sub => (
                                        <div key={sub} className="group flex items-center gap-2">
                                            <button
                                                onClick={() => setSelectedSub(sub)}
                                                className={`flex-1 flex items-center justify-between p-4 rounded-2xl font-black text-left transition-all ${selectedSub === sub ? "bg-indigo-600 text-white shadow-xl translate-x-1" : "bg-white text-black hover:bg-gray-100 border-2 border-gray-100"}`}
                                            >
                                                {sub}
                                                <ChevronRight className={`h-5 w-5 ${selectedSub === sub ? "opacity-100" : "opacity-0"}`} />
                                            </button>
                                            <Button
                                                variant="ghost" size="icon"
                                                onClick={() => deleteSubCategory(sub)}
                                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* 3. Hizmet Türleri */}
                <Card className="border-4 border-white shadow-2xl rounded-[2.5rem] overflow-hidden">
                    <CardHeader className={`${selectedSub ? 'bg-purple-600' : 'bg-gray-200'} text-white p-6 transition-colors`}>
                        <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight">
                            <Tags className="h-6 w-6" /> 3. Hizmet Türleri
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        {!selectedSub ? (
                            <div className="text-center py-20 text-black/40 font-black italic uppercase text-sm tracking-widest">Lütfen ortadan seçim yapın</div>
                        ) : (
                            <>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Yeni Hizmet Türü..."
                                        className="flex-1 border-2 font-bold"
                                        value={newService}
                                        onChange={e => setNewService(e.target.value)}
                                        onKeyPress={e => e.key === 'Enter' && addServiceType()}
                                    />
                                    <Button onClick={addServiceType} className="bg-purple-600 rounded-lg"><Plus /></Button>
                                </div>
                                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                                    {(serviceTypes[selectedSub] || serviceTypes.default || []).map(svc => (
                                        <div key={svc} className="flex items-center justify-between p-4 rounded-2xl bg-white text-black border-2 border-gray-50 group hover:border-purple-200 transition-all">
                                            {svc}
                                            <Button
                                                variant="ghost" size="sm"
                                                onClick={() => deleteServiceType(svc)}
                                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
