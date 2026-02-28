"use client";

import { useAuth } from "@/components/auth/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownLeft, TrendingUp, Wallet, CreditCard, Banknote } from "lucide-react";
import { getUserTransactions, getUserBalance, type Transaction } from "@/lib/data-service";
import { supabase } from "@/lib/supabase";

export default function WalletPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [balance, setBalance] = useState({ balance: 0, totalEarned: 0, pending: 0 });
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!user) { router.push("/login"); return; }
        let alive = true;
        const id = window.setTimeout(() => {
            (async () => {
                try {
                    const [txs, bal] = await Promise.all([
                        getUserTransactions(user.username),
                        getUserBalance(user.username),
                    ]);
                    if (!alive) return;
                    setTransactions(txs);
                    setBalance(bal);
                } catch (e) {
                    console.error("Wallet load error:", e);
                }
            })();
        }, 0);
        return () => {
            alive = false;
            window.clearTimeout(id);
        };
    }, [user, router]);

    const handleWithdraw = async () => {
        if (!user) return;
        if (busy) return;
        if (user.role !== "freelancer") {
            window.alert("Para çekme işlemi sadece freelancer hesaplarında kullanılabilir.");
            return;
        }
        if (balance.balance <= 0) {
            window.alert("Çekilebilir bakiyeniz yok.");
            return;
        }

        const raw = window.prompt("Çekmek istediğiniz tutarı girin (₺):", String(balance.balance));
        if (raw === null) return;
        const amount = Number(String(raw).replace(",", ".").trim());
        if (!Number.isFinite(amount) || amount <= 0) {
            window.alert("Geçerli bir tutar girin.");
            return;
        }
        if (amount > balance.balance) {
            window.alert("Çekmek istediğiniz tutar mevcut bakiyeden büyük olamaz.");
            return;
        }

        setBusy(true);
        try {
            const { error } = await supabase.from("payout_requests").insert([
                { user_id: user.id, amount, status: "pending" },
            ]);
            if (error) {
                window.alert("Para çekme talebi oluşturulamadı: " + (error.message || "Bilinmeyen hata"));
                return;
            }

            const [txs, bal] = await Promise.all([
                getUserTransactions(user.username),
                getUserBalance(user.username),
            ]);
            setTransactions(txs);
            setBalance(bal);
            window.alert("Para çekme talebiniz admin onayına gönderildi.");
        } finally {
            setBusy(false);
        }
    };

    if (!user) return null;

    return (
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="mb-8 text-center sm:text-left">
                <h1 className="text-3xl font-bold font-heading">💰 Cüzdanım</h1>
                <p className="text-gray-500 mt-1">Bakiye, gelir ve çekim işlemlerinizi yönetin.</p>
            </div>

            {/* Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 bg-[url('/grid.svg')]" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-blue-200 mb-2">
                            <Wallet className="h-5 w-5" /> Mevcut Bakiye
                        </div>
                        <div className="text-4xl font-bold">₺{balance.balance.toLocaleString("tr-TR")}</div>
                        <div className="text-blue-200 text-sm mt-2">Çekilebilir tutar</div>
                    </div>
                </div>

                <div className="bg-white border rounded-2xl p-6">
                    <div className="flex items-center gap-2 text-green-600 mb-2">
                        <TrendingUp className="h-5 w-5" /> Toplam Kazanç
                    </div>
                    <div className="text-3xl font-bold text-gray-900">₺{balance.totalEarned.toLocaleString("tr-TR")}</div>
                    <p className="text-sm text-gray-400 mt-2">{transactions.filter(t => t.type === "income").length} işlem</p>
                </div>

                <div className="bg-white border rounded-2xl p-6">
                    <div className="flex items-center gap-2 text-orange-600 mb-2">
                        <CreditCard className="h-5 w-5" /> Bekleyen Ödeme
                    </div>
                    <div className="text-3xl font-bold text-gray-900">₺{balance.pending.toLocaleString("tr-TR")}</div>
                    <p className="text-sm text-gray-400 mt-2">{transactions.filter(t => t.type === "pending").length} işlem bekliyor</p>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8 sm:items-center sm:justify-start">
                <Button onClick={handleWithdraw} className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 w-full sm:w-auto" disabled={busy}>
                    💳 Para Çek
                </Button>
                <Button variant="outline" className="font-medium px-6 w-full sm:w-auto" disabled={transactions.length === 0}>
                    📊 Gelir Raporu İndir
                </Button>
            </div>

            {/* Transactions */}
            <div className="bg-white border rounded-2xl overflow-hidden">
                <div className="p-6 border-b">
                    <h3 className="font-semibold text-gray-900 text-lg">Son İşlemler</h3>
                </div>

                {transactions.length === 0 ? (
                    <div className="py-12 text-center">
                        <Banknote className="h-16 w-16 mx-auto mb-4 text-gray-200" />
                        <h3 className="font-semibold text-gray-700 text-lg">Henüz işlem yok</h3>
                        <p className="text-gray-400 mt-2">Sipariş tamamlandığında ödeme geçmişiniz burada görünecek.</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {transactions.map((tx) => (
                            <div key={tx.id} className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${tx.type === "income" ? "bg-green-100 text-green-600" :
                                            tx.type === "withdrawal" ? "bg-red-100 text-red-600" :
                                                "bg-yellow-100 text-yellow-600"
                                        }`}>
                                        {tx.type === "income" ? <ArrowDownLeft className="h-5 w-5" /> :
                                            tx.type === "withdrawal" ? <ArrowUpRight className="h-5 w-5" /> :
                                                <CreditCard className="h-5 w-5" />}
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm text-gray-900">{tx.description}</p>
                                        <p className="text-xs text-gray-400">{tx.date}</p>
                                    </div>
                                </div>
                                <span className={`font-bold text-lg ${tx.type === "income" ? "text-green-600" :
                                        tx.type === "withdrawal" ? "text-red-600" :
                                            "text-yellow-600"
                                    }`}>
                                    {tx.type === "withdrawal" ? "-" : "+"}₺{Math.abs(tx.amount).toLocaleString("tr-TR")}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
