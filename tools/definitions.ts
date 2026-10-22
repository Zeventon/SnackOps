import "server-only";
import { z } from "zod";
import { store } from "@/lib/store";
import { productSchema, activitySchema, couponSchema, orderSchema, policySchema } from "@/lib/business-schemas";
import { RegistryError } from "@/lib/registry/errors";
import { schemas } from "@/lib/schemas";

function defineTool<I extends z.ZodType, O extends z.ZodType>(input: I, output: O, execute: (args: z.infer<I>) => Promise<z.infer<O>>) {
  return { input, output, async run(raw: unknown): Promise<z.infer<O>> { return output.parse(await execute(input.parse(raw))); } };
}
const optionalId = z.string().min(1).max(80).optional();
const validNow = (record: { startsAt: string; endsAt: string; status: string }) => record.status === "enabled" && Date.parse(record.startsAt) <= Date.now() && Date.now() < Date.parse(record.endsAt);
const isNew = (user: { isNewCustomer: boolean; historyOrderIds: string[] }) => user.isNewCustomer && user.historyOrderIds.length === 0;
const applies = (ids: string[], id: string) => ids.length === 0 || ids.includes(id);
async function requireUser(id: string) {
  const user = (await store.read("users")).find((item) => item.id === id);
  if (!user) throw new RegistryError("用户不存在", 404, "USER_NOT_FOUND");
  return user;
}
export const priceInput = z.object({
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(99) }).strict()).min(1).max(30),
  userId: optionalId, activityId: optionalId, couponId: optionalId,
}).strict();
const priceOutput = z.object({
  items: z.array(z.object({ productId: z.string(), name: z.string(), quantity: z.number().int(), unitPrice: z.number(), lineTotal: z.number() })),
  subtotal: z.number(), activityDiscount: z.number(), couponDiscount: z.number(), total: z.number().nonnegative(), currency: z.literal("CNY"), appliedAt: z.iso.datetime(),
});

