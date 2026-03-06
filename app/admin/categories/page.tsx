"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Check, ChevronRight, LayoutGrid, ListTree, Tags } from "lucide-react";
import { getSiteConfig, hydrateSiteConfigFromRemote, saveSiteConfig } from "@/lib/site-config";

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
    const [gigExtras, setGigExtras] = useState<Record<string, Array<{ label: string; key: string; type: "select" | "toggle" | "input"; options?: Array<string | number> }>>>({});
    const [pricingTable, setPricingTable] = useState<{ showRevisionsRow: boolean }>({ showRevisionsRow: true });
    const [publishStatus, setPublishStatus] = useState<"idle" | "publishing" | "success">("idle");
    const [initStatus, setInitStatus] = useState<"loading" | "ready" | "error">("loading");

    const [newCat, setNewCat] = useState({ title: "", icon: "", id: "" });
    const [selectedCat, setSelectedCat] = useState<string | null>(null);
    const [newSub, setNewSub] = useState("");
    const [selectedSub, setSelectedSub] = useState<string | null>(null);
    const [newService, setNewService] = useState("");

    const [gigExtraOptionsDraft, setGigExtraOptionsDraft] = useState<Record<string, string>>({});

    const slugify = (s: string) => {
        return (s || "")
            .trim()
            .toLocaleLowerCase("tr-TR")
            .normalize("NFC")
            .replace(/\u0307/g, "")
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

                const localCats = JSON.parse(localStorage.getItem("isgucu_admin_categories") || "[]");
                const localSubs = JSON.parse(localStorage.getItem("isgucu_admin_subcategories") || "{}");
                const localServices = JSON.parse(localStorage.getItem("isgucu_admin_servicetypes") || "{}");

                await hydrateSiteConfigFromRemote();
                const cfg = getSiteConfig();

                const remoteCats = Array.isArray(cfg?.catalog?.categories) ? cfg.catalog.categories : [];
                const remoteSubs = cfg?.catalog?.subCategories && typeof cfg.catalog.subCategories === "object" ? cfg.catalog.subCategories : {};
                const remoteServices = cfg?.catalog?.serviceTypes && typeof cfg.catalog.serviceTypes === "object" ? cfg.catalog.serviceTypes : {};
                const remoteGigExtras = cfg?.catalog?.gigExtras && typeof cfg.catalog.gigExtras === "object" ? cfg.catalog.gigExtras : {};
                const remotePricingTable = cfg?.catalog?.pricingTable && typeof cfg.catalog.pricingTable === "object" ? cfg.catalog.pricingTable : null;

                const mergedCategories = (remoteCats.length > 0 ? remoteCats : [...DEFAULT_CATEGORIES, ...localCats]).filter(
                    (c: { id?: string; title?: string }) => String(c?.id || "") !== "freelancerlik" && String(c?.title || "").trim() !== "Freelancerlık"
                );

                const mergedSubs: any = { ...DEFAULT_SUB_CATEGORIES };
                const sourceSubs = Object.keys(remoteSubs).length > 0 ? remoteSubs : localSubs;
                Object.keys(sourceSubs).forEach((k) => {
                    mergedSubs[k] = [...(mergedSubs[k] || []), ...(sourceSubs as any)[k]];
                });
                delete mergedSubs.freelancerlik;

                const mergedServices: any = { ...DEFAULT_SERVICE_TYPES };
                const sourceServices = Object.keys(remoteServices).length > 0 ? remoteServices : localServices;
                Object.keys(sourceServices).forEach((k) => {
                    mergedServices[k] = [...(mergedServices[k] || []), ...(sourceServices as any)[k]];
                });

                setCategories(mergedCategories);
                setSubCategories(mergedSubs);
                setServiceTypes(mergedServices);
                setGigExtras(remoteGigExtras as any);
                setPricingTable({ showRevisionsRow: typeof (remotePricingTable as any)?.showRevisionsRow === "boolean" ? Boolean((remotePricingTable as any).showRevisionsRow) : true });
                setInitStatus("ready");
            } catch (e) {
                console.error("AdminCategories: init failed", e);
                setInitStatus("error");
            }
        })();
    }, [authLoading, user, router]);

    const persistRemote = async (next: { cats: any[]; subs: any; services: any; extras: any; pricingTable: { showRevisionsRow: boolean } }) => {
        const cfg = getSiteConfig();
        const nextConfig = {
            ...cfg,
            catalog: {
                ...(cfg as any).catalog,
                categories: next.cats,
                subCategories: next.subs,
                serviceTypes: next.services,
                gigExtras: next.extras,
                pricingTable: next.pricingTable,
            },
        } as any;
        await saveSiteConfig(nextConfig);
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
        persistRemote({ cats: updated, subs: subCategories, services: serviceTypes, extras: gigExtras, pricingTable });
        setNewCat({ title: "", icon: "", id: "" });
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
        persistRemote({ cats: updated, subs: subCategories, services: serviceTypes, extras: gigExtras, pricingTable });
    };

    const addSubCategory = () => {
        if (initStatus !== "ready") return;
        if (!selectedCat || !newSub) return;
        const updated = { ...subCategories, [selectedCat]: [...(subCategories[selectedCat] || []), newSub] };
        setSubCategories(updated);
        persistRemote({ cats: categories, subs: updated, services: serviceTypes, extras: gigExtras, pricingTable });
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
        persistRemote({ cats: categories, subs: updated, services: serviceTypes, extras: gigExtras, pricingTable });
    };

    const addServiceType = () => {
        if (initStatus !== "ready") return;
        if (!selectedSub || !newService) return;
        const updated = { ...serviceTypes, [selectedSub]: [...(serviceTypes[selectedSub] || []), newService] };
        setServiceTypes(updated);
        persistRemote({ cats: categories, subs: subCategories, services: updated, extras: gigExtras, pricingTable });
        setNewService("");
    };

    const deleteServiceType = (svc: string) => {
        if (initStatus !== "ready") return;
        if (!selectedSub) return;
        const currentList = serviceTypes[selectedSub] || serviceTypes.default || [];
        const updated = { ...serviceTypes, [selectedSub]: currentList.filter(s => s !== svc) };
        setServiceTypes(updated);
        persistRemote({ cats: categories, subs: subCategories, services: updated, extras: gigExtras, pricingTable });
    };

    const addGigExtraRow = () => {
        if (!selectedSub) return;
        const current = gigExtras[selectedSub] || [];
        const nextKey = `custom_${Date.now()}`;
        const updated = {
            ...gigExtras,
            [selectedSub]: [
                ...current,
                { label: "", key: nextKey, type: "toggle" as const },
            ],
        };
        setGigExtras(updated);
        setGigExtraOptionsDraft((prev) => ({ ...prev, [`${selectedSub}::${nextKey}`]: "" }));
        persistRemote({ cats: categories, subs: subCategories, services: serviceTypes, extras: updated, pricingTable });
    };

    const updateGigExtraRow = (idx: number, patch: Partial<{ label: string; key: string; type: "select" | "toggle" | "input"; options?: Array<string | number> }>) => {
        if (!selectedSub) return;
        const current = gigExtras[selectedSub] || [];
        const nextList = current.map((r, i) => (i === idx ? { ...r, ...patch } : r));
        const updated = { ...gigExtras, [selectedSub]: nextList };
        setGigExtras(updated);
        persistRemote({ cats: categories, subs: subCategories, services: serviceTypes, extras: updated, pricingTable });
    };

    const commitGigExtraOptionsDraft = (subKey: string, rowKey: string, raw: string, idx: number) => {
        const opts = String(raw || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
            .map((x) => (String(Number(x)) === x ? Number(x) : x));
        updateGigExtraRow(idx, { options: opts });
        setGigExtraOptionsDraft((prev) => ({ ...prev, [`${subKey}::${rowKey}`]: String(raw || "") }));
    };

    const deleteGigExtraRow = (idx: number) => {
        if (!selectedSub) return;
        const current = gigExtras[selectedSub] || [];
        const nextList = current.filter((_, i) => i !== idx);
        const updated = { ...gigExtras, [selectedSub]: nextList };
        setGigExtras(updated);
        persistRemote({ cats: categories, subs: subCategories, services: serviceTypes, extras: updated, pricingTable });
    };

    const publishChanges = async () => {
        setPublishStatus("publishing");
        await persistRemote({ cats: categories, subs: subCategories, services: serviceTypes, extras: gigExtras, pricingTable });
        setPublishStatus("success");
        setTimeout(() => setPublishStatus("idle"), 3000);
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
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-10">
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

            <Card className="border-4 border-white shadow-2xl rounded-[2.5rem] overflow-hidden">
                <CardHeader className={`${selectedSub ? 'bg-slate-900' : 'bg-gray-200'} text-white p-6 transition-colors`}>
                    <CardTitle className="flex items-center justify-between gap-3 text-xl font-black uppercase tracking-tight flex-wrap">
                        <span>4. Özellikler (Fiyatlandırma Satırları)</span>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10 px-4 rounded-xl border-white/20 text-white font-black uppercase tracking-widest text-[10px]"
                            onClick={addGigExtraRow}
                            disabled={!selectedSub}
                        >
                            <Plus className="h-4 w-4 mr-2" /> Satır Ekle
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                    <div className="rounded-2xl border-2 border-gray-100 bg-white p-4">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Temel Satırlar</div>
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={pricingTable.showRevisionsRow}
                                onChange={(e) => {
                                    const next = { ...pricingTable, showRevisionsRow: e.target.checked };
                                    setPricingTable(next);
                                    persistRemote({ cats: categories, subs: subCategories, services: serviceTypes, extras: gigExtras, pricingTable: next });
                                }}
                            />
                            <span className="text-sm font-black text-black">Revizyon Hakkı satırı görünsün</span>
                        </label>
                    </div>
                    {!selectedSub ? (
                        <div className="text-center py-12 text-black/40 font-black italic uppercase text-sm tracking-widest">Önce bir alt kategori seç</div>
                    ) : (
                        <div className="space-y-3">
                            {(gigExtras[selectedSub] || []).length === 0 ? (
                                <div className="text-center py-10 text-black/40 font-black italic uppercase text-sm tracking-widest">Bu alt kategori için henüz özellik yok</div>
                            ) : null}

                            {(gigExtras[selectedSub] || []).map((row, idx) => (
                                <div key={`${row.key}-${idx}`} className="rounded-2xl border-2 border-gray-100 bg-white p-4">
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                                        <div className="lg:col-span-4">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Başlık</div>
                                            <Input
                                                value={row.label}
                                                onChange={(e) => updateGigExtraRow(idx, { label: e.target.value })}
                                                className="h-11 rounded-xl border-2 font-bold"
                                                placeholder="Örn: Plugin"
                                            />
                                        </div>
                                        <div className="lg:col-span-3">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Key</div>
                                            <Input
                                                value={row.key}
                                                onChange={(e) => updateGigExtraRow(idx, { key: e.target.value })}
                                                className="h-11 rounded-xl border-2 font-bold"
                                                placeholder="Örn: plugin"
                                            />
                                        </div>
                                        <div className="lg:col-span-3">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Tür</div>
                                            <select
                                                value={row.type}
                                                onChange={(e) => updateGigExtraRow(idx, { type: e.target.value as any, options: e.target.value === "select" ? (row.options || []) : undefined })}
                                                className="h-11 w-full rounded-xl border-2 border-gray-200 px-3 font-black"
                                            >
                                                <option value="toggle">Checkbox</option>
                                                <option value="select">Seçim</option>
                                                <option value="input">Sayı</option>
                                            </select>
                                        </div>
                                        <div className="lg:col-span-2 flex justify-end">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                className="h-10 px-3 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 font-black uppercase tracking-widest text-[10px]"
                                                onClick={() => deleteGigExtraRow(idx)}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" /> Sil
                                            </Button>
                                        </div>
                                    </div>
                                    {row.type === "select" ? (
                                        <div className="mt-3">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Seçenekler (virgülle)</div>
                                            <Input
                                                value={gigExtraOptionsDraft[`${selectedSub}::${row.key}`] ?? (row.options || []).map(String).join(",")}
                                                onChange={(e) => {
                                                    const raw = String(e.target.value || "");
                                                    setGigExtraOptionsDraft((prev) => ({ ...prev, [`${selectedSub}::${row.key}`]: raw }));
                                                }}
                                                onBlur={(e) => {
                                                    const raw = String(e.target.value || "");
                                                    commitGigExtraOptionsDraft(selectedSub, row.key, raw, idx);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        commitGigExtraOptionsDraft(selectedSub, row.key, (e.currentTarget as HTMLInputElement).value, idx);
                                                    }
                                                }}
                                                className="h-11 rounded-xl border-2 font-bold"
                                                placeholder="Örn: 1,2,3,5"
                                            />
                                        </div>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
