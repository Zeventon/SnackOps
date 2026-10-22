import "server-only";
import { apiError, checkOrigin } from "@/lib/http";
const state = globalThis as typeof globalThis & { studioWrites?: Promise<void> };
export async function studioMutation(request: Request, operation: () => Promise<Response>) {
  const denied = checkOrigin(request); if (denied) return denied;
  if (Number(request.headers.get("content-length")) > 5 * 1024 * 1024) return Response.json({ error: "请求内容过大" }, { status: 413 });
  const previous = state.studioWrites || Promise.resolve();
  let release!: () => void;
  state.studioWrites = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try { return await operation(); } catch (error) { return apiError(error); }
  finally { release(); }
}
