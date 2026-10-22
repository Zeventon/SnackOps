"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ArrowUpRight, BookOpen, Boxes, ChevronDown, Cookie, Database, FlaskConical, LayoutDashboard, LifeBuoy, PanelLeftClose, Play, Ticket, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
export const links = [
  { href: "/", label: "运营概览", icon: LayoutDashboard, group: "工作空间" },
  { href: "/playground", label: "运行工作台", icon: Play },
  { href: "/studio", label: "Agent Studio", icon: Play },
  { href: "/studio/planner", label: "Planner 编排", icon: Boxes },
  { href: "/studio/ops", label: "运营与评测", icon: FlaskConical },
  { href: "/runs", label: "运行记录", icon: Activity },
  { href: "/tickets", label: "人工工单", icon: Ticket },
  { href: "/skills", label: "技能管理", icon: Boxes, group: "Agent 能力" },
  { href: "/tools", label: "工具管理", icon: Wrench },
  { href: "/evals", label: "评估中心", icon: FlaskConical },
  { href: "/data", label: "业务数据", icon: Database },
  { href: "/catalog", label: "数据目录", icon: BookOpen },
];
export function Navigation() {
  const pathname = usePathname();
  return <aside className="sidebar"><Link href="/" className="brand"><span className="brand-icon"><Cookie size={24} /></span><span>Snack<span className="text-primary">Ops</span></span><PanelLeftClose size={16} className="ml-auto text-stone-400 hidden lg:block" /></Link><div className="workspace"><div className="rounded-md bg-orange-100 p-2"><BookOpen size={16} className="text-orange-800" /></div><div><strong className="block text-xs">零食优选旗舰店</strong><span className="text-[11px] text-muted-foreground">本地演示工作空间</span></div><ChevronDown size={14} className="ml-auto text-stone-400" /></div><nav aria-label="主导航">{links.map(({ href, label, icon: Icon, group }) => <div key={href}>{group && <p className="nav-group">{group}</p>}<Link href={href} aria-current={pathname === href ? "page" : undefined} className={cn("nav-link", pathname === href && "active")}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{href === "/playground" && <span className="ml-auto text-[9px] rounded border border-current/20 px-1">LAB</span>}</Link></div>)}</nav><div className="sidebar-footer"><div className="flex items-center gap-2 text-xs text-stone-600"><span className="size-2 rounded-full bg-emerald-500" />本地规则模式 · 已启用</div><Link href="/data" className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><LifeBuoy size={15} />查看数据与运行配置<ArrowUpRight size={13} /></Link><div className="mt-5 flex items-center gap-2 border-t border-border pt-4"><span className="avatar">运</span><div><div className="text-xs font-medium">运营工作空间</div><div className="text-[10px] text-muted-foreground">SnackOps / Local</div></div></div></div></aside>;
}
export function Topbar() { const pathname = usePathname(); const current = links.find((item) => item.href === pathname); return <header className="topbar"><div className="flex items-center gap-2 text-xs text-muted-foreground"><span>工作空间</span><span className="text-stone-300">/</span><span className="text-foreground">{current?.label || "页面"}</span></div><div className="flex items-center gap-3"><span className="rounded border border-stone-200 px-2 py-1 text-[10px] tracking-wide text-stone-500">DEMO DATA</span><span className="text-xs text-muted-foreground hidden sm:block">开发环境</span><span className="avatar small">运</span></div></header>; }
