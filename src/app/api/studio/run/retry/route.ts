import { studioMutation } from "@/lib/studio/mutation";
import { NextResponse } from "next/server";
import { runAgent } from "@/lib/studio/engine";
export const runtime = "nodejs";
async function postHandler(req: Request) {
  try { const { input, sessionId } = await req.json(); return NextResponse.json(await runAgent(input, { sessionId, retryLimit: 2 })); }
  catch (error: any) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error), detail: error?.cause?.message, trace: error?.trace, sessionId: error?.sessionId }, { status: 500 }); }
}

export async function POST(req: Request) { return studioMutation(req, () => postHandler(req)); }
