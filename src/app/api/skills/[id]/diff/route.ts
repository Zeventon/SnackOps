import { getSkillDiff } from "@/lib/registry/diff";
import { registryId } from "@/lib/registry/schemas";
import { z } from "zod";
import { apiError } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const search = new URL(request.url).searchParams; return Response.json(await getSkillDiff(registryId.parse((await context.params).id), z.string().min(1).parse(search.get("from")), search.get("to") || "current")); } catch (error) { return apiError(error); }
}

