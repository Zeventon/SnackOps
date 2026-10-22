# 第二阶段验收：业务能力注册系统

日期：2026-10-16，Asia/Shanghai。

## 最终命令和退出码

```text
pnpm typecheck       exit 0
pnpm lint            exit 0
pnpm build           exit 0
pnpm test:registry   exit 0，16 项检查通过
pnpm test:store      exit 0，原有 14 项回归通过
```

日志分别保存于：

- `.verification/registry-typecheck.log`
- `.verification/registry-lint.log`
- `.verification/registry-build.log`
- `.verification/registry-test.log`
- `.verification/store-regression.log`

结构化结果：`.verification/registry-results.json`、`.verification/store-results.json`。

实际启动 `pnpm start`，5000 端口 Ready；HTTP 验证命令退出码 0：

```text
GET /api/registry          18 enabled Skills, 7 enabled Tools
GET /skills               HTTP 200
GET /tools                HTTP 200
GET /catalog              HTTP 200
GET /catalog?type=orders   HTTP 200
```

服务为长驻进程，Ready 时无退出码；验收完成后主动中断，控制台中断退出码为 1，不是应用自行失败。重新运行 `pnpm dev` 可打开本地界面。

## 注册系统实际检查

1. 启用注册接口返回全部 14 个新增 Skill，含模型参数、路径、正文、hash；Tool 含真实执行契约。
2. 停用 Skill 后，单独启用列表与组合注册列表均不再包含它，Executor 拒绝测试，Planner 转人工。
3. 停用 Tool 后，启用列表移除它；单项测试、依赖 Skill 测试和 Planner 均被拦截。
4. 六个要求的 Tool 返回真实隔离副本中的商品、活动、券、订单、物流或正确价格；商品、订单和物流逐字段比对源 JSON。
5. 固定优惠及百分比优惠金额正确；门槛、适用范围、过期、新客资格、禁止叠加、合并后的总库存、负数量和订单用户不匹配均得到预期错误。
6. 修改前保存旧正文和模型参数；新版本文件与新正文一致；独立计算 SHA-256 与接口 hash 相同。
7. 版本列表、版本详情、手动保存、逐行新增和元数据 Diff 正确。
8. 旧 hash 返回 409；两个相同 hash 的并发修改只允许一个成功，另一个返回 409。
9. `../../`、Windows `..\\..\\`、绝对路径请求被拒绝；模拟注册数据内存在穿越路径也被服务层拒绝，未生成外部文件。
10. 注入正文文件写入失败后，当前 Skill hash 不变，修改前快照仍持久保留。
11. 七类危险拟回复被阻断；安全反诈提示和明确否定极限承诺的回复被放行。
12. 文件正文与注册正文不一致时 Executor 拒绝执行。
13. 14 个新增 Skill 均有可运行的本地测试适配器。
14. 完整停止并重启测试服务后，正文与快照仍可读取；`/skills` 新页面响应确实包含手动保存的快照说明。
15. 管理页、原有业务页和按类型筛选的目录 API 正常返回持久数据。
16. Zod 契约转换成普通 JSON 后，Server/Client 边界没有原型序列化告警。

测试数据和 Skill 文件均复制到项目内 `.verification/registry-*/`，不会把测试中的启停和版本修改写入用户工作空间的正式演示集合。

## 原有能力回归

原有 14 项存储/业务测试全部通过，包括 40 个并发更新不丢失、60 次原始文件读取均为有效 JSON、rename 失败保留原字节、锁释放、独立文件锁、临时文件清理、Planner 持久化、工单接管，以及 5/5 原有 Eval 用例。

原有 5 个 Skill 保留，加上 14 个新增 Skill 共 19 个（18 个启用，旧 promotion-guide 仍停用）。旧 5 个 Tool 元数据保留为停用项，新增 7 个可执行 Tool。原业务记录不重置，迁移前数据备份在 `.verification/registry-migration-*/`。

## 修复与验证限制

- 修复 TypeScript 把价格输出的 `CNY` 推断为普通 string 导致的类型错误。
- 修复 Zod JSON Schema 的非普通对象原型导致 React Server Component 序列化告警；加入回归断言。
- 浏览器工具因协议策略拒绝读取旧预览错误标签，未继续绕过该限制。因此本段完成了 API、服务重启持久化、页面 HTTP 和生产构建验收，未声称完成截图及浏览器点击验收。
- 当前执行模式仍为 `local-rules`。模型参数和系统提示词可编辑、保存、版本化与一致性检查；任意提示词的模型推理需要后续接入适配器。JSON 一致性保证限于单进程及有序提交，不是多进程或跨文件数据库事务。
