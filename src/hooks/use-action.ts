"use client";
import { useState } from "react";
import { toast } from "sonner";
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function execute<T>(url: string, options: RequestInit, onSuccess: (data: T) => void | Promise<void>) {
    setPending(true); setError(null);
    try {
      const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "请求失败，请重试");
      await onSuccess(data);
    } catch (error) { const message = error instanceof Error ? error.message : "请求失败"; setError(message); toast.error(message); }
    finally { setPending(false); }
  }
  return { pending, error, execute };
}
