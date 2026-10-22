import { getSkill, updateSkill } from "@/lib/registry/skills";
import { registryId, updateSkillSchema } from "@/lib/registry/schemas";
import { apiError, checkOrigin } from "@/lib/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) { try { return Response.json(await getSkill(registryId.parse((await context.params).id))); } catch (error) { return apiError(error); } }
export async function PATCH(request: Request, context: Context) {
  const denied = checkOrigin(request); if (denied) return denied;
  try { return Response.json(await updateSkill(registryId.parse((await context.params).id), updateSkillSchema.parse(await request.json()))); } catch (error) { return apiError(error); }
}

