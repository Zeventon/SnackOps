# SnackOps 业务能力注册系统

本阶段沿用原有 Next.js、JSON 存储、运营界面和运行记录，新增注册、执行、版本管理及业务目录。

## 数据和能力

- 23 个数据文件；新增 `handoff-rules.json`，并补全商品口味、标签、配料、过敏原、每 100g 营养，活动/券门槛、规则、有效期与适用范围，订单明细、物流和售后状态，用户新客资格、历史订单和偏好，四类售后政策。
- 19 个 Skill：保留原有 5 个，新增要求的 14 个，包含中文 ID `对话问候-skill`。
- 7 个已实现 Tool：要求的 6 个及 `query_policies`。保留 5 个旧工具注册项，停用且不允许在无适配器时启用。
- 商品营养值为明确标记的虚构演示数据，不能当作真实商品标签。

## 管理页面

- `/skills`：搜索、状态筛选、启停、编辑名称/描述/模型参数/依赖/版本号/系统提示词，保存修改，保存手动快照，查看历史正文，比较两份快照或快照与当前内容，单项测试。列表内切换技能前必须先保存或放弃当前修改。
- `/tools`：启停、Input/Output JSON Schema、示例输入、单项测试、成功结果、JSON 错误和业务错误。
- `/catalog?type=products`：10 类业务数据的数量和摘要，支持查看具体记录。保留 `/data` 全集合只读视图。

## API

读取：

```text
GET /api/registry                         当前启用 Skill 和已实现且启用 Tool
GET /api/skills                           全部 Skill，包含正文、元数据和 hash
GET /api/skills?enabled=true              仅启用 Skill
GET /api/skills/:id                       当前版本
GET /api/skills/:id/versions              快照列表，含完整快照
GET /api/skills/:id/versions/:versionId   单个历史快照
GET /api/skills/:id/diff?from=:id&to=current
GET /api/skills/:id/diff?from=:id&to=:id  两份历史快照比较
GET /api/tools                           全部工具配置及执行器生成的 schema
GET /api/tools?enabled=true              仅已实现且启用的工具
GET /api/tools/:id                       单项工具与 schema
GET /api/catalog                         业务类型与记录数量
GET /api/catalog?type=orders              指定业务数据
```

修改 Skill（启停也使用同一个接口，自动保留快照）：

```http
PATCH /api/skills/need-extraction
Content-Type: application/json

{
  "expectedHash": "从 GET 接口获取的当前 64 位 hash",
  "changeNote": "优先明确预算",
  "changes": {
    "enabled": true,
    "version": "1.0.1",
    "temperature": 0.2,
    "systemPrompt": "完整的新系统提示词正文……"
  }
}
```

`changes` 可包含 name、description、enabled、model、temperature、maxTokens、requiredTools、version、systemPrompt。不接受 id、filePath 或未知字段。文件路径只由服务端生成。版本标签采用 `x.y.z`，可由运营编辑；多份快照可共享版本标签，通过唯一 snapshot ID 和 SHA-256 hash 区分。

其他写入：

```text
POST  /api/skills/:id/versions  { expectedHash, changeNote }
POST  /api/skills/:id/test      { input, draft?, userId?, quotedPrices? }
PATCH /api/tools/:id           { enabled: true/false }
POST  /api/tools/:id/test       对应 input schema 的 JSON
```

`calculate_price` 示例：

```json
{
  "items": [{ "productId": "p-01", "quantity": 2 }],
  "userId": "user-02",
  "couponId": "coupon-01"
}
```

使用整数分计算；重复商品会先合并数量再检查库存。活动门槛按活动适用商品小计；优惠券门槛按活动优惠后适用商品金额。每笔最多显式选择一个活动和一张券，未指定不会自动套用最优优惠。活动可禁止叠券。百分比券 `discount: 10` 表示减免 10%。新客需要用户存在、`isNewCustomer=true` 且历史订单为空。有效期采用 `[startsAt, endsAt)`。

## 执行链路

