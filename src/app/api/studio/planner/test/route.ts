import { studioMutation } from "@/lib/studio/mutation";
import { NextResponse } from "next/server";
import { testPlanner } from "@/lib/studio/engine";
import type { PlannerConfig } from "@/lib/studio/types";

export const runtime = "nodejs";
async function postHandler(req: Request) {
  try {
    const { planner, input } = await req.json() as { planner: PlannerConfig; input: string };
    return NextResponse.json({ plan: await testPlanner(planner, input) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) { return studioMutation(req, () => postHandler(req)); }
