"use client";
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <html lang="zh-CN"><body style={{ fontFamily: "sans-serif", padding: 40 }}><h1>SnackOps 暂时无法加载</h1><p>请重试或检查服务端日志。</p><button onClick={reset}>重试</button></body></html>; }
