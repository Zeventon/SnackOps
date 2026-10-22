import "server-only";
import { randomUUID } from "node:crypto";
import { store } from "@/lib/store";
import { plan } from "./planner";
export async function evaluate() {
  const cases = await store.read("eval_cases");
  const results = await Promise.all(cases.map(async (item) => {
    const run = await plan(item.input);
    return run.intent === item.expectedIntent && run.status === item.expectedStatus;
  }));
  const batch = { id: `eval-${randomUUID()}`, name: "本地规则回归", total: cases.length, passed: results.filter(Boolean).length, createdAt: new Date().toISOString(), mode: "local-rules" as const };
  await store.update("eval_batches", (batches) => [batch, ...batches]);
  return batch;
}
