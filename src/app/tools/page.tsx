import { listTools } from "@/lib/registry/tools";
import { PageHeading } from "@/components/page-heading";
import { ToolWorkbench } from "@/components/registry/tool-workbench";
export const dynamic = "force-dynamic";
export const metadata = { title: "工具管理" };
export default async function Tools() { return <><PageHeading eyebrow="TOOL REGISTRY" title="工具管理" description="查看工具契约，控制启停，用真实业务数据验证单项能力。" /><ToolWorkbench initialTools={await listTools()} /></>; }
