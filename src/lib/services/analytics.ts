import "server-only";
import type { Run } from "@/lib/schemas";
export function getWeeklyTrend(runs: Run[]) {
  const now = Date.now();
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now + 8 * 3600000 - (6 - i) * 86400000).toISOString().slice(0, 10);
    const dayRuns = runs.filter((run) => new Date(Date.parse(run.createdAt) + 8 * 3600000).toISOString().startsWith(date));
    return { date: date.slice(5).replace("-", "/"), success: dayRuns.filter((run) => run.status === "success").length, handoff: dayRuns.filter((run) => run.status === "handoff").length };
  });
}
