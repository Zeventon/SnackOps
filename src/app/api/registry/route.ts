import { listSkills } from "@/lib/registry/skills";
import { listTools } from "@/lib/registry/tools";
import { apiError } from "@/lib/http";
export const runtime = "nodejs";
export async function GET() { try { const [skills, tools] = await Promise.all([listSkills(true), listTools(true)]); return Response.json({ skills, tools }); } catch (error) { return apiError(error); } }

