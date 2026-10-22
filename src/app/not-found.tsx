import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() { return <div className="panel p-12 text-center"><p className="eyebrow">404 / NOT FOUND</p><h1>没有找到这个页面</h1><p className="text-sm text-muted-foreground my-4">请检查地址，或返回运营工作空间。</p><Button asChild><Link href="/">返回概览</Link></Button></div>; }
