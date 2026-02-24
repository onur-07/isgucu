"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setReady(true);
      if (!data.session) {
        setError(
          "Şifre sıfırlama oturumu bulunamadı. Lütfen e-postandaki şifre sıfırlama bağlantısını tekrar aç."
        );
      }
    };

    init();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const p1 = password.trim();
      const p2 = password2.trim();

      if (!p1 || p1.length < 6) {
        setError("Şifre en az 6 karakter olmalı.");
        return;
      }
      if (p1 !== p2) {
        setError("Şifreler eşleşmiyor.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: p1,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess("Şifre güncellendi. Giriş sayfasına yönlendiriliyorsun...");
      setTimeout(() => router.push("/login"), 1200);
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
          Yeni Şifre Belirle
        </h1>
        <p className="mt-2 text-xs text-gray-400 font-bold uppercase tracking-widest">
          E-postadan geldikten sonra yeni şifreni belirle.
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

        <div className="space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-[10px] font-black uppercase text-gray-400"
            >
              Yeni Şifre
            </Label>
            <Input
              id="password"
              type="password"
              required
              className="h-14 rounded-2xl bg-gray-50 border-gray-100 font-bold text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={!ready || !!success}
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="password2"
              className="text-[10px] font-black uppercase text-gray-400"
            >
              Yeni Şifre (Tekrar)
            </Label>
            <Input
              id="password2"
              type="password"
              required
              className="h-14 rounded-2xl bg-gray-50 border-gray-100 font-bold text-sm"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="••••••••"
              disabled={!ready || !!success}
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading || !ready || !!success}
          className="w-full h-14 text-white bg-blue-600 hover:bg-blue-700 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-100 transition-all hover:scale-[1.02] active:scale-95"
        >
          {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
        </Button>
      </form>
    </div>
  );
}
