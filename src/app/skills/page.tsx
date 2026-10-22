import { store } from "@/lib/store";
import { listSkills } from "@/lib/registry/skills";
import { listTools } from "@/lib/registry/tools";
import { PageHeading } from "@/components/page-heading";
import { SkillWorkbench } from "@/components/registry/skill-workbench";
export const dynamic = "force-dynamic";
export const metadata = { title: "技能管理" };
export default async function Skills() {
  const [skills, tools, versions] = await Promise.all([listSkills(), listTools(), store.read("skill-versions")]);
  return <><PageHeading eyebrow="SKILL REGISTRY" title="技能管理" description="管理客服能力、系统提示词与版本，让每一次调整都可追溯。" /><SkillWorkbench initialSkills={skills} initialVersions={versions} tools={tools} /></>;
}
