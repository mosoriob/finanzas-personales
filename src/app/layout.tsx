import type { Metadata } from "next";
import { DM_Sans, Caveat } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "mis finanzas",
  description: "tu plata, tu control",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${dmSans.variable} ${caveat.variable}`}>
      <body className="min-h-screen font-[family-name:var(--font-dm-sans)]">
        <Nav />
        <main className="max-w-[1060px] mx-auto px-4 md:px-10 py-6 md:py-8 pb-24 md:pb-20">
          {children}
        </main>
        <MobileBottomNav />
      </body>
    </html>
  );
}
