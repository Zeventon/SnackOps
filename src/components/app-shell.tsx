"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Navigation, Topbar } from "./navigation";
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/studio")) return <div className="studio"><div className="import-notice">Snack Agent Studio · <Link href="/">返回运营概览</Link> · <Link href="/skills">统一能力注册</Link> · 此工作台的数据目录保留压缩包演示样例；模型密钥由服务端环境变量提供。</div><div id="main-content">{children}</div></div>;
  return <><Navigation /><div className="app-main"><Topbar /><main id="main-content" className="page-content">{children}</main><footer className="page-footer"><span>SnackOps <span className="text-stone-300 mx-2">/</span> 让每一次客服交互都有据可循</span><span>运营工作空间 · v0.2.0</span></footer></div></>;
}
