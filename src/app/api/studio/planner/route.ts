import { studioMutation } from "@/lib/studio/mutation";
import { NextResponse } from "next/server";
import { getPlanner, savePlanner } from "@/lib/studio/store";
import type { PlannerConfig } from "@/lib/studio/types";

export const runtime = "nodejs";
export async function GET() { return NextResponse.json(await getPlanner()); }
async function putHandler(req: Request) {
  try {
    const planner = await req.json() as PlannerConfig;
    await savePlanner(planner);
    return NextResponse.json({ ok: true, planner });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

export async function PUT(req: Request) { return studioMutation(req, () => putHandler(req)); }
