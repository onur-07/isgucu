"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Check,
    Clock,
    RefreshCcw,
    Share2,
    Facebook,
    Twitter,
    Linkedin,
    Link2,
    MessageCircle,
    ChevronRight,
    MapPin,
    Calendar,
    Zap,
    Image as ImageIcon
} from "lucide-react";

export default function GigDetailDemo() {
    const [selectedPackage, setSelectedPackage] = useState<"basic" | "standard" | "premium">("premium");

    const packages = {
        basic: {
            title: "Temel",
            price: "800",
            description: "Sizin için Profesyonel bir Şekilde Pc, mobil ve tablet uyumlu mağaza sahip olan Shopify Sitesi Kurabilirim.",
            delivery: "2 Gün",
            revisions: "2",
            features: ["Responsive Tasarım"]
        },
        standard: {
            title: "Standart",
            price: "1.200",
            description: "Pc, mobil ve tablet uyumluluğuna sahip olan şık bir e-ticaret sitesi kurabilirim.",
            delivery: "3 Gün",
            revisions: "3",
            features: ["Responsive Tasarım"]
        },
        premium: {
            title: "Pro",
            price: "2.000",
            description: "Plus + Shopify E-ticaret Sitesi. Pc, mobil ve tablet uyumluluğuna sahip olan gerekli ayarlar, aplikasyonlar, sayfalar vb. sayfaları kurarım.",
            delivery: "3 Gün",
            revisions: "4",
            features: ["Responsive Tasarım"]
        }
    };

    return (
        <div className="bg-gray-50 min-h-screen">
            {/* Top Navigation / Breadcrumb - Simple Title */}
            <div className="bg-white border-b sticky top-0 z-50 py-4">
                <div className="max-w-7xl mx-auto px-4 md:px-8">
                    <h1 className="text-xl md:text-2xl font-black text-gray-900 leading-tight">
                        Ben, shopify üzerinden profesyonel e-ticaret sitesi yaparım
                    </h1>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* LEFT COLUMN - Main Content */}
                    <div className="lg:col-span-8 space-y-8">

                        {/* 1. Main Media Card */}
                        <Card className="border-0 shadow-sm overflow-hidden rounded-2xl">
                            <CardContent className="p-0 relative group">
                                <img
                                    src="https://images.unsplash.com/photo-1557821552-17105176677c?q=80&w=1632&auto=format&fit=crop"
                                    alt="Gig Main"
                                    className="w-full aspect-[16/10] object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="absolute top-4 right-4 flex gap-2">
                                    <Badge className="bg-white/90 text-black font-black hover:bg-white border-0 shadow-lg px-3 py-1">
                                        <Zap className="w-3 h-3 mr-1 fill-yellow-400 text-yellow-400" /> PRO
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Navigation Tabs */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-2 flex gap-4 overflow-x-auto scrollbar-hide">
                            {["İlan Özeti", "İş İlanı Hakkında", "Paketleri Karşılaştır", "Diğer İlanları"].map((tab, i) => (
                                <button key={tab} className={`px-6 py-3 rounded-xl font-black text-sm whitespace-nowrap transition-all ${i === 0 ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:text-black hover:bg-gray-50"}`}>
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* 2. Portfolio/Status Banner */}
                        <div className="bg-white border-2 border-dashed border-blue-100 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center text-xl">
                                    🖼️
                                </div>
                                <div>
                                    <h4 className="font-black text-gray-900 leading-none mb-1">Bu ilanına henüz bir portfolyo eklemedin. 🤩</h4>
                                    <p className="text-black font-medium text-sm">Yaptığın çalışmaları ekleyerek müşteri potansiyelini artırabilirsin.</p>
                                </div>
                            </div>
                            <Button className="bg-gray-800 hover:bg-black text-white font-black rounded-lg px-8 py-6">Ekle</Button>
                        </div>

                        {/* 3. About Section */}
                        <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-6">
                            <h2 className="text-2xl font-black text-gray-900">İş İlanı Hakkında</h2>
                            <div className="text-black font-medium leading-relaxed space-y-4">
                                <p>Merhabalar! Ben Onur Sizin İçin Profesyonel Bir Şekilde Bilgisayar, Mobil Ve Tablet Uyumluluğuna sahip olan Shopify E-Ticaret Mağazası Kurabilirim. Fiyata bionluk komisyonu dahil değildir!</p>
                                <p>Kurulum süreci boyunca tüm detaylarla ilgileniyor, mağazanızın satışa hazır hale gelmesini sağlıyorum. Ürün yükleme, ödeme yöntemleri ve kargo ayarları gibi tüm teknik işlemler dahildir.</p>
                            </div>
                        </section>

                        {/* 4. Comparison Table */}
                        <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-8 overflow-hidden">
                            <h2 className="text-2xl font-black text-gray-900">Paketleri Karşılaştırın</h2>

                            <div className="overflow-x-auto -mx-8">
                                <table className="w-full min-w-[700px] border-collapse">
                                    <thead>
                                        <tr className="border-b-2 border-gray-50 text-black">
                                            <th className="p-6 text-left w-1/4"></th>
                                            {(["premium", "standard", "basic"] as const).map(pk => (
                                                <th key={pk} className="p-6 text-center">
                                                    <div className="font-black text-2xl mb-1">{packages[pk].price} TL</div>
                                                    <div className={`text-sm uppercase tracking-widest font-black ${pk === "premium" ? "text-blue-600" : "text-black"}`}>
                                                        {packages[pk].title}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="text-black">
                                        <tr className="border-b border-gray-50">
                                            <td className="p-6 font-black text-sm">Açıklama</td>
                                            {(["premium", "standard", "basic"] as const).map(pk => (
                                                <td key={pk} className="p-6 text-xs font-bold leading-relaxed text-center align-top">
                                                    {packages[pk].description}
                                                </td>
                                            ))}
                                        </tr>
                                        <tr className="border-b border-gray-50">
                                            <td className="p-6 font-black text-sm">Responsive Tasarım</td>
                                            {(["premium", "standard", "basic"] as const).map(pk => (
                                                <td key={pk} className="p-6 text-center">
                                                    <Check className="mx-auto text-green-500 h-6 w-6" />
                                                </td>
                                            ))}
                                        </tr>
                                        <tr className="border-b border-gray-50">
                                            <td className="p-6 font-black text-sm">Revizyon</td>
                                            {(["premium", "standard", "basic"] as const).map(pk => (
                                                <td key={pk} className="p-6 text-center font-black">{packages[pk].revisions}</td>
                                            ))}
                                        </tr>
                                        <tr className="border-b border-gray-100 bg-gray-50/10">
                                            <td className="p-6 font-black text-sm">Teslim Süresi</td>
                                            {(["premium", "standard", "basic"] as const).map(pk => (
                                                <td key={pk} className="p-6 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="flex items-center gap-2 font-black text-sm">
                                                            <div className="w-4 h-4 rounded-full border-2 border-green-500 flex items-center justify-center p-0.5">
                                                                <div className="w-full h-full bg-green-500 rounded-full"></div>
                                                            </div>
                                                            {packages[pk].delivery}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Veya (+400 TL)</div>
                                                        <div className="flex items-center gap-2 text-xs font-bold opacity-30">
                                                            <div className="w-4 h-4 rounded-full border-2 border-gray-200"></div>
                                                            1 Gün
                                                        </div>
                                                    </div>
                                                </td>
                                            ))}
                                        </tr>
                                        <tr>
                                            <td className="p-6"></td>
                                            {(["premium", "standard", "basic"] as const).map(pk => (
                                                <td key={pk} className="p-6 text-center">
                                                    <Button variant="outline" className={`w-full h-12 rounded-xl font-black ${pk === "premium" ? "bg-gray-400 text-white border-0" : "bg-gray-400 text-white border-0 opacity-80"}`}>
                                                        Seç {packages[pk].price} TL
                                                    </Button>
                                                </td>
                                            ))}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* 5. Same User Other Gigs */}
                        <section className="space-y-6 pb-20">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-black text-gray-900">Tüm İlanları</h2>
                                <Button variant="link" className="text-blue-600 font-black">Profilini Gör →</Button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <Card className="overflow-hidden border-0 shadow-sm rounded-2xl group hover:shadow-xl transition-all">
                                    <div className="relative aspect-[16/10] overflow-hidden">
                                        <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1615&auto=format&fit=crop" className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="Other Gig" />
                                        <div className="absolute bottom-4 right-4 bg-white px-3 py-1 rounded-full font-black text-blue-600 shadow-xl">10.000 TL</div>
                                    </div>
                                    <CardContent className="p-6 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden">
                                                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=onur" alt="Avatar" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-black text-gray-900">onur_6687</div>
                                                <div className="text-[10px] uppercase font-black text-gray-400">Freelancer</div>
                                            </div>
                                        </div>
                                        <p className="font-black text-gray-800 text-base leading-snug">Ben, seo uyumlu, profesyonel web siteleri tasarlarım</p>
                                    </CardContent>
                                </Card>
                            </div>
                        </section>
                    </div>

                    {/* RIGHT COLUMN - Sidebar */}
                    <div className="lg:col-span-4 space-y-6">

                        {/* 1. Selected Package Sticky Card */}
                        <Card className="sticky top-24 border-0 shadow-2xl rounded-[2.5rem] overflow-hidden border-t-8 border-blue-500">
                            <CardContent className="p-0">
                                <div className="flex bg-gray-50/50">
                                    {(["premium", "standard", "basic"] as const).map(pk => (
                                        <button
                                            key={pk}
                                            onClick={() => setSelectedPackage(pk)}
                                            className={`flex-1 py-5 px-2 font-black text-xs uppercase transition-all ${selectedPackage === pk ? "bg-white text-blue-600" : "text-gray-400 hover:text-black"}`}
                                        >
                                            {packages[pk].title}
                                        </button>
                                    ))}
                                </div>
                                <div className="p-8 space-y-6 bg-white">
                                    <h4 className="font-black text-black leading-tight text-lg">
                                        {packages[selectedPackage].title === "Pro" ? "Plus + " : ""}{packages[selectedPackage].title} E-Ticaret Sitesi
                                    </h4>
                                    <p className="text-black font-black text-sm leading-relaxed opacity-60">
                                        {packages[selectedPackage].description.substring(0, 150)}...
                                    </p>

                                    <div className="space-y-4">
                                        {packages[selectedPackage].features.map(f => (
                                            <div key={f} className="flex items-center gap-3 text-black text-sm font-black">
                                                <Check className="h-5 w-5 text-green-500" /> {f}
                                            </div>
                                        ))}
                                    </div>

                                    <Button className="w-full bg-[#8b919d] hover:bg-[#6b7280] text-white py-8 rounded-xl font-black text-lg shadow-xl shadow-gray-200 transition-all active:scale-95">
                                        Devam Et | [{packages[selectedPackage].price} TL]
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 2. User Profile Card */}
                        <Card className="border-0 shadow-md rounded-[2.5rem] p-8 text-center space-y-6">
                            <div className="relative inline-block mx-auto">
                                <div className="h-32 w-32 rounded-full border-4 border-blue-50 overflow-hidden shadow-xl">
                                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=onur" alt="Profile" className="w-full h-full object-cover" />
                                </div>
                                <div className="absolute bottom-1 right-2 h-6 w-6 bg-green-500 border-4 border-white rounded-full"></div>
                                <button className="absolute top-0 right-[-20px] text-blue-600 text-[10px] font-black underline">Düzenle</button>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-left border-t border-gray-50 pt-6">
                                <div className="space-y-1">
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> Katıldığı Ay
                                    </div>
                                    <div className="text-sm font-black text-gray-900">Haziran</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> Son Görülme
                                    </div>
                                    <div className="text-sm font-black text-green-500">Çevrimiçi</div>
                                </div>
                            </div>
                        </Card>

                        {/* 3. Share Card */}
                        <div className="flex items-center justify-center gap-4 py-4">
                            <span className="text-black font-black text-sm uppercase tracking-widest opacity-60">Paylaş</span>
                            <div className="flex gap-2">
                                {[Facebook, Twitter, Linkedin, Link2].map((Icon, i) => (
                                    <button key={i} className="h-10 w-10 flex items-center justify-center rounded-full bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all text-blue-600">
                                        <Icon className="w-4 h-4" />
                                    </button>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            </main>

            {/* MESSAGE BUTTON STICKY */}
            <div className="fixed bottom-6 right-8 z-[100]">
                <button className="bg-white border-2 border-gray-100 shadow-2xl px-8 py-3 rounded-full flex items-center gap-3 font-black text-gray-900 hover:scale-105 transition-all">
                    <MessageCircle className="w-5 h-5 text-green-500" />
                    Mesajlar
                    <ChevronRight className="w-4 h-4 opacity-30" />
                </button>
            </div>

            {/* FOOTER - Matching bionluk look */}
            <footer className="bg-[#1a1a1a] text-white pt-20 pb-10 mt-20">
                <div className="max-w-7xl mx-auto px-8 divide-y divide-white/5">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 pb-20">
                        <div className="col-span-1">
                            <div className="text-2xl font-black mb-10 tracking-tighter">bionluk</div>
                            <div className="flex gap-4">
                                <Facebook className="w-5 h-5 cursor-pointer hover:text-blue-500" />
                                <Twitter className="w-5 h-5 cursor-pointer hover:text-blue-400" />
                                <Linkedin className="w-5 h-5 cursor-pointer hover:text-blue-300" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h5 className="font-black text-xs uppercase tracking-[0.2em] text-white/50 mb-6">Kategoriler</h5>
                            <ul className="space-y-3 text-sm font-bold opacity-80">
                                <li>Grafik & Tasarım</li>
                                <li>İnternet Reklamcılığı</li>
                                <li>Yazı & Çeviri</li>
                                <li>Yazılım & Teknoloji</li>
                            </ul>
                        </div>
                        <div className="space-y-4">
                            <h5 className="font-black text-xs uppercase tracking-[0.2em] text-white/50 mb-6">Destek</h5>
                            <ul className="space-y-3 text-sm font-bold opacity-80">
                                <li>Yardım Merkezi</li>
                                <li>Nasıl Çalışır?</li>
                                <li>Bize Yazın</li>
                            </ul>
                        </div>
                        <div className="space-y-4">
                            <h5 className="font-black text-xs uppercase tracking-[0.2em] text-white/50 mb-6">Topluluk</h5>
                            <ul className="space-y-3 text-sm font-bold opacity-80">
                                <li>Blog</li>
                                <li>Kariyer</li>
                            </ul>
                        </div>
                        <div className="col-span-2 lg:col-span-1 space-y-6">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" className="h-10 cursor-pointer" alt="Play Store" />
                            <img src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg" className="h-10 cursor-pointer" alt="App Store" />
                        </div>
                    </div>
                    <div className="pt-10 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex gap-6 text-xs font-bold opacity-50">
                            <span>Bionluk Hakkında</span>
                            <span>Kullanım Şartları</span>
                            <span>Gizlilik Politikası</span>
                        </div>
                        <p className="text-xs font-bold opacity-30">© Bionluk Bilgi Teknolojileri Paz. ve Tic. A.Ş. 2026</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
