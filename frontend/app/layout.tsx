import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import AuthInitializer from "@/components/layout/AuthInitializer";
import { ThemeScript } from "./theme-script";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "算法深度理解引擎",
  description: "深度理解算法本质，从原理到实战的全方位学习平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only z-[100] rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          跳转到主要内容
        </a>
        <Navbar />
        <AuthInitializer />
        <div className="flex min-h-[calc(100vh-4rem)]">
          <Sidebar />
          <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 overflow-hidden outline-none"
            style={{ animationDuration: '300ms', animationFillMode: 'both' }}
          >
            {children}
          </main>
        </div>
        <MobileNav />
      </body>
    </html>
  );
}
