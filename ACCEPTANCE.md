# SnackOps 验收记录

验收日期：2026-10-15（Asia/Shanghai）。此记录来自本次实际执行，未将计划执行项目当作通过。

## 环境与安装结果

- Node.js：24.18.0
- pnpm：11.25.0
- Next.js：16.4.0
- React / React DOM：19.3.0
- TypeScript：5.9.3
- Tailwind CSS：4.3.3
- 已生成 `pnpm-lock.yaml`。

## 最终命令与退出码

```text
pnpm install       exit 0
pnpm typecheck     exit 0
pnpm lint          exit 0（无警告）
pnpm test:store    exit 0（14 项检查通过）
pnpm build         exit 0（Turbopack 生产构建成功）
pnpm validate      exit 0（typecheck + lint）
```

启动验收实际执行：

```powershell
pnpm start
# Ready；默认 http://localhost:5000

$env:DEPLOY_RUN_PORT = '5002'
pnpm dev
# Ready；覆盖端口 http://localhost:5002
```

以上启动命令是长驻服务，Ready 时没有退出码。HTTP 验证使用 `Invoke-WebRequest`，并在状态不符合预期时 `exit 1`；最终验证命令退出码为 **0**：

```text
production / HTTP 200
dev override / HTTP 200
temporary API HTTP 404
```

验收结束主动停止启动的服务；启动页面需再次执行 `pnpm dev`。主动中断不代表应用自行失败。

## 存储与接口证据

使用 `pnpm test:store` 自动生成临时 API，以随机令牌保护，隔离复制业务数据，结束后删除测试路由。完整日志见 `.verification/store-test.log`，结构化结果见 `.verification/store-results.json`。

1. 临时 API 创建并读取隔离 JSON 成功。
2. 40 个并发 HTTP 读改写请求，返回 1–40 的完整计数，最终值 40，无丢失更新。
3. 写入同时进行 60 次绕过进程锁的原始文件读取，均为完整且通过 schema 的 JSON。
4. 在有效临时文件写入后注入 rename 失败，目标文件与失败前逐字节相同。
5. 不合法数据被 Zod 拒绝，原文件不变。
6. updater 抛错后锁正确释放，随后更新成功。
7. 一个文件锁住时，另一个文件仍能独立完成更新。
8. 成功及失败路径均不残留 `.tmp` 文件。
9. 临时 API 拒绝无令牌访问。
10. Planner POST 返回 201，GET 能读回刚保存的运行记录。
11. 空问题返回 400。
12. 工单接管返回 200，并实际写入 `processing` 状态。
13. Eval POST 返回 201，5/5 个意图与状态回归用例通过。
14. 全部 8 个业务页面返回 200。

生产构建路由列表不含临时测试 API；实际请求该路径返回 404。

## 浏览器验证

- 1440×900、1280×720、390×844 实际检查。
- 修复移动端表头隐藏文字的定位溢出后，390px 视口的根元素 `scrollWidth` 与 `clientWidth` 均为 375（另 15px 为浏览器滚动条）。页面没有横向溢出；表格和导航保留各自可滚动区域。
- 浏览器点击“运行”，显示“运行成功”和执行轨迹，Toast 确认记录保存。该操作在演示工作空间新增了 1 条真实本地运行记录，故初始 12 条预置记录变为 13 条。
- 浏览器读取到的 error/warn 日志为空。
- 截图：`.verification/overview-desktop.png`、`.verification/planner-desktop.png`、`.verification/mobile-390.png`。

## 首次失败及修复

- `pnpm install` 初次退出 1：Windows 沙箱限制 pnpm 创建符号链接。经授权在可用环境重新执行。
- 安装随后因 pnpm 的依赖构建批准配置退出 1；在 `pnpm-workspace.yaml` 明确允许 `unrs-resolver` 后退出 0。
- 初次 lint 退出 1：渲染函数内读取时间及匿名配置导出；提取统计服务、命名导出配置后通过。
- 首轮存储测试退出 1：Windows 并发读取短暂阻止 rename；为 Windows 特定错误增加有界重试后通过。
- 首轮生产构建退出 1、组合验证退出 2：临时路由已删除，但开发类型缓存仍引用它；自动清理该生成文件后通过。同步修正文件追踪范围，最终构建无该警告。
- 一次沙箱内 HTTP 请求退出 1：本机套接字访问受限；经权限流程执行的最终 HTTP 检查退出 0。

## 当前边界

本地规则 Planner，不调用 LLM；评估校验意图和状态，不代表答复质量评估。JSON 锁限于单进程，不提供多实例协调、跨文件事务或身份认证。详细扩展说明见 README。
