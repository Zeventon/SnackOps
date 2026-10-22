import { studioMutation } from "@/lib/studio/mutation";
import { NextResponse } from "next/server";
import { testSkill } from "@/lib/studio/engine";
export const runtime = "nodejs";
async function postHandler(req: Request) {
  try { const { skill, input } = await req.json(); return NextResponse.json(await testSkill(skill, input)); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 }); }
}

export async function POST(req: Request) { return studioMutation(req, () => postHandler(req)); }
