import Link from "next/link";
import { formatDistance } from "date-fns";
import { tr } from "date-fns/locale";
import { Clock, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PackageData {
    name: string;
    description: string;
    price: string;
    deliveryDays: string;
    revisions: string;
    features: string[];
}

interface Gig {
    id: number;
    title: string;
    description: string;
    category: string;
    subCategory?: string;
    serviceType?: string;
    price: string;
    createdAt: string;
    isActive?: boolean;
    seller?: string;
    sellerAvatarUrl?: string;
    images?: string[];
    tags?: string[];
    packages?: Record<string, PackageData>;
}

export function GigCard({ gig }: { gig: Gig }) {
    const hasImages = gig.images && gig.images.length > 0;
    const basePrice = gig.packages?.basic?.price || gig.price;

    return (
        <Link href={`/gigs/${gig.id}`} className="block group">
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-1.5 flex flex-col h-full shadow-sm">
                {/* Image Section */}
                <div className="relative aspect-[16/10] overflow-hidden bg-gray-50">
                    {hasImages ? (
                        <img
                            src={gig.images![0]}
                            alt={gig.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
                            <div className="text-5xl grayscale opacity-20 group-hover:grayscale-0 group-hover:opacity-40 transition-all duration-500">
                                {gig.category.includes("Logo") ? "🎨" :
                                    gig.category.includes("Yazılım") ? "💻" :
                                        gig.category.includes("Web") ? "🌐" :
                                            gig.category.includes("Video") ? "🎬" : "✍️"}
                            </div>
                        </div>
                    )}

                    {/* Overlay Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex flex-col gap-2">
                        <div className="bg-white/95 backdrop-blur-md text-gray-800 text-[10px] font-bold px-2.5 py-1 rounded shadow-sm flex items-center gap-1 border border-white/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            {gig.category}
                        </div>
                        {gig.serviceType ? (
                            <div className="bg-white/95 backdrop-blur-md text-gray-700 text-[10px] font-bold px-2.5 py-1 rounded shadow-sm border border-white/20">
                                {gig.serviceType}
                            </div>
                        ) : null}
                    </div>

                    <button className="absolute top-3 right-3 h-9 w-9 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white hover:text-red-500 transition-all shadow-md group/heart">
                        <Heart className="h-4.5 w-4.5 text-gray-400 group-hover/heart:fill-red-500 group-hover/heart:text-red-500 transition-all" />
                    </button>
                </div>

                {/* Content Section */}
                <div className="p-4 flex flex-col flex-1">
                    {/* Seller & Rating */}
                    <Link href={`/profile/${gig.seller}`} className="flex items-center gap-2 mb-3 hover:opacity-70 transition-all">
                        <div className="relative">
                            {gig.sellerAvatarUrl ? (
                                <img
                                    src={gig.sellerAvatarUrl}
                                    alt={gig.seller || "Avatar"}
                                    className="h-8 w-8 rounded-full object-cover ring-2 ring-white bg-gray-100"
                                    onError={(e) => {
                                        (e.currentTarget as any).style.display = "none";
                                    }}
                                />
                            ) : (
                                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-700 flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-white">
                                    {(gig.seller || "A").charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-green-500 border-2 border-white rounded-full" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-gray-900 leading-none">{gig.seller || "Anonim"}</span>
                            <span className="text-[9px] text-green-600 font-bold uppercase tracking-wider mt-0.5">Aktif Satıcı</span>
                        </div>
                    </Link>

                    {/* Title */}
                    <h3 className="font-heading font-semibold text-[14px] text-gray-800 leading-tight line-clamp-2 mb-3 group-hover:text-blue-600 transition-colors min-h-[2.5rem]">
                        {gig.title}
                    </h3>

                    {/* Tags */}
                    {gig.tags && gig.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4 opacity-70 group-hover:opacity-100 transition-opacity">
                            {gig.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 px-2 py-0.5 rounded leading-none border border-blue-100/50">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Pricing Table Mini Preview */}
                    <div className="mt-auto flex items-center gap-2 mb-4">
                        <div className="flex items-center gap-1">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Paketler:</span>
                            {['basic', 'standard', 'premium'].map((level) => {
                                const exists = gig.packages && gig.packages[level];
                                return (
                                    <div key={level} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border transition-all ${exists ? "bg-blue-50 text-blue-700 border-blue-200 shadow-sm" : "bg-gray-50 text-gray-300 border-gray-100 opacity-40"
                                        }`}>
                                        {exists ? "✓" : "×"} {level === 'basic' ? 'T' : level === 'standard' ? 'S' : 'P'}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-auto">
                        <div className="flex flex-col">
                            <span className="text-[9px] uppercase tracking-[0.15em] text-gray-400 font-black">BAŞLANGIÇ</span>
                            <div className="flex items-baseline gap-0.5">
                                <span className="text-[20px] font-black italic text-gray-900 leading-none">₺{parseInt(basePrice || "0").toLocaleString("tr-TR")}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg text-[10px] text-gray-500 font-bold border border-gray-100 shadow-sm">
                            <Clock className="h-3 w-3 text-blue-500" />
                            {formatDistance(new Date(gig.createdAt), new Date(), { addSuffix: true, locale: tr })}
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}
