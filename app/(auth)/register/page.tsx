import { RegisterForm } from "@/components/auth/register-form";
import Image from "next/image";

export default function RegisterPage() {
    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-md">
                <div className="bg-white/85 backdrop-blur rounded-[2.75rem] border border-gray-100 shadow-2xl shadow-blue-100/50 p-8 sm:p-10">
                    <div className="mb-8 text-center">
                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-xl shadow-blue-100 ring-1 ring-gray-100">
                            <Image
                                src="/logo.png"
                                alt="İşgücü"
                                width={44}
                                height={44}
                                className="h-11 w-11 object-contain"
                                priority
                            />
                        </div>
                        <div className="mt-4 text-[10px] font-black uppercase tracking-[0.35em] text-gray-400">İŞGÜCÜ</div>
                    </div>
                    <RegisterForm />
                </div>
            </div>
        </div>
    );
}
