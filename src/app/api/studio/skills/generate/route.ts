import { studioMutation } from "@/lib/studio/mutation";
import { NextResponse } from "next/server";
import { generateSkillDraft } from "@/lib/studio/engine";

export const runtime = "nodejs";
async function postHandler(req: Request) {
  try {
    const { request } = await req.json() as { request: string };
    return NextResponse.json({ skill: await generateSkillDraft(request) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) { return studioMutation(req, () => postHandler(req)); }
