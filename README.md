# SnackOps

零食电商客服 Agent / Planner / Skill / Tool / Eval 运营平台的本地全栈骨架。

已根据 `snack-agent-studio-main.zip` 补齐完整 Agent Studio，入口为 `/studio`，包含多轮聊天、真实模型适配、Planner、运营评测、标注、人工审核、A/B 和 MCP。原有页面保留；详见 [移植与运行说明](STUDIO.md)。

## 启动

需要 Node.js 20.9+（本机验证版本为 24.18.0）与 pnpm 11.25.0。

```sh
pnpm install
pnpm dev
```

打开 http://localhost:5000。开发和生产启动均默认使用 5000，可用 `DEPLOY_RUN_PORT` 覆盖。PowerShell 示例：

```powershell
$env:DEPLOY_RUN_PORT = '5002'
pnpm dev
```

生产运行：

```sh
pnpm build
pnpm start
```

所有要求的命令：`pnpm dev`、`pnpm build`、`pnpm start`、`pnpm lint`、`pnpm typecheck`、`pnpm validate`。`validate` 依次执行 typecheck 与 lint；lint 不允许警告。

## 已实现的交互

- `/`：从服务端 JSON 汇总运行量、成功率、工单、技能数量和近七日趋势。
- `/playground`：运行本地规则 Planner，展示技能选择、工具查询步骤、答复与耗时，并持久化运行记录。
- `/runs`：状态筛选、关键词搜索、展开执行轨迹。
- `/tickets`：接管和标记解决，状态持久化。
- `/skills`：启停、编辑模型参数和提示词、自动快照、保存版本、查看正文和 Diff、单项测试。
- `/tools`：启停、查看输入输出 schema、运行真实数据测试。
- `/catalog`：按 10 种业务类型查看摘要，商品展示配料、过敏原和营养字段。
- `/evals`：执行 5 个回归用例，校验意图和状态，持久化批次结果。
- `/data`：查看全部 23 个数据集；由服务器读取后渲染。

提供加载骨架、页面错误重试、根错误边界、404、空状态、Toast 和操作中禁用状态。采用 Tailwind CSS 4、shadcn 风格 Button（Radix Slot）、Radix Tabs、Lucide、Sonner 和 Recharts。布局覆盖桌面与移动端，窄屏导航和表格可在各自区域横向滚动。

## 目录与扩展

```text
src/app/                 App Router 页面、布局、错误与加载边界
src/app/api/             HTTP 请求校验与服务调用
src/components/          业务组件
src/components/ui/       共享基础组件
src/hooks/               异步操作、错误和状态管理
src/lib/schemas.ts       23 个集合的 Zod schema 与推导类型
src/lib/registry/        Skill/Tool 注册、路径校验、快照与 Diff
src/lib/store.ts         项目存储实例与环境路径
src/lib/json-store.ts    可独立验证的原子 JSON 存储实现
src/lib/services/        Planner、Eval、统计服务
data/                    中文演示数据
skills/                  技能定义扩展点
tools/                   服务端工具适配器扩展点
public/                  公开静态资源
assets/                  源资源
scripts/                 启动、种子和隔离验收脚本
```

新增集合：在 `schemas.ts` 注册 schema，再添加对应 `data/<name>.json`。服务端通过 `store.read`、`store.write`、`store.update` 操作；修改依赖旧值的数据必须使用 `update`，以保证完整读改写事务被锁住。

新增技能：注册元数据、版本与工具依赖，并在独立服务或适配器实现执行逻辑。已有技能可通过管理页面编辑、启停、保存版本和测试。详见 [注册系统说明](REGISTRY.md)。当前保存即更新生效版本，没有额外的草稿发布审批流。

## 存储保证与边界

- 存储模块使用 `server-only`；API 明确使用 Node.js runtime。客户端没有文件系统访问，也没有任意集合写入接口。
- `SNACKOPS_DATA_DIR` 指定数据根目录；默认是从项目根目录运行时的 `<cwd>/data`。自定义目录需要先准备符合 schema 的数据文件；缺失或损坏数据不会被静默覆盖。
- 文件名来自注册白名单。目录经过 `realpath` 规范化；全局进程锁跨实例和开发 HMR 复用。
- 每次读取和写入都校验结构。`update` 的读、异步 updater、提交均在同一文件锁内；不同文件独立排队。
- 写入同目录唯一临时文件，执行 `fsync` 并关闭，再以 `rename` 原子替换。提交失败不会先删除或截断原文件；临时文件在 finally 中清理。
- Windows 的短暂 `EPERM/EACCES/EBUSY` 会在保持锁的情况下有限重试，不会退化为非原子覆盖。
- 锁只覆盖单个 Node.js 进程；不支持多个服务进程共享写入目录，也不提供跨文件事务。生产部署需要单实例和持久磁盘；多实例时应替换为数据库及事务。
- 原子替换与文件内容同步已实现；未承诺目录元数据的断电持久性。操作系统强制终止可能遗留未提交的 `.tmp` 文件，但不会由程序把其视为有效集合。

## 演示范围

当前是规则路由，不调用 LLM；没有真实退款、支付、短信或物流连接。`llm-config`、工具超时/重试、A/B 和改进数据是后续扩展点，不表示这些能力已经执行。未覆盖问题给出人工处理建议，不自动创建工单。

此骨架是本地演示工作空间，未实现登录、租户隔离或真实订单归属校验。接入真实业务时须在服务层补充这些能力。API 已校验输入并拒绝显式跨源写入请求，但这不等于身份认证。

## 验收

```sh
pnpm typecheck
pnpm lint
pnpm test:store
pnpm test:registry
pnpm build
pnpm validate
```

`pnpm test:store` 会在 5001 端口启动独立开发服务（可用 `STORE_TEST_PORT` 覆盖），复制业务数据到 `.verification/<随机 ID>/business`，临时生成带随机令牌保护的 `/api/store-verification`，完成后停止测试服务并删除测试路由及其失效开发类型缓存。不要与另一个 `next dev` 同时运行，因为它们使用同一个 `.next/dev`。

测试覆盖 40 个并发更新、60 次无锁原始读取、rename 故障、schema 拒绝、updater 抛错后的锁释放、不同文件独立锁、临时文件清理，以及 Planner 持久化、工单接管、Eval 和全部业务页面 HTTP 200。结果保存在 `.verification/store-results.json`。故障注入通过测试实例的文件 I/O 依赖完成，业务实例没有故障开关。

`node scripts/seed.mjs` 补充缺失的种子文件并执行保留已有业务值的结构迁移，不重置运行记录。全部 JSON 使用 UTF-8。

第二阶段增加注册系统迁移：`pnpm migrate:registry` 在停服时运行，补全旧数据的业务字段和注册元数据，保留已有新版配置与正文；迁移前备份到 `.verification/registry-migration-*/`。`seed.mjs` 也会调用这个幂等迁移。运行记录、评价、标注、工单不会被重置。
