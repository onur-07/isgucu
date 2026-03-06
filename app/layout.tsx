import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/components/auth/auth-context";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ChatWidget } from "@/components/layout/chat-widget";
import { PageOverride } from "@/components/layout/page-override";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://isgucu-s7i1.vercel.app"),
  title: "İşgücü | Premium Freelance Platformu",
  description: "Türkiye'nin gelişmiş freelancer platformu. Freelancer bul, iş ilanı ver, güvenli ödeme ile çalış.",
  applicationName: "İşgücü",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "/",
    siteName: "İşgücü",
    title: "İşgücü | Premium Freelance Platformu",
    description: "Freelancer hizmetleri, iş ilanları, güvenli ödeme ve hızlı eşleşme.",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "İşgücü" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "İşgücü | Premium Freelance Platformu",
    description: "Freelancer bul, iş ilanı ver, güvenli ödeme ile çalış.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: [{ url: "/logo.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={cn(
          "min-h-screen bg-background font-sans antialiased flex flex-col",
          inter.variable,
          outfit.variable
        )}
      >
        <AuthProvider>
          <Header />
          <main className="flex-1">
            <PageOverride>{children}</PageOverride>
          </main>
          <Footer />
          <ChatWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
