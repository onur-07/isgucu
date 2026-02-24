"use client";

import Link from "next/link";
import { formatDistance } from "date-fns";
import { tr } from "date-fns/locale";
import { Briefcase, Clock, DollarSign, ArrowUpRight, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Job {
    id: number;
    title: string;
    description: string;
    category: string;
    budget: string;
    created_at?: string;
    createdAt?: string; // Support both naming conventions
    user_id?: string;
}

export function JobCard({ job, isOwner = false }: { job: Job; isOwner?: boolean }) {
    const rawDate = job.created_at || job.createdAt || new Date().toISOString();

    return (
        <div className="group relative bg-white rounded-[2rem] border border-slate-100 overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 shadow-sm flex flex-col h-full">
            {/* Header / Accent */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-400 to-red-500 opacity-60" />

            <div className="p-7 flex flex-col h-full">
                {/* Meta Top */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <div className="h-9 w-9 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 border border-orange-100/50">
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

                {/* Title */}
                <h3 className="font-heading font-black text-lg text-slate-800 leading-tight mb-4 group-hover:text-orange-600 transition-colors line-clamp-2">
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
                        <Button className="w-full h-12 bg-slate-900 hover:bg-orange-500 text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl group transition-all">
                            DETAYLARI GÖR
                            <ArrowUpRight className="ml-2 h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
