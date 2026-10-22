import { NextResponse } from "next/server";
import { evaluate } from "@/lib/services/evaluation";
import { apiError, checkOrigin } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const denied = checkOrigin(request); if (denied) return denied;
  try { return NextResponse.json(await evaluate(), { status: 201 }); } catch (error) { return apiError(error); }
}
