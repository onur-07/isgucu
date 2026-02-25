import Link from "next/link";
import { Instagram, Linkedin, Twitter, Github, Youtube, Mail, Phone, MapPin } from "lucide-react";

export function Footer() {
    return (
        <footer className="w-full bg-slate-900 text-slate-300">
            {/* Main Footer */}
            <div className="container mx-auto px-4 pt-20 pb-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
                    {/* Brand Info */}
                    <div className="lg:col-span-2 space-y-6">
                        <Link href="/" className="flex items-center space-x-2 font-bold font-heading text-2xl text-white">
                            <span className="bg-blue-600 px-2 py-1 rounded text-white mr-1">İŞ</span>GÜCÜ
                        </Link>
                        <p className="text-slate-400 max-w-sm leading-relaxed">
                            Türkiye'nin en modern ve güvenilir freelancer pazaryeri. Yetenekli uzmanları ve vizyoner projeleri bir araya getiriyoruz. Hayallerinizi birlikte inşa edelim.
                        </p>
                        <div className="flex space-x-4">
                            {[
                                { icon: <Twitter className="w-5 h-5" />, href: "https://twitter.com" },
                                { icon: <Linkedin className="w-5 h-5" />, href: "https://linkedin.com" },
                                { icon: <Instagram className="w-5 h-5" />, href: "https://instagram.com" },
                                { icon: <Github className="w-5 h-5" />, href: "https://github.com" },
                            ].map((social, i) => (
                                <a
                                    key={i}
                                    href={social.href}
                                    target="_blank"
                                    className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all duration-300"
                                >
                                    {social.icon}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="space-y-6">
                        <h3 className="text-white font-bold text-lg uppercase tracking-wider">Kurumsal</h3>
                        <ul className="space-y-4">
                            <li><Link href="/about" className="hover:text-blue-500 transition-colors">Hakkımızda</Link></li>
                            <li><Link href="/blog" className="hover:text-blue-500 transition-colors">Blog</Link></li>
                            <li><Link href="/careers" className="hover:text-blue-500 transition-colors">Kariyer</Link></li>
                            <li><Link href="/contact" className="hover:text-blue-500 transition-colors">İletişim</Link></li>
                        </ul>
                    </div>

                    {/* Support & Legal */}
                    <div className="space-y-6">
                        <h3 className="text-white font-bold text-lg uppercase tracking-wider">Destek</h3>
                        <ul className="space-y-4">
                            <li><Link href="/help" className="hover:text-blue-500 transition-colors">Yardım Merkezi</Link></li>
                            <li><Link href="/rules" className="hover:text-blue-500 transition-colors">Kullanım Koşulları</Link></li>
                            <li><Link href="/privacy" className="hover:text-blue-500 transition-colors">Gizlilik Politikası</Link></li>
                            <li><Link href="/support" className="hover:text-blue-500 transition-colors">Müşteri Desteği</Link></li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-6">
                        <h3 className="text-white font-bold text-lg uppercase tracking-wider">Bize Ulaşın</h3>
                        <ul className="space-y-4">
                            <li className="flex items-center space-x-3 italic">
                                <Mail className="w-5 h-5 text-blue-500" />
                                <span>destek@isgucu.com</span>
                            </li>
                            <li className="flex items-center space-x-3">
                                <Phone className="w-5 h-5 text-blue-500" />
                                <span>+90 (212) 555 0101</span>
                            </li>
                            <li className="flex items-start space-x-3">
                                <MapPin className="w-5 h-5 text-blue-500 shrink-0" />
                                <span>Levent, Büyükdere Cd. No:123, 34394 Şişli/İstanbul</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-slate-800 bg-slate-950/50 py-8">
                <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 text-sm">
                    <p>© 2026 İşgücü Teknoloji A.Ş. Tüm hakları saklıdır.</p>
                    <div className="flex space-x-6">
                        <span className="flex items-center space-x-1 cursor-default">
                            <span>Türkiye</span>
                        </span>
                        <span>TL (₺)</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
