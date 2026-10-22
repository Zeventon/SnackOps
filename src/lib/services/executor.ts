import "server-only";
import { requireEnabledSkill } from "@/lib/registry/skills";
import { executeTool } from "@/lib/registry/tools";
import { RegistryError } from "@/lib/registry/errors";
import { skillTestSchema, type SkillTestInput } from "@/lib/registry/schemas";
import { store } from "@/lib/store";
import { checkRisk } from "./risk-check";

export async function executeSkill(id: string, raw: SkillTestInput) {
  const input = skillTestSchema.parse(raw);
  const skill = await requireEnabledSkill(id);
  if (skill.model !== "local-rules") throw new RegistryError("此模型的执行适配器尚未配置；请使用 local-rules 测试或接入模型", 409, "MODEL_UNAVAILABLE");
  const started = performance.now();
  const output = await runLocal(id, input);
  return { skillId: id, version: skill.version, hash: skill.hash, mode: "local-rules", durationMs: Math.round(performance.now() - started), output };
}

async function runLocal(id: string, args: SkillTestInput): Promise<Record<string, unknown>> {
  const { input } = args;
  if (id === "risk-check") return checkRisk(args);
  if (id === "order-tracking") {
    const orderId = input.match(/SN\d{6}/i)?.[0].toUpperCase();
    if (!orderId) return { answer: "请提供有效的演示订单号（例如 SN100001），由人工核实订单归属后查询。", handoff: true };
    await executeTool("query_orders", { orderId });
    const { logistics } = await executeTool("query_logistics", { orderId });
    return { answer: `演示订单 ${orderId}：${logistics.carrier}，${logistics.status}。${logistics.latestEvent}`, logistics, handoff: false };
  }
  if (["after-sales", "after-sales-classification"].includes(id)) {
    const category = /破损/.test(input) ? "damage" : /缺件|少了/.test(input) ? "missing" : /退款/.test(input) ? "refund" : /退货|换货/.test(input) ? "return" : undefined;
    const { policies } = await executeTool("query_policies", { category });
    return { category: category || "unknown", policies, answer: policies.map((policy) => `${policy.title}：${policy.content}`).join("\n"), requiresHumanReview: true };
  }
  if (["product-guide", "recommendation-decision", "recommendation-reason", "product-substitution", "gift-scenario-advisor", "allergy-risk-reminder"].includes(id)) {
    const budget = input.match(/(?:预算|不超过)\s*(\d+(?:\.\d+)?)/)?.[1];
    const excluded = [...input.matchAll(/(?:对)?(花生|牛奶|小麦|坚果)过敏/g)].map((match) => match[1]);
    const { products } = await executeTool("query_products", { inStock: true, maxPrice: budget ? Number(budget) : undefined, excludeAllergens: excluded });
    let answer = products.length ? products.map((p) => `${p.name} ¥${p.price.toFixed(2)}，口味：${p.flavor}；过敏原：${p.allergens.join("、")}。`).join("\n") : "没有匹配且有库存的商品，请确认预算、口味和过敏禁忌。";
    if (/儿童|孕妇|过敏|孩子|宝宝|糖尿病/.test(input) || id === "allergy-risk-reminder") answer += "\n请核对包装配料和过敏原，必要时咨询专业人员；筛选结果不代表安全认证。";
    return { products, answer, substitutionRequiresConsent: id === "product-substitution" };
  }
  if (id === "need-extraction") return { budget: Number(input.match(/预算\s*(\d+)/)?.[1]) || null, scenario: /送礼/.test(input) ? "送礼" : null, allergens: [...input.matchAll(/(花生|牛奶|小麦|坚果)过敏/g)].map((m) => m[1]), raw: input };
  if (id === "clarification-question") return { answer: /订单|物流|退款/.test(input) ? "请提供订单号和需要处理的具体问题，不需要提供密码或验证码。" : "你的预算大约是多少？有没有需要避开的配料或过敏原？" };
  if (id === "conversation-summary") return { summary: input.slice(0, 600), completedActions: [], pending: ["人工核实摘要和下一步处理"], note: "本地规则仅截取并整理输入，不推断已执行动作" };
  if (["human-handoff", "human-handoff-decision", "complaint-triage"].includes(id)) {
    const matches = (await store.read("handoff-rules")).filter((rule) => rule.enabled && rule.triggers.some((trigger) => input.includes(trigger)));
    return { handoff: matches.length > 0 || id === "human-handoff", priority: matches.some((rule) => rule.priority === "high") ? "high" : "normal", rules: matches, answer: matches.length ? matches.map((rule) => rule.action).join("\n") : "当前问题需要人工核实，请补充具体诉求。", ticketCreated: false };
  }
  if (id === "response-generator") return { answer: args.draft || "请提供商品或订单问题，我会依据已核实的数据答复；涉及审批将由人工处理。", requiresRiskCheck: true };
  if (id === "对话问候-skill") return { answer: "你好，我是 SnackOps 零食客服。可以帮你选零食、查询演示订单或咨询售后。你想先了解什么？" };
  if (id === "promotion-guide") return { ...await executeTool("query_activities", {}), ...await executeTool("query_coupons", { userId: args.userId }), answer: "活动和优惠券需满足门槛、有效期与适用范围，最终价格请使用计算价格工具。" };
  throw new RegistryError("此技能没有本地执行适配器", 409, "SKILL_NOT_IMPLEMENTED");
}
