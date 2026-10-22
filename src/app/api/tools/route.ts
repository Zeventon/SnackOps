import { listTools } from "@/lib/registry/tools";
import { apiError } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(request: Request) { try { return Response.json(await listTools(new URL(request.url).searchParams.get("enabled") === "true")); } catch (error) { return apiError(error); } }

