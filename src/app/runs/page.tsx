import { store } from "@/lib/store";
import { PageHeading } from "@/components/page-heading";
import { RunList } from "@/components/run-list";
export const dynamic = "force-dynamic";
export const metadata = { title: "运行记录" };
export default async function Runs() { const runs = await store.read("runs"); return <><PageHeading eyebrow="EXECUTION LOGS" title="运行记录" description={`共 ${runs.length} 条记录。筛选状态、搜索问题，展开查看完整答复与执行轨迹。`} /><section className="panel"><RunList runs={runs} /></section></>; }
