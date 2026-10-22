import { readFile, writeFile, mkdir, rename, access, copyFile, lstat } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { newSkills, newTools, legacyPrompts } from "./registry-seed.mjs";

const root = process.cwd();
const dataDir = path.join(root, "data");
const backup = path.join(root, ".verification", `registry-migration-${randomUUID()}`);
const now = new Date().toISOString();
await mkdir(backup, { recursive: true });
async function read(name, fallback = []) { try { return JSON.parse(await readFile(path.join(dataDir, `${name}.json`), "utf8")); } catch (error) { if (error.code === "ENOENT") return fallback; throw error; } }
async function save(name, value) {
  const file = path.join(dataDir, `${name}.json`);
  try { await copyFile(file, path.join(backup, `${name}.json`)); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + "\n", "utf8"); await rename(temp, file);
}
function hash(value) { return createHash("sha256").update(JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "en"))))).digest("hex"); }
const productDetails = {
  "p-01": { flavor: "原味", tags: ["分装", "坚果"], ingredients: ["核桃仁", "腰果", "巴旦木", "花生"], nutrition: { per: "100g", energyKj: 2500, proteinG: 18, fatG: 49, carbohydrateG: 22, sugarG: 4, sodiumMg: 12 } },
  "p-02": { flavor: "草莓酸奶", tags: ["冻干", "酸甜"], ingredients: ["酸奶", "草莓", "白砂糖"], nutrition: { per: "100g", energyKj: 1800, proteinG: 10, fatG: 14, carbohydrateG: 62, sugarG: 38, sodiumMg: 110 } },
  "p-03": { flavor: "海盐", tags: ["酥脆", "分享装"], ingredients: ["小麦粉", "植物油", "海盐", "酵母"], nutrition: { per: "100g", energyKj: 1900, proteinG: 8, fatG: 18, carbohydrateG: 66, sugarG: 3, sodiumMg: 620 } },
};
let products = await read("products");
products = products.map((item) => ({ flavor: "原味", tags: [], ingredients: [], nutrition: { per: "100g", energyKj: 0, proteinG: 0, fatG: 0, carbohydrateG: 0, sugarG: 0, sodiumMg: 0 }, nutritionNote: "仅为功能测试的虚构营养数据，不作为膳食建议；实际以包装为准。", ...productDetails[item.id], ...item }));
await save("products", products);
const startsAt = "2026-10-01T00:00:00.000+08:00", endsAt = "2026-11-01T00:00:00.000+08:00";
await save("activities", (await read("activities")).map((item) => ({ minimum: 99, discount: 15, rule: "threshold-reduction", applicableProductIds: [], stackableWithCoupon: false, ...item, startsAt: item.startsAt.length === 10 ? startsAt : item.startsAt, endsAt: item.endsAt.length === 10 ? endsAt : item.endsAt })));
await save("coupons", (await read("coupons")).map((item) => ({ type: "fixed", startsAt, endsAt, applicableProductIds: [], newCustomerOnly: true, ...item })));
const orders = (await read("orders")).map((item) => ({ items: item.productIds.map((id) => ({ productId: id, quantity: 1, unitPrice: products.find((p) => p.id === id)?.price ?? 0 })), logisticsStatus: "运输中", afterSalesStatus: "none", ...item }));
await save("orders", orders);
await save("users", (await read("users")).map((item) => ({ isNewCustomer: !orders.some((order) => order.userId === item.id), historyOrderIds: orders.filter((order) => order.userId === item.id).map((order) => order.id), preferences: { flavors: item.id === "user-01" ? ["原味"] : ["酸甜"], avoidAllergens: [], budget: 100 }, ...item })));
const policies = (await read("return-policies")).map((item) => ({ category: /破损/.test(item.title) ? "damage" : "return", requiresReview: true, evidence: ["订单号", "商品及包装照片"], ...item }));
for (const item of [
  { id: "policy-missing", category: "missing", title: "缺件处理", content: "演示门店规则：请提供订单号、收到商品清单及包裹照片，由人工核对后确认补发或退款方案。", requiresReview: true, evidence: ["订单号", "收到商品清单", "包裹照片"] },
  { id: "policy-refund", category: "refund", title: "退款规则", content: "退款须核实订单及售后证据并经人工批准；金额以订单实付和审核结果为准，不承诺即时到账或无需审核。", requiresReview: true, evidence: ["订单号", "售后原因"] },
]) if (!policies.some((p) => p.id === item.id)) policies.push(item);
await save("return-policies", policies);
const handoff = await read("handoff-rules");
for (const item of [
  { id: "handoff-complaint", name: "投诉优先接管", triggers: ["投诉", "过敏", "异物", "不适"], priority: "high", action: "记录诉求与证据，优先交人工；不推诿，不作诊断。", enabled: true },
  { id: "handoff-refund", name: "退款人工审批", triggers: ["退款", "赔偿", "缺件"], priority: "normal", action: "收集订单号和必要凭证，交人工审核，不承诺已退款。", enabled: true },
  { id: "handoff-fraud", name: "疑似中奖诈骗", triggers: ["中奖", "兑奖", "保证金"], priority: "high", action: "提醒不要转账、不要提供敏感信息、不承诺兑奖，通过官方渠道核验。", enabled: true },
]) if (!handoff.some((rule) => rule.id === item.id)) handoff.push(item);
await save("handoff-rules", handoff);
const tools = (await read("tools")).map((item) => ({ id: item.id, name: item.name, description: item.enabled === undefined ? `${item.description}（旧注册项，已迁移到下划线命名工具）` : item.description, kind: item.kind, enabled: item.enabled ?? false, testInput: item.testInput ?? {} }));
for (const tool of newTools) if (!tools.some((item) => item.id === tool.id)) tools.push(tool);
await save("tools", tools);
const mappings = { "query-order": "query_orders", "query-logistics": "query_logistics", "query-policy": "query_policies", "query-product": "query_products" };
const skills = (await read("skills")).map((item) => item.systemPrompt ? item : ({ id: item.id, name: item.name, description: item.description, enabled: item.status === "enabled", model: "local-rules", temperature: 0.2, maxTokens: 2048, requiredTools: item.toolIds.map((id) => mappings[id] || id), version: item.version, filePath: `skills/${item.id}/SKILL.md`, systemPrompt: legacyPrompts[item.id] || `你是零食客服。${item.description}。只基于真实数据答复，无法核实时交人工。` }));
for (const skill of newSkills) if (!skills.some((item) => item.id === skill.id)) skills.push({ ...skill, filePath: `skills/${skill.id}/SKILL.md` });
for (const skill of skills) {
  if (!/^[a-zA-Z0-9\u4e00-\u9fff_-]+$/.test(skill.id) || !skill.filePath.startsWith(`skills/${skill.id}/`) || skill.filePath.split(/[\\/]/).includes("..")) throw new Error("Unsafe skill seed path");
  const file = path.resolve(root, skill.filePath);
  if (!file.startsWith(path.join(root, "skills") + path.sep)) throw new Error("Skill path outside project");
  // Bootstrap must not follow a junction/symlink out of the skill directory either.
  let current = root;
  const parts = skill.filePath.split("/");
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) throw new Error("Symbolic links are forbidden in skill seed paths");
      if (index < parts.length - 1 && !stat.isDirectory()) throw new Error("Invalid skill seed parent directory");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      if (index < parts.length - 1) await mkdir(current);
    }
  }
  try { await access(file); } catch { await writeFile(file, skill.systemPrompt, { encoding: "utf8", flag: "wx" }); }
}
const versions = (await read("skill-versions")).map((item) => "snapshot" in item ? item : { id: item.id, skillId: item.skillId, version: item.version, createdAt: item.createdAt, changeNote: `${item.notes}（旧版仅保留元数据，无历史正文）`, hash: null, snapshot: null, kind: "legacy" });
for (const skill of skills) if (!versions.some((v) => v.skillId === skill.id && v.snapshot)) versions.push({ id: `sv-${randomUUID()}`, skillId: skill.id, version: skill.version, createdAt: now, changeNote: "注册系统初始化快照", hash: hash(skill), snapshot: skill, kind: "initial" });
await save("skill-versions", versions);
await save("skills", skills);
console.log(`Registry migration completed: ${skills.length} skills, ${tools.length} tools. Originals backed up to ${backup}`);
