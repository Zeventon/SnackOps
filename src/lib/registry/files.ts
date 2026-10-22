import "server-only";
import * as fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { registryId } from "./schemas";
import { RegistryError } from "./errors";

const skillsRoot = path.resolve(/* turbopackIgnore: true */ process.env.SNACKOPS_SKILLS_DIR || path.join(process.cwd(), "skills"));
function inside(root: string, candidate: string) { const relative = path.relative(root, candidate); return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative); }
export async function resolveSkillFile(id: string, relativePath: string, createParents = false) {
  registryId.parse(id);
  const expected = `skills/${id}/`;
  if (!relativePath.startsWith(expected) || !/^(SKILL\.md|revisions\/[a-f0-9-]+\.md)$/.test(relativePath.slice(expected.length))) throw new RegistryError("不允许此技能文件路径", 400, "UNSAFE_PATH");
  const projectRoot = await fs.realpath(process.cwd());
  const canonicalSkills = await fs.realpath(skillsRoot);
  if (!inside(projectRoot, canonicalSkills)) throw new RegistryError("技能目录必须位于项目内", 400, "UNSAFE_PATH");
  const pieces = relativePath.slice("skills/".length).split("/");
  let current = canonicalSkills;
  for (let index = 0; index < pieces.length; index++) {
    current = path.join(current, pieces[index]);
    if (!inside(canonicalSkills, current)) throw new RegistryError("路径超出技能目录", 400, "UNSAFE_PATH");
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new RegistryError("技能路径不能包含符号链接", 400, "UNSAFE_PATH");
      if (index < pieces.length - 1 && !stat.isDirectory()) throw new RegistryError("技能父路径不是目录", 400, "UNSAFE_PATH");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      if (index < pieces.length - 1) { if (!createParents) throw error; await fs.mkdir(current); }
    }
  }
  return current;
}
export async function readSkillBody(id: string, filePath: string) { return fs.readFile(await resolveSkillFile(id, filePath), "utf8"); }
export async function writeSkillRevision(id: string, body: string) {
  const relativePath = `skills/${id}/revisions/${randomUUID()}.md`;
  const target = await resolveSkillFile(id, relativePath, true);
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    const file = await fs.open(temp, "wx", 0o600);
    try { await file.writeFile(body, "utf8"); await file.sync(); } finally { await file.close(); }
    await fs.rename(temp, target);
  } finally { await fs.unlink(temp).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; }); }
  return relativePath;
}
