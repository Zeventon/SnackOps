import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { store } from "@/lib/store";
import { skillSchema, type Skill, type SkillVersion, type RegisteredSkill, type updateSkillSchema } from "./schemas";
import type { z } from "zod";
import { RegistryError } from "./errors";
import { readSkillBody, resolveSkillFile, writeSkillRevision } from "./files";
import { listTools } from "./tools";

export function skillHash(skill: Skill) {
  return createHash("sha256").update(JSON.stringify(Object.fromEntries(Object.entries(skill).sort(([a], [b]) => a.localeCompare(b, "en"))))).digest("hex");
}
export async function listSkills(enabledOnly = false): Promise<RegisteredSkill[]> { return (await store.read("skills")).filter((skill) => !enabledOnly || skill.enabled).map((skill) => ({ ...skill, hash: skillHash(skill) })); }
export async function getSkill(id: string) {
  const skill = (await listSkills()).find((item) => item.id === id);
  if (!skill) throw new RegistryError("技能不存在", 404, "SKILL_NOT_FOUND");
  return skill;
}
export async function requireEnabledSkill(id: string) {
  const skill = await getSkill(id);
  if (!skill.enabled) throw new RegistryError(`技能 ${skill.name} 已停用`, 409, "SKILL_DISABLED");
  const activeTools = await listTools(true);
  const unavailable = skill.requiredTools.filter((id) => !activeTools.some((tool) => tool.id === id));
  if (unavailable.length) throw new RegistryError(`依赖工具未启用：${unavailable.join("、")}`, 409, "REQUIRED_TOOL_DISABLED");
  if (await readSkillBody(id, skill.filePath) !== skill.systemPrompt) throw new RegistryError("技能文件正文与注册信息不一致，请核对后通过编辑器保存", 409, "SKILL_FILE_MISMATCH");
  return skill;
}
function snapshot(skill: Skill, kind: SkillVersion["kind"], changeNote: string): SkillVersion {
  return { id: `sv-${randomUUID()}`, skillId: skill.id, version: skill.version, createdAt: new Date().toISOString(), changeNote, hash: skillHash(skill), snapshot: skill, kind };
}
export async function listVersions(id: string) { await getSkill(id); return (await store.read("skill-versions")).filter((version) => version.skillId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
export async function saveSnapshot(id: string, expectedHash: string, changeNote: string) {
  let saved!: SkillVersion;
  await store.update("skills", async (skills) => {
    const current = skills.find((skill) => skill.id === id);
    if (!current) throw new RegistryError("技能不存在", 404, "SKILL_NOT_FOUND");
    if (skillHash(current) !== expectedHash) throw new RegistryError("技能已被修改，请刷新后重试", 409, "VERSION_CONFLICT");
    await resolveSkillFile(id, current.filePath);
    saved = snapshot(current, "manual", changeNote);
    await store.update("skill-versions", (versions) => [saved, ...versions]);
    return skills;
  });
  return saved;
}
export async function updateSkill(id: string, request: z.infer<typeof updateSkillSchema>) {
  let updated!: Skill;
  await store.update("skills", async (skills) => {
    const current = skills.find((skill) => skill.id === id);
    if (!current) throw new RegistryError("技能不存在", 404, "SKILL_NOT_FOUND");
    if (skillHash(current) !== request.expectedHash) throw new RegistryError("技能已被修改，请刷新后重试；你的草稿仍保留在页面", 409, "VERSION_CONFLICT");
    await resolveSkillFile(id, current.filePath);
    const next = skillSchema.parse({ ...current, ...request.changes });
    const tools = await listTools();
    if (next.requiredTools.some((id) => !tools.some((tool) => tool.id === id && tool.implemented))) throw new RegistryError("依赖中包含未实现或不存在的工具", 400, "INVALID_TOOL_DEPENDENCY");
    // Persist the old body and metadata before any new revision or active pointer is written.
    await store.update("skill-versions", (versions) => [snapshot(current, "before-edit", `修改前：${request.changeNote}`), ...versions]);
    next.filePath = await writeSkillRevision(id, next.systemPrompt);
    await store.update("skill-versions", (versions) => [snapshot(next, "saved", request.changeNote), ...versions]);
    updated = next;
    return skills.map((skill) => skill.id === id ? next : skill);
  });
  return { ...updated, hash: skillHash(updated) };
}
export async function createRegistrySkill(input: Omit<Skill, "filePath">) {
  let created!: Skill;
  await store.update("skills", async (skills) => {
    if (skills.some((skill) => skill.id === input.id)) throw new RegistryError("Skill 已存在", 409, "SKILL_EXISTS");
    const next = skillSchema.parse({ ...input, filePath: `skills/${input.id}/SKILL.md` });
    next.filePath = await writeSkillRevision(next.id, next.systemPrompt);
    await store.update("skill-versions", (versions) => [snapshot(next, "initial", "从 Studio 创建 Skill"), ...versions]);
    created = next;
    return [...skills, next];
  });
  return { ...created, hash: skillHash(created) };
}
