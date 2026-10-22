import { executeTool, isToolId } from "@/lib/registry/tools";
import { registryId } from "@/lib/registry/schemas";
import { RegistryError } from "@/lib/registry/errors";
import { apiError, checkOrigin } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = checkOrigin(request); if (denied) return denied;
  try { const id = registryId.parse((await context.params).id); if (!isToolId(id)) throw new RegistryError("此工具没有执行器", 409, "TOOL_NOT_IMPLEMENTED"); const started = performance.now(); const result = await executeTool(id, await request.json()); return Response.json({ toolId: id, durationMs: Math.round(performance.now() - started), result }); } catch (error) { return apiError(error); }
}

