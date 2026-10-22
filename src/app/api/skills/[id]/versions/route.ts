import { listVersions, saveSnapshot } from "@/lib/registry/skills";
import { registryId, snapshotRequestSchema } from "@/lib/registry/schemas";
import { apiError, checkOrigin } from "@/lib/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) { try { return Response.json(await listVersions(registryId.parse((await context.params).id))); } catch (error) { return apiError(error); } }
export async function POST(request: Request, context: Context) {
  const denied = checkOrigin(request); if (denied) return denied;
  try { const body = snapshotRequestSchema.parse(await request.json()); return Response.json(await saveSnapshot(registryId.parse((await context.params).id), body.expectedHash, body.changeNote), { status: 201 }); } catch (error) { return apiError(error); }
}

