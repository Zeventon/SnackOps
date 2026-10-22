import "server-only";
import { z } from "zod";
import { store } from "@/lib/store";
import { toolDefinitions, type ToolId } from "../../../tools/definitions";
import type { RegisteredTool } from "./schemas";
import { RegistryError } from "./errors";

export function isToolId(id: string): id is ToolId { return Object.hasOwn(toolDefinitions, id); }
// Zod JSON schemas may use null-prototype objects; RSC props must be plain JSON.
const plainSchema = (schema: z.ZodType): Record<string, unknown> => JSON.parse(JSON.stringify(z.toJSONSchema(schema)));
export async function listTools(enabledOnly = false): Promise<RegisteredTool[]> {
  return (await store.read("tools")).filter((tool) => !enabledOnly || (tool.enabled && isToolId(tool.id))).map((tool) => {
    const definition = isToolId(tool.id) ? toolDefinitions[tool.id] : null;
    return { ...tool, implemented: !!definition, inputSchema: definition ? plainSchema(definition.input) : {}, outputSchema: definition ? plainSchema(definition.output) : {}, testEndpoint: `/api/tools/${encodeURIComponent(tool.id)}/test` };
  });
}
export async function setToolEnabled(id: string, enabled: boolean) {
  if (enabled && !isToolId(id)) throw new RegistryError("旧注册项没有执行器，请启用对应的新工具", 409, "TOOL_NOT_IMPLEMENTED");
  let found = false;
  const tools = await store.update("tools", (items) => items.map((item) => { if (item.id !== id) return item; found = true; return { ...item, enabled }; }));
  if (!found) throw new RegistryError("工具不存在", 404, "TOOL_NOT_FOUND");
  return tools.find((tool) => tool.id === id)!;
}
export async function executeTool<K extends ToolId>(id: K, input: unknown): Promise<z.infer<(typeof toolDefinitions)[K]["output"]>> {
  const registered = (await store.read("tools")).find((tool) => tool.id === id);
  if (!registered?.enabled) throw new RegistryError(`工具 ${id} 未启用`, 409, "TOOL_DISABLED");
  return await toolDefinitions[id].run(input) as z.infer<(typeof toolDefinitions)[K]["output"]>;
}
