"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PaymentFailPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <div className="text-5xl mb-4">❌</div>
        <h1 className="text-2xl font-black text-slate-900">Ödeme Başarısız</h1>
        <p className="mt-3 text-sm font-semibold text-slate-600">
          Ödeme tamamlanamadı. Kart bilgilerinizi kontrol edip tekrar deneyebilirsiniz.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/orders">
            <Button variant="outline" className="font-black">Siparişlere Dön</Button>
          </Link>
          <Link href="/orders">
            <Button className="bg-slate-900 hover:bg-black text-white font-black">Tekrar Dene</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
