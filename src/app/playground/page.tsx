import { PageHeading } from "@/components/page-heading";
import { PlannerForm } from "@/components/planner-form";
export const metadata = { title: "运行工作台" };
export default function Playground() { return <><PageHeading eyebrow="AGENT PLAYGROUND" title="运行工作台" description="验证问题 → Planner → Skill → Tool → 答复的完整链路。当前为本地规则模式。" /><PlannerForm /></>; }
