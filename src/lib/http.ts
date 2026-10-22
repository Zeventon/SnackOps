import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { RegistryError } from "./registry/errors";
export function apiError(error: unknown) {
  if (error instanceof RegistryError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "请求格式不正确，请检查输入。" }, { status: 400 });
  console.error("SnackOps API error", error);
  return NextResponse.json({ error: "数据处理失败，请稍后重试。" }, { status: 500 });
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "不允许跨站写入。" }, { status: 403 });
}
