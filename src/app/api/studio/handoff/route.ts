import { studioMutation } from "@/lib/studio/mutation";
import { NextResponse } from "next/server";
import { appendHandoff } from "@/lib/studio/store";
export const runtime = "nodejs";
async function postHandler(req: Request) { const body = await req.json(); const item = { id: crypto.randomUUID(), ...body, status: "pending", createdAt: new Date().toISOString() }; await appendHandoff(item); return NextResponse.json({ ok: true, handoff: item }); }

export async function POST(req: Request) { return studioMutation(req, () => postHandler(req)); }
