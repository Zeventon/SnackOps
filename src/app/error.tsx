"use client";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <div className="panel p-10 text-center"><AlertCircle className="mx-auto text-red-600" /><h1 className="mt-4 text-xl">页面加载失败</h1><p className="mt-3 mb-5 text-sm text-muted-foreground">暂时无法读取工作空间数据，请重试。若问题持续，请检查服务端日志与数据文件。</p><Button onClick={reset}><RefreshCw size={15} />重试</Button></div>; }
