# Snack Agent Studio 移植说明

根据用户提供的 `snack-agent-studio-main.zip` 移植，保留原项目页面与业务流程，整合到现有 Next.js 16 / React 19 / pnpm 项目。压缩包内文档仅作为参考，没有运行其中的安装或 Shell 指令。

## 入口

运行 `pnpm dev` 后访问 `http://localhost:5000/studio`。原来的 `/` 运营概览、`/playground` 本地规则测试、`/skills` 注册中心、`/tools` 单项测试和原有业务页保留。

完整移植页面：

- `/studio`：多轮 Agent、Planner 计划、输入/输出 Trace、重试、风险结果、解释、服务评分和人工接管。
- `/studio/demo`：面向客户的聊天界面，显示真实模型配置状态；移除原包中冒充新会话的预置成交对话。
- `/studio/planner`：模型参数、Prompt、必经 Skill、基础/价格 Tool、可视化顺序、计划预览和解释。
- `/studio/skills`：配置、标准 Skill 文件预览、输入/输出契约、模型测试、手动创建、自然语言生成草案、确认创建。
- `/studio/tools`：元数据、启停、JSON/代码/MCP 源预览、Streamable HTTP Server 发现和导入。
- `/studio/ops`：运行监控、改进建议、人工评估、服务评分、评测集、分层评测、数据标注、版本回滚、Prompt A/B。
- `/studio/catalog`：维护原包的商品、活动、优惠券；结构校验、原子保存和修改前快照。

兼容入口 `/agent`、`/demo`、`/planner`、`/ops` 会重定向到对应工作台。API 统一移入 `/api/studio/*`，与原有 API 共存。

## 数据与注册的关系

原包的历史会话、评测、标注、评分和商品样例存于 `data/studio/`。这是独立的参考业务数据集，不覆盖原有 `data/products.json`、订单、工单、运行记录。页面顶部说明了工作台的数据来源；旧历史记录不代表本项目刚运行的真实供应商结果。

Skill 正文、名称、启停、温度、Token 和输入输出 schema 与现有 `data/skills.json` 注册中心共享。13 个参考 Skill 正文已导入为新版本，修改前版本和文件保留；risk-check 同时保留原有 R01–R08 审计规则。原有 `local-rules` 配置保留供旧工作台使用，Studio 的模型选择来自 `data/studio/skills.json`，默认 `default` 使用服务端配置。

Studio 保存 Skill 会调用现有快照和 hash 冲突校验；创建会调用现有路径校验与版本存储。保存成功后页面刷新 hash，避免下一次保存误报冲突。旧版本回滚是一项显式操作，会再次创建当前配置快照。

本地 Tool 的启停与现有注册项同步：`query_products`、`query_activities`、`query_coupons`、`calculate_price` 直接对应；参考包的 `query_order_logistics` 对应原有订单与物流查询的启停，`query_return_policy` 对应售后政策查询。Studio 的这些实现读取 `data/studio` 样例；原工作台仍读原业务数据。新增远程 MCP Tool 由 Studio 单独注册和执行。

## 存储与可靠性调整

原包存储实现已替换为现有 `JsonStore`：白名单文件、Zod 校验、进程内按文件锁、同目录临时文件、fsync、原子 rename、失败保留旧文件及 Windows 有界重试。

新增写入路由通过统一入口拒绝显式跨源写入并串行处理写操作。会话、指标、评分等追加使用 `store.update`，避免并发读改写丢失。沿用单进程及单实例边界；配置回滚和跨文件更新不构成数据库事务。

同时修正了参考包中的以下问题：

- 商品筛选无结果时不再回退到全部商品，避免返回缺货或超预算候选。
- 价格以整数分计算，尊重品类券、门槛、折扣和 `stackable`，未核实身份时不自动使用新人券；每款各一件试算，不含运费。
- 运行前和逐步骤检查启用状态；风控停用时拒绝生成最终答复。
- 风控失败不直接发送模型自称安全、但未复核的 `safe_reply`。
- 模型和 MCP 请求增加超时；MCP 分页拒绝重复 cursor 和超量分页。
- 全部模型调用明确要求 JSON；错误中不回显当前模型密钥。
- 标注 GET 保留历史更新时间，仅保存时更新时间。
- 克隆 CSS 限定在 `.studio`，动画名也隔离；修复移动端流程条造成的页面溢出。

## 模型配置

在项目根目录 `.env.local` 配置，重启服务：

```dotenv
OPENAI_API_KEY=你的密钥
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

也保留原包的 `DEEPSEEK_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` 兼容读取。优先级和实现见 `src/lib/studio/engine.ts`；设置兼容地址时应修改 `AI_BASE_URL`。

使用 Chat Completions 的 JSON 模式；供应商及所选模型需支持相应参数。契约依据：[Chat Completions 官方文档](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)、[Structured Outputs / JSON mode](https://developers.openai.com/api/docs/guides/structured-outputs)。

未配置密钥时页面显示“模型未配置”，实际模型执行返回错误，不伪造成功。原 `/playground` 仍可使用不需要密钥的本地规则。密钥只留在环境变量；MCP 页面只保存 Token 环境变量名，不保存明文 Token。尚未用真实供应商密钥验收推理质量。

## 验证

```sh
pnpm validate
pnpm build
pnpm test:studio
pnpm test:registry
pnpm test:store
```

`test:studio` 在 `.verification/studio-*/` 隔离复制数据和 Skill，启动生产构建（默认 5004，`STUDIO_TEST_PORT` 可覆盖），用随机本地端口运行模型/MCP 协议桩。测试会停止并重新启动服务，覆盖持久化。没有真实密钥、费用或外部供应商调用。运行前需要 `pnpm build`。

不要并行运行 `test:registry`、`test:store` 和常规 `next dev`，它们共用 `.next/dev`。生产预览与生产模式集成测试可使用不同端口。

结果：`.verification/studio-results.json`、`.verification/studio-test.log`、`.verification/studio-build.log`、`.verification/studio-validate.log`。源码导入清单见 `.verification/studio-import-manifest.json`。`import-studio.mjs` 和 `prepare-studio.mjs` 是本次移植辅助脚本，日常启动不依赖压缩包或 `.verification` 目录。
