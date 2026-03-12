import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PrepAgent",
  description: "Chess preparation analysis tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="border-b bg-white px-6 py-3">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Link
              href="/opponents"
              className="flex items-center gap-2 font-semibold text-gray-900 hover:text-gray-600"
            >
              <span className="text-lg">♟</span>
              PrepAgent
            </Link>
            <nav className="flex gap-4 text-sm text-gray-500">
              <Link href="/opponents" className="hover:text-gray-900">
                Opponents
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
