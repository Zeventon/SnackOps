import { listVersions } from "@/lib/registry/skills";
import { registryId } from "@/lib/registry/schemas";
import { RegistryError } from "@/lib/registry/errors";
import { apiError } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  try { const { id, versionId } = await context.params; const version = (await listVersions(registryId.parse(id))).find((item) => item.id === versionId); if (!version) throw new RegistryError("版本不存在", 404); return Response.json(version); } catch (error) { return apiError(error); }
}