export const toolDefinitions = {
  query_products: defineTool(z.object({
    keyword: z.string().max(100).optional(), category: z.string().optional(), tag: z.string().optional(),
    maxPrice: z.number().nonnegative().optional(), inStock: z.boolean().optional(), excludeAllergens: z.array(z.string()).max(20).optional(),
  }).strict(), z.object({ products: z.array(productSchema), total: z.number().int() }), async (args) => {
    const products = (await store.read("products")).filter((item) =>
      (!args.keyword || `${item.name} ${item.flavor} ${item.tags.join(" ")}`.toLowerCase().includes(args.keyword.toLowerCase())) &&
      (!args.category || item.category === args.category) && (!args.tag || item.tags.includes(args.tag)) &&
      (args.maxPrice === undefined || item.price <= args.maxPrice) && (!args.inStock || item.stock > 0) &&
      !args.excludeAllergens?.some((allergen) => item.allergens.includes(allergen)));
    return { products, total: products.length };
  }),
  query_activities: defineTool(z.object({ productId: optionalId, activeOnly: z.boolean().default(true) }).strict(), z.object({ activities: z.array(activitySchema) }), async (args) => ({ activities: (await store.read("activities")).filter((item) => (!args.activeOnly || validNow(item)) && (!args.productId || applies(item.applicableProductIds, args.productId))) })),
  query_coupons: defineTool(z.object({ userId: optionalId, productId: optionalId, activeOnly: z.boolean().default(true) }).strict(), z.object({ coupons: z.array(couponSchema), eligibilityChecked: z.boolean() }), async (args) => {
    const user = args.userId ? await requireUser(args.userId) : null;
    return { coupons: (await store.read("coupons")).filter((item) => (!args.activeOnly || validNow(item)) && (!args.productId || applies(item.applicableProductIds, args.productId)) && (!user || !item.newCustomerOnly || isNew(user))), eligibilityChecked: !!user };
  }),
  calculate_price: defineTool(priceInput, priceOutput, async (args) => {
    const products = await store.read("products");
    const quantities = new Map<string, number>();
    for (const item of args.items) quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
    const lines = Array.from(quantities, ([id, quantity]) => {
      const product = products.find((item) => item.id === id);
      if (!product) throw new RegistryError(`商品不存在：${id}`, 404, "PRODUCT_NOT_FOUND");
      if (quantity > product.stock) throw new RegistryError(`${product.name} 库存不足`, 409, "INSUFFICIENT_STOCK");
      const cents = Math.round(product.price * 100);
      return { productId: id, name: product.name, quantity, unitPrice: cents / 100, lineTotal: cents * quantity / 100, remaining: cents * quantity };
    });
    const subtotal = lines.reduce((sum, item) => sum + item.remaining, 0);
    if (args.userId) await requireUser(args.userId);
    let activityDiscount = 0, couponDiscount = 0;
    let stackable = true;
    // Allocate each discount in cents to eligible lines before calculating the next discount.
    function reduceEligible(ids: string[], discount: number) {
      const eligible = lines.filter((line) => applies(ids, line.productId));
      const sum = eligible.reduce((total, line) => total + line.remaining, 0);
      let remainingDiscount = Math.min(discount, sum);
      eligible.forEach((line, index) => {
        const deduction = index === eligible.length - 1 ? remainingDiscount : Math.min(line.remaining, Math.floor(discount * line.remaining / sum));
        line.remaining -= deduction; remainingDiscount -= deduction;
      });
    }
    if (args.activityId) {
      const activity = (await store.read("activities")).find((item) => item.id === args.activityId);
      if (!activity || !validNow(activity)) throw new RegistryError("活动不存在、未启用或不在有效期内", 409, "ACTIVITY_UNAVAILABLE");
      const eligible = lines.filter((line) => applies(activity.applicableProductIds, line.productId)).reduce((sum, line) => sum + line.remaining, 0);
      if (eligible === 0 || eligible < Math.round(activity.minimum * 100)) throw new RegistryError("未达到活动适用商品的金额门槛", 409, "ACTIVITY_THRESHOLD");
      activityDiscount = Math.min(Math.round(activity.discount * 100), eligible);
      reduceEligible(activity.applicableProductIds, activityDiscount); stackable = activity.stackableWithCoupon;
    }
    if (args.couponId) {
      if (!stackable) throw new RegistryError("此活动不能与优惠券叠加", 409, "DISCOUNT_STACKING");
      const coupon = (await store.read("coupons")).find((item) => item.id === args.couponId);
      if (!coupon || !validNow(coupon)) throw new RegistryError("优惠券不存在、未启用或不在有效期内", 409, "COUPON_UNAVAILABLE");
      if (coupon.newCustomerOnly && (!args.userId || !isNew(await requireUser(args.userId)))) throw new RegistryError("此券仅限已核实且无历史订单的新客", 409, "NEW_CUSTOMER_REQUIRED");
      const eligible = lines.filter((line) => applies(coupon.applicableProductIds, line.productId)).reduce((sum, line) => sum + line.remaining, 0);
      if (eligible === 0 || eligible < Math.round(coupon.minimum * 100)) throw new RegistryError("优惠后适用商品金额未达到优惠券门槛", 409, "COUPON_THRESHOLD");
      if (coupon.type === "percentage" && coupon.discount > 100) throw new RegistryError("折扣比例配置错误", 500, "INVALID_COUPON_CONFIG");
      couponDiscount = Math.min(coupon.type === "fixed" ? Math.round(coupon.discount * 100) : Math.round(eligible * coupon.discount / 100), eligible);
      reduceEligible(coupon.applicableProductIds, couponDiscount);
    }
    return { items: lines.map(({ productId, name, quantity, unitPrice, lineTotal }) => ({ productId, name, quantity, unitPrice, lineTotal })), subtotal: subtotal / 100, activityDiscount: activityDiscount / 100, couponDiscount: couponDiscount / 100, total: (subtotal - activityDiscount - couponDiscount) / 100, currency: "CNY" as const, appliedAt: new Date().toISOString() };
  }),
  query_orders: defineTool(z.object({ orderId: z.string().regex(/^SN\d{6}$/), userId: optionalId }).strict(), z.object({ order: orderSchema }), async ({ orderId, userId }) => {
    const order = (await store.read("orders")).find((item) => item.id === orderId && (!userId || item.userId === userId));
    if (!order) throw new RegistryError("未找到匹配订单", 404, "ORDER_NOT_FOUND");
    return { order };
  }),
  query_logistics: defineTool(z.object({ orderId: z.string().regex(/^SN\d{6}$/) }).strict(), z.object({ logistics: schemas.logistics.element }), async ({ orderId }) => {
    const logistics = (await store.read("logistics")).find((item) => item.orderId === orderId);
    if (!logistics) throw new RegistryError("未找到物流记录", 404, "LOGISTICS_NOT_FOUND");
    return { logistics };
  }),
  query_policies: defineTool(z.object({ category: z.enum(["damage", "missing", "return", "refund"]).optional() }).strict(), z.object({ policies: z.array(policySchema) }), async ({ category }) => ({ policies: (await store.read("return-policies")).filter((item) => !category || item.category === category) })),
};
export type ToolId = keyof typeof toolDefinitions;
