import { z } from "zod";

export const registryId = z.string().min(1).max(80).regex(/^[a-zA-Z0-9\u4e00-\u9fff_-]+$/, "ID 只能包含汉字、字母、数字、下划线和连字符");
export const skillSchema = z.object({
  id: registryId, name: z.string().min(1).max(100), description: z.string().min(1).max(1000),
  enabled: z.boolean(), model: z.string().min(1).max(120), temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(64).max(32768), requiredTools: z.array(registryId).max(20),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "版本格式应为 x.y.z"),
  filePath: z.string().min(1).max(250), systemPrompt: z.string().min(10).max(30000),
  inputSchema: z.record(z.string(), z.unknown()).optional(), outputSchema: z.record(z.string(), z.unknown()).optional(),
});
export const toolSchema = z.object({
  id: registryId, name: z.string().min(1), description: z.string(), enabled: z.boolean(),
  kind: z.enum(["read", "write"]), testInput: z.record(z.string(), z.unknown()),
});
export const skillVersionSchema = z.object({
  id: z.string(), skillId: registryId, version: z.string(), createdAt: z.iso.datetime(),
  changeNote: z.string(), hash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  snapshot: skillSchema.nullable(), kind: z.enum(["initial", "before-edit", "saved", "manual", "legacy"]),
}).refine((item) => item.kind === "legacy" || (item.snapshot !== null && item.hash !== null), "新快照必须包含正文、元数据及 hash");

export const skillChangesSchema = skillSchema.omit({ id: true, filePath: true }).partial().strict();
export const updateSkillSchema = z.object({
  expectedHash: z.string().regex(/^[a-f0-9]{64}$/),
  changes: skillChangesSchema.refine((changes) => Object.keys(changes).length > 0, "至少修改一个字段"),
  changeNote: z.string().trim().min(1).max(500),
}).strict();
export const snapshotRequestSchema = z.object({ expectedHash: z.string().regex(/^[a-f0-9]{64}$/), changeNote: z.string().trim().min(1).max(500) }).strict();
export const skillTestSchema = z.object({
  input: z.string().trim().min(1).max(2000), draft: z.string().max(8000).optional(), userId: z.string().optional(),
  quotedPrices: z.array(z.object({ productId: registryId, unitPrice: z.number().nonnegative() })).max(30).optional(),
}).strict();
export type Skill = z.infer<typeof skillSchema>;
export type SkillVersion = z.infer<typeof skillVersionSchema>;
export type ToolConfig = z.infer<typeof toolSchema>;
export type RegisteredSkill = Skill & { hash: string };
export type RegisteredTool = ToolConfig & { inputSchema: Record<string, unknown>; outputSchema: Record<string, unknown>; testEndpoint: string; implemented: boolean };
export type SkillTestInput = z.infer<typeof skillTestSchema>;
