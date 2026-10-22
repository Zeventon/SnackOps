import "server-only";
import { randomUUID } from "node:crypto";
import { store } from "@/lib/store";
import type { Run } from "@/lib/schemas";
import { listSkills } from "@/lib/registry/skills";
import { listTools } from "@/lib/registry/tools";
import { RegistryError } from "@/lib/registry/errors";
import { executeSkill } from "./executor";

export async function plan(input: string): Promise<Run> {
  const started = performance.now();
  let intent = "人工协助", skillId = "human-handoff", answer = "当前规则未覆盖这个问题，建议由人工客服接管。";
  let status: Run["status"] = "handoff";
  const steps: Run["steps"] = [{ name: "理解问题", detail: "使用本地关键词规则识别意图，未调用大模型。" }];
  if (/退货|退款|破损|售后/.test(input)) { intent = "售后咨询"; skillId = "after-sales"; }
  else if (/物流|快递|订单|到哪/.test(input)) { intent = "订单物流"; skillId = "order-tracking"; }
  else if (/坚果|零食|过敏|配料|商品/.test(input)) { intent = "商品咨询"; skillId = "product-guide"; }
  const [skills, tools] = await Promise.all([listSkills(true), listTools(true)]);
  const selected = skills.find((skill) => skill.id === skillId);
  try {
    if (!selected || selected.requiredTools.some((id) => !tools.some((tool) => tool.id === id))) throw new RegistryError("所需技能或依赖工具未启用", 409, "CAPABILITY_UNAVAILABLE");
    steps.push({ name: "读取启用注册项", detail: `${selected.name} v${selected.version} · ${selected.requiredTools.join("、") || "无外部工具"}` });
    const execution = await executeSkill(skillId, { input });
    answer = String(execution.output.answer || answer);
    status = execution.output.handoff || skillId === "human-handoff" ? "handoff" : "success";
    steps.push({ name: "执行技能", detail: `已按当前注册项执行，hash ${execution.hash.slice(0, 12)}` });
    const risk = await executeSkill("risk-check", { input, draft: answer });
    if (risk.output.canSend !== true) { status = "handoff"; answer = "拟发送答复未通过风险检查，请人工复核后处理。"; }
    steps.push({ name: "风险检查", detail: risk.output.canSend === true ? "安全答复允许发送" : "危险答复已阻断，建议人工接管" });
  } catch (error) {
    if (!(error instanceof RegistryError)) throw error;
    status = "handoff"; answer = `需要人工核实：${error.message}。`;
    steps.push({ name: "执行已停止", detail: `${error.code}：${error.message}` });
  }
  steps.push({ name: status === "success" ? "生成答复" : "建议接管", detail: "保留执行轨迹，供运营复核。" });
  return { id: `run-${randomUUID()}`, input, intent, skillId, status, answer, steps, mode: "local-rules", createdAt: new Date().toISOString(), durationMs: Math.round(performance.now() - started) };
}

export async function executeRun(input: string) {
  const run = await plan(input);
  await store.update("runs", (runs) => [run, ...runs]);
  return run;
}
