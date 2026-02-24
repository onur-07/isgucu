import Link from "next/link";
import { Instagram, Linkedin, Twitter } from "lucide-react";

export function Footer() {
    return (
        <footer className="w-full border-t border-white/10 bg-gradient-to-r from-blue-950 to-blue-900 py-12 md:py-16 text-white">
            <div className="container grid grid-cols-2 md:grid-cols-4 gap-8 px-4 md:px-6">
                <div className="flex flex-col space-y-4">
                    <Link href="/" className="flex items-center space-x-2 font-bold font-heading text-xl text-white">
                        İŞGÜCÜ
                    </Link>
                    <p className="text-sm text-white/70">
                        Türkiye'nin en hızlı büyüyen freelancer platformu. Hayallerinizi ertelemeyin.
                    </p>
                </div>
                <div className="flex flex-col space-y-4">
                    <h3 className="font-semibold text-white">Kurumsal</h3>
                    <Link href="/about" className="text-sm text-white/70 hover:text-white">Hakkımızda</Link>
                    <Link href="/contact" className="text-sm text-white/70 hover:text-white">İletişim</Link>
                    <Link href="/privacy" className="text-sm text-white/70 hover:text-white">Gizlilik Politikası</Link>
                </div>
                <div className="flex flex-col space-y-4">
                    <h3 className="font-semibold text-white">Kategoriler</h3>
                    <Link href="/categories/yazilim-mobil" className="text-sm text-white/70 hover:text-white">Yazılım & Mobil</Link>
                    <Link href="/categories/logo-grafik" className="text-sm text-white/70 hover:text-white">Logo & Grafik</Link>
                    <Link href="/categories/web-tasarim" className="text-sm text-white/70 hover:text-white">Web Tasarım</Link>
                </div>
                <div className="flex flex-col space-y-4">
                    <h3 className="font-semibold text-white">Destek</h3>
                    <Link href="/help" className="text-sm text-white/70 hover:text-white">Yardım Merkezi</Link>
                    <Link href="/rules" className="text-sm text-white/70 hover:text-white">Kurallar</Link>
                    <div className="flex space-x-4 pt-2">
                        <a
                            href="https://www.linkedin.com"
                            target="_blank"
                            rel="noreferrer"
                            aria-label="LinkedIn"
                            className="h-9 w-9 rounded-full bg-white/10 text-white flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors"
                        >
                            <Linkedin className="h-4 w-4" />
                        </a>
                        <a
                            href="https://x.com"
                            target="_blank"
                            rel="noreferrer"
                            aria-label="X"
                            className="h-9 w-9 rounded-full bg-white/10 text-white flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors"
                        >
                            <Twitter className="h-4 w-4" />
                        </a>
                        <a
                            href="https://www.instagram.com"
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Instagram"
                            className="h-9 w-9 rounded-full bg-white/10 text-white flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors"
                        >
                            <Instagram className="h-4 w-4" />
                        </a>
                    </div>
                </div>
            </div>
            <div className="container mt-12 pt-8 border-t border-white/10 text-center text-sm text-white/60">
                © 2026 İşgücü Platformu. Tüm hakları saklıdır.
            </div>
        </footer>
    );
}
