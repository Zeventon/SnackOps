import "server-only";
import { getSkill, listVersions } from "./skills";
import { RegistryError } from "./errors";
import type { Skill } from "./schemas";
type DiffLine = { type: "same" | "added" | "removed"; text: string };
// Line LCS with a bounded cell count, falling back to a complete replacement for large prompts.
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split("\n"), b = after.split("\n");
  if (a.length * b.length > 250000) return [...a.map((text) => ({ type: "removed" as const, text })), ...b.map((text) => ({ type: "added" as const, text }))];
  const dp = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const result: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { result.push({ type: "same", text: a[i++] }); j++; }
    else if (j < b.length && (i === a.length || dp[i][j + 1] >= dp[i + 1][j])) result.push({ type: "added", text: b[j++] });
    else result.push({ type: "removed", text: a[i++] });
  }
  return result;
}
export async function getSkillDiff(id: string, from: string, to = "current") {
  const versions = await listVersions(id);
  const current = await getSkill(id);
  const resolve = (versionId: string): Skill => {
    if (versionId === "current") return current;
    const version = versions.find((item) => item.id === versionId);
    if (!version) throw new RegistryError("版本不存在", 404, "VERSION_NOT_FOUND");
    if (!version.snapshot) throw new RegistryError("旧版记录没有正文，无法生成 diff", 409, "LEGACY_SNAPSHOT_UNAVAILABLE");
    return version.snapshot;
  };
  const left = resolve(from), right = resolve(to);
  const fields = Object.keys(left).filter((key) => key !== "systemPrompt") as (keyof Skill)[];
  return { from, to, metadata: fields.filter((field) => JSON.stringify(left[field]) !== JSON.stringify(right[field])).map((field) => ({ field, before: left[field], after: right[field] })), lines: lineDiff(left.systemPrompt, right.systemPrompt) };
}
