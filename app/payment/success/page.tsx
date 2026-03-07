"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function PaymentSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const t = window.setTimeout(() => router.push("/orders"), 3000);
    return () => window.clearTimeout(t);
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-xl rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-black text-slate-900">Ödeme Başarılı</h1>
        <p className="mt-3 text-sm font-semibold text-slate-600">
          Ödemeniz alındı. Siparişiniz kısa süre içinde aktif hale gelir.
        </p>
        <div className="mt-6">
          <Link href="/orders">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-black">Siparişlere Git</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
