import { executeSkill } from "@/lib/services/executor";
import { registryId, skillTestSchema } from "@/lib/registry/schemas";
import { apiError, checkOrigin } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = checkOrigin(request); if (denied) return denied;
  try { return Response.json(await executeSkill(registryId.parse((await context.params).id), skillTestSchema.parse(await request.json()))); } catch (error) { return apiError(error); }
}

