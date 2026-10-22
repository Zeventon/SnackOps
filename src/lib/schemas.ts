import { z } from "zod";
import { productSchema, activitySchema, couponSchema, orderSchema, userSchema, policySchema, handoffRuleSchema } from "./business-schemas";
import { skillSchema, toolSchema, skillVersionSchema } from "./registry/schemas";
export { skillSchema, toolSchema } from "./registry/schemas";

const id = z.string().min(1);
export const ticketSchema = z.object({ id, subject: z.string(), customer: z.string(), category: z.string(), priority: z.enum(["normal", "high"]), status: z.enum(["pending", "processing", "resolved"]), updatedAt: z.iso.datetime() });
export const runSchema = z.object({ id, input: z.string(), intent: z.string(), status: z.enum(["success", "handoff", "failed"]), answer: z.string(), skillId: id, steps: z.array(z.object({ name: z.string(), detail: z.string() })), createdAt: z.iso.datetime(), durationMs: z.number().nonnegative(), mode: z.literal("local-rules") });
export const schemas = {
  products: z.array(productSchema),
  activities: z.array(activitySchema),
  coupons: z.array(couponSchema),
  orders: z.array(orderSchema),
  users: z.array(userSchema),
  "return-policies": z.array(policySchema),
  "handoff-rules": z.array(handoffRuleSchema),
  logistics: z.array(z.object({ id, orderId: id, carrier: z.string(), status: z.string(), latestEvent: z.string() })),
  faq: z.array(z.object({ id, question: z.string(), answer: z.string() })),
  tickets: z.array(ticketSchema),
  skills: z.array(skillSchema),
  tools: z.array(toolSchema),
  "tools-config": z.object({ timeoutMs: z.number().int().positive(), retries: z.number().int().nonnegative(), allowWriteTools: z.boolean() }),
  "skill-versions": z.array(skillVersionSchema),
  runs: z.array(runSchema),
  ratings: z.array(z.object({ id, runId: id, score: z.number().min(1).max(5), comment: z.string() })),
  annotations: z.array(z.object({ id, runId: id, label: z.string(), note: z.string() })),
  improvements: z.array(z.object({ id, title: z.string(), status: z.enum(["planned", "working", "done"]), source: z.string() })),
  eval_cases: z.array(z.object({ id, input: z.string(), expectedIntent: z.string(), expectedStatus: z.enum(["success", "handoff", "failed"]), category: z.string() })),
  eval_batches: z.array(z.object({ id, name: z.string(), total: z.number().int(), passed: z.number().int(), createdAt: z.iso.datetime(), mode: z.literal("local-rules") })),
  "ab-tests": z.array(z.object({ id, name: z.string(), variantA: z.string(), variantB: z.string(), status: z.enum(["draft", "running", "completed"]) })),
  "llm-config": z.object({ provider: z.string(), model: z.string(), enabled: z.boolean() }),
  "runtime-fallback": z.object({ mode: z.literal("local-rules"), handoffOnUnknown: z.boolean(), message: z.string() }),
};
export type Collection = keyof typeof schemas;
export type StoreData<K extends Collection> = z.infer<(typeof schemas)[K]>;
export type Run = z.infer<typeof runSchema>;
export type Ticket = z.infer<typeof ticketSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type Tool = z.infer<typeof toolSchema>;
