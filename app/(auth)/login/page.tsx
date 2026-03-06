import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-md">
                <div className="bg-white/80 backdrop-blur rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-blue-100/40 p-8 sm:p-10">
                    <div className="mb-8 text-center">
                        <div className="mx-auto h-12 w-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-xl shadow-blue-200">
                            İ
                        </div>
                        <div className="mt-3 text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">İŞGÜCÜ</div>
                    </div>
                    <LoginForm />
                </div>
                <div className="mt-6 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Güvenli giriş • Şifrelerin şifrelenir
                </div>
            </div>
        </div>
    );
}
