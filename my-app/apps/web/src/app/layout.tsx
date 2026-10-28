// ============================================================
// apps/web/src/app/layout.tsx
// 全局根布局 — 挂载 Google Fonts 与全局样式
// ============================================================
import type { Metadata } from "next";
import { Inter, Cinzel } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// 复古模式衬线展示字（小型大写横幅 / 品牌字）
const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Butler — AI Study Workspace",
  description: "AI-powered multimodal learning workspace for tasks, calendar, notes, and study panels.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/assets/logo.png", apple: "/assets/logo.png" },
};

export const viewport = { themeColor: "#FAFAF8" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const app = <ToastProvider>{children}</ToastProvider>;
  return (
    <html lang="en" data-theme="paper" className={`${inter.variable} ${cinzel.variable}`}>
      <body>{app}</body>
    </html>
  );
}
