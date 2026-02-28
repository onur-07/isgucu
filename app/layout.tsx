import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google"; // Corrected import
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
  title: "İşgücü | Premium Freelance Platformu",
  description: "Türkiye'nin en gelişmiş freelancer platformu.",
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
