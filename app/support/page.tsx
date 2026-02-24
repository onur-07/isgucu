"use client";

import { useAuth } from "@/components/auth/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { Headphones, Send, CheckCircle2, MessageCircle, ShieldCheck, Clock } from "lucide-react";
import Link from "next/link";

interface SupportTicket {
    id: string;
    fromUser: string;
    fromEmail: string;
    subject: string;
    category: string;
    message: string;
    status: "open" | "replied" | "closed";
    createdAt: string;
    reply?: string;
    repliedAt?: string;
}

const SUPPORT_CATEGORIES = [
    "Genel Soru",
    "Teknik Sorun",
    "Ödeme & Finans",
    "Sipariş Sorunu",
    "Şikayet & İhbar",
    "Hesap Sorunu",
    "Öneri & Geri Bildirim",
];

export default function SupportPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [submitted, setSubmitted] = useState(false);
    const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
    const [form, setForm] = useState({
        subject: "",
        category: "",
        message: "",
    });

    useEffect(() => {
        if (!user) {
            router.push("/login");
            return;
        }
        // Load user's previous tickets
        const allTickets: SupportTicket[] = JSON.parse(localStorage.getItem("isgucu_support_tickets") || "[]");
        setMyTickets(allTickets.filter(t => t.fromUser === user.username));
    }, [user, router]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const ticket: SupportTicket = {
            id: `TKT-${Date.now()}`,
            fromUser: user.username,
            fromEmail: "",
            subject: form.subject,
            category: form.category,
            message: form.message,
            status: "open",
            createdAt: new Date().toISOString(),
        };

        // Get the email
        const users = JSON.parse(localStorage.getItem("isgucu_users") || "[]");
        const currentUser = users.find((u: any) => u.username === user.username);
        if (currentUser) ticket.fromEmail = currentUser.email;

        // Save ticket
        const allTickets: SupportTicket[] = JSON.parse(localStorage.getItem("isgucu_support_tickets") || "[]");
        localStorage.setItem("isgucu_support_tickets", JSON.stringify([ticket, ...allTickets]));

        // Add notification for user
        const notifs = JSON.parse(localStorage.getItem(`isgucu_notifications_${user.username}`) || "[]");
        notifs.unshift({
            id: `support_${Date.now()}`,
            type: "system",
            title: "📩 Destek Talebiniz Alındı",
            description: `"${form.subject}" konulu destek talebiniz başarıyla oluşturuldu. Talep No: ${ticket.id}. Ekibimiz en kısa sürede size dönüş yapacaktır.`,
            time: new Date().toLocaleString("tr-TR"),
            read: false,
        });
        localStorage.setItem(`isgucu_notifications_${user.username}`, JSON.stringify(notifs));

        setSubmitted(true);
        setMyTickets(prev => [ticket, ...prev]);
        setForm({ subject: "", category: "", message: "" });

        setTimeout(() => setSubmitted(false), 5000);
    };

    if (!user) return null;

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            {/* Header */}
            <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white mb-4">
                    <Headphones className="h-8 w-8" />
                </div>
                <h1 className="text-3xl font-bold font-heading">Destek Merkezi</h1>
                <p className="text-gray-500 mt-2 max-w-lg mx-auto">
                    Herhangi bir sorunuz veya sorununuz mu var? Aşağıdaki formu doldurun, destek ekibimiz en kısa sürede size dönüş yapacaktır.
                </p>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                <Link href="/rules" className="bg-white border rounded-xl p-5 hover:shadow-md transition-all group">
                    <ShieldCheck className="h-8 w-8 text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
                    <h3 className="font-semibold text-gray-900 text-sm">Topluluk Kuralları</h3>
                    <p className="text-xs text-gray-500 mt-1">Platform kurallarını inceleyin.</p>
                </Link>
                <Link href="/faq" className="bg-white border rounded-xl p-5 hover:shadow-md transition-all group">
                    <MessageCircle className="h-8 w-8 text-green-600 mb-2 group-hover:scale-110 transition-transform" />
                    <h3 className="font-semibold text-gray-900 text-sm">Sıkça Sorulan Sorular</h3>
                    <p className="text-xs text-gray-500 mt-1">Hızlı cevaplar bulun.</p>
                </Link>
                <Link href="/contact" className="bg-white border rounded-xl p-5 hover:shadow-md transition-all group">
                    <Clock className="h-8 w-8 text-orange-600 mb-2 group-hover:scale-110 transition-transform" />
                    <h3 className="font-semibold text-gray-900 text-sm">Yanıt Süresi</h3>
                    <p className="text-xs text-gray-500 mt-1">Ortalama 24 saat içinde dönüş.</p>
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Support Form */}
                <div className="lg:col-span-3">
                    <div className="bg-white border rounded-2xl p-8">
                        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <Send className="h-5 w-5 text-blue-600" /> Destek Talebi Oluştur
                        </h2>

                        {submitted && (
                            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium flex items-center gap-2 animate-in fade-in duration-300">
                                <CheckCircle2 className="h-5 w-5 shrink-0" />
                                Destek talebiniz başarıyla gönderildi! En kısa sürede size dönüş yapılacaktır.
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <Label className="font-semibold">Konu</Label>
                                <Input
                                    required
                                    placeholder="Sorununuzu kısaca özetleyin..."
                                    value={form.subject}
                                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                                    className="h-12"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="font-semibold">Kategori</Label>
                                <Select required onValueChange={(val) => setForm({ ...form, category: val })}>
                                    <SelectTrigger className="h-12">
                                        <SelectValue placeholder="Kategori seçiniz" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SUPPORT_CATEGORIES.map(cat => (
                                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="font-semibold">Mesajınız</Label>
                                <Textarea
                                    required
                                    placeholder="Sorununuzu veya sorunuzu detaylıca açıklayın. Ne kadar detay verirseniz, size o kadar hızlı yardımcı olabiliriz..."
                                    className="min-h-[160px]"
                                    value={form.message}
                                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                                />
                            </div>

                            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base font-semibold">
                                <Send className="h-4 w-4 mr-2" /> Destek Talebi Gönder
                            </Button>
                        </form>
                    </div>
                </div>

                {/* My Tickets */}
                <div className="lg:col-span-2">
                    <div className="bg-white border rounded-2xl p-6">
                        <h3 className="font-bold text-gray-900 mb-4">📋 Taleplerim</h3>

                        {myTickets.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                <Headphones className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                                <p className="text-sm">Henüz destek talebiniz yok.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {myTickets.map(ticket => (
                                    <div key={ticket.id} className="border rounded-xl p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h4 className="font-medium text-sm text-gray-900 line-clamp-1">{ticket.subject}</h4>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${ticket.status === "open" ? "bg-yellow-100 text-yellow-700" :
                                                ticket.status === "replied" ? "bg-green-100 text-green-700" :
                                                    "bg-gray-100 text-gray-500"
                                                }`}>
                                                {ticket.status === "open" ? "Açık" : ticket.status === "replied" ? "Yanıtlandı" : "Kapandı"}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400 mb-2">{ticket.id} • {ticket.category}</p>
                                        <p className="text-xs text-gray-500 line-clamp-2">{ticket.message}</p>
                                        {ticket.reply && (
                                            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                                <p className="text-[10px] font-bold text-blue-600 mb-1">Yönetici Yanıtı:</p>
                                                <p className="text-xs text-blue-800">{ticket.reply}</p>
                                            </div>
                                        )}
                                        <p className="text-[10px] text-gray-300 mt-2">
                                            {new Date(ticket.createdAt).toLocaleString("tr-TR")}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
