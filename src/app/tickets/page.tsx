import { store } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { TakeoverButton } from "@/components/actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "人工工单" };
export default async function Tickets() { const tickets = await store.read("tickets"); return <><PageHeading eyebrow="HUMAN IN THE LOOP" title="人工工单" description="处理需要人工判断的问题，接管后标记解决，所有状态变更都会保存。" /><section className="panel overflow-x-auto">{tickets.length ? <table className="data-table"><thead><tr>{["工单", "客户", "优先级", "状态", "更新时间", "操作"].map((title) => <th key={title}>{title}</th>)}</tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id}><td><p className="font-medium whitespace-nowrap">{ticket.subject}</p><p className="text-xs text-muted-foreground mt-1">{ticket.id} · {ticket.category}</p></td><td className="whitespace-nowrap">{ticket.customer}</td><td><Badge tone={ticket.priority === "high" ? "orange" : "neutral"}>{ticket.priority === "high" ? "高优先级" : "普通"}</Badge></td><td><Badge tone={ticket.status === "resolved" ? "green" : "orange"}>{{ pending: "待接管", processing: "处理中", resolved: "已解决" }[ticket.status]}</Badge></td><td className="whitespace-nowrap">{formatDate(ticket.updatedAt)}</td><td><TakeoverButton id={ticket.id} status={ticket.status} /></td></tr>)}</tbody></table> : <EmptyState title="暂无工单" description="需要人工处理的问题将在这里统一跟进。" />}</section></>; }
