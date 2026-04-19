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
          <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-[rgba(251,250,246,0.84)] px-6 py-3.5 backdrop-blur-md">
            <div className="mx-auto flex max-w-6xl items-center gap-8">
              <Link href="/opponents" className="flex items-center gap-2 text-[var(--foreground)] transition-colors hover:text-[var(--accent)]">
                <span className="text-base text-[var(--accent)]">♞</span>
                <span className="text-[15px] font-semibold tracking-[-0.03em]">PrepAgent</span>
              </Link>
              <nav className="flex flex-1 gap-6 text-sm text-[var(--foreground-soft)]">
                <Link href="/opponents" className="transition-colors hover:text-[var(--foreground)]">
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
