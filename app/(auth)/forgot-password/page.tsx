"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const emailNormalized = email.trim().toLowerCase();
      if (!emailNormalized) {
        setError("Lütfen e-posta adresinizi yazın.");
        return;
      }

      const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "");
      const redirectTo = `${baseUrl}/reset-password`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailNormalized, {
        redirectTo,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess(
        "Şifre sıfırlama bağlantısı e-postanıza gönderildi. Gelen kutusu ve spam klasörünü kontrol edin."
      );
    } catch (err: any) {
      setError(err?.message || "Bilinmeyen bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900">
          Şifre Sıfırlama
        </h1>
        <p className="mt-2 text-xs text-gray-400 font-bold uppercase tracking-widest">
          E-postanı yaz, sıfırlama linki gönderelim.
        </p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="p-4 text-xs font-black text-red-600 bg-red-50 border-2 border-red-100 rounded-xl uppercase tracking-tight">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 text-xs font-black text-green-700 bg-green-50 border-2 border-green-100 rounded-xl uppercase tracking-tight">
            {success}
          </div>
        )}

        <div className="space-y-2">
          <Label
            htmlFor="email"
            className="text-[10px] font-black uppercase text-gray-400"
          >
            E-posta
          </Label>
          <Input
            id="email"
            type="email"
            required
            className="h-14 rounded-2xl bg-gray-50 border-gray-100 font-bold text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="osubat@gmail.com"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-14 text-white bg-blue-600 hover:bg-blue-700 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-100 transition-all hover:scale-[1.02] active:scale-95"
        >
          {loading ? "Gönderiliyor..." : "Sıfırlama Linki Gönder"}
        </Button>

        <div className="text-center space-y-2">
          <button
            type="button"
            className="text-[10px] font-black uppercase text-gray-400 hover:text-blue-600"
            onClick={() => router.push("/login")}
          >
            Girişe Dön
          </button>
          <div>
            <Link
              href="/register"
              className="text-[10px] font-black uppercase text-gray-400 hover:text-blue-600"
            >
              Hesabın yok mu? Üye Ol
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
