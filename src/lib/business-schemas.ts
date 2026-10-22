import { z } from "zod";

const id = z.string().min(1);
const money = z.number().nonnegative();
export const productSchema = z.object({
  id, name: z.string(), category: z.string(), flavor: z.string(), price: money,
  stock: z.number().int().nonnegative(), tags: z.array(z.string()), ingredients: z.array(z.string()),
  allergens: z.array(z.string()), nutrition: z.object({ per: z.literal("100g"), energyKj: money, proteinG: money, fatG: money, carbohydrateG: money, sugarG: money, sodiumMg: money }),
  nutritionNote: z.string(),
});
export const activitySchema = z.object({
  id, name: z.string(), description: z.string(), minimum: money, discount: money,
  rule: z.literal("threshold-reduction"), startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }),
  applicableProductIds: z.array(id), stackableWithCoupon: z.boolean(), status: z.enum(["enabled", "draft", "disabled"]),
});
export const couponSchema = z.object({
  id, name: z.string(), type: z.enum(["fixed", "percentage"]), minimum: money, discount: money,
  startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }), applicableProductIds: z.array(id),
  newCustomerOnly: z.boolean(), status: z.enum(["enabled", "draft", "disabled"]),
});
export const orderSchema = z.object({
  id, userId: id, productIds: z.array(id), items: z.array(z.object({ productId: id, quantity: z.number().int().positive(), unitPrice: money })),
  total: money, status: z.string(), logisticsId: id, logisticsStatus: z.string(), afterSalesStatus: z.enum(["none", "requested", "reviewing", "completed"]),
});
export const userSchema = z.object({ id, name: z.string(), tier: z.string(), isNewCustomer: z.boolean(), historyOrderIds: z.array(id), preferences: z.object({ flavors: z.array(z.string()), avoidAllergens: z.array(z.string()), budget: money.nullable() }) });
export const policySchema = z.object({ id, title: z.string(), content: z.string(), category: z.enum(["damage", "missing", "return", "refund"]), requiresReview: z.boolean(), evidence: z.array(z.string()) });
export const handoffRuleSchema = z.object({ id, name: z.string(), triggers: z.array(z.string()), priority: z.enum(["normal", "high"]), action: z.string(), enabled: z.boolean() });
