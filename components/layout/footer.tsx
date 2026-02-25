"use client";

import Link from "next/link";
import { Instagram, Linkedin, Twitter, Github, Youtube, Mail, Phone, MapPin } from "lucide-react";
import { useState, useEffect } from "react";
import { getSiteConfig } from "@/lib/site-config";

export function Footer() {
    const [siteConfig, setSiteConfig] = useState(getSiteConfig());

    useEffect(() => {
        const handleUpdate = () => setSiteConfig(getSiteConfig());
        window.addEventListener("site_config_updated", handleUpdate);
        return () => window.removeEventListener("site_config_updated", handleUpdate);
    }, []);

    return (
        <footer className="w-full bg-blue-950 text-blue-100/80">
            {/* Main Footer */}
            <div className="container mx-auto px-4 pt-20 pb-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
                    {/* Brand Info */}
                    <div className="lg:col-span-2 space-y-6">
                        <Link href="/" className="flex items-center space-x-2 font-bold font-heading text-2xl text-white">
                            <span className="bg-blue-600 px-2 py-1 rounded text-white mr-1">İŞ</span>GÜCÜ
                        </Link>
                        <p className="text-blue-100/60 max-w-sm leading-relaxed font-medium">
                            Türkiye'nin iş gücü potansiyelini dijital dünyaya taşıyoruz. Yetenek ve projenin en güvenli buluşma noktası.
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
                                    className="w-10 h-10 rounded-full bg-blue-900/50 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all duration-300 border border-blue-800"
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
                            {siteConfig.footerLinks.slice(0, 3).map(link => (
                                <li key={link.href}><Link href={link.href} className="hover:text-white transition-colors">{link.label}</Link></li>
                            ))}
                        </ul>
                    </div>

                    {/* Support & Legal */}
                    <div className="space-y-6">
                        <h3 className="text-white font-bold text-lg uppercase tracking-wider">Güvenlik</h3>
                        <ul className="space-y-4">
                            {siteConfig.footerLinks.slice(3).map(link => (
                                <li key={link.href}><Link href={link.href} className="hover:text-white transition-colors">{link.label}</Link></li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-6">
                        <h3 className="text-white font-bold text-lg uppercase tracking-wider">İletişim</h3>
                        <ul className="space-y-4">
                            <li className="flex items-center space-x-3">
                                <Mail className="w-5 h-5 text-blue-400" />
                                <span>merhaba@isgucu.com</span>
                            </li>
                            <li className="flex items-center space-x-3">
                                <Phone className="w-5 h-5 text-blue-400" />
                                <span>0850 555 0101</span>
                            </li>
                            <li className="flex items-start space-x-3">
                                <MapPin className="w-5 h-5 text-blue-400 shrink-0" />
                                <span className="text-sm">Levent, Büyükdere Cad. No:199, İstanbul</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-blue-900/50 bg-blue-950 py-8">
                <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 text-xs font-semibold uppercase tracking-widest text-blue-400">
                    <p>© 2026 İşgücü Teknoloji. Tüm Hakları Saklıdır.</p>
                    <div className="flex space-x-6">
                        <span className="cursor-default">Güvenli Ödeme SSL</span>
                        <span>TR / TL</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
