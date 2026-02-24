"use client";

import { useAuth } from "@/components/auth/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, XCircle, MessageCircle, Star, PackageOpen } from "lucide-react";
import { getUserOrders, type Order } from "@/lib/data-service";

const statusConfig = {
    pending: { label: "Bekliyor", icon: Clock, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
    active: { label: "Devam Ediyor", icon: Clock, color: "text-blue-600 bg-blue-50 border-blue-200" },
    delivered: { label: "Teslim Edildi", icon: CheckCircle2, color: "text-purple-600 bg-purple-50 border-purple-200" },
    completed: { label: "Tamamlandı", icon: CheckCircle2, color: "text-green-600 bg-green-50 border-green-200" },
    cancelled: { label: "İptal Edildi", icon: XCircle, color: "text-red-600 bg-red-50 border-red-200" },
};

export default function OrdersPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);

    useEffect(() => {
        if (!user) { router.push("/login"); return; }
        (async () => {
            const rows = await getUserOrders(user.username, user.role as "employer" | "freelancer" | "admin");
            setOrders(rows);
        })();
    }, [user, router]);

    if (!user) return null;

    const pending = orders.filter(o => o.status === "pending").length;
    const active = orders.filter(o => o.status === "active").length;
    const delivered = orders.filter(o => o.status === "delivered").length;
    const completed = orders.filter(o => o.status === "completed").length;

    return (
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="mb-8 text-center sm:text-left">
                <h1 className="text-3xl font-bold font-heading">📋 Siparişlerim</h1>
                <p className="text-gray-500 mt-1">Tüm siparişlerini buradan takip edebilirsin.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mb-8">
                {[
                    { label: "Toplam", count: orders.length, color: "bg-gray-50 text-gray-800" },
                    { label: "Bekliyor", count: pending, color: "bg-yellow-50 text-yellow-700" },
                    { label: "Devam Ediyor", count: active, color: "bg-blue-50 text-blue-700" },
                    { label: "Teslim Edildi", count: delivered, color: "bg-purple-50 text-purple-700" },
                    { label: "Tamamlandı", count: completed, color: "bg-green-50 text-green-700" },
                ].map((stat) => (
                    <div key={stat.label} className={`${stat.color} rounded-xl p-4 text-center border`}>
                        <div className="text-2xl font-bold">{stat.count}</div>
                        <div className="text-xs font-medium mt-1">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Orders List */}
            {orders.length === 0 ? (
                <div className="bg-white border rounded-2xl p-8 sm:p-12 text-center">
                    <PackageOpen className="h-16 w-16 mx-auto mb-4 text-gray-200" />
                    <h3 className="font-semibold text-gray-700 text-lg">Henüz sipariş yok</h3>
                    <p className="text-gray-400 mt-2 max-w-md mx-auto">
                        {user.role === "freelancer"
                            ? "Hizmet ilanlarınız üzerinden sipariş aldığınızda burada görünecek."
                            : "Bir freelancer'dan hizmet satın aldığınızda burada listelenecek."
                        }
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map((order) => {
                        const config = statusConfig[order.status];
                        const StatusIcon = config.icon;

                        return (
                            <div key={order.id} className="bg-white border rounded-xl p-6 hover:shadow-md transition-shadow">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-xs font-mono text-gray-400">{order.id}</span>
                                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${config.color}`}>
                                                <StatusIcon className="h-3 w-3" />
                                                {config.label}
                                            </span>
                                        </div>
                                        <h3 className="font-semibold text-gray-900 text-lg">{order.title}</h3>
                                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-2">
                                            <span>👤 {user.role === "freelancer" ? `İş Veren: ${order.client}` : `Freelancer: ${order.freelancer}`}</span>
                                            <span>📅 {order.createdAt}</span>
                                            <span>⏰ Teslim: {order.dueDate}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-end">
                                        <div className="text-center sm:text-right">
                                            <div className="text-xl font-bold text-gray-900">₺{order.price.toLocaleString("tr-TR")}</div>
                                            <span className="text-xs text-gray-400">Toplam Tutar</span>
                                        </div>
                                        <div className="flex gap-2 justify-center sm:justify-end">
                                            <Button variant="ghost" size="icon" title="Mesaj Gönder">
                                                <MessageCircle className="h-4 w-4" />
                                            </Button>
                                            {order.status === "delivered" && (
                                                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                                                    ✅ Onayla
                                                </Button>
                                            )}
                                            {order.status === "completed" && (
                                                <Button variant="outline" size="sm">
                                                    <Star className="h-4 w-4 mr-1" /> Değerlendir
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