Planner 每次读取启用注册项，在调用前检查技能和依赖。Executor 再次确认当前配置、启用状态、依赖工具、模型适配器及文件正文一致性。每个 Tool 在执行入口再次读取启停状态并进行输入、输出校验。

停用不会取消已经进入执行器的在途调用；之后开始的调用会重新检查。所有能力仍在一个本地 Node.js 服务进程中运行。

14 个新 Skill 均有可调用的本地规则测试适配器，返回当前 version/hash。`model=local-rules` 表示确定性逻辑：提示词和 temperature/maxTokens 被保存和校验，但不会被伪装成 LLM 推理。其他模型名可保存，未接入执行适配器时测试返回 `MODEL_UNAVAILABLE`。本地规则不能自动理解任意新写的提示词。

## 风险检查

`skills/risk-check/SKILL.md` 中 R01–R08 明确规定价格一致、极限词/夸大功效、售后政策边界、新客资格、特殊人群提醒、投诉不推诿、中奖诈骗防护和安全答复放行。

本地检查器返回每条 ruleId、名称、passed、severity、evidence，以及 `decision` / `canSend`。它检查拟发送答复，不仅依据用户问题中的风险词。安全的反诈提示、否定极限承诺的回复可放行。结构化 `quotedPrices` 可核对价格；自然语言价格识别和风险判断是有限规则，不宣称覆盖任意表达或全面语义审核。Planner 发送草案前会运行该检查。

## 快照、一致性和路径

Skill 元数据及当前正文存于 `data/skills.json`；文件为相同正文的不可变副本；快照存于 `data/skill-versions.json`。初始文件为 `skills/<id>/SKILL.md`，修改产生 `skills/<id>/revisions/<uuid>.md`。

一次修改持有 skills 集合的进程锁，依次：

1. 核对 expectedHash；过期请求返回 409，不覆盖其他编辑。
2. 检查旧路径与工具依赖。
3. 原子保存旧正文和元数据的 `before-edit` 快照。
4. 写新临时正文、同步文件、rename 到唯一版本文件。
5. 保存新版本快照。
6. 原子更新当前注册项的正文与文件引用。

失败时旧的有效注册项保留；中途失败可能留下不被当前引用的版本文件或快照，历史列表以 hash 标识当前内容，不把非当前快照当作已激活版本。这是有序提交策略，不是跨文件数据库事务。

hash 为将 Skill 顶层字段按英文 key 排序后的 JSON 的 SHA-256，包含正文和所有元数据（包括文件路径）；数组顺序属于内容。Diff 使用有界逐行 LCS，并单列元数据变化；过大的行数矩阵退化为完整删除/新增展示。

接口不接受路径编辑；服务端路径检查限定技能 ID、固定相对目录格式、项目内真实路径，拒绝 `..`、绝对路径、Windows 分隔符、符号链接/junction。`SNACKOPS_SKILLS_DIR` 可配置项目内目录供隔离测试，指向项目外会拒绝执行。操作系统层能修改项目文件的主体仍须受信任。

迁移保留旧版本元数据，但旧记录没有历史正文，标记 `legacy`、hash/snapshot 为 null；不伪造旧版本内容，也不对其生成 Diff。

## 验证和迁移

```sh
pnpm migrate:registry
pnpm test:registry
pnpm test:store
pnpm typecheck
pnpm lint
pnpm build
```

迁移在停服状态执行；现有新版字段与正文保留，旧文件备份到 `.verification/registry-migration-*/`。测试在 `.verification/registry-*/` 隔离复制 data 与 skills，使用 5003 端口（`REGISTRY_TEST_PORT` 可覆盖），自动停止测试服务，并实际重启一次以验证版本持久化。不要同时运行两个使用 `.next/dev` 的开发/测试进程。

结果见 `.verification/registry-results.json`，控制台记录见 `.verification/registry-test.log`；服务日志保留在每次隔离目录。项目没有新增外部服务，也没有改变原有单进程 JSON 存储边界。
