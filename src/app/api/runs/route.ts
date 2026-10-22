import { NextResponse } from "next/server";
import { z } from "zod";
import { store } from "@/lib/store";
import { executeRun } from "@/lib/services/planner";
import { apiError, checkOrigin } from "@/lib/http";
export const runtime = "nodejs";
export async function GET() { try { return NextResponse.json(await store.read("runs")); } catch (error) { return apiError(error); } }
export async function POST(request: Request) {
  const denied = checkOrigin(request); if (denied) return denied;
  try {
    const { input } = z.object({ input: z.string().trim().min(2).max(1000) }).parse(await request.json());
    return NextResponse.json(await executeRun(input), { status: 201 });
  } catch (error) { return apiError(error); }
}
