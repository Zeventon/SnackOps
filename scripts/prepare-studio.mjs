import { readFile, writeFile, mkdir, rename, copyFile, access } from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
const root = process.cwd();
const marker = path.join(root, "data/studio/import-state.json");
try { await access(marker); console.log("Studio prompt import already completed; current edits preserved."); process.exit(0); } catch { /* first import */ }
const source = path.join(root, ".verification/reference-snack-agent-studio/snack-agent-studio-main");
const skills = JSON.parse(await readFile("data/skills.json", "utf8"));
const versions = JSON.parse(await readFile("data/skill-versions.json", "utf8"));
const configs = JSON.parse(await readFile(path.join(source, "data/skills.json"), "utf8"));
const backup = path.join(root, ".verification", `before-studio-${randomUUID()}`);
await mkdir(backup, { recursive: true });
for (const name of ["skills", "skill-versions"]) await copyFile(`data/${name}.json`, path.join(backup, `${name}.json`));
const hash = (skill) => createHash("sha256").update(JSON.stringify(Object.fromEntries(Object.entries(skill).sort(([a], [b]) => a.localeCompare(b, "en"))))).digest("hex");
const snapshot = (skill, kind, changeNote) => ({ id: `sv-${randomUUID()}`, skillId: skill.id, version: skill.version, createdAt: new Date().toISOString(), changeNote, hash: hash(skill), snapshot: structuredClone(skill), kind });
let imported = 0;
for (const config of configs) {
  if (!/^[a-z0-9-]+$/.test(config.id)) throw new Error("Invalid reference skill ID");
  const skill = skills.find((skill) => skill.id === config.id); if (!skill) continue;
  const markdown = await readFile(path.join(source, "skills", config.id, "SKILL.md"), "utf8");
  const match = markdown.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/); if (!match) throw new Error("Invalid reference Skill frontmatter");
  versions.unshift(snapshot(skill, "before-edit", "移植 Studio 前保留原版本"));
  const prompt = match[1].trim() + (skill.id === "risk-check" ? `\n\n## 原有可审计规则\n${skill.systemPrompt}` : "");
  const relative = `skills/${skill.id}/revisions/${randomUUID()}.md`;
  await mkdir(path.dirname(relative), { recursive: true }); await writeFile(relative, prompt, { flag: "wx" });
  const parts = skill.version.split(".").map(Number); parts[2]++;
  Object.assign(skill, { version: parts.join("."), filePath: relative, systemPrompt: prompt, inputSchema: config.inputSchema, outputSchema: config.outputSchema });
  versions.unshift(snapshot(skill, "saved", "导入参考工作台 Skill 正文及 JSON 契约")); imported++;
}
for (const [file, content] of [["data/skill-versions.json", versions], ["data/skills.json", skills]]) { const temp = `${file}.${randomUUID()}.tmp`; await writeFile(temp, JSON.stringify(content, null, 2) + "\n"); await rename(temp, file); }
await writeFile(marker, JSON.stringify({ importedAt: new Date().toISOString(), imported, backup }, null, 2));
console.log(`Imported ${imported} reference prompts with old and new snapshots; core local-rules models preserved.`);
