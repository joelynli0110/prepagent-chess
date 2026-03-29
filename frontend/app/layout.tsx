import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { LanguageProvider } from "@/lib/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { T } from "@/components/T";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PrepAgent",
  description: "Chess preparation analysis tool",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <LanguageProvider>
          <header className="sticky top-0 z-40 border-b border-gray-200 bg-white px-6 py-3.5">
            <div className="mx-auto flex max-w-6xl items-center gap-8">
              <Link href="/opponents" className="flex items-center gap-2 text-gray-900">
                <span className="text-base">♟</span>
                <span className="font-semibold tracking-tight">PrepAgent</span>
              </Link>
              <nav className="flex flex-1 gap-6 text-sm text-gray-500">
                <Link href="/opponents" className="hover:text-gray-900 transition-colors">
                  <T k="opponents_nav" />
                </Link>
              </nav>
              <LanguageSelector />
            </div>
          </header>
          <div className="min-h-screen">{children}</div>
        </LanguageProvider>
      </body>
    </html>
  );
}
