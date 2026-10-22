# 压缩包克隆补齐验收

日期：2026-10-19（Asia/Shanghai）。

来源：用户提供的 `snack-agent-studio-main.zip`，SHA-256：

```text
FC09EC87F6B47ECCF5EB6733DB6206A2A1768C835FECAF16BA9DB611CE235115
```

## 交付范围

移植 7 个完整页面、5 个业务组件、27 个 API 路由、模型与 MCP 执行器、79 条补充 Eval 种子，以及 19 份参考 JSON 数据。运行时评测目录合并后实际返回 102 个用例和 120 份导入的历史结果。

入口 `/studio`。保留原 `/`、`/playground`、`/skills`、`/tools` 及原有业务接口，新增 `/agent`、`/demo`、`/planner`、`/ops` 兼容重定向。

13 个参考 Skill 正文导入为新的不可变版本，旧快照保留。Skill 注册和启停共享，Studio 业务数据独立保存在 `data/studio`，未覆盖原商品、工单和运行记录。数据来源关系详见 `STUDIO.md`。

## 实际命令

```text
pnpm validate        exit 0（typecheck + lint）
pnpm build           exit 0
pnpm test:studio     exit 0，12 项集成检查
pnpm test:registry   exit 0，16 项原有注册回归
pnpm test:store      exit 0，14 项原有存储/业务回归
```

共 42 项检查分组通过。日志：

- `.verification/studio-validate.log`
- `.verification/studio-build.log`
- `.verification/studio-test.log`
- `.verification/studio-registry-regression.log`
- `.verification/studio-store-regression.log`

结构化证据：`.verification/studio-results.json`、`.verification/registry-results.json`、`.verification/store-results.json`。

生产启动 `pnpm start` 实际 Ready 于 5000。测试及浏览器实测 `/studio` 全部 7 页返回正常页面。验收服务为长驻进程，完成后主动停止；启动成功不以自然退出码表示，主动中断返回 1。

## 新工作台集成检查

测试使用项目内隔离的 data/skills 副本和本地 HTTP 协议桩，没有真实密钥、外部模型服务调用或费用。最终测试包含 47 次模型协议请求和 1 次 MCP tool call。供应商模型可用性、推理质量未验证。

1. 无密钥时 status 返回 unconfigured，执行拒绝伪造模型结果。
2. 7 个克隆页面和运营读取端点正常；历史标注更新时间没有被 GET 刷新成当前时间。
3. Planner 保存、旧版快照、回滚成功，缺少 risk-check 的配置被拒绝。
4. 模型协议驱动 Planner → Skill → Tool → risk-check，保存完整 Trace 和多轮上下文。
5. 短暂步骤错误触发重试；风控失败不发送未经复核的模型替代回复。
6. Studio 编辑和创建 Skill、文件预览与现有注册中心共享，非法路径被拒绝。
7. Tool 启停影响原有注册读取；代码实现可查看。
8. 商品数据可保存，非法结构保留旧文件；构造恶意目录回滚 payload 被文件白名单拦截。
9. 一星评价自动进入标注；审核后发布 Eval、生成 Skill 草案，并可导出 JSONL；解释接口正常。
10. Eval 保留评分方法和 Trace，A/B 记录变体，接管和监控写入数据。
11. MCP 完成 initialize、tools/list、tools/call，动态 Tool 出现在执行轨迹，未注册能力被 Planner 白名单过滤。
12. 显式跨源写入被拒绝；完整停止、重启后 Skill 和标注仍存在。

## 浏览器检查

本次直接打开正常 HTTP 工作台，新标签可以读取。实际查看 Agent、运营标注和 Planner 页面，并点击“保存 Planner”，看到“Planner 配置已保存，前台下次执行立即生效”。该操作仅保存已有配置，创建审计快照。

已检查 1440×900、1280×720 和 390×844。移动端编排条原先撑宽表单，修复 grid 子项最小宽度和内部滚动后：

```text
390px 视口：clientWidth 375，scrollWidth 375
1280px 视口：clientWidth 1265，scrollWidth 1265
```

15px 差值来自浏览器垂直滚动条，无页面横向溢出。模型状态为“模型未配置”，与无密钥环境相符。

截图：`.verification/studio-planner-saved.png`、`.verification/studio-mobile.png`。

## 检查中修复

- 移植源码的旧导入、API 路由和全局 CSS 冲突。
- 商品无匹配回退到全部商品、优惠券叠加标记未生效、浮点计价问题。
- 风控失败后直接采用模型提供的 safe_reply。
- 旧标注读取时篡改更新时间、Demo 初始对话冒充已确认交易。
- Skill 保存后客户端 hash 未刷新。
- 注册回归测试原先假设 revisions 目录尚不存在；导入后此假设不成立。仅修改隔离夹具，让旧正文路径保持有效、阻断新正文目录，再验证自动快照与失败保留。生产存储保证没有被放宽。

JSON 原子存储、按文件锁、路径约束和旧版本保留继续通过原有回归。运行和配置方式见 `STUDIO.md`。
