import { store } from "@/lib/store";
import { businessCollections, catalogLabels } from "@/lib/catalog";
import { apiError } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const type = new URL(request.url).searchParams.get("type");
    if (type) {
      const key = businessCollections.find((key) => key === type);
      if (!key) return Response.json({ error: "未知业务数据类型" }, { status: 400 });
      return Response.json({ type, label: catalogLabels[key], data: await store.read(key) });
    }
    return Response.json(await Promise.all(businessCollections.map(async (key) => { const data = await store.read(key); return { type: key, label: catalogLabels[key], count: Array.isArray(data) ? data.length : 1 }; })));
  } catch (error) { return apiError(error); }
}
