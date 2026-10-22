import { listTools, setToolEnabled } from "@/lib/registry/tools";
import { registryId } from "@/lib/registry/schemas";
import { RegistryError } from "@/lib/registry/errors";
import { z } from "zod";
import { apiError, checkOrigin } from "@/lib/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) { try { const id = registryId.parse((await context.params).id); const tool = (await listTools()).find((tool) => tool.id === id); if (!tool) throw new RegistryError("工具不存在", 404); return Response.json(tool); } catch (error) { return apiError(error); } }
export async function PATCH(request: Request, context: Context) {
  const denied = checkOrigin(request); if (denied) return denied;
  try { const { enabled } = z.object({ enabled: z.boolean() }).strict().parse(await request.json()); return Response.json(await setToolEnabled(registryId.parse((await context.params).id), enabled)); } catch (error) { return apiError(error); }
}

