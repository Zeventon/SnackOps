import { studioMutation } from "@/lib/studio/mutation";
import { NextResponse } from "next/server";
import { runAgent } from "@/lib/studio/engine";
export const runtime = "nodejs";
async function postHandler(req: Request) {
  try {
    const { input, sessionId, retryLimit } = await req.json();
    if (!input?.trim()) return NextResponse.json({ error: "请输入客服问题" }, { status: 400 });
    return NextResponse.json(await runAgent(input.trim(), { sessionId, retryLimit }));
  } catch (e: any) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e), detail: e?.cause?.message, trace: e?.trace, sessionId: e?.sessionId }, { status: 500 });
  }
}

export async function POST(req: Request) { return studioMutation(req, () => postHandler(req)); }
