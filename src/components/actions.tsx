"use client";
import { useRouter } from "next/navigation";
import { FlaskConical, LoaderCircle, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useAction } from "@/hooks/use-action";
export function TakeoverButton({ id, status }: { id: string; status: string }) {
  const router = useRouter(); const { pending, execute } = useAction();
  if (status === "resolved") return <span className="text-xs text-muted-foreground">处理完成</span>;
  return <Button variant="outline" disabled={pending} onClick={() => execute(`/api/tickets/${id}`, { method: "PATCH", body: JSON.stringify({ status: status === "pending" ? "processing" : "resolved" }) }, () => { toast.success(status === "pending" ? "已接管工单" : "工单已解决"); router.refresh(); })}>{pending ? <LoaderCircle size={14} className="animate-spin" /> : <UserRoundCheck size={14} />}{status === "pending" ? "接管" : "标记解决"}</Button>;
}
export function EvalButton() { const router = useRouter(); const { pending, error, execute } = useAction(); return <div><Button disabled={pending} onClick={() => execute<{ passed: number; total: number }>("/api/evals", { method: "POST" }, (data) => { toast.success(`评估完成：${data.passed}/${data.total} 通过`); router.refresh(); })}>{pending ? <LoaderCircle size={15} className="animate-spin" /> : <FlaskConical size={15} />}{pending ? "测试中…" : "运行评估"}</Button>{error && <p role="alert" className="text-xs text-red-700 mt-2">{error}</p>}</div>; }
