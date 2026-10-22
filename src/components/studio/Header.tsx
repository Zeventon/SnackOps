"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Header({ mode }: { mode?: string }) {
  const path = usePathname();
  const [detectedMode, setDetectedMode] = useState(mode || "unknown");
  useEffect(() => {
    if (mode) { setDetectedMode(mode); return; }
    fetch("/api/studio/status").then(response => response.json()).then(data => setDetectedMode(data.ai?.mode || "unconfigured")).catch(() => setDetectedMode("unconfigured"));
  }, [mode]);
  return <header className="topbar">
    <div className="brand"><div className="brand-mark">S</div><span>SnackOps</span></div>
    <nav className="nav"><Link className={path === "/studio" ? "active" : ""} href="/studio">Agent</Link><Link className={path.startsWith("/studio/demo") ? "active" : ""} href="/studio/demo">Demo</Link><Link className={path.startsWith("/studio/planner") ? "active" : ""} href="/studio/planner">Planner</Link><Link className={path.startsWith("/studio/skills") ? "active" : ""} href="/studio/skills">Skill</Link><Link className={path.startsWith("/studio/tools") ? "active" : ""} href="/studio/tools">Tool</Link><Link className={path.startsWith("/studio/ops") ? "active" : ""} href="/studio/ops">运营</Link><Link className={path.startsWith("/studio/catalog") ? "active" : ""} href="/studio/catalog">数据</Link></nav>
    <div className="status"><i className={`dot ${detectedMode === "ai" ? "" : "off"}`}/> {detectedMode === "ai" ? "真实模型模式" : detectedMode === "unconfigured" ? "模型未配置" : "正在检查模型"}</div>
  </header>;
}
