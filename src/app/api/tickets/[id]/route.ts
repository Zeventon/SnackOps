import { NextResponse } from "next/server";
import { z } from "zod";
import { store } from "@/lib/store";
import { apiError, checkOrigin } from "@/lib/http";
export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = checkOrigin(request); if (denied) return denied;
  try {
    const { id } = await context.params;
    const { status } = z.object({ status: z.enum(["processing", "resolved"]) }).parse(await request.json());
    let found = false;
    await store.update("tickets", (items) => items.map((item) => { if (item.id !== id) return item; found = true; return { ...item, status, updatedAt: new Date().toISOString() }; }));
    return NextResponse.json(found ? { ok: true } : { error: "工单不存在" }, { status: found ? 200 : 404 });
  } catch (error) { return apiError(error); }
}
