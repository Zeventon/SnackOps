# Tool 扩展点

Tool 注册信息与启停配置在 `data/tools.json`。`definitions.ts` 提供 Zod 输入/输出契约和真实执行逻辑，由 `src/lib/registry/tools.ts` 检查启用状态后调用。

已实现 `query_products`、`query_activities`、`query_coupons`、`calculate_price`、`query_orders`、`query_logistics`，另有 `query_policies` 支持原有售后链路。全部工具为本地只读计算/查询，不调用外部退款或物流服务。旧连字符 ID 保留为停用元数据；无执行器的旧项不能启用。

API 返回的 JSON Schema 从执行器的 Zod 契约实时生成，避免维护两份不一致的 schema。`/tools` 可以查看 schema、修改输入 JSON 并运行测试。契约检查不通过返回 400；业务前置条件不满足返回 409；记录不存在返回 404。
