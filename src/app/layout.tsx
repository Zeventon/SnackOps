import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
import "./studio.css";
export const metadata: Metadata = { title: { default: "SnackOps · 运营概览", template: "%s · SnackOps" }, description: "零食电商客服 Agent 运营工作空间" };
export const runtime = "nodejs";
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><body><a href="#main-content" className="skip-link">跳转到主要内容</a><AppShell>{children}</AppShell><Toaster richColors position="top-right" closeButton /></body></html>; }
