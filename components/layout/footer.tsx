"use client";

import Link from "next/link";
import { Instagram, Linkedin, Twitter, Github, Youtube, Mail, Phone, MapPin, Globe } from "lucide-react";
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { getSiteConfig } from "@/lib/site-config";

export function Footer() {
    const [siteConfig, setSiteConfig] = useState(getSiteConfig());

    useEffect(() => {
        const handleUpdate = () => setSiteConfig(getSiteConfig());
        window.addEventListener("site_config_updated", handleUpdate);
        return () => window.removeEventListener("site_config_updated", handleUpdate);
    }, []);

    const socialIconMap: Record<string, ReactNode> = {
        twitter: <Twitter className="w-5 h-5" />,
        x: <Twitter className="w-5 h-5" />,
        linkedin: <Linkedin className="w-5 h-5" />,
        instagram: <Instagram className="w-5 h-5" />,
        github: <Github className="w-5 h-5" />,
        youtube: <Youtube className="w-5 h-5" />,
    };

    const footerMenu = [
        ...siteConfig.footerLinks,
        ...(siteConfig.managedPages || [])
            .filter((p) => p.enabled && p.showInFooter && p.slug !== "/" && p.slug !== "/about")
            .map((p) => ({ href: p.slug, label: p.menuLabel || p.title })),
    ];

    return (
        <footer className="w-full bg-blue-950 text-blue-100/80">
            <div className="container mx-auto px-4 pt-20 pb-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <Link href="/" className="flex items-center space-x-3 font-bold font-heading text-2xl text-white">
                            <img src={siteConfig.logoUrl || "/logo.png"} alt="Logo" className="h-10 w-10 object-contain rounded-lg bg-blue-900/30 p-1" />
                            <span>{siteConfig.siteName || "İŞGÜCÜ"}</span>
                        </Link>
                        <p className="text-blue-100/60 max-w-sm leading-relaxed font-medium">{siteConfig.footerDescription}</p>
                        <div className="flex space-x-4">
                            {(siteConfig.socialLinks || []).map((social, i) => (
                                <a
                                    key={`${social.label}-${i}`}
                                    href={social.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-10 h-10 rounded-full bg-blue-900/50 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all duration-300 border border-blue-800"
                                >
                                    {socialIconMap[String(social.label || "").toLowerCase()] || <Globe className="w-5 h-5" />}
                                </a>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-white font-bold text-lg uppercase tracking-wider">Kurumsal</h3>
                        <ul className="space-y-4">
                            {footerMenu.slice(0, 3).map((link) => (
                                <li key={`${link.href}-${link.label}`}>
                                    <Link href={link.href} className="hover:text-white transition-colors">{link.label}</Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-white font-bold text-lg uppercase tracking-wider">Güvenlik</h3>
                        <ul className="space-y-4">
                            {footerMenu.slice(3).map((link) => (
                                <li key={`${link.href}-${link.label}`}>
                                    <Link href={link.href} className="hover:text-white transition-colors">{link.label}</Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-white font-bold text-lg uppercase tracking-wider">İletişim</h3>
                        <ul className="space-y-4">
                            <li className="flex items-center space-x-3">
                                <Mail className="w-5 h-5 text-blue-400" />
                                <span>{siteConfig.contactEmail}</span>
                            </li>
                            <li className="flex items-center space-x-3">
                                <Phone className="w-5 h-5 text-blue-400" />
                                <span>{siteConfig.contactPhone}</span>
                            </li>
                            <li className="flex items-start space-x-3">
                                <MapPin className="w-5 h-5 text-blue-400 shrink-0" />
                                <span className="text-sm">{siteConfig.contactAddress}</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="border-t border-blue-900/50 bg-blue-950 py-8">
                <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 text-xs font-semibold uppercase tracking-widest text-blue-400">
                    <p>© 2026 {siteConfig.siteName || "İşgücü"}. Tüm Hakları Saklıdır.</p>
                    <div className="flex space-x-6">
                        <span className="cursor-default">Güvenli Ödeme SSL</span>
                        <span>TR / TL</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
