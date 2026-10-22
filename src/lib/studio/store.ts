import "server-only";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { JsonStore } from "@/lib/json-store";
import { dataDirectory, store as core } from "@/lib/store";
import { createRegistrySkill, getSkill, listSkills, updateSkill } from "@/lib/registry/skills";
import { readSkillBody } from "@/lib/registry/files";
import { registryId } from "@/lib/registry/schemas";
import { RegistryError } from "@/lib/registry/errors";
import type { AnnotationRecord, Conversation, EvaluationCase, EvaluationResult, EvaluationSettings, McpServerConfig, PlannerConfig, PromptExperiment, RunMetric, ServiceRating, Skill, SkillRuntimeConfig, ToolConfig, VersionSnapshot } from "./types";

const object = z.record(z.string(), z.unknown());
const records = z.array(object);
const tool = z.object({ id: registryId, name: z.string().min(1), description: z.string(), implementation: z.enum(["json_query", "code", "mcp"]), dataSource: z.string(), enabled: z.boolean(), serverId: z.string().optional(), remoteName: z.string().optional(), inputSchema: object.optional() });
const server = z.object({ id: registryId, name: z.string().min(1), url: z.url(), authTokenEnv: z.string().regex(/^(?:[A-Z][A-Z0-9_]{0,79})?$/), enabled: z.boolean() });
const definitions = {
  products: z.array(z.object({ id: registryId, name: z.string().min(1), category: z.string(), price: z.number().nonnegative(), stock: z.number().int().nonnegative(), rating: z.number().min(0).max(5), description: z.string(), tags: z.array(z.string()) })),
  activities: z.array(z.object({ id: registryId, name: z.string(), type: z.enum(["threshold_reduction", "category_discount"]), threshold: z.number().nonnegative().optional(), discount: z.number().nonnegative().optional(), category: z.string().optional(), rate: z.number().min(0).max(1).optional(), enabled: z.boolean(), description: z.string() })),
  coupons: z.array(z.object({ id: registryId, name: z.string(), threshold: z.number().nonnegative(), discount: z.number().nonnegative(), category: z.string().optional(), enabled: z.boolean(), stackable: z.boolean() })),
  orders: records, "return-policies": object,
  skills: z.array(z.object({ id: registryId, model: z.string(), temperature: z.number().min(0).max(2), maxTokens: z.number().int().min(64).max(32768), enabled: z.boolean(), inputSchema: object.optional(), outputSchema: object.optional() })),
  tools: z.array(tool), "mcp-servers": z.array(server),
  planner: z.object({ id: z.literal("customer-service-planner"), name: z.string().min(1), description: z.string(), prompt: z.string().min(10).max(30000), model: z.string().min(1), temperature: z.number().min(0).max(2), maxTokens: z.number().int().min(64).max(32768), enabled: z.boolean(), requiredSkills: z.array(registryId).max(30), baseTools: z.array(registryId).max(30), priceTools: z.array(registryId).max(30) }),
  versions: z.array(z.object({ id: z.string(), kind: z.enum(["skills", "planner", "tools", "catalog"]), label: z.string(), createdAt: z.iso.datetime(), payload: z.unknown() })),
  conversations: z.array(z.object({ id: z.string(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string(), at: z.iso.datetime() })) })),
  metrics: records, "eval-cases": records, "eval-results": records, "eval-settings": z.object({ judgePrompt: z.string().min(10), updatedAt: z.string() }),
  experiments: z.array(z.object({ id: z.string(), name: z.string(), skillId: registryId, variantPrompt: z.string(), trafficPercent: z.number().min(0).max(100), enabled: z.boolean(), createdAt: z.string() })),
  handoffs: records, annotations: records, "service-ratings": records,
};
const root = path.resolve(/* turbopackIgnore: true */ process.env.SNACKOPS_STUDIO_DATA_DIR || path.join(dataDirectory, "studio"));
const json = new JsonStore(root, definitions);
type Key = keyof typeof definitions;
function key(file: string): Key {
  if (!/^[a-z-]+\.json$/.test(file) || !Object.hasOwn(definitions, file.slice(0, -5))) throw new RegistryError("不允许的数据文件路径", 400, "UNSAFE_PATH");
  return file.slice(0, -5) as Key;
}
export async function readData<T>(file: string): Promise<T> { return await json.read(key(file)) as T; }
export async function writeData<T>(file: string, value: T) { const name = key(file); await json.write(name, definitions[name].parse(value)); }
export async function createVersion(kind: VersionSnapshot["kind"], label: string, payload: unknown) {
  const version = { id: crypto.randomUUID(), kind, label, payload, createdAt: new Date().toISOString() };
  await json.update("versions", (items) => [version, ...items].slice(0, 200)); return version;
}
export async function getSkills(): Promise<Skill[]> {
  const [skills, configs] = await Promise.all([listSkills(), readData<SkillRuntimeConfig[]>("skills.json")]);
  return skills.map((skill) => ({ id: skill.id, name: skill.name, description: skill.description, prompt: skill.systemPrompt, enabled: skill.enabled, hash: skill.hash, model: configs.find((item) => item.id === skill.id)?.model || "default", temperature: skill.temperature, maxTokens: skill.maxTokens, inputSchema: skill.inputSchema as Skill["inputSchema"], outputSchema: skill.outputSchema as Skill["outputSchema"] }));
}
export async function readSkillFile(id: string) { const skill = await getSkill(registryId.parse(id)); return `---\nname: ${id}\ndescription: ${JSON.stringify(skill.description)}\n---\n\n${await readSkillBody(id, skill.filePath)}`; }
function validSkill(skill: Skill) { registryId.parse(skill.id); if (!skill.name?.trim() || !skill.description?.trim() || !skill.prompt?.trim()) throw new RegistryError("Skill 显示名称、描述和正文不能为空"); }
export async function createSkill(skill: Skill) {
  validSkill(skill);
  const created = await createRegistrySkill({ id: skill.id, name: skill.name, description: skill.description, systemPrompt: skill.prompt, enabled: skill.enabled, model: "local-rules", temperature: skill.temperature, maxTokens: skill.maxTokens, requiredTools: [], version: "1.0.0", inputSchema: skill.inputSchema, outputSchema: skill.outputSchema });
  await json.update("skills", (configs) => [...configs, { id: skill.id, model: skill.model, temperature: skill.temperature, maxTokens: skill.maxTokens, enabled: skill.enabled, inputSchema: skill.inputSchema, outputSchema: skill.outputSchema }]);
  return { ...skill, hash: created.hash };
}
export async function saveSkills(skills: Skill[]) {
  const current = await listSkills();
  if (new Set(skills.map((item) => item.id)).size !== skills.length) throw new RegistryError("Skill ID 重复");
  for (const skill of skills) { validSkill(skill); const before = current.find((item) => item.id === skill.id); if (!before) throw new RegistryError("请通过创建入口注册新 Skill"); if (skill.hash && skill.hash !== before.hash) throw new RegistryError("Skill 已被修改，请刷新后重试", 409); }
  await createVersion("skills", "保存 Skill 配置", await getSkills());
  for (const skill of skills) {
    const before = current.find((item) => item.id === skill.id)!;
    const changes = { name: skill.name, description: skill.description, systemPrompt: skill.prompt, enabled: skill.enabled, temperature: skill.temperature, maxTokens: skill.maxTokens, inputSchema: skill.inputSchema, outputSchema: skill.outputSchema };
    if (Object.entries(changes).some(([key, value]) => JSON.stringify(before[key as keyof typeof before]) !== JSON.stringify(value))) await updateSkill(skill.id, { expectedHash: before.hash, changes, changeNote: "Studio 保存 Skill 配置" });
  }
  await json.write("skills", skills.map(({ id, model, temperature, maxTokens, enabled, inputSchema, outputSchema }) => ({ id, model, temperature, maxTokens, enabled, inputSchema, outputSchema })));
}
const aliases: Record<string, string[]> = { query_order_logistics: ["query_orders", "query_logistics"], query_return_policy: ["query_policies"] };
export async function getTools(): Promise<ToolConfig[]> {
  const [tools, shared] = await Promise.all([readData<ToolConfig[]>("tools.json"), core.read("tools")]);
  return tools.map((tool) => { const ids = aliases[tool.id] || [tool.id]; const dependencies = ids.map((id) => shared.find((item) => item.id === id)).filter(Boolean); return { ...tool, enabled: tool.enabled && dependencies.every((item) => item!.enabled) }; });
}
export async function saveTools(tools: ToolConfig[]) {
  const valid = definitions.tools.parse(tools);
  await createVersion("tools", "保存 Tool 配置", await getTools());
  await core.update("tools", (shared) => shared.map((item) => { const tool = valid.find((tool) => tool.id === item.id || aliases[tool.id]?.includes(item.id)); return tool ? { ...item, enabled: tool.enabled, ...(tool.id === item.id ? { name: tool.name, description: tool.description } : {}) } : item; }));
  await json.write("tools", valid);
}
export async function getMcpServers() { return readData<McpServerConfig[]>("mcp-servers.json"); }
export async function saveMcpServers(servers: McpServerConfig[]) { await json.write("mcp-servers", definitions["mcp-servers"].parse(servers)); }
export async function getPlanner() { return readData<PlannerConfig>("planner.json"); }
export async function savePlanner(planner: PlannerConfig) {
  const valid = definitions.planner.parse(planner);
  if (!valid.requiredSkills.includes("risk-check")) throw new RegistryError("必经 Skill 必须包含 risk-check");
  await createVersion("planner", "保存 Planner 配置", await getPlanner()); await json.write("planner", valid);
}
export async function readToolImplementation(id: string) {
  const tool = (await getTools()).find((tool) => tool.id === id); if (!tool) throw new RegistryError("Tool 不存在", 404);
  if (tool.implementation === "json_query") return { kind: "json", path: `data/studio/${tool.dataSource}`, content: JSON.stringify(await readData(tool.dataSource), null, 2) };
  if (tool.implementation === "code") return { kind: "typescript", path: "src/lib/studio/engine.ts", content: await readFile(path.join(process.cwd(), "src/lib/studio/engine.ts"), "utf8") };
  return { kind: "json", path: `MCP / ${tool.serverId} / ${tool.remoteName}`, content: JSON.stringify(tool, null, 2) };
}
export async function getVersions() { return readData<VersionSnapshot[]>("versions.json"); }
export async function getConversations() { return readData<Conversation[]>("conversations.json"); }
export async function getConversation(id: string) { return (await getConversations()).find((item) => item.id === id); }
export async function saveConversation(item: Conversation) { await json.update("conversations", (all) => [item, ...all.filter((value) => value.id !== item.id)].slice(0, 100)); }
export async function appendMetric(item: RunMetric) { await json.update("metrics", (all) => [item, ...all].slice(0, 500)); }
export async function getMetrics() { return readData<RunMetric[]>("metrics.json"); }
export async function getEvaluationCases() { return readData<EvaluationCase[]>("eval-cases.json"); }
export async function saveEvaluationCases(items: EvaluationCase[]) { await json.write("eval-cases", items); }
export async function getEvaluationResults() { return readData<EvaluationResult[]>("eval-results.json"); }
export async function appendEvaluationResult(item: EvaluationResult) { await json.update("eval-results", (all) => [item, ...all].slice(0, 300)); }
export async function getEvaluationSettings() { return readData<EvaluationSettings>("eval-settings.json"); }
export async function saveEvaluationSettings(item: EvaluationSettings) { await json.write("eval-settings", item); }
export async function getExperiments() { return readData<PromptExperiment[]>("experiments.json"); }
export async function saveExperiments(items: PromptExperiment[]) { await json.write("experiments", items); }
export async function appendHandoff(item: Record<string, unknown>) { await json.update("handoffs", (all) => [item, ...all].slice(0, 200)); }
export async function getAnnotations() { return readData<AnnotationRecord[]>("annotations.json"); }
export async function saveAnnotations(items: AnnotationRecord[]) { await json.write("annotations", items.slice(0, 1000)); }
export async function getServiceRatings() { return readData<ServiceRating[]>("service-ratings.json"); }
export async function appendServiceRating(item: ServiceRating) { await json.update("service-ratings", (all) => [item, ...all].slice(0, 1000)); }
