"use client";

import Link from "next/link";
import { formatDistance } from "date-fns";
import { tr } from "date-fns/locale";
import { Briefcase, Clock, DollarSign, ArrowUpRight, ShieldCheck, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface Job {
    id: number;
    title: string;
    description: string;
    category: string;
    budget: string;
    created_at?: string;
    createdAt?: string; // Support both naming conventions
    user_id?: string;
    owner?: {
        username: string;
        avatar_url: string;
        full_name: string;
    } | null;
}

export function JobCard({ job, isOwner = false }: { job: Job; isOwner?: boolean }) {
    const rawDate = job.created_at || job.createdAt || new Date().toISOString();

    return (
        <div className="group relative bg-white rounded-[2rem] border border-slate-100 overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 shadow-sm flex flex-col h-full">
            {/* Header / Accent */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-400 to-indigo-500 opacity-60" />

            <div className="p-7 flex flex-col h-full">
                {/* Meta Top */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <div className="h-9 w-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100/50">
                            <Briefcase className="h-4.5 w-4.5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">İş İlanı</p>
                            <p className="text-[10px] font-bold text-slate-900 mt-1 uppercase tracking-tighter">{job.category}</p>
                        </div>
                    </div>
                    {isOwner && (
                        <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-blue-100 flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" /> Senin İlanın
                        </div>
                    )}
                </div>

                {/* Owner Info */}
                <div className="mb-4 flex items-center gap-3">
                    <Link href={`/profile/${job.owner?.username || job.user_id}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                            {job.owner?.avatar_url ? (
                                <Image
                                    src={job.owner.avatar_url}
                                    alt={job.owner.username}
                                    width={32}
                                    height={32}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <User className="h-4 w-4 text-slate-400" />
                            )}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">
                                {job.owner?.full_name || job.owner?.username || "Kullanıcı"}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">İlan Sahibi</span>
                        </div>
                    </Link>
                </div>

                {/* Title */}
                <h3 className="font-heading font-black text-lg text-slate-800 leading-tight mb-4 group-hover:text-blue-600 transition-colors line-clamp-2">
                    {job.title}
                </h3>

                {/* Description */}
                <p className="text-slate-500 text-sm font-medium leading-relaxed mb-6 line-clamp-3">
                    {job.description}
                </p>

                {/* Footer Info */}
                <div className="mt-auto space-y-4">
                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-50">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">BÜTÇE</span>
                            <div className="flex items-center gap-1 text-slate-900 font-black">
                                <span className="text-lg leading-none">₺{job.budget}</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">YAYINLANMA</span>
                            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold">
                                <Clock className="h-3 w-3" />
                                {formatDistance(new Date(rawDate), new Date(), { addSuffix: true, locale: tr })}
                            </div>
                        </div>
                    </div>

                    <Link href={`/jobs/${job.id}`} className="block">
                        <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl group transition-all shadow-lg shadow-blue-500/20">
                            DETAYLARI GÖR & TEKLİF VER
                            <ArrowUpRight className="ml-2 h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
