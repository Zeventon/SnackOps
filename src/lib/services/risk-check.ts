import "server-only";
import { store } from "@/lib/store";
import { executeTool } from "@/lib/registry/tools";
import type { SkillTestInput } from "@/lib/registry/schemas";

export async function checkRisk({ input, draft = "", userId, quotedPrices = [] }: SkillTestInput) {
  const rules: { ruleId: string; name: string; passed: boolean; severity: "block" | "info"; evidence: string }[] = [];
  const add = (ruleId: string, name: string, safe: boolean, evidence: string) => rules.push({ ruleId, name, passed: safe, severity: safe ? "info" : "block", evidence });
  // Detect affirmative claims; a safe rejection such as “不承诺退款” is not a violation.
  const affirmative = (pattern: RegExp) => draft.split(/[。！？；\n]/).some((sentence) => {
    const match = pattern.exec(sentence);
    return !!match && !/(?:不|不能|无法|不要|切勿|禁止|勿|没有).{0,6}$/.test(sentence.slice(0, match.index));
  });
  const { products } = await executeTool("query_products", {});
  const mismatches = quotedPrices.filter((quote) => { const product = products.find((p) => p.id === quote.productId); return !product || Math.round(product.price * 100) !== Math.round(quote.unitPrice * 100); });
  // Also audit prices when a known product name and currency occur in the same sentence.
  for (const sentence of draft.split(/[。；\n]/)) {
    const product = products.find((p) => sentence.includes(p.name));
    const price = sentence.match(/[¥￥]\s*(\d+(?:\.\d+)?)/);
    if (product && price && Math.round(Number(price[1]) * 100) !== Math.round(product.price * 100)) mismatches.push({ productId: product.id, unitPrice: Number(price[1]) });
  }
  add("R01", "价格一致性", mismatches.length === 0, mismatches.length ? `报价不符：${mismatches.map((q) => q.productId).join("、")}` : "已核对结构化报价及可识别的商品价格；未识别报价需人工复核");
  add("R02", "极限词和功效", !affirmative(/全网最低|绝对安全|百分百安全|100%安全|治愈|治疗疾病|包治/), "检查肯定性极限词与食品治疗承诺");
  add("R03", "售后政策边界", !affirmative(/无条件退款|无需审核.{0,8}退款|保证.{0,8}退款|立刻退款|已经.{0,5}退款|立即到账/), "退款需人工审核，不得承诺未执行操作或即时到账");
  const user = userId ? (await store.read("users")).find((item) => item.id === userId) : undefined;
  const claimNew = affirmative(/你是新客|可享.{0,4}新客|给你.{0,4}新客|可以使用新客/);
  add("R04", "新客资格", !claimNew || !!(user?.isNewCustomer && user.historyOrderIds.length === 0), claimNew ? "已按用户状态及历史订单核实新客资格；具体用券仍需 calculate_price" : "未作新客资格承诺");
  const special = /儿童|孩子|宝宝|孕妇|怀孕|过敏|糖尿病|特殊人群/.test(input);
  add("R05", "特殊人群提醒", !special || /核对|标签|配料|过敏原|专业人员|医生|避免|停止食用/.test(draft), special ? "需要明确提醒核对标签/过敏原或咨询专业人员，不能保证适用" : "未识别特殊人群场景");
  add("R06", "投诉不推诿", !affirmative(/与我们无关|不归我们管|自己找快递|自己承担所有责任/), "检查投诉、售后中的推诿表述");
  const fraud = /中奖|兑奖|保证金|诈骗/.test(input);
  const requestsMoney = affirmative(/请.{0,8}转账|先.{0,8}转账|缴纳.{0,6}(保证金|兑奖费)|提供.{0,8}(密码|验证码|银行卡)|保证.{0,4}兑奖|承诺.{0,4}兑奖/);
  const safeFraudAdvice = /不要转账|切勿转账|不转账/.test(draft) && /不要提供|勿提供|不提供/.test(draft) && /官方.{0,8}核验/.test(draft) && /不承诺兑奖|不能承诺兑奖|无法承诺兑奖/.test(draft);
  add("R07", "中奖诈骗防护", !fraud ? !requestsMoney : !requestsMoney && safeFraudAdvice, fraud ? "须同时包含不转账、不提供敏感信息、不承诺兑奖和官方核验提醒" : "检查不当索款或敏感信息请求");
  add("R08", "安全答复放行", draft.trim().length > 0, "仅因回复违反具体规则而阻断；用户提到风险词不构成阻断理由");
  return { decision: rules.some((rule) => !rule.passed) ? "block" : "allow", canSend: rules.every((rule) => rule.passed), rules, scope: "可审计的本地规则检查，不替代全面语义审核" };
}
