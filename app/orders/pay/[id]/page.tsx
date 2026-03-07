"use client";

import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function OrderPayPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [iframeUrl, setIframeUrl] = useState("");

  useEffect(() => {
    const run = async () => {
      if (!user) {
        router.push("/login");
        return;
      }
      const orderId = Number(String((params as any)?.id || ""));
      if (!Number.isFinite(orderId) || orderId <= 0) {
        setError("Geçersiz sipariş.");
        setLoading(false);
        return;
      }

      try {
        const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
        if (sessErr || !sessionData?.session?.access_token) throw new Error("Oturum bulunamadı.");

        const res = await fetch("/api/paytr/init", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({ orderId }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(String(json?.details || json?.error || "Ödeme başlatılamadı."));

        if (json.alreadyPaid) {
          router.push("/orders");
          return;
        }
        setIframeUrl(String(json.iframeUrl || ""));
      } catch (e: any) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [params, router, user]);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-5xl mx-auto bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
          <h1 className="text-xl font-black text-slate-900">PAYTR Güvenli Ödeme</h1>
          <Button variant="outline" onClick={() => router.push("/orders")}>
            Siparişlere Dön
          </Button>
        </div>
        <div className="p-4">
          {loading ? <p className="text-sm text-slate-500">Ödeme sayfası hazırlanıyor...</p> : null}
          {!loading && error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm font-bold">{error}</div>
          ) : null}
          {!loading && !error && iframeUrl ? (
            <iframe
              src={iframeUrl}
              title="PAYTR Ödeme"
              className="w-full h-[720px] rounded-xl border border-slate-200"
              allow="payment *"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
