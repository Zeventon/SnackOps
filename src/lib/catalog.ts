import type { Collection } from "./schemas";
export const catalogLabels: Record<Collection, string> = {
  products: "商品", activities: "营销活动", coupons: "优惠券", orders: "订单", users: "用户",
  "return-policies": "售后政策", logistics: "物流", faq: "常见问题", tickets: "人工工单",
  "handoff-rules": "转人工规则", skills: "技能", tools: "工具", "tools-config": "工具配置",
  "skill-versions": "技能版本", runs: "运行记录", ratings: "用户评价", annotations: "标注",
  improvements: "改进建议", eval_cases: "评估用例", eval_batches: "评估批次", "ab-tests": "A/B 实验",
  "llm-config": "模型配置", "runtime-fallback": "兜底配置",
};
export const businessCollections: Collection[] = ["products", "activities", "coupons", "orders", "users", "return-policies", "logistics", "faq", "tickets", "handoff-rules"];
