import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("data");
await mkdir(root, { recursive: true });
const now = "2026-10-15T02:30:00.000Z";
const datasets = {
  products: [
    { id: "p-01", name: "每日混合坚果 25g × 7袋", category: "坚果炒货", price: 39.9, stock: 236, allergens: ["坚果", "花生"] },
    { id: "p-02", name: "冻干草莓酸奶块 60g", category: "果干乳品", price: 22.8, stock: 128, allergens: ["牛奶"] },
    { id: "p-03", name: "海盐苏打饼干 300g", category: "饼干糕点", price: 16.9, stock: 420, allergens: ["小麦"] }
  ],
  activities: [{ id: "act-01", name: "秋日囤零食", description: "指定零食满 99 减 15，演示活动不可实际兑换。", startsAt: "2026-10-01", endsAt: "2026-10-31", status: "enabled" }],
  coupons: [{ id: "coupon-01", name: "新客尝鲜券", minimum: 59, discount: 10, status: "enabled" }],
  orders: [{ id: "SN100001", userId: "user-01", productIds: ["p-01", "p-02"], total: 62.7, status: "运输中", logisticsId: "log-01" }],
  users: [{ id: "user-01", name: "林小满（演示）", tier: "常客" }, { id: "user-02", name: "陈果果（演示）", tier: "新客" }],
  "return-policies": [{ id: "policy-01", title: "破损处理", content: "演示门店规则：签收后发现破损，请提供订单号、外包装和商品照片，由人工审核补发或退款。" }, { id: "policy-02", title: "退货咨询", content: "是否支持退货需要核实商品状态、原因和订单信息；客服审核前不承诺退款。" }],
  logistics: [{ id: "log-01", orderId: "SN100001", carrier: "顺丰速运（演示）", status: "运输中", latestEvent: "10月15日 09:20 已到达杭州转运中心，预计次日送达；此为静态演示记录。" }],
  faq: [{ id: "faq-01", question: "坚果含有哪些过敏原？", answer: "含坚果和花生；请以具体商品包装的配料与过敏原标签为准。" }, { id: "faq-02", question: "优惠券可以叠加吗？", answer: "演示规则：每笔订单限用一张优惠券。" }],
  tickets: [
    { id: "TK-1024", subject: "坚果礼盒外包装破损", customer: "林小满（演示）", category: "售后处理", priority: "high", status: "pending", updatedAt: now },
    { id: "TK-1023", subject: "订单配送地址需要修改", customer: "陈果果（演示）", category: "订单服务", priority: "normal", status: "pending", updatedAt: now },
    { id: "TK-1022", subject: "咨询酸奶块的过敏原", customer: "周一（演示）", category: "商品咨询", priority: "normal", status: "resolved", updatedAt: now }
  ],
  skills: [
    { id: "order-tracking", name: "订单物流查询", description: "识别订单号，查询订单及配送进度，缺少信息时转人工核实。", version: "1.2.0", status: "enabled", toolIds: ["query-order", "query-logistics"] },
    { id: "after-sales", name: "售后问题处理", description: "查询破损、退货处理政策，保留人工审核环节。", version: "1.1.0", status: "enabled", toolIds: ["query-policy"] },
    { id: "product-guide", name: "商品选购咨询", description: "检索商品价格、库存与过敏原，提供清楚的商品信息。", version: "1.0.0", status: "enabled", toolIds: ["query-product"] },
    { id: "human-handoff", name: "人工客服接管", description: "未覆盖的问题返回接管建议，运营可在工单中心处理已有工单。", version: "1.0.0", status: "enabled", toolIds: [] },
    { id: "promotion-guide", name: "活动优惠推荐", description: "规划中的优惠计算能力，暂未接入运行器。", version: "0.1.0", status: "draft", toolIds: [] }
  ],
  tools: [
    { id: "query-order", name: "查询订单", description: "读取演示订单数据", kind: "read", status: "enabled" },
    { id: "query-logistics", name: "查询物流", description: "读取物流节点与配送状态", kind: "read", status: "enabled" },
    { id: "query-policy", name: "查询售后政策", description: "检索门店演示售后政策", kind: "read", status: "enabled" },
    { id: "query-product", name: "检索商品", description: "查询商品与过敏原资料", kind: "read", status: "enabled" },
    { id: "issue-refund", name: "提交退款", description: "预留接口，尚未实现", kind: "write", status: "disabled" }
  ],
  "tools-config": { timeoutMs: 8000, retries: 1, allowWriteTools: false },
  "skill-versions": [{ id: "ver-01", skillId: "order-tracking", version: "1.2.0", notes: "订单号缺失时转人工核实", createdAt: now }],
  runs: Array.from({ length: 12 }, (_, i) => ({
    id: `run-demo-${String(i + 1).padStart(3, "0")}`, input: ["帮我查一下订单 SN100001 到哪里了", "收到的饼干破损了，可以处理吗", "每日坚果含花生吗", "可以开发票吗"][i % 4],
    intent: ["订单物流", "售后咨询", "商品咨询", "人工协助"][i % 4], skillId: ["order-tracking", "after-sales", "product-guide", "human-handoff"][i % 4], status: i % 4 === 3 ? "handoff" : "success",
    answer: ["演示物流：已到达杭州转运中心。", "请提供订单号和商品照片，由人工审核。", "每日混合坚果含坚果和花生。", "该问题需人工客服核实。"][i % 4],
    steps: [{ name: "演示轨迹", detail: "这是一条预置演示记录，可在运行工作台生成真实的本地执行记录。" }], createdAt: new Date(Date.parse(now) - i * 4 * 3600000).toISOString(), durationMs: 12 + i * 3, mode: "local-rules"
  })),
  ratings: [{ id: "rating-01", runId: "run-demo-001", score: 5, comment: "物流答复清楚（演示评价）" }],
  annotations: [{ id: "anno-01", runId: "run-demo-004", label: "能力缺口", note: "发票问题需要新增技能" }],
  improvements: [{ id: "improve-01", title: "增加发票咨询技能", status: "planned", source: "人工接管记录" }],
  eval_cases: [
    { id: "case-01", input: "订单 SN100001 到哪了", expectedIntent: "订单物流", expectedStatus: "success", category: "物流" },
    { id: "case-02", input: "商品破损如何退货", expectedIntent: "售后咨询", expectedStatus: "success", category: "售后" },
    { id: "case-03", input: "坚果有哪些过敏原", expectedIntent: "商品咨询", expectedStatus: "success", category: "商品" },
    { id: "case-04", input: "帮我开发票", expectedIntent: "人工协助", expectedStatus: "handoff", category: "兜底" },
    { id: "case-05", input: "帮我查询订单", expectedIntent: "订单物流", expectedStatus: "handoff", category: "信息缺失" }
  ],
  eval_batches: [{ id: "eval-demo-01", name: "初始回归样例（演示）", total: 5, passed: 5, createdAt: now, mode: "local-rules" }],
  "ab-tests": [{ id: "ab-01", name: "售后追问策略", variantA: "先询问订单", variantB: "先询问问题", status: "draft" }],
  "llm-config": { provider: "未配置", model: "未配置", enabled: false },
  "runtime-fallback": { mode: "local-rules", handoffOnUnknown: true, message: "未识别的问题建议转人工客服。" }
};
for (const [name, data] of Object.entries(datasets)) {
  const file = path.join(root, `${name}.json`);
  try { await access(file); } catch { await writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8"); }
}
console.log(`Checked ${Object.keys(datasets).length} seed files; existing data preserved.`);
await import("./migrate-registry.mjs");
