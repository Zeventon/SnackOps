import { listSkills } from "@/lib/registry/skills";
import { apiError } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(request: Request) { try { return Response.json(await listSkills(new URL(request.url).searchParams.get("enabled") === "true")); } catch (error) { return apiError(error); } }

